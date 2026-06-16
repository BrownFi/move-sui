#[test_only]
module brownfi_amm::v3_oracle_gateway_test {
    use std::vector;
    use sui::balance;
    use sui::clock::{Self as clock, Clock};
    use sui::event;
    use sui::object;
    use sui::test_scenario::{Self, next_tx, take_shared, return_shared, take_from_sender, return_to_sender, ctx};
    use pyth::price_info::{Self, PriceInfoObject};
    use pyth::price_feed;
    use pyth::price_identifier;
    use pyth::price;
    use pyth::i64;
    use brownfi_amm::admin;
    use brownfi_amm::events;
    use brownfi_amm::factory::{AmmCap, Factory, OracleCap, PoolCreatorCap, RiskCap};
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B};
    use brownfi_amm::math;
    use brownfi_amm::oracle_gateway;
    use brownfi_amm::pool::{Self, Pool};
    use brownfi_amm::pyth_source;
    use brownfi_amm::swap;
    use brownfi_oracle::oracle::{Self as oracle, OracleAdapter};

    const ADDR1: address = @0xA;
    const PRECISION: u64 = 100_000_000;

    #[test]
    fun test_pyth_only_gateway_returns_neutral_prices_for_equal_test_feeds() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);

            let (pyth_a, pyth_b, adj_price, sell_price, buy_price) =
                oracle_gateway::get_swap_prices(&oracle, &pio_a, &pio_b, &clock, &pool);

            assert!(pyth_a == 1_000_000_000, 0);
            assert!(pyth_b == 1_000_000_000, 0);
            assert!(adj_price == math::q32(), 0);
            assert!(sell_price == math::q32(), 0);
            assert!(buy_price == math::q32(), 0);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_applies_base_heavy_skew_before_spread() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000, 20_000_000);
        let lambda = math::q32() / 2000;

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);
            admin::set_pool_lambda(&mut pool, &risk_cap, lambda);
            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let bundle = oracle_gateway::get_swap_price_bundle(&oracle, &pio_a, &pio_b, &clock, &pool);
            let expected_skew_price = expected_skew_price(
                pool::balance_b(&pool),
                pool::balance_a(&pool),
                math::q32(),
                lambda,
                pool::fee(&pool),
                pool::s_bound(&pool)
            );

            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 0);
            assert!(expected_skew_price < math::q32(), 1);
            assert!(oracle_gateway::bundle_sell_price(&bundle) == expected_skew_price, 2);
            assert!(oracle_gateway::bundle_buy_price(&bundle) == expected_skew_price, 3);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_applies_quote_heavy_skew_before_spread() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 20_000_000, 10_000_000);
        let lambda = math::q32() / 2000;

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);
            admin::set_pool_lambda(&mut pool, &risk_cap, lambda);
            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let bundle = oracle_gateway::get_swap_price_bundle(&oracle, &pio_a, &pio_b, &clock, &pool);
            let expected_skew_price = expected_skew_price(
                pool::balance_b(&pool),
                pool::balance_a(&pool),
                math::q32(),
                lambda,
                pool::fee(&pool),
                pool::s_bound(&pool)
            );

            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 0);
            assert!(expected_skew_price > math::q32(), 1);
            assert!(oracle_gateway::bundle_sell_price(&bundle) == expected_skew_price, 2);
            assert!(oracle_gateway::bundle_buy_price(&bundle) == expected_skew_price, 3);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_price_bundle_binds_price_to_pool_and_validity_window() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_pool_id(&bundle) == object::id(&pool), 0);
            assert!(oracle_gateway::bundle_quote_token_index(&bundle) == 0, 0);
            assert!(oracle_gateway::bundle_policy_version(&bundle) == 0, 0);
            assert!(oracle_gateway::bundle_created_at_ms(&bundle) == 0, 0);
            assert!(oracle_gateway::bundle_valid_until_ms(&bundle) == 15_000, 0);
            assert!(oracle_gateway::bundle_source_count(&bundle) == 1, 0);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 0, 0);
            assert!(oracle_gateway::bundle_pyth_price_a(&bundle) == 1_000_000_000, 0);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle) == 1_000_000_000, 0);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 0);
            assert!(oracle_gateway::bundle_sell_price(&bundle) == math::q32(), 0);
            assert!(oracle_gateway::bundle_buy_price(&bundle) == math::q32(), 0);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_pyth_source_readings_feed_gateway_bundle() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                200_000_000,
                0,
                &mut scenario
            );

            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            assert!(oracle_gateway::reading_source(&reading_a) == pool::oracle_source_pyth(), 0);
            assert!(oracle_gateway::reading_feed_id(&reading_a) == pool::oracle_config_data_a(&pool), 1);
            assert!(oracle_gateway::reading_price(&reading_a) == 1_000_000_000, 2);
            assert!(oracle_gateway::reading_price(&reading_b) == 2_000_000_000, 3);
            assert!(oracle_gateway::bundle_pyth_price_a(&bundle) == 1_000_000_000, 4);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle) == 2_000_000_000, 5);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32() * 2, 6);
            assert!(oracle_gateway::bundle_source_count(&bundle) == 1, 7);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_pyth_bundle_validity_uses_publish_time_not_current_time() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let mut clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                200_000_000,
                0,
                &mut scenario
            );

            clock::set_for_testing(&mut clock, 10_000);

            let direct_bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let reading_bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_valid_until_ms(&direct_bundle) == 15_000, 0);
            assert!(oracle_gateway::bundle_valid_until_ms(&reading_bundle) == 15_000, 1);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EOraclePolicyMismatch)]
    fun test_pyth_source_rejects_unrepresentable_validity_window() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_max_price_age(&mut pool, &oracle_cap, 18_446_744_073_709_552);

            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                &mut scenario
            );

            let _reading = pyth_source::read_price_a(&pio_a, &clock, &pool);

            price_info::destroy(pio_a);
            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EOraclePolicyMismatch)]
    fun test_direct_pyth_bundle_rejects_unrepresentable_validity_window() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_max_price_age(&mut pool, &oracle_cap, 18_446_744_073_709_552);

            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                &mut scenario
            );

            let _bundle = oracle_gateway::get_swap_price_bundle(&oracle, &pio_a, &pio_b, &clock, &pool);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_primary_with_sanity_accepts_multi_source_reading_quorum() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_quorum(
                &mut pool,
                &oracle_cap,
                2,
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_mask_pyth() | 2
            );
            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                pool::oracle_source_pyth(),
                0,
                1_000_000,
                5_000_000,
                pool::oracle_mode_primary_with_sanity()
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_040_000_000
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs(
                &readings_a,
                &readings_b,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_source_count(&bundle) == 2, 0);
            assert!(oracle_gateway::bundle_pyth_price_a(&bundle) == 1_000_000_000, 1);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle) == 2_000_000_000, 2);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32() * 2, 3);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            let mut emitted = event::events_by_type<events::OracleQuorumUsed>();
            assert!(vector::length(&emitted) == 1, 4);
            let quorum_event = vector::pop_back(&mut emitted);
            events::assert_oracle_quorum_used_for_testing(
                quorum_event,
                object::id(&pool),
                oracle_gateway::bundle_policy_version(&bundle),
                oracle_gateway::bundle_policy_digest(&bundle),
                oracle_gateway::bundle_price_digest(&bundle),
                pool::oracle_mode_primary_with_sanity(),
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth() | 2,
                2,
                pool::oracle_source_mask_pyth(),
                2,
                oracle_gateway::bundle_oracle_relative_price(&bundle),
                oracle_gateway::bundle_valid_until_ms(&bundle)
            );

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_median_mode_uses_middle_relative_candidate() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_quorum(
                &mut pool,
                &oracle_cap,
                3,
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_mask_pyth() | 2 | 4
            );
            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                pool::oracle_source_pyth(),
                0,
                1_000_000,
                15_000_000,
                pool::oracle_mode_median()
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    1_800_000_000
                )
            );
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    2,
                    4,
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    2,
                    4,
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_200_000_000
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs(
                &readings_a,
                &readings_b,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_source_count(&bundle) == 3, 0);
            assert!(oracle_gateway::bundle_pyth_price_a(&bundle) == 1_000_000_000, 1);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle) == 2_000_000_000, 2);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32() * 2, 3);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EOraclePolicyMismatch)]
    fun test_gateway_median_mode_rejects_even_source_count_without_tie_policy() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_quorum(
                &mut pool,
                &oracle_cap,
                2,
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_mask_pyth() | 2
            );
            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                pool::oracle_source_pyth(),
                0,
                1_000_000,
                15_000_000,
                pool::oracle_mode_median()
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    1_800_000_000
                )
            );
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs(
                &readings_a,
                &readings_b,
                &clock,
                &pool
            );
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_oracle_candidate_makeup_changes_price_digest() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_quorum(
                &mut pool,
                &oracle_cap,
                2,
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_mask_pyth() | 2
            );
            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                pool::oracle_source_pyth(),
                0,
                1_000_000,
                5_000_000,
                pool::oracle_mode_primary_with_sanity()
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            let mut readings_a_1 = vector[];
            let mut readings_b_1 = vector[];
            vector::push_back(
                &mut readings_a_1,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b_1,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );
            vector::push_back(
                &mut readings_a_1,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b_1,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_040_000_000
                )
            );

            let mut readings_a_2 = vector[];
            let mut readings_b_2 = vector[];
            vector::push_back(
                &mut readings_a_2,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b_2,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );
            vector::push_back(
                &mut readings_a_2,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b_2,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    1_960_000_000
                )
            );

            let bundle_1 = oracle_gateway::get_swap_price_bundle_from_reading_pairs(
                &readings_a_1,
                &readings_b_1,
                &clock,
                &pool
            );
            let bundle_2 = oracle_gateway::get_swap_price_bundle_from_reading_pairs(
                &readings_a_2,
                &readings_b_2,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_adj_price(&bundle_1) == oracle_gateway::bundle_adj_price(&bundle_2), 0);
            assert!(oracle_gateway::bundle_sell_price(&bundle_1) == oracle_gateway::bundle_sell_price(&bundle_2), 1);
            assert!(oracle_gateway::bundle_buy_price(&bundle_1) == oracle_gateway::bundle_buy_price(&bundle_2), 2);
            assert!(oracle_gateway::bundle_source_count(&bundle_1) == oracle_gateway::bundle_source_count(&bundle_2), 3);
            assert!(oracle_gateway::bundle_price_digest(&bundle_1) != oracle_gateway::bundle_price_digest(&bundle_2), 4);

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EOracleDiscrepancyTooHigh)]
    fun test_gateway_rejects_reading_pair_confidence_above_policy() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                pool::oracle_source_pyth(),
                0,
                1_000_000,
                0,
                pool::oracle_mode_primary_with_sanity()
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading_with_confidence(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000,
                    20_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs(
                &readings_a,
                &readings_b,
                &clock,
                &pool
            );

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
            assert!(oracle_gateway::bundle_source_count(&bundle) == 0, 0);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EOracleDiscrepancyTooHigh)]
    fun test_gateway_rejects_single_reading_pair_confidence_above_policy() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                pool::oracle_source_pyth(),
                0,
                1_000_000,
                0,
                pool::oracle_mode_primary_with_sanity()
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            let reading_a = new_test_reading_with_confidence(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                1_000_000_000,
                20_000_000
            );
            let reading_b = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                2_000_000_000
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
            assert!(oracle_gateway::bundle_source_count(&bundle) == 0, 0);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_blends_weighted_amm_readings_with_oracle_relative_price() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                2,
                pool::amm_fallback_fail_closed()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                10_000_000,
                1_000,
                60,
                900,
                1 | 2,
                4
            );
            return_to_sender<AmmCap>(&scenario, amm_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );

            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    math::q32() * 2,
                    1_000,
                    60
                )
            );
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    2,
                    math::q32() * 17 / 8,
                    3_000,
                    60
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_source_count(&bundle) == 1, 0);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 2, 1);
            assert!(oracle_gateway::bundle_pyth_price_a(&bundle) == 1_000_000_000, 2);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle) == 2_000_000_000, 3);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32() * 131 / 64, 4);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            let mut emitted = event::events_by_type<events::AmmTwapUsed>();
            assert!(vector::length(&emitted) == 1, 5);
            let twap_event = vector::pop_back(&mut emitted);
            events::assert_amm_twap_used_for_testing(
                twap_event,
                object::id(&pool),
                oracle_gateway::bundle_policy_version(&bundle),
                oracle_gateway::bundle_policy_digest(&bundle),
                oracle_gateway::bundle_price_digest(&bundle),
                1 | 2,
                2,
                math::q32() * 67 / 32,
                oracle_gateway::bundle_oracle_relative_price(&bundle),
                oracle_gateway::bundle_adj_price(&bundle),
                oracle_gateway::bundle_o_spread(&bundle),
                4_000u256,
                60,
                900,
                oracle_gateway::bundle_valid_until_ms(&bundle)
            );

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_default_amm_blend_policy_uses_registered_source_without_extra_enable_call() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                0,
                0,
                0,
                0,
                1,
                4
            );
            return_to_sender<AmmCap>(&scenario, amm_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    1_000_000_000
                )
            );

            let amm_relative = math::q32() * 11 / 10;
            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    amm_relative,
                    1_000,
                    60
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            let expected_adj_price = math::mul_div_down_to_u64(
                (math::q32() as u128),
                50_000_000,
                (PRECISION as u128)
            ) + math::mul_div_down_to_u64(
                (amm_relative as u128),
                50_000_000,
                (PRECISION as u128)
            );

            assert!(oracle_gateway::bundle_source_count(&bundle) == 1, 0);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 1);
            assert!(oracle_gateway::bundle_oracle_relative_price(&bundle) == math::q32(), 2);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == amm_relative, 3);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == expected_adj_price, 4);
            assert!(oracle_gateway::bundle_o_spread(&bundle) <= (pool::dis_threshold(&pool) as u64), 5);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_blends_amm_reading_with_median_oracle_relative_price() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_oracle_quorum(
                &mut pool,
                &oracle_cap,
                3,
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_mask_pyth() | 2 | 4
            );
            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                pool::oracle_source_pyth(),
                0,
                1_000_000,
                15_000_000,
                pool::oracle_mode_median()
            );
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
                50_000_000,
                1_000,
                60,
                900,
                1,
                4
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_to_sender<AmmCap>(&scenario, amm_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    1_800_000_000
                )
            );
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    1,
                    2,
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    2,
                    4,
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    2,
                    4,
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_200_000_000
                )
            );

            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    math::q32() * 17 / 8,
                    1_000,
                    60
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_source_count(&bundle) == 3, 0);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 1);
            assert!(oracle_gateway::bundle_pyth_price_a(&bundle) == 1_000_000_000, 2);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle) == 2_000_000_000, 3);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32() * 33 / 16, 4);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_oracle_only_fallback_ignores_invalid_advisory_amm_reading() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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
                1_000,
                60,
                900,
                1,
                4
            );
            return_to_sender<AmmCap>(&scenario, amm_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );

            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    math::q32() * 3,
                    999,
                    60
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_source_count(&bundle) == 1, 0);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 0, 1);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32() * 2, 2);
            assert!(oracle_gateway::bundle_sell_price(&bundle) == math::q32() * 2, 3);
            assert!(oracle_gateway::bundle_buy_price(&bundle) == math::q32() * 2, 4);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_skips_advisory_amm_reading_outside_ospread_policy() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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
                10_000_000,
                1_000,
                60,
                900,
                1 | 2,
                4
            );
            return_to_sender<AmmCap>(&scenario, amm_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );

            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    math::q32() * 2,
                    1_000,
                    60
                )
            );
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    2,
                    math::q32() * 4,
                    1_000,
                    60
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_source_count(&bundle) == 1, 0);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 1);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32() * 2, 2);
            assert!(oracle_gateway::bundle_sell_price(&bundle) == math::q32() * 2, 3);
            assert!(oracle_gateway::bundle_buy_price(&bundle) == math::q32() * 2, 4);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_filters_amm_readings_by_allowed_source_id() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);
            let allowed_source_id = object::id_from_address(@0xF10A);
            let blocked_source_id = object::id_from_address(@0xBAD);

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
                0,
                1_000,
                60,
                900,
                1,
                4
            );
            let mut allowed_ids = vector[];
            vector::push_back(&mut allowed_ids, allowed_source_id);
            admin::set_pool_amm_source_ids(&mut pool, &amm_cap, allowed_ids);
            return_to_sender<AmmCap>(&scenario, amm_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );

            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading_with_source_id(
                    object::id(&pool),
                    1,
                    blocked_source_id,
                    math::q32() * 4,
                    10_000,
                    60
                )
            );
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading_with_source_id(
                    object::id(&pool),
                    1,
                    allowed_source_id,
                    math::q32() * 2,
                    1_000,
                    60
                )
            );

            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_source_count(&bundle) == 1, 0);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 1);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == math::q32() * 2, 2);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32() * 2, 3);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_amm_candidate_makeup_changes_price_digest() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                50_000_000,
                2,
                pool::amm_fallback_fail_closed()
            );
            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                0,
                1_000,
                60,
                900,
                1 | 2,
                4
            );
            return_to_sender<AmmCap>(&scenario, amm_cap);

            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(
                &mut readings_a,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_a(&pool),
                    pool::oracle_config_data_a(&pool),
                    1_000_000_000
                )
            );
            vector::push_back(
                &mut readings_b,
                new_test_reading(
                    pool::oracle_source_pyth(),
                    pool::oracle_source_mask_pyth(),
                    pool::oracle_source_id_b(&pool),
                    pool::oracle_config_data_b(&pool),
                    2_000_000_000
                )
            );

            let mut flat_amm_readings = vector[];
            vector::push_back(
                &mut flat_amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    math::q32() * 2,
                    1_000,
                    60
                )
            );
            vector::push_back(
                &mut flat_amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    2,
                    math::q32() * 2,
                    1_000,
                    60
                )
            );

            let mut split_amm_readings = vector[];
            vector::push_back(
                &mut split_amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    math::q32() * 3,
                    1_000,
                    60
                )
            );
            vector::push_back(
                &mut split_amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    2,
                    math::q32(),
                    1_000,
                    60
                )
            );

            let flat_bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &flat_amm_readings,
                &clock,
                &pool
            );
            let split_bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &split_amm_readings,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_adj_price(&flat_bundle) == oracle_gateway::bundle_adj_price(&split_bundle), 0);
            assert!(oracle_gateway::bundle_sell_price(&flat_bundle) == oracle_gateway::bundle_sell_price(&split_bundle), 1);
            assert!(oracle_gateway::bundle_buy_price(&flat_bundle) == oracle_gateway::bundle_buy_price(&split_bundle), 2);
            assert!(oracle_gateway::bundle_amm_source_count(&flat_bundle) == oracle_gateway::bundle_amm_source_count(&split_bundle), 3);
            assert!(oracle_gateway::bundle_price_digest(&flat_bundle) != oracle_gateway::bundle_price_digest(&split_bundle), 4);

            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EBundlePolicyMismatch)]
    fun test_bundle_validation_rejects_oracle_aggregation_policy_update() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                pool::oracle_source_pyth(),
                2_000,
                1_000_000,
                5_000_000,
                pool::oracle_mode_primary_with_sanity()
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EBundlePolicyMismatch)]
    fun test_bundle_validation_rejects_amm_source_policy_update() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                5_000_000,
                1_000_000_000,
                60,
                900,
                1,
                4
            );
            return_to_sender<AmmCap>(&scenario, amm_cap);

            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EBundlePolicyMismatch)]
    fun test_bundle_validation_rejects_pyth_weight_policy_update() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            admin::set_pool_pyth_weight(&mut pool, &oracle_cap, 60_000_000);
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_pyth_confidence_range_adds_dynamic_spread_when_no_amm_source() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let mut oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                1_000_000,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                1_000_000,
                &mut scenario
            );

            oracle::configure_token<A>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xAAAA),
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            );
            oracle::configure_token<B>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xBBBB),
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            );

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            let adj_price = math::q32();
            let rel_upper = math::mul_div_down_to_u64(1_010_000_000, (math::q32() as u128), 990_000_000);
            let rel_lower = math::mul_div_down_to_u64(990_000_000, (math::q32() as u128), 1_010_000_000);
            let o_spread = math::mul_div_up_to_u64(
                ((rel_upper - rel_lower) as u128),
                (PRECISION as u128),
                (adj_price as u128)
            );

            assert!(oracle_gateway::bundle_adj_price(&bundle) == adj_price, 0);
            assert!(
                oracle_gateway::bundle_sell_price(&bundle) == math::mul_div_up_to_u64(
                    (adj_price as u128),
                    ((PRECISION + o_spread) as u128),
                    (PRECISION as u128)
                ),
                1
            );
            assert!(
                oracle_gateway::bundle_buy_price(&bundle) == math::mul_div_down_to_u64(
                    (adj_price as u128),
                    ((PRECISION - o_spread) as u128),
                    (PRECISION as u128)
                ),
                2
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_spread_pipeline_matches_solidity_fix_and_side_spreads() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                &mut scenario
            );
            let adj_price = math::q32();

            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                1_000_000,
                10_000_000,
                0
            );
            let fixed_bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let expected_fixed_sell = math::mul_div_up_to_u64(
                (adj_price as u128),
                ((PRECISION + 1_000_000) as u128),
                (PRECISION as u128)
            );
            assert!(oracle_gateway::bundle_sell_price(&fixed_bundle) == expected_fixed_sell, 0);
            assert!(oracle_gateway::bundle_o_spread(&fixed_bundle) == 0, 1);

            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                500_000,
                500_000,
                10_000_000,
                0
            );
            let buy_bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let expected_buy = math::mul_div_down_to_u64(
                (adj_price as u128),
                ((PRECISION - 1_000_000) as u128),
                (PRECISION as u128)
            );
            assert!(oracle_gateway::bundle_buy_price(&buy_bundle) == expected_buy, 2);

            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                300_000,
                200_000,
                500_000,
                10_000_000,
                0
            );
            let side_bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let expected_side_sell = math::mul_div_up_to_u64(
                (adj_price as u128),
                ((PRECISION + 800_000) as u128),
                (PRECISION as u128)
            );
            let expected_side_buy = math::mul_div_down_to_u64(
                (adj_price as u128),
                ((PRECISION - 700_000) as u128),
                (PRECISION as u128)
            );
            assert!(oracle_gateway::bundle_sell_price(&side_bundle) == expected_side_sell, 3);
            assert!(oracle_gateway::bundle_buy_price(&side_bundle) == expected_side_buy, 4);
            assert!(
                oracle_gateway::bundle_sell_price(&side_bundle) > oracle_gateway::bundle_buy_price(&side_bundle),
                5
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_bundle_digests_commit_to_policy_and_resolved_prices() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let mut oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a_1 = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                &mut scenario
            );
            let pio_b_1 = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                &mut scenario
            );
            let pio_a_2 = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                200_000_000,
                0,
                &mut scenario
            );
            let pio_b_2 = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                &mut scenario
            );

            oracle::configure_token<A>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xAAAA),
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            );
            oracle::configure_token<B>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xBBBB),
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            );

            let bundle_1 = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a_1,
                &pio_b_1,
                &clock,
                &pool
            );
            let bundle_2 = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a_2,
                &pio_b_2,
                &clock,
                &pool
            );

            let policy_digest_1 = oracle_gateway::bundle_policy_digest(&bundle_1);
            let policy_digest_2 = oracle_gateway::bundle_policy_digest(&bundle_2);
            let price_digest_1 = oracle_gateway::bundle_price_digest(&bundle_1);
            let price_digest_2 = oracle_gateway::bundle_price_digest(&bundle_2);

            assert!(vector::length(&policy_digest_1) == 32, 0);
            assert!(vector::length(&price_digest_1) == 32, 1);
            assert!(policy_digest_1 == policy_digest_2, 2);
            assert!(price_digest_1 != price_digest_2, 3);

            price_info::destroy(pio_a_1);
            price_info::destroy(pio_b_1);
            price_info::destroy(pio_a_2);
            price_info::destroy(pio_b_2);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_direct_pyth_bundle_digest_matches_reading_bundle_digest() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                1_000_000,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                200_000_000,
                2_000_000,
                &mut scenario
            );

            let direct_bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let reading_bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            assert!(
                oracle_gateway::bundle_policy_digest(&direct_bundle)
                    == oracle_gateway::bundle_policy_digest(&reading_bundle),
                0
            );
            assert!(
                oracle_gateway::bundle_price_digest(&direct_bundle)
                    == oracle_gateway::bundle_price_digest(&reading_bundle),
                1
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_pyth_bundle_digest_commits_exponent_metadata_when_normalized_prices_match() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a_8 = new_pyth_price_info_with_exponent(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                8,
                true,
                &mut scenario
            );
            let pio_b_8 = new_pyth_price_info_with_exponent(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                200_000_000,
                0,
                8,
                true,
                &mut scenario
            );
            let pio_a_9 = new_pyth_price_info_with_exponent(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                1_000_000_000,
                0,
                9,
                true,
                &mut scenario
            );
            let pio_b_9 = new_pyth_price_info_with_exponent(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                2_000_000_000,
                0,
                9,
                true,
                &mut scenario
            );

            let reading_a_8 = pyth_source::read_price_a(&pio_a_8, &clock, &pool);
            let reading_b_8 = pyth_source::read_price_b(&pio_b_8, &clock, &pool);
            let reading_a_9 = pyth_source::read_price_a(&pio_a_9, &clock, &pool);
            let reading_b_9 = pyth_source::read_price_b(&pio_b_9, &clock, &pool);
            let bundle_8 = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a_8,
                &reading_b_8,
                &clock,
                &pool
            );
            let bundle_9 = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a_9,
                &reading_b_9,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_pyth_price_a(&bundle_8) == 1_000_000_000, 0);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle_8) == 2_000_000_000, 1);
            assert!(oracle_gateway::bundle_pyth_price_a(&bundle_9) == 1_000_000_000, 2);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle_9) == 2_000_000_000, 3);
            assert!(oracle_gateway::bundle_adj_price(&bundle_8) == oracle_gateway::bundle_adj_price(&bundle_9), 4);
            assert!(oracle_gateway::bundle_sell_price(&bundle_8) == oracle_gateway::bundle_sell_price(&bundle_9), 5);
            assert!(oracle_gateway::bundle_buy_price(&bundle_8) == oracle_gateway::bundle_buy_price(&bundle_9), 6);
            assert!(oracle_gateway::bundle_price_digest(&bundle_8) != oracle_gateway::bundle_price_digest(&bundle_9), 7);

            price_info::destroy(pio_a_8);
            price_info::destroy(pio_b_8);
            price_info::destroy(pio_a_9);
            price_info::destroy(pio_b_9);
            return_shared(factory);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EOraclePolicyMismatch)]
    fun test_gateway_rejects_oracle_config_changed_after_pool_creation() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let mut oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                &mut scenario
            );

            oracle::configure_token<A>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xCCCC),
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
            );

            let _bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EOraclePolicyMismatch)]
    fun test_direct_add_liquidity_rejects_oracle_config_changed_after_pool_creation() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let mut oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                &mut scenario
            );

            oracle::configure_token<A>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xCCCC),
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
            );

            let input_a = balance::create_for_testing<A>(100_000);
            let input_b = balance::create_for_testing<B>(100_000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0
            );

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EBundlePolicyMismatch)]
    fun test_bundle_validation_rejects_oracle_source_config_update() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                &mut scenario
            );

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            oracle::configure_token<A>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xCCCC),
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
            );
            admin::set_pool_oracle_sources(
                &mut pool,
                &oracle_cap,
                b"pyth",
                b"pyth",
                object::id_from_address(@0xCCCC),
                object::id_from_address(@0xBBBB),
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_accepts_oracle_source_config_update_with_matching_adapter() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);
            let pio_a = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                200_000_000,
                0,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                &mut scenario
            );

            oracle::configure_token<A>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xCCCC),
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
            );
            admin::set_pool_oracle_sources(
                &mut pool,
                &oracle_cap,
                b"pyth",
                b"pyth",
                object::id_from_address(@0xCCCC),
                object::id_from_address(@0xBBBB),
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_policy_version(&bundle) == 1, 0);
            assert!(oracle_gateway::bundle_pyth_price_a(&bundle) == 2_000_000_000, 1);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle) == 1_000_000_000, 2);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EOracleDiscrepancyTooHigh)]
    fun test_gateway_aborts_when_pyth_confidence_ospread_exceeds_dis_threshold() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let mut oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                5_000_000,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                5_000_000,
                &mut scenario
            );

            oracle::configure_token<A>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xAAAA),
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            );
            oracle::configure_token<B>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xBBBB),
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            );

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
            assert!(oracle_gateway::bundle_adj_price(&bundle) == 0, 0);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_gateway_accepts_pyth_confidence_ospread_within_dis_threshold() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                PRECISION as u32,
                0,
                0,
                0,
                2_000_000,
                0
            );

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let mut oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool = take_shared<Pool<A, B>>(&scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                250_000,
                &mut scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                250_000,
                &mut scenario
            );

            oracle::configure_token<A>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xAAAA),
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            );
            oracle::configure_token<B>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xBBBB),
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            );

            let bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            assert!(oracle_gateway::bundle_adj_price(&bundle) == math::q32(), 0);
            assert!(oracle_gateway::bundle_o_spread(&bundle) <= 2_000_000, 1);
            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EBundlePolicyMismatch)]
    fun test_bundle_validation_rejects_policy_version_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            admin::set_pool_oracle_max_price_age(&mut pool, &oracle_cap, 30);
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EBundlePolicyMismatch)]
    fun test_bundle_validation_rejects_spread_policy_digest_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                50_000_000,
                1,
                1,
                0,
                10_000_000,
                0
            );
            return_to_sender<RiskCap>(&scenario, risk_cap);

            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EBundlePolicyMismatch)]
    fun test_bundle_validation_rejects_lambda_policy_digest_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000, 20_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            admin::set_pool_lambda(&mut pool, &risk_cap, math::q32() / 2000);
            return_to_sender<RiskCap>(&scenario, risk_cap);

            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EBundlePolicyMismatch)]
    fun test_bundle_validation_rejects_fee_policy_digest_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000, 20_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);
            admin::set_pool_lambda(&mut pool, &risk_cap, math::q32() / 2000);
            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            admin::set_pool_fee(&mut pool, &risk_cap, 10_000);
            return_to_sender<RiskCap>(&scenario, risk_cap);

            oracle_gateway::assert_bundle_valid_for_pool(&bundle, &pool, &clock);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EOracleQuorumNotMet)]
    fun test_gateway_aborts_when_oracle_quorum_requires_missing_source() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_quorum(
                &mut pool,
                &oracle_cap,
                2,
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_mask_pyth() | 2
            );
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
            assert!(oracle_gateway::bundle_source_count(&bundle) == 2, 0);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = oracle_gateway::EAmmQuorumNotMet)]
    fun test_gateway_aborts_when_amm_policy_requires_missing_twap_source() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                0,
                1,
                pool::amm_fallback_fail_closed()
            );
            return_to_sender<AmmCap>(&scenario, amm_cap);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 0);
        };

        test_scenario::end(scenario);
    }

    fun create_pyth_test_pool(scenario: &mut test_scenario::Scenario) {
        next_tx(scenario, ADDR1);
        {
            let mut oracle = take_shared<OracleAdapter>(scenario);

            oracle::configure_token<A>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xAAAA),
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"
            );
            oracle::configure_token<B>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xBBBB),
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
            );

            return_shared(oracle);
        };

        next_tx(scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(scenario);
            let oracle = take_shared<OracleAdapter>(scenario);
            let clock = take_shared<Clock>(scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(scenario);
            let pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                scenario
            );
            let pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                scenario
            );

            let lp = swap::create_pool_for_testing(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                balance::create_for_testing<A>(1_000_000),
                balance::create_for_testing<B>(1_000_000),
                9,
                9,
                ctx(scenario)
            );

            sui::transfer::public_transfer(sui::coin::from_balance(lp, ctx(scenario)), ADDR1);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_to_sender<PoolCreatorCap>(scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
        };
    }

    fun new_pyth_price_info(
        feed_id: vector<u8>,
        price_magnitude: u64,
        conf: u64,
        scenario: &mut test_scenario::Scenario
    ): PriceInfoObject {
        new_pyth_price_info_with_exponent(feed_id, price_magnitude, conf, 8, true, scenario)
    }

    fun new_pyth_price_info_with_exponent(
        feed_id: vector<u8>,
        price_magnitude: u64,
        conf: u64,
        expo_magnitude: u64,
        expo_negative: bool,
        scenario: &mut test_scenario::Scenario
    ): PriceInfoObject {
        let price_struct = price::new(
            i64::new(price_magnitude, false),
            conf,
            i64::new(expo_magnitude, expo_negative),
            0
        );
        let ema_price = price::new(
            i64::new(price_magnitude, false),
            conf,
            i64::new(expo_magnitude, expo_negative),
            0
        );
        let feed = price_feed::new(
            price_identifier::from_byte_vec(feed_id),
            price_struct,
            ema_price
        );
        let info = price_info::new_price_info(0, 0, feed);
        price_info::new_price_info_object_for_test(info, ctx(scenario))
    }

    fun expected_skew_price(
        base_amount: u64,
        quote_amount: u64,
        adj_price: u64,
        lambda: u64,
        fee: u32,
        s_bound: u32
    ): u64 {
        let q32 = math::q32() as u128;
        let base_value = math::mul_div_down_u128((base_amount as u128), (adj_price as u128), q32);
        let quote_value = quote_amount as u128;
        let total_value = base_value + quote_value;
        let diff = if (base_value >= quote_value) {
            base_value - quote_value
        } else {
            quote_value - base_value
        };
        let mut skew_factor = math::mul_div_down_u128((lambda as u128), diff, total_value);
        let fee_cap = math::mul_div_down_u128(
            q32,
            (fee as u128),
            2 * (PRECISION as u128) + (fee as u128)
        ) + math::mul_div_down_u128(q32, (s_bound as u128), (PRECISION as u128));
        if (skew_factor > fee_cap) {
            skew_factor = fee_cap;
        };

        if (base_value >= quote_value) {
            math::mul_div_down_to_u64((adj_price as u128), q32 - skew_factor, q32 + skew_factor)
        } else {
            math::mul_div_down_to_u64((adj_price as u128), q32 + skew_factor, q32 - skew_factor)
        }
    }

    fun new_test_reading(
        source: u8,
        source_mask: u64,
        source_id: ID,
        feed_id: vector<u8>,
        price_q: u64
    ): oracle_gateway::PriceReading {
        new_test_reading_with_confidence(source, source_mask, source_id, feed_id, price_q, 0)
    }

    fun new_test_reading_with_confidence(
        source: u8,
        source_mask: u64,
        source_id: ID,
        feed_id: vector<u8>,
        price_q: u64,
        confidence_q: u64
    ): oracle_gateway::PriceReading {
        oracle_gateway::new_price_reading(
            source,
            source_mask,
            source_id,
            feed_id,
            price_q,
            price_q + confidence_q,
            price_q - confidence_q,
            confidence_q,
            0,
            15_000,
            true,
            8,
            9
        )
    }

    fun new_test_amm_reading(
        pool_id: ID,
        source_mask: u64,
        relative_price_q32: u64,
        liquidity_quote: u128,
        window_seconds: u64
    ): oracle_gateway::AmmReading {
        new_test_amm_reading_with_source_id(
            pool_id,
            source_mask,
            object::id_from_address(@0xA11CE),
            relative_price_q32,
            liquidity_quote,
            window_seconds
        )
    }

    fun new_test_amm_reading_with_source_id(
        pool_id: ID,
        source_mask: u64,
        source_id: ID,
        relative_price_q32: u64,
        liquidity_quote: u128,
        window_seconds: u64
    ): oracle_gateway::AmmReading {
        oracle_gateway::new_amm_reading(
            pool_id,
            source_mask,
            source_id,
            relative_price_q32,
            liquidity_quote,
            window_seconds,
            0,
            15_000
        )
    }
}
