module brownfi_amm::stork_source;

use sui::clock::{Self, Clock};
use sui::object;
use stork::i128;
use stork::state::StorkState;
use stork::stork;
use stork::temporal_numeric_value;
use brownfi_amm::oracle_gateway::{Self, PriceReading};
use brownfi_amm::pool::{Self, Pool};

const PRICE_DECIMALS: u8 = 9;
const STORK_DECIMALS: u64 = 18;
const STORK_TO_BROWNFI_SCALE: u128 = 1_000_000_000;
const NANOS_PER_MILLISECOND: u64 = 1_000_000;
const U64_MAX: u128 = 18_446_744_073_709_551_615;

const EOraclePolicyMismatch: u64 = 1;
const EInvalidValue: u64 = 2;

public fun read_price_a<A, B>(
    stork_state: &StorkState,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceReading {
    read_price_for_token(
        stork_state,
        clock,
        pool::oracle_max_price_age(pool),
        pool::oracle_source_type_a(pool),
        pool::oracle_source_id_a(pool),
        pool::oracle_config_data_a(pool)
    )
}

public fun read_price_b<A, B>(
    stork_state: &StorkState,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceReading {
    read_price_for_token(
        stork_state,
        clock,
        pool::oracle_max_price_age(pool),
        pool::oracle_source_type_b(pool),
        pool::oracle_source_id_b(pool),
        pool::oracle_config_data_b(pool)
    )
}

fun read_price_for_token(
    stork_state: &StorkState,
    clock: &Clock,
    max_price_age: u64,
    expected_source_type: vector<u8>,
    expected_state_id: ID,
    expected_feed_id: vector<u8>
): PriceReading {
    assert!(expected_source_type == b"stork", EOraclePolicyMismatch);
    assert!(object::id(stork_state) == expected_state_id, EOraclePolicyMismatch);

    let value = stork::get_temporal_numeric_value_unchecked(stork_state, expected_feed_id);
    let quantized_value = temporal_numeric_value::get_quantized_value(&value);
    let price_q = normalize_quantized_to_9(
        i128::get_magnitude(&quantized_value),
        i128::is_negative(&quantized_value)
    );
    let publish_time_ms =
        temporal_numeric_value::get_timestamp_ns(&value) / NANOS_PER_MILLISECOND;
    let valid_until_ms = publish_time_ms + max_price_age * 1000;
    assert!(publish_time_ms <= clock::timestamp_ms(clock), EInvalidValue);
    assert!(valid_until_ms >= clock::timestamp_ms(clock), EInvalidValue);

    oracle_gateway::new_price_reading(
        pool::oracle_source_stork(),
        pool::oracle_source_mask_stork(),
        expected_state_id,
        expected_feed_id,
        price_q,
        price_q,
        price_q,
        0,
        publish_time_ms,
        valid_until_ms,
        true,
        STORK_DECIMALS,
        PRICE_DECIMALS
    )
}

fun normalize_quantized_to_9(value: u128, negative: bool): u64 {
    assert!(!negative, EInvalidValue);
    let scaled = value / STORK_TO_BROWNFI_SCALE;
    assert!(scaled <= U64_MAX, EInvalidValue);
    (scaled as u64)
}

#[test_only]
public(package) fun normalize_quantized_to_9_for_test(value: u128, negative: bool): u64 {
    normalize_quantized_to_9(value, negative)
}
