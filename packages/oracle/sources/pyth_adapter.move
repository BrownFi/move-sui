/// Pyth Network Oracle Adapter
/// 
/// Integrates with Pyth Network price feeds on Sui.
/// Pyth provides real-time price data for cryptocurrencies and traditional assets.
/// 
/// Usage:
/// ```
/// let price = pyth_adapter::get_price(pyth_state, price_feed_id, max_staleness);
/// ```
module brownfi_oracle::pyth_adapter;

use sui::clock::{Self, Clock};
use pyth::price_info;
use pyth::price_identifier;
use pyth::price;
use pyth::price_feed;
use pyth::i64;
use pyth::pyth;
use pyth::price_info::PriceInfoObject;

/// Error codes
const EInvalidPrice: u64 = 3;
const ENegativePrice: u64 = 4;

/// BrownFi oracle absolute prices use 9 decimals.
const PRICE_SCALE_DECIMALS: u64 = 9;
const MAX_U64: u128 = 18446744073709551615;
const MAX_POW_10_EXPONENT: u64 = 38;

/// Get a normalized price from a Pyth PriceInfoObject.
/// 
/// Parameters:
/// - price_info_object: Reference to Pyth PriceInfoObject
/// - clock: Current clock for staleness check
/// - price_feed_id: Pyth price feed ID (32 bytes)
/// - max_staleness: Maximum age in seconds
/// 
/// Returns: positive absolute price with 9 decimals.
public fun get_price(
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    price_feed_id: vector<u8>,
    max_staleness: u64
): u64 {
    let (price, _, _) = get_price_with_bounds(price_info_object, clock, price_feed_id, max_staleness);
    price
}

/// Get normalized Pyth price and confidence bounds.
///
/// Returns: `(price, upper, lower)` as positive absolute prices with 9 decimals.
/// The lower bound is floored to 1 when `price - conf` is not positive, matching
/// the EVM gateway's divisor-safe fallback behavior.
public fun get_price_with_bounds(
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    price_feed_id: vector<u8>,
    max_staleness: u64
): (u64, u64, u64) {
    let price_struct = pyth::get_price_no_older_than(price_info_object, clock, max_staleness);
    let price_info = price_info::get_price_info_from_price_info_object(price_info_object);
    let price_id = price_identifier::get_bytes(&price_info::get_price_identifier(&price_info));

    assert!(price_id == price_feed_id, EInvalidPrice);

    let price_i64 = price::get_price(&price_struct);
    assert!(!i64::get_is_negative(&price_i64), ENegativePrice);
    let price_magnitude = i64::get_magnitude_if_positive(&price_i64);
    assert!(price_magnitude > 0, EInvalidPrice);

    let expo_i64 = price::get_expo(&price_struct);
    let expo_is_negative = i64::get_is_negative(&expo_i64);
    let expo_magnitude = if (expo_is_negative) {
        i64::get_magnitude_if_negative(&expo_i64)
    } else {
        i64::get_magnitude_if_positive(&expo_i64)
    };

    let normalized_price = normalize_pyth_price_to_9_decimals(
        price_magnitude,
        expo_magnitude,
        expo_is_negative
    );
    let confidence = price::get_conf(&price_struct);
    let upper_magnitude = (price_magnitude as u128) + (confidence as u128);
    assert!(upper_magnitude <= MAX_U64, EInvalidPrice);
    let normalized_upper = normalize_pyth_price_to_9_decimals(
        (upper_magnitude as u64),
        expo_magnitude,
        expo_is_negative
    );
    let lower_magnitude = if (price_magnitude > confidence) {
        price_magnitude - confidence
    } else {
        0
    };
    let normalized_lower = normalize_pyth_bound_to_9_decimals(
        lower_magnitude,
        expo_magnitude,
        expo_is_negative
    );

    (
        normalized_price,
        normalized_upper,
        if (normalized_lower == 0) { 1 } else { normalized_lower }
    )
}

/// Check if price is stale
#[allow(unused_function)]
fun is_price_stale(publish_time: u64, current_time: u64, max_staleness: u64): bool {
    if (current_time < publish_time) {
        return true
    };
    
    let age = current_time - publish_time;
    age > max_staleness
}

fun normalize_pyth_price_to_9_decimals(
    price_magnitude: u64,
    expo_magnitude: u64,
    expo_is_negative: bool
): u64 {
    let result = normalize_pyth_bound_to_9_decimals(price_magnitude, expo_magnitude, expo_is_negative);
    assert!(result > 0, EInvalidPrice);
    result
}

fun normalize_pyth_bound_to_9_decimals(
    price_magnitude: u64,
    expo_magnitude: u64,
    expo_is_negative: bool
): u64 {
    let price_u128 = (price_magnitude as u128);
    let result = if (expo_is_negative) {
        if (expo_magnitude <= PRICE_SCALE_DECIMALS) {
            price_u128 * pow_10_u128_checked(PRICE_SCALE_DECIMALS - expo_magnitude)
        } else {
            price_u128 / pow_10_u128_checked(expo_magnitude - PRICE_SCALE_DECIMALS)
        }
    } else {
        price_u128 * pow_10_u128_checked(expo_magnitude + PRICE_SCALE_DECIMALS)
    };

    assert!(result <= MAX_U64, EInvalidPrice);
    (result as u64)
}

fun pow_10_u128_checked(n: u64): u128 {
    assert!(n <= MAX_POW_10_EXPONENT, EInvalidPrice);
    let mut result: u128 = 1;
    let mut i: u64 = 0;
    while (i < n) {
        result = result * 10;
        i = i + 1;
    };
    result
}

//
// Tests
//

#[test]
fun test_get_price_normalizes_legacy_pyth_exponent_to_9_decimals() {
    let mut ctx = tx_context::dummy();
    let clock = clock::create_for_testing(&mut ctx);
    let price_info_object = new_test_price_info_object(
        x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        123456789,
        false,
        8,
        true,
        1000000,
        0,
        &mut ctx
    );

    let normalized = get_price(
        &price_info_object,
        &clock,
        x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        15
    );

    assert!(normalized == 1234567890, 0);

    price_info::destroy(price_info_object);
    clock::destroy_for_testing(clock);
}

#[test]
fun test_get_price_rounds_down_when_pyth_exponent_has_more_than_9_decimals() {
    let mut ctx = tx_context::dummy();
    let clock = clock::create_for_testing(&mut ctx);
    let price_info_object = new_test_price_info_object(
        x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        123456789,
        false,
        10,
        true,
        100000,
        0,
        &mut ctx
    );

    let normalized = get_price(
        &price_info_object,
        &clock,
        x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
        15
    );

    assert!(normalized == 12345678, 0);

    price_info::destroy(price_info_object);
    clock::destroy_for_testing(clock);
}

#[test]
fun test_get_price_normalizes_positive_pyth_exponent() {
    let mut ctx = tx_context::dummy();
    let clock = clock::create_for_testing(&mut ctx);
    let price_info_object = new_test_price_info_object(
        x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        2,
        false,
        1,
        false,
        0,
        0,
        &mut ctx
    );

    let normalized = get_price(
        &price_info_object,
        &clock,
        x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
        15
    );

    assert!(normalized == 20000000000, 0);

    price_info::destroy(price_info_object);
    clock::destroy_for_testing(clock);
}

#[test]
#[expected_failure(abort_code = ENegativePrice)]
fun test_get_price_rejects_negative_pyth_price() {
    let mut ctx = tx_context::dummy();
    let clock = clock::create_for_testing(&mut ctx);
    let price_info_object = new_test_price_info_object(
        x"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        1,
        true,
        0,
        false,
        0,
        0,
        &mut ctx
    );

    let _ = get_price(
        &price_info_object,
        &clock,
        x"dddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddddd",
        15
    );

    price_info::destroy(price_info_object);
    clock::destroy_for_testing(clock);
}

#[test]
fun test_get_price_does_not_hardcode_confidence_threshold() {
    let mut ctx = tx_context::dummy();
    let clock = clock::create_for_testing(&mut ctx);
    let price_info_object = new_test_price_info_object(
        x"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        100000000,
        false,
        8,
        true,
        2000000,
        0,
        &mut ctx
    );

    let normalized = get_price(
        &price_info_object,
        &clock,
        x"eeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
        15
    );

    assert!(normalized == 1000000000, 0);

    price_info::destroy(price_info_object);
    clock::destroy_for_testing(clock);
}

#[test]
#[expected_failure(abort_code = EInvalidPrice)]
fun test_get_price_rejects_wrong_feed_id() {
    let mut ctx = tx_context::dummy();
    let clock = clock::create_for_testing(&mut ctx);
    let price_info_object = new_test_price_info_object(
        x"ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff",
        100000000,
        false,
        8,
        true,
        0,
        0,
        &mut ctx
    );

    let _ = get_price(
        &price_info_object,
        &clock,
        x"1111111111111111111111111111111111111111111111111111111111111111",
        15
    );

    price_info::destroy(price_info_object);
    clock::destroy_for_testing(clock);
}

#[test]
fun test_price_staleness() {
    let current_time = 1000000;
    let max_staleness = 60; // 60 seconds

    // Fresh price
    assert!(!is_price_stale(999950, current_time, max_staleness), 0);

    // Stale price (61 seconds old)
    assert!(is_price_stale(999939, current_time, max_staleness), 1);

    // Exact staleness boundary
    assert!(!is_price_stale(999940, current_time, max_staleness), 2);
}

#[test_only]
fun new_test_price_info_object(
    feed_id: vector<u8>,
    price_magnitude: u64,
    price_negative: bool,
    expo_magnitude: u64,
    expo_negative: bool,
    conf: u64,
    timestamp: u64,
    ctx: &mut TxContext
): PriceInfoObject {
    let price_struct = price::new(
        i64::new(price_magnitude, price_negative),
        conf,
        i64::new(expo_magnitude, expo_negative),
        timestamp
    );
    let ema_price = price::new(
        i64::new(price_magnitude, price_negative),
        conf,
        i64::new(expo_magnitude, expo_negative),
        timestamp
    );
    let feed = price_feed::new(
        price_identifier::from_byte_vec(feed_id),
        price_struct,
        ema_price
    );
    let info = price_info::new_price_info(0, 0, feed);
    price_info::new_price_info_object_for_test(info, ctx)
}
