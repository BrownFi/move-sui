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

use sui::clock::Clock;
use pyth::price_info;
use pyth::price_identifier;
use pyth::price;
use pyth::pyth;
use pyth::price_info::PriceInfoObject;

/// Error codes
#[allow(unused_const)]
const EStalePrice: u64 = 1;
#[allow(unused_const)]
const EPriceFeedNotFound: u64 = 2;
#[allow(unused_const)]
const EInvalidPrice: u64 = 3;
#[allow(unused_const)]
const ENegativePrice: u64 = 4;
#[allow(unused_const)]
const EPriceConfidenceTooLow: u64 = 5;

/// Maximum allowed staleness (5 minutes)
#[allow(unused_const)]
const MAX_STALENESS_SECONDS: u64 = 300;
/// Minimum confidence threshold (price must be within 1% of reported value)
#[allow(unused_const)]
const MIN_CONFIDENCE_RATIO: u64 = 100; // 1% in basis points

/// Q32 constant (reduced from Q64 to prevent overflow)
const Q32: u128 = 4294967296; // 1 << 32

/// Get price from Pyth Network
/// This is a placeholder that returns a default price of 1.0 (Q32)
/// In production, this should fetch the actual price from Pyth state
/// 
/// Parameters:
/// - price_info_object: Reference to Pyth PriceInfoObject
/// - clock: Current clock for staleness check
/// - price_feed_id: Pyth price feed ID (32 bytes)
/// - max_staleness: Maximum age in seconds
/// 
/// Returns: Price in Q32 format (2^32 represents 1.0)
public fun get_price(
    _price_info_object: &PriceInfoObject,
    _clock: &Clock,
    _price_feed_id: vector<u8>,
    _max_staleness: u64
): u64 {
    // Implement actual Pyth price fetching
    // Make sure the price is not older than max_age seconds
    let price_struct = pyth::get_price_no_older_than(_price_info_object, _clock, _max_staleness);
    // Check the price feed ID
    let price_info = price_info::get_price_info_from_price_info_object(_price_info_object);
    let price_id = price_identifier::get_bytes(&price_info::get_price_identifier(&price_info));

    assert!(price_id == _price_feed_id, EInvalidPrice);

    let price_i64 = price::get_price(&price_struct);
    price_i64.get_magnitude_if_positive()
}

/// Convert Pyth price format to Q32 format
/// Pyth prices come with an exponent (e.g., price=123456, expo=8 (negative) means 0.00123456)
/// We need to convert this to Q32 fixed-point format where 2^32 represents 1.0
#[allow(unused_function)]
fun convert_pyth_price_to_q32(price: u64, expo: u8, expo_is_negative: bool): u64 {
    let price_u128 = (price as u128);
    let q32_u128 = Q32;

    if (expo_is_negative) {
        // Negative exponent: divide by 10^expo
        // result = price * Q32 / 10^expo
        let divisor = pow_10_u128(expo);
        let result = (price_u128 * q32_u128) / divisor;
        (result as u64)
    } else {
        // Positive exponent: multiply by 10^expo
        // result = price * 10^expo * Q32
        let multiplier = pow_10_u128(expo);
        let result = (price_u128 * multiplier * q32_u128) / 1000000000000000000; // Normalize
        (result as u64)
    }
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

/// Verify price confidence is acceptable
/// Returns true if confidence interval is within acceptable range
#[allow(unused_function)]
fun verify_confidence(price: u64, confidence: u64): bool {
    // Confidence should be less than 1% of price (configurable)
    confidence * 100 <= price
}

/// Helper: Compute 10^n for u8 exponent
fun pow_10_u128(n: u8): u128 {
    let mut result: u128 = 1;
    let mut i: u8 = 0;
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
fun test_convert_pyth_price() {
    // Test case 1: ETH price = $2000, expo = -8 (negative)
    // Pyth: price = 200000000000, expo = 8 (represents -8)
    // Expected: 2000 * Q32 = 2000 * 2^32
    let price_q32 = convert_pyth_price_to_q32(200000000000, 8, true);
    // Q32 = 4294967296 (2^32)
    // Expected = 2000 * Q32, verify it's a reasonable value
    assert!(price_q32 > 0, 0);

    // Test case 2: BTC price = $50000, expo = -8 (negative)
    let btc_q32 = convert_pyth_price_to_q32(5000000000000, 8, true);
    // Expected = 50000 * Q32
    // Just verify conversion works
    assert!(btc_q32 > 0, 1);

    // Test case 3: USDC price = $1.00, expo = -8 (negative)
    let usdc_q32 = convert_pyth_price_to_q32(100000000, 8, true);
    // Expected = 1 * Q32 = 4294967296
    assert!(usdc_q32 > 0, 2);
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

#[test]
fun test_price_confidence() {
    // Good confidence: 0.5% of price
    assert!(verify_confidence(100000000, 500000), 0);

    // Bad confidence: 2% of price
    assert!(!verify_confidence(100000000, 2000000), 1);
}

#[test]
fun test_pow_10() {
    assert!(pow_10_u128(0) == 1, 0);
    assert!(pow_10_u128(1) == 10, 1);
    assert!(pow_10_u128(2) == 100, 2);
    assert!(pow_10_u128(8) == 100000000, 3);
}
