module brownfi_amm::factory;

use std::type_name::{Self, TypeName};
use sui::table::{Self, Table};
use brownfi_amm::library;

const EInvalidPair: u64 = 1;
const EPoolAlreadyExists: u64 = 2;
#[allow(unused_const)]
const EPaused: u64 = 3;
#[allow(unused_const)]
const EUnauthorized: u64 = 4;

public struct Factory has key {
    id: UID,
    table: Table<PoolItem, bool>,
    /// Admin capability ID for access control
    admin: address,
    /// Oracle object ID for price feeds
    oracle: Option<ID>,
    /// Protocol fee recipient address
    fee_to: Option<address>,
    /// Global pause state
    paused: bool,
    /// Minimum price age for oracle queries (in seconds)
    min_price_age: u64,
}

public struct PoolItem has copy, drop, store {
    a: TypeName,
    b: TypeName
}

/// Admin capability for factory management
public struct AdminCap has key, store {
    id: UID,
}

fun new(admin: address, ctx: &mut TxContext): Factory {
    Factory {
        id: object::new(ctx),
        table: table::new(ctx),
        admin,
        oracle: option::none(),
        fee_to: option::none(),
        paused: false,
        min_price_age: 15, // Default 15 seconds
    }
}

#[allow(lint(self_transfer))]
public fun create_and_share(ctx: &mut TxContext) {
    let admin = tx_context::sender(ctx);
    let factory_obj = new(admin, ctx);
    
    // Create and transfer admin capability
    let admin_cap = AdminCap {
        id: object::new(ctx),
    };
    transfer::transfer(admin_cap, admin);
    
    transfer::share_object(factory_obj);
}

public fun register_pool<A, B>(factory: &mut Factory) {
    let a = type_name::with_defining_ids<A>();
    let b = type_name::with_defining_ids<B>();
    assert!(library::sort_names(&a, &b) == 0, EInvalidPair);

    let item = PoolItem { a, b };
    assert!(!table::contains(&factory.table, item), EPoolAlreadyExists);

    table::add(&mut factory.table, item, true)
}

public fun pool_exists<A, B>(factory: &Factory): bool {
    let a = type_name::with_defining_ids<A>();
    let b = type_name::with_defining_ids<B>();
    let item = PoolItem { a, b };
    table::contains(&factory.table, item)
}

/// Check if factory is paused
public fun is_paused(factory: &Factory): bool {
    factory.paused
}

/// Get fee recipient address
public fun fee_to(factory: &Factory): Option<address> {
    factory.fee_to
}

/// Get oracle ID
public fun oracle(factory: &Factory): Option<ID> {
    factory.oracle
}

/// Get minimum price age
public fun min_price_age(factory: &Factory): u64 {
    factory.min_price_age
}

/// Admin functions requiring AdminCap

/// Set pause state (admin only)
public fun set_paused(
    factory: &mut Factory,
    _admin_cap: &AdminCap,
    paused: bool
) {
    factory.paused = paused;
}

/// Set fee recipient (admin only)
public fun set_fee_to(
    factory: &mut Factory,
    _admin_cap: &AdminCap,
    fee_to: address
) {
    factory.fee_to = option::some(fee_to);
}

/// Set oracle (admin only)
public fun set_oracle(
    factory: &mut Factory,
    _admin_cap: &AdminCap,
    oracle_id: ID
) {
    factory.oracle = option::some(oracle_id);
}

/// Set minimum price age (admin only)
public fun set_min_price_age(
    factory: &mut Factory,
    _admin_cap: &AdminCap,
    age: u64
) {
    factory.min_price_age = age;
}

#[test_only]
public fun test_new(ctx: &mut TxContext): Factory {
    let admin = tx_context::sender(ctx);
    new(admin, ctx)
}

#[test_only]
public fun test_destroy_empty(factory: Factory) {
    let Factory { id, table, admin: _, fee_to: _, oracle: _, paused: _, min_price_age: _ } = factory;
    object::delete(id);
    table::destroy_empty(table);
}

#[test_only]
public fun test_remove_pool<A, B>(factory: &mut Factory) {
    let a = type_name::with_defining_ids<A>();
    let b = type_name::with_defining_ids<B>();
    table::remove(&mut factory.table, PoolItem { a, b });
}
