# BrownFi V3 Sui MVP Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the current CPMM-like Sui implementation with a Pyth-only BrownFi v3 MVP that preserves the v3 economic model, explicit rounding, gamma cutoff, protocol LP fee minting, and value-based liquidity.

**Architecture:** Keep the existing `Pool<A, B>` shared-object model, but expand pool config and move swap pricing to an oracle-priced BrownFi v3 path. Add a small math layer with explicit rounding direction and a local oracle-gateway module that computes Pyth-only adjusted, sell, and buy prices.

**Tech Stack:** Sui Move, Sui framework balances/coins, Pyth `PriceInfoObject`, existing Move unit tests.

---

### Task 1: Explicit Math Primitives

**Files:**
- Modify: `sources/math.move`
- Test: `tests/math_v3_test.move`

- [ ] **Step 1: Write failing tests**

Create tests for `mul_div_down_u128`, `mul_div_up_u128`, `mul_div_down_to_u64`, and `mul_div_up_to_u64`. Include exact division, inexact division, zero numerator, and u64 downcast.

- [ ] **Step 2: Run the tests**

Run: `sui move test math_v3`
Expected: fail because the functions do not exist.

- [ ] **Step 3: Implement math helpers**

Add explicit rounding helpers to `sources/math.move`. Preserve existing helpers for compatibility, but make new v3 code call only the explicit helpers.

- [ ] **Step 4: Run tests**

Run: `sui move test math_v3`
Expected: pass.

### Task 2: V3 Pool Config

**Files:**
- Modify: `sources/pool.move`
- Modify: `sources/admin.move`
- Test: `tests/v3_config_test.move`

- [ ] **Step 1: Write failing config tests**

Test default v3 config fields, lambda/kappa constraint, buy-price constraint, gamma bounds, and fee split bounds.

- [ ] **Step 2: Run the tests**

Run: `sui move test v3_config`
Expected: fail because the config fields and validators do not exist.

- [ ] **Step 3: Add config fields and validators**

Extend `Pool<A, B>` with `quote_token_index`, `k_b`, `k_q`, `lambda`, `fee`, `fee_split`, `gamma`, `compress`, `s_sell`, `s_buy`, `fix_s`, `dis_threshold`, `s_bound`, and `pyth_weight`.

- [ ] **Step 4: Run tests**

Run: `sui move test v3_config`
Expected: pass.

### Task 3: Pyth-Only Oracle Gateway

**Files:**
- Create: `sources/oracle_gateway.move`
- Modify: `sources/events.move`
- Test: `tests/v3_oracle_gateway_test.move`

- [ ] **Step 1: Write failing oracle gateway tests**

Test that base/quote Pyth prices produce an adjusted base-in-quote price, sell price, and buy price with configured fixed and side spreads.

- [ ] **Step 2: Run the tests**

Run: `sui move test v3_oracle_gateway`
Expected: fail because `oracle_gateway` does not exist.

- [ ] **Step 3: Implement Pyth-only gateway**

Add a gateway API that returns `(pyth_base_price, pyth_quote_price, adj_price, sell_price, buy_price)` using existing oracle adapter calls. Set AMM relative price behavior to neutral for MVP.

- [ ] **Step 4: Run tests**

Run: `sui move test v3_oracle_gateway`
Expected: pass.

### Task 4: V3 Swap Path

**Files:**
- Modify: `sources/swap.move`
- Test: `tests/v3_swap_test.move`

- [ ] **Step 1: Write failing swap tests**

Test both directions, quote-token-index handling, fee deduction, gamma cutoff, inventory verification, and conservative rounding.

- [ ] **Step 2: Run the tests**

Run: `sui move test v3_swap`
Expected: fail because swap still uses CPMM output.

- [ ] **Step 3: Implement v3 swap**

Compute no-fee input, derive oracle-priced output, apply gamma cutoff, deposit input, verify inventory with side-specific kappa, mint protocol LP if configured, and withdraw clamped output.

- [ ] **Step 4: Run tests**

Run: `sui move test v3_swap`
Expected: pass.

### Task 5: V3 Liquidity and Protocol Fee

**Files:**
- Modify: `sources/swap.move`
- Test: `tests/v3_liquidity_test.move`

- [ ] **Step 1: Write failing liquidity tests**

Test first mint, value-balanced add liquidity, excess return, burn while paused if that remains the policy, and protocol LP mint transfer to `fee_to`.

- [ ] **Step 2: Run the tests**

Run: `sui move test v3_liquidity`
Expected: fail where current geometric/proportional logic differs and protocol fee LP is destroyed.

- [ ] **Step 3: Implement liquidity changes**

Replace current add-liquidity math with v3 value-based minting and transfer protocol LP coins to `fee_to` instead of destroying them.

- [ ] **Step 4: Run tests**

Run: `sui move test v3_liquidity`
Expected: pass.

### Task 6: Full Verification

**Files:**
- Modify tests only if failures reveal wrong expectations.

- [ ] **Step 1: Run full tests**

Run: `sui move test`
Expected: all tests pass.

- [ ] **Step 2: Review implementation parity gaps**

Confirm known MVP gaps remain explicit: no external AMM relative price blending, no multi-oracle quorum, no TWAP/TWAL, no flash callback.
