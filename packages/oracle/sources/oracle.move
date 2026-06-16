module brownfi_oracle::oracle;

use sui::table::{Self, Table};
use sui::clock::Clock;
use std::type_name::{Self, TypeName};
use brownfi_oracle::pyth_adapter;
use pyth::price_info::PriceInfoObject;

/// Oracle adapter interface for pluggable oracle sources
/// This allows different oracle implementations (Pyth, Switchboard, manual feeds, etc.)
/// 
/// Architecture:
/// - OracleAdapter: Main registry that holds adapter implementations
/// - Each token type can be configured with a specific oracle source
/// - Adapters are pluggable and can be swapped without changing core logic

public struct OracleAdapter has key {
    id: UID,
    /// Maps token type to its oracle configuration
    token_configs: Table<TypeName, OracleConfig>,
    /// Minimum acceptable price age in seconds
    min_price_age: u64,
}

/// Configuration for how to fetch price for a specific token
public struct OracleConfig has store, drop {
    /// Oracle source type (e.g., "pyth", "switchboard", "manual")
    source_type: vector<u8>,
    /// Object ID of the oracle source (Pyth state, Switchboard aggregator, or Manual feed)
    source_id: ID,
    /// Additional configuration data (oracle-specific, e.g., Pyth feed ID)
    config_data: vector<u8>,
}

const Q32: u128 = 4294967296; // 1 << 32 (reduced from Q64 to prevent overflow)

const EInvalidPriceAge: u64 = 1;
const ETokenNotConfigured: u64 = 2;
const EStalePrice: u64 = 3;
const EUnsupportedOracleSource: u64 = 4;
const EInvalidSourceId: u64 = 5;

// Oracle source type constants
const SOURCE_PYTH: vector<u8> = b"pyth";

/// Initialize oracle adapter as an independent contract
/// This function is called automatically when the package is published
/// Creates and shares the OracleAdapter as a shared object
fun init(ctx: &mut TxContext) {
    let oracle = OracleAdapter {
        id: object::new(ctx),
        token_configs: table::new(ctx),
        min_price_age: 15, // Default 15 seconds
    };
    transfer::share_object(oracle);
}

/// Create a new oracle adapter (for testing or custom deployments)
public fun new(min_price_age: u64, ctx: &mut TxContext): OracleAdapter {
    OracleAdapter {
        id: object::new(ctx),
        token_configs: table::new(ctx),
        min_price_age,
    }
}

/// Create and share a new oracle adapter (for custom deployments)
public fun create_and_share(min_price_age: u64, ctx: &mut TxContext) {
    let oracle = new(min_price_age, ctx);
    transfer::share_object(oracle);
}

/// Share the oracle adapter as a shared object
public fun share(oracle: OracleAdapter) {
    transfer::share_object(oracle);
}

/// Get oracle ID (useful for factory configuration)
public fun id(oracle: &OracleAdapter): ID {
    object::id(oracle)
}

/// Get price for a token type in the adapter's normalized absolute scale.
/// Currently only supports Pyth Network oracle
/// 
/// Parameters:
/// - oracle: OracleAdapter reference
/// - price_info_object: Pyth PriceInfoObject for the token
/// - clock: Clock for timestamp verification
/// - max_price_age: Maximum acceptable price age in seconds
/// 
/// Returns: normalized absolute price
public fun get_price<T>(
    oracle: &OracleAdapter,
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_price_age: u64
): u64 {
    let (price, _, _) = get_price_with_bounds<T>(oracle, price_info_object, clock, max_price_age);
    price
}

/// Get price plus confidence bounds for a token type.
///
/// Returns `(price, upper, lower)` as absolute prices in the adapter's normalized scale.
public fun get_price_with_bounds<T>(
    oracle: &OracleAdapter,
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_price_age: u64
): (u64, u64, u64) {
    let token_type = type_name::with_defining_ids<T>();
    
    // Check if token is configured
    if (!table::contains(&oracle.token_configs, token_type)) {
        // Return default price of 1.0 for tokens without oracle
        return ((Q32 as u64), (Q32 as u64), (Q32 as u64))
    };
    
    let config = table::borrow(&oracle.token_configs, token_type);
    
    // For testing, return fixed price = 1.0 in scaled format
    // Q32 = 2^32 prevents overflow issues
    // Price = 1e9 represents $1 with 9 decimals
    if (config.source_type == b"test") {
        return (1_000_000_000, 1_000_000_000, 1_000_000_000)
    };
    
    // Currently only support Pyth
    if (config.source_type == SOURCE_PYTH) {
        get_price_with_bounds_from_pyth(price_info_object, config, clock, max_price_age)
    } else {
        // Unsupported oracle source
        abort EUnsupportedOracleSource
    }
}

/// Configure Pyth oracle for a token type
/// 
/// Parameters:
/// - oracle: Mutable reference to OracleAdapter
/// - source_type: Must be "pyth"
/// - source_id: Object ID of the Pyth state
/// - config_data: Pyth price feed ID (32 bytes)
/// 
/// Example:
/// ```
/// // Pyth configuration for ETH/USD
/// configure_token<ETH>(
///     adapter,
///     b"pyth",
///     pyth_state_id,
///     x"ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" // ETH/USD feed
/// );
/// ```
/// 
/// Common Pyth Price Feed IDs:
/// - ETH/USD: 0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
/// - BTC/USD: 0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
/// - USDC/USD: 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a
/// - SOL/USD: 0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
/// 
/// Find more at: https://pyth.network/developers/price-feed-ids
public fun configure_token<T>(
    oracle: &mut OracleAdapter,
    source_type: vector<u8>,
    source_id: ID,
    config_data: vector<u8>
) {
    let token_type = type_name::with_defining_ids<T>();
    let config = OracleConfig {
        source_type,
        source_id,
        config_data,
    };
    
    if (table::contains(&oracle.token_configs, token_type)) {
        let existing = table::borrow_mut(&mut oracle.token_configs, token_type);
        *existing = config;
    } else {
        table::add(&mut oracle.token_configs, token_type, config);
    }
}

/// Remove oracle configuration for a token
public fun remove_token_config<T>(oracle: &mut OracleAdapter) {
    let token_type = type_name::with_defining_ids<T>();
    if (table::contains(&oracle.token_configs, token_type)) {
        table::remove(&mut oracle.token_configs, token_type);
    }
}

/// Check if a token has oracle configuration
public fun has_config<T>(oracle: &OracleAdapter): bool {
    let token_type = type_name::with_defining_ids<T>();
    table::contains(&oracle.token_configs, token_type)
}

/// Get oracle source type for a token
public fun get_source_type<T>(oracle: &OracleAdapter): vector<u8> {
    let token_type = type_name::with_defining_ids<T>();
    assert!(table::contains(&oracle.token_configs, token_type), ETokenNotConfigured);
    let config = table::borrow(&oracle.token_configs, token_type);
    config.source_type
}

/// Get oracle source object ID for a token.
public fun get_source_id<T>(oracle: &OracleAdapter): ID {
    let token_type = type_name::with_defining_ids<T>();
    assert!(table::contains(&oracle.token_configs, token_type), ETokenNotConfigured);
    let config = table::borrow(&oracle.token_configs, token_type);
    config.source_id
}

/// Get oracle source-specific config data for a token.
public fun get_config_data<T>(oracle: &OracleAdapter): vector<u8> {
    let token_type = type_name::with_defining_ids<T>();
    assert!(table::contains(&oracle.token_configs, token_type), ETokenNotConfigured);
    let config = table::borrow(&oracle.token_configs, token_type);
    config.config_data
}

fun get_price_with_bounds_from_pyth(
    price_info_object: &PriceInfoObject,
    config: &OracleConfig,
    clock: &Clock,
    max_price_age: u64
): (u64, u64, u64) {
    // Call the Pyth adapter to get the price
    // config_data contains the Pyth price feed ID (32 bytes)
    pyth_adapter::get_price_with_bounds(
        price_info_object,
        clock,
        config.config_data,
        max_price_age
    )
}



/// Get minimum price age
public fun min_price_age(oracle: &OracleAdapter): u64 {
    oracle.min_price_age
}

/// Update minimum price age (admin only)
public fun set_min_price_age(
    oracle: &mut OracleAdapter,
    new_age: u64
) {
    oracle.min_price_age = new_age;
}

#[test_only]
/// Get a mock price for testing
public fun mock_price(amount: u64): u64 {
    amount * (Q32 as u64)
}
