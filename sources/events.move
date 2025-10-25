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
    amount_out: u64
) {
    sui::event::emit(Swap {
        pool_id,
        token_in,
        amount_in,
        token_out,
        amount_out
    });
}
