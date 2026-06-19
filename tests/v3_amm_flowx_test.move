#[test_only]
module brownfi_amm::v3_amm_flowx_test {
    use std::type_name;
    use std::vector;
    use sui::balance;
    use sui::clock::{Self, Clock};
    use sui::object;
    use sui::test_scenario::{Self, Scenario, next_tx, take_from_sender, take_shared, return_shared, return_to_sender, ctx};
    use brownfi_amm::admin;
    use brownfi_amm::amm_flowx;
    use brownfi_amm::factory::{AmmCap, Factory, PoolCreatorCap};
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B, C};
    use brownfi_amm::math;
    use brownfi_amm::oracle_gateway;
    use brownfi_amm::pool::{Self, Pool};
    use brownfi_amm::swap;
    use brownfi_oracle::oracle::OracleAdapter;
    use flowx_clmm::i32 as flowx_i32;
    use flowx_clmm::i64 as flowx_i64;
    use flowx_clmm::i128 as flowx_i128;
    use flowx_clmm::pool as flowx_pool;
    use flowx_clmm::position as flowx_position;
    use flowx_clmm::tick_math as flowx_tick_math;
    use flowx_clmm::versioned as flowx_versioned;
    use pyth::price_info::PriceInfoObject;

    const ADDR1: address = @0xA;
    const ADDR2: address = @0xB;
    const FLOWX_SOURCE_MASK: u64 = 1;
    const FLOWX_FEE_RATE: u64 = 3000;
    const FLOWX_TICK_SPACING: u32 = 60;
    const FULL_RANGE_TICK: u32 = 443_580;
    const TICK_60_DECIMAL_TWAP_RELATIVE_PRICE_Q32: u64 = 4_269_275_928_815;

    #[test]
    fun test_flowx_average_tick_rounds_negative_remainder_down() {
        let average_tick = amm_flowx::arithmetic_mean_tick_for_testing(
            flowx_i64::neg_from(61),
            60
        );

        assert!(flowx_i32::eq(average_tick, flowx_i32::neg_from(2)), 0);
    }

    #[test]
    fun test_flowx_direct_pool_reading_is_accepted_by_gateway() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000_000, 1_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                1,
                pool::amm_fallback_fail_closed()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                10_000_000,
                1,
                60,
                120,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let mut clock = take_shared<Clock>(&scenario);
            let flowx_versioned = flowx_versioned::create_for_testing(ctx(&mut scenario));
            let mut flowx_pool = flowx_pool::create_for_testing<A, B>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_one = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::zero());
            flowx_pool::initialize_for_testing(&mut flowx_pool, sqrt_one, &clock, ctx(&mut scenario));
            let mut flowx_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&flowx_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let (amount_a, amount_b) = flowx_pool::modify_liquidity(
                &mut flowx_pool,
                &mut flowx_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<A>(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            assert!(amount_a > 0 && amount_b > 0, 0);
            clock::set_for_testing(&mut clock, 120_000);

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_direct_pool(
                &pool,
                &flowx_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                60,
                120,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 1);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == math::q32(), 2);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 3);

            flowx_position::destroy_for_testing(flowx_position);
            flowx_pool::destroy_for_testing(flowx_pool);
            flowx_versioned::destroy_for_testing(flowx_versioned);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_flowx_two_hop_path_reading_is_accepted_by_gateway() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000_000, 1_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                1,
                pool::amm_fallback_fail_closed()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                10_000_000,
                1,
                60,
                120,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let mut clock = take_shared<Clock>(&scenario);
            let flowx_versioned = flowx_versioned::create_for_testing(ctx(&mut scenario));
            let mut leg_1_pool = flowx_pool::create_for_testing<B, C>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let mut leg_2_pool = flowx_pool::create_for_testing<C, A>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_one = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::zero());
            flowx_pool::initialize_for_testing(&mut leg_1_pool, sqrt_one, &clock, ctx(&mut scenario));
            flowx_pool::initialize_for_testing(&mut leg_2_pool, sqrt_one, &clock, ctx(&mut scenario));
            let mut leg_1_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&leg_1_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<B>(),
                type_name::with_defining_ids<C>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let mut leg_2_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&leg_2_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<C>(),
                type_name::with_defining_ids<A>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let (amount_b, amount_c_1) = flowx_pool::modify_liquidity(
                &mut leg_1_pool,
                &mut leg_1_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                balance::create_for_testing<C>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            let (amount_c_2, amount_a) = flowx_pool::modify_liquidity(
                &mut leg_2_pool,
                &mut leg_2_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<C>(1_000_000_000),
                balance::create_for_testing<A>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            assert!(amount_b > 0 && amount_c_1 > 0 && amount_c_2 > 0 && amount_a > 0, 0);
            clock::set_for_testing(&mut clock, 120_000);

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_two_hop_path<A, B, C>(
                &pool,
                &leg_1_pool,
                &leg_2_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                9,
                60,
                120,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 1);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == math::q32(), 2);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 3);

            flowx_position::destroy_for_testing(leg_1_position);
            flowx_position::destroy_for_testing(leg_2_position);
            flowx_pool::destroy_for_testing(leg_1_pool);
            flowx_pool::destroy_for_testing(leg_2_pool);
            flowx_versioned::destroy_for_testing(flowx_versioned);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_flowx_unavailable_two_hop_twal_window_is_skipped_by_gateway_fallback() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000_000, 1_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                0,
                pool::amm_fallback_oracle_only()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                0,
                1,
                60,
                120,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let mut clock = take_shared<Clock>(&scenario);
            let flowx_versioned = flowx_versioned::create_for_testing(ctx(&mut scenario));
            let mut leg_1_pool = flowx_pool::create_for_testing<B, C>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let mut leg_2_pool = flowx_pool::create_for_testing<C, A>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_one = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::zero());
            flowx_pool::initialize_for_testing(&mut leg_1_pool, sqrt_one, &clock, ctx(&mut scenario));
            flowx_pool::initialize_for_testing(&mut leg_2_pool, sqrt_one, &clock, ctx(&mut scenario));
            let mut leg_1_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&leg_1_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<B>(),
                type_name::with_defining_ids<C>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let mut leg_2_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&leg_2_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<C>(),
                type_name::with_defining_ids<A>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let (amount_b, amount_c_1) = flowx_pool::modify_liquidity(
                &mut leg_1_pool,
                &mut leg_1_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                balance::create_for_testing<C>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            let (amount_c_2, amount_a) = flowx_pool::modify_liquidity(
                &mut leg_2_pool,
                &mut leg_2_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<C>(1_000_000_000),
                balance::create_for_testing<A>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            assert!(amount_b > 0 && amount_c_1 > 0 && amount_c_2 > 0 && amount_a > 0, 0);
            clock::set_for_testing(&mut clock, 60_000);

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_two_hop_path<A, B, C>(
                &pool,
                &leg_1_pool,
                &leg_2_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                9,
                60,
                120,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 0, 1);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == 0, 2);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 3);

            flowx_position::destroy_for_testing(leg_1_position);
            flowx_position::destroy_for_testing(leg_2_position);
            flowx_pool::destroy_for_testing(leg_1_pool);
            flowx_pool::destroy_for_testing(leg_2_pool);
            flowx_versioned::destroy_for_testing(flowx_versioned);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_flowx_oldest_observation_window_is_skipped_by_gateway_fallback() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000_000, 1_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                0,
                pool::amm_fallback_oracle_only()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                0,
                1,
                60,
                110,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let mut clock = take_shared<Clock>(&scenario);
            let flowx_versioned = flowx_versioned::create_for_testing(ctx(&mut scenario));
            let mut flowx_pool = flowx_pool::create_for_testing<A, B>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_one = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::zero());
            flowx_pool::initialize_for_testing(&mut flowx_pool, sqrt_one, &clock, ctx(&mut scenario));
            flowx_pool::increase_observation_cardinality_next(
                &mut flowx_pool,
                2,
                &flowx_versioned,
                ctx(&mut scenario)
            );
            let mut flowx_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&flowx_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let (amount_a, amount_b) = flowx_pool::modify_liquidity(
                &mut flowx_pool,
                &mut flowx_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<A>(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            assert!(amount_a > 0 && amount_b > 0, 0);
            clock::set_for_testing(&mut clock, 60_000);
            flowx_pool::modify_liquidity(
                &mut flowx_pool,
                &mut flowx_position,
                flowx_i128::from(1),
                balance::create_for_testing<A>(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            clock::set_for_testing(&mut clock, 120_000);
            flowx_pool::modify_liquidity(
                &mut flowx_pool,
                &mut flowx_position,
                flowx_i128::from(1),
                balance::create_for_testing<A>(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            clock::set_for_testing(&mut clock, 140_000);

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_direct_pool(
                &pool,
                &flowx_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                60,
                110,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 0, 1);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == 0, 2);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 3);

            flowx_position::destroy_for_testing(flowx_position);
            flowx_pool::destroy_for_testing(flowx_pool);
            flowx_versioned::destroy_for_testing(flowx_versioned);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EAmmQuorumNotMet)]
    fun test_flowx_two_hop_path_requires_both_source_ids_when_allowlisted() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000_000, 1_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                1,
                pool::amm_fallback_fail_closed()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                10_000_000,
                1,
                60,
                120,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);
            let mut clock = take_shared<Clock>(&scenario);
            let flowx_versioned = flowx_versioned::create_for_testing(ctx(&mut scenario));
            let mut leg_1_pool = flowx_pool::create_for_testing<B, C>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let mut leg_2_pool = flowx_pool::create_for_testing<C, A>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_one = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::zero());
            flowx_pool::initialize_for_testing(&mut leg_1_pool, sqrt_one, &clock, ctx(&mut scenario));
            flowx_pool::initialize_for_testing(&mut leg_2_pool, sqrt_one, &clock, ctx(&mut scenario));
            let mut allowed_ids = vector[];
            vector::push_back(&mut allowed_ids, flowx_pool::pool_id(&leg_1_pool));
            admin::set_pool_amm_source_ids(&mut pool, &amm_cap, allowed_ids);

            let mut leg_1_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&leg_1_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<B>(),
                type_name::with_defining_ids<C>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let mut leg_2_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&leg_2_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<C>(),
                type_name::with_defining_ids<A>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let (amount_b, amount_c_1) = flowx_pool::modify_liquidity(
                &mut leg_1_pool,
                &mut leg_1_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                balance::create_for_testing<C>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            let (amount_c_2, amount_a) = flowx_pool::modify_liquidity(
                &mut leg_2_pool,
                &mut leg_2_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<C>(1_000_000_000),
                balance::create_for_testing<A>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            assert!(amount_b > 0 && amount_c_1 > 0 && amount_c_2 > 0 && amount_a > 0, 0);
            clock::set_for_testing(&mut clock, 120_000);

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_two_hop_path<A, B, C>(
                &pool,
                &leg_1_pool,
                &leg_2_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                9,
                60,
                120,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );

            flowx_position::destroy_for_testing(leg_1_position);
            flowx_position::destroy_for_testing(leg_2_position);
            flowx_pool::destroy_for_testing(leg_1_pool);
            flowx_pool::destroy_for_testing(leg_2_pool);
            flowx_versioned::destroy_for_testing(flowx_versioned);
            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_flowx_zero_window_uses_spot_price_and_spot_liquidity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000_000, 1_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                1,
                pool::amm_fallback_fail_closed()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                10_000_000,
                1,
                0,
                0,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let flowx_versioned = flowx_versioned::create_for_testing(ctx(&mut scenario));
            let mut flowx_pool = flowx_pool::create_for_testing<A, B>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_one = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::zero());
            flowx_pool::initialize_for_testing(&mut flowx_pool, sqrt_one, &clock, ctx(&mut scenario));
            let mut flowx_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&flowx_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let (amount_a, amount_b) = flowx_pool::modify_liquidity(
                &mut flowx_pool,
                &mut flowx_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<A>(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            assert!(amount_a > 0 && amount_b > 0, 0);

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_direct_pool(
                &pool,
                &flowx_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                0,
                0,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 1);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == math::q32(), 2);

            flowx_position::destroy_for_testing(flowx_position);
            flowx_pool::destroy_for_testing(flowx_pool);
            flowx_versioned::destroy_for_testing(flowx_versioned);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_flowx_zero_liquidity_direct_pool_is_skipped_by_gateway_fallback() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000_000, 1_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                0,
                pool::amm_fallback_oracle_only()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                0,
                1,
                0,
                0,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut flowx_pool = flowx_pool::create_for_testing<A, B>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_one = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::zero());
            flowx_pool::initialize_for_testing(&mut flowx_pool, sqrt_one, &clock, ctx(&mut scenario));

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_direct_pool(
                &pool,
                &flowx_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                0,
                0,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 0, 1);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == 0, 2);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 3);

            flowx_pool::destroy_for_testing(flowx_pool);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_flowx_unavailable_twal_window_is_skipped_by_gateway_fallback() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000_000, 1_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                0,
                pool::amm_fallback_oracle_only()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                0,
                1,
                60,
                120,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let mut clock = take_shared<Clock>(&scenario);
            let flowx_versioned = flowx_versioned::create_for_testing(ctx(&mut scenario));
            let mut flowx_pool = flowx_pool::create_for_testing<A, B>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_one = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::zero());
            flowx_pool::initialize_for_testing(&mut flowx_pool, sqrt_one, &clock, ctx(&mut scenario));
            let mut flowx_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&flowx_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let (amount_a, amount_b) = flowx_pool::modify_liquidity(
                &mut flowx_pool,
                &mut flowx_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<A>(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            assert!(amount_a > 0 && amount_b > 0, 0);
            clock::set_for_testing(&mut clock, 60_000);

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_direct_pool(
                &pool,
                &flowx_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                60,
                120,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 0, 1);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == 0, 2);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 3);

            flowx_position::destroy_for_testing(flowx_position);
            flowx_pool::destroy_for_testing(flowx_pool);
            flowx_versioned::destroy_for_testing(flowx_versioned);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_flowx_zero_window_normalizes_decimal_mismatch_to_quote_per_base() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_test_pool_with_decimals(&mut scenario, 1_000_000_000, 1_000_000_000, 6, 9);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                1,
                pool::amm_fallback_fail_closed()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                10_000_000,
                1,
                0,
                0,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let flowx_versioned = flowx_versioned::create_for_testing(ctx(&mut scenario));
            let mut flowx_pool = flowx_pool::create_for_testing<A, B>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_one = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::zero());
            flowx_pool::initialize_for_testing(&mut flowx_pool, sqrt_one, &clock, ctx(&mut scenario));
            let mut flowx_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&flowx_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let (amount_a, amount_b) = flowx_pool::modify_liquidity(
                &mut flowx_pool,
                &mut flowx_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<A>(1_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            assert!(amount_a > 0 && amount_b > 0, 0);

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_direct_pool(
                &pool,
                &flowx_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                0,
                0,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            let expected_rel = math::q32() * 1000;
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 1);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == expected_rel, 2);

            flowx_position::destroy_for_testing(flowx_position);
            flowx_pool::destroy_for_testing(flowx_pool);
            flowx_versioned::destroy_for_testing(flowx_versioned);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_flowx_twap_normalizes_non_one_tick_decimal_mismatch_to_quote_per_base() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_test_pool_with_decimals(&mut scenario, 1_000_000_000, 1_000_000_000, 6, 9);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                1,
                pool::amm_fallback_fail_closed()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                10_000_000,
                1,
                60,
                120,
                FLOWX_SOURCE_MASK,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let mut clock = take_shared<Clock>(&scenario);
            let flowx_versioned = flowx_versioned::create_for_testing(ctx(&mut scenario));
            let mut flowx_pool = flowx_pool::create_for_testing<A, B>(
                FLOWX_FEE_RATE,
                FLOWX_TICK_SPACING,
                ctx(&mut scenario)
            );
            let sqrt_tick_60 = flowx_tick_math::get_sqrt_price_at_tick(flowx_i32::from(FLOWX_TICK_SPACING));
            flowx_pool::initialize_for_testing(&mut flowx_pool, sqrt_tick_60, &clock, ctx(&mut scenario));
            let mut flowx_position = flowx_position::create_for_testing(
                flowx_pool::pool_id(&flowx_pool),
                FLOWX_FEE_RATE,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                flowx_i32::neg_from(FULL_RANGE_TICK),
                flowx_i32::from(FULL_RANGE_TICK),
                ctx(&mut scenario)
            );
            let (amount_a, amount_b) = flowx_pool::modify_liquidity(
                &mut flowx_pool,
                &mut flowx_position,
                flowx_i128::from(1_000_000_000),
                balance::create_for_testing<A>(10_000_000_000),
                balance::create_for_testing<B>(10_000_000_000),
                &flowx_versioned,
                &clock,
                ctx(&mut scenario)
            );
            assert!(amount_a > 0 && amount_b > 0, 0);
            clock::set_for_testing(&mut clock, 120_000);

            let reading_a = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                1_000_000_000_000
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let amm_reading = amm_flowx::read_direct_pool(
                &pool,
                &flowx_pool,
                &clock,
                FLOWX_SOURCE_MASK,
                60,
                120,
                15_000
            );
            let mut amm_readings = vector[];
            vector::push_back(&mut amm_readings, amm_reading);

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 1);
            assert!(
                oracle_gateway::bundle_amm_relative_price(&bundle) == TICK_60_DECIMAL_TWAP_RELATIVE_PRICE_Q32,
                2
            );

            flowx_position::destroy_for_testing(flowx_position);
            flowx_pool::destroy_for_testing(flowx_pool);
            flowx_versioned::destroy_for_testing(flowx_versioned);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    fun create_test_pool_with_decimals(
        scenario: &mut Scenario,
        init_a: u64,
        init_b: u64,
        decimals_a: u8,
        decimals_b: u8
    ) {
        next_tx(scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(scenario);
            let oracle = take_shared<OracleAdapter>(scenario);
            let clock = take_shared<Clock>(scenario);
            let pio_a = take_shared<PriceInfoObject>(scenario);
            let pio_b = take_shared<PriceInfoObject>(scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(scenario);

            let init_a = balance::create_for_testing<A>(init_a);
            let init_b = balance::create_for_testing<B>(init_b);
            let lp = swap::create_pool_for_testing(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                init_a,
                init_b,
                decimals_a,
                decimals_b,
                ctx(scenario)
            );
            sui::transfer::public_transfer(sui::coin::from_balance(lp, ctx(scenario)), ADDR1);

            return_to_sender<PoolCreatorCap>(scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
        };
    }

    fun new_test_reading(
        source: u8,
        source_mask: u64,
        source_id: ID,
        feed_id: vector<u8>,
        price_q: u64
    ): oracle_gateway::PriceReading {
        oracle_gateway::new_price_reading(
            source,
            source_mask,
            source_id,
            feed_id,
            price_q,
            price_q,
            price_q,
            0,
            0,
            150_000,
            true,
            8,
            9
        )
    }
}
