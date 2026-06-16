module brownfi_amm::admin;

use std::vector;
use sui::coin::{Self, Coin};
use brownfi_amm::math;
use brownfi_amm::pool::{Self, Pool};
use brownfi_amm::pool::LP;
use brownfi_amm::factory::{
    Self,
    Factory,
    AdminCap,
    AmmCap,
    FeeCap,
    OracleCap,
    PauseCap,
    RiskCap,
    RouterCap
};
use brownfi_amm::events;

/// Error codes
const EFeeTooHigh: u64 = 1;
const EProtocolFeeTooHigh: u64 = 2;
const EKTooHigh: u64 = 3;
const ELambdaTooHigh: u64 = 4;
const EGammaOutOfBounds: u64 = 5;
const ESpreadTooHigh: u64 = 6;
const EFeeToNotSet: u64 = 7;
const EOraclePolicyInvalid: u64 = 9;
const EAmmPolicyInvalid: u64 = 10;
const EAmmFallbackInvalid: u64 = 11;
const EFeeTooLow: u64 = 12;
const EKTooLow: u64 = 13;

/// Minimum fee: 0.01% in PRECISION units.
const MIN_FEE: u32 = 10_000;
/// Maximum fee: 50% in PRECISION units.
const MAX_FEE: u32 = 50_000_000;
/// Maximum protocol fee split: 100% in PRECISION units.
const MAX_PROTOCOL_FEE: u32 = 100_000_000;
const PRECISION: u32 = 100_000_000;
const MAX_FIX_S: u32 = 1_000_000;
const MAX_DIS_THRESHOLD: u32 = 10_000_000;
const MAX_S_BOUND: u32 = 9_999_999;
const MAX_SOURCE_INDEX: u8 = 63;

/// Set trading fee for a pool (requires RiskCap)
/// Fee is in PRECISION units (e.g., 100_000 = 0.1%).
public fun set_pool_fee<A, B>(
    pool: &mut Pool<A, B>,
    _risk_cap: &RiskCap,
    new_fee: u32
) {
    assert!(new_fee >= MIN_FEE, EFeeTooLow);
    assert!(new_fee <= MAX_FEE, EFeeTooHigh);
    pool::set_fee(pool, new_fee);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"fee",
        (new_fee as u64)
    );
    events::emit_config_updated(
        pool::id(pool),
        b"fee",
        vector[(new_fee as u128)]
    );
}

/// Set inventory parameter k for a pool (requires RiskCap)
/// k is in Q32 format (e.g., Q32/1000 = 0.001)
/// k bounds: [0.0001, 2.0] in Q32 format.
public fun set_pool_k<A, B>(
    pool: &mut Pool<A, B>,
    _risk_cap: &RiskCap,
    new_k: u64
) {
    let q32 = math::q32();
    assert!(new_k >= q32 / 10000, EKTooLow);
    assert!(new_k <= q32 * 2, EKTooHigh);
    assert!(pool::lambda(pool) * 2 <= new_k, ELambdaTooHigh);
    pool::set_k(pool, new_k);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"k",
        new_k
    );
    events::emit_config_updated(
        pool::id(pool),
        b"kappa",
        vector[(pool::k_b(pool) as u128), (pool::k_q(pool) as u128)]
    );
}

/// Set skewness parameter lambda for a pool (requires RiskCap)
/// lambda is in Q32 format (e.g., Q32/10 = 0.1)
/// Maximum lambda: 1.0 in Q32 format
public fun set_pool_lambda<A, B>(
    pool: &mut Pool<A, B>,
    _risk_cap: &RiskCap,
    new_lambda: u64
) {
    let max_lambda = math::q32();
    assert!(new_lambda <= max_lambda, ELambdaTooHigh);
    assert!(new_lambda * 2 <= pool::k_b(pool), ELambdaTooHigh);
    assert!(new_lambda * 2 <= pool::k_q(pool), ELambdaTooHigh);
    pool::set_lambda(pool, new_lambda);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"lambda",
        new_lambda
    );
    events::emit_config_updated(
        pool::id(pool),
        b"lambda",
        vector[(new_lambda as u128)]
    );
}

public fun set_pool_k_b<A, B>(
    pool: &mut Pool<A, B>,
    _risk_cap: &RiskCap,
    new_k: u64
) {
    let min_k = math::q32() / 10000;
    let max_k = math::q32() * 2;
    assert!(new_k >= min_k, EKTooLow);
    assert!(new_k <= max_k, EKTooHigh);
    assert!(pool::lambda(pool) * 2 <= new_k, ELambdaTooHigh);
    pool::set_k_b(pool, new_k);
    events::emit_pool_parameters_updated(pool::id(pool), b"k_b", new_k);
    events::emit_config_updated(
        pool::id(pool),
        b"kappa",
        vector[(pool::k_b(pool) as u128), (pool::k_q(pool) as u128)]
    );
}

public fun set_pool_k_q<A, B>(
    pool: &mut Pool<A, B>,
    _risk_cap: &RiskCap,
    new_k: u64
) {
    let min_k = math::q32() / 10000;
    let max_k = math::q32() * 2;
    assert!(new_k >= min_k, EKTooLow);
    assert!(new_k <= max_k, EKTooHigh);
    assert!(pool::lambda(pool) * 2 <= new_k, ELambdaTooHigh);
    pool::set_k_q(pool, new_k);
    events::emit_pool_parameters_updated(pool::id(pool), b"k_q", new_k);
    events::emit_config_updated(
        pool::id(pool),
        b"kappa",
        vector[(pool::k_b(pool) as u128), (pool::k_q(pool) as u128)]
    );
}

public fun set_pool_fee_split<A, B>(
    pool: &mut Pool<A, B>,
    risk_cap: &RiskCap,
    new_fee_split: u32
) {
    set_pool_protocol_fee(pool, risk_cap, new_fee_split);
}

public fun set_pool_fee_to<A, B>(
    pool: &mut Pool<A, B>,
    _fee_cap: &FeeCap,
    fee_to: address
) {
    pool::set_fee_to(pool, fee_to);
    events::emit_fee_to_updated(fee_to);
}

public fun set_pool_swaps_paused<A, B>(
    pool: &mut Pool<A, B>,
    _pause_cap: &PauseCap,
    paused: bool
) {
    pool::set_swaps_paused(pool, paused);
    events::emit_pause_state_changed(paused);
    events::emit_pool_gate_state_changed(pool::id(pool), events::pool_gate_swap(), !paused);
}

public fun set_pool_add_liquidity_paused<A, B>(
    pool: &mut Pool<A, B>,
    _pause_cap: &PauseCap,
    paused: bool
) {
    pool::set_add_liquidity_paused(pool, paused);
    events::emit_pause_state_changed(paused);
    events::emit_pool_gate_state_changed(pool::id(pool), events::pool_gate_add_liquidity(), !paused);
}

public fun set_pool_gamma<A, B>(
    pool: &mut Pool<A, B>,
    _risk_cap: &RiskCap,
    new_gamma: u32
) {
    assert!(new_gamma > 0 && new_gamma <= PRECISION, EGammaOutOfBounds);
    pool::set_gamma(pool, new_gamma);
    events::emit_pool_parameters_updated(pool::id(pool), b"gamma", (new_gamma as u64));
    events::emit_config_updated(
        pool::id(pool),
        b"gamma",
        vector[(new_gamma as u128)]
    );
}

public fun set_pool_spreads<A, B>(
    pool: &mut Pool<A, B>,
    _risk_cap: &RiskCap,
    compress: u32,
    s_sell: u32,
    s_buy: u32,
    fix_s: u32,
    dis_threshold: u32,
    s_bound: u32
) {
    assert!(compress <= PRECISION, ESpreadTooHigh);
    assert!(s_sell <= PRECISION && s_buy <= PRECISION, ESpreadTooHigh);
    assert!(fix_s <= MAX_FIX_S, ESpreadTooHigh);
    assert!(dis_threshold > 0 && dis_threshold <= MAX_DIS_THRESHOLD, ESpreadTooHigh);
    assert!(s_bound <= MAX_S_BOUND, ESpreadTooHigh);
    let dynamic_spread = math::mul_div_up_u128(
        (compress as u128),
        (dis_threshold as u128),
        (PRECISION as u128)
    );
    assert!(
        (fix_s as u128) + dynamic_spread + (s_buy as u128) < (PRECISION as u128),
        ESpreadTooHigh
    );
    pool::set_spreads(pool, compress, s_sell, s_buy, fix_s, dis_threshold, s_bound);
    events::emit_pool_parameters_updated(pool::id(pool), b"spreads", (fix_s as u64));
    events::emit_config_updated(
        pool::id(pool),
        b"spread",
        vector[(compress as u128), (s_sell as u128), (s_buy as u128)]
    );
    events::emit_config_updated(
        pool::id(pool),
        b"fix_spread",
        vector[(fix_s as u128)]
    );
    events::emit_config_updated(
        pool::id(pool),
        b"dis_threshold",
        vector[(dis_threshold as u128)]
    );
    events::emit_config_updated(
        pool::id(pool),
        b"s_bound",
        vector[(s_bound as u128)]
    );
}

public fun set_pool_pyth_weight<A, B>(
    pool: &mut Pool<A, B>,
    _oracle_cap: &OracleCap,
    new_weight: u32
) {
    assert!(new_weight <= PRECISION, ESpreadTooHigh);
    if (pool::amm_twap_enabled(pool) && pool::amm_blend_weight(pool) > 0) {
        assert!(new_weight > 0, EAmmPolicyInvalid);
    };
    pool::set_pyth_weight(pool, new_weight);
    events::emit_pool_parameters_updated(pool::id(pool), b"pyth_weight", (new_weight as u64));
    events::emit_oracle_policy_updated(
        pool::id(pool),
        pool::oracle_policy_version(pool),
        b"pyth_weight",
        vector[(new_weight as u128)]
    );
}

public fun set_pool_oracle_max_price_age<A, B>(
    pool: &mut Pool<A, B>,
    _oracle_cap: &OracleCap,
    new_age: u64
) {
    assert!(new_age > 0, EOraclePolicyInvalid);
    pool::set_oracle_max_price_age(pool, new_age);
    events::emit_pool_parameters_updated(pool::id(pool), b"oracle_max_price_age", new_age);
    events::emit_oracle_policy_updated(
        pool::id(pool),
        pool::oracle_policy_version(pool),
        b"max_price_age",
        vector[(new_age as u128)]
    );
}

public fun set_pool_oracle_quorum<A, B>(
    pool: &mut Pool<A, B>,
    _oracle_cap: &OracleCap,
    min_sources: u8,
    required_source_mask: u64,
    allowed_source_mask: u64
) {
    assert!(min_sources > 0, EOraclePolicyInvalid);
    assert!(required_source_mask > 0, EOraclePolicyInvalid);
    assert!((allowed_source_mask & required_source_mask) == required_source_mask, EOraclePolicyInvalid);
    assert!(min_sources <= count_sources(allowed_source_mask), EOraclePolicyInvalid);
    pool::set_oracle_quorum(pool, min_sources, required_source_mask, allowed_source_mask);
    events::emit_pool_parameters_updated(pool::id(pool), b"oracle_quorum", (min_sources as u64));
    events::emit_oracle_policy_updated(
        pool::id(pool),
        pool::oracle_policy_version(pool),
        b"quorum",
        vector[(min_sources as u128), (required_source_mask as u128), (allowed_source_mask as u128)]
    );
}

public fun set_pool_oracle_aggregation_policy<A, B>(
    pool: &mut Pool<A, B>,
    _oracle_cap: &OracleCap,
    primary_source: u8,
    max_pair_time_delta_ms: u64,
    max_confidence: u64,
    max_deviation: u64,
    mode: u8
) {
    assert!(primary_source <= MAX_SOURCE_INDEX, EOraclePolicyInvalid);
    assert!(
        (pool::oracle_allowed_source_mask(pool) & source_mask(primary_source)) == source_mask(primary_source),
        EOraclePolicyInvalid
    );
    assert!(max_confidence <= (PRECISION as u64), EOraclePolicyInvalid);
    assert!(max_deviation <= (PRECISION as u64), EOraclePolicyInvalid);
    assert!(
        mode == pool::oracle_mode_primary_with_sanity()
            || mode == pool::oracle_mode_median(),
        EOraclePolicyInvalid
    );
    pool::set_oracle_aggregation_policy(
        pool,
        primary_source,
        max_pair_time_delta_ms,
        max_confidence,
        max_deviation,
        mode
    );
    events::emit_pool_parameters_updated(pool::id(pool), b"oracle_aggregation", (mode as u64));
    events::emit_oracle_policy_updated(
        pool::id(pool),
        pool::oracle_policy_version(pool),
        b"aggregation",
        vector[
            (primary_source as u128),
            (max_pair_time_delta_ms as u128),
            (max_confidence as u128),
            (max_deviation as u128),
            (mode as u128)
        ]
    );
}

public fun set_pool_oracle_sources<A, B>(
    pool: &mut Pool<A, B>,
    _oracle_cap: &OracleCap,
    source_type_a: vector<u8>,
    source_type_b: vector<u8>,
    source_id_a: ID,
    source_id_b: ID,
    config_data_a: vector<u8>,
    config_data_b: vector<u8>
) {
    pool::set_oracle_sources(
        pool,
        source_type_a,
        source_type_b,
        source_id_a,
        source_id_b,
        config_data_a,
        config_data_b
    );
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"oracle_sources",
        pool::oracle_policy_version(pool)
    );
    events::emit_oracle_policy_updated(
        pool::id(pool),
        pool::oracle_policy_version(pool),
        b"sources",
        vector[]
    );
}

public fun set_pool_amm_policy<A, B>(
    pool: &mut Pool<A, B>,
    _amm_cap: &AmmCap,
    enabled: bool,
    blend_weight: u32,
    min_sources: u8,
    fallback_mode: u8
) {
    assert!(blend_weight <= PRECISION, EAmmPolicyInvalid);
    assert!(
        fallback_mode == pool::amm_fallback_oracle_only() || fallback_mode == pool::amm_fallback_fail_closed(),
        EAmmPolicyInvalid
    );
    if (min_sources > 0) {
        assert!(fallback_mode == pool::amm_fallback_fail_closed(), EAmmFallbackInvalid);
    };
    if (!enabled) {
        assert!(blend_weight == 0 && min_sources == 0, EAmmPolicyInvalid);
    };
    if (enabled && blend_weight > 0) {
        assert!(pool::pyth_weight(pool) > 0, EAmmPolicyInvalid);
    };
    if (min_sources > 0) {
        if (pool::amm_allowed_source_mask(pool) > 0) {
            assert!(min_sources <= count_sources(pool::amm_allowed_source_mask(pool)), EAmmPolicyInvalid);
        };
        if (pool::amm_source_count_limit(pool) > 0) {
            assert!(min_sources <= pool::amm_source_count_limit(pool), EAmmPolicyInvalid);
        };
        let allowed_source_ids = pool::amm_allowed_source_ids(pool);
        let source_id_count = vector::length(&allowed_source_ids);
        if (source_id_count > 0) {
            assert!((min_sources as u64) <= source_id_count, EAmmPolicyInvalid);
        };
    };
    pool::set_amm_policy(pool, enabled, blend_weight, min_sources, fallback_mode);
    events::emit_pool_parameters_updated(pool::id(pool), b"amm_policy", (blend_weight as u64));
    let enabled_value: u64 = if (enabled) { 1 } else { 0 };
    events::emit_amm_policy_updated(
        pool::id(pool),
        pool::oracle_policy_version(pool),
        b"amm_policy",
        vector[
            (enabled_value as u128),
            (blend_weight as u128),
            (min_sources as u128),
            (fallback_mode as u128)
        ]
    );
}

public fun set_pool_amm_source_policy<A, B>(
    pool: &mut Pool<A, B>,
    _amm_cap: &AmmCap,
    max_ospread: u32,
    min_liquidity_quote: u128,
    min_window_seconds: u64,
    max_window_seconds: u64,
    allowed_source_mask: u64,
    source_count_limit: u8
) {
    assert!(max_ospread <= PRECISION, EAmmPolicyInvalid);
    assert!(min_window_seconds <= max_window_seconds, EAmmPolicyInvalid);
    if (pool::amm_min_sources(pool) > 0) {
        assert!(pool::amm_min_sources(pool) <= count_sources(allowed_source_mask), EAmmPolicyInvalid);
        if (source_count_limit > 0) {
            assert!(pool::amm_min_sources(pool) <= source_count_limit, EAmmPolicyInvalid);
        };
    };
    pool::set_amm_source_policy(
        pool,
        max_ospread,
        min_liquidity_quote,
        min_window_seconds,
        max_window_seconds,
        allowed_source_mask,
        source_count_limit
    );
    events::emit_pool_parameters_updated(pool::id(pool), b"amm_source_policy", (max_ospread as u64));
    events::emit_amm_policy_updated(
        pool::id(pool),
        pool::oracle_policy_version(pool),
        b"amm_source_policy",
        vector[
            (max_ospread as u128),
            min_liquidity_quote,
            (min_window_seconds as u128),
            (max_window_seconds as u128),
            (allowed_source_mask as u128),
            (source_count_limit as u128)
        ]
    );
}

public fun set_pool_amm_source_ids<A, B>(
    pool: &mut Pool<A, B>,
    _amm_cap: &AmmCap,
    allowed_source_ids: vector<ID>
) {
    let source_id_count = vector::length(&allowed_source_ids);
    if (source_id_count > 0 && pool::amm_min_sources(pool) > 0) {
        assert!((pool::amm_min_sources(pool) as u64) <= source_id_count, EAmmPolicyInvalid);
    };
    pool::set_amm_source_ids(pool, allowed_source_ids);
    events::emit_pool_parameters_updated(pool::id(pool), b"amm_source_ids", source_id_count);
    events::emit_amm_policy_updated(
        pool::id(pool),
        pool::oracle_policy_version(pool),
        b"amm_source_ids",
        vector[(source_id_count as u128)]
    );
}

public fun set_pool_flash_enabled<A, B>(
    pool: &mut Pool<A, B>,
    _pause_cap: &PauseCap,
    enabled: bool
) {
    pool::set_flash_enabled(pool, enabled);
    events::emit_pool_gate_state_changed(pool::id(pool), events::pool_gate_flash(), enabled);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"flash_enabled",
        if (enabled) { 1 } else { 0 }
    );
}

public fun set_pool_router_enabled<A, B>(
    pool: &mut Pool<A, B>,
    _router_cap: &RouterCap,
    enabled: bool
) {
    pool::set_router_enabled(pool, enabled);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"router_enabled",
        if (enabled) { 1 } else { 0 }
    );
}

/// Set protocol fee percentage for a pool (requires RiskCap)
/// Protocol fee split is in PRECISION units (e.g., 10_000_000 = 10%).
public fun set_pool_protocol_fee<A, B>(
    pool: &mut Pool<A, B>,
    _risk_cap: &RiskCap,
    new_protocol_fee: u32
) {
    assert!(new_protocol_fee <= MAX_PROTOCOL_FEE, EProtocolFeeTooHigh);
    if (new_protocol_fee > 0) {
        assert!(pool::has_fee_to(pool), EFeeToNotSet);
    };
    pool::set_protocol_fee(pool, new_protocol_fee);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"protocol_fee",
        (new_protocol_fee as u64)
    );
    events::emit_config_updated(
        pool::id(pool),
        b"fee_split",
        vector[(new_protocol_fee as u128)]
    );
}

/// Set factory pause state (requires AdminCap)
public fun set_factory_paused(
    factory: &mut Factory,
    admin_cap: &AdminCap,
    paused: bool
) {
    factory::set_paused(factory, admin_cap, paused);
    events::emit_pause_state_changed(paused);
}

/// Set factory fee recipient (requires AdminCap)
public fun set_factory_fee_to(
    factory: &mut Factory,
    admin_cap: &AdminCap,
    fee_to: address
) {
    factory::set_fee_to(factory, admin_cap, fee_to);
    events::emit_fee_to_updated(fee_to);
}

/// Set factory oracle (requires AdminCap)
public fun set_factory_oracle(
    factory: &mut Factory,
    admin_cap: &AdminCap,
    oracle_id: ID
) {
    factory::set_oracle(factory, admin_cap, oracle_id);
    events::emit_oracle_updated(oracle_id);
}

/// Set minimum price age for oracle queries (requires AdminCap)
public fun set_factory_min_price_age(
    factory: &mut Factory,
    admin_cap: &AdminCap,
    age: u64
) {
    factory::set_min_price_age(factory, admin_cap, age);
}

public fun claim_protocol_lp<A, B>(
    pool: &mut Pool<A, B>,
    _fee_cap: &FeeCap,
    ctx: &mut TxContext
): Coin<LP<A, B>> {
    let fee_to_opt = pool::fee_to(pool);
    assert!(option::is_some(&fee_to_opt), EFeeToNotSet);
    let fee_to = *option::borrow(&fee_to_opt);
    let claimed = coin::from_balance(pool::withdraw_protocol_lp(pool), ctx);
    events::emit_protocol_lp_claimed(pool::id(pool), fee_to, coin::value(&claimed));
    claimed
}

/// Get maximum allowed values for validation
public fun max_fee(): u32 { MAX_FEE }
public fun max_protocol_fee(): u32 { MAX_PROTOCOL_FEE }

fun source_mask(source: u8): u64 {
    1 << source
}

fun count_sources(mask: u64): u8 {
    let mut count = 0;
    let mut remaining = mask;
    while (remaining > 0) {
        if ((remaining & 1) == 1) {
            count = count + 1;
        };
        remaining = remaining >> 1;
    };
    count
}

public fun max_k(): u64 { math::q32() * 2 }
public fun max_lambda(): u64 { math::q32() }
