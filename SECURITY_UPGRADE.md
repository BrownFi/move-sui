# Security Upgrade Summary - BrownFi AMM v2.0.1

## Overview
This document outlines the security upgrades made to the BrownFi AMM codebase in response to the Cetus Protocol hack (May 2025) which resulted in a $223M loss.

## Cetus Hack Analysis

### What Happened
- **Date**: May 22, 2025
- **Loss**: $223 million
- **Root Cause**: Integer overflow vulnerability in the `checked_shlw` function within `get_delta_a` liquidity calculation
- **Attack Vector**: 
  1. Attackers used flash loans to manipulate pool prices
  2. Created narrow range liquidity positions with extreme values
  3. Exploited flawed overflow checks to claim massive liquidity with minimal deposits
  4. Withdrew legitimate assets far exceeding their actual contributions

### Key Vulnerability Pattern
The hack exploited improper integer overflow checks during bit-shifting operations in math calculations, allowing truncation errors to pass validation when computing liquidity values.

## Security Upgrades Implemented

### 1. Framework Upgrade (Move.toml)
**Changed:**
- `rev = "framework/testnet"` → `rev = "framework/mainnet"`
- `version = "2.0.0"` → `version = "2.0.1"`

**Impact:** Using testnet framework in production is a critical security risk. Mainnet framework includes production-grade security patches and stability improvements.

### 2. Math Module Hardening (math.move)

#### Added Security Constants
```move
const EOverflow: u64 = 0;
const EDivisionByZero: u64 = 1;
const MAX_U64: u128 = 18446744073709551615;
```

#### Enhanced Functions with Explicit Overflow Checks

**mul_div():**
- Added division by zero check
- Added explicit overflow validation before u128 to u64 cast
- Prevents silent truncation similar to Cetus vulnerability

**ceil_mul_div():**
- Added division by zero check
- Added overflow validation on result
- Protects against extreme value manipulation

**mul_sqrt():**
- Added overflow check after square root calculation
- Prevents overflow in liquidity initialization calculations

**ceil_div_u128():**
- Added division by zero check
- Ensures safe division operations

### 3. Pool Operation Protections (implements.move)

#### New Security Constants
```move
const EPoolBalanceTooLarge: u64 = 5;
const ELiquidityTooLarge: u64 = 6;
const MAX_POOL_BALANCE: u64 = 1_000_000_000_000_000_000; // 1e18
const MIN_LIQUIDITY: u64 = 1000;
```

#### create_pool() Enhancements
- Validates initial balances don't exceed MAX_POOL_BALANCE
- Ensures minimum liquidity requirement (MIN_LIQUIDITY) to prevent precision attacks
- Prevents pool creation with extreme values

#### add_liquidity() Enhancements
- Pre-validates existing pool balances
- Checks that new deposits won't exceed MAX_POOL_BALANCE
- Uses cached balance values to prevent TOCTOU (Time-of-check-time-of-use) issues
- Validates liquidity to be issued is non-zero
- Comprehensive bounds checking before any state changes

## Security Improvements Summary

| Area | Before | After | Impact |
|------|--------|-------|---------|
| Framework | Testnet | Mainnet | Production-ready security |
| Overflow Checks | Implicit (may abort) | Explicit with error codes | Predictable failure modes |
| Division Checks | None | Explicit validation | Prevents division by zero |
| Balance Limits | None | MAX_POOL_BALANCE (1e18) | Prevents extreme value attacks |
| Liquidity Minimum | None | MIN_LIQUIDITY (1000) | Prevents precision attacks |
| Cast Safety | Relies on Move runtime | Explicit pre-cast validation | Clear error messages |

## Testing Recommendations

### Required Tests
1. **Overflow Tests**: Attempt operations that would exceed u64::MAX
2. **Extreme Value Tests**: Try creating pools/adding liquidity with values near MAX_POOL_BALANCE
3. **Minimum Liquidity Tests**: Verify pools cannot be created with tiny amounts
4. **Division by Zero Tests**: Ensure all division operations are protected
5. **Flash Loan Simulation**: Test resistance to rapid price manipulation

### Test Execution
```bash
# Install Sui CLI if not present
cargo install --locked --git https://github.com/MystenLabs/sui.git --branch mainnet sui

# Run tests
sui move test

# Build for production
sui move build
```

## Remaining Security Considerations

### 1. Price Oracle Integration
- Consider integrating external price oracles to detect manipulation
- Implement TWAP (Time-Weighted Average Price) for critical operations

### 2. Flash Loan Protections
- Consider implementing flash loan detection
- Add cooldown periods for large liquidity changes

### 3. Circuit Breakers
- Implement emergency pause functionality for detected anomalies
- Add rate limiting for large transactions

### 4. Additional Auditing
- Recommend third-party security audit before mainnet deployment
- Consider formal verification of critical math operations
- Implement comprehensive monitoring and alerting

## Migration Guide

### For Existing Deployments
1. **Backup**: Ensure all pool states are backed up
2. **Testing**: Deploy to testnet and run full test suite
3. **Gradual Rollout**: Consider deploying to small pools first
4. **Monitoring**: Implement comprehensive logging for the first 24-48 hours

### Breaking Changes
- None - All changes are backwards compatible with existing pool structures
- Existing pools will benefit from new validations on future operations

## References
- [Cetus Hack Analysis - Merkle Science](https://www.merklescience.com/blog/hack-track-how-a-shared-library-bug-triggered-the-223m-cetus-hack)
- [SlowMist Analysis](https://slowmist.medium.com/slowmist-analysis-of-the-230-million-cetus-hack)
- [Halborn Security Report](https://www.halborn.com/blog/post/explained-the-cetus-hack-may-2025)
- [Sui Framework Documentation](https://docs.sui.io/references/framework)

## Version History
- **v2.0.1** (2025-10-25): Security hardening addressing Cetus-like vulnerabilities
- **v2.0.0**: Original v2 implementation

---

**Security Status**: ✅ Enhanced  
**Audit Status**: ⚠️ Requires third-party audit before mainnet deployment  
**Test Coverage**: Existing tests pass, additional security tests recommended
