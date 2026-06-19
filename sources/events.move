module brownfi_amm::events;

use std::type_name::TypeName;

const SWAP_DIRECTION_SELL: u8 = 0;
const SWAP_DIRECTION_BUY: u8 = 1;
const POOL_GATE_SWAP: u8 = 0;
const POOL_GATE_ADD_LIQUIDITY: u8 = 1;
const POOL_GATE_FLASH: u8 = 2;

public struct PoolCreated has copy, drop {
    pool_id: ID,
    a: TypeName,
    b: TypeName,
    init_a: u64,
    init_b: u64,
    lp_minted: u64,
}

public struct AddLiquidity has copy, drop {
    pool_id: ID,
    a: TypeName,
    b: TypeName,
    amount_in_a: u64,
    amount_in_b: u64,
    lp_minted: u64,
    pyth_price_a: u64,
    pyth_price_b: u64,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    oracle_source_count: u8,
    amm_source_count: u8,
}

public struct RemoveLiquidity has copy, drop {
    pool_id: ID,
    a: TypeName,
    b: TypeName,
    amount_out_a: u64,
    amount_out_b: u64,
    lp_burnt: u64,
}

public struct Sync has copy, drop {
    pool_id: ID,
    reserve_a: u64,
    reserve_b: u64,
}

public struct Swap has copy, drop {
    pool_id: ID,
    token_in: TypeName,
    amount_in: u64,
    token_out: TypeName,
    amount_out: u64,
    /// Skewness-adjusted price for token A.
    price_a: u64,
    /// Skewness-adjusted price for token B.
    price_b: u64,
}

public struct PriceBundleUsed has copy, drop {
    pool_id: ID,
    token_in: TypeName,
    token_out: TypeName,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
    pyth_price_a: u64,
    pyth_price_b: u64,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    adj_price: u64,
    sell_price: u64,
    buy_price: u64,
    pre_trade_price: u64,
    oracle_source_count: u8,
    amm_source_count: u8,
}

public struct SwapExecuted has copy, drop {
    pool_id: ID,
    direction: u8,
    token_in: TypeName,
    token_out: TypeName,
    actual_input: u64,
    pseudo_input: u64,
    raw_output: u64,
    cutoff_output: u64,
    final_output: u64,
    fee_amount: u64,
    protocol_lp_minted: u64,
    adj_rel_q: u64,
    sell_price_q: u64,
    buy_price_q: u64,
    oracle_source_count: u8,
    amm_source_count: u8,
    o_spread: u64,
}

public struct FlashBorrowed has copy, drop {
    pool_id: ID,
    token: TypeName,
    direction: u8,
    borrowed_amount: u64,
    amount_due: u64,
    fee_amount: u64,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
}

public struct FlashRepaid has copy, drop {
    pool_id: ID,
    token: TypeName,
    direction: u8,
    amount_repaid: u64,
    fee_amount: u64,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
}

public struct ProtocolLpAccrued has copy, drop {
    pool_id: ID,
    fee_to: address,
    lp_minted: u64,
    pool_value: u128,
}

public struct ProtocolLpClaimed has copy, drop {
    pool_id: ID,
    fee_to: address,
    lp_claimed: u64,
}

public struct ConfigUpdated has copy, drop {
    pool_id: ID,
    parameter: vector<u8>,
    values: vector<u128>,
}

public struct OraclePolicyUpdated has copy, drop {
    pool_id: ID,
    policy_version: u64,
    parameter: vector<u8>,
    values: vector<u128>,
}

public struct AmmPolicyUpdated has copy, drop {
    pool_id: ID,
    policy_version: u64,
    parameter: vector<u8>,
    values: vector<u128>,
}

public struct OracleQuorumUsed has copy, drop {
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
    mode: u8,
    primary_source: u8,
    source_mask: u64,
    source_count: u8,
    required_source_mask: u64,
    min_sources: u8,
    relative_price_q32: u64,
    valid_until_ms: u64,
}

public struct AmmTwapUsed has copy, drop {
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
    source_mask: u64,
    source_count: u8,
    aggregate_relative_price_q32: u64,
    oracle_relative_price_q32: u64,
    adjusted_relative_price_q32: u64,
    o_spread: u64,
    total_liquidity_quote: u256,
    min_window_seconds: u64,
    max_window_seconds: u64,
    valid_until_ms: u64,
}

public struct PoolParametersUpdated has copy, drop {
    pool_id: ID,
    parameter: vector<u8>,
    new_value: u64,
}

public struct PauseStateChanged has copy, drop {
    paused: bool,
}

public struct PoolGateStateChanged has copy, drop {
    pool_id: ID,
    gate: u8,
    enabled: bool,
}

public struct FeeToUpdated has copy, drop {
    new_fee_to: address,
}

public struct OracleUpdated has copy, drop {
    new_oracle: ID,
}

public fun swap_direction_sell(): u8 {
    SWAP_DIRECTION_SELL
}

public fun swap_direction_buy(): u8 {
    SWAP_DIRECTION_BUY
}

public fun pool_gate_swap(): u8 {
    POOL_GATE_SWAP
}

public fun pool_gate_add_liquidity(): u8 {
    POOL_GATE_ADD_LIQUIDITY
}

public fun pool_gate_flash(): u8 {
    POOL_GATE_FLASH
}

public fun emit_pool_created(
    pool_id: ID,
    a: TypeName,
    b: TypeName,
    init_a: u64,
    init_b: u64,
    lp_minted: u64
) {
    sui::event::emit(PoolCreated {
        pool_id,
        a,
        b,
        init_a,
        init_b,
        lp_minted
    });
}

public fun emit_add_liquidity(
    pool_id: ID,
    a: TypeName,
    b: TypeName,
    amount_in_a: u64,
    amount_in_b: u64,
    lp_minted: u64,
    pyth_price_a: u64,
    pyth_price_b: u64,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    oracle_source_count: u8,
    amm_source_count: u8
) {
    sui::event::emit(AddLiquidity {
        pool_id,
        a,
        b,
        amount_in_a,
        amount_in_b,
        lp_minted,
        pyth_price_a,
        pyth_price_b,
        oracle_relative_price,
        amm_relative_price,
        oracle_source_count,
        amm_source_count
    });
}

public fun emit_remove_liquidity(
    pool_id: ID,
    a: TypeName,
    b: TypeName,
    amount_out_a: u64,
    amount_out_b: u64,
    lp_burnt: u64
) {
    sui::event::emit(RemoveLiquidity {
        pool_id,
        a,
        b,
        amount_out_a,
        amount_out_b,
        lp_burnt
    });
}

public fun emit_sync(
    pool_id: ID,
    reserve_a: u64,
    reserve_b: u64
) {
    sui::event::emit(Sync {
        pool_id,
        reserve_a,
        reserve_b
    });
}

public fun emit_swap(
    pool_id: ID,
    token_in: TypeName,
    amount_in: u64,
    token_out: TypeName,
    amount_out: u64,
    price_a: u64,
    price_b: u64
) {
    sui::event::emit(Swap {
        pool_id,
        token_in,
        amount_in,
        token_out,
        amount_out,
        price_a,
        price_b
    });
}

public fun emit_swap_executed(
    pool_id: ID,
    direction: u8,
    token_in: TypeName,
    token_out: TypeName,
    actual_input: u64,
    pseudo_input: u64,
    raw_output: u64,
    cutoff_output: u64,
    final_output: u64,
    fee_amount: u64,
    protocol_lp_minted: u64,
    adj_rel_q: u64,
    sell_price_q: u64,
    buy_price_q: u64,
    oracle_source_count: u8,
    amm_source_count: u8,
    o_spread: u64
) {
    sui::event::emit(SwapExecuted {
        pool_id,
        direction,
        token_in,
        token_out,
        actual_input,
        pseudo_input,
        raw_output,
        cutoff_output,
        final_output,
        fee_amount,
        protocol_lp_minted,
        adj_rel_q,
        sell_price_q,
        buy_price_q,
        oracle_source_count,
        amm_source_count,
        o_spread
    });
}

public fun emit_price_bundle_used(
    pool_id: ID,
    token_in: TypeName,
    token_out: TypeName,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
    pyth_price_a: u64,
    pyth_price_b: u64,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    adj_price: u64,
    sell_price: u64,
    buy_price: u64,
    pre_trade_price: u64,
    oracle_source_count: u8,
    amm_source_count: u8
) {
    sui::event::emit(PriceBundleUsed {
        pool_id,
        token_in,
        token_out,
        policy_version,
        policy_digest,
        price_digest,
        pyth_price_a,
        pyth_price_b,
        oracle_relative_price,
        amm_relative_price,
        adj_price,
        sell_price,
        buy_price,
        pre_trade_price,
        oracle_source_count,
        amm_source_count
    });
}

public fun emit_flash_borrowed(
    pool_id: ID,
    token: TypeName,
    direction: u8,
    borrowed_amount: u64,
    amount_due: u64,
    fee_amount: u64,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>
) {
    sui::event::emit(FlashBorrowed {
        pool_id,
        token,
        direction,
        borrowed_amount,
        amount_due,
        fee_amount,
        policy_version,
        policy_digest,
        price_digest
    });
}

public fun emit_flash_repaid(
    pool_id: ID,
    token: TypeName,
    direction: u8,
    amount_repaid: u64,
    fee_amount: u64,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>
) {
    sui::event::emit(FlashRepaid {
        pool_id,
        token,
        direction,
        amount_repaid,
        fee_amount,
        policy_version,
        policy_digest,
        price_digest
    });
}

public fun emit_protocol_lp_accrued(
    pool_id: ID,
    fee_to: address,
    lp_minted: u64,
    pool_value: u128
) {
    sui::event::emit(ProtocolLpAccrued {
        pool_id,
        fee_to,
        lp_minted,
        pool_value
    });
}

public fun emit_protocol_lp_claimed(
    pool_id: ID,
    fee_to: address,
    lp_claimed: u64
) {
    sui::event::emit(ProtocolLpClaimed {
        pool_id,
        fee_to,
        lp_claimed
    });
}

public fun emit_config_updated(
    pool_id: ID,
    parameter: vector<u8>,
    values: vector<u128>
) {
    sui::event::emit(ConfigUpdated {
        pool_id,
        parameter,
        values
    });
}

public fun emit_oracle_policy_updated(
    pool_id: ID,
    policy_version: u64,
    parameter: vector<u8>,
    values: vector<u128>
) {
    sui::event::emit(OraclePolicyUpdated {
        pool_id,
        policy_version,
        parameter,
        values
    });
}

public fun emit_amm_policy_updated(
    pool_id: ID,
    policy_version: u64,
    parameter: vector<u8>,
    values: vector<u128>
) {
    sui::event::emit(AmmPolicyUpdated {
        pool_id,
        policy_version,
        parameter,
        values
    });
}

public fun emit_oracle_quorum_used(
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
    mode: u8,
    primary_source: u8,
    source_mask: u64,
    source_count: u8,
    required_source_mask: u64,
    min_sources: u8,
    relative_price_q32: u64,
    valid_until_ms: u64
) {
    sui::event::emit(OracleQuorumUsed {
        pool_id,
        policy_version,
        policy_digest,
        price_digest,
        mode,
        primary_source,
        source_mask,
        source_count,
        required_source_mask,
        min_sources,
        relative_price_q32,
        valid_until_ms
    });
}

public fun emit_amm_twap_used(
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
    source_mask: u64,
    source_count: u8,
    aggregate_relative_price_q32: u64,
    oracle_relative_price_q32: u64,
    adjusted_relative_price_q32: u64,
    o_spread: u64,
    total_liquidity_quote: u256,
    min_window_seconds: u64,
    max_window_seconds: u64,
    valid_until_ms: u64
) {
    sui::event::emit(AmmTwapUsed {
        pool_id,
        policy_version,
        policy_digest,
        price_digest,
        source_mask,
        source_count,
        aggregate_relative_price_q32,
        oracle_relative_price_q32,
        adjusted_relative_price_q32,
        o_spread,
        total_liquidity_quote,
        min_window_seconds,
        max_window_seconds,
        valid_until_ms
    });
}

public fun emit_pool_parameters_updated(
    pool_id: ID,
    parameter: vector<u8>,
    new_value: u64
) {
    sui::event::emit(PoolParametersUpdated {
        pool_id,
        parameter,
        new_value
    });
}

public fun emit_pause_state_changed(paused: bool) {
    sui::event::emit(PauseStateChanged { paused });
}

public fun emit_pool_gate_state_changed(
    pool_id: ID,
    gate: u8,
    enabled: bool
) {
    sui::event::emit(PoolGateStateChanged {
        pool_id,
        gate,
        enabled
    });
}

public fun emit_fee_to_updated(new_fee_to: address) {
    sui::event::emit(FeeToUpdated { new_fee_to });
}

public fun emit_oracle_updated(new_oracle: ID) {
    sui::event::emit(OracleUpdated { new_oracle });
}

#[test_only]
public fun assert_sync_for_testing(
    event: Sync,
    pool_id: ID,
    reserve_a: u64,
    reserve_b: u64
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.reserve_a == reserve_a, 1);
    assert!(event.reserve_b == reserve_b, 2);
}

#[test_only]
public fun assert_add_liquidity_for_testing(
    event: AddLiquidity,
    pool_id: ID,
    a: TypeName,
    b: TypeName,
    amount_in_a: u64,
    amount_in_b: u64,
    lp_minted: u64,
    pyth_price_a: u64,
    pyth_price_b: u64,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    oracle_source_count: u8,
    amm_source_count: u8
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.a == a, 1);
    assert!(event.b == b, 2);
    assert!(event.amount_in_a == amount_in_a, 3);
    assert!(event.amount_in_b == amount_in_b, 4);
    assert!(event.lp_minted == lp_minted, 5);
    assert!(event.pyth_price_a == pyth_price_a, 6);
    assert!(event.pyth_price_b == pyth_price_b, 7);
    assert!(event.oracle_relative_price == oracle_relative_price, 8);
    assert!(event.amm_relative_price == amm_relative_price, 9);
    assert!(event.oracle_source_count == oracle_source_count, 10);
    assert!(event.amm_source_count == amm_source_count, 11);
}

#[test_only]
public fun assert_price_bundle_used_for_testing(
    event: PriceBundleUsed,
    pool_id: ID,
    token_in: TypeName,
    token_out: TypeName,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
    pyth_price_a: u64,
    pyth_price_b: u64,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    adj_price: u64,
    sell_price: u64,
    buy_price: u64,
    pre_trade_price: u64,
    oracle_source_count: u8,
    amm_source_count: u8
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.token_in == token_in, 1);
    assert!(event.token_out == token_out, 2);
    assert!(event.policy_version == policy_version, 3);
    assert!(event.policy_digest == policy_digest, 4);
    assert!(event.price_digest == price_digest, 5);
    assert!(event.pyth_price_a == pyth_price_a, 6);
    assert!(event.pyth_price_b == pyth_price_b, 7);
    assert!(event.oracle_relative_price == oracle_relative_price, 8);
    assert!(event.amm_relative_price == amm_relative_price, 9);
    assert!(event.adj_price == adj_price, 10);
    assert!(event.sell_price == sell_price, 11);
    assert!(event.buy_price == buy_price, 12);
    assert!(event.pre_trade_price == pre_trade_price, 13);
    assert!(event.oracle_source_count == oracle_source_count, 14);
    assert!(event.amm_source_count == amm_source_count, 15);
}

#[test_only]
public fun assert_swap_executed_for_testing(
    event: SwapExecuted,
    pool_id: ID,
    direction: u8,
    token_in: TypeName,
    token_out: TypeName,
    actual_input: u64,
    pseudo_input: u64,
    raw_output: u64,
    cutoff_output: u64,
    final_output: u64,
    fee_amount: u64,
    protocol_lp_minted: u64,
    adj_rel_q: u64,
    sell_price_q: u64,
    buy_price_q: u64,
    oracle_source_count: u8,
    amm_source_count: u8,
    o_spread: u64
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.direction == direction, 1);
    assert!(event.token_in == token_in, 2);
    assert!(event.token_out == token_out, 3);
    assert!(event.actual_input == actual_input, 4);
    assert!(event.pseudo_input == pseudo_input, 5);
    assert!(event.raw_output == raw_output, 6);
    assert!(event.cutoff_output == cutoff_output, 7);
    assert!(event.final_output == final_output, 8);
    assert!(event.fee_amount == fee_amount, 9);
    assert!(event.protocol_lp_minted == protocol_lp_minted, 10);
    assert!(event.adj_rel_q == adj_rel_q, 11);
    assert!(event.sell_price_q == sell_price_q, 12);
    assert!(event.buy_price_q == buy_price_q, 13);
    assert!(event.oracle_source_count == oracle_source_count, 14);
    assert!(event.amm_source_count == amm_source_count, 15);
    assert!(event.o_spread == o_spread, 16);
}

#[test_only]
public fun assert_flash_borrowed_for_testing(
    event: FlashBorrowed,
    pool_id: ID,
    token: TypeName,
    direction: u8,
    borrowed_amount: u64,
    amount_due: u64,
    fee_amount: u64,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.token == token, 1);
    assert!(event.direction == direction, 2);
    assert!(event.borrowed_amount == borrowed_amount, 3);
    assert!(event.amount_due == amount_due, 4);
    assert!(event.fee_amount == fee_amount, 5);
    assert!(event.policy_version == policy_version, 6);
    assert!(event.policy_digest == policy_digest, 7);
    assert!(event.price_digest == price_digest, 8);
}

#[test_only]
public fun assert_flash_repaid_for_testing(
    event: FlashRepaid,
    pool_id: ID,
    token: TypeName,
    direction: u8,
    amount_repaid: u64,
    fee_amount: u64,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.token == token, 1);
    assert!(event.direction == direction, 2);
    assert!(event.amount_repaid == amount_repaid, 3);
    assert!(event.fee_amount == fee_amount, 4);
    assert!(event.policy_version == policy_version, 5);
    assert!(event.policy_digest == policy_digest, 6);
    assert!(event.price_digest == price_digest, 7);
}

#[test_only]
public fun assert_protocol_lp_accrued_for_testing(
    event: ProtocolLpAccrued,
    pool_id: ID,
    fee_to: address,
    lp_minted: u64,
    pool_value: u128
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.fee_to == fee_to, 1);
    assert!(event.lp_minted == lp_minted, 2);
    assert!(event.pool_value == pool_value, 3);
}

#[test_only]
public fun assert_protocol_lp_claimed_for_testing(
    event: ProtocolLpClaimed,
    pool_id: ID,
    fee_to: address,
    lp_claimed: u64
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.fee_to == fee_to, 1);
    assert!(event.lp_claimed == lp_claimed, 2);
}

#[test_only]
public fun assert_config_updated_for_testing(
    event: ConfigUpdated,
    pool_id: ID,
    parameter: vector<u8>,
    values: vector<u128>
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.parameter == parameter, 1);
    assert!(event.values == values, 2);
}

#[test_only]
public fun assert_pool_gate_state_changed_for_testing(
    event: PoolGateStateChanged,
    pool_id: ID,
    gate: u8,
    enabled: bool
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.gate == gate, 1);
    assert!(event.enabled == enabled, 2);
}

#[test_only]
public fun assert_oracle_policy_updated_for_testing(
    event: OraclePolicyUpdated,
    pool_id: ID,
    policy_version: u64,
    parameter: vector<u8>,
    values: vector<u128>
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.policy_version == policy_version, 1);
    assert!(event.parameter == parameter, 2);
    assert!(event.values == values, 3);
}

#[test_only]
public fun assert_amm_policy_updated_for_testing(
    event: AmmPolicyUpdated,
    pool_id: ID,
    policy_version: u64,
    parameter: vector<u8>,
    values: vector<u128>
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.policy_version == policy_version, 1);
    assert!(event.parameter == parameter, 2);
    assert!(event.values == values, 3);
}

#[test_only]
public fun assert_oracle_quorum_used_for_testing(
    event: OracleQuorumUsed,
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
    mode: u8,
    primary_source: u8,
    source_mask: u64,
    source_count: u8,
    required_source_mask: u64,
    min_sources: u8,
    relative_price_q32: u64,
    valid_until_ms: u64
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.policy_version == policy_version, 1);
    assert!(event.policy_digest == policy_digest, 2);
    assert!(event.price_digest == price_digest, 3);
    assert!(event.mode == mode, 4);
    assert!(event.primary_source == primary_source, 5);
    assert!(event.source_mask == source_mask, 6);
    assert!(event.source_count == source_count, 7);
    assert!(event.required_source_mask == required_source_mask, 8);
    assert!(event.min_sources == min_sources, 9);
    assert!(event.relative_price_q32 == relative_price_q32, 10);
    assert!(event.valid_until_ms == valid_until_ms, 11);
}

#[test_only]
public fun assert_amm_twap_used_for_testing(
    event: AmmTwapUsed,
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
    source_mask: u64,
    source_count: u8,
    aggregate_relative_price_q32: u64,
    oracle_relative_price_q32: u64,
    adjusted_relative_price_q32: u64,
    o_spread: u64,
    total_liquidity_quote: u256,
    min_window_seconds: u64,
    max_window_seconds: u64,
    valid_until_ms: u64
) {
    assert!(event.pool_id == pool_id, 0);
    assert!(event.policy_version == policy_version, 1);
    assert!(event.policy_digest == policy_digest, 2);
    assert!(event.price_digest == price_digest, 3);
    assert!(event.source_mask == source_mask, 4);
    assert!(event.source_count == source_count, 5);
    assert!(event.aggregate_relative_price_q32 == aggregate_relative_price_q32, 6);
    assert!(event.oracle_relative_price_q32 == oracle_relative_price_q32, 7);
    assert!(event.adjusted_relative_price_q32 == adjusted_relative_price_q32, 8);
    assert!(event.o_spread == o_spread, 9);
    assert!(event.total_liquidity_quote == total_liquidity_quote, 10);
    assert!(event.min_window_seconds == min_window_seconds, 11);
    assert!(event.max_window_seconds == max_window_seconds, 12);
    assert!(event.valid_until_ms == valid_until_ms, 13);
}
