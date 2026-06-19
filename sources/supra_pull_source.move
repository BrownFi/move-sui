module brownfi_amm::supra_pull_source;

use std::vector;
use sui::bcs;
use sui::clock::{Self, Clock};
use sui::object;
use sui::tx_context::TxContext;
use SupraOracle::SupraSValueFeed::OracleHolder;
use SupraOracle::price_data_pull_v2::{Self, MerkleRootHash};
use supra_validator::validator_v2::DkgState;
use brownfi_amm::oracle_gateway::{Self, AmmReading, PriceBundle, PriceReading};
use brownfi_amm::pool::{Self, Pool};

const PRICE_DECIMALS: u8 = 9;
const PRICE_DECIMALS_U16: u16 = 9;
const U64_MAX: u128 = 18_446_744_073_709_551_615;
const MAX_TIMESTAMP_SECONDS: u64 = 18_446_744_073_709_551;
const MILLIS_PER_SECOND: u64 = 1000;

const EOraclePolicyMismatch: u64 = 1;
const EInvalidValue: u64 = 2;

public fun read_price_bundle<A, B>(
    dkg_state: &DkgState,
    supra_holder: &mut OracleHolder,
    merkle_root_hash: &mut MerkleRootHash,
    clock: &Clock,
    proof_bytes: vector<u8>,
    pool: &Pool<A, B>,
    ctx: &mut TxContext
): PriceBundle {
    let (reading_a, reading_b) = read_pull_readings<A, B>(
        dkg_state,
        supra_holder,
        merkle_root_hash,
        clock,
        proof_bytes,
        pool,
        ctx
    );
    oracle_gateway::get_swap_price_bundle_from_readings(&reading_a, &reading_b, clock, pool)
}

public fun read_price_bundle_with_amm_readings<A, B>(
    dkg_state: &DkgState,
    supra_holder: &mut OracleHolder,
    merkle_root_hash: &mut MerkleRootHash,
    clock: &Clock,
    proof_bytes: vector<u8>,
    pool: &Pool<A, B>,
    amm_readings: vector<AmmReading>,
    ctx: &mut TxContext
): PriceBundle {
    let (reading_a, reading_b) = read_pull_readings<A, B>(
        dkg_state,
        supra_holder,
        merkle_root_hash,
        clock,
        proof_bytes,
        pool,
        ctx
    );
    let mut readings_a = vector[];
    let mut readings_b = vector[];
    vector::push_back(&mut readings_a, reading_a);
    vector::push_back(&mut readings_b, reading_b);
    oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
        &readings_a,
        &readings_b,
        &amm_readings,
        clock,
        pool
    )
}

fun read_pull_readings<A, B>(
    dkg_state: &DkgState,
    supra_holder: &mut OracleHolder,
    merkle_root_hash: &mut MerkleRootHash,
    clock: &Clock,
    proof_bytes: vector<u8>,
    pool: &Pool<A, B>,
    ctx: &mut TxContext
): (PriceReading, PriceReading) {
    let holder_id = object::id(supra_holder);
    let source_id_a = pool::oracle_source_id_a(pool);
    let source_id_b = pool::oracle_source_id_b(pool);
    let config_a = pool::oracle_config_data_a(pool);
    let config_b = pool::oracle_config_data_b(pool);

    assert!(pool::oracle_source_type_a(pool) == b"supra", EOraclePolicyMismatch);
    assert!(pool::oracle_source_type_b(pool) == b"supra", EOraclePolicyMismatch);
    assert!(source_id_a == holder_id && source_id_b == holder_id, EOraclePolicyMismatch);

    let pair_id_a = pair_id_from_config(config_a);
    let pair_id_b = pair_id_from_config(config_b);
    let mut price_datas = price_data_pull_v2::verify_oracle_proof(
        dkg_state,
        supra_holder,
        merkle_root_hash,
        clock,
        proof_bytes,
        ctx
    );

    let mut found_a = false;
    let mut value_a = 0u128;
    let mut timestamp_a = 0u64;
    let mut decimals_a = 0u16;
    let mut found_b = false;
    let mut value_b = 0u128;
    let mut timestamp_b = 0u64;
    let mut decimals_b = 0u16;

    while (!vector::is_empty(&price_datas)) {
        let price_data = vector::pop_back(&mut price_datas);
        let (pair_id, value, timestamp, decimals, _round) =
            price_data_pull_v2::price_data_split(&price_data);
        if (pair_id == pair_id_a && !found_a) {
            found_a = true;
            value_a = value;
            timestamp_a = timestamp;
            decimals_a = decimals;
        };
        if (pair_id == pair_id_b && !found_b) {
            found_b = true;
            value_b = value;
            timestamp_b = timestamp;
            decimals_b = decimals;
        };
    };
    assert!(found_a && found_b, EInvalidValue);

    (
        new_pull_price_reading(
            holder_id,
            pool::oracle_config_data_a(pool),
            value_a,
            decimals_a,
            timestamp_a,
            pool::oracle_max_price_age(pool),
            clock
        ),
        new_pull_price_reading(
            holder_id,
            pool::oracle_config_data_b(pool),
            value_b,
            decimals_b,
            timestamp_b,
            pool::oracle_max_price_age(pool),
            clock
        )
    )
}

fun new_pull_price_reading(
    holder_id: ID,
    pair_id_config: vector<u8>,
    value: u128,
    decimals: u16,
    timestamp_seconds: u64,
    max_price_age: u64,
    clock: &Clock
): PriceReading {
    let price_q = normalize_price_to_9(value, decimals);
    let publish_time_ms = timestamp_seconds_to_ms(timestamp_seconds);
    let valid_until_ms = publish_time_ms + max_price_age * MILLIS_PER_SECOND;
    assert!(publish_time_ms <= clock::timestamp_ms(clock), EInvalidValue);
    assert!(valid_until_ms >= clock::timestamp_ms(clock), EInvalidValue);

    oracle_gateway::new_price_reading(
        pool::oracle_source_supra(),
        pool::oracle_source_mask_supra(),
        holder_id,
        pair_id_config,
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

fun timestamp_seconds_to_ms(timestamp_seconds: u64): u64 {
    assert!(timestamp_seconds <= MAX_TIMESTAMP_SECONDS, EInvalidValue);
    timestamp_seconds * MILLIS_PER_SECOND
}

#[test_only]
public(package) fun normalize_price_to_9_for_test(value: u128, decimals: u16): u64 {
    normalize_price_to_9(value, decimals)
}

#[test_only]
public(package) fun timestamp_seconds_to_ms_for_test(timestamp_seconds: u64): u64 {
    timestamp_seconds_to_ms(timestamp_seconds)
}
