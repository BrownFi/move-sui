module brownfi_amm::library;

use std::type_name::{Self, TypeName};
use std::ascii;
use sui::balance::{Self, Balance};
use sui::coin;

const SORT_LESS: u8 = 0;
const SORT_EQUAL: u8 = 1;
const SORT_GREATER: u8 = 2;

public fun sort_less(): u8 { SORT_LESS }
public fun sort_equal(): u8 { SORT_EQUAL }
public fun sort_greater(): u8 { SORT_GREATER }

public fun sort_names(a: &TypeName, b: &TypeName): u8 {
    let bytes_a = ascii::as_bytes(type_name::as_string(a));
    let bytes_b = ascii::as_bytes(type_name::as_string(b));

    let len_a = vector::length(bytes_a);
    let len_b = vector::length(bytes_b);

    let mut i = 0;
    let n = std::u64::min(len_a, len_b);
    while (i < n) {
        let byte_a = *vector::borrow(bytes_a, i);
        let byte_b = *vector::borrow(bytes_b, i);

        if (byte_a < byte_b) {
            return SORT_LESS
        };
        if (byte_a > byte_b) {
            return SORT_GREATER
        };
        i = i + 1;
    };

    if (len_a == len_b) {
        SORT_EQUAL
    } else if (len_a < len_b) {
        SORT_LESS
    } else {
        SORT_GREATER
    }
}

public fun are_types_sorted<A, B>(): bool {
    let a = type_name::with_defining_ids<A>();
    let b = type_name::with_defining_ids<B>();
    sort_names(&a, &b) == SORT_LESS
}

public fun destroy_zero_or_transfer<T>(balance: Balance<T>, recipient: address, ctx: &mut TxContext) {
    if (balance::value(&balance) == 0) {
        balance::destroy_zero(balance);
    } else {
        transfer::public_transfer(coin::from_balance(balance, ctx), recipient);
    };
}

public fun min(a: u64, b: u64): u64 {
    if (a < b) a else b
}

public fun max(a: u64, b: u64): u64 {
    if (a > b) a else b
}

