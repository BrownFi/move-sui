module brownfi_amm::admin;

use brownfi_amm::pool::{Self, Pool};
use brownfi_amm::factory::{Self, Factory, AdminCap};
use brownfi_amm::events;

/// Error codes
const EFeeTooHigh: u64 = 1;
const EProtocolFeeTooHigh: u64 = 2;
const EKTooHigh: u64 = 3;
const ELambdaTooHigh: u64 = 4;

use brownfi_amm::math;

/// Maximum fee: 10% (represented as 10_000_000 in basis points)
const MAX_FEE: u32 = 10_000_000;
/// Maximum protocol fee: 80% (represented as 80_000_000)
const MAX_PROTOCOL_FEE: u32 = 80_000_000;

/// Set trading fee for a pool (requires AdminCap)
/// Fee is in basis points (e.g., 300_000 = 0.3%)
public fun set_pool_fee<A, B>(
    pool: &mut Pool<A, B>,
    _admin_cap: &AdminCap,
    new_fee: u32
) {
    assert!(new_fee <= MAX_FEE, EFeeTooHigh);
    pool::set_fee(pool, new_fee);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"fee",
        (new_fee as u64)
    );
}

/// Set inventory parameter k for a pool (requires AdminCap)
/// k is in Q32 format (e.g., Q32/1000 = 0.001)
/// Maximum k: 2.0 in Q32 format (2 * Q32)
public fun set_pool_k<A, B>(
    pool: &mut Pool<A, B>,
    _admin_cap: &AdminCap,
    new_k: u64
) {
    // Max K is 2 * Q32
    let max_k = math::q32();
    assert!(new_k <= max_k * 2, EKTooHigh);
    pool::set_k(pool, new_k);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"k",
        new_k
    );
}

/// Set skewness parameter lambda for a pool (requires AdminCap)
/// lambda is in Q32 format (e.g., Q32/10 = 0.1)
/// Maximum lambda: 1.0 in Q32 format
public fun set_pool_lambda<A, B>(
    pool: &mut Pool<A, B>,
    _admin_cap: &AdminCap,
    new_lambda: u64
) {
    let max_lambda = math::q32();
    assert!(new_lambda <= max_lambda, ELambdaTooHigh);
    pool::set_lambda(pool, new_lambda);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"lambda",
        new_lambda
    );
}

/// Set protocol fee percentage for a pool (requires AdminCap)
/// protocol_fee is a percentage (e.g., 10_000_000 = 10%)
public fun set_pool_protocol_fee<A, B>(
    pool: &mut Pool<A, B>,
    _admin_cap: &AdminCap,
    new_protocol_fee: u32
) {
    assert!(new_protocol_fee <= MAX_PROTOCOL_FEE, EProtocolFeeTooHigh);
    pool::set_protocol_fee(pool, new_protocol_fee);
    events::emit_pool_parameters_updated(
        pool::id(pool),
        b"protocol_fee",
        (new_protocol_fee as u64)
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

/// Get maximum allowed values for validation
public fun max_fee(): u32 { MAX_FEE }
public fun max_protocol_fee(): u32 { MAX_PROTOCOL_FEE }
public fun max_k(): u64 { math::q32() * 2 }
public fun max_lambda(): u64 { math::q32() }
