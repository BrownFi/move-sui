module brownfi_amm::swap;

use std::type_name;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::clock::Clock;
use sui::tx_context::sender;
use pyth::price_info::PriceInfoObject;

use brownfi_amm::library;
use brownfi_amm::math;
use brownfi_amm::events;
use brownfi_amm::pool::{Self, Pool, LP};
use brownfi_amm::factory::{Self, Factory, PoolCreatorCap};
use brownfi_amm::oracle_gateway::{Self, PriceBundle};
use brownfi_oracle::oracle::{Self, OracleAdapter};

const EZeroInput: u64 = 0;
const EExcessiveSlippage: u64 = 3;
const ENoLiquidity: u64 = 4;
const EPoolBalanceTooLarge: u64 = 5;
const EInvalidInventory: u64 = 6;
const EInsufficientLiquidity: u64 = 7;
const EInsufficientOutputAmount: u64 = 8;
const EFactoryPaused: u64 = 9;
const EOracleNotConfigured: u64 = 10;
const EMathUnderflow: u64 = 11;
const EZeroDenominator: u64 = 12;
const ECutoffLimitReached: u64 = 13;
const ESwapsPaused: u64 = 14;
const EAddLiquidityPaused: u64 = 15;
const EUnsupportedTokenDecimals: u64 = 16;
const EZeroOutput: u64 = 17;

const PRECISION: u64 = 100_000_000; // 10^8 for precision
const PRICE_SCALE: u128 = 1_000_000_000; // 10^9 normalized absolute oracle prices
const MAX_U64_VALUE: u64 = 18446744073709551615;
const MAX_POOL_BALANCE: u64 = 1_000_000_000_000_000_000; // 1e18
const MIN_LIQUIDITY: u64 = 1000; // BrownFi v3 MINIMUM_LIQUIDITY raw LP units
const MIN_INITIAL_POOL_VALUE: u64 = 10_000_000_000; // BrownFi v3 $10 floor in 9-decimal value units
const MAX_TOKEN_DECIMALS: u8 = 18; // BrownFi v3 supports ERC-20-style decimals up to 18
const STANDARD_DECIMALS: u8 = 9; // Standard decimals for calculations

/// Q32 fixed-point constant (2^32) - reduced from Q64 to prevent overflow
const Q32: u128 = 4294967296;

public fun pool_balances<A, B>(pool: &Pool<A, B>): (u64, u64, u64) {
    pool::get_balances(pool)
}

public fun pool_fee<A, B>(pool: &Pool<A, B>): u32 {
    pool::fee(pool)
}

fun emit_sync_for_pool<A, B>(pool: &Pool<A, B>) {
    events::emit_sync(
        pool::id(pool),
        pool::balance_a(pool),
        pool::balance_b(pool)
    );
}

fun init(ctx: &mut TxContext) {
    factory::create_and_share(ctx);
}

public fun create_pool<A, B>(
    factory: &mut Factory,
    pool_creator_cap: &PoolCreatorCap,
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    init_a: Balance<A>,
    init_b: Balance<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    ctx: &mut TxContext
): Balance<LP<A, B>> {
    create_pool_internal(
        factory,
        pool_creator_cap,
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        init_a,
        init_b,
        token_a_decimals,
        token_b_decimals,
        true,
        ctx
    )
}

#[test_only]
public fun create_pool_for_testing<A, B>(
    factory: &mut Factory,
    pool_creator_cap: &PoolCreatorCap,
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    init_a: Balance<A>,
    init_b: Balance<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    ctx: &mut TxContext
): Balance<LP<A, B>> {
    create_pool_internal(
        factory,
        pool_creator_cap,
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        init_a,
        init_b,
        token_a_decimals,
        token_b_decimals,
        false,
        ctx
    )
}

fun create_pool_internal<A, B>(
    factory: &mut Factory,
    pool_creator_cap: &PoolCreatorCap,
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    init_a: Balance<A>,
    init_b: Balance<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    enforce_initial_value_floor: bool,
    ctx: &mut TxContext
): Balance<LP<A, B>> {
    assert!(!factory::is_paused(factory), EFactoryPaused);
    factory::assert_pool_creator(factory, pool_creator_cap);

    let init_a_val = balance::value(&init_a);
    let init_b_val = balance::value(&init_b);

    assert!(init_a_val > 0 && init_b_val > 0, EZeroInput);
    assert!(init_a_val <= MAX_POOL_BALANCE && init_b_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);
    assert!(token_a_decimals <= MAX_TOKEN_DECIMALS, EUnsupportedTokenDecimals);
    assert!(token_b_decimals <= MAX_TOKEN_DECIMALS, EUnsupportedTokenDecimals);

    // Verify oracle is configured for both tokens
    assert!(oracle::has_config<A>(oracle) && oracle::has_config<B>(oracle), EOracleNotConfigured);

    factory::register_pool<A, B>(factory);

    // Default parameters matching BrownFi v3 MVP.
    let default_quote_token_index = 0; // token A is quote, token B is base
    let default_fee = 100_000; // 0.1%
    let default_fee_split = 0;
    let default_k = ((Q32 / 1000) as u64); // 0.001 in Q32 format
    let default_lambda = 0; // No skewness
    let default_compress = PRECISION as u32;
    let default_s_sell = 0;
    let default_s_buy = 0;
    let default_fix_s = 0;
    let default_dis_threshold = 10_000_000;
    let default_s_bound = 0;
    let default_pyth_weight = 50_000_000;
    let default_gamma = 80_000_000;
    let default_oracle_policy_version = 0;
    let default_oracle_max_price_age = factory::min_price_age(factory);
    let default_oracle_min_sources = 1;
    let default_oracle_required_source_mask = pool::oracle_source_mask_pyth();
    let default_oracle_allowed_source_mask = pool::oracle_source_mask_pyth();
    let default_oracle_primary_source = pool::oracle_source_pyth();
    let default_oracle_max_pair_time_delta_ms = 0;
    let default_oracle_max_confidence = 0;
    let default_oracle_max_deviation = 0;
    let default_oracle_mode = pool::oracle_mode_primary_with_sanity();
    let default_amm_twap_enabled = true;
    let default_amm_blend_weight = 50_000_000;
    let default_amm_min_sources = 0;
    let default_amm_fallback_mode = pool::amm_fallback_oracle_only();
    let default_amm_max_ospread = 0;
    let default_amm_min_liquidity_quote = 0;
    let default_amm_min_window_seconds = 0;
    let default_amm_max_window_seconds = 0;
    let default_amm_allowed_source_mask = 0;
    let default_amm_source_count_limit = 0;
    let default_flash_enabled = false;
    let default_router_enabled = true;
    let oracle_source_type_a = oracle::get_source_type<A>(oracle);
    let oracle_source_type_b = oracle::get_source_type<B>(oracle);
    let oracle_source_id_a = oracle::get_source_id<A>(oracle);
    let oracle_source_id_b = oracle::get_source_id<B>(oracle);
    let oracle_config_data_a = oracle::get_config_data<A>(oracle);
    let oracle_config_data_b = oracle::get_config_data<B>(oracle);

    let mut pool_obj = pool::new(
        init_a,
        init_b,
        token_a_decimals,
        token_b_decimals,
        default_quote_token_index,
        default_fee,
        default_fee_split,
        default_k,
        default_k,
        default_lambda,
        default_compress,
        default_s_sell,
        default_s_buy,
        default_fix_s,
        default_dis_threshold,
        default_s_bound,
        default_pyth_weight,
        default_gamma,
        default_oracle_policy_version,
        default_oracle_max_price_age,
        default_oracle_min_sources,
        default_oracle_required_source_mask,
        default_oracle_allowed_source_mask,
        default_oracle_primary_source,
        default_oracle_max_pair_time_delta_ms,
        default_oracle_max_confidence,
        default_oracle_max_deviation,
        default_oracle_mode,
        oracle_source_type_a,
        oracle_source_type_b,
        oracle_source_id_a,
        oracle_source_id_b,
        oracle_config_data_a,
        oracle_config_data_b,
        default_amm_twap_enabled,
        default_amm_blend_weight,
        default_amm_min_sources,
        default_amm_fallback_mode,
        default_amm_max_ospread,
        default_amm_min_liquidity_quote,
        default_amm_min_window_seconds,
        default_amm_max_window_seconds,
        default_amm_allowed_source_mask,
        default_amm_source_count_limit,
        default_flash_enabled,
        default_router_enabled,
        ctx
    );

    // Get oracle prices using clock
    let min_price_age = factory::min_price_age(factory);
    let price_a = oracle::get_price<A>(oracle, price_info_object_a, clock, min_price_age);
    let price_b = oracle::get_price<B>(oracle, price_info_object_b, clock, min_price_age);

    let parsed_init_a = math::parse_amount_to_standard_decimals(token_a_decimals, init_a_val, STANDARD_DECIMALS);
    let parsed_init_b = math::parse_amount_to_standard_decimals(token_b_decimals, init_b_val, STANDARD_DECIMALS);
    let initial_value =
        (parsed_init_a as u128) * (price_a as u128) +
        (parsed_init_b as u128) * (price_b as u128);
    let lp_total = math::mul_div_down_to_u64(initial_value, 1, PRICE_SCALE);
    if (enforce_initial_value_floor) {
        assert!(lp_total >= MIN_INITIAL_POOL_VALUE, ENoLiquidity);
    };
    assert!(lp_total > MIN_LIQUIDITY, ENoLiquidity);

    let locked_lp = pool::mint_lp(&mut pool_obj, MIN_LIQUIDITY);
    pool::deposit_locked_lp(&mut pool_obj, locked_lp);
    let lp_amount_u64 = lp_total - MIN_LIQUIDITY;
    let lp_balance = pool::mint_lp(&mut pool_obj, lp_amount_u64);

    emit_sync_for_pool(&pool_obj);

    events::emit_pool_created(
        pool::id(&pool_obj),
        type_name::with_defining_ids<A>(),
        type_name::with_defining_ids<B>(),
        pool::balance_a(&pool_obj),
        pool::balance_b(&pool_obj),
        lp_amount_u64
    );

    pool::share(pool_obj);
    lp_balance
}

public fun add_liquidity<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    mut input_a: Balance<A>,
    mut input_b: Balance<B>,
    min_lp_out: u64
): (Balance<A>, Balance<B>, Balance<LP<A, B>>) {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    add_liquidity_with_bundle(&price_bundle, clock, pool, input_a, input_b, min_lp_out)
}

public fun add_liquidity_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    mut input_a: Balance<A>,
    mut input_b: Balance<B>,
    min_lp_out: u64
): (Balance<A>, Balance<B>, Balance<LP<A, B>>) {
    assert!(!pool::add_liquidity_paused(pool), EAddLiquidityPaused);

    let input_a_val = balance::value(&input_a);
    let input_b_val = balance::value(&input_b);
    let pool_a_val = pool::balance_a(pool);
    let pool_b_val = pool::balance_b(pool);

    assert!(input_a_val > 0 && input_b_val > 0, EZeroInput);
    assert!(pool_a_val <= MAX_POOL_BALANCE && pool_b_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);
    assert_pool_balance_can_accept_input(pool_a_val, input_a_val);
    assert_pool_balance_can_accept_input(pool_b_val, input_b_val);

    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);
    let oracle_relative_price = oracle_gateway::bundle_oracle_relative_price(price_bundle);
    let amm_relative_price = oracle_gateway::bundle_amm_relative_price(price_bundle);
    let amm_source_count = oracle_gateway::bundle_amm_source_count(price_bundle);
    assert!(oracle_relative_price > 0, EInvalidInventory);
    if (amm_source_count > 0) {
        assert!(amm_relative_price > 0, EInvalidInventory);
    };

    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);
    let parsed_input_a = math::parse_amount_to_standard_decimals(decimals_a, input_a_val, STANDARD_DECIMALS);
    let parsed_input_b = math::parse_amount_to_standard_decimals(decimals_b, input_b_val, STANDARD_DECIMALS);
    let parsed_pool_a = math::parse_amount_to_standard_decimals(decimals_a, pool_a_val, STANDARD_DECIMALS);
    let parsed_pool_b = math::parse_amount_to_standard_decimals(decimals_b, pool_b_val, STANDARD_DECIMALS);

    let quote_token_index = pool::quote_token_index(pool);
    let parsed_input_base = if (quote_token_index == 0) { parsed_input_b } else { parsed_input_a };
    let parsed_input_quote = if (quote_token_index == 0) { parsed_input_a } else { parsed_input_b };
    let parsed_pool_base = if (quote_token_index == 0) { parsed_pool_b } else { parsed_pool_a };
    let parsed_pool_quote = if (quote_token_index == 0) { parsed_pool_a } else { parsed_pool_b };

    let mut deposit_a: u64;
    let mut deposit_b: u64;
    let mut lp_to_issue: u64;
    let mut deposit_relative_price = oracle_relative_price;
    let total_supply = pool::lp_supply(pool);
    let oracle_inventory_value = liquidity_inventory_value_from_relative_price(
        parsed_pool_base,
        parsed_pool_quote,
        oracle_relative_price
    );

    if (total_supply == 0 || oracle_inventory_value == 0) {
        lp_to_issue = math::mul_sqrt(input_a_val, input_b_val);
        assert!(lp_to_issue >= MIN_LIQUIDITY, ENoLiquidity);
    } else {
        let oracle_lp = lp_for_liquidity_value_from_relative_price(
            parsed_input_base,
            parsed_input_quote,
            parsed_pool_base,
            parsed_pool_quote,
            total_supply,
            oracle_relative_price
        );
        lp_to_issue = oracle_lp;
        if (amm_source_count > 0) {
            let amm_lp = lp_for_liquidity_value_from_relative_price(
                parsed_input_base,
                parsed_input_quote,
                parsed_pool_base,
                parsed_pool_quote,
                total_supply,
                amm_relative_price
            );
            if (amm_lp < oracle_lp) {
                lp_to_issue = amm_lp;
                deposit_relative_price = amm_relative_price;
            };
        };
    };

    if (total_supply == 0 || oracle_inventory_value == 0 || lp_to_issue == 0) {
        deposit_a = input_a_val;
        deposit_b = input_b_val;
    } else {
        (deposit_a, deposit_b) = liquidity_deposit_amounts_from_relative_price(
            parsed_input_base,
            parsed_input_quote,
            input_a_val,
            input_b_val,
            decimals_a,
            decimals_b,
            quote_token_index,
            deposit_relative_price
        );
        if (deposit_a == 0 || deposit_b == 0) {
            deposit_a = input_a_val;
            deposit_b = input_b_val;
            lp_to_issue = 0;
        } else {
            let actual_deposit_a = math::parse_amount_to_standard_decimals(
                decimals_a,
                deposit_a,
                STANDARD_DECIMALS
            );
            let actual_deposit_b = math::parse_amount_to_standard_decimals(
                decimals_b,
                deposit_b,
                STANDARD_DECIMALS
            );
            let actual_deposit_base = if (quote_token_index == 0) { actual_deposit_b } else { actual_deposit_a };
            let actual_deposit_quote = if (quote_token_index == 0) { actual_deposit_a } else { actual_deposit_b };
            (deposit_a, deposit_b) = liquidity_deposit_amounts_from_relative_price(
                actual_deposit_base,
                actual_deposit_quote,
                deposit_a,
                deposit_b,
                decimals_a,
                decimals_b,
                quote_token_index,
                deposit_relative_price
            );
            let final_deposit_a = math::parse_amount_to_standard_decimals(
                decimals_a,
                deposit_a,
                STANDARD_DECIMALS
            );
            let final_deposit_b = math::parse_amount_to_standard_decimals(
                decimals_b,
                deposit_b,
                STANDARD_DECIMALS
            );
            let final_deposit_base = if (quote_token_index == 0) { final_deposit_b } else { final_deposit_a };
            let final_deposit_quote = if (quote_token_index == 0) { final_deposit_a } else { final_deposit_b };
            lp_to_issue = lp_for_liquidity_value_from_relative_price(
                final_deposit_base,
                final_deposit_quote,
                parsed_pool_base,
                parsed_pool_quote,
                total_supply,
                deposit_relative_price
            );
        };
    };

    assert!(lp_to_issue >= min_lp_out, EExcessiveSlippage);
    assert!(lp_to_issue > 0, EInsufficientLiquidity);

    pool::deposit_a(pool, balance::split(&mut input_a, deposit_a));
    pool::deposit_b(pool, balance::split(&mut input_b, deposit_b));

    let lp = pool::mint_lp(pool, lp_to_issue);

    emit_sync_for_pool(pool);

    events::emit_add_liquidity(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        type_name::with_defining_ids<B>(),
        deposit_a,
        deposit_b,
        lp_to_issue,
        oracle_gateway::bundle_pyth_price_a(price_bundle),
        oracle_gateway::bundle_pyth_price_b(price_bundle),
        oracle_gateway::bundle_oracle_relative_price(price_bundle),
        oracle_gateway::bundle_amm_relative_price(price_bundle),
        oracle_gateway::bundle_source_count(price_bundle),
        oracle_gateway::bundle_amm_source_count(price_bundle)
    );

    (input_a, input_b, lp)
}

fun liquidity_inventory_value_from_relative_price(
    base_amount_standard: u64,
    quote_amount_standard: u64,
    relative_price_q32: u64
): u128 {
    math::mul_div_down_u128(
        (base_amount_standard as u128),
        (relative_price_q32 as u128),
        Q32
    ) + (quote_amount_standard as u128)
}

fun liquidity_input_value_from_relative_price(
    base_amount_standard: u64,
    quote_amount_standard: u64,
    relative_price_q32: u64
): u128 {
    let base_value_quote = math::mul_div_down_u128(
        (base_amount_standard as u128),
        (relative_price_q32 as u128),
        Q32
    );
    math::min_u128(base_value_quote, (quote_amount_standard as u128)) * 2
}

fun lp_for_liquidity_value_from_relative_price(
    input_base_standard: u64,
    input_quote_standard: u64,
    pool_base_standard: u64,
    pool_quote_standard: u64,
    total_supply: u64,
    relative_price_q32: u64
): u64 {
    let pool_value = liquidity_inventory_value_from_relative_price(
        pool_base_standard,
        pool_quote_standard,
        relative_price_q32
    );
    if (pool_value == 0) {
        return 0
    };
    let input_value = liquidity_input_value_from_relative_price(
        input_base_standard,
        input_quote_standard,
        relative_price_q32
    );
    math::mul_div_down_to_u64((total_supply as u128), input_value, pool_value)
}

fun liquidity_deposit_amounts_from_relative_price(
    input_base_standard: u64,
    input_quote_standard: u64,
    input_a_raw: u64,
    input_b_raw: u64,
    decimals_a: u8,
    decimals_b: u8,
    quote_token_index: u8,
    relative_price_q32: u64
): (u64, u64) {
    let base_value_quote = math::mul_div_down_u128(
        (input_base_standard as u128),
        (relative_price_q32 as u128),
        Q32
    );
    let quote_is_min = (input_quote_standard as u128) <= base_value_quote;
    let quote_standard_used: u64;
    let base_standard_used: u64;
    if (quote_is_min) {
        quote_standard_used = input_quote_standard;
        base_standard_used = math::mul_div_down_to_u64(
            (input_quote_standard as u128),
            Q32,
            (relative_price_q32 as u128)
        );
    } else {
        base_standard_used = input_base_standard;
        quote_standard_used = (base_value_quote as u64);
    };

    if (quote_token_index == 0) {
        let mut deposit_a = math::parse_amount_from_standard_decimals(
            decimals_a,
            quote_standard_used,
            STANDARD_DECIMALS
        );
        let mut deposit_b = math::parse_amount_from_standard_decimals(
            decimals_b,
            base_standard_used,
            STANDARD_DECIMALS
        );
        if (deposit_a > input_a_raw) { deposit_a = input_a_raw };
        if (deposit_b > input_b_raw) { deposit_b = input_b_raw };
        (deposit_a, deposit_b)
    } else {
        let mut deposit_a = math::parse_amount_from_standard_decimals(
            decimals_a,
            base_standard_used,
            STANDARD_DECIMALS
        );
        let mut deposit_b = math::parse_amount_from_standard_decimals(
            decimals_b,
            quote_standard_used,
            STANDARD_DECIMALS
        );
        if (deposit_a > input_a_raw) { deposit_a = input_a_raw };
        if (deposit_b > input_b_raw) { deposit_b = input_b_raw };
        (deposit_a, deposit_b)
    }
}

public fun remove_liquidity<A, B>(
    pool: &mut Pool<A, B>,
    lp_in: Balance<LP<A, B>>,
    min_a_out: u64,
    min_b_out: u64
): (Balance<A>, Balance<B>) {
    assert!(balance::value(&lp_in) > 0, EZeroInput);

    let lp_in_amount = balance::value(&lp_in);
    let pool_a_amount = pool::balance_a(pool);
    let pool_b_amount = pool::balance_b(pool);
    let lp_supply_val = pool::lp_supply(pool);

    let a_out = math::mul_div(lp_in_amount, pool_a_amount, lp_supply_val);
    let b_out = math::mul_div(lp_in_amount, pool_b_amount, lp_supply_val);
    assert!(a_out >= min_a_out, EExcessiveSlippage);
    assert!(b_out >= min_b_out, EExcessiveSlippage);
    assert!(a_out > 0 && b_out > 0, EInsufficientLiquidity);

    pool::burn_lp(pool, lp_in);

    let out_a = pool::withdraw_a(pool, a_out);
    let out_b = pool::withdraw_b(pool, b_out);
    emit_sync_for_pool(pool);

    events::emit_remove_liquidity(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        type_name::with_defining_ids<B>(),
        a_out,
        b_out,
        lp_in_amount
    );

    (out_a, out_b)
}

/// Swap token A for token B with inventory-based AMM
public fun swap_a_for_b<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Balance<A>,
    min_out: u64
): Balance<B> {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    swap_a_for_b_with_bundle(&price_bundle, clock, pool, input, min_out)
}

fun emit_price_bundle_used_for_swap<A, B, TokenIn, TokenOut>(
    price_bundle: &PriceBundle,
    pool: &Pool<A, B>,
    pre_trade_price: u64
) {
    events::emit_price_bundle_used(
        pool::id(pool),
        type_name::with_defining_ids<TokenIn>(),
        type_name::with_defining_ids<TokenOut>(),
        oracle_gateway::bundle_policy_version(price_bundle),
        oracle_gateway::bundle_policy_digest(price_bundle),
        oracle_gateway::bundle_price_digest(price_bundle),
        oracle_gateway::bundle_pyth_price_a(price_bundle),
        oracle_gateway::bundle_pyth_price_b(price_bundle),
        oracle_gateway::bundle_oracle_relative_price(price_bundle),
        oracle_gateway::bundle_amm_relative_price(price_bundle),
        oracle_gateway::bundle_adj_price(price_bundle),
        oracle_gateway::bundle_sell_price(price_bundle),
        oracle_gateway::bundle_buy_price(price_bundle),
        pre_trade_price,
        oracle_gateway::bundle_source_count(price_bundle),
        oracle_gateway::bundle_amm_source_count(price_bundle)
    );
}

fun emit_swap_executed_for_swap<A, B, TokenIn, TokenOut>(
    price_bundle: &PriceBundle,
    pool: &Pool<A, B>,
    direction: u8,
    actual_input: u64,
    pseudo_input: u64,
    raw_output: u64,
    cutoff_output: u64,
    final_output: u64,
    fee_amount: u64,
    protocol_lp_minted: u64
) {
    events::emit_swap_executed(
        pool::id(pool),
        direction,
        type_name::with_defining_ids<TokenIn>(),
        type_name::with_defining_ids<TokenOut>(),
        actual_input,
        pseudo_input,
        raw_output,
        cutoff_output,
        final_output,
        fee_amount,
        protocol_lp_minted,
        oracle_gateway::bundle_adj_price(price_bundle),
        oracle_gateway::bundle_sell_price(price_bundle),
        oracle_gateway::bundle_buy_price(price_bundle),
        oracle_gateway::bundle_source_count(price_bundle),
        oracle_gateway::bundle_amm_source_count(price_bundle),
        oracle_gateway::bundle_o_spread(price_bundle)
    );
}

public fun swap_a_for_b_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Balance<A>,
    min_out: u64
): Balance<B> {
    assert!(!pool::swaps_paused(pool), ESwapsPaused);
    assert!(balance::value(&input) > 0, EZeroInput);

    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let amount_in = balance::value(&input);
    assert_pool_balance_can_accept_input(reserve_a, amount_in);

    // Get pool parameters
    let (fee, _, lambda, fee_split) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);

    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);
    let price_a = oracle_gateway::bundle_pyth_price_a(price_bundle);
    let price_b = oracle_gateway::bundle_pyth_price_b(price_bundle);
    let adj_price = oracle_gateway::bundle_adj_price(price_bundle);
    let sell_price = oracle_gateway::bundle_sell_price(price_bundle);
    let buy_price = oracle_gateway::bundle_buy_price(price_bundle);

    // Compute skewness-adjusted prices if lambda > 0
    let (skew_price_a, skew_price_b) = if (lambda > 0) {
        compute_skewness_price(reserve_a, reserve_b, decimals_a, decimals_b, price_a, price_b, lambda)
    } else {
        (price_a, price_b)
    };

    // Calculate v3 oracle-priced output with explicit trader-output rounding down.
    let amount_in_no_fee = math::pseudo_in_from_actual_u128(
        (amount_in as u128),
        fee,
        (PRECISION as u128)
    );
    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), sell_price, pool::k_b(pool))
    } else {
        (buy_price, (Q32 as u64), pool::k_q(pool))
    };
    let (amount_out, raw_output, cutoff_output) = v3_amount_out_with_analytics(
        amount_in,
        reserve_a,
        reserve_b,
        price_in,
        price_out,
        adj_price,
        kappa,
        pool::gamma(pool),
        fee,
        decimals_a,
        decimals_b,
        is_sell
    );
    let fee_amount = math::fee_from_pseudo_input_u128(
        amount_in_no_fee,
        fee,
        (PRECISION as u128)
    ) as u64;

    assert!(amount_out >= min_out, EExcessiveSlippage);
    assert!(amount_out <= reserve_b, EInsufficientLiquidity);

    // Deposit input first (balance will increase)
    pool::deposit_a(pool, input);
    let new_balance_a = pool::balance_a(pool);
    let new_balance_b = pool::balance_b(pool);

    check_inventory_v3(
        reserve_a, reserve_b,
        new_balance_a, new_balance_b - amount_out,
        decimals_a, decimals_b,
        if (is_sell) { sell_price } else { buy_price },
        amount_out,
        is_sell,
        kappa,
        token_a_is_quote
    );

    let output = pool::withdraw_b(pool, amount_out);

    let protocol_lp_minted = if (fee_split > 0 && pool::has_fee_to(pool)) {
        collect_protocol_fee_on_swap(
            pool,
            token_a_is_quote,
            true,
            (amount_in_no_fee as u64),
            fee,
            fee_split,
            if (is_sell) { sell_price } else { buy_price }
        )
    } else {
        0
    };

    emit_sync_for_pool(pool);

    emit_price_bundle_used_for_swap<A, B, A, B>(
        price_bundle,
        pool,
        if (is_sell) { sell_price } else { buy_price }
    );

    emit_swap_executed_for_swap<A, B, A, B>(
        price_bundle,
        pool,
        if (is_sell) { events::swap_direction_sell() } else { events::swap_direction_buy() },
        amount_in,
        (amount_in_no_fee as u64),
        raw_output,
        cutoff_output,
        amount_out,
        fee_amount,
        protocol_lp_minted
    );

    events::emit_swap(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        amount_in,
        type_name::with_defining_ids<B>(),
        amount_out,
        skew_price_a,
        skew_price_b
    );

    output
}

/// Swap token B for token A with inventory-based AMM
public fun swap_b_for_a<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Balance<B>,
    min_out: u64
): Balance<A> {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    swap_b_for_a_with_bundle(&price_bundle, clock, pool, input, min_out)
}

public fun swap_b_for_a_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Balance<B>,
    min_out: u64
): Balance<A> {
    assert!(!pool::swaps_paused(pool), ESwapsPaused);
    assert!(balance::value(&input) > 0, EZeroInput);

    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let amount_in = balance::value(&input);
    assert_pool_balance_can_accept_input(reserve_b, amount_in);

    // Get pool parameters
    let (fee, _, lambda, fee_split) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);

    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);
    let price_a = oracle_gateway::bundle_pyth_price_a(price_bundle);
    let price_b = oracle_gateway::bundle_pyth_price_b(price_bundle);
    let adj_price = oracle_gateway::bundle_adj_price(price_bundle);
    let sell_price = oracle_gateway::bundle_sell_price(price_bundle);
    let buy_price = oracle_gateway::bundle_buy_price(price_bundle);

    // Compute skewness-adjusted prices if lambda > 0
    let (skew_price_a, skew_price_b) = if (lambda > 0) {
        compute_skewness_price(reserve_a, reserve_b, decimals_a, decimals_b, price_a, price_b, lambda)
    } else {
        (price_a, price_b)
    };

    let amount_in_no_fee = math::pseudo_in_from_actual_u128(
        (amount_in as u128),
        fee,
        (PRECISION as u128)
    );
    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = !token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), sell_price, pool::k_b(pool))
    } else {
        (buy_price, (Q32 as u64), pool::k_q(pool))
    };
    let (amount_out, raw_output, cutoff_output) = v3_amount_out_with_analytics(
        amount_in,
        reserve_b,
        reserve_a,
        price_in,
        price_out,
        adj_price,
        kappa,
        pool::gamma(pool),
        fee,
        decimals_b,
        decimals_a,
        is_sell
    );
    let fee_amount = math::fee_from_pseudo_input_u128(
        amount_in_no_fee,
        fee,
        (PRECISION as u128)
    ) as u64;

    assert!(amount_out >= min_out, EExcessiveSlippage);
    assert!(amount_out <= reserve_a, EInsufficientLiquidity);

    // Deposit input first
    pool::deposit_b(pool, input);
    let new_balance_a = pool::balance_a(pool);
    let new_balance_b = pool::balance_b(pool);

    check_inventory_v3(
        reserve_a, reserve_b,
        new_balance_a - amount_out, new_balance_b,
        decimals_a, decimals_b,
        if (is_sell) { sell_price } else { buy_price },
        amount_out,
        is_sell,
        kappa,
        token_a_is_quote
    );

    let output = pool::withdraw_a(pool, amount_out);

    let protocol_lp_minted = if (fee_split > 0 && pool::has_fee_to(pool)) {
        collect_protocol_fee_on_swap(
            pool,
            token_a_is_quote,
            false,
            (amount_in_no_fee as u64),
            fee,
            fee_split,
            if (is_sell) { sell_price } else { buy_price }
        )
    } else {
        0
    };

    emit_sync_for_pool(pool);

    emit_price_bundle_used_for_swap<A, B, B, A>(
        price_bundle,
        pool,
        if (is_sell) { sell_price } else { buy_price }
    );

    emit_swap_executed_for_swap<A, B, B, A>(
        price_bundle,
        pool,
        if (is_sell) { events::swap_direction_sell() } else { events::swap_direction_buy() },
        amount_in,
        (amount_in_no_fee as u64),
        raw_output,
        cutoff_output,
        amount_out,
        fee_amount,
        protocol_lp_minted
    );

    events::emit_swap(
        pool::id(pool),
        type_name::with_defining_ids<B>(),
        amount_in,
        type_name::with_defining_ids<A>(),
        amount_out,
        skew_price_a,
        skew_price_b
    );

    output
}

public fun quote_a_for_b<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_in: u64
): (u64, u64, u64) {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    quote_a_for_b_with_bundle(&price_bundle, clock, pool, amount_in)
}

public fun quote_a_for_b_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_in: u64
): (u64, u64, u64) {
    assert!(amount_in > 0, EZeroInput);

    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let (fee, _, _, _) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);
    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);

    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), oracle_gateway::bundle_sell_price(price_bundle), pool::k_b(pool))
    } else {
        (oracle_gateway::bundle_buy_price(price_bundle), (Q32 as u64), pool::k_q(pool))
    };

    v3_amount_out_with_analytics(
        amount_in,
        reserve_a,
        reserve_b,
        price_in,
        price_out,
        oracle_gateway::bundle_adj_price(price_bundle),
        kappa,
        pool::gamma(pool),
        fee,
        decimals_a,
        decimals_b,
        is_sell
    )
}

public fun quote_b_for_a<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_in: u64
): (u64, u64, u64) {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    quote_b_for_a_with_bundle(&price_bundle, clock, pool, amount_in)
}

public fun quote_b_for_a_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_in: u64
): (u64, u64, u64) {
    assert!(amount_in > 0, EZeroInput);

    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let (fee, _, _, _) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);
    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);

    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = !token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), oracle_gateway::bundle_sell_price(price_bundle), pool::k_b(pool))
    } else {
        (oracle_gateway::bundle_buy_price(price_bundle), (Q32 as u64), pool::k_q(pool))
    };

    v3_amount_out_with_analytics(
        amount_in,
        reserve_b,
        reserve_a,
        price_in,
        price_out,
        oracle_gateway::bundle_adj_price(price_bundle),
        kappa,
        pool::gamma(pool),
        fee,
        decimals_b,
        decimals_a,
        is_sell
    )
}

/// Swap at most token A input for an exact token B output.
public fun swap_a_for_exact_b<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Balance<A>,
    amount_out: u64
): (Balance<A>, Balance<B>) {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    swap_a_for_exact_b_with_bundle(&price_bundle, clock, pool, input, amount_out)
}

public fun swap_a_for_exact_b_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    mut input: Balance<A>,
    amount_out: u64
): (Balance<A>, Balance<B>) {
    assert!(!pool::swaps_paused(pool), ESwapsPaused);
    assert!(balance::value(&input) > 0, EZeroInput);
    assert!(amount_out > 0, EInsufficientOutputAmount);

    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);
    assert!(amount_out <= reserve_b, EInsufficientLiquidity);

    let (fee, _, lambda, fee_split) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);

    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);
    let price_a = oracle_gateway::bundle_pyth_price_a(price_bundle);
    let price_b = oracle_gateway::bundle_pyth_price_b(price_bundle);
    let adj_price = oracle_gateway::bundle_adj_price(price_bundle);
    let sell_price = oracle_gateway::bundle_sell_price(price_bundle);
    let buy_price = oracle_gateway::bundle_buy_price(price_bundle);

    let (skew_price_a, skew_price_b) = if (lambda > 0) {
        compute_skewness_price(reserve_a, reserve_b, decimals_a, decimals_b, price_a, price_b, lambda)
    } else {
        (price_a, price_b)
    };

    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), sell_price, pool::k_b(pool))
    } else {
        (buy_price, (Q32 as u64), pool::k_q(pool))
    };
    let (amount_in, effective_out) = v3_amount_in(
        amount_out,
        reserve_a,
        reserve_b,
        price_in,
        price_out,
        adj_price,
        kappa,
        pool::gamma(pool),
        fee,
        decimals_a,
        decimals_b,
        is_sell
    );

    assert!(effective_out == amount_out, ECutoffLimitReached);
    assert!(amount_in <= balance::value(&input), EExcessiveSlippage);
    assert_pool_balance_can_accept_input(reserve_a, amount_in);

    let amount_in_no_fee = math::pseudo_in_from_actual_u128(
        (amount_in as u128),
        fee,
        (PRECISION as u128)
    );
    let fee_amount = math::fee_from_pseudo_input_u128(
        amount_in_no_fee,
        fee,
        (PRECISION as u128)
    ) as u64;

    pool::deposit_a(pool, balance::split(&mut input, amount_in));
    let new_balance_a = pool::balance_a(pool);
    let new_balance_b = pool::balance_b(pool);

    check_inventory_v3(
        reserve_a, reserve_b,
        new_balance_a, new_balance_b - amount_out,
        decimals_a, decimals_b,
        if (is_sell) { sell_price } else { buy_price },
        amount_out,
        is_sell,
        kappa,
        token_a_is_quote
    );

    let output = pool::withdraw_b(pool, amount_out);

    let protocol_lp_minted = if (fee_split > 0 && pool::has_fee_to(pool)) {
        collect_protocol_fee_on_swap(
            pool,
            token_a_is_quote,
            true,
            (amount_in_no_fee as u64),
            fee,
            fee_split,
            if (is_sell) { sell_price } else { buy_price }
        )
    } else {
        0
    };

    emit_sync_for_pool(pool);

    emit_price_bundle_used_for_swap<A, B, A, B>(
        price_bundle,
        pool,
        if (is_sell) { sell_price } else { buy_price }
    );

    emit_swap_executed_for_swap<A, B, A, B>(
        price_bundle,
        pool,
        if (is_sell) { events::swap_direction_sell() } else { events::swap_direction_buy() },
        amount_in,
        (amount_in_no_fee as u64),
        amount_out,
        effective_out,
        amount_out,
        fee_amount,
        protocol_lp_minted
    );

    events::emit_swap(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        amount_in,
        type_name::with_defining_ids<B>(),
        amount_out,
        skew_price_a,
        skew_price_b
    );

    (input, output)
}

/// Swap at most token B input for an exact token A output.
public fun swap_b_for_exact_a<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Balance<B>,
    amount_out: u64
): (Balance<B>, Balance<A>) {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    swap_b_for_exact_a_with_bundle(&price_bundle, clock, pool, input, amount_out)
}

public fun swap_b_for_exact_a_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    mut input: Balance<B>,
    amount_out: u64
): (Balance<B>, Balance<A>) {
    assert!(!pool::swaps_paused(pool), ESwapsPaused);
    assert!(balance::value(&input) > 0, EZeroInput);
    assert!(amount_out > 0, EInsufficientOutputAmount);

    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);
    assert!(amount_out <= reserve_a, EInsufficientLiquidity);

    let (fee, _, lambda, fee_split) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);

    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);
    let price_a = oracle_gateway::bundle_pyth_price_a(price_bundle);
    let price_b = oracle_gateway::bundle_pyth_price_b(price_bundle);
    let adj_price = oracle_gateway::bundle_adj_price(price_bundle);
    let sell_price = oracle_gateway::bundle_sell_price(price_bundle);
    let buy_price = oracle_gateway::bundle_buy_price(price_bundle);

    let (skew_price_a, skew_price_b) = if (lambda > 0) {
        compute_skewness_price(reserve_a, reserve_b, decimals_a, decimals_b, price_a, price_b, lambda)
    } else {
        (price_a, price_b)
    };

    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = !token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), sell_price, pool::k_b(pool))
    } else {
        (buy_price, (Q32 as u64), pool::k_q(pool))
    };
    let (amount_in, effective_out) = v3_amount_in(
        amount_out,
        reserve_b,
        reserve_a,
        price_in,
        price_out,
        adj_price,
        kappa,
        pool::gamma(pool),
        fee,
        decimals_b,
        decimals_a,
        is_sell
    );

    assert!(effective_out == amount_out, ECutoffLimitReached);
    assert!(amount_in <= balance::value(&input), EExcessiveSlippage);
    assert_pool_balance_can_accept_input(reserve_b, amount_in);

    let amount_in_no_fee = math::pseudo_in_from_actual_u128(
        (amount_in as u128),
        fee,
        (PRECISION as u128)
    );
    let fee_amount = math::fee_from_pseudo_input_u128(
        amount_in_no_fee,
        fee,
        (PRECISION as u128)
    ) as u64;

    pool::deposit_b(pool, balance::split(&mut input, amount_in));
    let new_balance_a = pool::balance_a(pool);
    let new_balance_b = pool::balance_b(pool);

    check_inventory_v3(
        reserve_a, reserve_b,
        new_balance_a - amount_out, new_balance_b,
        decimals_a, decimals_b,
        if (is_sell) { sell_price } else { buy_price },
        amount_out,
        is_sell,
        kappa,
        token_a_is_quote
    );

    let output = pool::withdraw_a(pool, amount_out);

    let protocol_lp_minted = if (fee_split > 0 && pool::has_fee_to(pool)) {
        collect_protocol_fee_on_swap(
            pool,
            token_a_is_quote,
            false,
            (amount_in_no_fee as u64),
            fee,
            fee_split,
            if (is_sell) { sell_price } else { buy_price }
        )
    } else {
        0
    };

    emit_sync_for_pool(pool);

    emit_price_bundle_used_for_swap<A, B, B, A>(
        price_bundle,
        pool,
        if (is_sell) { sell_price } else { buy_price }
    );

    emit_swap_executed_for_swap<A, B, B, A>(
        price_bundle,
        pool,
        if (is_sell) { events::swap_direction_sell() } else { events::swap_direction_buy() },
        amount_in,
        (amount_in_no_fee as u64),
        amount_out,
        effective_out,
        amount_out,
        fee_amount,
        protocol_lp_minted
    );

    events::emit_swap(
        pool::id(pool),
        type_name::with_defining_ids<B>(),
        amount_in,
        type_name::with_defining_ids<A>(),
        amount_out,
        skew_price_a,
        skew_price_b
    );

    (input, output)
}

public fun quote_a_for_exact_b<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_out: u64
): (u64, u64) {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    quote_a_for_exact_b_with_bundle(&price_bundle, clock, pool, amount_out)
}

public fun quote_a_for_exact_b_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_out: u64
): (u64, u64) {
    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let (fee, _, _, _) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);
    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);

    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), oracle_gateway::bundle_sell_price(price_bundle), pool::k_b(pool))
    } else {
        (oracle_gateway::bundle_buy_price(price_bundle), (Q32 as u64), pool::k_q(pool))
    };

    v3_amount_in(
        amount_out,
        reserve_a,
        reserve_b,
        price_in,
        price_out,
        oracle_gateway::bundle_adj_price(price_bundle),
        kappa,
        pool::gamma(pool),
        fee,
        decimals_a,
        decimals_b,
        is_sell
    )
}

public fun quote_a_for_exact_b_without_cutoff<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_out: u64
): u64 {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    quote_a_for_exact_b_without_cutoff_with_bundle(&price_bundle, clock, pool, amount_out)
}

public fun quote_a_for_exact_b_without_cutoff_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_out: u64
): u64 {
    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let (fee, _, _, _) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);
    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);

    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), oracle_gateway::bundle_sell_price(price_bundle), pool::k_b(pool))
    } else {
        (oracle_gateway::bundle_buy_price(price_bundle), (Q32 as u64), pool::k_q(pool))
    };

    v3_amount_in_without_cutoff(
        amount_out,
        reserve_b,
        price_in,
        price_out,
        kappa,
        fee,
        decimals_a,
        decimals_b
    )
}

public fun quote_b_for_exact_a<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_out: u64
): (u64, u64) {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    quote_b_for_exact_a_with_bundle(&price_bundle, clock, pool, amount_out)
}

public fun quote_b_for_exact_a_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_out: u64
): (u64, u64) {
    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let (fee, _, _, _) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);
    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);

    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = !token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), oracle_gateway::bundle_sell_price(price_bundle), pool::k_b(pool))
    } else {
        (oracle_gateway::bundle_buy_price(price_bundle), (Q32 as u64), pool::k_q(pool))
    };

    v3_amount_in(
        amount_out,
        reserve_b,
        reserve_a,
        price_in,
        price_out,
        oracle_gateway::bundle_adj_price(price_bundle),
        kappa,
        pool::gamma(pool),
        fee,
        decimals_b,
        decimals_a,
        is_sell
    )
}

public fun quote_b_for_exact_a_without_cutoff<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_out: u64
): u64 {
    let price_bundle =
        oracle_gateway::get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    quote_b_for_exact_a_without_cutoff_with_bundle(&price_bundle, clock, pool, amount_out)
}

public fun quote_b_for_exact_a_without_cutoff_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &Pool<A, B>,
    amount_out: u64
): u64 {
    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let (fee, _, _, _) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);
    oracle_gateway::assert_bundle_valid_for_pool(price_bundle, pool, clock);

    let token_a_is_quote = pool::quote_token_index(pool) == 0;
    let is_sell = !token_a_is_quote;
    let (price_in, price_out, kappa) = if (is_sell) {
        ((Q32 as u64), oracle_gateway::bundle_sell_price(price_bundle), pool::k_b(pool))
    } else {
        (oracle_gateway::bundle_buy_price(price_bundle), (Q32 as u64), pool::k_q(pool))
    };

    v3_amount_in_without_cutoff(
        amount_out,
        reserve_a,
        price_in,
        price_out,
        kappa,
        fee,
        decimals_b,
        decimals_a
    )
}

public(package) fun assert_exact_output_available(effective_out: u64, requested_out: u64) {
    assert!(effective_out == requested_out, ECutoffLimitReached);
}

/// Compute skewness-adjusted prices based on pool imbalance
/// s = lambda * |x * px - y * py| / (x * px + y * py)
/// If x*px >= y*py: px' = px*(1-s), py' = py*(1+s)
/// If x*px < y*py: px' = px*(1+s), py' = py*(1-s)
fun compute_skewness_price(
    reserve_a: u64,
    reserve_b: u64,
    decimals_a: u8,
    decimals_b: u8,
    price_a: u64,
    price_b: u64,
    lambda: u64
): (u64, u64) {
    // Parse reserves to standard decimals
    let parsed_a = math::parse_amount_to_standard_decimals(decimals_a, reserve_a, STANDARD_DECIMALS);
    let parsed_b = math::parse_amount_to_standard_decimals(decimals_b, reserve_b, STANDARD_DECIMALS);

    // Calculate reserve * price values
    let reserve_a_value = (parsed_a as u128) * (price_a as u128);
    let reserve_b_value = (parsed_b as u128) * (price_b as u128);

    // Calculate skewness: s = lambda * |diff| / sum
    let value_diff = math::abs_diff_u128(reserve_a_value, reserve_b_value);
    let value_sum = reserve_a_value + reserve_b_value;

    let s = math::mul_div_u128((lambda as u128), value_diff, value_sum);

    let q32_plus_s = Q32 + s;
    let q32_minus_s = Q32 - s;

    // Adjust prices based on which reserve has more value
    if (reserve_a_value >= reserve_b_value) {
        // A is overweight: decrease price_a, increase price_b
        let adjusted_price_a = math::mul_div_u128_to_u64((price_a as u128), q32_minus_s, Q32);
        let adjusted_price_b = math::mul_div_u128_to_u64((price_b as u128), q32_plus_s, Q32);
        (adjusted_price_a, adjusted_price_b)
    } else {
        // B is overweight: increase price_a, decrease price_b
        let adjusted_price_a = math::mul_div_u128_to_u64((price_a as u128), q32_plus_s, Q32);
        let adjusted_price_b = math::mul_div_u128_to_u64((price_b as u128), q32_minus_s, Q32);
        (adjusted_price_a, adjusted_price_b)
    }
}

fun v3_amount_out_with_analytics(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
    price_in: u64,
    price_out: u64,
    adj_price: u64,
    kappa: u64,
    gamma: u32,
    fee: u32,
    input_decimals: u8,
    output_decimals: u8,
    is_sell: bool
): (u64, u64, u64) {
    let raw = v3_amount_out_without_cutoff(
        amount_in,
        reserve_out,
        price_in,
        price_out,
        kappa,
        fee,
        input_decimals,
        output_decimals
    );
    let cutoff = v3_amount_out_cutoff(
        amount_in,
        reserve_in,
        reserve_out,
        adj_price,
        gamma,
        fee,
        input_decimals,
        output_decimals,
        is_sell
    );

    let cutoff_output = if (raw < cutoff) { raw } else { cutoff };
    (cutoff_output, raw, cutoff_output)
}

fun assert_pool_balance_can_accept_input(current_balance: u64, input_amount: u64) {
    assert!(
        (current_balance as u128) + (input_amount as u128) <= (MAX_POOL_BALANCE as u128),
        EPoolBalanceTooLarge
    );
}

fun v3_amount_out_without_cutoff(
    amount_in: u64,
    reserve_out: u64,
    price_in: u64,
    price_out: u64,
    kappa: u64,
    fee: u32,
    input_decimals: u8,
    output_decimals: u8
): u64 {
    let parsed_amount_in = math::parse_amount_to_standard_decimals(input_decimals, amount_in, STANDARD_DECIMALS);
    let parsed_reserve_out = math::parse_amount_to_standard_decimals(output_decimals, reserve_out, STANDARD_DECIMALS);
    let pseudo_in = math::pseudo_in_from_actual_u128(
        (parsed_amount_in as u128),
        fee,
        (PRECISION as u128)
    );
    assert!(pseudo_in > 0 && parsed_reserve_out > 0, EZeroOutput);

    let q = Q32 as u256;
    let two_q = q * 2;
    let kappa_u = kappa as u256;
    let price_in_u = price_in as u256;
    let price_out_u = price_out as u256;
    let pseudo_u = pseudo_in as u256;
    let reserve_out_u = parsed_reserve_out as u256;

    let output_standard = if (kappa == ((Q32 as u64) * 2)) {
        let numerator = reserve_out_u * pseudo_u * price_in_u;
        let denominator = price_out_u * reserve_out_u + pseudo_u * price_in_u;
        assert!(denominator != 0, EZeroDenominator);
        numerator / denominator
    } else {
        assert!(kappa_u < two_q, EZeroDenominator);
        let left_numerator = price_out_u * reserve_out_u + price_in_u * pseudo_u;
        let amount_price = math::mul_div_down_u256(pseudo_u, price_in_u, q);
        let reserve_price = math::mul_div_down_u256(reserve_out_u, price_out_u, q);
        let diff = if (amount_price > reserve_price) {
            amount_price - reserve_price
        } else {
            reserve_price - amount_price
        };
        let left_sqrt = diff * diff;
        let price_product = math::mul_div_down_u256(price_in_u, price_out_u, q);
        let price_kappa = math::mul_div_down_u256(price_product, kappa_u, q);
        let reserve_amount = math::mul_div_down_u256(reserve_out_u * pseudo_u, 2, q);
        let radicand = left_sqrt + price_kappa * reserve_amount;
        let sqrt_term = q * math::sqrt_up_u256(radicand);
        let denominator = math::mul_div_down_u256(price_out_u, two_q - kappa_u, q);

        assert!(left_numerator >= sqrt_term, EMathUnderflow);
        assert!(denominator != 0, EZeroDenominator);
        (left_numerator - sqrt_term) / denominator
    };

    let output_raw = math::parse_amount_from_standard_decimals(
        output_decimals,
        math::u256_to_u64_checked(output_standard),
        STANDARD_DECIMALS
    );
    assert!(output_raw > 0, EZeroOutput);
    output_raw
}

fun v3_amount_out_cutoff(
    amount_in: u64,
    reserve_in: u64,
    reserve_out: u64,
    adj_price: u64,
    gamma: u32,
    fee: u32,
    input_decimals: u8,
    output_decimals: u8,
    is_sell: bool
): u64 {
    if (gamma >= (PRECISION as u32)) return MAX_U64_VALUE;

    let parsed_amount_in = math::parse_amount_to_standard_decimals(input_decimals, amount_in, STANDARD_DECIMALS);
    let parsed_reserve_in = math::parse_amount_to_standard_decimals(input_decimals, reserve_in, STANDARD_DECIMALS);
    let parsed_reserve_out = math::parse_amount_to_standard_decimals(output_decimals, reserve_out, STANDARD_DECIMALS);
    let pseudo_in = math::pseudo_in_from_actual_u128(
        (parsed_amount_in as u128),
        fee,
        (PRECISION as u128)
    );
    let reserve_plus_input = (parsed_reserve_in as u256) + (pseudo_in as u256);
    let g_num = (PRECISION as u256) - (gamma as u256);
    let g_den = (PRECISION as u256) + (gamma as u256);

    let sub_term = if (is_sell) {
        if (adj_price == 0) {
            parsed_reserve_out as u256
        } else {
            math::mul_div_up_u256(
                g_num * reserve_plus_input,
                (Q32 as u256),
                g_den * (adj_price as u256)
            )
        }
    } else {
        math::mul_div_up_u256(
            g_num * reserve_plus_input,
            (adj_price as u256),
            g_den * (Q32 as u256)
        )
    };

    let reserve_out_u = parsed_reserve_out as u256;
    let cutoff_standard = if (reserve_out_u > sub_term) {
        reserve_out_u - sub_term
    } else {
        0
    };

    math::parse_amount_from_standard_decimals(
        output_decimals,
        math::u256_to_u64_checked(cutoff_standard),
        STANDARD_DECIMALS
    )
}

fun v3_amount_in(
    amount_out: u64,
    reserve_in: u64,
    reserve_out: u64,
    price_in: u64,
    price_out: u64,
    adj_price: u64,
    kappa: u64,
    gamma: u32,
    fee: u32,
    input_decimals: u8,
    output_decimals: u8,
    is_sell: bool
): (u64, u64) {
    let mut effective_out = amount_out;
    let mut amount_in = 0;
    let mut iter = 0u64;
    while (iter < 2) {
        amount_in = v3_amount_in_without_cutoff(
            effective_out,
            reserve_out,
            price_in,
            price_out,
            kappa,
            fee,
            input_decimals,
            output_decimals
        );
        let cutoff = v3_amount_out_cutoff(
            amount_in,
            reserve_in,
            reserve_out,
            adj_price,
            gamma,
            fee,
            input_decimals,
            output_decimals,
            is_sell
        );
        if (effective_out <= cutoff) {
            return (amount_in, effective_out)
        };

        effective_out = cutoff;
        if (effective_out == 0) {
            return (0, 0)
        };
        iter = iter + 1;
    };

    (amount_in, effective_out)
}

fun v3_amount_in_without_cutoff(
    amount_out: u64,
    reserve_out: u64,
    price_in: u64,
    price_out: u64,
    kappa: u64,
    fee: u32,
    input_decimals: u8,
    output_decimals: u8
): u64 {
    assert!(amount_out > 0, EInsufficientOutputAmount);

    let parsed_amount_out = math::parse_amount_to_standard_decimals(output_decimals, amount_out, STANDARD_DECIMALS);
    let parsed_reserve_out = math::parse_amount_to_standard_decimals(output_decimals, reserve_out, STANDARD_DECIMALS);
    assert!(parsed_amount_out > 0, EInsufficientOutputAmount);
    assert!(parsed_amount_out < parsed_reserve_out, EInsufficientLiquidity);

    let q = Q32 as u256;
    let price_impact = math::mul_div_up_u256(
        (kappa as u256) * q,
        (parsed_amount_out as u256),
        q * ((parsed_reserve_out - parsed_amount_out) as u256)
    );
    let price_ratio = math::mul_div_up_u256(
        (price_out as u256),
        price_impact + q * 2,
        (price_in as u256)
    );
    let pseudo_in = math::mul_div_up_u256(
        (parsed_amount_out as u256),
        price_ratio,
        q * 2
    );
    let amount_in_standard = math::mul_div_up_u256(
        pseudo_in,
        (PRECISION as u256) + (fee as u256),
        (PRECISION as u256)
    );

    math::parse_amount_from_standard_decimals_up(
        input_decimals,
        math::u256_to_u64_checked(amount_in_standard),
        STANDARD_DECIMALS
    )
}

fun check_inventory_v3(
    pre_a: u64,
    pre_b: u64,
    post_a: u64,
    post_b: u64,
    decimals_a: u8,
    decimals_b: u8,
    base_price: u64,
    amount_out: u64,
    is_sell: bool,
    kappa: u64,
    token_a_is_quote: bool
) {
    let pre_quote = if (token_a_is_quote) {
        math::parse_amount_to_standard_decimals(decimals_a, pre_a, STANDARD_DECIMALS)
    } else {
        math::parse_amount_to_standard_decimals(decimals_b, pre_b, STANDARD_DECIMALS)
    };
    let pre_base = if (token_a_is_quote) {
        math::parse_amount_to_standard_decimals(decimals_b, pre_b, STANDARD_DECIMALS)
    } else {
        math::parse_amount_to_standard_decimals(decimals_a, pre_a, STANDARD_DECIMALS)
    };
    let post_quote = if (token_a_is_quote) {
        math::parse_amount_to_standard_decimals(decimals_a, post_a, STANDARD_DECIMALS)
    } else {
        math::parse_amount_to_standard_decimals(decimals_b, post_b, STANDARD_DECIMALS)
    };
    let post_base = if (token_a_is_quote) {
        math::parse_amount_to_standard_decimals(decimals_b, post_b, STANDARD_DECIMALS)
    } else {
        math::parse_amount_to_standard_decimals(decimals_a, post_a, STANDARD_DECIMALS)
    };

    let out_decimals = if (is_sell) {
        if (token_a_is_quote) { decimals_b } else { decimals_a }
    } else {
        if (token_a_is_quote) { decimals_a } else { decimals_b }
    };
    let out_standard = math::parse_amount_to_standard_decimals(out_decimals, amount_out, STANDARD_DECIMALS);

    let pre_value = base_quote_value_u256(pre_base, pre_quote, base_price);
    let post_value = base_quote_value_u256(post_base, post_quote, base_price);
    let penalty = inventory_penalty_u256(post_base, post_quote, out_standard, base_price, is_sell, kappa);

    assert!(post_value >= pre_value + penalty, EInvalidInventory);
}

fun base_quote_value_u256(base_amount: u64, quote_amount: u64, adj_price: u64): u256 {
    let base_value = math::mul_div_down_u256((base_amount as u256), (adj_price as u256), (Q32 as u256));
    base_value + (quote_amount as u256)
}

fun base_quote_value(base_amount: u64, quote_amount: u64, adj_price: u64): u128 {
    let base_value = math::mul_div_down_u128((base_amount as u128), (adj_price as u128), Q32);
    base_value + (quote_amount as u128)
}

fun inventory_penalty_u256(
    post_base: u64,
    post_quote: u64,
    amount_out: u64,
    adj_price: u64,
    is_sell: bool,
    kappa: u64
): u256 {
    if (amount_out == 0 || kappa == 0) return 0u256;

    if (is_sell) {
        assert!(post_base > 0, EInvalidInventory);
        let amount_out_u = amount_out as u256;
        let base_penalty = math::mul_div_up_u256(
            amount_out_u * amount_out_u,
            (kappa as u256),
            ((post_base as u256) * 2u256) * (Q32 as u256)
        );
        math::mul_div_up_u256(base_penalty, (adj_price as u256), (Q32 as u256))
    } else {
        assert!(post_quote > 0, EInvalidInventory);
        let amount_out_u = amount_out as u256;
        math::mul_div_up_u256(
            amount_out_u * amount_out_u,
            (kappa as u256),
            ((post_quote as u256) * 2u256) * (Q32 as u256)
        )
    }
}

/// Collect protocol fee as LP tokens accrued inside the pool.
fun collect_protocol_fee_on_swap<A, B>(
    pool: &mut Pool<A, B>,
    token_a_is_quote: bool,
    input_is_a: bool,
    amount_in_no_fee: u64,
    fee: u32,
    fee_split: u32,
    base_price: u64
): u64 {
    let mut protocol_lp_minted = 0;
    let fee_amount = (math::fee_from_pseudo_input_u128(
        (amount_in_no_fee as u128),
        fee,
        (PRECISION as u128)
    ) as u64);

    if (fee_amount > 0 && fee_split > 0) {
        let reserve_a = pool::balance_a(pool);
        let reserve_b = pool::balance_b(pool);
        let decimals_a = pool::token_a_decimals(pool);
        let decimals_b = pool::token_b_decimals(pool);

        let token_in_decimals = if (input_is_a) { decimals_a } else { decimals_b };
        let fee_standard = math::parse_amount_to_standard_decimals(token_in_decimals, fee_amount, STANDARD_DECIMALS);
        let input_is_quote = (input_is_a && token_a_is_quote) || (!input_is_a && !token_a_is_quote);
        let fee_value = if (input_is_quote) {
            fee_standard as u256
        } else {
            math::mul_div_down_u256((fee_standard as u256), (base_price as u256), (Q32 as u256))
        };
        let protocol_fee_value = math::mul_div_down_u256(
            fee_value,
            (fee_split as u256),
            (PRECISION as u256)
        );

        if (protocol_fee_value > 0) {
            let quote_amount = if (token_a_is_quote) {
                math::parse_amount_to_standard_decimals(decimals_a, reserve_a, STANDARD_DECIMALS)
            } else {
                math::parse_amount_to_standard_decimals(decimals_b, reserve_b, STANDARD_DECIMALS)
            };
            let base_amount = if (token_a_is_quote) {
                math::parse_amount_to_standard_decimals(decimals_b, reserve_b, STANDARD_DECIMALS)
            } else {
                math::parse_amount_to_standard_decimals(decimals_a, reserve_a, STANDARD_DECIMALS)
            };
            let inventory_value = base_quote_value(base_amount, quote_amount, base_price);
            let inventory_value_u = inventory_value as u256;

            let total_supply = pool::lp_supply(pool);
            if (total_supply > 0 && inventory_value_u > protocol_fee_value) {
                let lp_for_protocol = math::u256_to_u64_checked(
                    math::mul_div_down_u256(
                        (total_supply as u256),
                        protocol_fee_value,
                        inventory_value_u - protocol_fee_value
                    )
                );

                if (lp_for_protocol > 0) {
                    let protocol_lp = pool::mint_lp(pool, lp_for_protocol);
                    pool::deposit_protocol_lp(pool, protocol_lp);
                    let fee_to_opt = pool::fee_to(pool);
                    let fee_to = *option::borrow(&fee_to_opt);
                    events::emit_protocol_lp_accrued(pool::id(pool), fee_to, lp_for_protocol, inventory_value);
                    protocol_lp_minted = lp_for_protocol;
                };
            };
        };
    };
    protocol_lp_minted
}
public fun create_pool_with_coins<A, B>(
    factory: &mut Factory,
    pool_creator_cap: &PoolCreatorCap,
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    init_a: Coin<A>,
    init_b: Coin<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    ctx: &mut TxContext
): Coin<LP<A, B>> {
    let lp_balance = create_pool(factory, pool_creator_cap, oracle, price_info_object_a, price_info_object_b, clock, coin::into_balance(init_a), coin::into_balance(init_b), token_a_decimals, token_b_decimals, ctx);
    coin::from_balance(lp_balance, ctx)
}

#[allow(lint(self_transfer))]
public fun create_pool_with_coins_and_transfer_lp_to_sender<A, B>(
    factory: &mut Factory,
    pool_creator_cap: &PoolCreatorCap,
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    init_a: Coin<A>,
    init_b: Coin<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    ctx: &mut TxContext
) {
    let lp_coin = create_pool_with_coins(factory, pool_creator_cap, oracle, price_info_object_a, price_info_object_b, clock, init_a, init_b, token_a_decimals, token_b_decimals, ctx);
    transfer::public_transfer(lp_coin, sender(ctx));
}

public fun add_liquidity_with_coins<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_a: Coin<A>,
    input_b: Coin<B>,
    min_lp_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<LP<A, B>>) {
    let (remaining_a, remaining_b, lp) = add_liquidity(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        coin::into_balance(input_a),
        coin::into_balance(input_b),
        min_lp_out
    );

    (
        coin::from_balance(remaining_a, ctx),
        coin::from_balance(remaining_b, ctx),
        coin::from_balance(lp, ctx)
    )
}

#[allow(lint(self_transfer))]
public fun add_liquidity_with_coins_and_transfer_to_sender<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_a: Coin<A>,
    input_b: Coin<B>,
    min_lp_out: u64,
    ctx: &mut TxContext
) {
    let sender_addr = sender(ctx);
    add_liquidity_with_coins_and_transfer(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        input_a,
        input_b,
        min_lp_out,
        sender_addr,
        ctx
    );
}

#[allow(lint(self_transfer))]
public fun add_liquidity_with_coins_and_transfer<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_a: Coin<A>,
    input_b: Coin<B>,
    min_lp_out: u64,
    recipient: address,
    ctx: &mut TxContext
) {
    let (remaining_a, remaining_b, lp) = add_liquidity(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        coin::into_balance(input_a),
        coin::into_balance(input_b),
        min_lp_out
    );
    library::destroy_zero_or_transfer(remaining_a, recipient, ctx);
    library::destroy_zero_or_transfer(remaining_b, recipient, ctx);
    library::destroy_zero_or_transfer(lp, recipient, ctx);
}

public fun remove_liquidity_with_coins<A, B>(
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_a_out: u64,
    min_b_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>) {
    let (a_out, b_out) = remove_liquidity(
        pool,
        coin::into_balance(lp_in),
        min_a_out,
        min_b_out
    );

    (coin::from_balance(a_out, ctx), coin::from_balance(b_out, ctx))
}

#[allow(lint(self_transfer))]
public fun remove_liquidity_with_coins_and_transfer_to_sender<A, B>(
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_a_out: u64,
    min_b_out: u64,
    ctx: &mut TxContext
) {
    let sender_addr = sender(ctx);
    remove_liquidity_with_coins_and_transfer(pool, lp_in, min_a_out, min_b_out, sender_addr, ctx);
}

#[allow(lint(self_transfer))]
public fun remove_liquidity_with_coins_and_transfer<A, B>(
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_a_out: u64,
    min_b_out: u64,
    recipient: address,
    ctx: &mut TxContext
) {
    let (a_out, b_out) = remove_liquidity(
        pool,
        coin::into_balance(lp_in),
        min_a_out,
        min_b_out
    );
    library::destroy_zero_or_transfer(a_out, recipient, ctx);
    library::destroy_zero_or_transfer(b_out, recipient, ctx);
}

public fun swap_a_for_b_with_coin<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<B> {
    let b_out = swap_a_for_b(oracle, price_info_object_a, price_info_object_b, clock, pool, coin::into_balance(input), min_out);
    coin::from_balance(b_out, ctx)
}

#[allow(lint(self_transfer))]
public fun swap_a_for_b_with_coin_and_transfer_to_sender<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    min_out: u64,
    ctx: &mut TxContext
) {
    let sender_addr = sender(ctx);
    swap_a_for_b_with_coin_and_transfer(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        input,
        min_out,
        sender_addr,
        ctx
    );
}

#[allow(lint(self_transfer))]
public fun swap_a_for_b_with_coin_and_transfer<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    min_out: u64,
    recipient: address,
    ctx: &mut TxContext
) {
    let b_coin = swap_a_for_b_with_coin(oracle, price_info_object_a, price_info_object_b, clock, pool, input, min_out, ctx);
    transfer::public_transfer(b_coin, recipient);
}

public fun swap_a_for_exact_b_with_coin<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>) {
    let (remaining_a, b_out) = swap_a_for_exact_b(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        coin::into_balance(input),
        amount_out
    );

    (coin::from_balance(remaining_a, ctx), coin::from_balance(b_out, ctx))
}

public fun swap_b_for_a_with_coin<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<A> {
    let a_out = swap_b_for_a(oracle, price_info_object_a, price_info_object_b, clock, pool, coin::into_balance(input), min_out);
    coin::from_balance(a_out, ctx)
}

#[allow(lint(self_transfer))]
public fun swap_b_for_a_with_coin_and_transfer_to_sender<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    min_out: u64,
    ctx: &mut TxContext
) {
    let sender_addr = sender(ctx);
    swap_b_for_a_with_coin_and_transfer(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        input,
        min_out,
        sender_addr,
        ctx
    );
}

#[allow(lint(self_transfer))]
public fun swap_b_for_a_with_coin_and_transfer<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    min_out: u64,
    recipient: address,
    ctx: &mut TxContext
) {
    let a_coin = swap_b_for_a_with_coin(oracle, price_info_object_a, price_info_object_b, clock, pool, input, min_out, ctx);
    transfer::public_transfer(a_coin, recipient);
}

public fun swap_b_for_exact_a_with_coin<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<B>, Coin<A>) {
    let (remaining_b, a_out) = swap_b_for_exact_a(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        coin::into_balance(input),
        amount_out
    );

    (coin::from_balance(remaining_b, ctx), coin::from_balance(a_out, ctx))
}

#[test_only]
public fun test_init(ctx: &mut TxContext) {
    init(ctx)
}

#[test_only]
public struct BAR has drop {}
#[test_only]
public struct FOO has drop {}
#[test_only]
public struct FOOD has drop {}
#[test_only]
public struct FOOd has drop {}

#[test]
fun test_cmp_type_names() {
    assert!(library::sort_names(&type_name::with_defining_ids<BAR>(), &type_name::with_defining_ids<FOO>()) == library::sort_less(), 0);
    assert!(library::sort_names(&type_name::with_defining_ids<FOO>(), &type_name::with_defining_ids<FOO>()) == library::sort_equal(), 0);
    assert!(library::sort_names(&type_name::with_defining_ids<FOO>(), &type_name::with_defining_ids<BAR>()) == library::sort_greater(), 0);

    assert!(library::sort_names(&type_name::with_defining_ids<FOO>(), &type_name::with_defining_ids<FOOd>()) == library::sort_less(), 0);
    assert!(library::sort_names(&type_name::with_defining_ids<FOOd>(), &type_name::with_defining_ids<FOO>()) == library::sort_greater(), 0);

    assert!(library::sort_names(&type_name::with_defining_ids<FOOD>(), &type_name::with_defining_ids<FOOd>()) == library::sort_less(), 0);
    assert!(library::sort_names(&type_name::with_defining_ids<FOOd>(), &type_name::with_defining_ids<FOOD>()) == library::sort_greater(), 0);
}

#[test]
fun test_factory() {
    let ctx = &mut tx_context::dummy();
    let mut factory_obj = factory::test_new(ctx);

    factory::register_pool<BAR, FOO>(&mut factory_obj);
    factory::register_pool<FOO, FOOd>(&mut factory_obj);

    factory::test_remove_pool<BAR, FOO>(&mut factory_obj);
    factory::test_remove_pool<FOO, FOOd>(&mut factory_obj);
    factory::test_destroy_empty(factory_obj);
}

#[test]
#[expected_failure(abort_code = factory::EInvalidPair)]
fun test_add_pool_aborts_on_wrong_order() {
    let ctx = &mut tx_context::dummy();
    let mut factory_obj = factory::test_new(ctx);

    factory::register_pool<FOO, BAR>(&mut factory_obj);

    factory::test_remove_pool<FOO, BAR>(&mut factory_obj);
    factory::test_destroy_empty(factory_obj);
}

#[test]
#[expected_failure(abort_code = factory::EInvalidPair)]
fun test_add_pool_aborts_on_same_type() {
    let ctx = &mut tx_context::dummy();
    let mut factory_obj = factory::test_new(ctx);

    factory::register_pool<FOO, FOO>(&mut factory_obj);

    factory::test_remove_pool<FOO, FOO>(&mut factory_obj);
    factory::test_destroy_empty(factory_obj);
}

#[test]
#[expected_failure(abort_code = factory::EPoolAlreadyExists)]
fun test_add_pool_aborts_on_already_exists() {
    let ctx = &mut tx_context::dummy();
    let mut factory_obj = factory::test_new(ctx);

    factory::register_pool<BAR, FOO>(&mut factory_obj);
    factory::register_pool<BAR, FOO>(&mut factory_obj);

    factory::test_remove_pool<BAR, FOO>(&mut factory_obj);
    factory::test_destroy_empty(factory_obj);
}
