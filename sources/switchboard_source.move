module brownfi_amm::switchboard_source;

use sui::clock::{Self, Clock};
use switchboard::decimal;
use switchboard::quote::{Self, QuoteVerifier, Quotes};
use brownfi_amm::oracle_gateway::{Self, PriceReading};
use brownfi_amm::pool::{Self, Pool};

const PRICE_DECIMALS: u8 = 9;
const SWITCHBOARD_DECIMALS: u64 = 18;
const SWITCHBOARD_TO_BROWNFI_SCALE: u128 = 1_000_000_000;
const U64_MAX: u128 = 18_446_744_073_709_551_615;

const EOraclePolicyMismatch: u64 = 1;
const EInvalidQuote: u64 = 2;

public fun read_price_a<A, B>(
    quote_verifier: &mut QuoteVerifier,
    quotes: &Quotes,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceReading {
    read_price_for_token(
        quote_verifier,
        quotes,
        clock,
        pool::oracle_max_price_age(pool),
        pool::oracle_source_type_a(pool),
        pool::oracle_source_id_a(pool),
        pool::oracle_config_data_a(pool)
    )
}

public fun read_price_b<A, B>(
    quote_verifier: &mut QuoteVerifier,
    quotes: &Quotes,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceReading {
    read_price_for_token(
        quote_verifier,
        quotes,
        clock,
        pool::oracle_max_price_age(pool),
        pool::oracle_source_type_b(pool),
        pool::oracle_source_id_b(pool),
        pool::oracle_config_data_b(pool)
    )
}

fun read_price_for_token(
    quote_verifier: &mut QuoteVerifier,
    quotes: &Quotes,
    clock: &Clock,
    max_price_age: u64,
    expected_source_type: vector<u8>,
    expected_queue_id: ID,
    expected_feed_id: vector<u8>
): PriceReading {
    assert!(expected_source_type == b"switchboard", EOraclePolicyMismatch);
    assert!(quote::queue_id(quotes) == expected_queue_id, EOraclePolicyMismatch);

    quote::verify_quotes(quote_verifier, quotes, clock);
    assert!(quote::quote_exists(quote_verifier, expected_feed_id), EInvalidQuote);

    let verified_quote = quote::get_quote(quote_verifier, expected_feed_id);
    let result = quote::result(verified_quote);
    let price_q = normalize_decimal_to_9(
        decimal::value(&result),
        decimal::neg(&result)
    );
    let publish_time_ms = quote::timestamp_ms(verified_quote);
    let valid_until_ms = publish_time_ms + max_price_age * 1000;
    assert!(publish_time_ms <= clock::timestamp_ms(clock), EInvalidQuote);
    assert!(valid_until_ms >= clock::timestamp_ms(clock), EInvalidQuote);

    oracle_gateway::new_price_reading(
        pool::oracle_source_switchboard(),
        pool::oracle_source_mask_switchboard(),
        expected_queue_id,
        expected_feed_id,
        price_q,
        price_q,
        price_q,
        0,
        publish_time_ms,
        valid_until_ms,
        true,
        SWITCHBOARD_DECIMALS,
        PRICE_DECIMALS
    )
}

fun normalize_decimal_to_9(value: u128, neg: bool): u64 {
    assert!(!neg, EInvalidQuote);
    let scaled = value / SWITCHBOARD_TO_BROWNFI_SCALE;
    assert!(scaled <= U64_MAX, EInvalidQuote);
    (scaled as u64)
}

#[test_only]
public(package) fun normalize_decimal_to_9_for_test(value: u128, neg: bool): u64 {
    normalize_decimal_to_9(value, neg)
}
