# BrownFi Oracle Adapter for Sui

Independent oracle adapter package for BrownFi AMM, providing price feed integration for Sui Move.

## Overview

This package is **independently deployable and upgradable**, allowing oracle updates without redeploying the main AMM contracts.

### Features

- **Independent Deployment**: Deploy as standalone package
- **Upgradable**: Upgrade oracle logic without touching AMM
- **Pyth Network Integration**: Built-in Pyth price feed support
- **Pluggable Architecture**: Easy to add new oracle sources
- **Q32 Price Format**: Standardized fixed-point pricing (2^32 = 1.0, reduced from Q64 to prevent overflow)
- **Staleness Protection**: Configurable maximum price age
- **Type-Safe**: Per-token oracle configuration using Move's type system

## Package Structure

```
oracle-adapter-sui/
├── Move.toml
├── README.md
├── sources/
│   ├── oracle.move           # Main oracle adapter
│   └── pyth_adapter.move     # Pyth Network integration
└── tests/
    └── (test files)
```

## Installation

### As Dependency in Another Package

Add to your `Move.toml`:

```toml
[dependencies]
brownfi_oracle = { local = "../oracle-adapter-sui" }

# Or from git (after publishing)
# brownfi_oracle = { git = "https://github.com/BrownFi/oracle-adapter-sui", subdir = "", rev = "main" }

[addresses]
brownfi_oracle = "0x0"
```

### Standalone Deployment

```bash
cd oracle-adapter-sui
sui client publish --gas-budget 100000000
```

The `init()` function automatically creates and shares an `OracleAdapter` object.

## Usage

### 1. Deploy Oracle

```bash
# Publish the oracle package
sui client publish --gas-budget 100000000

# Note the OracleAdapter object ID from output
export ORACLE_ID=<object_id>
```

### 2. Configure Pyth State (Optional)

```bash
# Set Pyth state reference if using Pyth Network
sui client call \
  --package <ORACLE_PACKAGE_ID> \
  --module oracle \
  --function set_pyth_state \
  --args $ORACLE_ID <PYTH_STATE_ID>
```

### 3. Configure Token Price Feeds

```bash
# Configure ETH/USD
sui client call \
  --package <ORACLE_PACKAGE_ID> \
  --module oracle \
  --function configure_token \
  --args $ORACLE_ID \
    "pyth" \
    <PYTH_STATE_ID> \
    "0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace" \
  --type-args "0x2::sui::SUI"
```

### 4. Get Price in Your Contract

```move
use brownfi_oracle::oracle::{Self, OracleAdapter};
use sui::clock::Clock;

public fun my_function(
    oracle: &OracleAdapter,
    clock: &Clock
) {
    // Get price in Q32 format
    let price = oracle::get_price<MY_TOKEN>(
        oracle,
        clock,
        60 // max staleness in seconds
    );
    
    // Price is in Q32 format: 2^32 = 1.0
    // e.g., if price = 2^33, actual price = 2.0
}
```

## API Reference

### OracleAdapter

Main shared object that manages oracle configurations.

**Functions:**

- `init(ctx: &mut TxContext)` - Automatically called on package publish
- `get_price<T>(oracle: &OracleAdapter, clock: &Clock, max_price_age: u64): u64`
- `configure_token<T>(oracle: &mut OracleAdapter, source_type: vector<u8>, source_id: ID, feed_id: vector<u8>)`
- `set_pyth_state(oracle: &mut OracleAdapter, pyth_state_id: ID)`
- `has_config<T>(oracle: &OracleAdapter): bool`
- `id(oracle: &OracleAdapter): ID`

### Price Format

All prices use **Q32 fixed-point format** (reduced from Q64 to prevent overflow):

- Q32 = 2^32 = 4,294,967,296
- Price of 1.0 = Q32
- Price of 2.5 = Q32 * 2.5 = 10,737,418,240

**Conversion:**

```move
// Q32 to decimal
let decimal_price = (price as u128) / Q32;

// Decimal to Q32
let q32_price = (decimal as u128) * Q32;
```

## Pyth Network Integration

### Supported Price Feeds

```
ETH/USD:  0xff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace
BTC/USD:  0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43
USDC/USD: 0xeaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a
SOL/USD:  0xef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d
USDT/USD: 0x2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b
```

Find all feeds: https://pyth.network/developers/price-feed-ids

### Integration Steps

1. **Add Pyth Dependency** (future):
```toml
[dependencies]
Pyth = { git = "https://github.com/pyth-network/pyth-crosschain", subdir = "target_chains/sui/contracts", rev = "main" }
```

2. **Get Pyth State ID** from: https://docs.pyth.network/price-feeds/sui

3. **Configure Tokens** as shown above

## Upgrading the Oracle

### Deploy New Version

```bash
# Deploy new oracle package
sui client publish --gas-budget 100000000

# Get new OracleAdapter ID
export NEW_ORACLE_ID=<new_object_id>

# Configure new oracle
sui client call \
  --package <NEW_PACKAGE_ID> \
  --module oracle \
  --function configure_token \
  --args ...

# Update AMM to use new oracle
sui client call \
  --package <AMM_PACKAGE_ID> \
  --module admin \
  --function set_factory_oracle \
  --args <FACTORY_ID> <ADMIN_CAP_ID> $NEW_ORACLE_ID
```

### Rollback

Simply switch back to the previous oracle ID:

```bash
sui client call \
  --module admin \
  --function set_factory_oracle \
  --args <FACTORY_ID> <ADMIN_CAP_ID> <OLD_ORACLE_ID>
```

## Testing

### Run Tests

```bash
cd oracle-adapter-sui
sui move test
```

### Test in Development

Without Pyth integration, the oracle returns a default price of 1.0 (Q32) for unconfigured tokens.

## Security Considerations

1. **Price Staleness**: Always check price age
2. **Confidence Intervals**: Validate Pyth confidence (TODO: implement)
3. **Circuit Breakers**: Implement emergency pause on anomalies (TODO)
4. **Access Control**: Only authorized contracts should update prices
5. **Oracle Manipulation**: Use multiple oracle sources when possible

## Future Enhancements

- [ ] Complete Pyth integration with actual price fetching
- [ ] Add Switchboard oracle support
- [ ] Add Chainlink oracle support
- [ ] Implement TWAP (Time-Weighted Average Price)
- [ ] Add circuit breakers for price anomalies
- [ ] Add price caching to reduce oracle calls
- [ ] Multi-oracle aggregation and fallbacks

## Contributing

See main BrownFi repository for contribution guidelines.

## License

[Your License Here]

## Resources

- **Pyth Network**: https://pyth.network
- **Pyth Sui Docs**: https://docs.pyth.network/price-feeds/sui
- **Sui Move Book**: https://move-book.com
- **BrownFi AMM**: ../BrownFi-Move-Sui/

## Support

For issues and questions:
- GitHub Issues: [Your Repo]
- Discord: [Your Discord]
- Docs: [Your Docs]
