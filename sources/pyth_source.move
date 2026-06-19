module brownfi_amm::pyth_source;

use sui::clock::{Self, Clock};
use pyth::i64;
use pyth::price;
use pyth::price_info::PriceInfoObject;
use pyth::pyth;
use brownfi_amm::oracle_gateway::{Self, PriceReading};
use brownfi_amm::pool::{Self, Pool};
use brownfi_oracle::pyth_adapter;

const PRICE_DECIMALS: u8 = 9;
const EOraclePolicyMismatch: u64 = 1;

public fun read_price_a<A, B>(
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceReading {
    read_price_for_token(
        price_info_object,
        clock,
        pool::oracle_max_price_age(pool),
        pool::oracle_source_type_a(pool),
        pool::oracle_source_id_a(pool),
        pool::oracle_config_data_a(pool)
    )
}

public fun read_price_b<A, B>(
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceReading {
    read_price_for_token(
        price_info_object,
        clock,
        pool::oracle_max_price_age(pool),
        pool::oracle_source_type_b(pool),
        pool::oracle_source_id_b(pool),
        pool::oracle_config_data_b(pool)
    )
}

fun read_price_for_token(
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_price_age: u64,
    expected_source_type: vector<u8>,
    expected_source_id: ID,
    expected_feed_id: vector<u8>
): PriceReading {
    assert!(expected_source_type == b"pyth", EOraclePolicyMismatch);

    let (price_q, upper_q, lower_q) =
        pyth_adapter::get_price_with_bounds(price_info_object, clock, expected_feed_id, max_price_age);
    let source_price = pyth::get_price_no_older_than(price_info_object, clock, max_price_age);
    let expo = price::get_expo(&source_price);
    let expo_negative = i64::get_is_negative(&expo);
    let expo_magnitude = if (expo_negative) {
        i64::get_magnitude_if_negative(&expo)
    } else {
        i64::get_magnitude_if_positive(&expo)
    };

    let (publish_time_ms, valid_until_ms) =
        oracle_gateway::pyth_validity_window_ms(price::get_timestamp(&source_price), max_price_age);
    oracle_gateway::new_price_reading(
        pool::oracle_source_pyth(),
        pool::oracle_source_mask_pyth(),
        expected_source_id,
        expected_feed_id,
        price_q,
        upper_q,
        lower_q,
        upper_q - price_q,
        publish_time_ms,
        valid_until_ms,
        expo_negative,
        expo_magnitude,
        PRICE_DECIMALS
    )
}
