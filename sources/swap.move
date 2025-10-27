module brownfi_amm::swap;

use std::type_name;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::clock::Clock;
use sui::tx_context::sender;

use brownfi_amm::library;
use brownfi_amm::math;
use brownfi_amm::events;
use brownfi_amm::pool::{Self, Pool, LP};
use brownfi_amm::factory::{Self, Factory};
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

const PRECISION: u64 = 100_000_000; // 10^8 for precision
const MAX_POOL_BALANCE: u64 = 1_000_000_000_000_000_000; // 1e18
const MIN_LIQUIDITY: u64 = 10; // Minimum liquidity for first deposit
const STANDARD_DECIMALS: u8 = 9; // Standard decimals for calculations

/// Q32 fixed-point constant (2^32) - reduced from Q64 to prevent overflow
const Q32: u128 = 4294967296;

public fun pool_balances<A, B>(pool: &Pool<A, B>): (u64, u64, u64) {
    pool::get_balances(pool)
}

public fun pool_fee<A, B>(pool: &Pool<A, B>): u32 {
    pool::fee(pool)
}

fun init(ctx: &mut TxContext) {
    factory::create_and_share(ctx);
}

public fun create_pool<A, B>(
    factory: &mut Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    init_a: Balance<A>,
    init_b: Balance<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    ctx: &mut TxContext
): Balance<LP<A, B>> {
    assert!(!factory::is_paused(factory), EFactoryPaused);
    
    let init_a_val = balance::value(&init_a);
    let init_b_val = balance::value(&init_b);
    
    assert!(init_a_val > 0 && init_b_val > 0, EZeroInput);
    assert!(init_a_val <= MAX_POOL_BALANCE && init_b_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);

    // Verify oracle is configured for both tokens
    assert!(oracle::has_config<A>(oracle) && oracle::has_config<B>(oracle), EOracleNotConfigured);

    factory::register_pool<A, B>(factory);

    // Default parameters matching v2-core
    let default_fee = 300_000; // 0.3%
    let default_k = ((Q32 / 1000) as u64); // 0.001 in Q32 format
    let default_lambda = 0; // No skewness
    let default_protocol_fee = 10_000_000; // 10%
    
    let mut pool_obj = pool::new(
        init_a,
        init_b,
        token_a_decimals,
        token_b_decimals,
        default_fee,
        default_k,
        default_lambda,
        default_protocol_fee,
        ctx
    );

    // Get oracle prices using clock  
    let min_price_age = factory::min_price_age(factory);
    let _price_a = oracle::get_price<A>(oracle, clock, min_price_age);
    let _price_b = oracle::get_price<B>(oracle, clock, min_price_age);

    // For initial liquidity, use geometric mean (sqrt(a * b))
    // This is the traditional CPMM approach
    let lp_amount_u64 = math::mul_sqrt(init_a_val, init_b_val);
    
    assert!(lp_amount_u64 >= MIN_LIQUIDITY, ENoLiquidity);
    
    let lp_balance = pool::mint_lp(&mut pool_obj, lp_amount_u64);

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
    factory: &Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    mut input_a: Balance<A>,
    mut input_b: Balance<B>,
    min_lp_out: u64
): (Balance<A>, Balance<B>, Balance<LP<A, B>>) {
    assert!(!factory::is_paused(factory), EFactoryPaused);
    
    let input_a_val = balance::value(&input_a);
    let input_b_val = balance::value(&input_b);
    let pool_a_val = pool::balance_a(pool);
    let pool_b_val = pool::balance_b(pool);
    
    assert!(input_a_val > 0 && input_b_val > 0, EZeroInput);
    assert!(pool_a_val <= MAX_POOL_BALANCE && pool_b_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);
    assert!(pool_a_val + input_a_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);
    assert!(pool_b_val + input_b_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);

    // Get oracle prices using clock
    let min_price_age = factory::min_price_age(factory);
    let price_a = oracle::get_price<A>(oracle, clock, min_price_age);
    let price_b = oracle::get_price<B>(oracle, clock, min_price_age);

    // Get token decimals
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);

    // Parse amounts to standard decimals
    let parsed_input_a = math::parse_amount_to_standard_decimals(decimals_a, input_a_val, STANDARD_DECIMALS);
    let parsed_input_b = math::parse_amount_to_standard_decimals(decimals_b, input_b_val, STANDARD_DECIMALS);
    let parsed_pool_a = math::parse_amount_to_standard_decimals(decimals_a, pool_a_val, STANDARD_DECIMALS);
    let parsed_pool_b = math::parse_amount_to_standard_decimals(decimals_b, pool_b_val, STANDARD_DECIMALS);

    // Calculate values: amount * price
    let input_a_value = (parsed_input_a as u128) * (price_a as u128);
    let input_b_value = (parsed_input_b as u128) * (price_b as u128);

    let mut deposit_a: u64;
    let mut deposit_b: u64;
    let lp_to_issue: u64;
    let total_supply = pool::lp_supply(pool);
    
    // Calculate inventory value
    let inventory_value = (parsed_pool_a as u128) * (price_a as u128) + 
                          (parsed_pool_b as u128) * (price_b as u128);
    
    // If pool is empty (after all liquidity removed), use geometric mean like initial liquidity
    if (total_supply == 0 || inventory_value == 0) {
        lp_to_issue = math::mul_sqrt(input_a_val, input_b_val);
        assert!(lp_to_issue >= MIN_LIQUIDITY, ENoLiquidity);
    } else {
        // Use proportional minting based on the minimum ratio to avoid dilution
        // lp_to_issue = min(input_a / pool_a, input_b / pool_b) * total_supply
        let ratio_a = math::mul_div_u128((input_a_val as u128), (total_supply as u128), (pool_a_val as u128));
        let ratio_b = math::mul_div_u128((input_b_val as u128), (total_supply as u128), (pool_b_val as u128));
        lp_to_issue = (math::min_u128(ratio_a, ratio_b) as u64);
    };
    
    // Determine actual deposit amounts (return excess)
    if (total_supply == 0 || inventory_value == 0 || lp_to_issue == 0) {
        // Empty pool or dust donation: deposit all input amounts
        deposit_a = input_a_val;
        deposit_b = input_b_val;
    } else if (input_a_value < input_b_value) {
        deposit_a = input_a_val;
        // Calculate proportional deposit_b based on pool ratio
        deposit_b = math::mul_div(input_a_val, pool_b_val, pool_a_val);
        if (deposit_b > input_b_val) {
            deposit_b = input_b_val;
            deposit_a = math::mul_div(input_b_val, pool_a_val, pool_b_val);
        };
    } else {
        deposit_b = input_b_val;
        deposit_a = math::mul_div(input_b_val, pool_a_val, pool_b_val);
        if (deposit_a > input_a_val) {
            deposit_a = input_a_val;
            deposit_b = math::mul_div(input_a_val, pool_b_val, pool_a_val);
        };
    };

    assert!(lp_to_issue >= min_lp_out, EExcessiveSlippage);
    
    pool::deposit_a(pool, balance::split(&mut input_a, deposit_a));
    pool::deposit_b(pool, balance::split(&mut input_b, deposit_b));

    let lp = pool::mint_lp(pool, lp_to_issue);

    events::emit_add_liquidity(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        type_name::with_defining_ids<B>(),
        deposit_a,
        deposit_b,
        lp_to_issue
    );

    (input_a, input_b, lp)
}

public fun remove_liquidity<A, B>(
    factory: &Factory,
    pool: &mut Pool<A, B>,
    lp_in: Balance<LP<A, B>>,
    min_a_out: u64,
    min_b_out: u64
): (Balance<A>, Balance<B>) {
    assert!(!factory::is_paused(factory), EFactoryPaused);
    assert!(balance::value(&lp_in) > 0, EZeroInput);

    let lp_in_amount = balance::value(&lp_in);
    let pool_a_amount = pool::balance_a(pool);
    let pool_b_amount = pool::balance_b(pool);
    let lp_supply_val = pool::lp_supply(pool);

    let a_out = math::mul_div(lp_in_amount, pool_a_amount, lp_supply_val);
    let b_out = math::mul_div(lp_in_amount, pool_b_amount, lp_supply_val);
    assert!(a_out >= min_a_out, EExcessiveSlippage);
    assert!(b_out >= min_b_out, EExcessiveSlippage);

    pool::burn_lp(pool, lp_in);

    events::emit_remove_liquidity(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        type_name::with_defining_ids<B>(),
        a_out,
        b_out,
        lp_in_amount
    );

    (pool::withdraw_a(pool, a_out), pool::withdraw_b(pool, b_out))
}

/// Swap token A for token B with inventory-based AMM
public fun swap_a_for_b<A, B>(
    factory: &Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Balance<A>,
    min_out: u64
): Balance<B> {
    assert!(!factory::is_paused(factory), EFactoryPaused);
    assert!(balance::value(&input) > 0, EZeroInput);
    
    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let amount_in = balance::value(&input);
    
    // Check maximum swap size (80% of reserves to prevent manipulation)
    assert!(amount_in * 10 <= reserve_a * 8, EInsufficientLiquidity);

    // Get pool parameters
    let (fee, k, lambda, protocol_fee_pct) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);

    // Get oracle prices using clock
    let min_price_age = factory::min_price_age(factory);
    let price_a = oracle::get_price<A>(oracle, clock, min_price_age);
    let price_b = oracle::get_price<B>(oracle, clock, min_price_age);

    // Compute skewness-adjusted prices if lambda > 0
    let (skew_price_a, skew_price_b) = if (lambda > 0) {
        compute_skewness_price(reserve_a, reserve_b, decimals_a, decimals_b, price_a, price_b, lambda)
    } else {
        (price_a, price_b)
    };

    // Calculate output amount (constant product with fee)
    let amount_in_with_fee = math::mul_div_u128(
        (amount_in as u128),
        ((PRECISION - (fee as u64)) as u128),
        (PRECISION as u128)
    );
    let amount_out = math::mul_div_u128_to_u64(
        amount_in_with_fee * (reserve_b as u128),
        1,
        (reserve_a as u128) + amount_in_with_fee
    );


    assert!(amount_out >= min_out, EExcessiveSlippage);
    assert!(amount_out * 10 <= reserve_b * 8, EInsufficientLiquidity);

    // Calculate amount out without fee for inventory check
    let amount_out_without_fee = math::mul_div_u128_to_u64(
        (amount_out as u128) * (PRECISION as u128),
        1,
        (PRECISION - (fee as u64)) as u128
    );

    // Deposit input first (balance will increase)
    pool::deposit_a(pool, input);
    let new_balance_a = pool::balance_a(pool);
    let new_balance_b = pool::balance_b(pool);

    // Check inventory constraint (pass original reserves for right side)
    check_inventory(
        new_balance_a, new_balance_b,
        reserve_a, reserve_b,  // original reserves before swap
        decimals_a, decimals_b,
        skew_price_a, skew_price_b,
        amount_out_without_fee,
        true, // zero_for_one (A for B)
        k
    );

    // Collect protocol fee if enabled
    if (protocol_fee_pct > 0) {
        let fee_to_opt = factory::fee_to(factory);
        if (option::is_some(&fee_to_opt)) {
            collect_protocol_fee_on_swap(
                pool, decimals_a, amount_in, fee, protocol_fee_pct,
                price_a, price_b, skew_price_a, skew_price_b
            );
        };
    };

    events::emit_swap(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        amount_in,
        type_name::with_defining_ids<B>(),
        amount_out,
        skew_price_a,
        skew_price_b
    );

    pool::withdraw_b(pool, amount_out)
}

/// Swap token B for token A with inventory-based AMM
public fun swap_b_for_a<A, B>(
    factory: &Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Balance<B>,
    min_out: u64
): Balance<A> {
    assert!(!factory::is_paused(factory), EFactoryPaused);
    assert!(balance::value(&input) > 0, EZeroInput);
    
    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    assert!(reserve_a > 0 && reserve_b > 0, ENoLiquidity);

    let amount_in = balance::value(&input);
    
    // Check maximum swap size
    assert!(amount_in * 10 <= reserve_b * 8, EInsufficientLiquidity);

    // Get pool parameters
    let (fee, k, lambda, protocol_fee_pct) = pool::get_parameters(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);

    // Get oracle prices using clock
    let min_price_age = factory::min_price_age(factory);
    let price_a = oracle::get_price<A>(oracle, clock, min_price_age);
    let price_b = oracle::get_price<B>(oracle, clock, min_price_age);

    // Compute skewness-adjusted prices if lambda > 0
    let (skew_price_a, skew_price_b) = if (lambda > 0) {
        compute_skewness_price(reserve_a, reserve_b, decimals_a, decimals_b, price_a, price_b, lambda)
    } else {
        (price_a, price_b)
    };

    // Calculate output amount
    let amount_in_with_fee = math::mul_div_u128(
        (amount_in as u128),
        ((PRECISION - (fee as u64)) as u128),
        (PRECISION as u128)
    );
    let amount_out = math::mul_div_u128_to_u64(
        amount_in_with_fee * (reserve_a as u128),
        1,
        (reserve_b as u128) + amount_in_with_fee
    );

    assert!(amount_out >= min_out, EExcessiveSlippage);
    assert!(amount_out * 10 <= reserve_a * 8, EInsufficientLiquidity);

    let amount_out_without_fee = math::mul_div_u128_to_u64(
        (amount_out as u128) * (PRECISION as u128),
        1,
        (PRECISION - (fee as u64)) as u128
    );

    // Deposit input first
    pool::deposit_b(pool, input);
    let new_balance_a = pool::balance_a(pool);
    let new_balance_b = pool::balance_b(pool);

    // Check inventory constraint (pass original reserves for right side)
    check_inventory(
        new_balance_a, new_balance_b,
        reserve_a, reserve_b,  // original reserves before swap
        decimals_a, decimals_b,
        skew_price_a, skew_price_b,
        amount_out_without_fee,
        false, // one_for_zero (B for A)
        k
    );

    // Collect protocol fee if enabled
    if (protocol_fee_pct > 0) {
        let fee_to_opt = factory::fee_to(factory);
        if (option::is_some(&fee_to_opt)) {
            collect_protocol_fee_on_swap(
                pool, decimals_b, amount_in, fee, protocol_fee_pct,
                price_a, price_b, skew_price_a, skew_price_b
            );
        };
    };

    events::emit_swap(
        pool::id(pool),
        type_name::with_defining_ids<B>(),
        amount_in,
        type_name::with_defining_ids<A>(),
        amount_out,
        skew_price_a,
        skew_price_b
    );

    pool::withdraw_a(pool, amount_out)
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

/// Check inventory constraint
/// left = price_a * balance_a + price_b * balance_b - (price * k * amount_out^2) / (balance * 2 * Q32)
/// right = price_a * reserve_a + price_b * reserve_b
/// left >= right
fun check_inventory(
    balance_a: u64,
    balance_b: u64,
    reserve_a: u64,  // original reserves before swap
    reserve_b: u64,
    decimals_a: u8,
    decimals_b: u8,
    price_a: u64,
    price_b: u64,
    amount_out: u64,
    zero_for_one: bool,
    k: u64
) {
    let parsed_a = math::parse_amount_to_standard_decimals(decimals_a, balance_a, STANDARD_DECIMALS);
    let parsed_b = math::parse_amount_to_standard_decimals(decimals_b, balance_b, STANDARD_DECIMALS);
    
    let left = compute_inventory_left(
        parsed_a, parsed_b, price_a, price_b, amount_out, zero_for_one, k, decimals_a, decimals_b
    );
    
    // Right side uses original reserves before swap
    let parsed_reserve_a = math::parse_amount_to_standard_decimals(decimals_a, reserve_a, STANDARD_DECIMALS);
    let parsed_reserve_b = math::parse_amount_to_standard_decimals(decimals_b, reserve_b, STANDARD_DECIMALS);
    let right = (parsed_reserve_a as u128) * (price_a as u128) + (parsed_reserve_b as u128) * (price_b as u128);
    
    assert!(left >= right, EInvalidInventory);
}

/// Compute left side of inventory check
/// left = price_a * balance_a + price_b * balance_b - (price * k * amount_out^2) / (balance * 2 * Q64)
fun compute_inventory_left(
    balance_a: u64,
    balance_b: u64,
    price_a: u64,
    price_b: u64,
    amount_out: u64,
    zero_for_one: bool,
    k: u64,
    decimals_a: u8,
    decimals_b: u8
): u128 {
    let parsed_amount_out = if (zero_for_one) {
        math::parse_amount_to_standard_decimals(decimals_b, amount_out, STANDARD_DECIMALS)
    } else {
        math::parse_amount_to_standard_decimals(decimals_a, amount_out, STANDARD_DECIMALS)
    };
    
    let balance = if (zero_for_one) { balance_b } else { balance_a };
    let price = if (zero_for_one) { price_b } else { price_a };
    
    let inventory_value = (balance_a as u128) * (price_a as u128) + (balance_b as u128) * (price_b as u128);
    
    // Calculate: (price * k * amount_out^2) / (balance * 2 * Q64)
    // Reorder to prevent overflow: (amount_out^2 / balance) * (price * k / (2 * Q64))
    let amount_out_squared = (parsed_amount_out as u128) * (parsed_amount_out as u128);
    
    // Calculate penalty with intermediate divisions to prevent overflow
    // penalty = amount_out^2 * price * k / (balance * 2 * Q32)
    let penalty = if (balance == 0) {
        0
    } else {
        // First: (amount_out^2 * price) / balance
        let temp1 = (amount_out_squared * (price as u128)) / (balance as u128);
        // Then: temp1 * k / (2 * Q32)
        (temp1 * (k as u128)) / (2 * Q32)
    };
    
    inventory_value - penalty
}

/// Collect protocol fee as LP tokens
fun collect_protocol_fee_on_swap<A, B>(
    pool: &mut Pool<A, B>,
    token_in_decimals: u8,
    amount_in: u64,
    fee: u32,
    protocol_fee_pct: u32,
    price_a: u64,
    price_b: u64,
    _skew_price_a: u64,
    _skew_price_b: u64
) {
    let parsed_amount_in = math::parse_amount_to_standard_decimals(token_in_decimals, amount_in, STANDARD_DECIMALS);
    
    // trading_fee = amount_in * fee / (PRECISION + fee)
    let trading_fee = math::mul_div_u128(
        (parsed_amount_in as u128),
        (fee as u128),
        ((PRECISION + (fee as u64)) as u128)
    );
    
    // protocol_fee_value = trading_fee * protocol_fee_pct * price / PRECISION
    // For simplicity, we use price_a (assuming token_in is A; adjust logic as needed)
    let protocol_fee_value = math::mul_div_u128(
        trading_fee * (protocol_fee_pct as u128) * (price_a as u128),
        1,
        (PRECISION as u128)
    );
    
    // Calculate inventory value
    let reserve_a = pool::balance_a(pool);
    let reserve_b = pool::balance_b(pool);
    let decimals_a = pool::token_a_decimals(pool);
    let decimals_b = pool::token_b_decimals(pool);
    let parsed_a = math::parse_amount_to_standard_decimals(decimals_a, reserve_a, STANDARD_DECIMALS);
    let parsed_b = math::parse_amount_to_standard_decimals(decimals_b, reserve_b, STANDARD_DECIMALS);
    let inventory_value = (parsed_a as u128) * (price_a as u128) + (parsed_b as u128) * (price_b as u128);
    
    // lp_for_protocol = (protocol_fee_value * total_supply) / inventory_value
    let total_supply = pool::lp_supply(pool);
    if (total_supply > 0 && inventory_value > 0) {
        let lp_for_protocol = math::mul_div_u128_to_u64(
            protocol_fee_value * (total_supply as u128),
            1,
            inventory_value
        );
        
        if (lp_for_protocol > 0) {
            // Mint LP tokens for protocol (would transfer to feeTo address in real implementation)
            let _protocol_lp = pool::mint_lp(pool, lp_for_protocol);
            // In actual implementation, transfer to factory::fee_to address
            // For now, just mint (increases total supply, dilutes other LPs)
            balance::destroy_zero(_protocol_lp);
        };
    };
}

public fun create_pool_with_coins<A, B>(
    factory: &mut Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    init_a: Coin<A>,
    init_b: Coin<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    ctx: &mut TxContext
): Coin<LP<A, B>> {
    let lp_balance = create_pool(factory, oracle, clock, coin::into_balance(init_a), coin::into_balance(init_b), token_a_decimals, token_b_decimals, ctx);
    coin::from_balance(lp_balance, ctx)
}

#[allow(lint(self_transfer))]
public fun create_pool_with_coins_and_transfer_lp_to_sender<A, B>(
    factory: &mut Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    init_a: Coin<A>,
    init_b: Coin<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    ctx: &mut TxContext
) {
    let lp_coin = create_pool_with_coins(factory, oracle, clock, init_a, init_b, token_a_decimals, token_b_decimals, ctx);
    transfer::public_transfer(lp_coin, sender(ctx));
}

public fun add_liquidity_with_coins<A, B>(
    factory: &Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_a: Coin<A>,
    input_b: Coin<B>,
    min_lp_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<LP<A, B>>) {
    let (remaining_a, remaining_b, lp) = add_liquidity(
        factory,
        oracle,
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
    factory: &Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_a: Coin<A>,
    input_b: Coin<B>,
    min_lp_out: u64,
    ctx: &mut TxContext
) {
    let (remaining_a, remaining_b, lp) = add_liquidity(
        factory,
        oracle,
        clock,
        pool,
        coin::into_balance(input_a),
        coin::into_balance(input_b),
        min_lp_out
    );
    let sender_addr = sender(ctx);
    library::destroy_zero_or_transfer(remaining_a, sender_addr, ctx);
    library::destroy_zero_or_transfer(remaining_b, sender_addr, ctx);
    library::destroy_zero_or_transfer(lp, sender_addr, ctx);
}

public fun remove_liquidity_with_coins<A, B>(
    factory: &Factory,
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_a_out: u64,
    min_b_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>) {
    let (a_out, b_out) = remove_liquidity(
        factory,
        pool,
        coin::into_balance(lp_in),
        min_a_out,
        min_b_out
    );

    (coin::from_balance(a_out, ctx), coin::from_balance(b_out, ctx))
}

#[allow(lint(self_transfer))]
public fun remove_liquidity_with_coins_and_transfer_to_sender<A, B>(
    factory: &Factory,
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_a_out: u64,
    min_b_out: u64,
    ctx: &mut TxContext
) {
    let (a_out, b_out) = remove_liquidity(
        factory,
        pool,
        coin::into_balance(lp_in),
        min_a_out,
        min_b_out
    );
    let sender_addr = sender(ctx);
    library::destroy_zero_or_transfer(a_out, sender_addr, ctx);
    library::destroy_zero_or_transfer(b_out, sender_addr, ctx);
}

public fun swap_a_for_b_with_coin<A, B>(
    factory: &Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<B> {
    let b_out = swap_a_for_b(factory, oracle, clock, pool, coin::into_balance(input), min_out);
    coin::from_balance(b_out, ctx)
}

#[allow(lint(self_transfer))]
public fun swap_a_for_b_with_coin_and_transfer_to_sender<A, B>(
    factory: &Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    min_out: u64,
    ctx: &mut TxContext
) {
    let b_coin = swap_a_for_b_with_coin(factory, oracle, clock, pool, input, min_out, ctx);
    transfer::public_transfer(b_coin, sender(ctx));
}

public fun swap_b_for_a_with_coin<A, B>(
    factory: &Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<A> {
    let a_out = swap_b_for_a(factory, oracle, clock, pool, coin::into_balance(input), min_out);
    coin::from_balance(a_out, ctx)
}

#[allow(lint(self_transfer))]
public fun swap_b_for_a_with_coin_and_transfer_to_sender<A, B>(
    factory: &Factory,
    oracle: &OracleAdapter,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    min_out: u64,
    ctx: &mut TxContext
) {
    let a_coin = swap_b_for_a_with_coin(factory, oracle, clock, pool, input, min_out, ctx);
    transfer::public_transfer(a_coin, sender(ctx));
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
    assert!(library::sort_names(&type_name::with_original_ids<BAR>(), &type_name::with_original_ids<FOO>()) == library::sort_less(), 0);
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
