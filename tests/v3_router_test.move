#[test_only]
module brownfi_amm::v3_router_test {
    use std::type_name;
    use sui::balance;
    use sui::coin::{Self, Coin};
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
    use brownfi_amm::factory::{AmmCap, Factory, PoolCreatorCap, RiskCap, RouterCap};
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B, C};
    use brownfi_amm::math;
    use brownfi_amm::oracle_gateway;
    use brownfi_amm::pool::{Self, LP, Pool};
    use brownfi_amm::pyth_source;
    use brownfi_amm::router;
    use brownfi_amm::swap;
    use brownfi_oracle::oracle::{Self as oracle, OracleAdapter};

    const ADDR1: address = @0xA;
    const ADDR2: address = @0xB;

    #[test]
    fun test_router_swap_exact_a_for_b_with_bundle_uses_prebuilt_bundle() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let input_a = coin::from_balance(balance::create_for_testing<A>(1_000), ctx(&mut scenario));

            let b_out = router::swap_exact_a_for_b_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&b_out) > 0, 0);

            balance::destroy_for_testing(coin::into_balance(b_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_exact_b_for_a_with_bundle_uses_prebuilt_bundle() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let input_b = coin::from_balance(balance::create_for_testing<B>(1_000), ctx(&mut scenario));

            let a_out = router::swap_exact_b_for_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_b,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&a_out) > 0, 0);

            balance::destroy_for_testing(coin::into_balance(a_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_exact_a_for_b_with_bundle_transfer_sends_output_to_recipient() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(1_000), ctx(&mut scenario));

            router::swap_exact_a_for_b_with_bundle_and_transfer(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                0,
                ADDR2,
                ctx(&mut scenario)
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let b_out = take_from_sender<Coin<B>>(&scenario);
            assert!(coin::value(&b_out) > 0, 0);
            balance::destroy_for_testing(coin::into_balance(b_out));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_exact_b_for_a_with_bundle_transfer_sends_output_to_recipient() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_b = coin::from_balance(balance::create_for_testing<B>(1_000), ctx(&mut scenario));

            router::swap_exact_b_for_a_with_bundle_and_transfer(
                &bundle,
                &clock,
                &mut pool,
                input_b,
                0,
                ADDR2,
                ctx(&mut scenario)
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let a_out = take_from_sender<Coin<A>>(&scenario);
            assert!(coin::value(&a_out) > 0, 0);
            balance::destroy_for_testing(coin::into_balance(a_out));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_a_for_exact_b_with_bundle_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_110), ctx(&mut scenario));

            let (remaining_a, b_out) = router::swap_a_for_exact_b_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                99_994,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 10, 0);
            assert!(coin::value(&b_out) == 99_994, 0);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(b_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_b_for_exact_a_with_bundle_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_110), ctx(&mut scenario));

            let (remaining_b, a_out) = router::swap_b_for_exact_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_b,
                99_994,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_b) == 10, 0);
            assert!(coin::value(&a_out) == 99_994, 0);

            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_a_for_exact_b_with_bundle_transfer_sends_output_to_recipient_and_refunds_sender() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_110), ctx(&mut scenario));

            router::swap_a_for_exact_b_with_bundle_and_transfer(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                99_994,
                ADDR2,
                ctx(&mut scenario)
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let b_out = take_from_sender<Coin<B>>(&scenario);
            assert!(coin::value(&b_out) == 99_994, 0);
            balance::destroy_for_testing(coin::into_balance(b_out));
        };

        next_tx(&mut scenario, ADDR1);
        {
            let remaining_a = take_from_sender<Coin<A>>(&scenario);
            assert!(coin::value(&remaining_a) == 10, 1);
            balance::destroy_for_testing(coin::into_balance(remaining_a));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_b_for_exact_a_with_bundle_transfer_sends_output_to_recipient_and_refunds_sender() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_110), ctx(&mut scenario));

            router::swap_b_for_exact_a_with_bundle_and_transfer(
                &bundle,
                &clock,
                &mut pool,
                input_b,
                99_994,
                ADDR2,
                ctx(&mut scenario)
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let a_out = take_from_sender<Coin<A>>(&scenario);
            assert!(coin::value(&a_out) == 99_994, 0);
            balance::destroy_for_testing(coin::into_balance(a_out));
        };

        next_tx(&mut scenario, ADDR1);
        {
            let remaining_b = take_from_sender<Coin<B>>(&scenario);
            assert!(coin::value(&remaining_b) == 10, 1);
            balance::destroy_for_testing(coin::into_balance(remaining_b));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_exact_output_solidity_tx_sequence_executes_without_inventory_revert() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_solidity_router_sequence_pool(&mut scenario);
        configure_solidity_router_sequence_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            assert_router_exact_output_sell_step(&mut pool, &clock, &mut scenario, 100_000_000);
            assert_router_exact_output_buy_step(&mut pool, &clock, &mut scenario, 250_000_000_000);
            assert_router_exact_output_sell_step(&mut pool, &clock, &mut scenario, 41_327_777);
            assert_router_exact_output_sell_step(&mut pool, &clock, &mut scenario, 50_000_000);
            assert_router_exact_output_buy_step(&mut pool, &clock, &mut scenario, 291_573_823_500);
            assert_router_exact_output_sell_step(&mut pool, &clock, &mut scenario, 30_691_870);
            assert_router_exact_output_buy_step(&mut pool, &clock, &mut scenario, 400_000_000_000);
            assert_router_exact_output_buy_step(&mut pool, &clock, &mut scenario, 1_208_557_636_000);
            assert_router_exact_output_sell_step(&mut pool, &clock, &mut scenario, 200_000_000);
            assert_router_exact_output_buy_step(&mut pool, &clock, &mut scenario, 375_000_000_000);
            assert_router_exact_output_buy_step(&mut pool, &clock, &mut scenario, 168_928_674_600);
            assert_router_exact_output_sell_step(&mut pool, &clock, &mut scenario, 500_000_000);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_exact_a_for_b_uses_core_swap_path() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_100), ctx(&mut scenario));

            let b_out = router::swap_exact_a_for_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                99_994,
                ctx(&mut scenario)
            );

            assert!(coin::value(&b_out) == 99_994, 0);
            assert!(pool::balance_a(&pool) == 1_100_100, 0);
            assert!(pool::balance_b(&pool) == 900_006, 0);

            balance::destroy_for_testing(coin::into_balance(b_out));
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
    fun test_router_swap_exact_b_for_a_uses_core_swap_path() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_100), ctx(&mut scenario));

            let a_out = router::swap_exact_b_for_a(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_b,
                99_994,
                ctx(&mut scenario)
            );

            assert!(coin::value(&a_out) == 99_994, 0);
            assert!(pool::balance_a(&pool) == 900_006, 0);
            assert!(pool::balance_b(&pool) == 1_100_100, 0);

            balance::destroy_for_testing(coin::into_balance(a_out));
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
    fun test_router_swap_a_for_exact_b_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_110), ctx(&mut scenario));

            let (remaining_a, b_out) = router::swap_a_for_exact_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                99_994,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 10, 0);
            assert!(coin::value(&b_out) == 99_994, 0);
            assert!(pool::balance_a(&pool) == 1_100_100, 0);
            assert!(pool::balance_b(&pool) == 900_006, 0);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(b_out));
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
    fun test_router_swap_b_for_exact_a_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_110), ctx(&mut scenario));

            let (remaining_b, a_out) = router::swap_b_for_exact_a(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_b,
                99_994,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_b) == 10, 0);
            assert!(coin::value(&a_out) == 99_994, 0);
            assert!(pool::balance_a(&pool) == 900_006, 0);
            assert!(pool::balance_b(&pool) == 1_100_100, 0);

            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
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
    fun test_router_exact_input_solidity_tx_sequence_executes_without_inventory_revert() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_solidity_router_sequence_pool(&mut scenario);
        configure_solidity_router_sequence_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            assert_router_exact_input_sell_step(&mut pool, &clock, &mut scenario, 241_348_310_300);
            assert_router_exact_input_buy_step(&mut pool, &clock, &mut scenario, 103_550_315);
            assert_router_exact_input_buy_step(&mut pool, &clock, &mut scenario, 416_998_211);
            assert_router_exact_input_sell_step(&mut pool, &clock, &mut scenario, 40_994_991_740);
            assert_router_exact_input_buy_step(&mut pool, &clock, &mut scenario, 154_847_630);
            assert_router_exact_input_sell_step(&mut pool, &clock, &mut scenario, 1_951_428_543_000);
            assert_router_exact_input_sell_step(&mut pool, &clock, &mut scenario, 146_747_453_100);
            assert_router_exact_input_buy_step(&mut pool, &clock, &mut scenario, 263_655_816);
            assert_router_exact_input_sell_step(&mut pool, &clock, &mut scenario, 860_331_575_400);
            assert_router_exact_input_buy_step(&mut pool, &clock, &mut scenario, 20_556_822);
            assert_router_exact_input_sell_step(&mut pool, &clock, &mut scenario, 635_360_947_600);
            assert_router_exact_input_buy_step(&mut pool, &clock, &mut scenario, 567_741_528);

            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_two_hop_a_to_c_via_b_uses_typed_pool_path() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let pio_c = test_helpers::create_mock_price_info_object(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                ctx(&mut scenario)
            );
            let init_b = balance::create_for_testing<B>(1_000_000);
            let init_c = balance::create_for_testing<C>(1_000_000);

            let lp = swap::create_pool_for_testing<B, C>(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_b,
                &pio_c,
                &clock,
                init_b,
                init_c,
                9,
                9,
                ctx(&mut scenario)
            );

            transfer::public_transfer(coin::from_balance(lp, ctx(&mut scenario)), ADDR1);
            transfer::public_transfer(pio_c, ADDR1);
            return_to_sender(&scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pio_c = test_helpers::create_mock_price_info_object(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                ctx(&mut scenario)
            );
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_100), ctx(&mut scenario));

            let c_out = router::swap_exact_a_for_c_via_b(&oracle,
                &pio_a,
                &pio_b,
                &pio_c,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_a,
                99_994,
                99_888,
                ctx(&mut scenario)
            );

            assert!(coin::value(&c_out) == 99_888, 0);
            assert!(pool::balance_a(&pool_ab) == 1_100_100, 0);
            assert!(pool::balance_b(&pool_ab) == 900_006, 0);
            assert!(pool::balance_a(&pool_bc) == 1_099_994, 0);
            assert!(pool::balance_b(&pool_bc) == 900_112, 0);

            balance::destroy_for_testing(coin::into_balance(c_out));
            transfer::public_transfer(pio_c, ADDR2);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_two_hop_a_to_c_via_b_with_bundles_uses_prebuilt_bundles() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_100), ctx(&mut scenario));

            let c_out = router::swap_exact_a_for_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_a,
                99_994,
                99_888,
                ctx(&mut scenario)
            );

            assert!(coin::value(&c_out) == 99_888, 0);
            assert!(pool::balance_a(&pool_ab) == 1_100_100, 0);
            assert!(pool::balance_b(&pool_ab) == 900_006, 0);
            assert!(pool::balance_a(&pool_bc) == 1_099_994, 0);
            assert!(pool::balance_b(&pool_bc) == 900_112, 0);

            balance::destroy_for_testing(coin::into_balance(c_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_two_hop_a_to_c_via_b_with_amm_bundles_propagates_each_hop_metadata() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            configure_required_amm_source(&mut pool_ab, &amm_cap);
            configure_required_amm_source(&mut pool_bc, &amm_cap);

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
            let pool_ab_id = pool::id(&pool_ab);
            let pool_bc_id = pool::id(&pool_bc);
            let bundle_ab = amm_bundle_for_pool(&pool_ab, &clock, math::q32() * 17 / 16);
            let bundle_bc = amm_bundle_for_pool(&pool_bc, &clock, math::q32() * 15 / 16);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle_ab) == 1, 0);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle_bc) == 1, 1);
            assert!(
                oracle_gateway::bundle_adj_price(&bundle_ab)
                    > oracle_gateway::bundle_oracle_relative_price(&bundle_ab),
                2
            );
            assert!(
                oracle_gateway::bundle_adj_price(&bundle_bc)
                    < oracle_gateway::bundle_oracle_relative_price(&bundle_bc),
                3
            );

            let (quoted_a, quoted_b, quoted_c) = router::quote_exact_a_for_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                100_100
            );
            assert!(quoted_a == 100_100, 4);
            assert!(quoted_b > 0, 5);
            assert!(quoted_c > 0, 6);

            let input_a = coin::from_balance(balance::create_for_testing<A>(quoted_a), ctx(&mut scenario));
            let c_out = router::swap_exact_a_for_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_a,
                quoted_b,
                quoted_c,
                ctx(&mut scenario)
            );

            assert!(coin::value(&c_out) == quoted_c, 7);
            let bundle_events = event::events_by_type<events::PriceBundleUsed>();
            assert!(bundle_events.length() == 2, 8);
            events::assert_price_bundle_used_for_testing(
                bundle_events[0],
                pool_ab_id,
                type_name::with_defining_ids<A>(),
                type_name::with_defining_ids<B>(),
                oracle_gateway::bundle_policy_version(&bundle_ab),
                oracle_gateway::bundle_policy_digest(&bundle_ab),
                oracle_gateway::bundle_price_digest(&bundle_ab),
                oracle_gateway::bundle_pyth_price_a(&bundle_ab),
                oracle_gateway::bundle_pyth_price_b(&bundle_ab),
                oracle_gateway::bundle_oracle_relative_price(&bundle_ab),
                oracle_gateway::bundle_amm_relative_price(&bundle_ab),
                oracle_gateway::bundle_adj_price(&bundle_ab),
                oracle_gateway::bundle_sell_price(&bundle_ab),
                oracle_gateway::bundle_buy_price(&bundle_ab),
                oracle_gateway::bundle_sell_price(&bundle_ab),
                oracle_gateway::bundle_source_count(&bundle_ab),
                oracle_gateway::bundle_amm_source_count(&bundle_ab)
            );
            events::assert_price_bundle_used_for_testing(
                bundle_events[1],
                pool_bc_id,
                type_name::with_defining_ids<B>(),
                type_name::with_defining_ids<C>(),
                oracle_gateway::bundle_policy_version(&bundle_bc),
                oracle_gateway::bundle_policy_digest(&bundle_bc),
                oracle_gateway::bundle_price_digest(&bundle_bc),
                oracle_gateway::bundle_pyth_price_a(&bundle_bc),
                oracle_gateway::bundle_pyth_price_b(&bundle_bc),
                oracle_gateway::bundle_oracle_relative_price(&bundle_bc),
                oracle_gateway::bundle_amm_relative_price(&bundle_bc),
                oracle_gateway::bundle_adj_price(&bundle_bc),
                oracle_gateway::bundle_sell_price(&bundle_bc),
                oracle_gateway::bundle_buy_price(&bundle_bc),
                oracle_gateway::bundle_sell_price(&bundle_bc),
                oracle_gateway::bundle_source_count(&bundle_bc),
                oracle_gateway::bundle_amm_source_count(&bundle_bc)
            );

            balance::destroy_for_testing(coin::into_balance(c_out));
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_quote_exact_a_for_c_via_b_with_bundles_matches_execution() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);

            let (quoted_a, quoted_b, quoted_c) = router::quote_exact_a_for_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                100_100
            );
            assert!(quoted_a == 100_100, 0);
            assert!(quoted_b == 99_994u64, 1);
            assert!(quoted_c == 99_888, 2);

            let input_a = coin::from_balance(balance::create_for_testing<A>(quoted_a), ctx(&mut scenario));
            let c_out = router::swap_exact_a_for_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_a,
                quoted_b,
                quoted_c,
                ctx(&mut scenario)
            );

            assert!(coin::value(&c_out) == quoted_c, 3);
            assert!(pool::balance_a(&pool_ab) == 1_100_100, 4);
            assert!(pool::balance_b(&pool_ab) == 900_006, 5);
            assert!(pool::balance_a(&pool_bc) == 1_099_994, 6);
            assert!(pool::balance_b(&pool_bc) == 900_112, 7);

            balance::destroy_for_testing(coin::into_balance(c_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_quote_a_for_exact_c_via_b_without_cutoff_surfaces_raw_route() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route_with_balances(
            &mut scenario,
            50_000_000_000,
            10_000_000_000,
            10_000_000_000,
            10_000_000_000
        );

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool_ab = take_shared<Pool<A, B>>(&scenario);
            let pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);

            let (_, effective_b, effective_c) = router::quote_a_for_exact_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                5_000_000_000
            );
            let (raw_a, raw_b, raw_c) =
                router::quote_a_for_exact_c_via_b_without_cutoff_with_bundles(
                    &bundle_ab,
                    &bundle_bc,
                    &clock,
                    &pool_ab,
                    &pool_bc,
                    5_000_000_000
                );

            assert!(raw_a > 0u64, 0);
            assert!(raw_b > effective_b, 1);
            assert!(raw_c == 5_000_000_000u64, 2);
            assert!(effective_c == raw_c, 3);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_quote_exact_a_for_c_via_b_without_cutoff_surfaces_raw_route() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route_with_balances(
            &mut scenario,
            50_000_000_000,
            10_000_000_000,
            10_000_000_000,
            10_000_000_000
        );

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool_ab = take_shared<Pool<A, B>>(&scenario);
            let pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);

            let (_, effective_b, effective_c) = router::quote_exact_a_for_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                10_000_000_000
            );
            let (raw_a, raw_b, raw_c) =
                router::quote_exact_a_for_c_via_b_without_cutoff_with_bundles(
                    &bundle_ab,
                    &bundle_bc,
                    &clock,
                    &pool_ab,
                    &pool_bc,
                    10_000_000_000
                );

            assert!(raw_a == 10_000_000_000u64, 0);
            assert!(raw_b > effective_b, 1);
            assert!(raw_c > effective_c, 2);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_two_hop_c_to_a_via_b_uses_typed_pool_path() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let pio_c = test_helpers::create_mock_price_info_object(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                ctx(&mut scenario)
            );
            let init_b = balance::create_for_testing<B>(1_000_000);
            let init_c = balance::create_for_testing<C>(1_000_000);

            let lp = swap::create_pool_for_testing<B, C>(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_b,
                &pio_c,
                &clock,
                init_b,
                init_c,
                9,
                9,
                ctx(&mut scenario)
            );

            transfer::public_transfer(coin::from_balance(lp, ctx(&mut scenario)), ADDR1);
            transfer::public_transfer(pio_c, ADDR1);
            return_to_sender(&scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pio_c = test_helpers::create_mock_price_info_object(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                ctx(&mut scenario)
            );
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
            let input_c = coin::from_balance(balance::create_for_testing<C>(100_100), ctx(&mut scenario));

            let a_out = router::swap_exact_c_for_a_via_b(&oracle,
                &pio_a,
                &pio_b,
                &pio_c,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_c,
                99_994,
                99_888,
                ctx(&mut scenario)
            );

            assert!(coin::value(&a_out) == 99_888, 0);
            assert!(pool::balance_a(&pool_ab) == 900_112, 0);
            assert!(pool::balance_b(&pool_ab) == 1_099_994, 0);
            assert!(pool::balance_a(&pool_bc) == 900_006, 0);
            assert!(pool::balance_b(&pool_bc) == 1_100_100, 0);

            balance::destroy_for_testing(coin::into_balance(a_out));
            transfer::public_transfer(pio_c, ADDR2);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_two_hop_c_to_a_via_b_with_bundles_uses_prebuilt_bundles() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);
            let input_c = coin::from_balance(balance::create_for_testing<C>(100_100), ctx(&mut scenario));

            let a_out = router::swap_exact_c_for_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_c,
                99_994,
                99_888,
                ctx(&mut scenario)
            );

            assert!(coin::value(&a_out) == 99_888, 0);
            assert!(pool::balance_a(&pool_ab) == 900_112, 0);
            assert!(pool::balance_b(&pool_ab) == 1_099_994, 0);
            assert!(pool::balance_a(&pool_bc) == 900_006, 0);
            assert!(pool::balance_b(&pool_bc) == 1_100_100, 0);

            balance::destroy_for_testing(coin::into_balance(a_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_two_hop_c_to_a_via_b_with_amm_bundles_propagates_each_hop_metadata() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            configure_required_amm_source(&mut pool_ab, &amm_cap);
            configure_required_amm_source(&mut pool_bc, &amm_cap);

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
            let pool_ab_id = pool::id(&pool_ab);
            let pool_bc_id = pool::id(&pool_bc);
            let bundle_ab = amm_bundle_for_pool(&pool_ab, &clock, math::q32() * 17 / 16);
            let bundle_bc = amm_bundle_for_pool(&pool_bc, &clock, math::q32() * 15 / 16);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle_ab) == 1, 0);
            assert!(oracle_gateway::bundle_amm_source_count(&bundle_bc) == 1, 1);

            let (quoted_c, quoted_b, quoted_a) = router::quote_exact_c_for_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                100_100
            );
            assert!(quoted_c == 100_100, 2);
            assert!(quoted_b > 0, 3);
            assert!(quoted_a > 0, 4);

            let input_c = coin::from_balance(balance::create_for_testing<C>(quoted_c), ctx(&mut scenario));
            let a_out = router::swap_exact_c_for_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_c,
                quoted_b,
                quoted_a,
                ctx(&mut scenario)
            );

            assert!(coin::value(&a_out) == quoted_a, 5);
            let bundle_events = event::events_by_type<events::PriceBundleUsed>();
            assert!(bundle_events.length() == 2, 6);
            events::assert_price_bundle_used_for_testing(
                bundle_events[0],
                pool_bc_id,
                type_name::with_defining_ids<C>(),
                type_name::with_defining_ids<B>(),
                oracle_gateway::bundle_policy_version(&bundle_bc),
                oracle_gateway::bundle_policy_digest(&bundle_bc),
                oracle_gateway::bundle_price_digest(&bundle_bc),
                oracle_gateway::bundle_pyth_price_a(&bundle_bc),
                oracle_gateway::bundle_pyth_price_b(&bundle_bc),
                oracle_gateway::bundle_oracle_relative_price(&bundle_bc),
                oracle_gateway::bundle_amm_relative_price(&bundle_bc),
                oracle_gateway::bundle_adj_price(&bundle_bc),
                oracle_gateway::bundle_sell_price(&bundle_bc),
                oracle_gateway::bundle_buy_price(&bundle_bc),
                oracle_gateway::bundle_buy_price(&bundle_bc),
                oracle_gateway::bundle_source_count(&bundle_bc),
                oracle_gateway::bundle_amm_source_count(&bundle_bc)
            );
            events::assert_price_bundle_used_for_testing(
                bundle_events[1],
                pool_ab_id,
                type_name::with_defining_ids<B>(),
                type_name::with_defining_ids<A>(),
                oracle_gateway::bundle_policy_version(&bundle_ab),
                oracle_gateway::bundle_policy_digest(&bundle_ab),
                oracle_gateway::bundle_price_digest(&bundle_ab),
                oracle_gateway::bundle_pyth_price_a(&bundle_ab),
                oracle_gateway::bundle_pyth_price_b(&bundle_ab),
                oracle_gateway::bundle_oracle_relative_price(&bundle_ab),
                oracle_gateway::bundle_amm_relative_price(&bundle_ab),
                oracle_gateway::bundle_adj_price(&bundle_ab),
                oracle_gateway::bundle_sell_price(&bundle_ab),
                oracle_gateway::bundle_buy_price(&bundle_ab),
                oracle_gateway::bundle_buy_price(&bundle_ab),
                oracle_gateway::bundle_source_count(&bundle_ab),
                oracle_gateway::bundle_amm_source_count(&bundle_ab)
            );

            balance::destroy_for_testing(coin::into_balance(a_out));
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_quote_exact_c_for_a_via_b_with_bundles_matches_execution() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);

            let (quoted_c, quoted_b, quoted_a) = router::quote_exact_c_for_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                100_100
            );
            assert!(quoted_c == 100_100, 0);
            assert!(quoted_b == 99_994, 1);
            assert!(quoted_a == 99_888, 2);

            let input_c = coin::from_balance(balance::create_for_testing<C>(quoted_c), ctx(&mut scenario));
            let a_out = router::swap_exact_c_for_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_c,
                quoted_b,
                quoted_a,
                ctx(&mut scenario)
            );

            assert!(coin::value(&a_out) == quoted_a, 3);
            assert!(pool::balance_a(&pool_ab) == 900_112, 4);
            assert!(pool::balance_b(&pool_ab) == 1_099_994, 5);
            assert!(pool::balance_a(&pool_bc) == 900_006, 6);
            assert!(pool::balance_b(&pool_bc) == 1_100_100, 7);

            balance::destroy_for_testing(coin::into_balance(a_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_quote_c_for_exact_a_via_b_without_cutoff_surfaces_raw_route() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route_with_balances(
            &mut scenario,
            10_000_000_000,
            10_000_000_000,
            10_000_000_000,
            50_000_000_000
        );

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool_ab = take_shared<Pool<A, B>>(&scenario);
            let pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);

            let (_, effective_b, effective_a) = router::quote_c_for_exact_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                5_000_000_000
            );
            let (raw_c, raw_b, raw_a) =
                router::quote_c_for_exact_a_via_b_without_cutoff_with_bundles(
                    &bundle_ab,
                    &bundle_bc,
                    &clock,
                    &pool_ab,
                    &pool_bc,
                    5_000_000_000
                );

            assert!(raw_c > 0u64, 0);
            assert!(raw_b > effective_b, 1);
            assert!(raw_a == 5_000_000_000u64, 2);
            assert!(effective_a == raw_a, 3);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_quote_exact_c_for_a_via_b_without_cutoff_surfaces_raw_route() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route_with_balances(
            &mut scenario,
            10_000_000_000,
            10_000_000_000,
            10_000_000_000,
            50_000_000_000
        );

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool_ab = take_shared<Pool<A, B>>(&scenario);
            let pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);

            let (_, effective_b, effective_a) = router::quote_exact_c_for_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                10_000_000_000
            );
            let (raw_c, raw_b, raw_a) =
                router::quote_exact_c_for_a_via_b_without_cutoff_with_bundles(
                    &bundle_ab,
                    &bundle_bc,
                    &clock,
                    &pool_ab,
                    &pool_bc,
                    10_000_000_000
                );

            assert!(raw_c == 10_000_000_000u64, 0);
            assert!(raw_b > effective_b, 1);
            assert!(raw_a > effective_a, 2);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_a_for_exact_c_via_b_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let pio_c = test_helpers::create_mock_price_info_object(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                ctx(&mut scenario)
            );
            let init_b = balance::create_for_testing<B>(1_000_000);
            let init_c = balance::create_for_testing<C>(1_000_000);

            let lp = swap::create_pool_for_testing<B, C>(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_b,
                &pio_c,
                &clock,
                init_b,
                init_c,
                9,
                9,
                ctx(&mut scenario)
            );

            transfer::public_transfer(coin::from_balance(lp, ctx(&mut scenario)), ADDR1);
            transfer::public_transfer(pio_c, ADDR1);
            return_to_sender(&scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pio_c = test_helpers::create_mock_price_info_object(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                ctx(&mut scenario)
            );
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_110), ctx(&mut scenario));

            let (remaining_a, remaining_b, c_out) = router::swap_a_for_exact_c_via_b(&oracle,
                &pio_a,
                &pio_b,
                &pio_c,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_a,
                99_888,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 10, 0);
            assert!(coin::value(&remaining_b) == 0, 0);
            assert!(coin::value(&c_out) == 99_888, 0);
            assert!(pool::balance_a(&pool_ab) == 1_100_100, 0);
            assert!(pool::balance_b(&pool_ab) == 900_006, 0);
            assert!(pool::balance_a(&pool_bc) == 1_099_994, 0);
            assert!(pool::balance_b(&pool_bc) == 900_112, 0);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(c_out));
            transfer::public_transfer(pio_c, ADDR2);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_a_for_exact_c_via_b_with_bundles_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_110), ctx(&mut scenario));

            let (remaining_a, remaining_b, c_out) = router::swap_a_for_exact_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_a,
                99_888,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 10, 0);
            assert!(coin::value(&remaining_b) == 0, 0);
            assert!(coin::value(&c_out) == 99_888, 0);
            assert!(pool::balance_a(&pool_ab) == 1_100_100, 0);
            assert!(pool::balance_b(&pool_ab) == 900_006, 0);
            assert!(pool::balance_a(&pool_bc) == 1_099_994, 0);
            assert!(pool::balance_b(&pool_bc) == 900_112, 0);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(c_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_quote_a_for_exact_c_via_b_with_bundles_matches_execution() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);

            let (quoted_a, quoted_b, effective_c) = router::quote_a_for_exact_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                99_888
            );
            assert!(quoted_a == 100_100, 0);
            assert!(quoted_b == 99_994, 1);
            assert!(effective_c == 99_888, 2);

            let input_a = coin::from_balance(balance::create_for_testing<A>(quoted_a), ctx(&mut scenario));
            let (remaining_a, remaining_b, c_out) = router::swap_a_for_exact_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_a,
                effective_c,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 0, 3);
            assert!(coin::value(&remaining_b) == 0, 4);
            assert!(coin::value(&c_out) == effective_c, 5);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(c_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_bundle_quote_round_trip_a_to_c_via_b() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pool_ab = take_shared<Pool<A, B>>(&scenario);
            let pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);
            let requested_c = 99_888;

            let (required_a, required_b, effective_c) = router::quote_a_for_exact_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                requested_c
            );
            let (round_trip_a, round_trip_b, round_trip_c) = router::quote_exact_a_for_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                required_a
            );

            assert!(effective_c == requested_c, 0);
            assert!(round_trip_a == required_a, 1);
            assert!(round_trip_b >= required_b, 2);
            assert!(round_trip_c >= requested_c, 3);

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::ECutoffLimitReached)]
    fun test_router_swap_a_for_exact_c_via_b_rejects_second_hop_zero_cutoff() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route_with_balances(
            &mut scenario,
            1_000_000,
            1_000_000,
            50_000_000_000,
            10_000_000_000
        );

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let input_a = coin::from_balance(balance::create_for_testing<A>(1_000_000_000_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, c_out) = router::swap_a_for_exact_c_via_b(
                &oracle,
                &pio_a,
                &pio_b,
                &pio_c,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_a,
                9_999_000_000,
                ctx(&mut scenario)
            );

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(c_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::ECutoffLimitReached)]
    fun test_router_swap_a_for_exact_c_via_b_with_bundles_rejects_second_hop_zero_cutoff() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route_with_balances(
            &mut scenario,
            1_000_000,
            1_000_000,
            50_000_000_000,
            10_000_000_000
        );

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);
            let input_a = coin::from_balance(balance::create_for_testing<A>(1_000_000_000_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, c_out) = router::swap_a_for_exact_c_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_a,
                9_999_000_000,
                ctx(&mut scenario)
            );

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(c_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_c_for_exact_a_via_b_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let pio_c = test_helpers::create_mock_price_info_object(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                ctx(&mut scenario)
            );
            let init_b = balance::create_for_testing<B>(1_000_000);
            let init_c = balance::create_for_testing<C>(1_000_000);

            let lp = swap::create_pool_for_testing<B, C>(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_b,
                &pio_c,
                &clock,
                init_b,
                init_c,
                9,
                9,
                ctx(&mut scenario)
            );

            transfer::public_transfer(coin::from_balance(lp, ctx(&mut scenario)), ADDR1);
            transfer::public_transfer(pio_c, ADDR1);
            return_to_sender(&scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pio_c = test_helpers::create_mock_price_info_object(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                ctx(&mut scenario)
            );
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
            let input_c = coin::from_balance(balance::create_for_testing<C>(100_110), ctx(&mut scenario));

            let (remaining_c, remaining_b, a_out) = router::swap_c_for_exact_a_via_b(&oracle,
                &pio_a,
                &pio_b,
                &pio_c,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_c,
                99_888,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_c) == 10, 0);
            assert!(coin::value(&remaining_b) == 0, 0);
            assert!(coin::value(&a_out) == 99_888, 0);
            assert!(pool::balance_a(&pool_ab) == 900_112, 0);
            assert!(pool::balance_b(&pool_ab) == 1_099_994, 0);
            assert!(pool::balance_a(&pool_bc) == 900_006, 0);
            assert!(pool::balance_b(&pool_bc) == 1_100_100, 0);

            balance::destroy_for_testing(coin::into_balance(remaining_c));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            transfer::public_transfer(pio_c, ADDR2);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_c_for_exact_a_via_b_with_bundles_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);
            let input_c = coin::from_balance(balance::create_for_testing<C>(100_110), ctx(&mut scenario));

            let (remaining_c, remaining_b, a_out) = router::swap_c_for_exact_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_c,
                99_888,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_c) == 10, 0);
            assert!(coin::value(&remaining_b) == 0, 0);
            assert!(coin::value(&a_out) == 99_888, 0);
            assert!(pool::balance_a(&pool_ab) == 900_112, 0);
            assert!(pool::balance_b(&pool_ab) == 1_099_994, 0);
            assert!(pool::balance_a(&pool_bc) == 900_006, 0);
            assert!(pool::balance_b(&pool_bc) == 1_100_100, 0);

            balance::destroy_for_testing(coin::into_balance(remaining_c));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_quote_c_for_exact_a_via_b_with_bundles_matches_execution() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);

            let (quoted_c, quoted_b, effective_a) = router::quote_c_for_exact_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &pool_ab,
                &pool_bc,
                99_888
            );
            assert!(quoted_c == 100_100, 0);
            assert!(quoted_b == 99_994u64, 1);
            assert!(effective_a == 99_888, 2);

            let input_c = coin::from_balance(balance::create_for_testing<C>(quoted_c), ctx(&mut scenario));
            let (remaining_c, remaining_b, a_out) = router::swap_c_for_exact_a_via_b_with_bundles(
                &bundle_ab,
                &bundle_bc,
                &clock,
                &mut pool_ab,
                &mut pool_bc,
                input_c,
                effective_a,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_c) == 0, 3);
            assert!(coin::value(&remaining_b) == 0, 4);
            assert!(coin::value(&a_out) == effective_a, 5);

            balance::destroy_for_testing(coin::into_balance(remaining_c));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_a_for_exact_b_via_c_with_reversed_second_bundle_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_triangle_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ac = take_shared<Pool<A, C>>(&scenario);
            let mut pool_bc = take_shared<Pool<B, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ac = pyth_bundle_for_pool(&pio_a, &pio_c, &clock, &pool_ac);
            let bundle_bc = pyth_bundle_for_pool(&pio_b, &pio_c, &clock, &pool_bc);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_110), ctx(&mut scenario));

            let (remaining_a, remaining_c, b_out) =
                router::swap_a_for_exact_c_via_b_with_reversed_second_bundle<A, C, B>(
                    &bundle_ac,
                    &bundle_bc,
                    &clock,
                    &mut pool_ac,
                    &mut pool_bc,
                    input_a,
                    99_888,
                    ctx(&mut scenario)
                );

            assert!(coin::value(&remaining_a) == 10, 0);
            assert!(coin::value(&remaining_c) == 0, 1);
            assert!(coin::value(&b_out) == 99_888, 2);
            assert!(pool::balance_a(&pool_ac) == 1_100_100, 3);
            assert!(pool::balance_b(&pool_ac) == 900_006, 4);
            assert!(pool::balance_a(&pool_bc) == 900_112, 5);
            assert!(pool::balance_b(&pool_bc) == 1_099_994, 6);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_c));
            balance::destroy_for_testing(coin::into_balance(b_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ac);
            return_shared(pool_bc);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_swap_c_for_exact_b_via_a_with_reversed_first_bundle_returns_change() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_triangle_route(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool_ab = take_shared<Pool<A, B>>(&scenario);
            let mut pool_ac = take_shared<Pool<A, C>>(&scenario);
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                &mut scenario
            );
            let bundle_ab = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool_ab);
            let bundle_ac = pyth_bundle_for_pool(&pio_a, &pio_c, &clock, &pool_ac);
            let input_c = coin::from_balance(balance::create_for_testing<C>(100_110), ctx(&mut scenario));

            let (remaining_c, remaining_a, b_out) =
                router::swap_a_for_exact_c_via_b_with_reversed_first_bundle<C, A, B>(
                    &bundle_ac,
                    &bundle_ab,
                    &clock,
                    &mut pool_ac,
                    &mut pool_ab,
                    input_c,
                    99_888,
                    ctx(&mut scenario)
                );

            assert!(coin::value(&remaining_c) == 10, 0);
            assert!(coin::value(&remaining_a) == 0, 1);
            assert!(coin::value(&b_out) == 99_888, 2);
            assert!(pool::balance_a(&pool_ac) == 900_006, 3);
            assert!(pool::balance_b(&pool_ac) == 1_100_100, 4);
            assert!(pool::balance_a(&pool_ab) == 1_099_994, 5);
            assert!(pool::balance_b(&pool_ab) == 900_112, 6);

            balance::destroy_for_testing(coin::into_balance(remaining_c));
            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(b_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool_ab);
            return_shared(pool_ac);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_add_and_remove_liquidity_helpers_use_core_paths() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_coins(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                input_b,
                100_000,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 0, 0);
            assert!(coin::value(&remaining_b) == 0, 0);
            assert!(coin::value(&lp) == 200_000, 0);
            assert!(pool::balance_a(&pool) == 1_100_000, 0);
            assert!(pool::balance_b(&pool) == 1_100_000, 0);

            let (a_out, b_out) = router::remove_liquidity_with_coins(&mut pool,
                lp,
                100_000,
                100_000,
                ctx(&mut scenario)
            );

            assert!(coin::value(&a_out) == 100_000, 0);
            assert!(coin::value(&b_out) == 100_000, 0);
            assert!(pool::balance_a(&pool) == 1_000_000, 0);
            assert!(pool::balance_b(&pool) == 1_000_000, 0);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            balance::destroy_for_testing(coin::into_balance(b_out));
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
    fun test_router_zap_in_a_swaps_half_and_mints_lp() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_a = coin::from_balance(balance::create_for_testing<A>(200_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::zap_in_a(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                0,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&lp) > 0, 0);
            assert!(coin::value(&remaining_a) > 0, 1);
            assert!(coin::value(&remaining_b) == 0, 2);
            assert!(pool::balance_a(&pool) > 1_100_000, 3);
            assert!(pool::balance_b(&pool) == 1_000_000, 4);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(lp));
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
    fun test_router_zap_in_b_swaps_half_and_mints_lp() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_b = coin::from_balance(balance::create_for_testing<B>(200_000), ctx(&mut scenario));

            let (remaining_b, remaining_a, lp) = router::zap_in_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_b,
                0,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&lp) > 0, 0);
            assert!(coin::value(&remaining_b) > 0, 1);
            assert!(coin::value(&remaining_a) == 0, 2);
            assert!(pool::balance_a(&pool) == 1_000_000, 3);
            assert!(pool::balance_b(&pool) > 1_100_000, 4);

            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(lp));
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
    fun test_router_zap_out_a_burns_lp_and_swaps_b_to_a() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_coins(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ctx(&mut scenario)
            );
            let a_out = router::zap_out_a(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                lp,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 0, 0);
            assert!(coin::value(&remaining_b) == 0, 1);
            assert!(coin::value(&a_out) > 100_000, 2);
            assert!(pool::balance_a(&pool) < 1_000_000, 3);
            assert!(pool::balance_b(&pool) > 1_000_000, 4);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
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
    fun test_router_zap_out_b_burns_lp_and_swaps_a_to_b() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_coins(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ctx(&mut scenario)
            );
            let b_out = router::zap_out_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                lp,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 0, 0);
            assert!(coin::value(&remaining_b) == 0, 1);
            assert!(coin::value(&b_out) > 100_000, 2);
            assert!(pool::balance_a(&pool) > 1_000_000, 3);
            assert!(pool::balance_b(&pool) < 1_000_000, 4);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(b_out));
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
    fun test_router_add_liquidity_with_bundle_uses_amm_valuation_floor() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
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

            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));
            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&lp) == 193_937, 0);
            assert!(coin::value(&remaining_a) == 1, 1);
            assert!(coin::value(&remaining_b) == 5_883, 2);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(lp));
            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_add_then_remove_liquidity_with_bundle_returns_inputs() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                100_000,
                ctx(&mut scenario)
            );
            let (a_out, b_out) = router::remove_liquidity_with_coins(
                &mut pool,
                lp,
                100_000,
                100_000,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 0, 0);
            assert!(coin::value(&remaining_b) == 0, 1);
            assert!(coin::value(&a_out) == 100_000, 2);
            assert!(coin::value(&b_out) == 100_000, 3);
            assert!(pool::balance_a(&pool) == 1_000_000, 4);
            assert!(pool::balance_b(&pool) == 1_000_000, 5);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            balance::destroy_for_testing(coin::into_balance(b_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_add_liquidity_with_bundle_transfer_sends_lp_to_recipient_and_refunds_sender() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(200_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            router::add_liquidity_with_bundle_and_transfer(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ADDR2,
                ctx(&mut scenario)
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let lp = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp) > 0, 0);
            balance::destroy_for_testing(coin::into_balance(lp));
        };

        next_tx(&mut scenario, ADDR1);
        {
            let remaining_a = take_from_sender<Coin<A>>(&scenario);
            assert!(coin::value(&remaining_a) == 100_000, 1);
            balance::destroy_for_testing(coin::into_balance(remaining_a));
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_router_add_liquidity_with_bundle_rejects_unreachable_min_lp() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                1_000_000_000,
                ctx(&mut scenario)
            );

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(lp));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_router_remove_liquidity_after_bundle_add_rejects_unreachable_min_a() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ctx(&mut scenario)
            );
            let (a_out, b_out) = router::remove_liquidity_with_coins(
                &mut pool,
                lp,
                1_000_000_000,
                0,
                ctx(&mut scenario)
            );

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            balance::destroy_for_testing(coin::into_balance(b_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_zap_in_a_with_bundle_swaps_half_and_mints_lp() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(200_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::zap_in_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                0,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&lp) > 0, 0);
            assert!(coin::value(&remaining_a) > 0, 1);
            assert!(coin::value(&remaining_b) == 0, 2);
            assert!(pool::balance_a(&pool) > 1_100_000, 3);
            assert!(pool::balance_b(&pool) == 1_000_000, 4);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(lp));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_zap_in_b_with_bundle_swaps_half_and_mints_lp() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_b = coin::from_balance(balance::create_for_testing<B>(200_000), ctx(&mut scenario));

            let (remaining_b, remaining_a, lp) = router::zap_in_b_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_b,
                0,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&lp) > 0, 0);
            assert!(coin::value(&remaining_b) > 0, 1);
            assert!(coin::value(&remaining_a) == 0, 2);
            assert!(pool::balance_a(&pool) == 1_000_000, 3);
            assert!(pool::balance_b(&pool) > 1_100_000, 4);

            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(lp));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_zap_out_a_with_bundle_burns_lp_and_swaps_b_to_a() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ctx(&mut scenario)
            );
            let a_out = router::zap_out_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                lp,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 0, 0);
            assert!(coin::value(&remaining_b) == 0, 1);
            assert!(coin::value(&a_out) > 100_000, 2);
            assert!(pool::balance_a(&pool) < 1_000_000, 3);
            assert!(pool::balance_b(&pool) > 1_000_000, 4);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_zap_out_b_with_bundle_burns_lp_and_swaps_a_to_b() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ctx(&mut scenario)
            );
            let b_out = router::zap_out_b_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                lp,
                0,
                ctx(&mut scenario)
            );

            assert!(coin::value(&remaining_a) == 0, 0);
            assert!(coin::value(&remaining_b) == 0, 1);
            assert!(coin::value(&b_out) > 100_000, 2);
            assert!(pool::balance_a(&pool) > 1_000_000, 3);
            assert!(pool::balance_b(&pool) < 1_000_000, 4);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(b_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_zap_in_a_with_bundle_transfer_sends_lp_to_recipient_and_refunds_sender() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(200_000), ctx(&mut scenario));

            router::zap_in_a_with_bundle_and_transfer(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                0,
                0,
                ADDR2,
                ctx(&mut scenario)
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let lp = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp) > 0, 0);
            balance::destroy_for_testing(coin::into_balance(lp));
        };

        next_tx(&mut scenario, ADDR1);
        {
            let remaining_a = take_from_sender<Coin<A>>(&scenario);
            assert!(coin::value(&remaining_a) > 0, 1);
            balance::destroy_for_testing(coin::into_balance(remaining_a));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_zap_in_b_with_bundle_transfer_sends_lp_to_recipient_and_refunds_sender() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_b = coin::from_balance(balance::create_for_testing<B>(200_000), ctx(&mut scenario));

            router::zap_in_b_with_bundle_and_transfer(
                &bundle,
                &clock,
                &mut pool,
                input_b,
                0,
                0,
                ADDR2,
                ctx(&mut scenario)
            );

            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let lp = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp) > 0, 0);
            balance::destroy_for_testing(coin::into_balance(lp));
        };

        next_tx(&mut scenario, ADDR1);
        {
            let remaining_b = take_from_sender<Coin<B>>(&scenario);
            assert!(coin::value(&remaining_b) > 0, 1);
            balance::destroy_for_testing(coin::into_balance(remaining_b));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_zap_out_a_with_bundle_transfer_sends_output_to_recipient() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));
            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ctx(&mut scenario)
            );

            router::zap_out_a_with_bundle_and_transfer(
                &bundle,
                &clock,
                &mut pool,
                lp,
                0,
                ADDR2,
                ctx(&mut scenario)
            );

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let a_out = take_from_sender<Coin<A>>(&scenario);
            assert!(coin::value(&a_out) > 100_000, 0);
            balance::destroy_for_testing(coin::into_balance(a_out));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_zap_out_b_with_bundle_transfer_sends_output_to_recipient() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));
            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ctx(&mut scenario)
            );

            router::zap_out_b_with_bundle_and_transfer(
                &bundle,
                &clock,
                &mut pool,
                lp,
                0,
                ADDR2,
                ctx(&mut scenario)
            );

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let b_out = take_from_sender<Coin<B>>(&scenario);
            assert!(coin::value(&b_out) > 100_000, 0);
            balance::destroy_for_testing(coin::into_balance(b_out));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_router_zap_in_then_zap_out_a_with_bundle_keeps_loss_under_five_percent() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let amount_in = 200_000;
            let input_a = coin::from_balance(balance::create_for_testing<A>(amount_in), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::zap_in_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                0,
                0,
                ctx(&mut scenario)
            );
            let a_out = router::zap_out_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                lp,
                0,
                ctx(&mut scenario)
            );
            let total_a_returned = coin::value(&remaining_a) + coin::value(&a_out);

            assert!(coin::value(&remaining_b) == 0, 0);
            assert!(total_a_returned * 100 > amount_in * 95, 1);

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_router_zap_in_a_with_bundle_rejects_unreachable_swap_min() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(200_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::zap_in_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                1_000_000_000,
                0,
                ctx(&mut scenario)
            );

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(lp));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_router_zap_out_a_with_bundle_rejects_unreachable_min_out() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR2);
        {
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
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
            let bundle = pyth_bundle_for_pool(&pio_a, &pio_b, &clock, &pool);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_000), ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(100_000), ctx(&mut scenario));

            let (remaining_a, remaining_b, lp) = router::add_liquidity_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                input_a,
                input_b,
                0,
                ctx(&mut scenario)
            );
            let a_out = router::zap_out_a_with_bundle(
                &bundle,
                &clock,
                &mut pool,
                lp,
                1_000_000_000,
                ctx(&mut scenario)
            );

            balance::destroy_for_testing(coin::into_balance(remaining_a));
            balance::destroy_for_testing(coin::into_balance(remaining_b));
            balance::destroy_for_testing(coin::into_balance(a_out));
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_shared(clock);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = router::ERouterDisabled)]
    fun test_router_swap_aborts_when_pool_router_disabled() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let router_cap = take_from_sender<RouterCap>(&scenario);

            admin::set_pool_router_enabled(&mut pool, &router_cap, false);

            return_to_sender<RouterCap>(&scenario, router_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let input_a = coin::from_balance(balance::create_for_testing<A>(100_100), ctx(&mut scenario));

            let b_out = router::swap_exact_a_for_b(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                100_000,
                ctx(&mut scenario)
            );

            balance::destroy_for_testing(coin::into_balance(b_out));
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
    #[expected_failure(abort_code = router::ERouteLimitExceeded)]
    fun test_router_hop_limit_fails_above_day_one_limit() {
        router::assert_hop_limit(3);
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

            transfer::public_transfer(coin::from_balance(lp, ctx(scenario)), ADDR1);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            return_to_sender<PoolCreatorCap>(scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
        };
    }

    fun create_solidity_router_sequence_pool(scenario: &mut test_scenario::Scenario) {
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
                balance::create_for_testing<A>(24_150_000_000_000),
                balance::create_for_testing<B>(10_000_000_000),
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

    fun configure_solidity_router_sequence_pool(scenario: &mut test_scenario::Scenario) {
        next_tx(scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(scenario);
            let risk_cap = take_from_sender<RiskCap>(scenario);

            admin::set_pool_fee(&mut pool, &risk_cap, 300_000);
            admin::set_pool_k_b(&mut pool, &risk_cap, math::q32() / 100);
            admin::set_pool_k_q(&mut pool, &risk_cap, math::q32() * 8 / 1000);
            admin::set_pool_lambda(&mut pool, &risk_cap, 0);
            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                100_000,
                0,
                0,
                10_000,
                10_000_000,
                0
            );

            return_to_sender<RiskCap>(scenario, risk_cap);
            return_shared(pool);
        };
    }

    fun create_pyth_test_route(scenario: &mut test_scenario::Scenario) {
        create_pyth_test_route_with_balances(
            scenario,
            1_000_000,
            1_000_000,
            1_000_000,
            1_000_000
        );
    }

    fun create_pyth_test_route_with_balances(
        scenario: &mut test_scenario::Scenario,
        init_a: u64,
        init_b_for_ab: u64,
        init_b_for_bc: u64,
        init_c: u64
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
            oracle::configure_token<C>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xCCCC),
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                scenario
            );

            let lp_ab = swap::create_pool_for_testing<A, B>(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                balance::create_for_testing<A>(init_a),
                balance::create_for_testing<B>(init_b_for_ab),
                9,
                9,
                ctx(scenario)
            );
            let lp_bc = swap::create_pool_for_testing<B, C>(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_b,
                &pio_c,
                &clock,
                balance::create_for_testing<B>(init_b_for_bc),
                balance::create_for_testing<C>(init_c),
                9,
                9,
                ctx(scenario)
            );

            transfer::public_transfer(coin::from_balance(lp_ab, ctx(scenario)), ADDR1);
            transfer::public_transfer(coin::from_balance(lp_bc, ctx(scenario)), ADDR1);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_to_sender<PoolCreatorCap>(scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
        };
    }

    fun create_pyth_test_triangle_route(scenario: &mut test_scenario::Scenario) {
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
            oracle::configure_token<C>(
                &mut oracle,
                b"pyth",
                object::id_from_address(@0xCCCC),
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc"
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
            let pio_c = new_pyth_price_info(
                x"cccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc",
                100_000_000,
                0,
                scenario
            );

            let lp_ab = swap::create_pool_for_testing<A, B>(
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
            let lp_ac = swap::create_pool_for_testing<A, C>(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_a,
                &pio_c,
                &clock,
                balance::create_for_testing<A>(1_000_000),
                balance::create_for_testing<C>(1_000_000),
                9,
                9,
                ctx(scenario)
            );
            let lp_bc = swap::create_pool_for_testing<B, C>(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_b,
                &pio_c,
                &clock,
                balance::create_for_testing<B>(1_000_000),
                balance::create_for_testing<C>(1_000_000),
                9,
                9,
                ctx(scenario)
            );

            transfer::public_transfer(coin::from_balance(lp_ab, ctx(scenario)), ADDR1);
            transfer::public_transfer(coin::from_balance(lp_ac, ctx(scenario)), ADDR1);
            transfer::public_transfer(coin::from_balance(lp_bc, ctx(scenario)), ADDR1);
            price_info::destroy(pio_a);
            price_info::destroy(pio_b);
            price_info::destroy(pio_c);
            return_to_sender<PoolCreatorCap>(scenario, pool_creator_cap);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
        };
    }

    fun pyth_bundle_for_pool<X, Y>(
        price_info_object_x: &PriceInfoObject,
        price_info_object_y: &PriceInfoObject,
        clock: &Clock,
        pool: &Pool<X, Y>
    ): oracle_gateway::PriceBundle {
        let reading_x = pyth_source::read_price_a(price_info_object_x, clock, pool);
        let reading_y = pyth_source::read_price_b(price_info_object_y, clock, pool);
        oracle_gateway::get_swap_price_bundle_from_readings(&reading_x, &reading_y, clock, pool)
    }

    fun solidity_router_sequence_bundle<A, B>(
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
            2_415_000_000_000
        );
        oracle_gateway::get_swap_price_bundle_from_readings(
            &reading_a,
            &reading_b,
            clock,
            pool
        )
    }

    fun assert_router_exact_output_sell_step(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        scenario: &mut test_scenario::Scenario,
        exact_base_out: u64
    ) {
        let bundle = solidity_router_sequence_bundle(pool, clock);
        let (required_quote_in, effective_out) = swap::quote_a_for_exact_b_with_bundle(
            &bundle,
            clock,
            pool,
            exact_base_out
        );
        assert!(effective_out == exact_base_out, exact_base_out);

        let max_quote_in = math::mul_div_up_to_u64((required_quote_in as u128), 10_005, 10_000) + 1;
        let input_a = coin::from_balance(balance::create_for_testing<A>(max_quote_in), ctx(scenario));
        let (remaining_a, b_out) = router::swap_a_for_exact_b_with_bundle(
            &bundle,
            clock,
            pool,
            input_a,
            exact_base_out,
            ctx(scenario)
        );

        assert!(coin::value(&b_out) == exact_base_out, 0);
        assert!(coin::value(&remaining_a) == max_quote_in - required_quote_in, 1);

        balance::destroy_for_testing(coin::into_balance(remaining_a));
        balance::destroy_for_testing(coin::into_balance(b_out));
    }

    fun assert_router_exact_output_buy_step(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        scenario: &mut test_scenario::Scenario,
        exact_quote_out: u64
    ) {
        let bundle = solidity_router_sequence_bundle(pool, clock);
        let (required_base_in, effective_out) = swap::quote_b_for_exact_a_with_bundle(
            &bundle,
            clock,
            pool,
            exact_quote_out
        );
        assert!(effective_out == exact_quote_out, exact_quote_out);

        let max_base_in = math::mul_div_up_to_u64((required_base_in as u128), 10_005, 10_000) + 1;
        let input_b = coin::from_balance(balance::create_for_testing<B>(max_base_in), ctx(scenario));
        let (remaining_b, a_out) = router::swap_b_for_exact_a_with_bundle(
            &bundle,
            clock,
            pool,
            input_b,
            exact_quote_out,
            ctx(scenario)
        );

        assert!(coin::value(&a_out) == exact_quote_out, 0);
        assert!(coin::value(&remaining_b) == max_base_in - required_base_in, 1);

        balance::destroy_for_testing(coin::into_balance(remaining_b));
        balance::destroy_for_testing(coin::into_balance(a_out));
    }

    fun assert_router_exact_input_sell_step(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        scenario: &mut test_scenario::Scenario,
        exact_quote_in: u64
    ) {
        let bundle = solidity_router_sequence_bundle(pool, clock);
        let (expected_base_out, _, _) = swap::quote_a_for_b_with_bundle(
            &bundle,
            clock,
            pool,
            exact_quote_in
        );
        assert!(expected_base_out > 0, 0);

        let input_a = coin::from_balance(balance::create_for_testing<A>(exact_quote_in), ctx(scenario));
        let b_out = router::swap_exact_a_for_b_with_bundle(
            &bundle,
            clock,
            pool,
            input_a,
            expected_base_out,
            ctx(scenario)
        );

        assert!(coin::value(&b_out) == expected_base_out, 1);

        balance::destroy_for_testing(coin::into_balance(b_out));
    }

    fun assert_router_exact_input_buy_step(
        pool: &mut Pool<A, B>,
        clock: &Clock,
        scenario: &mut test_scenario::Scenario,
        exact_base_in: u64
    ) {
        let bundle = solidity_router_sequence_bundle(pool, clock);
        let (expected_quote_out, _, _) = swap::quote_b_for_a_with_bundle(
            &bundle,
            clock,
            pool,
            exact_base_in
        );
        assert!(expected_quote_out > 0, 0);

        let input_b = coin::from_balance(balance::create_for_testing<B>(exact_base_in), ctx(scenario));
        let a_out = router::swap_exact_b_for_a_with_bundle(
            &bundle,
            clock,
            pool,
            input_b,
            expected_quote_out,
            ctx(scenario)
        );

        assert!(coin::value(&a_out) == expected_quote_out, 1);

        balance::destroy_for_testing(coin::into_balance(a_out));
    }

    fun amm_bundle_for_pool<X, Y>(
        pool: &Pool<X, Y>,
        clock: &Clock,
        relative_price_q32: u64
    ): oracle_gateway::PriceBundle {
        let mut readings_x = vector[];
        let mut readings_y = vector[];
        vector::push_back(
            &mut readings_x,
            new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_a(pool),
                pool::oracle_config_data_a(pool),
                1_000_000_000
            )
        );
        vector::push_back(
            &mut readings_y,
            new_test_reading(
                pool::oracle_source_pyth(),
                pool::oracle_source_mask_pyth(),
                pool::oracle_source_id_b(pool),
                pool::oracle_config_data_b(pool),
                1_000_000_000
            )
        );

        let mut amm_readings = vector[];
        vector::push_back(
            &mut amm_readings,
            new_test_amm_reading(
                pool::id(pool),
                1,
                relative_price_q32,
                1_000_000,
                60
            )
        );

        oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings(
            &readings_x,
            &readings_y,
            &amm_readings,
            clock,
            pool
        )
    }

    fun configure_required_amm_source<X, Y>(pool: &mut Pool<X, Y>, amm_cap: &AmmCap) {
        admin::set_pool_amm_policy(
            pool,
            amm_cap,
            true,
            50_000_000,
            1,
            pool::amm_fallback_fail_closed()
        );
        admin::set_pool_amm_source_policy(
            pool,
            amm_cap,
            10_000_000,
            1_000,
            60,
            900,
            1,
            4
        );
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
