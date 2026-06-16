#[test_only]
module brownfi_amm::v3_swap_test {
    use std::type_name;
    use sui::balance;
    use sui::coin;
    use sui::clock::Clock;
    use sui::event;
    use sui::object;
    use sui::test_scenario::{Self, next_tx, take_shared, return_shared, take_from_sender, return_to_sender, ctx};
    use pyth::i64;
    use pyth::price;
    use pyth::price_feed;
    use pyth::price_identifier;
    use pyth::price_info::{Self, PriceInfoObject};
    use brownfi_amm::admin;
    use brownfi_amm::events;
    use brownfi_amm::factory::{AdminCap, AmmCap, Factory, FeeCap, PauseCap, PoolCreatorCap, RiskCap};
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B};
    use brownfi_amm::math;
    use brownfi_amm::oracle_gateway;
    use brownfi_amm::pool::{Self, LP, Pool};
    use brownfi_amm::pyth_source;
    use brownfi_amm::swap;
    use brownfi_oracle::oracle::{Self as oracle, OracleAdapter};

    const ADDR1: address = @0xA;
    const ADDR2: address = @0xB;
    const K_TWO: u64 = 8_589_934_592;

    #[test]
    fun test_swap_a_for_b_with_bundle_uses_pyth_reading_bundle() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            let input_a = balance::create_for_testing<A>(1_000);
            let b_out = swap::swap_a_for_b_with_bundle(&bundle, &clock, &mut pool, input_a, 0);

            assert!(balance::value(&b_out) > 0, 0);

            balance::destroy_for_testing(b_out);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_a_for_b_with_bundle_emits_price_bundle_used_event() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );
            let pool_id = pool::id(&pool);

            let input_a = balance::create_for_testing<A>(1_000);
            let b_out = swap::swap_a_for_b_with_bundle(&bundle, &clock, &mut pool, input_a, 0);

            let emitted = event::events_by_type<events::PriceBundleUsed>();
            assert!(emitted.length() == 1, 0);
            events::assert_price_bundle_used_for_testing(
                emitted[0],
                pool_id,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                oracle_gateway::bundle_policy_version(&bundle),
                oracle_gateway::bundle_policy_digest(&bundle),
                oracle_gateway::bundle_price_digest(&bundle),
                oracle_gateway::bundle_pyth_price_a(&bundle),
                oracle_gateway::bundle_pyth_price_b(&bundle),
                oracle_gateway::bundle_oracle_relative_price(&bundle),
                oracle_gateway::bundle_amm_relative_price(&bundle),
                oracle_gateway::bundle_adj_price(&bundle),
                oracle_gateway::bundle_sell_price(&bundle),
                oracle_gateway::bundle_buy_price(&bundle),
                oracle_gateway::bundle_sell_price(&bundle),
                oracle_gateway::bundle_source_count(&bundle),
                oracle_gateway::bundle_amm_source_count(&bundle)
            );

            balance::destroy_for_testing(b_out);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_a_for_b_with_amm_bundle_emits_price_components() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, 1_000_000_000_000, 1_000_000_000_000);

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
                1_000,
                60,
                900,
                1,
                4
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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

            let amm_relative_price = math::q32() * 101 / 100;
            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    amm_relative_price,
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
            let pool_id = pool::id(&pool);

            assert!(oracle_gateway::bundle_amm_source_count(&bundle) == 1, 0);
            assert!(oracle_gateway::bundle_amm_relative_price(&bundle) == amm_relative_price, 1);
            assert!(
                oracle_gateway::bundle_adj_price(&bundle) > oracle_gateway::bundle_oracle_relative_price(&bundle),
                2
            );
            assert!(oracle_gateway::bundle_adj_price(&bundle) < oracle_gateway::bundle_amm_relative_price(&bundle), 3);

            let requested_output = 10_000_000_000;
            let (actual_input, effective_out) = swap::quote_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                requested_output
            );
            assert!(effective_out == requested_output, 4);
            assert!(actual_input > 0, 5);
            let pseudo_input = math::pseudo_in_from_actual_u128(
                (actual_input as u128),
                pool::fee(&pool),
                100_000_000
            ) as u64;
            let fee_amount = math::fee_from_pseudo_input_u128(
                (pseudo_input as u128),
                pool::fee(&pool),
                100_000_000
            ) as u64;
            let input_a = balance::create_for_testing<A>(actual_input + 7);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                requested_output
            );
            let final_output = balance::value(&b_out);
            assert!(balance::value(&remaining_a) == 7, 6);

            let bundle_events = event::events_by_type<events::PriceBundleUsed>();
            assert!(bundle_events.length() == 1, 7);
            events::assert_price_bundle_used_for_testing(
                bundle_events[0],
                pool_id,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                oracle_gateway::bundle_policy_version(&bundle),
                oracle_gateway::bundle_policy_digest(&bundle),
                oracle_gateway::bundle_price_digest(&bundle),
                oracle_gateway::bundle_pyth_price_a(&bundle),
                oracle_gateway::bundle_pyth_price_b(&bundle),
                oracle_gateway::bundle_oracle_relative_price(&bundle),
                oracle_gateway::bundle_amm_relative_price(&bundle),
                oracle_gateway::bundle_adj_price(&bundle),
                oracle_gateway::bundle_sell_price(&bundle),
                oracle_gateway::bundle_buy_price(&bundle),
                oracle_gateway::bundle_sell_price(&bundle),
                oracle_gateway::bundle_source_count(&bundle),
                oracle_gateway::bundle_amm_source_count(&bundle)
            );

            let swap_events = event::events_by_type<events::SwapExecuted>();
            assert!(swap_events.length() == 1, 8);
            events::assert_swap_executed_for_testing(
                swap_events[0],
                pool_id,
                events::swap_direction_sell(),
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                actual_input,
                pseudo_input,
                requested_output,
                effective_out,
                final_output,
                fee_amount,
                0,
                oracle_gateway::bundle_adj_price(&bundle),
                oracle_gateway::bundle_sell_price(&bundle),
                oracle_gateway::bundle_buy_price(&bundle),
                oracle_gateway::bundle_source_count(&bundle),
                oracle_gateway::bundle_amm_source_count(&bundle),
                oracle_gateway::bundle_o_spread(&bundle)
            );

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_a_for_b_with_amm_bundle_matches_berachain_event_price_components() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, 4_839_440_000, 13_225_740_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_k_b(&mut pool, &risk_cap, math::q32() / 200);
            admin::set_pool_k_q(&mut pool, &risk_cap, math::q32() / 200);
            admin::set_pool_lambda(&mut pool, &risk_cap, math::q32() * 2 / 1000);
            admin::set_pool_fee(&mut pool, &risk_cap, 300_000);
            admin::set_pool_gamma(&mut pool, &risk_cap, 80_000_000);
            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                0,
                10_000_000,
                0
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
                10_000_000,
                1_000,
                1,
                900,
                1,
                4
            );

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let reading_quote = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(&pool),
                pool::oracle_config_data_a(&pool),
                999_702_930
            );
            let reading_base = new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(&pool),
                pool::oracle_config_data_b(&pool),
                410_186_930
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_quote);
            vector::push_back(&mut readings_b, reading_base);

            let expected_amm_relative = 1_763_292_002;
            let expected_oracle_relative = 1_762_262_965;
            let expected_adj_price = 1_762_777_483;
            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    expected_amm_relative,
                    1_000_000_000_000,
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
            let pool_id = pool::id(&pool);

            assert!(oracle_gateway::bundle_pyth_price_a(&bundle) == 999_702_930, 0);
            assert!(oracle_gateway::bundle_pyth_price_b(&bundle) == 410_186_930, 1);
            assert_within_bps(oracle_gateway::bundle_oracle_relative_price(&bundle), expected_oracle_relative, 1);
            assert_within_bps(oracle_gateway::bundle_amm_relative_price(&bundle), expected_amm_relative, 1);
            assert_within_bps(oracle_gateway::bundle_adj_price(&bundle), expected_adj_price, 1);

            let requested_output = 1_000_000_000;
            let (actual_input, effective_out) = swap::quote_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                requested_output
            );
            assert!(effective_out == requested_output, 2);
            assert!(actual_input > 0, 3);
            let pseudo_input = math::pseudo_in_from_actual_u128(
                (actual_input as u128),
                pool::fee(&pool),
                100_000_000
            ) as u64;
            let fee_amount = math::fee_from_pseudo_input_u128(
                (pseudo_input as u128),
                pool::fee(&pool),
                100_000_000
            ) as u64;
            let input_a = balance::create_for_testing<A>(actual_input + 1_000);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                requested_output
            );
            let final_output = balance::value(&b_out);
            assert!(balance::value(&remaining_a) == 1_000, 4);

            let bundle_events = event::events_by_type<events::PriceBundleUsed>();
            assert!(bundle_events.length() == 1, 5);
            events::assert_price_bundle_used_for_testing(
                bundle_events[0],
                pool_id,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                oracle_gateway::bundle_policy_version(&bundle),
                oracle_gateway::bundle_policy_digest(&bundle),
                oracle_gateway::bundle_price_digest(&bundle),
                oracle_gateway::bundle_pyth_price_a(&bundle),
                oracle_gateway::bundle_pyth_price_b(&bundle),
                oracle_gateway::bundle_oracle_relative_price(&bundle),
                oracle_gateway::bundle_amm_relative_price(&bundle),
                oracle_gateway::bundle_adj_price(&bundle),
                oracle_gateway::bundle_sell_price(&bundle),
                oracle_gateway::bundle_buy_price(&bundle),
                oracle_gateway::bundle_sell_price(&bundle),
                oracle_gateway::bundle_source_count(&bundle),
                oracle_gateway::bundle_amm_source_count(&bundle)
            );

            let swap_events = event::events_by_type<events::SwapExecuted>();
            assert!(swap_events.length() == 1, 6);
            events::assert_swap_executed_for_testing(
                swap_events[0],
                pool_id,
                events::swap_direction_sell(),
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                actual_input,
                pseudo_input,
                requested_output,
                effective_out,
                final_output,
                fee_amount,
                0,
                oracle_gateway::bundle_adj_price(&bundle),
                oracle_gateway::bundle_sell_price(&bundle),
                oracle_gateway::bundle_buy_price(&bundle),
                oracle_gateway::bundle_source_count(&bundle),
                oracle_gateway::bundle_amm_source_count(&bundle),
                oracle_gateway::bundle_o_spread(&bundle)
            );

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_a_for_b_with_bundle_emits_sync_event() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );
            let pool_id = pool::id(&pool);

            let input_a = balance::create_for_testing<A>(1_000);
            let b_out = swap::swap_a_for_b_with_bundle(&bundle, &clock, &mut pool, input_a, 0);
            let (reserve_a, reserve_b, _) = swap::pool_balances(&pool);

            let emitted = event::events_by_type<events::Sync>();
            assert!(emitted.length() == 1, 0);
            events::assert_sync_for_testing(
                emitted[0],
                pool_id,
                reserve_a,
                reserve_b
            );

            balance::destroy_for_testing(b_out);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_a_for_b_with_bundle_emits_swap_executed_event() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );
            let pool_id = pool::id(&pool);
            let actual_input = 1_000;
            let pseudo_input = math::pseudo_in_from_actual_u128(
                (actual_input as u128),
                pool::fee(&pool),
                100_000_000
            ) as u64;
            let fee_amount = math::fee_from_pseudo_input_u128(
                (pseudo_input as u128),
                pool::fee(&pool),
                100_000_000
            ) as u64;

            let input_a = balance::create_for_testing<A>(actual_input);
            let b_out = swap::swap_a_for_b_with_bundle(&bundle, &clock, &mut pool, input_a, 0);
            let final_output = balance::value(&b_out);

            let emitted = event::events_by_type<events::SwapExecuted>();
            assert!(emitted.length() == 1, 0);
            events::assert_swap_executed_for_testing(
                emitted[0],
                pool_id,
                events::swap_direction_sell(),
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                actual_input,
                pseudo_input,
                final_output,
                final_output,
                final_output,
                fee_amount,
                0,
                oracle_gateway::bundle_adj_price(&bundle),
                oracle_gateway::bundle_sell_price(&bundle),
                oracle_gateway::bundle_buy_price(&bundle),
                oracle_gateway::bundle_source_count(&bundle),
                oracle_gateway::bundle_amm_source_count(&bundle),
                oracle_gateway::bundle_o_spread(&bundle)
            );

            balance::destroy_for_testing(b_out);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_liquidity_with_bundle_emits_pricing_event_fields() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );
            let pool_id = pool::id(&pool);

            let input_a_value = 10_000;
            let input_b_value = 10_000;
            let input_a = balance::create_for_testing<A>(input_a_value);
            let input_b = balance::create_for_testing<B>(input_b_value);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0
            );
            let deposited_a = input_a_value - balance::value(&remaining_a);
            let deposited_b = input_b_value - balance::value(&remaining_b);
            let lp_minted = balance::value(&lp);

            let emitted = event::events_by_type<events::AddLiquidity>();
            assert!(emitted.length() == 1, 0);
            events::assert_add_liquidity_for_testing(
                emitted[0],
                pool_id,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                deposited_a,
                deposited_b,
                lp_minted,
                oracle_gateway::bundle_pyth_price_a(&bundle),
                oracle_gateway::bundle_pyth_price_b(&bundle),
                oracle_gateway::bundle_oracle_relative_price(&bundle),
                oracle_gateway::bundle_amm_relative_price(&bundle),
                oracle_gateway::bundle_source_count(&bundle),
                oracle_gateway::bundle_amm_source_count(&bundle)
            );

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_b_for_a_with_bundle_uses_pyth_reading_bundle() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            let input_b = balance::create_for_testing<B>(1_000);
            let a_out = swap::swap_b_for_a_with_bundle(&bundle, &clock, &mut pool, input_b, 0);

            assert!(balance::value(&a_out) > 0, 0);

            balance::destroy_for_testing(a_out);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_a_for_exact_b_with_bundle_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            let input_a = balance::create_for_testing<A>(2_000);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                1_000
            );

            assert!(balance::value(&b_out) == 1_000, 0);
            assert!(balance::value(&remaining_a) > 0, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_b_for_exact_a_with_bundle_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let reading_a = pyth_source::read_price_a(&pio_a, &clock, &pool);
            let reading_b = pyth_source::read_price_b(&pio_b, &clock, &pool);
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            let input_b = balance::create_for_testing<B>(2_000);
            let (remaining_b, a_out) = swap::swap_b_for_exact_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_b,
                1_000
            );

            assert!(balance::value(&a_out) == 1_000, 0);
            assert!(balance::value(&remaining_b) > 0, 0);

            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(a_out);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_exact_output_pyth_bundle_rounds_required_input_up_for_six_decimal_quote_token() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts_and_decimals(
            &mut scenario,
            10_000_000,
            10_000_000_000,
            6,
            9
        );

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );
            let requested_output = 1_000_000_000;
            let expected_required_input = 1_001_056;
            let (required_input, effective_out) = swap::quote_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                requested_output
            );

            assert!(effective_out == requested_output, 0);
            assert!(required_input == expected_required_input, required_input);

            let input_a = balance::create_for_testing<A>(required_input);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                requested_output
            );
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&remaining_a) == 0, 1);
            assert!(balance::value(&b_out) == requested_output, 2);
            assert!(amount_a == 11_001_056, 3);
            assert!(amount_b == 9_000_000_000, 4);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_exact_output_pyth_bundle_rounds_required_input_up_for_six_decimal_base_token() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts_and_decimals(
            &mut scenario,
            10_000_000_000,
            10_000_000,
            9,
            6
        );

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );
            let requested_output = 1_000_000_000;
            let expected_required_input = 1_001_056;
            let (required_input, effective_out) = swap::quote_b_for_exact_a_with_bundle(
                &bundle,
                &clock,
                &pool,
                requested_output
            );

            assert!(effective_out == requested_output, 0);
            assert!(required_input == expected_required_input, required_input);

            let input_b = balance::create_for_testing<B>(required_input);
            let (remaining_b, a_out) = swap::swap_b_for_exact_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_b,
                requested_output
            );
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&remaining_b) == 0, 1);
            assert!(balance::value(&a_out) == requested_output, 2);
            assert!(amount_a == 9_000_000_000, 3);
            assert!(amount_b == 11_001_056, 4);

            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(a_out);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_exact_input_pyth_bundle_rounds_output_down_for_six_decimal_base_token() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts_and_decimals(
            &mut scenario,
            10_000_000_000,
            10_000_000,
            9,
            6
        );

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );
            let input_amount = 1_000_000_000;
            let expected_output = 998_945;
            let (amount_out, raw_output, cutoff_output) = swap::quote_a_for_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                input_amount
            );

            assert!(amount_out == expected_output, amount_out);
            assert!(raw_output == expected_output, raw_output);
            assert!(cutoff_output == expected_output, cutoff_output);

            let input_a = balance::create_for_testing<A>(input_amount);
            let b_out = swap::swap_a_for_b_with_bundle(&bundle, &clock, &mut pool, input_a, 0);
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&b_out) == expected_output, 1);
            assert!(amount_a == 11_000_000_000, 2);
            assert!(amount_b == 9_001_055, 3);

            balance::destroy_for_testing(b_out);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_exact_input_pyth_bundle_rounds_output_down_for_six_decimal_quote_token() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts_and_decimals(
            &mut scenario,
            10_000_000,
            10_000_000_000,
            6,
            9
        );

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );
            let input_amount = 1_000_000_000;
            let expected_output = 998_945;
            let (amount_out, raw_output, cutoff_output) = swap::quote_b_for_a_with_bundle(
                &bundle,
                &clock,
                &pool,
                input_amount
            );

            assert!(amount_out == expected_output, amount_out);
            assert!(raw_output == expected_output, raw_output);
            assert!(cutoff_output == expected_output, cutoff_output);

            let input_b = balance::create_for_testing<B>(input_amount);
            let a_out = swap::swap_b_for_a_with_bundle(&bundle, &clock, &mut pool, input_b, 0);
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&a_out) == expected_output, 1);
            assert!(amount_a == 9_001_055, 2);
            assert!(amount_b == 11_000_000_000, 3);

            balance::destroy_for_testing(a_out);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_liquidity_pyth_bundle_mints_from_raw_representable_six_decimal_quote_deposit() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts_and_decimals(
            &mut scenario,
            10_000_000,
            10_000_000_000,
            6,
            9
        );

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            let input_a = balance::create_for_testing<A>(2_000_000);
            let input_b = balance::create_for_testing<B>(1_000_000_001);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0
            );
            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);

            assert!(balance::value(&lp) == 2_000_000_000, 0);
            assert!(balance::value(&remaining_a) == 1_000_000, 1);
            assert!(balance::value(&remaining_b) == 1, 2);
            assert!(amount_a == 11_000_000, 3);
            assert!(amount_b == 11_000_000_000, 4);
            assert!(lp_supply == 22_000_000_000, 5);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_liquidity_pyth_bundle_mints_from_raw_representable_six_decimal_base_deposit() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts_and_decimals(
            &mut scenario,
            10_000_000_000,
            10_000_000,
            9,
            6
        );

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            let input_a = balance::create_for_testing<A>(1_000_000_001);
            let input_b = balance::create_for_testing<B>(2_000_000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0
            );
            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);

            assert!(balance::value(&lp) == 2_000_000_000, 0);
            assert!(balance::value(&remaining_a) == 1, 1);
            assert!(balance::value(&remaining_b) == 1_000_000, 2);
            assert!(amount_a == 11_000_000_000, 3);
            assert!(amount_b == 11_000_000, 4);
            assert!(lp_supply == 22_000_000_000, 5);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_liquidity_with_bundle_uses_amm_valuation_floor() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
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
                1_000,
                60,
                900,
                1,
                4
            );

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

            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    math::q32() * 17 / 16,
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

            let input_a = balance::create_for_testing<A>(100_000);
            let input_b = balance::create_for_testing<B>(100_000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0
            );

            assert!(balance::value(&lp) == 193_937, 0);
            assert!(balance::value(&remaining_a) == 1, 1);
            assert!(balance::value(&remaining_b) == 5_883, 2);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);
            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_liquidity_with_bundle_keeps_greater_side_residual_by_value() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, 1_000_000, 500_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

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
            let bundle = oracle_gateway::get_swap_price_bundle_from_readings(
                &reading_a,
                &reading_b,
                &clock,
                &pool
            );

            let input_a = balance::create_for_testing<A>(200_000);
            let input_b = balance::create_for_testing<B>(100_000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0
            );

            assert!(balance::value(&lp) == 200_000, 0);
            assert!(balance::value(&remaining_a) == 100_000, 1);
            assert!(balance::value(&remaining_b) == 0, 2);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 1_100_000, 3);
            assert!(amount_b == 600_000, 4);
            assert!(lp_supply == 1_700_000, 5);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_pair_mint_existing_pool_balanced_contribution_matches_scaled_solidity_case() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, 100_000_000_000, 100_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let bundle = pyth_one_dollar_bundle(&pool, &clock);
            let total_supply_before = pool::lp_supply(&pool);

            let input_a = balance::create_for_testing<A>(10_000_000_000);
            let input_b = balance::create_for_testing<B>(10_000_000_000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0
            );

            let expected_lp = total_supply_before / 10;
            assert!(balance::value(&lp) == expected_lp, 0);
            assert!(balance::value(&remaining_a) == 0, 1);
            assert!(balance::value(&remaining_b) == 0, 2);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 110_000_000_000, 3);
            assert!(amount_b == 110_000_000_000, 4);
            assert!(lp_supply == total_supply_before + expected_lp, 5);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_pair_mint_existing_pool_imbalanced_contribution_matches_scaled_solidity_case() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, 100_000_000_000, 100_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let bundle = pyth_one_dollar_bundle(&pool, &clock);
            let total_supply_before = pool::lp_supply(&pool);

            let input_a = balance::create_for_testing<A>(10_000_000_000);
            let input_b = balance::create_for_testing<B>(5_000_000_000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0
            );

            let expected_lp = total_supply_before / 20;
            assert!(balance::value(&lp) == expected_lp, 0);
            assert!(balance::value(&remaining_a) == 5_000_000_000, 1);
            assert!(balance::value(&remaining_b) == 0, 2);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 105_000_000_000, 3);
            assert!(amount_b == 105_000_000_000, 4);
            assert!(lp_supply == total_supply_before + expected_lp, 5);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_pair_mint_after_full_owner_burn_matches_scaled_solidity_case() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, 100_000_000_000, 100_000_000_000);
        let expected_owner_lp = 199_999_999_000;

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let lp_coin = take_from_sender<coin::Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp_coin) == expected_owner_lp, 0);

            let (a_out, b_out) = swap::remove_liquidity(&mut pool, coin::into_balance(lp_coin), 0, 0);
            assert!(balance::value(&a_out) == 99_999_999_500, 1);
            assert!(balance::value(&b_out) == 99_999_999_500, 2);
            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a_after_burn, amount_b_after_burn, lp_supply_after_burn) = swap::pool_balances(&pool);
            assert!(amount_a_after_burn == 500, 3);
            assert!(amount_b_after_burn == 500, 4);
            assert!(lp_supply_after_burn == 1000, 5);

            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let bundle = pyth_one_dollar_bundle(&pool, &clock);
            let remint_amount = 99_999_999_500;
            let input_a = balance::create_for_testing<A>(remint_amount);
            let input_b = balance::create_for_testing<B>(remint_amount);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0
            );

            assert!(balance::value(&lp) == expected_owner_lp, 6);
            assert!(balance::value(&remaining_a) == 0, 7);
            assert!(balance::value(&remaining_b) == 0, 8);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a_after_remint, amount_b_after_remint, lp_supply_after_remint) = swap::pool_balances(&pool);
            assert!(amount_a_after_remint == 100_000_000_000, 9);
            assert!(amount_b_after_remint == 100_000_000_000, 10);
            assert!(lp_supply_after_remint == 200_000_000_000, 11);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::ESwapsPaused)]
    fun test_swap_aborts_when_pool_swaps_paused() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let pause_cap = take_from_sender<PauseCap>(&scenario);

            admin::set_pool_swaps_paused(&mut pool, &pause_cap, true);

            return_to_sender<PauseCap>(&scenario, pause_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 0);

            balance::destroy_for_testing(b_out);
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
    fun test_factory_pause_does_not_block_swap() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let admin_cap = take_from_sender<AdminCap>(&scenario);

            admin::set_factory_paused(&mut factory, &admin_cap, true);

            return_to_sender<AdminCap>(&scenario, admin_cap);
            return_shared(factory);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 0);

            assert!(balance::value(&b_out) > 0, 0);

            balance::destroy_for_testing(b_out);
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
    fun test_protocol_fee_lp_accrues_in_pool() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let admin_cap = take_from_sender<AdminCap>(&scenario);
            let fee_cap = take_from_sender<FeeCap>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee_to(&mut pool, &fee_cap, ADDR1);
            admin::set_pool_fee_split(&mut pool, &risk_cap, 100_000_000);

            transfer::public_transfer(fee_cap, ADDR2);
            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_to_sender<AdminCap>(&scenario, admin_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let pool_id = pool::id(&pool);
            let initial_supply = pool::lp_supply(&pool);
            let bundle = oracle_gateway::get_swap_price_bundle(&oracle, &pio_a, &pio_b, &clock, &pool);
            let sell_price = oracle_gateway::bundle_sell_price(&bundle);
            let input_a = balance::create_for_testing<A>(100_100);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 99_994);
            let protocol_lp_accrued = pool::protocol_lp_value(&pool);
            let post_trade_value = (pool::balance_a(&pool) as u128) + math::mul_div_down_u128(
                (pool::balance_b(&pool) as u128),
                (sell_price as u128),
                (math::q32() as u128)
            );

            assert!(balance::value(&b_out) == 99_994, 0);
            assert!(protocol_lp_accrued > 0, 0);
            assert!(pool::lp_supply(&pool) > initial_supply, 0);

            let mut accrued_events = event::events_by_type<events::ProtocolLpAccrued>();
            assert!(vector::length(&accrued_events) == 1, 0);
            let accrued_event = vector::pop_back(&mut accrued_events);
            events::assert_protocol_lp_accrued_for_testing(
                accrued_event,
                pool_id,
                ADDR1,
                protocol_lp_accrued,
                post_trade_value
            );

            balance::destroy_for_testing(b_out);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let fee_cap = take_from_sender<FeeCap>(&scenario);
            let pool_id = pool::id(&pool);
            let claimed = admin::claim_protocol_lp(&mut pool, &fee_cap, test_scenario::ctx(&mut scenario));
            let claimed_amount = coin::value(&claimed);

            assert!(claimed_amount > 0, 0);
            assert!(pool::protocol_lp_value(&pool) == 0, 0);

            let mut claimed_events = event::events_by_type<events::ProtocolLpClaimed>();
            assert!(vector::length(&claimed_events) == 1, 0);
            let claimed_event = vector::pop_back(&mut claimed_events);
            events::assert_protocol_lp_claimed_for_testing(
                claimed_event,
                pool_id,
                ADDR1,
                claimed_amount
            );

            transfer::public_transfer(claimed, ADDR2);
            return_to_sender<FeeCap>(&scenario, fee_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_vector_a_sell_exact_output_protocol_lp_parity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_vector_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let fee_cap = take_from_sender<FeeCap>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_fee_to(&mut pool, &fee_cap, ADDR1);
            admin::set_pool_k(&mut pool, &risk_cap, math::q32() / 100);
            admin::set_pool_lambda(&mut pool, &risk_cap, math::q32() / 200);
            admin::set_pool_fee(&mut pool, &risk_cap, 300_000);
            admin::set_pool_fee_split(&mut pool, &risk_cap, 20_000_000);
            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                0,
                2_000_000,
                0
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
                0,
                900,
                0,
                900,
                1,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_to_sender<FeeCap>(&scenario, fee_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let initial_supply = pool::lp_supply(&pool);
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
                2_415_422_184_060
            );
            let mut readings_a = vector[];
            let mut readings_b = vector[];
            vector::push_back(&mut readings_a, reading_a);
            vector::push_back(&mut readings_b, reading_b);

            let mut amm_readings = vector[];
            vector::push_back(
                &mut amm_readings,
                new_test_amm_reading(
                    object::id(&pool),
                    1,
                    math::mul_div_down_to_u64(2_415_418_544_894, (math::q32() as u128), 1_000_000_000),
                    1_000_000_000_000,
                    0
                )
            );
            let bundle = oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
                &readings_a,
                &readings_b,
                &amm_readings,
                &clock,
                &pool
            );
            let base_out = 100_000_000;
            let expected_quote_in = 242_402_000_000;
            let expected_protocol_lp = 144_989_025;
            let core_module_tolerance = 2_000_000;
            let (amount_in, effective_out) = swap::quote_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                base_out
            );

            assert!(amount_in <= expected_quote_in, amount_in);
            assert!(math::abs_diff(amount_in, 242_401_044_297) <= 100, amount_in);
            assert!(effective_out == base_out, effective_out);

            let input_a = balance::create_for_testing<A>(amount_in);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                base_out
            );

            assert!(balance::value(&remaining_a) == 0, 0);
            assert!(balance::value(&b_out) == base_out, 1);
            assert!(
                math::abs_diff(pool::protocol_lp_value(&pool), expected_protocol_lp) <= core_module_tolerance,
                pool::protocol_lp_value(&pool)
            );
            assert!(
                math::abs_diff(pool::lp_supply(&pool), initial_supply + expected_protocol_lp) <= core_module_tolerance,
                pool::lp_supply(&pool)
            );

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_vectors_sell_then_buy_exact_output_protocol_lp_parity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_vector_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let fee_cap = take_from_sender<FeeCap>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_fee_to(&mut pool, &fee_cap, ADDR1);
            admin::set_pool_k(&mut pool, &risk_cap, math::q32() / 100);
            admin::set_pool_lambda(&mut pool, &risk_cap, math::q32() / 200);
            admin::set_pool_fee(&mut pool, &risk_cap, 300_000);
            admin::set_pool_fee_split(&mut pool, &risk_cap, 20_000_000);
            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                0,
                2_000_000,
                0
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
                0,
                900,
                0,
                900,
                1,
                1
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_to_sender<FeeCap>(&scenario, fee_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let tx1_bundle = core_module_vector_bundle(
                &pool,
                &clock,
                2_415_422_184_060,
                2_415_418_544_894
            );
            let (quote_in_tx1, tx1_effective_out) = swap::quote_a_for_exact_b_with_bundle(
                &tx1_bundle,
                &clock,
                &pool,
                100_000_000
            );

            assert!(quote_in_tx1 == 242_401_044_297, quote_in_tx1);
            assert!(tx1_effective_out == 100_000_000, tx1_effective_out);

            let input_a = balance::create_for_testing<A>(quote_in_tx1);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b_with_bundle(
                &tx1_bundle,
                &clock,
                &mut pool,
                input_a,
                100_000_000
            );

            assert!(balance::value(&remaining_a) == 0, 0);
            assert!(balance::value(&b_out) == 100_000_000, 1);
            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);

            let protocol_lp_after_tx1 = pool::protocol_lp_value(&pool);
            let tx2_bundle = core_module_vector_bundle(
                &pool,
                &clock,
                2_417_595_000_000,
                2_417_592_247_058
            );
            let quote_out_tx2 = 250_000_000_000;
            let sheet_base_in_tx2 = 103_669_348;
            let expected_base_in_tx2 = 103_980_355;
            let (base_in_tx2, tx2_effective_out) = swap::quote_b_for_exact_a_with_bundle(
                &tx2_bundle,
                &clock,
                &pool,
                quote_out_tx2
            );

            assert!(base_in_tx2 <= expected_base_in_tx2, base_in_tx2);
            assert!(math::abs_diff(base_in_tx2, sheet_base_in_tx2) <= 100, base_in_tx2);
            assert!(tx2_effective_out == quote_out_tx2, tx2_effective_out);

            let input_b = balance::create_for_testing<B>(expected_base_in_tx2);
            let (remaining_b, a_out) = swap::swap_b_for_exact_a_with_bundle(
                &tx2_bundle,
                &clock,
                &mut pool,
                input_b,
                quote_out_tx2
            );
            let protocol_lp_after_tx2 = pool::protocol_lp_value(&pool);
            let protocol_lp_delta_tx2 = protocol_lp_after_tx2 - protocol_lp_after_tx1;
            let expected_protocol_lp_tx2 = 142_523_029;
            let expected_protocol_lp_cumulative = 287_512_054;
            let expected_supply_after_tx2 = 4_830_287_512_000;
            let core_module_tolerance = 10_000_000;

            assert!(balance::value(&remaining_b) == expected_base_in_tx2 - base_in_tx2, 2);
            assert!(balance::value(&a_out) == quote_out_tx2, 3);
            assert!(
                math::abs_diff(protocol_lp_delta_tx2, expected_protocol_lp_tx2) <= core_module_tolerance,
                protocol_lp_delta_tx2
            );
            assert!(
                math::abs_diff(protocol_lp_after_tx2, expected_protocol_lp_cumulative) <= core_module_tolerance,
                protocol_lp_after_tx2
            );
            assert!(
                math::abs_diff(pool::lp_supply(&pool), expected_supply_after_tx2) <= core_module_tolerance,
                pool::lp_supply(&pool)
            );

            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(a_out);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_periphery_lp_mint_b1_pyth_only_sequence_protocol_lp_parity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_vector_pool(&mut scenario);
        configure_core_module_pyth_only_lp_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let lp_tolerance_bps = 200;

            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_415_422_184_000, 100_000_000, 144_989_025, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_417_595_000_000, 250_000_000_000, 149_887_401, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_411_977_676_000, 1_000_000_000_000, 601_579_959, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_414_000_000_000, 17_000_000, 24_567_609, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_439_085_648_000, 374_000_000_000, 223_242_598, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_436_350_125_000, 800_000_000, 1_161_241_267, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_440_835_000_000, 60_000_000, 87_077_295, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_435_810_000_000, 640_000_000_000, 379_923_097, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_436_265_433_000, 350_000_000, 507_304_186, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_427_430_000_000, 50_000_000_000, 29_664_089, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_429_408_649_000, 260_000_000, 376_741_184, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_430_807_669_000, 1_375_000_000_000, 815_639_575, lp_tolerance_bps);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_periphery_lp_mint_b2_pyth_only_sequence_protocol_lp_parity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_vector_pool(&mut scenario);
        configure_core_module_pyth_only_lp_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let lp_tolerance_bps = 200;

            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_415_422_184_000, 99_566_668, 144_360_394, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_417_595_000_000, 249_096_283_300, 149_627_005, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_411_977_676_000, 999_211_080_300, 601_043_446, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_414_000_000_000, 16_983_378, 24_541_132, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_439_085_648_000, 374_659_043_700, 223_614_342, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_436_350_125_000, 796_808_155, 1_156_477_555, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_440_835_000_000, 60_060_624, 87_156_201, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_435_810_000_000, 638_407_598_000, 380_925_810, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_436_265_433_000, 351_193_958, 508_584_862, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_427_430_000_000, 50_667_754_630, 30_213_176, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_429_408_649_000, 260_639_640, 377_315_126, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_430_807_669_000, 1_368_863_091_000, 814_756_405, lp_tolerance_bps);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_periphery_lp_mint_b3_pyth_only_sequence_protocol_lp_parity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_vector_pool(&mut scenario);
        configure_core_module_pyth_only_lp_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let lp_tolerance_bps = 200;

            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_415_422_184_000, 100_000_000, 144_989_069, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_417_595_000_000, 250_000_000_000, 150_307_933, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_411_977_676_000, 41_328_075, 59_840_465, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_414_000_000_000, 50_000_000, 72_415_330, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_439_085_648_000, 291_391_375_900, 174_249_878, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_436_350_125_000, 30_698_234, 44_669_250, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_440_835_000_000, 400_000_000_000, 238_840_479, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_435_810_000_000, 1_203_238_826_000, 722_807_158, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_436_265_433_000, 200_000_000, 290_152_804, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_427_430_000_000, 375_000_000_000, 224_742_548, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_buy_step(&mut pool, &clock, 2_429_408_649_000, 168_851_676_900, 101_026_498, lp_tolerance_bps);
            assert_core_module_pyth_only_lp_sell_step(&mut pool, &clock, 2_430_807_669_000, 500_000_000, 724_457_421, lp_tolerance_bps);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_periphery_library_forward_tx1_sell_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_sell_raw_fixture(241_348_310_300, 100_000_000, 1_000_000_000, 2_404_928_239_000);
    }

    #[test]
    fun test_periphery_library_forward_tx2_buy_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_buy_raw_fixture(103_550_315, 250_000_000_000, 2_656_348_310_000, 2_422_534_426_000);
    }

    #[test]
    fun test_periphery_library_forward_tx3_buy_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_buy_raw_fixture(416_998_211, 1_000_000_000_000, 2_406_348_310_000, 2_412_127_321_000);
    }

    #[test]
    fun test_periphery_library_forward_tx4_sell_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_sell_raw_fixture(40_994_991_740, 17_000_000, 1_420_548_527, 2_404_111_736_000);
    }

    #[test]
    fun test_periphery_library_forward_tx5_buy_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_buy_raw_fixture(154_847_630, 374_000_000_000, 1_447_343_302_000, 2_425_899_804_000);
    }

    #[test]
    fun test_periphery_library_forward_tx6_sell_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_sell_raw_fixture(1_951_428_543_000, 800_000_000, 1_558_396_157, 2_419_229_993_000);
    }

    #[test]
    fun test_periphery_library_forward_tx7_sell_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_sell_raw_fixture(146_747_453_100, 60_000_000, 758_396_156, 2_437_428_448_000);
    }

    #[test]
    fun test_periphery_library_forward_tx8_buy_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_buy_raw_fixture(263_655_816, 640_000_000_000, 3_171_519_298_000, 2_437_151_395_000);
    }

    #[test]
    fun test_periphery_library_forward_tx9_sell_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_sell_raw_fixture(860_331_575_400, 350_000_000, 962_051_973, 2_443_750_746_000);
    }

    #[test]
    fun test_periphery_library_forward_tx10_buy_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_buy_raw_fixture(20_556_822, 50_000_000_000, 3_391_850_874_000, 2_439_725_430_000);
    }

    #[test]
    fun test_periphery_library_forward_tx11_sell_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_sell_raw_fixture(635_360_947_600, 260_000_000, 632_608_795, 2_427_916_002_000);
    }

    #[test]
    fun test_periphery_library_forward_tx12_buy_raw_fixture_matches_scaled_case() {
        assert_periphery_library_forward_buy_raw_fixture(567_741_528, 1_375_000_000_000, 3_977_211_821_000, 2_434_276_571_000);
    }

    #[test]
    fun test_periphery_library_backward_tx1_sell_required_input_matches_scaled_case() {
        assert_periphery_library_backward_sell_fixture(100_000_000, 241_348_310_300, 1_000_000_000, 2_404_928_239_000);
    }

    #[test]
    fun test_periphery_library_backward_tx2_buy_required_input_matches_scaled_case() {
        assert_periphery_library_backward_buy_fixture(250_000_000_000, 103_550_315, 2_656_348_310_000, 2_422_534_426_000);
    }

    #[test]
    fun test_periphery_library_backward_tx3_buy_required_input_matches_scaled_case() {
        assert_periphery_library_backward_buy_fixture(1_000_000_000_000, 416_998_211, 2_406_348_310_000, 2_412_127_321_000);
    }

    #[test]
    fun test_periphery_library_backward_tx4_sell_required_input_matches_scaled_case() {
        assert_periphery_library_backward_sell_fixture(17_000_000, 40_994_991_740, 1_420_548_527, 2_404_111_736_000);
    }

    #[test]
    fun test_periphery_library_backward_tx5_buy_required_input_matches_scaled_case() {
        assert_periphery_library_backward_buy_fixture(374_000_000_000, 154_847_630, 1_447_343_302_000, 2_425_899_804_000);
    }

    #[test]
    fun test_periphery_library_backward_tx6_sell_required_input_matches_scaled_case() {
        assert_periphery_library_backward_sell_fixture(800_000_000, 1_951_428_543_000, 1_558_396_157, 2_419_229_993_000);
    }

    #[test]
    fun test_periphery_library_backward_tx7_sell_required_input_matches_scaled_case() {
        assert_periphery_library_backward_sell_fixture(60_000_000, 146_747_453_100, 758_396_156, 2_437_428_448_000);
    }

    #[test]
    fun test_periphery_library_backward_tx8_buy_required_input_matches_scaled_case() {
        assert_periphery_library_backward_buy_fixture(640_000_000_000, 263_655_816, 3_171_519_298_000, 2_437_151_395_000);
    }

    #[test]
    fun test_periphery_library_backward_tx9_sell_required_input_matches_scaled_case() {
        assert_periphery_library_backward_sell_fixture(350_000_000, 860_331_575_400, 962_051_973, 2_443_750_746_000);
    }

    #[test]
    fun test_periphery_library_backward_tx10_buy_required_input_matches_scaled_case() {
        assert_periphery_library_backward_buy_fixture(50_000_000_000, 20_556_822, 3_391_850_874_000, 2_439_725_430_000);
    }

    #[test]
    fun test_periphery_library_backward_tx11_sell_required_input_matches_scaled_case() {
        assert_periphery_library_backward_sell_fixture(260_000_000, 635_360_947_600, 632_608_795, 2_427_916_002_000);
    }

    #[test]
    fun test_periphery_library_backward_tx12_buy_required_input_matches_scaled_case() {
        assert_periphery_library_backward_buy_fixture(1_375_000_000_000, 567_741_528, 3_977_211_821_000, 2_434_276_571_000);
    }

    #[test]
    fun test_periphery_library_round_trip_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, 2_415_000_000_000, 1_000_000_000);
        configure_periphery_library_fixture_pool(&mut scenario, math::q32() / 100, math::q32() * 8 / 1000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_periphery_library_round_trip_sell_on_pool(&mut pool, &clock, 100_000_000, 1_000_000_000, 2_404_928_239_000);
            assert_periphery_library_round_trip_buy_on_pool(&mut pool, &clock, 250_000_000_000, 2_656_348_310_000, 2_422_534_426_000);
            assert_periphery_library_round_trip_buy_on_pool(&mut pool, &clock, 1_000_000_000_000, 2_406_348_310_000, 2_412_127_321_000);
            assert_periphery_library_round_trip_sell_on_pool(&mut pool, &clock, 17_000_000, 1_420_548_527, 2_404_111_736_000);
            assert_periphery_library_round_trip_buy_on_pool(&mut pool, &clock, 374_000_000_000, 1_447_343_302_000, 2_425_899_804_000);
            assert_periphery_library_round_trip_sell_on_pool(&mut pool, &clock, 800_000_000, 1_558_396_157, 2_419_229_993_000);
            assert_periphery_library_round_trip_sell_on_pool(&mut pool, &clock, 60_000_000, 758_396_156, 2_437_428_448_000);
            assert_periphery_library_round_trip_buy_on_pool(&mut pool, &clock, 640_000_000_000, 3_171_519_298_000, 2_437_151_395_000);
            assert_periphery_library_round_trip_sell_on_pool(&mut pool, &clock, 350_000_000, 962_051_973, 2_443_750_746_000);
            assert_periphery_library_round_trip_buy_on_pool(&mut pool, &clock, 50_000_000_000, 3_391_850_874_000, 2_439_725_430_000);
            assert_periphery_library_round_trip_sell_on_pool(&mut pool, &clock, 260_000_000, 632_608_795, 2_427_916_002_000);
            assert_periphery_library_round_trip_buy_on_pool(&mut pool, &clock, 1_375_000_000_000, 3_977_211_821_000, 2_434_276_571_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_library_b1_forward_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_library_fixture_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 242_401_044_200, 100_000_000, 1_000_000_000, 2_415_418_262_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 103_669_347, 250_000_000_000, 2_657_401_044_000, 2_420_003_630_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 417_330_401, 1_000_000_000_000, 2_407_401_044_000, 2_411_909_852_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 41_040_127_590, 17_000_000, 1_420_999_749, 2_406_758_731_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 154_527_211, 374_000_000_000, 1_448_441_172_000, 2_431_771_551_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 1_959_343_943_000, 800_000_000, 1_558_526_960, 2_429_045_091_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 147_308_518_200, 60_000_000, 758_526_960, 2_446_747_758_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 263_077_591, 640_000_000_000, 3_181_093_633_000, 2_443_113_327_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 858_045_281_500, 350_000_000, 961_604_551, 2_437_251_500_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 20_599_434, 50_000_000_000, 3_399_138_915_000, 2_434_714_631_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 637_660_811_200, 260_000_000, 632_203_985, 2_436_695_298_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 567_144_345, 1_375_000_000_000, 3_986_799_726_000, 2_438_101_097_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_library_b1_backward_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_library_fixture_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 100_000_000, 242_401_044_200, 1_000_000_000, 2_415_418_262_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 250_000_000_000, 103_669_347, 2_657_401_044_000, 2_420_003_630_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 1_000_000_000_000, 417_330_401, 2_407_401_044_000, 2_411_909_852_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 17_000_000, 41_040_127_590, 1_420_999_749, 2_406_758_731_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 374_000_000_000, 154_527_211, 1_448_441_172_000, 2_431_771_551_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 800_000_000, 1_959_343_943_000, 1_558_526_960, 2_429_045_091_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 60_000_000, 147_308_518_200, 758_526_960, 2_446_747_758_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 640_000_000_000, 263_077_591, 3_181_093_633_000, 2_443_113_327_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 350_000_000, 858_045_281_500, 961_604_551, 2_437_251_500_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 50_000_000_000, 20_599_434, 3_399_138_915_000, 2_434_714_631_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 260_000_000, 637_660_811_200, 632_203_985, 2_436_695_298_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 1_375_000_000_000, 567_144_345, 3_986_799_726_000, 2_438_101_097_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_library_b1_round_trip_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_library_fixture_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 100_000_000, 1_000_000_000, 2_415_418_262_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 250_000_000_000, 2_657_401_044_000, 2_420_003_630_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 1_000_000_000_000, 2_407_401_044_000, 2_411_909_852_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 17_000_000, 1_420_999_749, 2_406_758_731_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 374_000_000_000, 1_448_441_172_000, 2_431_771_551_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 800_000_000, 1_558_526_960, 2_429_045_091_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 60_000_000, 758_526_960, 2_446_747_758_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 640_000_000_000, 3_181_093_633_000, 2_443_113_327_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 350_000_000, 961_604_551, 2_437_251_500_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 50_000_000_000, 3_399_138_915_000, 2_434_714_631_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 260_000_000, 632_203_985, 2_436_695_298_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 1_375_000_000_000, 3_986_799_726_000, 2_438_101_097_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_library_b2_forward_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_library_fixture_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 241_350_000_000, 99_566_668, 1_000_000_000, 2_415_418_262_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 103_500_000, 249_096_283_300, 2_656_350_000_000, 2_415_196_502_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 417_000_000, 999_211_080_300, 2_407_253_717_000, 2_411_905_942_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 41_000_000_000, 16_983_379, 1_420_933_331, 2_406_758_731_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 154_800_000, 374_659_043_700, 1_449_042_636_000, 2_431_771_551_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 1_951_440_000_000, 796_808_155, 1_558_749_952, 2_429_045_091_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 146_750_000_000, 60_060_624, 761_941_796, 2_435_014_547_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 264_000_000, 638_407_598_000, 3_172_573_593_000, 2_428_520_349_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 860_300_000_000, 351_193_958, 965_881_172, 2_435_359_497_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 21_000_000, 50_667_754_630, 3_394_465_995_000, 2_420_171_819_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 635_400_000_000, 260_639_640, 635_687_214, 2_422_140_654_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 568_000_000, 1_368_863_091_000, 3_979_198_240_000, 2_423_538_056_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_library_b2_backward_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_library_fixture_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 99_566_668, 241_350_000_000, 1_000_000_000, 2_415_418_262_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 249_096_283_300, 103_500_000, 2_656_350_000_000, 2_415_196_502_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 999_211_080_300, 417_000_000, 2_407_253_717_000, 2_411_905_942_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 16_983_379, 41_000_000_000, 1_420_933_331, 2_406_758_731_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 374_659_043_700, 154_800_000, 1_449_042_636_000, 2_431_771_551_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 796_808_155, 1_951_440_000_000, 1_558_749_952, 2_429_045_091_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 60_060_624, 146_750_000_000, 761_941_796, 2_435_014_547_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 638_407_598_000, 264_000_000, 3_172_573_593_000, 2_428_520_349_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 351_193_958, 860_300_000_000, 965_881_172, 2_435_359_497_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 50_667_754_630, 21_000_000, 3_394_465_995_000, 2_420_171_819_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 260_639_640, 635_400_000_000, 635_687_214, 2_422_140_654_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 1_368_863_091_000, 568_000_000, 3_979_198_240_000, 2_423_538_056_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_library_b2_round_trip_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_library_fixture_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 99_566_668, 1_000_000_000, 2_415_418_262_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 249_096_283_300, 2_656_350_000_000, 2_415_196_502_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 999_211_080_300, 2_407_253_717_000, 2_411_905_942_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 16_983_379, 1_420_933_331, 2_406_758_731_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 374_659_043_700, 1_449_042_636_000, 2_431_771_551_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 796_808_155, 1_558_749_952, 2_429_045_091_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 60_060_624, 761_941_796, 2_435_014_547_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 638_407_598_000, 3_172_573_593_000, 2_428_520_349_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 351_193_958, 965_881_172, 2_435_359_497_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 50_667_754_630, 3_394_465_995_000, 2_420_171_819_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 260_639_640, 635_687_214, 2_422_140_654_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 1_368_863_091_000, 3_979_198_240_000, 2_423_538_056_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_library_b3_forward_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_library_fixture_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 242_401_190_900, 100_000_000, 1_000_000_000, 2_415_419_725_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 103_876_170, 250_000_000_000, 2_657_401_191_000, 2_415_185_288_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 100_000_000_000, 41_328_075, 1_003_876_170, 2_411_907_548_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 121_049_064_500, 50_000_000, 962_548_094, 2_413_078_988_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 120_000_000, 291_391_375_900, 2_628_450_255_000, 2_437_064_606_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 75_000_000_000, 30_698_234, 1_032_548_094, 2_435_456_588_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 164_544_978, 400_000_000_000, 2_412_058_880_000, 2_440_662_722_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 500_000_000, 1_203_238_826_000, 2_012_058_880_000, 2_431_650_733_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 487_581_276_800, 200_000_000, 1_666_394_838, 2_428_958_125_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 155_729_779, 375_000_000_000, 1_296_401_330_000, 2_420_156_207_000);
            assert_core_module_library_forward_buy_on_pool(&mut pool, &clock, 70_000_000, 168_851_676_900, 921_401_330_000, 2_422_117_554_000);
            assert_core_module_library_forward_sell_on_pool(&mut pool, &clock, 1_217_939_548_000, 500_000_000, 1_692_124_618, 2_423_510_981_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_core_module_library_b3_backward_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_library_fixture_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 100_000_000, 242_401_190_900, 1_000_000_000, 2_415_419_725_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 250_000_000_000, 103_876_170, 2_657_401_191_000, 2_415_185_288_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 41_328_075, 100_000_000_000, 1_003_876_170, 2_411_907_548_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 50_000_000, 121_049_064_500, 962_548_094, 2_413_078_988_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 291_391_375_900, 120_000_000, 2_628_450_255_000, 2_437_064_606_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 30_698_234, 75_000_000_000, 1_032_548_094, 2_435_456_588_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 400_000_000_000, 164_544_978, 2_412_058_880_000, 2_440_662_722_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 1_203_238_826_000, 500_000_000, 2_012_058_880_000, 2_431_650_733_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 200_000_000, 487_581_276_800, 1_666_394_838, 2_428_958_125_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 375_000_000_000, 155_729_779, 1_296_401_330_000, 2_420_156_207_000);
            assert_core_module_library_backward_buy_on_pool(&mut pool, &clock, 168_851_676_900, 70_000_000, 921_401_330_000, 2_422_117_554_000);
            assert_core_module_library_backward_sell_on_pool(&mut pool, &clock, 500_000_000, 1_217_939_548_000, 1_692_124_618, 2_423_510_981_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_forward_sell_uses_v3_quadratic_formula() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000_000_000);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 0);

            assert!(balance::value(&b_out) == 998_945_566, 0);

            balance::destroy_for_testing(b_out);
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
    fun test_forward_buy_uses_v3_quadratic_formula() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_b = balance::create_for_testing<B>(1_000_000_000);
            let a_out = swap::swap_b_for_a(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_b, 0);

            assert!(balance::value(&a_out) == 998_945_566, 0);

            balance::destroy_for_testing(a_out);
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
    fun test_core_module_library_b3_round_trip_fixtures_match_scaled_cases() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_core_module_library_fixture_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);

            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 100_000_000, 1_000_000_000, 2_415_419_725_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 250_000_000_000, 2_657_401_191_000, 2_415_185_288_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 41_328_075, 1_003_876_170, 2_411_907_548_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 50_000_000, 962_548_094, 2_413_078_988_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 291_391_375_900, 2_628_450_255_000, 2_437_064_606_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 30_698_234, 1_032_548_094, 2_435_456_588_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 400_000_000_000, 2_412_058_880_000, 2_440_662_722_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 1_203_238_826_000, 2_012_058_880_000, 2_431_650_733_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 200_000_000, 1_666_394_838, 2_428_958_125_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 375_000_000_000, 1_296_401_330_000, 2_420_156_207_000);
            assert_core_module_library_round_trip_buy_on_pool(&mut pool, &clock, 168_851_676_900, 921_401_330_000, 2_422_117_554_000);
            assert_core_module_library_round_trip_sell_on_pool(&mut pool, &clock, 500_000_000, 1_692_124_618, 2_423_510_981_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_protocol_fee_lp_uses_direction_pre_trade_price() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let fee_cap = take_from_sender<FeeCap>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee_to(&mut pool, &fee_cap, ADDR1);
            admin::set_pool_fee_split(&mut pool, &risk_cap, 100_000_000);
            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                1_000_000,
                1,
                0
            );

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_to_sender<FeeCap>(&scenario, fee_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );

            let amount_in = 1_000_000_000;
            let pool_id = pool::id(&pool);
            let initial_supply = pool::lp_supply(&pool);
            let sell_price = oracle_gateway::bundle_sell_price(&bundle);
            assert!(sell_price > oracle_gateway::bundle_adj_price(&bundle), 0);

            let input_a = balance::create_for_testing<A>(amount_in);
            let b_out = swap::swap_a_for_b_with_bundle(&bundle, &clock, &mut pool, input_a, 0);
            let protocol_lp_accrued = pool::protocol_lp_value(&pool);

            let amount_in_no_fee = math::pseudo_in_from_actual_u128(
                (amount_in as u128),
                pool::fee(&pool),
                100_000_000
            );
            let protocol_fee_value = math::fee_from_pseudo_input_u128(
                amount_in_no_fee,
                pool::fee(&pool),
                100_000_000
            );
            let base_value = math::mul_div_down_u128(
                (pool::balance_b(&pool) as u128),
                (sell_price as u128),
                (math::q32() as u128)
            );
            let post_trade_value = base_value + (pool::balance_a(&pool) as u128);
            let expected_protocol_lp = math::mul_div_down_to_u64(
                (initial_supply as u128),
                protocol_fee_value,
                post_trade_value - protocol_fee_value
            );

            assert!(protocol_lp_accrued == expected_protocol_lp, 1);
            let mut accrued_events = event::events_by_type<events::ProtocolLpAccrued>();
            assert!(vector::length(&accrued_events) == 1, 2);
            let accrued_event = vector::pop_back(&mut accrued_events);
            events::assert_protocol_lp_accrued_for_testing(
                accrued_event,
                pool_id,
                ADDR1,
                protocol_lp_accrued,
                post_trade_value
            );

            balance::destroy_for_testing(b_out);
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
    fun test_quote_a_for_b_with_bundle_returns_raw_and_cutoff_outputs() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let (amount_out, raw_output, cutoff_output) = swap::quote_a_for_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                1_000_000_000
            );

            assert!(amount_out == 998_945_566, 0);
            assert!(raw_output == amount_out, 1);
            assert!(cutoff_output == amount_out, 2);

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
    fun test_quote_b_for_a_with_bundle_returns_raw_and_cutoff_outputs() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let (amount_out, raw_output, cutoff_output) = swap::quote_b_for_a_with_bundle(
                &bundle,
                &clock,
                &pool,
                1_000_000_000
            );

            assert!(amount_out == 998_945_566, 0);
            assert!(raw_output == amount_out, 1);
            assert!(cutoff_output == amount_out, 2);

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
    fun test_quote_a_for_b_with_bundle_surfaces_gamma_cutoff() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 50_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let (amount_out, raw_output, cutoff_output) = swap::quote_a_for_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                10_000_000_000
            );

            assert!(amount_out == 3_334_443_334, 0);
            assert!(cutoff_output == amount_out, 1);
            assert!(raw_output > cutoff_output, 2);

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
    fun test_forward_sell_allows_large_input_with_gamma_cutoff() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(9_000_000_000);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 0);
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&b_out) > 0, 0);
            assert!(amount_a == 19_000_000_000, 0);
            assert!(amount_b + balance::value(&b_out) == 10_000_000_000, 0);

            balance::destroy_for_testing(b_out);
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
    fun test_forward_buy_allows_large_input_with_gamma_cutoff() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_b = balance::create_for_testing<B>(9_000_000_000);
            let a_out = swap::swap_b_for_a(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_b, 0);
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&a_out) > 0, 0);
            assert!(amount_a + balance::value(&a_out) == 10_000_000_000, 0);
            assert!(amount_b == 19_000_000_000, 0);

            balance::destroy_for_testing(a_out);
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
    fun test_forward_sell_k_two_uses_constant_product_formula() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_k(&mut pool, &risk_cap, K_TWO);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000_000_000);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 0);

            assert!(balance::value(&b_out) == 908_265_213, 0);

            balance::destroy_for_testing(b_out);
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
    fun test_gamma_cutoff_clamps_worsening_sell() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 50_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(10_000_000_000);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 0);
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&b_out) == 3_334_443_334, 0);
            assert!(amount_a == 60_000_000_000, 0);
            assert!(amount_b == 6_665_556_666, 0);

            balance::destroy_for_testing(b_out);
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
    fun test_gamma_one_disables_cutoff_for_large_sell() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 50_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_gamma(&mut pool, &risk_cap, 100_000_000);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let bundle = oracle_gateway::get_swap_price_bundle(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let input_amount = 10_000_000_000;
            let (quoted_out, raw_out, cutoff_out) = swap::quote_a_for_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                input_amount
            );

            assert!(quoted_out == raw_out, 0);
            assert!(cutoff_out == raw_out, 1);
            assert!(quoted_out > 3_334_443_334, 2);

            let input_a = balance::create_for_testing<A>(input_amount);
            let b_out = swap::swap_a_for_b_with_bundle(&bundle, &clock, &mut pool, input_a, 0);
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&b_out) == quoted_out, 3);
            assert!(amount_a == 60_000_000_000, 4);
            assert!(amount_b + quoted_out == 10_000_000_000, 5);

            balance::destroy_for_testing(b_out);
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
    fun test_gamma_cutoff_clamps_worsening_buy() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 50_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_b = balance::create_for_testing<B>(10_000_000_000);
            let a_out = swap::swap_b_for_a(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_b, 0);
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&a_out) == 3_334_443_334, 0);
            assert!(amount_a == 6_665_556_666, 0);
            assert!(amount_b == 60_000_000_000, 0);

            balance::destroy_for_testing(a_out);
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
    fun test_quote_a_for_exact_b_uses_backward_formula() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let (amount_in, effective_out) = swap::quote_a_for_exact_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                998_945_566
            );

            assert!(amount_in == 1_000_000_000, 0);
            assert!(effective_out == 998_945_566, 0);
            assert!(pool::balance_a(&pool) == 10_000_000_000, 0);
            assert!(pool::balance_b(&pool) == 10_000_000_000, 0);

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
    fun test_quote_b_for_exact_a_uses_backward_formula() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let (amount_in, effective_out) = swap::quote_b_for_exact_a(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                998_945_566
            );

            assert!(amount_in == 1_000_000_000, 0);
            assert!(effective_out == 998_945_566, 0);

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
    fun test_quote_a_for_exact_b_k_two_uses_constant_product_formula() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_k(&mut pool, &risk_cap, K_TWO);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let (amount_in, effective_out) = swap::quote_a_for_exact_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                908_265_213
            );

            assert!(amount_in == 1_000_000_000, 0);
            assert!(effective_out == 908_265_213, 0);

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
    fun test_quote_a_for_exact_b_returns_gamma_clipped_effective_output() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 50_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let (amount_in, effective_out) = swap::quote_a_for_exact_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                9_000_000_000
            );

            assert!(amount_in == 3_444_287_206, 0);
            assert!(effective_out == 3_439_944_444, 0);

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
    fun test_quote_a_for_exact_b_returns_zero_when_gamma_cutoff_clamps_to_zero() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 50_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_gamma(&mut pool, &risk_cap, 10_000_000);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let (amount_in, effective_out) = swap::quote_a_for_exact_b(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                9_000_000_000
            );

            assert!(amount_in == 0, 0);
            assert!(effective_out == 0, 1);

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
    fun test_quote_a_for_exact_b_keeps_requested_output_when_gamma_cutoff_does_not_bind() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 50_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_gamma(&mut pool, &risk_cap, 95_000_000);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let requested_out = 1_000_000_000;
            let (amount_in, effective_out) = swap::quote_a_for_exact_b(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                requested_out
            );

            assert!(amount_in > 0, 0);
            assert!(effective_out == requested_out, 1);

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
    fun test_swap_a_for_exact_b_uses_backward_quote_and_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000_000_010);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                998_945_566
            );
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&remaining_a) == 10, 0);
            assert!(balance::value(&b_out) == 998_945_566, 0);
            assert!(amount_a == 11_000_000_000, 0);
            assert!(amount_b == 9_001_054_434, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
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
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_swap_a_for_exact_b_rejects_underpaid_max_input_before_pool_mutation() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100_000_000_000, 100_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee(&mut pool, &risk_cap, 10_000_000);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let amount_out = 10_000_000_000;
            let (required_input, effective_out) = swap::quote_a_for_exact_b(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                amount_out
            );
            assert!(effective_out == amount_out, 0);
            assert!(required_input > 0, 1);

            let input_a = balance::create_for_testing<A>(required_input - 1);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                amount_out
            );

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
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
    fun test_swap_a_for_exact_b_accepts_quoted_max_input_at_high_fee() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100_000_000_000, 100_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee(&mut pool, &risk_cap, 10_000_000);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let amount_out = 10_000_000_000;
            let (required_input, effective_out) = swap::quote_a_for_exact_b(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                amount_out
            );
            assert!(effective_out == amount_out, 0);

            let input_a = balance::create_for_testing<A>(required_input);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                amount_out
            );
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&remaining_a) == 0, 1);
            assert!(balance::value(&b_out) == amount_out, 2);
            assert!(amount_a == 100_000_000_000 + required_input, 3);
            assert!(amount_b == 90_000_000_000, 4);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
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
    fun test_swap_a_for_exact_b_allows_large_required_input_with_gamma_cutoff() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let amount_out = 7_980_000_000;
            let (amount_in, effective_out) = swap::quote_a_for_exact_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                amount_out
            );

            assert!(amount_in > 8_000_000_000, 0);
            assert!(effective_out == amount_out, 0);

            let input_a = balance::create_for_testing<A>(amount_in + 10);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                amount_out
            );
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&remaining_a) == 10, 0);
            assert!(balance::value(&b_out) == amount_out, 0);
            assert!(amount_a == 10_000_000_000 + amount_in, 0);
            assert!(amount_b == 2_020_000_000, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
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
    fun test_swap_b_for_exact_a_uses_backward_quote_and_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_b = balance::create_for_testing<B>(1_000_000_010);
            let (remaining_b, a_out) = swap::swap_b_for_exact_a(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_b,
                998_945_566
            );
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&remaining_b) == 10, 0);
            assert!(balance::value(&a_out) == 998_945_566, 0);
            assert!(amount_a == 9_001_054_434, 0);
            assert!(amount_b == 11_000_000_000, 0);

            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(a_out);
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
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_swap_b_for_exact_a_rejects_underpaid_max_input_before_pool_mutation() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100_000_000_000, 100_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee(&mut pool, &risk_cap, 10_000_000);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let amount_out = 10_000_000_000;
            let (required_input, effective_out) = swap::quote_b_for_exact_a(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                amount_out
            );
            assert!(effective_out == amount_out, 0);
            assert!(required_input > 0, 1);

            let input_b = balance::create_for_testing<B>(required_input - 1);
            let (remaining_b, a_out) = swap::swap_b_for_exact_a(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_b,
                amount_out
            );

            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(a_out);
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
    fun test_swap_b_for_exact_a_allows_large_required_input_with_gamma_cutoff() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let amount_out = 7_980_000_000;
            let (amount_in, effective_out) = swap::quote_b_for_exact_a(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool,
                amount_out
            );

            assert!(amount_in > 8_000_000_000, 0);
            assert!(effective_out == amount_out, 0);

            let input_b = balance::create_for_testing<B>(amount_in + 10);
            let (remaining_b, a_out) = swap::swap_b_for_exact_a(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_b,
                amount_out
            );
            let (amount_a, amount_b, _) = swap::pool_balances(&pool);

            assert!(balance::value(&remaining_b) == 10, 0);
            assert!(balance::value(&a_out) == amount_out, 0);
            assert!(amount_a == 2_020_000_000, 0);
            assert!(amount_b == 10_000_000_000 + amount_in, 0);

            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(a_out);
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
    #[expected_failure(abort_code = swap::ECutoffLimitReached)]
    fun test_swap_a_for_exact_b_rejects_gamma_clipped_output() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 50_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(10_000_000_000);
            let (remaining_a, b_out) = swap::swap_a_for_exact_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                9_000_000_000
            );

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(b_out);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    fun create_pyth_test_pool(scenario: &mut test_scenario::Scenario) {
        create_pyth_test_pool_with_amounts(scenario, 1_000_000, 1_000_000);
    }

    fun assert_periphery_library_forward_sell_raw_fixture(
        amount_in: u64,
        expected_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, 2_415_000_000_000, reserve_out);
        configure_periphery_library_fixture_pool(&mut scenario, math::q32() / 100, math::q32() * 8 / 1000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let bundle = periphery_library_fixture_bundle(&pool, &clock, base_price_q);
            let (_, raw_output, _) = swap::quote_a_for_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                amount_in
            );

            assert_within_bps(raw_output, expected_out, 50);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    fun assert_periphery_library_forward_buy_raw_fixture(
        amount_in: u64,
        expected_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, reserve_out, 1_000_000_000);
        configure_periphery_library_fixture_pool(&mut scenario, math::q32() / 100, math::q32() * 8 / 1000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let bundle = periphery_library_fixture_bundle(&pool, &clock, base_price_q);
            let (_, raw_output, _) = swap::quote_b_for_a_with_bundle(
                &bundle,
                &clock,
                &pool,
                amount_in
            );

            assert_within_bps(raw_output, expected_out, 50);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    fun assert_periphery_library_backward_sell_fixture(
        desired_out: u64,
        expected_in: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, 2_415_000_000_000, reserve_out);
        configure_periphery_library_fixture_pool(&mut scenario, math::q32() / 100, math::q32() * 8 / 1000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let bundle = periphery_library_fixture_bundle(&pool, &clock, base_price_q);
            let (amount_in, effective_out) = swap::quote_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &pool,
                desired_out
            );

            assert_within_bps(amount_in, expected_in, 50);
            assert!(effective_out == desired_out, effective_out);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    fun assert_periphery_library_backward_buy_fixture(
        desired_out: u64,
        expected_in: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool_with_amounts(&mut scenario, reserve_out, 1_000_000_000);
        configure_periphery_library_fixture_pool(&mut scenario, math::q32() / 100, math::q32() * 8 / 1000);

        next_tx(&mut scenario, ADDR2);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let bundle = periphery_library_fixture_bundle(&pool, &clock, base_price_q);
            let (amount_in, effective_out) = swap::quote_b_for_exact_a_with_bundle(
                &bundle,
                &clock,
                &pool,
                desired_out
            );

            assert_within_bps(amount_in, expected_in, 50);
            assert!(effective_out == desired_out, effective_out);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    fun create_core_module_library_fixture_pool(scenario: &mut test_scenario::Scenario) {
        create_pyth_test_pool_with_amounts(scenario, 2_415_000_000_000, 1_000_000_000);
        configure_periphery_library_fixture_pool(scenario, math::q32() / 100, math::q32() / 100);
    }

    fun set_library_fixture_pool_balances<A, B>(
        pool: &mut Pool<A, B>,
        target_a: u64,
        target_b: u64
    ) {
        let current_a = pool::balance_a(pool);
        if (current_a > target_a) {
            balance::destroy_for_testing(pool::withdraw_a(pool, current_a - target_a));
        } else if (current_a < target_a) {
            pool::deposit_a(pool, balance::create_for_testing<A>(target_a - current_a));
        };

        let current_b = pool::balance_b(pool);
        if (current_b > target_b) {
            balance::destroy_for_testing(pool::withdraw_b(pool, current_b - target_b));
        } else if (current_b < target_b) {
            pool::deposit_b(pool, balance::create_for_testing<B>(target_b - current_b));
        };
    }

    fun assert_core_module_library_forward_sell_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        amount_in: u64,
        expected_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        set_library_fixture_pool_balances(pool, 2_415_000_000_000, reserve_out);

        let bundle = periphery_library_fixture_bundle(pool, clock, base_price_q);
        let (_, raw_output, _) = swap::quote_a_for_b_with_bundle(
            &bundle,
            clock,
            pool,
            amount_in
        );

        assert_within_bps(raw_output, expected_out, 100);
    }

    fun assert_core_module_library_forward_buy_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        amount_in: u64,
        expected_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        set_library_fixture_pool_balances(pool, reserve_out, 1_000_000_000);

        let bundle = periphery_library_fixture_bundle(pool, clock, base_price_q);
        let (_, raw_output, _) = swap::quote_b_for_a_with_bundle(
            &bundle,
            clock,
            pool,
            amount_in
        );

        assert_within_bps(raw_output, expected_out, 100);
    }

    fun assert_core_module_library_backward_sell_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        desired_out: u64,
        expected_in: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        set_library_fixture_pool_balances(pool, 2_415_000_000_000, reserve_out);

        let bundle = periphery_library_fixture_bundle(pool, clock, base_price_q);
        let (amount_in, effective_out) = swap::quote_a_for_exact_b_with_bundle(
            &bundle,
            clock,
            pool,
            desired_out
        );

        assert_within_bps(amount_in, expected_in, 100);
        assert!(effective_out == desired_out, effective_out);
    }

    fun assert_core_module_library_backward_buy_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        desired_out: u64,
        expected_in: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        set_library_fixture_pool_balances(pool, reserve_out, 1_000_000_000);

        let bundle = periphery_library_fixture_bundle(pool, clock, base_price_q);
        let (amount_in, effective_out) = swap::quote_b_for_exact_a_with_bundle(
            &bundle,
            clock,
            pool,
            desired_out
        );

        assert_within_bps(amount_in, expected_in, 100);
        assert!(effective_out == desired_out, effective_out);
    }

    fun assert_periphery_library_round_trip_sell_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        desired_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        assert_library_round_trip_sell_on_pool(pool, clock, desired_out, reserve_out, base_price_q);
    }

    fun assert_periphery_library_round_trip_buy_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        desired_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        assert_library_round_trip_buy_on_pool(pool, clock, desired_out, reserve_out, base_price_q);
    }

    fun assert_core_module_library_round_trip_sell_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        desired_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        assert_library_round_trip_sell_on_pool(pool, clock, desired_out, reserve_out, base_price_q);
    }

    fun assert_core_module_library_round_trip_buy_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        desired_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        assert_library_round_trip_buy_on_pool(pool, clock, desired_out, reserve_out, base_price_q);
    }

    fun assert_library_round_trip_sell_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        desired_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        set_library_fixture_pool_balances(pool, 2_415_000_000_000, reserve_out);

        let bundle = periphery_library_fixture_bundle(pool, clock, base_price_q);
        let (amount_in, effective_out) = swap::quote_a_for_exact_b_with_bundle(
            &bundle,
            clock,
            pool,
            desired_out
        );
        let (_, raw_output, _) = swap::quote_a_for_b_with_bundle(
            &bundle,
            clock,
            pool,
            amount_in
        );

        assert!(effective_out == desired_out, effective_out);
        assert_within_bps(raw_output, desired_out, 10);
    }

    fun assert_library_round_trip_buy_on_pool<A, B>(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        desired_out: u64,
        reserve_out: u64,
        base_price_q: u64
    ) {
        set_library_fixture_pool_balances(pool, reserve_out, 1_000_000_000);

        let bundle = periphery_library_fixture_bundle(pool, clock, base_price_q);
        let (amount_in, effective_out) = swap::quote_b_for_exact_a_with_bundle(
            &bundle,
            clock,
            pool,
            desired_out
        );
        let (_, raw_output, _) = swap::quote_b_for_a_with_bundle(
            &bundle,
            clock,
            pool,
            amount_in
        );

        assert!(effective_out == desired_out, effective_out);
        assert_within_bps(raw_output, desired_out, 10);
    }

    fun assert_core_module_pyth_only_lp_sell_step(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        base_price_q: u64,
        base_out: u64,
        expected_protocol_lp_delta: u64,
        tolerance_bps: u64
    ) {
        let protocol_lp_before = pool::protocol_lp_value(pool);
        let bundle = periphery_library_fixture_bundle(pool, clock, base_price_q);
        let (quote_in, effective_out) = swap::quote_a_for_exact_b_with_bundle(
            &bundle,
            clock,
            pool,
            base_out
        );

        assert!(effective_out == base_out, effective_out);

        let input_a = balance::create_for_testing<A>(quote_in);
        let (remaining_a, b_out) = swap::swap_a_for_exact_b_with_bundle(
            &bundle,
            clock,
            pool,
            input_a,
            base_out
        );
        let protocol_lp_delta = pool::protocol_lp_value(pool) - protocol_lp_before;

        assert!(balance::value(&remaining_a) == 0, 0);
        assert!(balance::value(&b_out) == base_out, 1);
        assert_within_bps(protocol_lp_delta, expected_protocol_lp_delta, tolerance_bps);

        balance::destroy_for_testing(remaining_a);
        balance::destroy_for_testing(b_out);
    }

    fun assert_core_module_pyth_only_lp_buy_step(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        base_price_q: u64,
        quote_out: u64,
        expected_protocol_lp_delta: u64,
        tolerance_bps: u64
    ) {
        let protocol_lp_before = pool::protocol_lp_value(pool);
        let bundle = periphery_library_fixture_bundle(pool, clock, base_price_q);
        let (base_in, effective_out) = swap::quote_b_for_exact_a_with_bundle(
            &bundle,
            clock,
            pool,
            quote_out
        );

        assert!(effective_out == quote_out, effective_out);

        let input_b = balance::create_for_testing<B>(base_in);
        let (remaining_b, a_out) = swap::swap_b_for_exact_a_with_bundle(
            &bundle,
            clock,
            pool,
            input_b,
            quote_out
        );
        let protocol_lp_delta = pool::protocol_lp_value(pool) - protocol_lp_before;

        assert!(balance::value(&remaining_b) == 0, 0);
        assert!(balance::value(&a_out) == quote_out, 1);
        assert_within_bps(protocol_lp_delta, expected_protocol_lp_delta, tolerance_bps);

        balance::destroy_for_testing(remaining_b);
        balance::destroy_for_testing(a_out);
    }

    fun configure_periphery_library_fixture_pool(
        scenario: &mut test_scenario::Scenario,
        k_b: u64,
        k_q: u64
    ) {
        next_tx(scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(scenario);
            let risk_cap = take_from_sender<RiskCap>(scenario);

            admin::set_pool_fee(&mut pool, &risk_cap, 300_000);
            admin::set_pool_k_b(&mut pool, &risk_cap, k_b);
            admin::set_pool_k_q(&mut pool, &risk_cap, k_q);
            admin::set_pool_gamma(&mut pool, &risk_cap, 100_000_000);
            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                0,
                2_000_000,
                0
            );

            return_to_sender<RiskCap>(scenario, risk_cap);
            return_shared(pool);
        };
    }

    fun periphery_library_fixture_bundle<A, B>(
        pool: &Pool<A, B>,
        clock: &Clock,
        base_price_q: u64
    ): oracle_gateway::PriceBundle {
        let reading_a = new_test_reading(
            pool::oracle_source_pyth(),
            pool::oracle_source_mask_pyth(),
            pool::oracle_source_id_a(pool),
            pool::oracle_config_data_a(pool),
            1_000_000_000
        );
        let reading_b = new_test_reading(
            pool::oracle_source_pyth(),
            pool::oracle_source_mask_pyth(),
            pool::oracle_source_id_b(pool),
            pool::oracle_config_data_b(pool),
            base_price_q
        );
        oracle_gateway::get_swap_price_bundle_from_readings(
            &reading_a,
            &reading_b,
            clock,
            pool
        )
    }

    fun pyth_one_dollar_bundle<A, B>(
        pool: &Pool<A, B>,
        clock: &Clock
    ): oracle_gateway::PriceBundle {
        let reading_a = new_test_reading(
            pool::oracle_source_pyth(),
            pool::oracle_source_mask_pyth(),
            pool::oracle_source_id_a(pool),
            pool::oracle_config_data_a(pool),
            1_000_000_000
        );
        let reading_b = new_test_reading(
            pool::oracle_source_pyth(),
            pool::oracle_source_mask_pyth(),
            pool::oracle_source_id_b(pool),
            pool::oracle_config_data_b(pool),
            1_000_000_000
        );
        oracle_gateway::get_swap_price_bundle_from_readings(
            &reading_a,
            &reading_b,
            clock,
            pool
        )
    }

    fun assert_within_bps(actual: u64, expected: u64, bps: u64) {
        let lower = math::mul_div_down_to_u64((expected as u128), ((10_000 - bps) as u128), 10_000);
        let upper = math::mul_div_up_to_u64((expected as u128), ((10_000 + bps) as u128), 10_000);
        assert!(actual >= lower, actual);
        assert!(actual <= upper, actual);
    }

    fun core_module_vector_bundle<A, B>(
        pool: &Pool<A, B>,
        clock: &Clock,
        pyth_base_price_q: u64,
        amm_base_price_9: u128
    ): oracle_gateway::PriceBundle {
        let reading_a = new_test_reading(
            pool::oracle_source_pyth(),
            pool::oracle_source_mask_pyth(),
            pool::oracle_source_id_a(pool),
            pool::oracle_config_data_a(pool),
            1_000_000_000
        );
        let reading_b = new_test_reading(
            pool::oracle_source_pyth(),
            pool::oracle_source_mask_pyth(),
            pool::oracle_source_id_b(pool),
            pool::oracle_config_data_b(pool),
            pyth_base_price_q
        );
        let mut readings_a = vector[];
        let mut readings_b = vector[];
        vector::push_back(&mut readings_a, reading_a);
        vector::push_back(&mut readings_b, reading_b);

        let mut amm_readings = vector[];
        vector::push_back(
            &mut amm_readings,
            new_test_amm_reading(
                object::id(pool),
                1,
                math::mul_div_down_to_u64(amm_base_price_9, (math::q32() as u128), 1_000_000_000),
                1_000_000_000_000,
                0
            )
        );
        oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
            &readings_a,
            &readings_b,
            &amm_readings,
            clock,
            pool
        )
    }

    fun configure_core_module_pyth_only_lp_pool(scenario: &mut test_scenario::Scenario) {
        next_tx(scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(scenario);
            let fee_cap = take_from_sender<FeeCap>(scenario);
            let risk_cap = take_from_sender<RiskCap>(scenario);

            admin::set_pool_fee_to(&mut pool, &fee_cap, ADDR1);
            admin::set_pool_k(&mut pool, &risk_cap, math::q32() / 100);
            admin::set_pool_lambda(&mut pool, &risk_cap, math::q32() / 200);
            admin::set_pool_fee(&mut pool, &risk_cap, 300_000);
            admin::set_pool_fee_split(&mut pool, &risk_cap, 20_000_000);
            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                0,
                2_000_000,
                0
            );

            return_to_sender<RiskCap>(scenario, risk_cap);
            return_to_sender<FeeCap>(scenario, fee_cap);
            return_shared(pool);
        };
    }

    fun create_core_module_vector_pool(scenario: &mut test_scenario::Scenario) {
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
                241_500_000_000,
                0,
                scenario
            );

            let lp = swap::create_pool(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                balance::create_for_testing<A>(2_415_000_000_000),
                balance::create_for_testing<B>(1_000_000_000),
                9,
                9,
                ctx(scenario)
            );

            transfer::public_transfer(coin::from_balance(lp, ctx(scenario)), ADDR1);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_to_sender<PoolCreatorCap>(scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
        };
    }

    fun create_pyth_test_pool_with_amounts(
        scenario: &mut test_scenario::Scenario,
        init_a: u64,
        init_b: u64
    ) {
        create_pyth_test_pool_with_amounts_and_decimals(scenario, init_a, init_b, 9, 9);
    }

    fun create_pyth_test_pool_with_amounts_and_decimals(
        scenario: &mut test_scenario::Scenario,
        init_a: u64,
        init_b: u64,
        token_a_decimals: u8,
        token_b_decimals: u8
    ) {
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
                balance::create_for_testing<A>(init_a),
                balance::create_for_testing<B>(init_b),
                token_a_decimals,
                token_b_decimals,
                ctx(scenario)
            );

            transfer::public_transfer(coin::from_balance(lp, ctx(scenario)), ADDR1);
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
        let price_struct = price::new(
            i64::new(price_magnitude, false),
            conf,
            i64::new(8, true),
            0
        );
        let ema_price = price::new(
            i64::new(price_magnitude, false),
            conf,
            i64::new(8, true),
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
        oracle_gateway::new_amm_reading(
            pool_id,
            source_mask,
            object::id_from_address(@0xA11CE),
            relative_price_q32,
            liquidity_quote,
            window_seconds,
            0,
            15_000
        )
    }
}
