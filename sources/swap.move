module brownfi_amm::swap;

use std::type_name;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::tx_context::sender;

use brownfi_amm::library;
use brownfi_amm::math;
use brownfi_amm::events;
use brownfi_amm::pool::{Self, Pool, LP};
use brownfi_amm::factory::{Self, Factory};

const EZeroInput: u64 = 0;
const EExcessiveSlippage: u64 = 3;
const ENoLiquidity: u64 = 4;
const EPoolBalanceTooLarge: u64 = 5;

const LP_FEE_BASE: u64 = 10_000;
const MAX_POOL_BALANCE: u64 = 1_000_000_000_000_000_000; // 1e18
const MIN_LIQUIDITY: u64 = 10; // Minimum liquidity for first deposit

public fun pool_balances<A, B>(pool: &Pool<A, B>): (u64, u64, u64) {
    pool::get_balances(pool)
}

public fun pool_fees<A, B>(pool: &Pool<A, B>): u64 {
    pool::fee_points(pool)
}

fun init(ctx: &mut TxContext) {
    factory::create_and_share(ctx);
}

public fun create_pool<A, B>(factory: &mut Factory, init_a: Balance<A>, init_b: Balance<B>, ctx: &mut TxContext): Balance<LP<A, B>> {
    let init_a_val = balance::value(&init_a);
    let init_b_val = balance::value(&init_b);
    
    assert!(init_a_val > 0 && init_b_val > 0, EZeroInput);
    assert!(init_a_val <= MAX_POOL_BALANCE && init_b_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);

    factory::register_pool<A, B>(factory);

    let mut pool_obj = pool::new(init_a, init_b, 30, ctx);

    let lp_amount = math::mul_sqrt(pool::balance_a(&pool_obj), pool::balance_b(&pool_obj));
    assert!(lp_amount >= MIN_LIQUIDITY, ENoLiquidity);
    let lp_balance = pool::mint_lp(&mut pool_obj, lp_amount);

    events::emit_pool_created(
        pool::id(&pool_obj),
        type_name::with_defining_ids<A>(),
        type_name::with_defining_ids<B>(),
        pool::balance_a(&pool_obj),
        pool::balance_b(&pool_obj),
        lp_amount
    );

    pool::share(pool_obj);
    lp_balance
}

public fun add_liquidity<A, B>(pool: &mut Pool<A, B>, mut input_a: Balance<A>, mut input_b: Balance<B>, min_lp_out: u64): (Balance<A>, Balance<B>, Balance<LP<A, B>>) {
    let input_a_val = balance::value(&input_a);
    let input_b_val = balance::value(&input_b);
    let pool_a_val = pool::balance_a(pool);
    let pool_b_val = pool::balance_b(pool);
    
    assert!(input_a_val > 0 && input_b_val > 0, EZeroInput);
    assert!(pool_a_val <= MAX_POOL_BALANCE && pool_b_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);
    assert!(pool_a_val + input_a_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);
    assert!(pool_b_val + input_b_val <= MAX_POOL_BALANCE, EPoolBalanceTooLarge);

    let input_a_mul_pool_b: u128 = (input_a_val as u128) * (pool_b_val as u128);
    let input_b_mul_pool_a: u128 = (input_b_val as u128) * (pool_a_val as u128);

    let deposit_a: u64;
    let deposit_b: u64;
    let lp_to_issue: u64;
    
    if (input_a_mul_pool_b > input_b_mul_pool_a) {
        deposit_b = input_b_val;
        deposit_a = (math::ceil_div_u128(input_b_mul_pool_a, (pool_b_val as u128)) as u64);
        lp_to_issue = math::mul_div(deposit_b, pool::lp_supply(pool), pool_b_val);
    } else if (input_a_mul_pool_b < input_b_mul_pool_a) {
        deposit_a = input_a_val;
        deposit_b = (math::ceil_div_u128(input_a_mul_pool_b, (pool_a_val as u128)) as u64);
        lp_to_issue = math::mul_div(deposit_a, pool::lp_supply(pool), pool_a_val);
    } else {
        deposit_a = input_a_val;
        deposit_b = input_b_val;
        if (pool::lp_supply(pool) == 0) {
            lp_to_issue = math::mul_sqrt(deposit_a, deposit_b);
        } else {
            lp_to_issue = math::mul_div(deposit_a, pool::lp_supply(pool), pool_a_val);
        }
    };

    assert!(lp_to_issue >= min_lp_out, EExcessiveSlippage);
    
    pool::deposit_a(pool, balance::split(&mut input_a, deposit_a));
    pool::deposit_b(pool, balance::split(&mut input_b, deposit_b));

    let lp = pool::mint_lp(pool, lp_to_issue);

    events::emit_add_liquidity(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        type_name::with_defining_ids<B>(),
        deposit_a,
        deposit_b,
        lp_to_issue
    );

    (input_a, input_b, lp)
}

public fun remove_liquidity<A, B>(pool: &mut Pool<A, B>, lp_in: Balance<LP<A, B>>, min_a_out: u64, min_b_out: u64): (Balance<A>, Balance<B>) {
    assert!(balance::value(&lp_in) > 0, EZeroInput);

    let lp_in_amount = balance::value(&lp_in);
    let pool_a_amount = pool::balance_a(pool);
    let pool_b_amount = pool::balance_b(pool);
    let lp_supply_val = pool::lp_supply(pool);

    let a_out = math::mul_div(lp_in_amount, pool_a_amount, lp_supply_val);
    let b_out = math::mul_div(lp_in_amount, pool_b_amount, lp_supply_val);
    assert!(a_out >= min_a_out, EExcessiveSlippage);
    assert!(b_out >= min_b_out, EExcessiveSlippage);

    pool::burn_lp(pool, lp_in);

    events::emit_remove_liquidity(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        type_name::with_defining_ids<B>(),
        a_out,
        b_out,
        lp_in_amount
    );

    (pool::withdraw_a(pool, a_out), pool::withdraw_b(pool, b_out))
}

public fun swap_a_for_b<A, B>(pool: &mut Pool<A, B>, input: Balance<A>, min_out: u64): Balance<B> {
    assert!(balance::value(&input) > 0, EZeroInput);
    assert!(pool::balance_a(pool) > 0 && pool::balance_b(pool) > 0, ENoLiquidity);

    let input_amount = balance::value(&input);
    let out_amount = calc_swap_out(
        input_amount,
        pool::balance_a(pool),
        pool::balance_b(pool),
        pool::fee_points(pool)
    );

    assert!(out_amount >= min_out, EExcessiveSlippage);

    pool::deposit_a(pool, input);

    events::emit_swap(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        input_amount,
        type_name::with_defining_ids<B>(),
        out_amount
    );

    pool::withdraw_b(pool, out_amount)
}

public fun swap_b_for_a<A, B>(pool: &mut Pool<A, B>, input: Balance<B>, min_out: u64): Balance<A> {
    assert!(balance::value(&input) > 0, EZeroInput);
    assert!(pool::balance_a(pool) > 0 && pool::balance_b(pool) > 0, ENoLiquidity);

    let input_amount = balance::value(&input);
    let out_amount = calc_swap_out(
        input_amount,
        pool::balance_b(pool),
        pool::balance_a(pool),
        pool::fee_points(pool)
    );

    assert!(out_amount >= min_out, EExcessiveSlippage);

    pool::deposit_b(pool, input);

    events::emit_swap(
        pool::id(pool),
        type_name::with_defining_ids<B>(),
        input_amount,
        type_name::with_defining_ids<A>(),
        out_amount
    );

    pool::withdraw_a(pool, out_amount)
}

fun calc_swap_out(input_amount: u64, input_pool_amount: u64, out_pool_amount: u64, fee_points: u64): u64 {
    let fee_amount = math::ceil_mul_div(input_amount, fee_points, LP_FEE_BASE);
    let input_amount_after_fee = input_amount - fee_amount;
    let out_amount = math::mul_div(
        input_amount_after_fee,
        out_pool_amount,
        input_pool_amount + input_amount_after_fee
    );
    out_amount
}

public fun create_pool_with_coins<A, B>(factory: &mut Factory, init_a: Coin<A>, init_b: Coin<B>, ctx: &mut TxContext): Coin<LP<A, B>> {
    let lp_balance = create_pool(factory, coin::into_balance(init_a), coin::into_balance(init_b), ctx);
    
    coin::from_balance(lp_balance, ctx)
}

#[allow(lint(self_transfer))]
public fun create_pool_with_coins_and_transfer_lp_to_sender<A, B>(factory: &mut Factory, init_a: Coin<A>, init_b: Coin<B>, ctx: &mut TxContext) {
    let lp_coin = create_pool_with_coins(factory, init_a, init_b, ctx);
    transfer::public_transfer(lp_coin, sender(ctx));
}

public fun add_liquidity_with_coins<A, B>(pool: &mut Pool<A, B>, input_a: Coin<A>, input_b: Coin<B>, min_lp_out: u64, ctx: &mut TxContext): (Coin<A>, Coin<B>, Coin<LP<A, B>>) {
    let (remaining_a, remaining_b, lp) = add_liquidity(
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

#[allow(lint(self_transfer))]
public fun add_liquidity_with_coins_and_transfer_to_sender<A, B>(pool: &mut Pool<A, B>, input_a: Coin<A>, input_b: Coin<B>, min_lp_out: u64, ctx: &mut TxContext) {
    let (remaining_a, remaining_b, lp) = add_liquidity(
        pool,
        coin::into_balance(input_a),
        coin::into_balance(input_b),
        min_lp_out
    );
    let sender_addr = sender(ctx);
    library::destroy_zero_or_transfer(remaining_a, sender_addr, ctx);
    library::destroy_zero_or_transfer(remaining_b, sender_addr, ctx);
    library::destroy_zero_or_transfer(lp, sender_addr, ctx);
}

public fun remove_liquidity_with_coins<A, B>(pool: &mut Pool<A, B>, lp_in: Coin<LP<A, B>>, min_a_out: u64, min_b_out: u64, ctx: &mut TxContext): (Coin<A>, Coin<B>) {
    let (a_out, b_out) = remove_liquidity(
        pool,
        coin::into_balance(lp_in),
        min_a_out,
        min_b_out
    );

    (coin::from_balance(a_out, ctx), coin::from_balance(b_out, ctx))
}

#[allow(lint(self_transfer))]
public fun remove_liquidity_with_coins_and_transfer_to_sender<A, B>(pool: &mut Pool<A, B>, lp_in: Coin<LP<A, B>>, min_a_out: u64, min_b_out: u64, ctx: &mut TxContext) {
    let (a_out, b_out) = remove_liquidity(
        pool,
        coin::into_balance(lp_in),
        min_a_out,
        min_b_out
    );
    let sender_addr = sender(ctx);
    library::destroy_zero_or_transfer(a_out, sender_addr, ctx);
    library::destroy_zero_or_transfer(b_out, sender_addr, ctx);
}

public fun swap_a_for_b_with_coin<A, B>(pool: &mut Pool<A, B>, input: Coin<A>, min_out: u64, ctx: &mut TxContext): Coin<B> {
    let b_out = swap_a_for_b(pool, coin::into_balance(input), min_out);
    coin::from_balance(b_out, ctx)
}

#[allow(lint(self_transfer))]
public fun swap_a_for_b_with_coin_and_transfer_to_sender<A, B>(pool: &mut Pool<A, B>, input: Coin<A>, min_out: u64, ctx: &mut TxContext) {
    let b_coin = swap_a_for_b_with_coin(pool, input, min_out, ctx);
    transfer::public_transfer(b_coin, sender(ctx));
}

public fun swap_b_for_a_with_coin<A, B>(pool: &mut Pool<A, B>, input: Coin<B>, min_out: u64, ctx: &mut TxContext): Coin<A> {
    let a_out = swap_b_for_a(pool, coin::into_balance(input), min_out);
    coin::from_balance(a_out, ctx)
}

#[allow(lint(self_transfer))]
public fun swap_b_for_a_with_coin_and_transfer_to_sender<A, B>(pool: &mut Pool<A, B>, input: Coin<B>, min_out: u64, ctx: &mut TxContext) {
    let a_coin = swap_b_for_a_with_coin(pool, input, min_out, ctx);
    transfer::public_transfer(a_coin, sender(ctx));
}

#[test_only]
public fun test_init(ctx: &mut TxContext) {
    init(ctx)
}

#[test_only]
public struct BAR has drop {}
#[test_only]
public struct FOO has drop {}
#[test_only]
public struct FOOD has drop {}
#[test_only]
public struct FOOd has drop {}

#[test]
fun test_cmp_type_names() {
    assert!(library::sort_names(&type_name::get<BAR>(), &type_name::get<FOO>()) == library::sort_less(), 0);
    assert!(library::sort_names(&type_name::get<FOO>(), &type_name::get<FOO>()) == library::sort_equal(), 0);
    assert!(library::sort_names(&type_name::get<FOO>(), &type_name::get<BAR>()) == library::sort_greater(), 0);

    assert!(library::sort_names(&type_name::get<FOO>(), &type_name::get<FOOd>()) == library::sort_less(), 0);
    assert!(library::sort_names(&type_name::get<FOOd>(), &type_name::get<FOO>()) == library::sort_greater(), 0);

    assert!(library::sort_names(&type_name::get<FOOD>(), &type_name::get<FOOd>()) == library::sort_less(), 0);
    assert!(library::sort_names(&type_name::get<FOOd>(), &type_name::get<FOOD>()) == library::sort_greater(), 0);
}

#[test]
fun test_factory() {
    let ctx = &mut tx_context::dummy();
    let mut factory_obj = factory::test_new(ctx);

    factory::register_pool<BAR, FOO>(&mut factory_obj);
    factory::register_pool<FOO, FOOd>(&mut factory_obj);

    factory::test_remove_pool<BAR, FOO>(&mut factory_obj);
    factory::test_remove_pool<FOO, FOOd>(&mut factory_obj);
    factory::test_destroy_empty(factory_obj);
}

#[test]
#[expected_failure(abort_code = factory::EInvalidPair)]
fun test_add_pool_aborts_on_wrong_order() {
    let ctx = &mut tx_context::dummy();
    let mut factory_obj = factory::test_new(ctx);

    factory::register_pool<FOO, BAR>(&mut factory_obj);

    factory::test_remove_pool<FOO, BAR>(&mut factory_obj);
    factory::test_destroy_empty(factory_obj);
}

#[test]
#[expected_failure(abort_code = factory::EInvalidPair)]
fun test_add_pool_aborts_on_same_type() {
    let ctx = &mut tx_context::dummy();
    let mut factory_obj = factory::test_new(ctx);

    factory::register_pool<FOO, FOO>(&mut factory_obj);

    factory::test_remove_pool<FOO, FOO>(&mut factory_obj);
    factory::test_destroy_empty(factory_obj);
}

#[test]
#[expected_failure(abort_code = factory::EPoolAlreadyExists)]
fun test_add_pool_aborts_on_already_exists() {
    let ctx = &mut tx_context::dummy();
    let mut factory_obj = factory::test_new(ctx);

    factory::register_pool<BAR, FOO>(&mut factory_obj);
    factory::register_pool<BAR, FOO>(&mut factory_obj);

    factory::test_remove_pool<BAR, FOO>(&mut factory_obj);
    factory::test_destroy_empty(factory_obj);
}
