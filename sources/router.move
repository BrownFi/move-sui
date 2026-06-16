module brownfi_amm::router;

use sui::balance;
use sui::coin::{Self, Coin};
use sui::clock::Clock;
use pyth::price_info::PriceInfoObject;

use brownfi_amm::oracle_gateway::PriceBundle;
use brownfi_amm::pool::{Self, Pool, LP};
use brownfi_amm::swap;
use brownfi_oracle::oracle::OracleAdapter;

const ERouterDisabled: u64 = 1;
const ERouteLimitExceeded: u64 = 2;

const MAX_HOPS: u8 = 2;

public fun max_hops(): u8 {
    MAX_HOPS
}

public fun assert_hop_limit(hops: u8) {
    assert!(hops <= MAX_HOPS, ERouteLimitExceeded);
}

public fun swap_exact_a_for_b<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<B> {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);
    swap::swap_a_for_b_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        input,
        min_out,
        ctx
    )
}

public fun swap_exact_a_for_b_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<B> {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);
    let b_out = swap::swap_a_for_b_with_bundle(
        price_bundle,
        clock,
        pool,
        coin::into_balance(input),
        min_out
    );
    coin::from_balance(b_out, ctx)
}

public fun add_liquidity_with_coins<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_a: Coin<A>,
    input_b: Coin<B>,
    min_lp_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<LP<A, B>>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    swap::add_liquidity_with_coins(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        input_a,
        input_b,
        min_lp_out,
        ctx
    )
}

public fun zap_in_a<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_a: Coin<A>,
    min_b_from_swap: u64,
    min_lp_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<LP<A, B>>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);

    let mut remaining_a_input = input_a;
    let swap_amount = coin::value(&remaining_a_input) / 2;
    let swap_input_a = coin::split(&mut remaining_a_input, swap_amount, ctx);
    let b_from_swap = swap::swap_a_for_b_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        swap_input_a,
        min_b_from_swap,
        ctx
    );

    swap::add_liquidity_with_coins(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        remaining_a_input,
        b_from_swap,
        min_lp_out,
        ctx
    )
}

public fun zap_in_b<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_b: Coin<B>,
    min_a_from_swap: u64,
    min_lp_out: u64,
    ctx: &mut TxContext
): (Coin<B>, Coin<A>, Coin<LP<A, B>>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);

    let mut remaining_b_input = input_b;
    let swap_amount = coin::value(&remaining_b_input) / 2;
    let swap_input_b = coin::split(&mut remaining_b_input, swap_amount, ctx);
    let a_from_swap = swap::swap_b_for_a_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        swap_input_b,
        min_a_from_swap,
        ctx
    );
    let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_coins(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        a_from_swap,
        remaining_b_input,
        min_lp_out,
        ctx
    );

    (remaining_b, remaining_a, lp)
}

public fun add_liquidity_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_a: Coin<A>,
    input_b: Coin<B>,
    min_lp_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<LP<A, B>>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
        price_bundle,
        clock,
        pool,
        coin::into_balance(input_a),
        coin::into_balance(input_b),
        min_lp_out
    );
    (
        coin::from_balance(remaining_a, ctx),
        coin::from_balance(remaining_b, ctx),
        coin::from_balance(lp, ctx)
    )
}

public fun zap_in_a_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_a: Coin<A>,
    min_b_from_swap: u64,
    min_lp_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<LP<A, B>>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);

    let mut remaining_a_input = input_a;
    let swap_amount = coin::value(&remaining_a_input) / 2;
    let swap_input_a = coin::split(&mut remaining_a_input, swap_amount, ctx);
    let b_from_swap = swap::swap_a_for_b_with_bundle(
        price_bundle,
        clock,
        pool,
        coin::into_balance(swap_input_a),
        min_b_from_swap
    );
    let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
        price_bundle,
        clock,
        pool,
        coin::into_balance(remaining_a_input),
        b_from_swap,
        min_lp_out
    );

    (
        coin::from_balance(remaining_a, ctx),
        coin::from_balance(remaining_b, ctx),
        coin::from_balance(lp, ctx)
    )
}

public fun zap_in_b_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input_b: Coin<B>,
    min_a_from_swap: u64,
    min_lp_out: u64,
    ctx: &mut TxContext
): (Coin<B>, Coin<A>, Coin<LP<A, B>>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);

    let mut remaining_b_input = input_b;
    let swap_amount = coin::value(&remaining_b_input) / 2;
    let swap_input_b = coin::split(&mut remaining_b_input, swap_amount, ctx);
    let a_from_swap = swap::swap_b_for_a_with_bundle(
        price_bundle,
        clock,
        pool,
        coin::into_balance(swap_input_b),
        min_a_from_swap
    );
    let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
        price_bundle,
        clock,
        pool,
        a_from_swap,
        coin::into_balance(remaining_b_input),
        min_lp_out
    );

    (
        coin::from_balance(remaining_b, ctx),
        coin::from_balance(remaining_a, ctx),
        coin::from_balance(lp, ctx)
    )
}

public fun zap_out_a<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<A> {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);

    let (mut a_out, b_to_swap) = swap::remove_liquidity(
        pool,
        coin::into_balance(lp_in),
        0,
        0
    );
    let min_swap_out = if (min_out > balance::value(&a_out)) {
        min_out - balance::value(&a_out)
    } else {
        0
    };
    let swapped_a = swap::swap_b_for_a_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        coin::from_balance(b_to_swap, ctx),
        min_swap_out,
        ctx
    );
    balance::join(&mut a_out, coin::into_balance(swapped_a));

    coin::from_balance(a_out, ctx)
}

public fun zap_out_b<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<B> {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);

    let (a_to_swap, mut b_out) = swap::remove_liquidity(
        pool,
        coin::into_balance(lp_in),
        0,
        0
    );
    let min_swap_out = if (min_out > balance::value(&b_out)) {
        min_out - balance::value(&b_out)
    } else {
        0
    };
    let swapped_b = swap::swap_a_for_b_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        coin::from_balance(a_to_swap, ctx),
        min_swap_out,
        ctx
    );
    balance::join(&mut b_out, coin::into_balance(swapped_b));

    coin::from_balance(b_out, ctx)
}

public fun zap_out_a_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<A> {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);

    let (mut a_out, b_to_swap) = swap::remove_liquidity(
        pool,
        coin::into_balance(lp_in),
        0,
        0
    );
    let min_swap_out = if (min_out > balance::value(&a_out)) {
        min_out - balance::value(&a_out)
    } else {
        0
    };
    let swapped_a = swap::swap_b_for_a_with_bundle(
        price_bundle,
        clock,
        pool,
        b_to_swap,
        min_swap_out
    );
    balance::join(&mut a_out, swapped_a);

    coin::from_balance(a_out, ctx)
}

public fun zap_out_b_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<B> {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);

    let (a_to_swap, mut b_out) = swap::remove_liquidity(
        pool,
        coin::into_balance(lp_in),
        0,
        0
    );
    let min_swap_out = if (min_out > balance::value(&b_out)) {
        min_out - balance::value(&b_out)
    } else {
        0
    };
    let swapped_b = swap::swap_a_for_b_with_bundle(
        price_bundle,
        clock,
        pool,
        a_to_swap,
        min_swap_out
    );
    balance::join(&mut b_out, swapped_b);

    coin::from_balance(b_out, ctx)
}

public fun remove_liquidity_with_coins<A, B>(
    pool: &mut Pool<A, B>,
    lp_in: Coin<LP<A, B>>,
    min_a_out: u64,
    min_b_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    swap::remove_liquidity_with_coins(
        pool,
        lp_in,
        min_a_out,
        min_b_out,
        ctx
    )
}

public fun swap_exact_b_for_a<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<A> {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);
    swap::swap_b_for_a_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        input,
        min_out,
        ctx
    )
}

public fun swap_exact_b_for_a_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    min_out: u64,
    ctx: &mut TxContext
): Coin<A> {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);
    let a_out = swap::swap_b_for_a_with_bundle(
        price_bundle,
        clock,
        pool,
        coin::into_balance(input),
        min_out
    );
    coin::from_balance(a_out, ctx)
}

public fun swap_a_for_exact_b<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);
    swap::swap_a_for_exact_b_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        input,
        amount_out,
        ctx
    )
}

public fun swap_a_for_exact_b_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<A>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);
    let (remaining_a, b_out) = swap::swap_a_for_exact_b_with_bundle(
        price_bundle,
        clock,
        pool,
        coin::into_balance(input),
        amount_out
    );
    (coin::from_balance(remaining_a, ctx), coin::from_balance(b_out, ctx))
}

public fun swap_b_for_exact_a<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<B>, Coin<A>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);
    swap::swap_b_for_exact_a_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool,
        input,
        amount_out,
        ctx
    )
}

public fun swap_b_for_exact_a_with_bundle<A, B>(
    price_bundle: &PriceBundle,
    clock: &Clock,
    pool: &mut Pool<A, B>,
    input: Coin<B>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<B>, Coin<A>) {
    assert!(pool::router_enabled(pool), ERouterDisabled);
    assert_hop_limit(1);
    let (remaining_b, a_out) = swap::swap_b_for_exact_a_with_bundle(
        price_bundle,
        clock,
        pool,
        coin::into_balance(input),
        amount_out
    );
    (coin::from_balance(remaining_b, ctx), coin::from_balance(a_out, ctx))
}

public fun swap_exact_a_for_c_via_b<A, B, C>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    price_info_object_c: &PriceInfoObject,
    clock: &Clock,
    pool_ab: &mut Pool<A, B>,
    pool_bc: &mut Pool<B, C>,
    input: Coin<A>,
    min_b_out: u64,
    min_c_out: u64,
    ctx: &mut TxContext
): Coin<C> {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let b_mid = swap::swap_a_for_b_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool_ab,
        input,
        min_b_out,
        ctx
    );

    swap::swap_a_for_b_with_coin(
        oracle,
        price_info_object_b,
        price_info_object_c,
        clock,
        pool_bc,
        b_mid,
        min_c_out,
        ctx
    )
}

public fun swap_exact_a_for_c_via_b_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &mut Pool<A, B>,
    pool_bc: &mut Pool<B, C>,
    input: Coin<A>,
    min_b_out: u64,
    min_c_out: u64,
    ctx: &mut TxContext
): Coin<C> {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let b_mid = swap::swap_a_for_b_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        coin::into_balance(input),
        min_b_out
    );

    let c_out = swap::swap_a_for_b_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        b_mid,
        min_c_out
    );

    coin::from_balance(c_out, ctx)
}

public fun quote_exact_a_for_c_via_b_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &Pool<A, B>,
    pool_bc: &Pool<B, C>,
    amount_in: u64
): (u64, u64, u64) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (b_out, _, _) = swap::quote_a_for_b_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        amount_in
    );
    let (c_out, _, _) = swap::quote_a_for_b_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        b_out
    );

    (amount_in, b_out, c_out)
}

public fun quote_exact_a_for_c_via_b_without_cutoff_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &Pool<A, B>,
    pool_bc: &Pool<B, C>,
    amount_in: u64
): (u64, u64, u64) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (_, b_raw, _) = swap::quote_a_for_b_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        amount_in
    );
    let (_, c_raw, _) = swap::quote_a_for_b_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        b_raw
    );

    (amount_in, b_raw, c_raw)
}

public fun swap_exact_c_for_a_via_b<A, B, C>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    price_info_object_c: &PriceInfoObject,
    clock: &Clock,
    pool_ab: &mut Pool<A, B>,
    pool_bc: &mut Pool<B, C>,
    input: Coin<C>,
    min_b_out: u64,
    min_a_out: u64,
    ctx: &mut TxContext
): Coin<A> {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let b_mid = swap::swap_b_for_a_with_coin(
        oracle,
        price_info_object_b,
        price_info_object_c,
        clock,
        pool_bc,
        input,
        min_b_out,
        ctx
    );

    swap::swap_b_for_a_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool_ab,
        b_mid,
        min_a_out,
        ctx
    )
}

public fun swap_exact_c_for_a_via_b_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &mut Pool<A, B>,
    pool_bc: &mut Pool<B, C>,
    input: Coin<C>,
    min_b_out: u64,
    min_a_out: u64,
    ctx: &mut TxContext
): Coin<A> {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let b_mid = swap::swap_b_for_a_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        coin::into_balance(input),
        min_b_out
    );

    let a_out = swap::swap_b_for_a_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        b_mid,
        min_a_out
    );

    coin::from_balance(a_out, ctx)
}

public fun quote_exact_c_for_a_via_b_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &Pool<A, B>,
    pool_bc: &Pool<B, C>,
    amount_in: u64
): (u64, u64, u64) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (b_out, _, _) = swap::quote_b_for_a_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        amount_in
    );
    let (a_out, _, _) = swap::quote_b_for_a_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        b_out
    );

    (amount_in, b_out, a_out)
}

public fun quote_exact_c_for_a_via_b_without_cutoff_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &Pool<A, B>,
    pool_bc: &Pool<B, C>,
    amount_in: u64
): (u64, u64, u64) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (_, b_raw, _) = swap::quote_b_for_a_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        amount_in
    );
    let (_, a_raw, _) = swap::quote_b_for_a_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        b_raw
    );

    (amount_in, b_raw, a_raw)
}

public fun swap_a_for_exact_c_via_b<A, B, C>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    price_info_object_c: &PriceInfoObject,
    clock: &Clock,
    pool_ab: &mut Pool<A, B>,
    pool_bc: &mut Pool<B, C>,
    input: Coin<A>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<C>) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (b_required, c_effective_out) = swap::quote_a_for_exact_b(
        oracle,
        price_info_object_b,
        price_info_object_c,
        clock,
        pool_bc,
        amount_out
    );
    swap::assert_exact_output_available(c_effective_out, amount_out);

    let (remaining_a, b_mid) = swap::swap_a_for_exact_b_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool_ab,
        input,
        b_required,
        ctx
    );

    let (remaining_b, c_out) = swap::swap_a_for_exact_b_with_coin(
        oracle,
        price_info_object_b,
        price_info_object_c,
        clock,
        pool_bc,
        b_mid,
        amount_out,
        ctx
    );

    (remaining_a, remaining_b, c_out)
}

public fun swap_a_for_exact_c_via_b_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &mut Pool<A, B>,
    pool_bc: &mut Pool<B, C>,
    input: Coin<A>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<C>) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (b_required, c_effective_out) = swap::quote_a_for_exact_b_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        amount_out
    );
    swap::assert_exact_output_available(c_effective_out, amount_out);

    let (remaining_a, b_mid) = swap::swap_a_for_exact_b_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        coin::into_balance(input),
        b_required
    );

    let (remaining_b, c_out) = swap::swap_a_for_exact_b_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        b_mid,
        amount_out
    );

    (
        coin::from_balance(remaining_a, ctx),
        coin::from_balance(remaining_b, ctx),
        coin::from_balance(c_out, ctx)
    )
}

public fun swap_a_for_exact_c_via_b_with_reversed_second_bundle<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_cb: &PriceBundle,
    clock: &Clock,
    pool_ab: &mut Pool<A, B>,
    pool_cb: &mut Pool<C, B>,
    input: Coin<A>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<C>) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_cb), ERouterDisabled);
    assert_hop_limit(2);

    let (b_required, c_effective_out) = swap::quote_b_for_exact_a_with_bundle(
        price_bundle_cb,
        clock,
        pool_cb,
        amount_out
    );
    swap::assert_exact_output_available(c_effective_out, amount_out);

    let (remaining_a, b_mid) = swap::swap_a_for_exact_b_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        coin::into_balance(input),
        b_required
    );

    let (remaining_b, c_out) = swap::swap_b_for_exact_a_with_bundle(
        price_bundle_cb,
        clock,
        pool_cb,
        b_mid,
        amount_out
    );

    (
        coin::from_balance(remaining_a, ctx),
        coin::from_balance(remaining_b, ctx),
        coin::from_balance(c_out, ctx)
    )
}

public fun swap_a_for_exact_c_via_b_with_reversed_first_bundle<A, B, C>(
    price_bundle_ba: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ba: &mut Pool<B, A>,
    pool_bc: &mut Pool<B, C>,
    input: Coin<A>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<A>, Coin<B>, Coin<C>) {
    assert!(pool::router_enabled(pool_ba), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (b_required, c_effective_out) = swap::quote_a_for_exact_b_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        amount_out
    );
    swap::assert_exact_output_available(c_effective_out, amount_out);

    let (remaining_a, b_mid) = swap::swap_b_for_exact_a_with_bundle(
        price_bundle_ba,
        clock,
        pool_ba,
        coin::into_balance(input),
        b_required
    );

    let (remaining_b, c_out) = swap::swap_a_for_exact_b_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        b_mid,
        amount_out
    );

    (
        coin::from_balance(remaining_a, ctx),
        coin::from_balance(remaining_b, ctx),
        coin::from_balance(c_out, ctx)
    )
}

public fun quote_a_for_exact_c_via_b_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &Pool<A, B>,
    pool_bc: &Pool<B, C>,
    amount_out: u64
): (u64, u64, u64) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (b_required, c_effective_out) = swap::quote_a_for_exact_b_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        amount_out
    );
    let (a_required, b_effective_out) = swap::quote_a_for_exact_b_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        b_required
    );

    (a_required, b_effective_out, c_effective_out)
}

public fun quote_a_for_exact_c_via_b_without_cutoff_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &Pool<A, B>,
    pool_bc: &Pool<B, C>,
    amount_out: u64
): (u64, u64, u64) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let b_required = swap::quote_a_for_exact_b_without_cutoff_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        amount_out
    );
    let a_required = swap::quote_a_for_exact_b_without_cutoff_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        b_required
    );

    (a_required, b_required, amount_out)
}

public fun swap_c_for_exact_a_via_b<A, B, C>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    price_info_object_c: &PriceInfoObject,
    clock: &Clock,
    pool_ab: &mut Pool<A, B>,
    pool_bc: &mut Pool<B, C>,
    input: Coin<C>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<C>, Coin<B>, Coin<A>) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (b_required, a_effective_out) = swap::quote_b_for_exact_a(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool_ab,
        amount_out
    );
    swap::assert_exact_output_available(a_effective_out, amount_out);

    let (remaining_c, b_mid) = swap::swap_b_for_exact_a_with_coin(
        oracle,
        price_info_object_b,
        price_info_object_c,
        clock,
        pool_bc,
        input,
        b_required,
        ctx
    );

    let (remaining_b, a_out) = swap::swap_b_for_exact_a_with_coin(
        oracle,
        price_info_object_a,
        price_info_object_b,
        clock,
        pool_ab,
        b_mid,
        amount_out,
        ctx
    );

    (remaining_c, remaining_b, a_out)
}

public fun swap_c_for_exact_a_via_b_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &mut Pool<A, B>,
    pool_bc: &mut Pool<B, C>,
    input: Coin<C>,
    amount_out: u64,
    ctx: &mut TxContext
): (Coin<C>, Coin<B>, Coin<A>) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (b_required, a_effective_out) = swap::quote_b_for_exact_a_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        amount_out
    );
    swap::assert_exact_output_available(a_effective_out, amount_out);

    let (remaining_c, b_mid) = swap::swap_b_for_exact_a_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        coin::into_balance(input),
        b_required
    );

    let (remaining_b, a_out) = swap::swap_b_for_exact_a_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        b_mid,
        amount_out
    );

    (
        coin::from_balance(remaining_c, ctx),
        coin::from_balance(remaining_b, ctx),
        coin::from_balance(a_out, ctx)
    )
}

public fun quote_c_for_exact_a_via_b_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &Pool<A, B>,
    pool_bc: &Pool<B, C>,
    amount_out: u64
): (u64, u64, u64) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let (b_required, a_effective_out) = swap::quote_b_for_exact_a_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        amount_out
    );
    let (c_required, b_effective_out) = swap::quote_b_for_exact_a_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        b_required
    );

    (c_required, b_effective_out, a_effective_out)
}

public fun quote_c_for_exact_a_via_b_without_cutoff_with_bundles<A, B, C>(
    price_bundle_ab: &PriceBundle,
    price_bundle_bc: &PriceBundle,
    clock: &Clock,
    pool_ab: &Pool<A, B>,
    pool_bc: &Pool<B, C>,
    amount_out: u64
): (u64, u64, u64) {
    assert!(pool::router_enabled(pool_ab), ERouterDisabled);
    assert!(pool::router_enabled(pool_bc), ERouterDisabled);
    assert_hop_limit(2);

    let b_required = swap::quote_b_for_exact_a_without_cutoff_with_bundle(
        price_bundle_ab,
        clock,
        pool_ab,
        amount_out
    );
    let c_required = swap::quote_b_for_exact_a_without_cutoff_with_bundle(
        price_bundle_bc,
        clock,
        pool_bc,
        b_required
    );

    (c_required, b_required, amount_out)
}
