module brownfi_amm::amm_flowx;

use std::vector;
use sui::clock::{Self, Clock};
use brownfi_amm::math;
use brownfi_amm::oracle_gateway::{Self, AmmReading};
use brownfi_amm::pool::{Self, Pool};
use flowx_clmm::i32 as flowx_i32;
use flowx_clmm::i64 as flowx_i64;
use flowx_clmm::oracle as flowx_oracle;
use flowx_clmm::pool as flowx_pool;
use flowx_clmm::tick_math as flowx_tick_math;

const STANDARD_DECIMALS: u8 = 9;
const Q32: u256 = 4294967296;
const Q64: u256 = 18446744073709551616;
const Q96: u256 = 79228162514264337593543950336;
const Q128: u256 = 340282366920938463463374607431768211456;
const MAX_U128: u256 = 340282366920938463463374607431768211455;
const MAX_FLOWX_TICK: u64 = 443636;

const EInvalidQuoteTokenIndex: u64 = 1;
const EInvalidWindow: u64 = 2;
const EInvalidObservation: u64 = 3;
const EOverflow: u64 = 4;

public fun read_direct_pool<A, B>(
    brownfi_pool: &Pool<A, B>,
    flowx_pool: &flowx_pool::Pool<A, B>,
    clock: &Clock,
    source_mask: u64,
    twap_window_seconds: u64,
    twal_window_seconds: u64,
    valid_for_ms: u64
): AmmReading {
    assert!(twal_window_seconds >= twap_window_seconds, EInvalidWindow);
    if (twap_window_seconds == 0) {
        assert!(twal_window_seconds == 0, EInvalidWindow);
        let spot_sqrt = flowx_pool::sqrt_price_current(flowx_pool);
        let quote_token_index = pool::quote_token_index(brownfi_pool);
        assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);
        let spot_price_q32 = quote_per_base_q32(
            spot_sqrt,
            pool::token_a_decimals(brownfi_pool),
            pool::token_b_decimals(brownfi_pool),
            quote_token_index
        );
        let spot_liquidity_quote = liquidity_in_quote(
            flowx_pool::liquidity(flowx_pool),
            spot_sqrt,
            spot_price_q32,
            pool::token_a_decimals(brownfi_pool),
            pool::token_b_decimals(brownfi_pool),
            quote_token_index
        );
        let observed_at_ms = clock::timestamp_ms(clock);
        return oracle_gateway::new_amm_reading(
            pool::id(brownfi_pool),
            source_mask,
            flowx_pool::pool_id(flowx_pool),
            spot_price_q32,
            spot_liquidity_quote,
            twap_window_seconds,
            observed_at_ms,
            observed_at_ms + valid_for_ms
        )
    };

    if (!observation_window_available(flowx_pool, clock, twal_window_seconds)) {
        return zero_liquidity_direct_reading(
            brownfi_pool,
            flowx_pool,
            clock,
            source_mask,
            twap_window_seconds,
            valid_for_ms
        )
    };

    let mut seconds_agos = vector[];
    vector::push_back(&mut seconds_agos, twap_window_seconds);
    vector::push_back(&mut seconds_agos, twal_window_seconds);
    vector::push_back(&mut seconds_agos, 0);

    let (tick_cumulatives, seconds_per_liquidity_cumulatives) =
        flowx_pool::observe(flowx_pool, seconds_agos, clock);
    let tick_delta = flowx_i64::sub(
        *vector::borrow(&tick_cumulatives, 2),
        *vector::borrow(&tick_cumulatives, 0)
    );
    let avg_tick = arithmetic_mean_tick_round_down(tick_delta, twap_window_seconds);
    let price_sqrt = flowx_tick_math::get_sqrt_price_at_tick(avg_tick);
    let spot_sqrt = flowx_pool::sqrt_price_current(flowx_pool);
    let quote_token_index = pool::quote_token_index(brownfi_pool);
    assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);

    let price_q32 = quote_per_base_q32(
        price_sqrt,
        pool::token_a_decimals(brownfi_pool),
        pool::token_b_decimals(brownfi_pool),
        quote_token_index
    );
    let spot_price_q32 = quote_per_base_q32(
        spot_sqrt,
        pool::token_a_decimals(brownfi_pool),
        pool::token_b_decimals(brownfi_pool),
        quote_token_index
    );
    let spot_liquidity_quote = liquidity_in_quote(
        flowx_pool::liquidity(flowx_pool),
        spot_sqrt,
        spot_price_q32,
        pool::token_a_decimals(brownfi_pool),
        pool::token_b_decimals(brownfi_pool),
        quote_token_index
    );

    let seconds_per_liquidity_now = *vector::borrow(&seconds_per_liquidity_cumulatives, 2);
    let seconds_per_liquidity_past = *vector::borrow(&seconds_per_liquidity_cumulatives, 1);
    assert!(seconds_per_liquidity_now >= seconds_per_liquidity_past, EInvalidObservation);
    let twal_liquidity = harmonic_mean_liquidity(
        twal_window_seconds,
        seconds_per_liquidity_now - seconds_per_liquidity_past
    );
    let twal_liquidity_quote = liquidity_in_quote(
        twal_liquidity,
        price_sqrt,
        price_q32,
        pool::token_a_decimals(brownfi_pool),
        pool::token_b_decimals(brownfi_pool),
        quote_token_index
    );
    let liquidity_quote = math::min_u128(spot_liquidity_quote, twal_liquidity_quote);
    let observed_at_ms = clock::timestamp_ms(clock);

    oracle_gateway::new_amm_reading(
        pool::id(brownfi_pool),
        source_mask,
        flowx_pool::pool_id(flowx_pool),
        price_q32,
        liquidity_quote,
        twap_window_seconds,
        observed_at_ms,
        observed_at_ms + valid_for_ms
    )
}

public fun read_two_hop_path<A, B, I>(
    brownfi_pool: &Pool<A, B>,
    base_intermediate_pool: &flowx_pool::Pool<B, I>,
    intermediate_quote_pool: &flowx_pool::Pool<I, A>,
    clock: &Clock,
    source_mask: u64,
    intermediate_decimals: u8,
    twap_window_seconds: u64,
    twal_window_seconds: u64,
    valid_for_ms: u64
): AmmReading {
    assert!(pool::quote_token_index(brownfi_pool) == 0, EInvalidQuoteTokenIndex);
    assert!(twal_window_seconds >= twap_window_seconds, EInvalidWindow);

    if (
        twap_window_seconds > 0 &&
        (
            !observation_window_available(base_intermediate_pool, clock, twal_window_seconds) ||
            !observation_window_available(intermediate_quote_pool, clock, twal_window_seconds)
        )
    ) {
        return zero_liquidity_two_hop_reading(
            brownfi_pool,
            base_intermediate_pool,
            intermediate_quote_pool,
            clock,
            source_mask,
            intermediate_decimals,
            twap_window_seconds,
            valid_for_ms
        )
    };

    let (leg_1_price_sqrt, leg_1_spot_sqrt, leg_1_twal_liquidity) =
        observed_sqrt_prices_and_liquidity(
            base_intermediate_pool,
            clock,
            twap_window_seconds,
            twal_window_seconds
        );
    let (leg_2_price_sqrt, leg_2_spot_sqrt, leg_2_twal_liquidity) =
        observed_sqrt_prices_and_liquidity(
            intermediate_quote_pool,
            clock,
            twap_window_seconds,
            twal_window_seconds
        );

    let base_decimals = pool::token_b_decimals(brownfi_pool);
    let quote_decimals = pool::token_a_decimals(brownfi_pool);
    let leg_1_price_q32 = adjusted_y_per_x_q32(
        leg_1_price_sqrt,
        base_decimals,
        intermediate_decimals
    );
    let leg_1_spot_price_q32 = adjusted_y_per_x_q32(
        leg_1_spot_sqrt,
        base_decimals,
        intermediate_decimals
    );
    let leg_2_price_q32 = adjusted_y_per_x_q32(
        leg_2_price_sqrt,
        intermediate_decimals,
        quote_decimals
    );
    let leg_2_spot_price_q32 = adjusted_y_per_x_q32(
        leg_2_spot_sqrt,
        intermediate_decimals,
        quote_decimals
    );
    let path_price_q32 = math::u256_to_u64_checked(
        ((leg_1_price_q32 as u256) * (leg_2_price_q32 as u256)) / Q32
    );
    assert!(path_price_q32 > 0, EInvalidObservation);

    let leg_1_spot_liquidity_intermediate = liquidity_in_quote(
        flowx_pool::liquidity(base_intermediate_pool),
        leg_1_spot_sqrt,
        leg_1_spot_price_q32,
        base_decimals,
        intermediate_decimals,
        1
    );
    let leg_1_twal_liquidity_intermediate = liquidity_in_quote(
        leg_1_twal_liquidity,
        leg_1_price_sqrt,
        leg_1_price_q32,
        base_decimals,
        intermediate_decimals,
        1
    );
    let leg_1_liquidity_intermediate = math::min_u128(
        leg_1_spot_liquidity_intermediate,
        leg_1_twal_liquidity_intermediate
    );
    let leg_1_liquidity_base = mul_div_down_to_u128(
        leg_1_liquidity_intermediate,
        Q32,
        (leg_1_price_q32 as u256)
    );

    let leg_2_spot_liquidity_quote = liquidity_in_quote(
        flowx_pool::liquidity(intermediate_quote_pool),
        leg_2_spot_sqrt,
        leg_2_spot_price_q32,
        intermediate_decimals,
        quote_decimals,
        1
    );
    let leg_2_twal_liquidity_quote = liquidity_in_quote(
        leg_2_twal_liquidity,
        leg_2_price_sqrt,
        leg_2_price_q32,
        intermediate_decimals,
        quote_decimals,
        1
    );
    let leg_2_liquidity_quote = math::min_u128(
        leg_2_spot_liquidity_quote,
        leg_2_twal_liquidity_quote
    );
    let leg_2_liquidity_base = mul_div_down_to_u128(
        leg_2_liquidity_quote,
        Q32,
        (path_price_q32 as u256)
    );

    let bottleneck_liquidity_base = math::min_u128(leg_1_liquidity_base, leg_2_liquidity_base);
    let liquidity_quote = mul_div_down_to_u128(
        bottleneck_liquidity_base,
        (path_price_q32 as u256),
        Q32
    );
    let observed_at_ms = clock::timestamp_ms(clock);

    oracle_gateway::new_amm_path_reading(
        pool::id(brownfi_pool),
        source_mask,
        flowx_pool::pool_id(base_intermediate_pool),
        flowx_pool::pool_id(intermediate_quote_pool),
        path_price_q32,
        liquidity_quote,
        twap_window_seconds,
        observed_at_ms,
        observed_at_ms + valid_for_ms
    )
}

fun zero_liquidity_direct_reading<A, B>(
    brownfi_pool: &Pool<A, B>,
    flowx_pool: &flowx_pool::Pool<A, B>,
    clock: &Clock,
    source_mask: u64,
    window_seconds: u64,
    valid_for_ms: u64
): AmmReading {
    let spot_sqrt = flowx_pool::sqrt_price_current(flowx_pool);
    let quote_token_index = pool::quote_token_index(brownfi_pool);
    assert!(quote_token_index < 2, EInvalidQuoteTokenIndex);
    let spot_price_q32 = quote_per_base_q32(
        spot_sqrt,
        pool::token_a_decimals(brownfi_pool),
        pool::token_b_decimals(brownfi_pool),
        quote_token_index
    );
    let observed_at_ms = clock::timestamp_ms(clock);
    oracle_gateway::new_amm_reading(
        pool::id(brownfi_pool),
        source_mask,
        flowx_pool::pool_id(flowx_pool),
        spot_price_q32,
        0,
        window_seconds,
        observed_at_ms,
        observed_at_ms + valid_for_ms
    )
}

fun zero_liquidity_two_hop_reading<A, B, I>(
    brownfi_pool: &Pool<A, B>,
    base_intermediate_pool: &flowx_pool::Pool<B, I>,
    intermediate_quote_pool: &flowx_pool::Pool<I, A>,
    clock: &Clock,
    source_mask: u64,
    intermediate_decimals: u8,
    window_seconds: u64,
    valid_for_ms: u64
): AmmReading {
    let base_decimals = pool::token_b_decimals(brownfi_pool);
    let quote_decimals = pool::token_a_decimals(brownfi_pool);
    let leg_1_spot_price_q32 = adjusted_y_per_x_q32(
        flowx_pool::sqrt_price_current(base_intermediate_pool),
        base_decimals,
        intermediate_decimals
    );
    let leg_2_spot_price_q32 = adjusted_y_per_x_q32(
        flowx_pool::sqrt_price_current(intermediate_quote_pool),
        intermediate_decimals,
        quote_decimals
    );
    let path_price_q32 = math::u256_to_u64_checked(
        ((leg_1_spot_price_q32 as u256) * (leg_2_spot_price_q32 as u256)) / Q32
    );
    assert!(path_price_q32 > 0, EInvalidObservation);

    let observed_at_ms = clock::timestamp_ms(clock);
    oracle_gateway::new_amm_path_reading(
        pool::id(brownfi_pool),
        source_mask,
        flowx_pool::pool_id(base_intermediate_pool),
        flowx_pool::pool_id(intermediate_quote_pool),
        path_price_q32,
        0,
        window_seconds,
        observed_at_ms,
        observed_at_ms + valid_for_ms
    )
}

fun observed_sqrt_prices_and_liquidity<X, Y>(
    flowx_pool: &flowx_pool::Pool<X, Y>,
    clock: &Clock,
    twap_window_seconds: u64,
    twal_window_seconds: u64
): (u128, u128, u128) {
    assert!(twal_window_seconds >= twap_window_seconds, EInvalidWindow);
    if (twap_window_seconds == 0) {
        assert!(twal_window_seconds == 0, EInvalidWindow);
        let spot_sqrt = flowx_pool::sqrt_price_current(flowx_pool);
        return (spot_sqrt, spot_sqrt, flowx_pool::liquidity(flowx_pool))
    };

    let mut seconds_agos = vector[];
    vector::push_back(&mut seconds_agos, twap_window_seconds);
    vector::push_back(&mut seconds_agos, twal_window_seconds);
    vector::push_back(&mut seconds_agos, 0);

    let (tick_cumulatives, seconds_per_liquidity_cumulatives) =
        flowx_pool::observe(flowx_pool, seconds_agos, clock);
    let tick_delta = flowx_i64::sub(
        *vector::borrow(&tick_cumulatives, 2),
        *vector::borrow(&tick_cumulatives, 0)
    );
    let avg_tick = arithmetic_mean_tick_round_down(tick_delta, twap_window_seconds);
    let price_sqrt = flowx_tick_math::get_sqrt_price_at_tick(avg_tick);
    let seconds_per_liquidity_now = *vector::borrow(&seconds_per_liquidity_cumulatives, 2);
    let seconds_per_liquidity_past = *vector::borrow(&seconds_per_liquidity_cumulatives, 1);
    assert!(seconds_per_liquidity_now >= seconds_per_liquidity_past, EInvalidObservation);
    let twal_liquidity = harmonic_mean_liquidity(
        twal_window_seconds,
        seconds_per_liquidity_now - seconds_per_liquidity_past
    );
    (price_sqrt, flowx_pool::sqrt_price_current(flowx_pool), twal_liquidity)
}

fun observation_window_available<X, Y>(
    flowx_pool: &flowx_pool::Pool<X, Y>,
    clock: &Clock,
    window_seconds: u64
): bool {
    if (window_seconds == 0) {
        return true
    };

    let now_seconds = clock::timestamp_ms(clock) / 1000;
    if (now_seconds < window_seconds) {
        return false
    };

    let cardinality = flowx_pool::observation_cardinality(flowx_pool);
    if (cardinality == 0) {
        return false
    };

    let observations = flowx_pool::borrow_observations(flowx_pool);
    let latest = vector::borrow(observations, flowx_pool::observation_index(flowx_pool));
    if (!flowx_oracle::is_initialized(latest)) {
        return false
    };

    let target = now_seconds - window_seconds;
    if (flowx_oracle::timestamp_s(latest) <= target) {
        return true
    };

    oldest_observation_available_before_or_at(flowx_pool, target)
}

fun oldest_observation_available_before_or_at<X, Y>(
    flowx_pool: &flowx_pool::Pool<X, Y>,
    target: u64
): bool {
    let cardinality = flowx_pool::observation_cardinality(flowx_pool);
    let observations = flowx_pool::borrow_observations(flowx_pool);
    let oldest_index = (flowx_pool::observation_index(flowx_pool) + 1) % cardinality;
    let oldest = vector::borrow(observations, oldest_index);
    if (flowx_oracle::is_initialized(oldest)) {
        return flowx_oracle::timestamp_s(oldest) <= target
    };

    let first = vector::borrow(observations, 0);
    flowx_oracle::is_initialized(first) && flowx_oracle::timestamp_s(first) <= target
}

fun arithmetic_mean_tick_round_down(tick_delta: flowx_i64::I64, window_seconds: u64): flowx_i32::I32 {
    assert!(window_seconds > 0, EInvalidWindow);
    let window = flowx_i64::from(window_seconds);
    let mut quotient = flowx_i64::div(tick_delta, window);
    let remainder = flowx_i64::mod(tick_delta, window);
    if (flowx_i64::is_neg(tick_delta) && !flowx_i64::eq(remainder, flowx_i64::zero())) {
        quotient = flowx_i64::sub(quotient, flowx_i64::from(1));
    };
    i64_to_i32_checked(quotient)
}

#[test_only]
public fun arithmetic_mean_tick_for_testing(
    tick_delta: flowx_i64::I64,
    window_seconds: u64
): flowx_i32::I32 {
    arithmetic_mean_tick_round_down(tick_delta, window_seconds)
}

fun i64_to_i32_checked(value: flowx_i64::I64): flowx_i32::I32 {
    let abs_value = flowx_i64::abs_u64(value);
    assert!(abs_value <= MAX_FLOWX_TICK, EOverflow);
    if (flowx_i64::is_neg(value)) {
        flowx_i32::neg_from((abs_value as u32))
    } else {
        flowx_i32::from((abs_value as u32))
    }
}

fun quote_per_base_q32(
    sqrt_price: u128,
    decimals_a: u8,
    decimals_b: u8,
    quote_token_index: u8
): u64 {
    if (quote_token_index == 0) {
        adjusted_x_per_y_q32(sqrt_price, decimals_a, decimals_b)
    } else {
        assert!(quote_token_index == 1, EInvalidQuoteTokenIndex);
        adjusted_y_per_x_q32(sqrt_price, decimals_a, decimals_b)
    }
}

fun adjusted_y_per_x_q32(sqrt_price: u128, decimals_x: u8, decimals_y: u8): u64 {
    let raw_price_q32 = raw_y_per_x_q32(sqrt_price);
    let adjusted = decimal_adjust_price(raw_price_q32, decimals_x, decimals_y);
    let price = math::u256_to_u64_checked(adjusted);
    assert!(price > 0, EInvalidObservation);
    price
}

fun adjusted_x_per_y_q32(sqrt_price: u128, decimals_x: u8, decimals_y: u8): u64 {
    let raw_price_q32 = raw_y_per_x_q32(sqrt_price);
    let inverted = if (decimals_y > decimals_x) {
        (Q32 * Q32 * (math::pow_10(decimals_y - decimals_x) as u256)) / raw_price_q32
    } else if (decimals_x > decimals_y) {
        (Q32 * Q32) / (raw_price_q32 * (math::pow_10(decimals_x - decimals_y) as u256))
    } else {
        (Q32 * Q32) / raw_price_q32
    };
    let price = math::u256_to_u64_checked(inverted);
    assert!(price > 0, EInvalidObservation);
    price
}

fun raw_y_per_x_q32(sqrt_price: u128): u256 {
    assert!(sqrt_price > 0, EInvalidObservation);
    ((sqrt_price as u256) * (sqrt_price as u256)) / Q96
}

fun decimal_adjust_price(price_q32: u256, decimals_x: u8, decimals_y: u8): u256 {
    if (decimals_x > decimals_y) {
        price_q32 * (math::pow_10(decimals_x - decimals_y) as u256)
    } else if (decimals_y > decimals_x) {
        price_q32 / (math::pow_10(decimals_y - decimals_x) as u256)
    } else {
        price_q32
    }
}

fun harmonic_mean_liquidity(window_seconds: u64, delta_seconds_per_liquidity: u256): u128 {
    if (delta_seconds_per_liquidity == 0) {
        return 0
    };
    u256_to_u128_checked(((window_seconds as u256) * Q128) / delta_seconds_per_liquidity)
}

fun liquidity_in_quote(
    active_liquidity: u128,
    sqrt_price: u128,
    quote_per_base_q32: u64,
    decimals_a: u8,
    decimals_b: u8,
    quote_token_index: u8
): u128 {
    if (active_liquidity == 0 || sqrt_price == 0) {
        return 0
    };

    let virtual_a = ((active_liquidity as u256) * Q64) / (sqrt_price as u256);
    let virtual_b = ((active_liquidity as u256) * (sqrt_price as u256)) / Q64;
    let normalized_a = amount_to_standard_decimals(virtual_a, decimals_a);
    let normalized_b = amount_to_standard_decimals(virtual_b, decimals_b);
    let quote_value = if (quote_token_index == 0) {
        normalized_a + (normalized_b * (quote_per_base_q32 as u256)) / Q32
    } else {
        assert!(quote_token_index == 1, EInvalidQuoteTokenIndex);
        (normalized_a * (quote_per_base_q32 as u256)) / Q32 + normalized_b
    };
    u256_to_u128_checked(quote_value)
}

fun amount_to_standard_decimals(amount: u256, token_decimals: u8): u256 {
    if (token_decimals > STANDARD_DECIMALS) {
        amount / (math::pow_10(token_decimals - STANDARD_DECIMALS) as u256)
    } else if (token_decimals < STANDARD_DECIMALS) {
        amount * (math::pow_10(STANDARD_DECIMALS - token_decimals) as u256)
    } else {
        amount
    }
}

fun u256_to_u128_checked(value: u256): u128 {
    assert!(value <= MAX_U128, EOverflow);
    (value as u128)
}

fun mul_div_down_to_u128(value: u128, multiplier: u256, divisor: u256): u128 {
    assert!(divisor > 0, EInvalidObservation);
    u256_to_u128_checked(((value as u256) * multiplier) / divisor)
}
