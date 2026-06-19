module brownfi_amm::oracle_gateway;

use std::type_name::{Self, TypeName};
use std::vector;
use sui::bcs;
use sui::clock::{Self, Clock};
use sui::hash::keccak256;
use pyth::i64;
use pyth::price;
use pyth::price_info::PriceInfoObject;
use pyth::pyth;
use brownfi_amm::math;
use brownfi_amm::events;
use brownfi_amm::pool::{Self, Pool};
use brownfi_oracle::oracle::{Self, OracleAdapter};

const PRECISION: u64 = 100_000_000;
const Q32: u128 = 4294967296;
const STANDARD_DECIMALS: u8 = 9;
const MILLIS_PER_SECOND: u128 = 1000;
const U64_MAX: u128 = 18_446_744_073_709_551_615;

const EInvalidQuoteTokenIndex: u64 = 1;
const EInvalidPrice: u64 = 2;
const EBuyPriceTooLow: u64 = 3;
const EBundlePoolMismatch: u64 = 4;
const EBundleQuoteMismatch: u64 = 5;
const EBundleExpired: u64 = 6;
const EBundlePolicyMismatch: u64 = 7;
const EOracleSourceNotAllowed: u64 = 8;
const EOracleRequiredSourceMissing: u64 = 9;
const EOracleQuorumNotMet: u64 = 10;
const EAmmQuorumNotMet: u64 = 11;
const EAmmBlendUnavailable: u64 = 12;
const EOracleDiscrepancyTooHigh: u64 = 13;
const EOraclePolicyMismatch: u64 = 14;

const PYTH_SOURCE_COUNT: u8 = 1;
const NO_AMM_SOURCE_COUNT: u8 = 0;

public struct PriceReading has drop {
    source: u8,
    source_mask: u64,
    source_id: ID,
    feed_id: vector<u8>,
    price_q: u64,
    upper_q: u64,
    lower_q: u64,
    confidence_q: u64,
    publish_time_ms: u64,
    valid_until_ms: u64,
    expo_negative: bool,
    expo_magnitude: u64,
    decimals: u8,
}

public struct AmmReading has drop {
    pool_id: ID,
    source_mask: u64,
    source_id: ID,
    secondary_source_id: Option<ID>,
    relative_price_q32: u64,
    liquidity_quote: u128,
    window_seconds: u64,
    observed_at_ms: u64,
    valid_until_ms: u64,
}

public struct PriceBundle has drop {
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    quote_token_index: u8,
    created_at_ms: u64,
    valid_until_ms: u64,
    price_digest: vector<u8>,
    pyth_price_a: u64,
    pyth_price_b: u64,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    adj_price: u64,
    sell_price: u64,
    buy_price: u64,
    o_spread: u64,
    source_count: u8,
    amm_source_count: u8,
}

public struct OraclePolicyDigestInput has drop {
    oracle_max_price_age: u64,
    oracle_min_sources: u8,
    oracle_required_source_mask: u64,
    oracle_allowed_source_mask: u64,
    oracle_primary_source: u8,
    oracle_max_pair_time_delta_ms: u64,
    oracle_max_confidence: u64,
    oracle_max_deviation: u64,
    oracle_mode: u8,
    oracle_source_type_a: vector<u8>,
    oracle_source_type_b: vector<u8>,
    oracle_source_id_a: ID,
    oracle_source_id_b: ID,
    oracle_config_data_a: vector<u8>,
    oracle_config_data_b: vector<u8>,
}

public struct AmmPolicyDigestInput has drop {
    amm_twap_enabled: bool,
    amm_blend_weight: u32,
    amm_min_sources: u8,
    amm_fallback_mode: u8,
    amm_max_ospread: u32,
    amm_min_liquidity_quote: u128,
    amm_min_window_seconds: u64,
    amm_max_window_seconds: u64,
    amm_allowed_source_mask: u64,
    amm_allowed_source_ids: vector<ID>,
    amm_source_count_limit: u8,
}

public struct PolicyDigestInput has drop {
    pool_id: ID,
    base_type: TypeName,
    quote_type: TypeName,
    policy_version: u64,
    quote_token_index: u8,
    fee: u32,
    lambda: u64,
    oracle: OraclePolicyDigestInput,
    amm: AmmPolicyDigestInput,
    compress: u32,
    s_sell: u32,
    s_buy: u32,
    fix_s: u32,
    dis_threshold: u32,
    s_bound: u32,
    pyth_weight: u32,
}

public struct PriceDigestInput has drop {
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    quote_token_index: u8,
    created_at_ms: u64,
    valid_until_ms: u64,
    pyth_price_a: u64,
    pyth_price_b: u64,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    adj_price: u64,
    sell_price: u64,
    buy_price: u64,
    o_spread: u64,
    source_count: u8,
    amm_source_count: u8,
    oracle_digest: vector<u8>,
    amm_digest: vector<u8>,
}

public struct OracleReadingDigestInput has drop {
    source: u8,
    source_mask: u64,
    source_id: ID,
    feed_id: vector<u8>,
    price_q: u64,
    upper_q: u64,
    lower_q: u64,
    confidence_q: u64,
    publish_time_ms: u64,
    valid_until_ms: u64,
    expo_negative: bool,
    expo_magnitude: u64,
    decimals: u8,
}

public struct OraclePairDigestInput has drop {
    source: u8,
    source_mask: u64,
    pair_valid_until_ms: u64,
    relative_price_q32: u64,
    reading_a: OracleReadingDigestInput,
    reading_b: OracleReadingDigestInput,
}

public struct OracleCandidate has copy, drop {
    relative_price_q32: u64,
    index: u64,
}

public struct ResolvedOracleReadings has drop {
    price_a: u64,
    upper_a: u64,
    lower_a: u64,
    price_b: u64,
    upper_b: u64,
    lower_b: u64,
    relative_price_q32: u64,
    valid_until_ms: u64,
    source_count: u8,
    source_mask: u64,
    oracle_digest: vector<u8>,
}

public struct OracleDigestInput has drop {
    primary_relative_price_q32: u64,
    source_mask: u64,
    source_count: u8,
    valid_until_ms: u64,
    pairs: vector<OraclePairDigestInput>,
}

public struct AmmReadingDigestInput has drop {
    pool_id: ID,
    source_mask: u64,
    source_id: ID,
    secondary_source_id: Option<ID>,
    relative_price_q32: u64,
    liquidity_quote: u128,
    window_seconds: u64,
    observed_at_ms: u64,
    valid_until_ms: u64,
}

public struct AmmDigestInput has drop {
    aggregate_relative_price_q32: u64,
    total_liquidity_quote: u256,
    source_mask: u64,
    source_count: u8,
    valid_until_ms: u64,
    readings: vector<AmmReadingDigestInput>,
}

public fun get_swap_prices<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>
): (u64, u64, u64, u64, u64) {
    let bundle = get_swap_price_bundle(oracle, price_info_object_a, price_info_object_b, clock, pool);
    (
        bundle_pyth_price_a(&bundle),
        bundle_pyth_price_b(&bundle),
        bundle_adj_price(&bundle),
        bundle_sell_price(&bundle),
        bundle_buy_price(&bundle)
    )
}

public fun get_swap_price_bundle<A, B>(
    oracle: &OracleAdapter,
    price_info_object_a: &PriceInfoObject,
    price_info_object_b: &PriceInfoObject,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceBundle {
    assert_oracle_policy_matches<A, B>(oracle, pool);
    let max_price_age = pool::oracle_max_price_age(pool);
    let reading_a = read_pyth_price_for_token<A>(
        oracle,
        price_info_object_a,
        clock,
        max_price_age,
        pool::oracle_source_id_a(pool),
        pool::oracle_config_data_a(pool)
    );
    let reading_b = read_pyth_price_for_token<B>(
        oracle,
        price_info_object_b,
        clock,
        max_price_age,
        pool::oracle_source_id_b(pool),
        pool::oracle_config_data_b(pool)
    );
    get_swap_price_bundle_from_readings(&reading_a, &reading_b, clock, pool)
}

fun read_pyth_price_for_token<T>(
    oracle: &OracleAdapter,
    price_info_object: &PriceInfoObject,
    clock: &Clock,
    max_price_age: u64,
    expected_source_id: ID,
    expected_feed_id: vector<u8>
): PriceReading {
    assert!(oracle::get_source_id<T>(oracle) == expected_source_id, EOraclePolicyMismatch);
    assert!(oracle::get_config_data<T>(oracle) == expected_feed_id, EOraclePolicyMismatch);

    let (price_q, upper_q, lower_q) =
        oracle::get_price_with_bounds<T>(oracle, price_info_object, clock, max_price_age);
    let source_price = pyth::get_price_no_older_than(price_info_object, clock, max_price_age);
    let expo = price::get_expo(&source_price);
    let expo_negative = i64::get_is_negative(&expo);
    let expo_magnitude = if (expo_negative) {
        i64::get_magnitude_if_negative(&expo)
    } else {
        i64::get_magnitude_if_positive(&expo)
    };

    let (publish_time_ms, valid_until_ms) =
        pyth_validity_window_ms(price::get_timestamp(&source_price), max_price_age);
    new_price_reading(
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
        STANDARD_DECIMALS
    )
}

public fun get_swap_price_bundle_from_readings<A, B>(
    reading_a: &PriceReading,
    reading_b: &PriceReading,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceBundle {
    assert_reading_pair_matches_policy(reading_a, reading_b, clock, pool);
    let valid_until_ms = if (reading_a.valid_until_ms < reading_b.valid_until_ms) {
        reading_a.valid_until_ms
    } else {
        reading_b.valid_until_ms
    };
    let quote_token_index = pool::quote_token_index(pool);
    assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);
    let relative_price_q32 = relative_price_for_quote_index(
        reading_a.price_q,
        reading_b.price_q,
        quote_token_index
    );
    let mut oracle_pairs = vector[];
    vector::push_back(
        &mut oracle_pairs,
        oracle_pair_digest_input(reading_a, reading_b, quote_token_index, valid_until_ms)
    );
    let oracle_digest = oracle_digest_for_fields(
        relative_price_q32,
        reading_a.source_mask,
        PYTH_SOURCE_COUNT,
        valid_until_ms,
        oracle_pairs
    );
    new_swap_price_bundle_from_fields<A, B>(
        reading_a.price_q,
        reading_a.upper_q,
        reading_a.lower_q,
        reading_b.price_q,
        reading_b.upper_q,
        reading_b.lower_q,
        valid_until_ms,
        PYTH_SOURCE_COUNT,
        reading_a.source_mask,
        NO_AMM_SOURCE_COUNT,
        oracle_digest,
        clock,
        pool
    )
}

public fun get_swap_price_bundle_from_reading_pairs<A, B>(
    readings_a: &vector<PriceReading>,
    readings_b: &vector<PriceReading>,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceBundle {
    let len = vector::length(readings_a);
    assert!(len > 0 && len == vector::length(readings_b), EOracleQuorumNotMet);
    if (pool::oracle_mode(pool) == pool::oracle_mode_median()) {
        return get_swap_price_bundle_from_reading_pairs_median(
            readings_a,
            readings_b,
            clock,
            pool
        )
    };
    assert!(
        pool::oracle_mode(pool) == pool::oracle_mode_primary_with_sanity(),
        EOraclePolicyMismatch
    );

    let primary_source = pool::oracle_primary_source(pool);
    let mut has_primary = false;
    let mut primary_price_a = 0;
    let mut primary_upper_a = 0;
    let mut primary_lower_a = 0;
    let mut primary_price_b = 0;
    let mut primary_upper_b = 0;
    let mut primary_lower_b = 0;
    let mut i = 0;
    while (i < len) {
        let reading_a = vector::borrow(readings_a, i);
        let reading_b = vector::borrow(readings_b, i);
        assert_reading_pair_matches_policy(reading_a, reading_b, clock, pool);
        if (reading_a.source == primary_source) {
            assert!(!has_primary, EOraclePolicyMismatch);
            has_primary = true;
            primary_price_a = reading_a.price_q;
            primary_upper_a = reading_a.upper_q;
            primary_lower_a = reading_a.lower_q;
            primary_price_b = reading_b.price_q;
            primary_upper_b = reading_b.upper_q;
            primary_lower_b = reading_b.lower_q;
        };
        i = i + 1;
    };
    assert!(has_primary, EOracleRequiredSourceMissing);

    let quote_token_index = pool::quote_token_index(pool);
    assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);
    let primary_rel_price = relative_price_for_quote_index(
        primary_price_a,
        primary_price_b,
        quote_token_index
    );
    let max_deviation = pool::oracle_max_deviation(pool);
    let mut source_mask = 0;
    let mut source_count = 0u64;
    let mut valid_until_ms = 0;
    let mut oracle_pairs = vector[];
    i = 0;
    while (i < len) {
        let reading_a = vector::borrow(readings_a, i);
        let reading_b = vector::borrow(readings_b, i);
        assert!((source_mask & reading_a.source_mask) == 0, EOraclePolicyMismatch);
        source_mask = source_mask | reading_a.source_mask;

        let pair_valid_until = if (reading_a.valid_until_ms < reading_b.valid_until_ms) {
            reading_a.valid_until_ms
        } else {
            reading_b.valid_until_ms
        };
        if (source_count == 0 || pair_valid_until < valid_until_ms) {
            valid_until_ms = pair_valid_until;
        };

        let candidate_rel_price = relative_price_for_quote_index(
            reading_a.price_q,
            reading_b.price_q,
            quote_token_index
        );
        if (reading_a.source != primary_source && max_deviation > 0) {
            assert_relative_deviation_within(primary_rel_price, candidate_rel_price, max_deviation);
        };
        vector::push_back(
            &mut oracle_pairs,
            oracle_pair_digest_input(reading_a, reading_b, quote_token_index, pair_valid_until)
        );

        source_count = source_count + 1;
        i = i + 1;
    };
    assert!(source_count <= 255, EOracleQuorumNotMet);
    let source_count_u8 = source_count as u8;
    let oracle_digest = oracle_digest_for_fields(
        primary_rel_price,
        source_mask,
        source_count_u8,
        valid_until_ms,
        oracle_pairs
    );

    new_swap_price_bundle_from_fields<A, B>(
        primary_price_a,
        primary_upper_a,
        primary_lower_a,
        primary_price_b,
        primary_upper_b,
        primary_lower_b,
        valid_until_ms,
        source_count_u8,
        source_mask,
        NO_AMM_SOURCE_COUNT,
        oracle_digest,
        clock,
        pool
    )
}

fun get_swap_price_bundle_from_reading_pairs_median<A, B>(
    readings_a: &vector<PriceReading>,
    readings_b: &vector<PriceReading>,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceBundle {
    let resolved = resolve_oracle_reading_pairs_median(readings_a, readings_b, clock, pool);
    new_swap_price_bundle_from_fields<A, B>(
        resolved.price_a,
        resolved.upper_a,
        resolved.lower_a,
        resolved.price_b,
        resolved.upper_b,
        resolved.lower_b,
        resolved.valid_until_ms,
        resolved.source_count,
        resolved.source_mask,
        NO_AMM_SOURCE_COUNT,
        resolved.oracle_digest,
        clock,
        pool
    )
}

fun resolve_oracle_reading_pairs_median<A, B>(
    readings_a: &vector<PriceReading>,
    readings_b: &vector<PriceReading>,
    clock: &Clock,
    pool: &Pool<A, B>
): ResolvedOracleReadings {
    let len = vector::length(readings_a);
    assert!(len > 0 && len == vector::length(readings_b), EOracleQuorumNotMet);
    let quote_token_index = pool::quote_token_index(pool);
    assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);

    let mut source_mask = 0;
    let mut source_count = 0u64;
    let mut valid_until_ms = 0;
    let mut oracle_pairs = vector[];
    let mut candidates = vector[];
    let mut i = 0;
    while (i < len) {
        let reading_a = vector::borrow(readings_a, i);
        let reading_b = vector::borrow(readings_b, i);
        assert_reading_pair_matches_policy(reading_a, reading_b, clock, pool);
        assert!((source_mask & reading_a.source_mask) == 0, EOraclePolicyMismatch);
        source_mask = source_mask | reading_a.source_mask;

        let pair_valid_until = if (reading_a.valid_until_ms < reading_b.valid_until_ms) {
            reading_a.valid_until_ms
        } else {
            reading_b.valid_until_ms
        };
        if (source_count == 0 || pair_valid_until < valid_until_ms) {
            valid_until_ms = pair_valid_until;
        };

        let candidate_rel_price = relative_price_for_quote_index(
            reading_a.price_q,
            reading_b.price_q,
            quote_token_index
        );
        insert_oracle_candidate_sorted(
            &mut candidates,
            OracleCandidate { relative_price_q32: candidate_rel_price, index: i }
        );
        vector::push_back(
            &mut oracle_pairs,
            oracle_pair_digest_input(reading_a, reading_b, quote_token_index, pair_valid_until)
        );

        source_count = source_count + 1;
        i = i + 1;
    };
    assert!(source_count <= 255, EOracleQuorumNotMet);
    assert!(source_count % 2 == 1, EOraclePolicyMismatch);

    let median_candidate = vector::borrow(&candidates, source_count / 2);
    let median_rel_price = median_candidate.relative_price_q32;
    let median_index = median_candidate.index;
    let max_deviation = pool::oracle_max_deviation(pool);
    if (max_deviation > 0) {
        i = 0;
        while (i < source_count) {
            let candidate = vector::borrow(&candidates, i);
            assert_relative_deviation_within(
                median_rel_price,
                candidate.relative_price_q32,
                max_deviation
            );
            i = i + 1;
        };
    };

    let median_reading_a = vector::borrow(readings_a, median_index);
    let median_reading_b = vector::borrow(readings_b, median_index);
    let source_count_u8 = source_count as u8;
    let oracle_digest = oracle_digest_for_fields(
        median_rel_price,
        source_mask,
        source_count_u8,
        valid_until_ms,
        oracle_pairs
    );

    ResolvedOracleReadings {
        price_a: median_reading_a.price_q,
        upper_a: median_reading_a.upper_q,
        lower_a: median_reading_a.lower_q,
        price_b: median_reading_b.price_q,
        upper_b: median_reading_b.upper_q,
        lower_b: median_reading_b.lower_q,
        relative_price_q32: median_rel_price,
        valid_until_ms,
        source_count: source_count_u8,
        source_mask,
        oracle_digest,
    }
}

public fun get_swap_price_bundle_from_reading_pairs_and_amm_readings<A, B>(
    readings_a: &vector<PriceReading>,
    readings_b: &vector<PriceReading>,
    amm_readings: &vector<AmmReading>,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceBundle {
    let len = vector::length(readings_a);
    assert!(len > 0 && len == vector::length(readings_b), EOracleQuorumNotMet);
    if (pool::oracle_mode(pool) == pool::oracle_mode_median()) {
        let resolved = resolve_oracle_reading_pairs_median(readings_a, readings_b, clock, pool);
        return get_swap_price_bundle_from_resolved_oracle_and_amm_readings(
            resolved,
            amm_readings,
            clock,
            pool
        )
    };
    assert!(
        pool::oracle_mode(pool) == pool::oracle_mode_primary_with_sanity(),
        EOraclePolicyMismatch
    );

    let primary_source = pool::oracle_primary_source(pool);
    let mut has_primary = false;
    let mut primary_price_a = 0;
    let mut primary_upper_a = 0;
    let mut primary_lower_a = 0;
    let mut primary_price_b = 0;
    let mut primary_upper_b = 0;
    let mut primary_lower_b = 0;
    let mut i = 0;
    while (i < len) {
        let reading_a = vector::borrow(readings_a, i);
        let reading_b = vector::borrow(readings_b, i);
        assert_reading_pair_matches_policy(reading_a, reading_b, clock, pool);
        if (reading_a.source == primary_source) {
            assert!(!has_primary, EOraclePolicyMismatch);
            has_primary = true;
            primary_price_a = reading_a.price_q;
            primary_upper_a = reading_a.upper_q;
            primary_lower_a = reading_a.lower_q;
            primary_price_b = reading_b.price_q;
            primary_upper_b = reading_b.upper_q;
            primary_lower_b = reading_b.lower_q;
        };
        i = i + 1;
    };
    assert!(has_primary, EOracleRequiredSourceMissing);

    let quote_token_index = pool::quote_token_index(pool);
    assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);
    let primary_rel_price = relative_price_for_quote_index(
        primary_price_a,
        primary_price_b,
        quote_token_index
    );
    let max_deviation = pool::oracle_max_deviation(pool);
    let mut source_mask = 0;
    let mut source_count = 0u64;
    let mut valid_until_ms = 0;
    let mut oracle_pairs = vector[];
    i = 0;
    while (i < len) {
        let reading_a = vector::borrow(readings_a, i);
        let reading_b = vector::borrow(readings_b, i);
        assert!((source_mask & reading_a.source_mask) == 0, EOraclePolicyMismatch);
        source_mask = source_mask | reading_a.source_mask;

        let pair_valid_until = min(reading_a.valid_until_ms, reading_b.valid_until_ms);
        if (source_count == 0 || pair_valid_until < valid_until_ms) {
            valid_until_ms = pair_valid_until;
        };

        let candidate_rel_price = relative_price_for_quote_index(
            reading_a.price_q,
            reading_b.price_q,
            quote_token_index
        );
        if (reading_a.source != primary_source && max_deviation > 0) {
            assert_relative_deviation_within(primary_rel_price, candidate_rel_price, max_deviation);
        };
        vector::push_back(
            &mut oracle_pairs,
            oracle_pair_digest_input(reading_a, reading_b, quote_token_index, pair_valid_until)
        );

        source_count = source_count + 1;
        i = i + 1;
    };
    assert!(source_count <= 255, EOracleQuorumNotMet);
    let source_count_u8 = source_count as u8;
    let oracle_digest = oracle_digest_for_fields(
        primary_rel_price,
        source_mask,
        source_count_u8,
        valid_until_ms,
        oracle_pairs
    );

    let (
        amm_rel_price,
        amm_source_count,
        amm_valid_until_ms,
        amm_digest,
        amm_source_mask,
        amm_total_liquidity_quote
    ) =
        aggregate_amm_readings(amm_readings, primary_rel_price, clock, pool);
    if (amm_source_count == 0) {
        assert!(
            pool::amm_fallback_mode(pool) == pool::amm_fallback_oracle_only(),
            EAmmQuorumNotMet
        );
        return new_swap_price_bundle_from_fields<A, B>(
            primary_price_a,
            primary_upper_a,
            primary_lower_a,
            primary_price_b,
            primary_upper_b,
            primary_lower_b,
            valid_until_ms,
            source_count_u8,
            source_mask,
            NO_AMM_SOURCE_COUNT,
            oracle_digest,
            clock,
            pool
        )
    };
    let bundle_valid_until = min(valid_until_ms, amm_valid_until_ms);
    let pyth_weight = pool::pyth_weight(pool);
    let adj_price = math::mul_div_down_to_u64(
        (primary_rel_price as u128),
        (pyth_weight as u128),
        (PRECISION as u128)
    ) + math::mul_div_down_to_u64(
        (amm_rel_price as u128),
        ((PRECISION - (pyth_weight as u64)) as u128),
        (PRECISION as u128)
    );
    assert!(adj_price > 0, EInvalidPrice);
    let o_spread = math::mul_div_up_to_u64(
        (abs_diff(primary_rel_price, amm_rel_price) as u128),
        (PRECISION as u128),
        (adj_price as u128)
    );
    if (pool::amm_max_ospread(pool) > 0) {
        assert!(o_spread <= (pool::amm_max_ospread(pool) as u64), EOracleDiscrepancyTooHigh);
    };

    new_swap_price_bundle_from_resolved_fields<A, B>(
        primary_price_a,
        primary_upper_a,
        primary_lower_a,
        primary_price_b,
        primary_upper_b,
        primary_lower_b,
        bundle_valid_until,
        source_count_u8,
        source_mask,
        oracle_digest,
        amm_source_count,
        amm_digest,
        amm_source_mask,
        amm_total_liquidity_quote,
        primary_rel_price,
        amm_rel_price,
        adj_price,
        o_spread,
        clock,
        pool
    )
}

fun get_swap_price_bundle_from_resolved_oracle_and_amm_readings<A, B>(
    oracle: ResolvedOracleReadings,
    amm_readings: &vector<AmmReading>,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceBundle {
    let (
        amm_rel_price,
        amm_source_count,
        amm_valid_until_ms,
        amm_digest,
        amm_source_mask,
        amm_total_liquidity_quote
    ) =
        aggregate_amm_readings(amm_readings, oracle.relative_price_q32, clock, pool);
    if (amm_source_count == 0) {
        assert!(
            pool::amm_fallback_mode(pool) == pool::amm_fallback_oracle_only(),
            EAmmQuorumNotMet
        );
        return new_swap_price_bundle_from_fields<A, B>(
            oracle.price_a,
            oracle.upper_a,
            oracle.lower_a,
            oracle.price_b,
            oracle.upper_b,
            oracle.lower_b,
            oracle.valid_until_ms,
            oracle.source_count,
            oracle.source_mask,
            NO_AMM_SOURCE_COUNT,
            oracle.oracle_digest,
            clock,
            pool
        )
    };

    let bundle_valid_until = min(oracle.valid_until_ms, amm_valid_until_ms);
    let pyth_weight = pool::pyth_weight(pool);
    let adj_price = math::mul_div_down_to_u64(
        (oracle.relative_price_q32 as u128),
        (pyth_weight as u128),
        (PRECISION as u128)
    ) + math::mul_div_down_to_u64(
        (amm_rel_price as u128),
        ((PRECISION - (pyth_weight as u64)) as u128),
        (PRECISION as u128)
    );
    assert!(adj_price > 0, EInvalidPrice);
    let o_spread = math::mul_div_up_to_u64(
        (abs_diff(oracle.relative_price_q32, amm_rel_price) as u128),
        (PRECISION as u128),
        (adj_price as u128)
    );
    if (pool::amm_max_ospread(pool) > 0) {
        assert!(o_spread <= (pool::amm_max_ospread(pool) as u64), EOracleDiscrepancyTooHigh);
    };

    new_swap_price_bundle_from_resolved_fields<A, B>(
        oracle.price_a,
        oracle.upper_a,
        oracle.lower_a,
        oracle.price_b,
        oracle.upper_b,
        oracle.lower_b,
        bundle_valid_until,
        oracle.source_count,
        oracle.source_mask,
        oracle.oracle_digest,
        amm_source_count,
        amm_digest,
        amm_source_mask,
        amm_total_liquidity_quote,
        oracle.relative_price_q32,
        amm_rel_price,
        adj_price,
        o_spread,
        clock,
        pool
    )
}

fun new_swap_price_bundle_from_fields<A, B>(
    pyth_price_a: u64,
    pyth_upper_a: u64,
    pyth_lower_a: u64,
    pyth_price_b: u64,
    pyth_upper_b: u64,
    pyth_lower_b: u64,
    valid_until_ms: u64,
    source_count: u8,
    source_mask: u64,
    amm_source_count: u8,
    oracle_digest: vector<u8>,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceBundle {
    assert!(pyth_price_a > 0 && pyth_price_b > 0, EInvalidPrice);
    let quote_token_index = pool::quote_token_index(pool);
    assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);
    let base_price = if (quote_token_index == 0) { pyth_price_b } else { pyth_price_a };
    let quote_price = if (quote_token_index == 0) { pyth_price_a } else { pyth_price_b };
    let base_upper = if (quote_token_index == 0) { pyth_upper_b } else { pyth_upper_a };
    let base_lower = if (quote_token_index == 0) { pyth_lower_b } else { pyth_lower_a };
    let quote_upper = if (quote_token_index == 0) { pyth_upper_a } else { pyth_upper_b };
    let quote_lower = if (quote_token_index == 0) { pyth_lower_a } else { pyth_lower_b };

    // adj_price is quote per base in Q32. With no AMM source, V3 uses the Pyth
    // confidence range to compute Ospread and applies the pool discrepancy gate.
    let adj_price = math::mul_div_down_to_u64((base_price as u128), Q32, (quote_price as u128));
    let o_spread = pyth_only_o_spread(base_upper, base_lower, quote_upper, quote_lower, adj_price);
    new_swap_price_bundle_from_resolved_fields<A, B>(
        pyth_price_a,
        pyth_upper_a,
        pyth_lower_a,
        pyth_price_b,
        pyth_upper_b,
        pyth_lower_b,
        valid_until_ms,
        source_count,
        source_mask,
        oracle_digest,
        amm_source_count,
        vector[],
        0,
        0u256,
        adj_price,
        0,
        adj_price,
        o_spread,
        clock,
        pool
    )
}

fun new_swap_price_bundle_from_resolved_fields<A, B>(
    pyth_price_a: u64,
    _pyth_upper_a: u64,
    _pyth_lower_a: u64,
    pyth_price_b: u64,
    _pyth_upper_b: u64,
    _pyth_lower_b: u64,
    valid_until_ms: u64,
    source_count: u8,
    source_mask: u64,
    oracle_digest: vector<u8>,
    amm_source_count: u8,
    amm_digest: vector<u8>,
    amm_source_mask: u64,
    amm_total_liquidity_quote: u256,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    adj_price: u64,
    o_spread: u64,
    clock: &Clock,
    pool: &Pool<A, B>
): PriceBundle {
    assert!(
        pyth_price_a > 0 && pyth_price_b > 0 && oracle_relative_price > 0 && adj_price > 0,
        EInvalidPrice
    );
    if (amm_source_count > 0) {
        assert!(amm_relative_price > 0, EInvalidPrice);
        assert!(amm_source_mask > 0 && amm_total_liquidity_quote > 0, EAmmQuorumNotMet);
    } else {
        assert!(amm_relative_price == 0, EInvalidPrice);
        assert!(amm_source_mask == 0 && amm_total_liquidity_quote == 0, EAmmQuorumNotMet);
    };
    assert!(
        mask_contains(pool::oracle_allowed_source_mask(pool), source_mask),
        EOracleSourceNotAllowed
    );
    assert!(
        mask_contains(source_mask, pool::oracle_required_source_mask(pool)),
        EOracleRequiredSourceMissing
    );
    assert!(source_count >= pool::oracle_min_sources(pool), EOracleQuorumNotMet);
    if (amm_source_count > 0) {
        assert!(pool::amm_twap_enabled(pool), EAmmBlendUnavailable);
        assert!(pool::amm_blend_weight(pool) > 0, EAmmBlendUnavailable);
    };
    assert!(amm_source_count >= pool::amm_min_sources(pool), EAmmQuorumNotMet);
    if (pool::amm_twap_enabled(pool) && pool::amm_blend_weight(pool) > 0 && amm_source_count == 0) {
        assert!(
            pool::amm_fallback_mode(pool) == pool::amm_fallback_oracle_only(),
            EAmmBlendUnavailable
        );
    };

    let quote_token_index = pool::quote_token_index(pool);
    assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);
    assert!(o_spread <= (pool::dis_threshold(pool) as u64), EOracleDiscrepancyTooHigh);

    let dynamic_spread = math::mul_div_up_to_u64(
        (pool::compress(pool) as u128),
        (o_spread as u128),
        (PRECISION as u128)
    );
    let sell_spread = bounded_spread(pool::fix_s(pool), dynamic_spread, pool::s_sell(pool));
    let buy_spread = bounded_spread(pool::fix_s(pool), dynamic_spread, pool::s_buy(pool));
    assert!(buy_spread < (PRECISION as u32), EBuyPriceTooLow);

    let skew_price = skew_price_for_pool(pool, adj_price);
    let sell_price = math::mul_div_up_to_u64(
        (skew_price as u128),
        ((PRECISION + (sell_spread as u64)) as u128),
        (PRECISION as u128)
    );
    let buy_price = math::mul_div_down_to_u64(
        (skew_price as u128),
        ((PRECISION - (buy_spread as u64)) as u128),
        (PRECISION as u128)
    );

    let created_at_ms = clock::timestamp_ms(clock);
    let pool_id = pool::id(pool);
    let policy_version = pool::oracle_policy_version(pool);
    let policy_digest = policy_digest_for_pool<A, B>(pool);
    let price_digest = price_digest_for_fields(
        pool_id,
        policy_version,
        policy_digest,
        quote_token_index,
        created_at_ms,
        valid_until_ms,
        pyth_price_a,
        pyth_price_b,
        oracle_relative_price,
        amm_relative_price,
        adj_price,
        sell_price,
        buy_price,
        o_spread,
        source_count,
        amm_source_count,
        oracle_digest,
        amm_digest
    );
    events::emit_oracle_quorum_used(
        pool_id,
        policy_version,
        copy policy_digest,
        copy price_digest,
        pool::oracle_mode(pool),
        pool::oracle_primary_source(pool),
        source_mask,
        source_count,
        pool::oracle_required_source_mask(pool),
        pool::oracle_min_sources(pool),
        oracle_relative_price,
        valid_until_ms
    );
    if (amm_source_count > 0) {
        events::emit_amm_twap_used(
            pool_id,
            policy_version,
            copy policy_digest,
            copy price_digest,
            amm_source_mask,
            amm_source_count,
            amm_relative_price,
            oracle_relative_price,
            adj_price,
            o_spread,
            amm_total_liquidity_quote,
            pool::amm_min_window_seconds(pool),
            pool::amm_max_window_seconds(pool),
            valid_until_ms
        );
    };
    PriceBundle {
        pool_id,
        policy_version,
        policy_digest,
        quote_token_index,
        created_at_ms,
        valid_until_ms,
        price_digest,
        pyth_price_a,
        pyth_price_b,
        oracle_relative_price,
        amm_relative_price,
        adj_price,
        sell_price,
        buy_price,
        o_spread,
        source_count,
        amm_source_count,
    }
}

fun skew_price_for_pool<A, B>(pool: &Pool<A, B>, adj_price: u64): u64 {
    let lambda = pool::lambda(pool);
    if (lambda == 0) {
        return adj_price
    };

    let quote_token_index = pool::quote_token_index(pool);
    let base_amount = if (quote_token_index == 0) {
        math::parse_amount_to_standard_decimals(
            pool::token_b_decimals(pool),
            pool::balance_b(pool),
            STANDARD_DECIMALS
        )
    } else {
        math::parse_amount_to_standard_decimals(
            pool::token_a_decimals(pool),
            pool::balance_a(pool),
            STANDARD_DECIMALS
        )
    };
    let quote_amount = if (quote_token_index == 0) {
        math::parse_amount_to_standard_decimals(
            pool::token_a_decimals(pool),
            pool::balance_a(pool),
            STANDARD_DECIMALS
        )
    } else {
        math::parse_amount_to_standard_decimals(
            pool::token_b_decimals(pool),
            pool::balance_b(pool),
            STANDARD_DECIMALS
        )
    };

    let base_value = math::mul_div_down_u128((base_amount as u128), (adj_price as u128), Q32);
    let quote_value = quote_amount as u128;
    let total_value = base_value + quote_value;
    if (total_value == 0) {
        return adj_price
    };

    let base_heavy = base_value >= quote_value;
    let value_diff = if (base_heavy) {
        base_value - quote_value
    } else {
        quote_value - base_value
    };
    let mut skew_factor = math::mul_div_down_u128((lambda as u128), value_diff, total_value);
    let fee_cap = math::mul_div_down_u128(
        Q32,
        (pool::fee(pool) as u128),
        2 * (PRECISION as u128) + (pool::fee(pool) as u128)
    ) + math::mul_div_down_u128(Q32, (pool::s_bound(pool) as u128), (PRECISION as u128));
    if (skew_factor > fee_cap) {
        skew_factor = fee_cap;
    };
    if (skew_factor >= Q32) {
        return adj_price
    };

    if (base_heavy) {
        math::mul_div_down_to_u64((adj_price as u128), Q32 - skew_factor, Q32 + skew_factor)
    } else {
        math::mul_div_down_to_u64((adj_price as u128), Q32 + skew_factor, Q32 - skew_factor)
    }
}

public(package) fun new_price_reading(
    source: u8,
    source_mask: u64,
    source_id: ID,
    feed_id: vector<u8>,
    price_q: u64,
    upper_q: u64,
    lower_q: u64,
    confidence_q: u64,
    publish_time_ms: u64,
    valid_until_ms: u64,
    expo_negative: bool,
    expo_magnitude: u64,
    decimals: u8
): PriceReading {
    assert!(price_q > 0 && upper_q >= price_q && lower_q > 0, EInvalidPrice);
    PriceReading {
        source,
        source_mask,
        source_id,
        feed_id,
        price_q,
        upper_q,
        lower_q,
        confidence_q,
        publish_time_ms,
        valid_until_ms,
        expo_negative,
        expo_magnitude,
        decimals,
    }
}

public(package) fun pyth_validity_window_ms(
    publish_time_seconds: u64,
    max_price_age_seconds: u64
): (u64, u64) {
    let publish_time_ms = (publish_time_seconds as u128) * MILLIS_PER_SECOND;
    let age_ms = (max_price_age_seconds as u128) * MILLIS_PER_SECOND;
    let valid_until_ms = publish_time_ms + age_ms;

    assert!(publish_time_ms <= U64_MAX && valid_until_ms <= U64_MAX, EOraclePolicyMismatch);
    ((publish_time_ms as u64), (valid_until_ms as u64))
}

public(package) fun new_amm_reading(
    pool_id: ID,
    source_mask: u64,
    source_id: ID,
    relative_price_q32: u64,
    liquidity_quote: u128,
    window_seconds: u64,
    observed_at_ms: u64,
    valid_until_ms: u64
): AmmReading {
    new_amm_reading_internal(
        pool_id,
        source_mask,
        source_id,
        option::none(),
        relative_price_q32,
        liquidity_quote,
        window_seconds,
        observed_at_ms,
        valid_until_ms
    )
}

public(package) fun new_amm_path_reading(
    pool_id: ID,
    source_mask: u64,
    source_id: ID,
    secondary_source_id: ID,
    relative_price_q32: u64,
    liquidity_quote: u128,
    window_seconds: u64,
    observed_at_ms: u64,
    valid_until_ms: u64
): AmmReading {
    new_amm_reading_internal(
        pool_id,
        source_mask,
        source_id,
        option::some(secondary_source_id),
        relative_price_q32,
        liquidity_quote,
        window_seconds,
        observed_at_ms,
        valid_until_ms
    )
}

fun new_amm_reading_internal(
    pool_id: ID,
    source_mask: u64,
    source_id: ID,
    secondary_source_id: Option<ID>,
    relative_price_q32: u64,
    liquidity_quote: u128,
    window_seconds: u64,
    observed_at_ms: u64,
    valid_until_ms: u64
): AmmReading {
    assert!(source_mask > 0, EOraclePolicyMismatch);
    assert!(relative_price_q32 > 0, EInvalidPrice);
    assert!(observed_at_ms <= valid_until_ms, EBundleExpired);
    AmmReading {
        pool_id,
        source_mask,
        source_id,
        secondary_source_id,
        relative_price_q32,
        liquidity_quote,
        window_seconds,
        observed_at_ms,
        valid_until_ms,
    }
}

public fun assert_bundle_valid_for_pool<A, B>(
    bundle: &PriceBundle,
    pool: &Pool<A, B>,
    clock: &Clock
) {
    assert!(bundle.pool_id == pool::id(pool), EBundlePoolMismatch);
    assert!(bundle.quote_token_index == pool::quote_token_index(pool), EBundleQuoteMismatch);
    assert!(bundle.policy_version == pool::oracle_policy_version(pool), EBundlePolicyMismatch);
    assert!(bundle.policy_digest == policy_digest_for_pool<A, B>(pool), EBundlePolicyMismatch);
    assert!(clock::timestamp_ms(clock) <= bundle.valid_until_ms, EBundleExpired);
}

public fun bundle_pool_id(bundle: &PriceBundle): ID {
    bundle.pool_id
}

public fun bundle_policy_version(bundle: &PriceBundle): u64 {
    bundle.policy_version
}

public fun bundle_policy_digest(bundle: &PriceBundle): vector<u8> {
    bundle.policy_digest
}

public fun bundle_price_digest(bundle: &PriceBundle): vector<u8> {
    bundle.price_digest
}

public fun bundle_quote_token_index(bundle: &PriceBundle): u8 {
    bundle.quote_token_index
}

public fun bundle_created_at_ms(bundle: &PriceBundle): u64 {
    bundle.created_at_ms
}

public fun bundle_valid_until_ms(bundle: &PriceBundle): u64 {
    bundle.valid_until_ms
}

public fun bundle_pyth_price_a(bundle: &PriceBundle): u64 {
    bundle.pyth_price_a
}

public fun bundle_pyth_price_b(bundle: &PriceBundle): u64 {
    bundle.pyth_price_b
}

public fun bundle_oracle_relative_price(bundle: &PriceBundle): u64 {
    bundle.oracle_relative_price
}

public fun bundle_amm_relative_price(bundle: &PriceBundle): u64 {
    bundle.amm_relative_price
}

public fun bundle_adj_price(bundle: &PriceBundle): u64 {
    bundle.adj_price
}

public fun bundle_sell_price(bundle: &PriceBundle): u64 {
    bundle.sell_price
}

public fun bundle_buy_price(bundle: &PriceBundle): u64 {
    bundle.buy_price
}

public fun bundle_o_spread(bundle: &PriceBundle): u64 {
    bundle.o_spread
}

public fun bundle_source_count(bundle: &PriceBundle): u8 {
    bundle.source_count
}

public fun bundle_amm_source_count(bundle: &PriceBundle): u8 {
    bundle.amm_source_count
}

public fun reading_source(reading: &PriceReading): u8 {
    reading.source
}

public fun reading_feed_id(reading: &PriceReading): vector<u8> {
    reading.feed_id
}

public fun reading_price(reading: &PriceReading): u64 {
    reading.price_q
}

public fun reading_confidence(reading: &PriceReading): u64 {
    reading.confidence_q
}

public fun reading_publish_time_ms(reading: &PriceReading): u64 {
    reading.publish_time_ms
}

public fun reading_decimals(reading: &PriceReading): u8 {
    reading.decimals
}

fun assert_oracle_policy_matches<A, B>(oracle: &OracleAdapter, pool: &Pool<A, B>) {
    assert_token_oracle_policy_matches<A>(
        oracle,
        pool::oracle_source_type_a(pool),
        pool::oracle_source_id_a(pool),
        pool::oracle_config_data_a(pool)
    );
    assert_token_oracle_policy_matches<B>(
        oracle,
        pool::oracle_source_type_b(pool),
        pool::oracle_source_id_b(pool),
        pool::oracle_config_data_b(pool)
    );
}

fun assert_reading_matches_token_a<A, B>(reading: &PriceReading, pool: &Pool<A, B>) {
    assert!(reading.source_id == pool::oracle_source_id_a(pool), EOraclePolicyMismatch);
    assert!(reading.feed_id == pool::oracle_config_data_a(pool), EOraclePolicyMismatch);
}

fun assert_reading_matches_token_b<A, B>(reading: &PriceReading, pool: &Pool<A, B>) {
    assert!(reading.source_id == pool::oracle_source_id_b(pool), EOraclePolicyMismatch);
    assert!(reading.feed_id == pool::oracle_config_data_b(pool), EOraclePolicyMismatch);
}

fun assert_reading_pair_matches_policy<A, B>(
    reading_a: &PriceReading,
    reading_b: &PriceReading,
    clock: &Clock,
    pool: &Pool<A, B>
) {
    assert_reading_matches_token_a(reading_a, pool);
    assert_reading_matches_token_b(reading_b, pool);
    assert!(reading_a.source == reading_b.source, EOraclePolicyMismatch);
    assert!(reading_a.source_mask == reading_b.source_mask, EOraclePolicyMismatch);
    assert!(reading_a.source_mask > 0, EOraclePolicyMismatch);
    assert!(clock::timestamp_ms(clock) <= reading_a.valid_until_ms, EBundleExpired);
    assert!(clock::timestamp_ms(clock) <= reading_b.valid_until_ms, EBundleExpired);
    if (pool::oracle_max_confidence(pool) > 0) {
        assert_reading_confidence_within(reading_a, pool::oracle_max_confidence(pool));
        assert_reading_confidence_within(reading_b, pool::oracle_max_confidence(pool));
    };
    if (pool::oracle_max_pair_time_delta_ms(pool) > 0) {
        assert!(
            abs_diff(reading_a.publish_time_ms, reading_b.publish_time_ms)
                <= pool::oracle_max_pair_time_delta_ms(pool),
            EOraclePolicyMismatch
        );
    };
}

fun insert_oracle_candidate_sorted(
    candidates: &mut vector<OracleCandidate>,
    candidate: OracleCandidate
) {
    vector::push_back(candidates, candidate);
    let mut i = vector::length(candidates) - 1;
    let mut done = false;
    while (i > 0 && !done) {
        let current_price = vector::borrow(candidates, i).relative_price_q32;
        let previous_price = vector::borrow(candidates, i - 1).relative_price_q32;
        if (previous_price <= current_price) {
            done = true;
        } else {
            vector::swap(candidates, i, i - 1);
            i = i - 1;
        };
    };
}

fun aggregate_amm_readings<A, B>(
    readings: &vector<AmmReading>,
    primary_rel_price: u64,
    clock: &Clock,
    pool: &Pool<A, B>
): (u64, u8, u64, vector<u8>, u64, u256) {
    let len = vector::length(readings);
    if (pool::amm_source_count_limit(pool) > 0) {
        assert!(len <= (pool::amm_source_count_limit(pool) as u64), EAmmQuorumNotMet);
    };
    assert!(pool::amm_twap_enabled(pool), EAmmBlendUnavailable);
    assert!(pool::amm_blend_weight(pool) > 0, EAmmBlendUnavailable);

    let mut i = 0;
    let mut source_mask = 0;
    let mut source_count = 0u64;
    let mut total_liquidity = 0u256;
    let mut weighted_sum = 0u256;
    let mut valid_until_ms = 0;
    let mut digest_readings = vector[];
    while (i < len) {
        let reading = vector::borrow(readings, i);
        if (amm_reading_matches_policy(reading, source_mask, primary_rel_price, clock, pool)) {
            source_mask = source_mask | reading.source_mask;
            weighted_sum = weighted_sum
                + (reading.relative_price_q32 as u256) * (reading.liquidity_quote as u256);
            total_liquidity = total_liquidity + (reading.liquidity_quote as u256);
            if (source_count == 0 || reading.valid_until_ms < valid_until_ms) {
                valid_until_ms = reading.valid_until_ms;
            };
            vector::push_back(
                &mut digest_readings,
                AmmReadingDigestInput {
                    pool_id: reading.pool_id,
                    source_mask: reading.source_mask,
                    source_id: reading.source_id,
                    secondary_source_id: reading.secondary_source_id,
                    relative_price_q32: reading.relative_price_q32,
                    liquidity_quote: reading.liquidity_quote,
                    window_seconds: reading.window_seconds,
                    observed_at_ms: reading.observed_at_ms,
                    valid_until_ms: reading.valid_until_ms,
                }
            );
            source_count = source_count + 1;
        };
        i = i + 1;
    };
    assert!(source_count >= (pool::amm_min_sources(pool) as u64), EAmmQuorumNotMet);
    assert!(source_count <= 255, EAmmQuorumNotMet);
    if (source_count == 0) {
        return (0, 0, 0, vector[], 0, 0u256)
    };
    let rel_price = math::u256_to_u64_checked(weighted_sum / total_liquidity);
    assert!(rel_price > 0, EInvalidPrice);
    let source_count_u8 = source_count as u8;
    let amm_digest = amm_digest_for_fields(
        rel_price,
        total_liquidity,
        source_mask,
        source_count_u8,
        valid_until_ms,
        digest_readings
    );
    (
        rel_price,
        source_count_u8,
        valid_until_ms,
        amm_digest,
        source_mask,
        total_liquidity
    )
}

fun amm_reading_matches_policy<A, B>(
    reading: &AmmReading,
    accepted_source_mask: u64,
    primary_rel_price: u64,
    clock: &Clock,
    pool: &Pool<A, B>
): bool {
    reading.pool_id == pool::id(pool)
        && reading.source_mask > 0
        && reading.relative_price_q32 > 0
        && reading.liquidity_quote > 0
        && mask_contains(pool::amm_allowed_source_mask(pool), reading.source_mask)
        && amm_reading_source_ids_allowed(reading, pool)
        && (accepted_source_mask & reading.source_mask) == 0
        && clock::timestamp_ms(clock) <= reading.valid_until_ms
        && reading.liquidity_quote >= pool::amm_min_liquidity_quote(pool)
        && reading.window_seconds >= pool::amm_min_window_seconds(pool)
        && (
            pool::amm_max_window_seconds(pool) == 0
                || reading.window_seconds <= pool::amm_max_window_seconds(pool)
        )
        && amm_reading_ospread_within_policy(reading, primary_rel_price, pool)
}

fun amm_reading_source_ids_allowed<A, B>(reading: &AmmReading, pool: &Pool<A, B>): bool {
    let allowed_ids = pool::amm_allowed_source_ids(pool);
    let len = vector::length(&allowed_ids);
    if (len == 0) {
        return true
    };
    if (!source_id_in_allowed_ids(reading.source_id, &allowed_ids)) {
        return false
    };
    if (option::is_some(&reading.secondary_source_id)) {
        return source_id_in_allowed_ids(*option::borrow(&reading.secondary_source_id), &allowed_ids)
    };
    true
}

fun source_id_in_allowed_ids(source_id: ID, allowed_ids: &vector<ID>): bool {
    let len = vector::length(allowed_ids);
    let mut i = 0;
    while (i < len) {
        if (*vector::borrow(allowed_ids, i) == source_id) {
            return true
        };
        i = i + 1;
    };
    false
}

fun amm_reading_ospread_within_policy<A, B>(
    reading: &AmmReading,
    primary_rel_price: u64,
    pool: &Pool<A, B>
): bool {
    if (pool::amm_max_ospread(pool) == 0) {
        return true
    };
    let pyth_weight = pool::pyth_weight(pool);
    let candidate_adj_price = math::mul_div_down_to_u64(
        (primary_rel_price as u128),
        (pyth_weight as u128),
        (PRECISION as u128)
    ) + math::mul_div_down_to_u64(
        (reading.relative_price_q32 as u128),
        ((PRECISION - (pyth_weight as u64)) as u128),
        (PRECISION as u128)
    );
    if (candidate_adj_price == 0) {
        return false
    };
    let o_spread = math::mul_div_up_to_u64(
        (abs_diff(primary_rel_price, reading.relative_price_q32) as u128),
        (PRECISION as u128),
        (candidate_adj_price as u128)
    );
    o_spread <= (pool::amm_max_ospread(pool) as u64)
}

fun assert_token_oracle_policy_matches<T>(
    oracle: &OracleAdapter,
    source_type: vector<u8>,
    source_id: ID,
    config_data: vector<u8>
) {
    assert!(oracle::get_source_type<T>(oracle) == source_type, EOraclePolicyMismatch);
    assert!(oracle::get_source_id<T>(oracle) == source_id, EOraclePolicyMismatch);
    assert!(oracle::get_config_data<T>(oracle) == config_data, EOraclePolicyMismatch);
}

fun pyth_only_o_spread(
    base_upper: u64,
    base_lower: u64,
    quote_upper: u64,
    quote_lower: u64,
    adj_price: u64
): u64 {
    assert!(base_upper > 0 && base_lower > 0 && quote_upper > 0 && quote_lower > 0, EInvalidPrice);
    assert!(adj_price > 0, EInvalidPrice);
    let rel_upper = math::mul_div_down_to_u64((base_upper as u128), Q32, (quote_lower as u128));
    let rel_lower = math::mul_div_down_to_u64((base_lower as u128), Q32, (quote_upper as u128));
    let rel_diff = if (rel_upper > rel_lower) {
        rel_upper - rel_lower
    } else {
        0
    };
    math::mul_div_up_to_u64((rel_diff as u128), (PRECISION as u128), (adj_price as u128))
}

fun relative_price_for_quote_index(price_a: u64, price_b: u64, quote_token_index: u8): u64 {
    assert!(price_a > 0 && price_b > 0, EInvalidPrice);
    assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);
    if (quote_token_index == 0) {
        math::mul_div_down_to_u64((price_b as u128), Q32, (price_a as u128))
    } else {
        math::mul_div_down_to_u64((price_a as u128), Q32, (price_b as u128))
    }
}

fun assert_relative_deviation_within(reference: u64, candidate: u64, max_deviation: u64) {
    assert!(reference > 0 && candidate > 0, EInvalidPrice);
    let deviation = math::mul_div_up_to_u64(
        (abs_diff(reference, candidate) as u128),
        (PRECISION as u128),
        (reference as u128)
    );
    assert!(deviation <= max_deviation, EOracleDiscrepancyTooHigh);
}

fun assert_reading_confidence_within(reading: &PriceReading, max_confidence: u64) {
    let confidence = math::mul_div_up_to_u64(
        (reading.confidence_q as u128),
        (PRECISION as u128),
        (reading.price_q as u128)
    );
    assert!(confidence <= max_confidence, EOracleDiscrepancyTooHigh);
}

fun bounded_spread(fix_s: u32, dynamic_spread: u64, side_spread: u32): u32 {
    let total = (fix_s as u64) + dynamic_spread + (side_spread as u64);
    if (total > (PRECISION as u64)) {
        (PRECISION as u32)
    } else {
        (total as u32)
    }
}

fun mask_contains(mask: u64, required: u64): bool {
    (mask & required) == required
}

fun abs_diff(a: u64, b: u64): u64 {
    if (a >= b) { a - b } else { b - a }
}

fun min(a: u64, b: u64): u64 {
    if (a < b) { a } else { b }
}

fun policy_digest_for_pool<A, B>(pool: &Pool<A, B>): vector<u8> {
    let input = PolicyDigestInput {
        pool_id: pool::id(pool),
        base_type: type_name::with_defining_ids<A>(),
        quote_type: type_name::with_defining_ids<B>(),
        policy_version: pool::oracle_policy_version(pool),
        quote_token_index: pool::quote_token_index(pool),
        fee: pool::fee(pool),
        lambda: pool::lambda(pool),
        oracle: OraclePolicyDigestInput {
            oracle_max_price_age: pool::oracle_max_price_age(pool),
            oracle_min_sources: pool::oracle_min_sources(pool),
            oracle_required_source_mask: pool::oracle_required_source_mask(pool),
            oracle_allowed_source_mask: pool::oracle_allowed_source_mask(pool),
            oracle_primary_source: pool::oracle_primary_source(pool),
            oracle_max_pair_time_delta_ms: pool::oracle_max_pair_time_delta_ms(pool),
            oracle_max_confidence: pool::oracle_max_confidence(pool),
            oracle_max_deviation: pool::oracle_max_deviation(pool),
            oracle_mode: pool::oracle_mode(pool),
            oracle_source_type_a: pool::oracle_source_type_a(pool),
            oracle_source_type_b: pool::oracle_source_type_b(pool),
            oracle_source_id_a: pool::oracle_source_id_a(pool),
            oracle_source_id_b: pool::oracle_source_id_b(pool),
            oracle_config_data_a: pool::oracle_config_data_a(pool),
            oracle_config_data_b: pool::oracle_config_data_b(pool),
        },
        amm: AmmPolicyDigestInput {
            amm_twap_enabled: pool::amm_twap_enabled(pool),
            amm_blend_weight: pool::amm_blend_weight(pool),
            amm_min_sources: pool::amm_min_sources(pool),
            amm_fallback_mode: pool::amm_fallback_mode(pool),
            amm_max_ospread: pool::amm_max_ospread(pool),
            amm_min_liquidity_quote: pool::amm_min_liquidity_quote(pool),
            amm_min_window_seconds: pool::amm_min_window_seconds(pool),
            amm_max_window_seconds: pool::amm_max_window_seconds(pool),
            amm_allowed_source_mask: pool::amm_allowed_source_mask(pool),
            amm_allowed_source_ids: pool::amm_allowed_source_ids(pool),
            amm_source_count_limit: pool::amm_source_count_limit(pool),
        },
        compress: pool::compress(pool),
        s_sell: pool::s_sell(pool),
        s_buy: pool::s_buy(pool),
        fix_s: pool::fix_s(pool),
        dis_threshold: pool::dis_threshold(pool),
        s_bound: pool::s_bound(pool),
        pyth_weight: pool::pyth_weight(pool),
    };
    keccak256(&bcs::to_bytes(&input))
}

fun price_digest_for_fields(
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    quote_token_index: u8,
    created_at_ms: u64,
    valid_until_ms: u64,
    pyth_price_a: u64,
    pyth_price_b: u64,
    oracle_relative_price: u64,
    amm_relative_price: u64,
    adj_price: u64,
    sell_price: u64,
    buy_price: u64,
    o_spread: u64,
    source_count: u8,
    amm_source_count: u8,
    oracle_digest: vector<u8>,
    amm_digest: vector<u8>
): vector<u8> {
    let input = PriceDigestInput {
        pool_id,
        policy_version,
        policy_digest,
        quote_token_index,
        created_at_ms,
        valid_until_ms,
        pyth_price_a,
        pyth_price_b,
        oracle_relative_price,
        amm_relative_price,
        adj_price,
        sell_price,
        buy_price,
        o_spread,
        source_count,
        amm_source_count,
        oracle_digest,
        amm_digest,
    };
    keccak256(&bcs::to_bytes(&input))
}

fun oracle_pair_digest_input(
    reading_a: &PriceReading,
    reading_b: &PriceReading,
    quote_token_index: u8,
    pair_valid_until_ms: u64
): OraclePairDigestInput {
    OraclePairDigestInput {
        source: reading_a.source,
        source_mask: reading_a.source_mask,
        pair_valid_until_ms,
        relative_price_q32: relative_price_for_quote_index(
            reading_a.price_q,
            reading_b.price_q,
            quote_token_index
        ),
        reading_a: oracle_reading_digest_input(reading_a),
        reading_b: oracle_reading_digest_input(reading_b),
    }
}

fun oracle_reading_digest_input(reading: &PriceReading): OracleReadingDigestInput {
    OracleReadingDigestInput {
        source: reading.source,
        source_mask: reading.source_mask,
        source_id: reading.source_id,
        feed_id: reading.feed_id,
        price_q: reading.price_q,
        upper_q: reading.upper_q,
        lower_q: reading.lower_q,
        confidence_q: reading.confidence_q,
        publish_time_ms: reading.publish_time_ms,
        valid_until_ms: reading.valid_until_ms,
        expo_negative: reading.expo_negative,
        expo_magnitude: reading.expo_magnitude,
        decimals: reading.decimals,
    }
}

fun oracle_digest_for_fields(
    primary_relative_price_q32: u64,
    source_mask: u64,
    source_count: u8,
    valid_until_ms: u64,
    pairs: vector<OraclePairDigestInput>
): vector<u8> {
    let input = OracleDigestInput {
        primary_relative_price_q32,
        source_mask,
        source_count,
        valid_until_ms,
        pairs,
    };
    keccak256(&bcs::to_bytes(&input))
}

fun amm_digest_for_fields(
    aggregate_relative_price_q32: u64,
    total_liquidity_quote: u256,
    source_mask: u64,
    source_count: u8,
    valid_until_ms: u64,
    readings: vector<AmmReadingDigestInput>
): vector<u8> {
    let input = AmmDigestInput {
        aggregate_relative_price_q32,
        total_liquidity_quote,
        source_mask,
        source_count,
        valid_until_ms,
        readings,
    };
    keccak256(&bcs::to_bytes(&input))
}
