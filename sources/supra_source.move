module brownfi_amm::supra_source;

use sui::bcs;
use sui::clock::{Self, Clock};
use sui::object;
use SupraOracle::SupraSValueFeed::{Self, OracleHolder};
use brownfi_amm::oracle_gateway::{Self, PriceReading};
use brownfi_amm::pool::{Self, Pool};

const PRICE_DECIMALS: u8 = 9;
const PRICE_DECIMALS_U16: u16 = 9;
const U64_MAX: u128 = 18_446_744_073_709_551_615;
const MILLIS_PER_SECOND: u64 = 1000;

const EOraclePolicyMismatch: u64 = 1;
const EInvalidValue: u64 = 2;

public fun read_push_price_a<A, B>(
    supra_holder: &OracleHolder,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceReading {
    read_push_price_for_token(
        supra_holder,
        clock,
        pool::oracle_max_price_age(pool),
        pool::oracle_source_type_a(pool),
        pool::oracle_source_id_a(pool),
        pool::oracle_config_data_a(pool)
    )
}

public fun read_push_price_b<A, B>(
    supra_holder: &OracleHolder,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceReading {
    read_push_price_for_token(
        supra_holder,
        clock,
        pool::oracle_max_price_age(pool),
        pool::oracle_source_type_b(pool),
        pool::oracle_source_id_b(pool),
        pool::oracle_config_data_b(pool)
    )
}

fun read_push_price_for_token(
    supra_holder: &OracleHolder,
    clock: &Clock,
    max_price_age: u64,
    expected_source_type: vector<u8>,
    expected_holder_id: ID,
    expected_pair_id_config: vector<u8>
): PriceReading {
    assert!(expected_source_type == b"supra", EOraclePolicyMismatch);
    assert!(object::id(supra_holder) == expected_holder_id, EOraclePolicyMismatch);

    let pair_id = pair_id_from_config(expected_pair_id_config);
    let (value, decimals, timestamp, _round) = SupraSValueFeed::get_price(supra_holder, pair_id);
    let price_q = normalize_price_to_9(value, decimals);
    let publish_time_ms = timestamp_to_ms(timestamp);
    let valid_until_ms = publish_time_ms + max_price_age * MILLIS_PER_SECOND;
    assert!(publish_time_ms <= clock::timestamp_ms(clock), EInvalidValue);
    assert!(valid_until_ms >= clock::timestamp_ms(clock), EInvalidValue);

    oracle_gateway::new_price_reading(
        pool::oracle_source_supra(),
        pool::oracle_source_mask_supra(),
        expected_holder_id,
        expected_pair_id_config,
        price_q,
        price_q,
        price_q,
        0,
        publish_time_ms,
        valid_until_ms,
        true,
        (decimals as u64),
        PRICE_DECIMALS
    )
}

public fun pair_id_config(pair_id: u32): vector<u8> {
    bcs::to_bytes(&pair_id)
}

fun pair_id_from_config(config: vector<u8>): u32 {
    let mut cursor = bcs::new(config);
    let pair_id = cursor.peel_u32();
    assert!(cursor.into_remainder_bytes().length() == 0, EOraclePolicyMismatch);
    pair_id
}

fun normalize_price_to_9(value: u128, decimals: u16): u64 {
    let scaled = if (decimals == PRICE_DECIMALS_U16) {
        value
    } else if (decimals < PRICE_DECIMALS_U16) {
        value * pow10(PRICE_DECIMALS_U16 - decimals)
    } else {
        value / pow10(decimals - PRICE_DECIMALS_U16)
    };
    assert!(scaled > 0 && scaled <= U64_MAX, EInvalidValue);
    (scaled as u64)
}

fun pow10(exp: u16): u128 {
    let mut result = 1u128;
    let mut i = 0u16;
    while (i < exp) {
        result = result * 10;
        i = i + 1;
    };
    result
}

fun timestamp_to_ms(timestamp: u128): u64 {
    assert!(timestamp <= U64_MAX, EInvalidValue);
    (timestamp as u64)
}

#[test_only]
public(package) fun normalize_price_to_9_for_test(value: u128, decimals: u16): u64 {
    normalize_price_to_9(value, decimals)
}
