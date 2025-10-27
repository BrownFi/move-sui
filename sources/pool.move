module brownfi_amm::pool;

use sui::balance::{Self, Balance, Supply};

public struct LP<phantom A, phantom B> has drop {}

public struct Pool<phantom A, phantom B> has key {
    id: UID,
    balance_a: Balance<A>,
    balance_b: Balance<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    lp_supply: Supply<LP<A, B>>,
    /// Trading fee in basis points (default 300_000 = 0.3%)
    fee: u32,
    /// Inventory parameter k in Q64 format (default Q64/1000 = 0.001)
    k: u64,
    /// Skewness parameter lambda in Q64 format (default 0 = no skewness)
    lambda: u64,
    /// Protocol fee percentage (default 10_000_000 = 10%)
    protocol_fee: u32,
}

public(package) fun new<A, B>(
    balance_a: Balance<A>,
    balance_b: Balance<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    fee: u32,
    k: u64,
    lambda: u64,
    protocol_fee: u32,
    ctx: &mut TxContext
): Pool<A, B> {
    Pool<A, B> {
        id: object::new(ctx),
        balance_a,
        balance_b,
        token_a_decimals,
        token_b_decimals,
        lp_supply: balance::create_supply(LP<A, B> {}),
        fee,
        k,
        lambda,
        protocol_fee,
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

public fun fee<A, B>(pool: &Pool<A, B>): u32 {
    pool.fee
}

public fun k<A, B>(pool: &Pool<A, B>): u64 {
    pool.k
}

public fun lambda<A, B>(pool: &Pool<A, B>): u64 {
    pool.lambda
}

public fun protocol_fee<A, B>(pool: &Pool<A, B>): u32 {
    pool.protocol_fee
}

public fun token_a_decimals<A, B>(pool: &Pool<A, B>): u8 {
    pool.token_a_decimals
}

public fun token_b_decimals<A, B>(pool: &Pool<A, B>): u8 {
    pool.token_b_decimals
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

/// Update pool parameters (only callable by authorized modules)
public(package) fun set_fee<A, B>(pool: &mut Pool<A, B>, new_fee: u32) {
    pool.fee = new_fee;
}

public(package) fun set_k<A, B>(pool: &mut Pool<A, B>, new_k: u64) {
    pool.k = new_k;
}

public(package) fun set_lambda<A, B>(pool: &mut Pool<A, B>, new_lambda: u64) {
    pool.lambda = new_lambda;
}

public(package) fun set_protocol_fee<A, B>(pool: &mut Pool<A, B>, new_protocol_fee: u32) {
    pool.protocol_fee = new_protocol_fee;
}

/// Get all pool parameters at once for efficient reading
public fun get_parameters<A, B>(pool: &Pool<A, B>): (u32, u64, u64, u32) {
    (pool.fee, pool.k, pool.lambda, pool.protocol_fee)
}
