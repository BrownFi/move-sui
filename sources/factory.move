module brownfi_amm::factory;

use std::type_name::{Self, TypeName};
use sui::table::{Self, Table};
use brownfi_amm::library;

const EInvalidPair: u64 = 1;
const EPoolAlreadyExists: u64 = 2;

public struct Factory has key {
    id: UID,
    table: Table<PoolItem, bool>,
}

public struct PoolItem has copy, drop, store {
    a: TypeName,
    b: TypeName
}

fun new(ctx: &mut TxContext): Factory {
    Factory {
        id: object::new(ctx),
        table: table::new(ctx),
    }
}

public fun create_and_share(ctx: &mut TxContext) {
    let factory_obj = new(ctx);
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

#[test_only]
public fun test_new(ctx: &mut TxContext): Factory {
    new(ctx)
}

#[test_only]
public fun test_destroy_empty(factory: Factory) {
    let Factory { id, table } = factory;
    object::delete(id);
    table::destroy_empty(table);
}

#[test_only]
public fun test_remove_pool<A, B>(factory: &mut Factory) {
    let a = type_name::with_defining_ids<A>();
    let b = type_name::with_defining_ids<B>();
    table::remove(&mut factory.table, PoolItem { a, b });
}
