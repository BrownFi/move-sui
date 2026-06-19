module brownfi_amm::flash;

use std::type_name;
use sui::balance::{Self, Balance};
use sui::coin::{Self, Coin};
use sui::clock::Clock;
use brownfi_amm::events;
use brownfi_amm::math;
use brownfi_amm::oracle_gateway::{Self, PriceBundle};
use brownfi_amm::pool::{Self, Pool};

const EFlashDisabled: u64 = 1;
const EZeroAmount: u64 = 2;
const EInsufficientLiquidity: u64 = 3;
const EFlashPoolMismatch: u64 = 4;
const EFlashDirectionMismatch: u64 = 5;
const EFlashPolicyMismatch: u64 = 6;
const EInvalidRepayment: u64 = 7;
const EFlashBalanceInvariant: u64 = 8;
const EFlashPriceBundleMismatch: u64 = 9;
const EFlashBalanceCap: u64 = 10;

const DIRECTION_A: u8 = 0;
const DIRECTION_B: u8 = 1;
const PRECISION: u128 = 100_000_000;
const MAX_POOL_BALANCE: u64 = 1_000_000_000_000_000_000;

public struct FlashReceipt<phantom A, phantom B> {
    pool_id: ID,
    direction: u8,
    borrowed_amount: u64,
    amount_due: u64,
    fee_amount: u64,
    pre_balance_a: u64,
    pre_balance_b: u64,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
}

public fun borrow_a<A, B>(
    pool: &mut Pool<A, B>,
    bundle: &PriceBundle,
    clock: &Clock,
    amount: u64
): (Balance<A>, FlashReceipt<A, B>) {
    assert!(pool::flash_enabled(pool), EFlashDisabled);
    assert!(amount > 0, EZeroAmount);
    oracle_gateway::assert_bundle_valid_for_pool(bundle, pool, clock);
    assert!(amount <= pool::balance_a(pool), EInsufficientLiquidity);

    let fee_amount = flash_fee(amount, pool::fee(pool));
    assert_pool_balance_after_fee(pool::balance_a(pool), fee_amount);
    let amount_due = amount + fee_amount;
    let receipt = FlashReceipt<A, B> {
        pool_id: pool::id(pool),
        direction: DIRECTION_A,
        borrowed_amount: amount,
        amount_due,
        fee_amount,
        pre_balance_a: pool::balance_a(pool),
        pre_balance_b: pool::balance_b(pool),
        policy_version: oracle_gateway::bundle_policy_version(bundle),
        policy_digest: oracle_gateway::bundle_policy_digest(bundle),
        price_digest: oracle_gateway::bundle_price_digest(bundle),
    };

    events::emit_flash_borrowed(
        pool::id(pool),
        type_name::with_defining_ids<A>(),
        DIRECTION_A,
        amount,
        amount_due,
        fee_amount,
        oracle_gateway::bundle_policy_version(bundle),
        oracle_gateway::bundle_policy_digest(bundle),
        oracle_gateway::bundle_price_digest(bundle)
    );

    (pool::withdraw_a(pool, amount), receipt)
}

public fun borrow_a_with_coin<A, B>(
    pool: &mut Pool<A, B>,
    bundle: &PriceBundle,
    clock: &Clock,
    amount: u64,
    ctx: &mut TxContext
): (Coin<A>, FlashReceipt<A, B>) {
    let (borrowed, receipt) = borrow_a(pool, bundle, clock, amount);
    (coin::from_balance(borrowed, ctx), receipt)
}

public fun borrow_b<A, B>(
    pool: &mut Pool<A, B>,
    bundle: &PriceBundle,
    clock: &Clock,
    amount: u64
): (Balance<B>, FlashReceipt<A, B>) {
    assert!(pool::flash_enabled(pool), EFlashDisabled);
    assert!(amount > 0, EZeroAmount);
    oracle_gateway::assert_bundle_valid_for_pool(bundle, pool, clock);
    assert!(amount <= pool::balance_b(pool), EInsufficientLiquidity);

    let fee_amount = flash_fee(amount, pool::fee(pool));
    assert_pool_balance_after_fee(pool::balance_b(pool), fee_amount);
    let amount_due = amount + fee_amount;
    let receipt = FlashReceipt<A, B> {
        pool_id: pool::id(pool),
        direction: DIRECTION_B,
        borrowed_amount: amount,
        amount_due,
        fee_amount,
        pre_balance_a: pool::balance_a(pool),
        pre_balance_b: pool::balance_b(pool),
        policy_version: oracle_gateway::bundle_policy_version(bundle),
        policy_digest: oracle_gateway::bundle_policy_digest(bundle),
        price_digest: oracle_gateway::bundle_price_digest(bundle),
    };

    events::emit_flash_borrowed(
        pool::id(pool),
        type_name::with_defining_ids<B>(),
        DIRECTION_B,
        amount,
        amount_due,
        fee_amount,
        oracle_gateway::bundle_policy_version(bundle),
        oracle_gateway::bundle_policy_digest(bundle),
        oracle_gateway::bundle_price_digest(bundle)
    );

    (pool::withdraw_b(pool, amount), receipt)
}

public fun borrow_b_with_coin<A, B>(
    pool: &mut Pool<A, B>,
    bundle: &PriceBundle,
    clock: &Clock,
    amount: u64,
    ctx: &mut TxContext
): (Coin<B>, FlashReceipt<A, B>) {
    let (borrowed, receipt) = borrow_b(pool, bundle, clock, amount);
    (coin::from_balance(borrowed, ctx), receipt)
}

public fun repay_a<A, B>(
    pool: &mut Pool<A, B>,
    bundle: &PriceBundle,
    clock: &Clock,
    repayment: Balance<A>,
    receipt: FlashReceipt<A, B>
) {
    assert!(pool::flash_enabled(pool), EFlashDisabled);
    let FlashReceipt {
        pool_id,
        direction,
        borrowed_amount: _,
        amount_due,
        fee_amount,
        pre_balance_a,
        pre_balance_b,
        policy_version,
        policy_digest,
        price_digest,
    } = receipt;

    assert!(pool_id == pool::id(pool), EFlashPoolMismatch);
    assert!(direction == DIRECTION_A, EFlashDirectionMismatch);
    assert!(policy_version == pool::oracle_policy_version(pool), EFlashPolicyMismatch);
    assert!(policy_version == oracle_gateway::bundle_policy_version(bundle), EFlashPolicyMismatch);
    assert!(policy_digest == oracle_gateway::bundle_policy_digest(bundle), EFlashPolicyMismatch);
    assert!(price_digest == oracle_gateway::bundle_price_digest(bundle), EFlashPriceBundleMismatch);
    oracle_gateway::assert_bundle_valid_for_pool(bundle, pool, clock);
    assert!(balance::value(&repayment) == amount_due, EInvalidRepayment);

    pool::deposit_a(pool, repayment);
    assert!(pool::balance_a(pool) == pre_balance_a + fee_amount, EFlashBalanceInvariant);
    assert!(pool::balance_b(pool) == pre_balance_b, EFlashBalanceInvariant);

    events::emit_flash_repaid(
        pool_id,
        type_name::with_defining_ids<A>(),
        DIRECTION_A,
        amount_due,
        fee_amount,
        policy_version,
        policy_digest,
        price_digest
    );
}

public fun repay_a_with_coin<A, B>(
    pool: &mut Pool<A, B>,
    bundle: &PriceBundle,
    clock: &Clock,
    repayment: Coin<A>,
    receipt: FlashReceipt<A, B>
) {
    repay_a(pool, bundle, clock, coin::into_balance(repayment), receipt);
}

public fun repay_b<A, B>(
    pool: &mut Pool<A, B>,
    bundle: &PriceBundle,
    clock: &Clock,
    repayment: Balance<B>,
    receipt: FlashReceipt<A, B>
) {
    assert!(pool::flash_enabled(pool), EFlashDisabled);
    let FlashReceipt {
        pool_id,
        direction,
        borrowed_amount: _,
        amount_due,
        fee_amount,
        pre_balance_a,
        pre_balance_b,
        policy_version,
        policy_digest,
        price_digest,
    } = receipt;

    assert!(pool_id == pool::id(pool), EFlashPoolMismatch);
    assert!(direction == DIRECTION_B, EFlashDirectionMismatch);
    assert!(policy_version == pool::oracle_policy_version(pool), EFlashPolicyMismatch);
    assert!(policy_version == oracle_gateway::bundle_policy_version(bundle), EFlashPolicyMismatch);
    assert!(policy_digest == oracle_gateway::bundle_policy_digest(bundle), EFlashPolicyMismatch);
    assert!(price_digest == oracle_gateway::bundle_price_digest(bundle), EFlashPriceBundleMismatch);
    oracle_gateway::assert_bundle_valid_for_pool(bundle, pool, clock);
    assert!(balance::value(&repayment) == amount_due, EInvalidRepayment);

    pool::deposit_b(pool, repayment);
    assert!(pool::balance_a(pool) == pre_balance_a, EFlashBalanceInvariant);
    assert!(pool::balance_b(pool) == pre_balance_b + fee_amount, EFlashBalanceInvariant);

    events::emit_flash_repaid(
        pool_id,
        type_name::with_defining_ids<B>(),
        DIRECTION_B,
        amount_due,
        fee_amount,
        policy_version,
        policy_digest,
        price_digest
    );
}

public fun repay_b_with_coin<A, B>(
    pool: &mut Pool<A, B>,
    bundle: &PriceBundle,
    clock: &Clock,
    repayment: Coin<B>,
    receipt: FlashReceipt<A, B>
) {
    repay_b(pool, bundle, clock, coin::into_balance(repayment), receipt);
}

public fun borrowed_amount<A, B>(receipt: &FlashReceipt<A, B>): u64 {
    receipt.borrowed_amount
}

public fun amount_due<A, B>(receipt: &FlashReceipt<A, B>): u64 {
    receipt.amount_due
}

public fun fee_amount<A, B>(receipt: &FlashReceipt<A, B>): u64 {
    receipt.fee_amount
}

fun flash_fee(amount: u64, fee: u32): u64 {
    math::mul_div_up_to_u64((amount as u128), (fee as u128), PRECISION)
}

fun assert_pool_balance_after_fee(pre_balance: u64, fee_amount: u64) {
    assert!(
        (pre_balance as u128) + (fee_amount as u128) <= (MAX_POOL_BALANCE as u128),
        EFlashBalanceCap
    );
}
