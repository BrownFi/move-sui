module brownfi_amm::pool;

use sui::balance::{Self, Balance, Supply};

public struct LP<phantom A, phantom B> has drop {}

public struct Pool<phantom A, phantom B> has key {
    id: UID,
    balance_a: Balance<A>,
    balance_b: Balance<B>,
    lp_supply: Supply<LP<A, B>>,
    fee_points: u64,
}

public(package) fun new<A, B>(
    balance_a: Balance<A>,
    balance_b: Balance<B>,
    fee_points: u64,
    ctx: &mut TxContext
): Pool<A, B> {
    Pool<A, B> {
        id: object::new(ctx),
        balance_a,
        balance_b,
        lp_supply: balance::create_supply(LP<A, B> {}),
        fee_points,
    }
}

public(package) fun share<A, B>(pool: Pool<A, B>) {
    transfer::share_object(pool);
}

public fun balance_a<A, B>(pool: &Pool<A, B>): u64 {
    balance::value(&pool.balance_a)
}

public fun balance_b<A, B>(pool: &Pool<A, B>): u64 {
    balance::value(&pool.balance_b)
}

public fun lp_supply<A, B>(pool: &Pool<A, B>): u64 {
    balance::supply_value(&pool.lp_supply)
}

public fun fee_points<A, B>(pool: &Pool<A, B>): u64 {
    pool.fee_points
}

public fun get_balances<A, B>(pool: &Pool<A, B>): (u64, u64, u64) {
    (
        balance::value(&pool.balance_a),
        balance::value(&pool.balance_b),
        balance::supply_value(&pool.lp_supply)
    )
}

public fun id<A, B>(pool: &Pool<A, B>): ID {
    object::id(pool)
}

public(package) fun deposit_a<A, B>(pool: &mut Pool<A, B>, balance: Balance<A>) {
    balance::join(&mut pool.balance_a, balance);
}

public(package) fun deposit_b<A, B>(pool: &mut Pool<A, B>, balance: Balance<B>) {
    balance::join(&mut pool.balance_b, balance);
}

public(package) fun withdraw_a<A, B>(pool: &mut Pool<A, B>, amount: u64): Balance<A> {
    balance::split(&mut pool.balance_a, amount)
}

public(package) fun withdraw_b<A, B>(pool: &mut Pool<A, B>, amount: u64): Balance<B> {
    balance::split(&mut pool.balance_b, amount)
}

public(package) fun mint_lp<A, B>(pool: &mut Pool<A, B>, amount: u64): Balance<LP<A, B>> {
    balance::increase_supply(&mut pool.lp_supply, amount)
}

public(package) fun burn_lp<A, B>(pool: &mut Pool<A, B>, lp: Balance<LP<A, B>>) {
    balance::decrease_supply(&mut pool.lp_supply, lp);
}

public(package) fun borrow_mut_balance_a<A, B>(pool: &mut Pool<A, B>): &mut Balance<A> {
    &mut pool.balance_a
}

public(package) fun borrow_mut_balance_b<A, B>(pool: &mut Pool<A, B>): &mut Balance<B> {
    &mut pool.balance_b
}

public(package) fun borrow_mut_lp_supply<A, B>(pool: &mut Pool<A, B>): &mut Supply<LP<A, B>> {
    &mut pool.lp_supply
}
