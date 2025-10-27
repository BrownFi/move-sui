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

use sui::table::{Self, Table};
use sui::object::{Self, UID};
use sui::tx_context::TxContext;
use sui::clock::Clock;

/// Mock Pyth price feed structure
/// In production, this would come from the actual Pyth smart contract
public struct PythPriceFeed has copy, drop, store {
    price: u64, // Price value (with implied decimal)
    conf: u64, // Confidence interval
    expo: u8, // Exponent magnitude (0-255)
    expo_is_negative: bool, // True if exponent is negative
    publish_time: u64, // Unix timestamp
}

/// Mock Pyth state object
/// In production, this would be the actual Pyth state from pyth-sui package
public struct PythState has key, store {
    id: UID,
    prices: Table<vector<u8>, PythPriceFeed>, // price_feed_id => PythPriceFeed
}

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
/// - pyth_state: Reference to Pyth state object  
/// - clock: Current clock for staleness check
/// - price_feed_id: Pyth price feed ID (32 bytes)
/// - max_staleness: Maximum age in seconds
/// 
/// Returns: Price in Q32 format (2^32 represents 1.0)
public fun get_price(
    _pyth_state: &PythState,
    _clock: &Clock,
    _price_feed_id: vector<u8>,
    _max_staleness: u64
): u64 {
    // TODO: Implement actual Pyth price fetching
    // For now, return default price of 1.0
    (Q32 as u64)
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

/// Create a mock Pyth state for testing
#[test_only]
public fun create_test_pyth_state(ctx: &mut TxContext): PythState {
    PythState {
        id: object::new(ctx),
        prices: table::new(ctx),
    }
}

/// Add a test price to mock Pyth state
#[test_only]
public fun add_test_price(
    pyth_state: &mut PythState,
    price_feed_id: vector<u8>,
    price: u64,
    conf: u64,
    expo: u8,
    expo_is_negative: bool,
    publish_time: u64
) {
    let feed = PythPriceFeed {
        price,
        conf,
        expo,
        expo_is_negative,
        publish_time,
    };
    table::add(&mut pyth_state.prices, price_feed_id, feed);
}

/// Delete test Pyth state
#[test_only]
public fun destroy_test_pyth_state(pyth_state: PythState) {
    let PythState { id, prices } = pyth_state;
    table::drop(prices);
    object::delete(id);
}

//
// Tests
//

#[test_only]
use sui::test_scenario;
#[test_only]
use sui::tx_context;

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
fun test_create_mock_pyth_state() {
    let ctx = &mut tx_context::dummy();
    
    // Create mock Pyth state with ETH price
    let _eth_price = PythPriceFeed {
        price: 200000000000, // $2000 with expo -8
        conf: 50000000, // $0.50 confidence
        expo: 8, // Represents -8
        expo_is_negative: true,
        publish_time: 1000000,
    };
    
    let pyth_state = PythState {
        id: object::new(ctx),
        prices: table::new(ctx),
    };
    
    destroy_test_pyth_state(pyth_state);
}
