module brownfi_amm::events;

use std::type_name::TypeName;

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
}

public struct RemoveLiquidity has copy, drop {
    pool_id: ID,
    a: TypeName,
    b: TypeName,
    amount_out_a: u64,
    amount_out_b: u64,
    lp_burnt: u64,
}

public struct Swap has copy, drop {
    pool_id: ID,
    token_in: TypeName,
    amount_in: u64,
    token_out: TypeName,
    amount_out: u64,
    /// Skewness-adjusted price for token A (Q64 format)
    price_a: u64,
    /// Skewness-adjusted price for token B (Q64 format)
    price_b: u64,
}

public struct PoolParametersUpdated has copy, drop {
    pool_id: ID,
    parameter: vector<u8>, // "fee", "k", "lambda", "protocol_fee"
    new_value: u64,
}

public struct PauseStateChanged has copy, drop {
    paused: bool,
}

public struct FeeToUpdated has copy, drop {
    new_fee_to: address,
}

public struct OracleUpdated has copy, drop {
    new_oracle: ID,
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
    lp_minted: u64
) {
    sui::event::emit(AddLiquidity {
        pool_id,
        a,
        b,
        amount_in_a,
        amount_in_b,
        lp_minted
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

public fun emit_fee_to_updated(new_fee_to: address) {
    sui::event::emit(FeeToUpdated { new_fee_to });
}

public fun emit_oracle_updated(new_oracle: ID) {
    sui::event::emit(OracleUpdated { new_oracle });
}
