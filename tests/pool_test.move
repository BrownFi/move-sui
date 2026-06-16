#[test_only]
module brownfi_amm::pool_test {
    use sui::test_scenario::{Self, next_tx, ctx, take_shared, return_shared, take_from_sender, return_to_sender};
    use sui::balance;
    use sui::coin::{Self, Coin};
    use sui::clock::Clock;
    use brownfi_amm::admin;
    use brownfi_amm::swap;
    use brownfi_amm::pool::{Self as pool, Pool, LP};
    use brownfi_amm::factory::{AdminCap, Factory, PauseCap};
    use brownfi_oracle::oracle::OracleAdapter;
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B};
    use pyth::price_info::PriceInfoObject;

    const ADDR1: address = @0xA;
    const ADDR2: address = @0xB;

    #[test]
    fun test_lp_display_metadata_matches_brownfi_v3_erc20() {
        assert!(pool::lp_name() == b"BrownFi V3", 0);
        assert!(pool::lp_symbol() == b"BF-V3", 1);
        assert!(pool::lp_decimals() == 18, 2);
    }

    #[test]
    #[expected_failure(abort_code = swap::EAddLiquidityPaused)]
    fun test_add_liquidity_aborts_when_pool_add_liquidity_paused() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let pause_cap = take_from_sender<PauseCap>(&scenario);

            admin::set_pool_add_liquidity_paused(&mut pool, &pause_cap, true);

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

            let input_a = balance::create_for_testing<A>(1000);
            let input_b = balance::create_for_testing<B>(1000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, input_b, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

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
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_add_liquidity_aborts_on_zero_input_a() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::zero<A>();
            let input_b = balance::create_for_testing<B>(10);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, input_b, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

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
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_add_liquidity_aborts_on_zero_input_b() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(10);
            let input_b = balance::zero<B>();
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, input_b, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

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
    fun test_add_liquidity_on_empty_pool() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let lp_coin = take_from_sender<Coin<LP<A,B>>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, coin::into_balance(lp_coin), 0, 0);
            return_shared(factory);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 500 && amount_b == 500 && lp_supply == 1000, 0);

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

            let input_a = balance::create_for_testing<A>(2000);
            let input_b = balance::create_for_testing<B>(1000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, input_b, 2000);

            assert!(balance::value(&remaining_a) == 1000, 0);
            assert!(balance::value(&remaining_b) == 0, 0);
            assert!(balance::value(&lp) == 2000, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 1500 && amount_b == 1500 && lp_supply == 3000, 0);

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
    fun test_add_liquidity_uses_pyth_value_residual_on_imbalanced_pool() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 5000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(20000);
            let input_b = balance::create_for_testing<B>(10000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                input_b,
                20000
            );

            assert!(balance::value(&remaining_a) == 10000, 0);
            assert!(balance::value(&remaining_b) == 0, 1);
            assert!(balance::value(&lp) == 20000, 2);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 20000, 3);
            assert!(amount_b == 15000, 4);
            assert!(lp_supply == 35000, 5);

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
    fun test_add_liquidity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 5000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(20000);
            let input_b = balance::create_for_testing<B>(10000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, input_b, 20000);

            assert!(balance::value(&remaining_a) == 10000, 0);
            assert!(balance::value(&remaining_b) == 0, 0);
            assert!(balance::value(&lp) == 20000, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 20000 && amount_b == 15000 && lp_supply == 35000, 0);

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
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(11000);
            let input_b = balance::create_for_testing<B>(5000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, input_b, 10000);

            assert!(balance::value(&remaining_a) == 6000, 0);
            assert!(balance::value(&remaining_b) == 0, 0);
            assert!(balance::value(&lp) == 10000, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 25000 && amount_b == 20000 && lp_supply == 45000, 0);

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
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(10000);
            let input_b = balance::create_for_testing<B>(6000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, input_b, 12000);

            assert!(balance::value(&remaining_a) == 4000, 0);
            assert!(balance::value(&remaining_b) == 0, 0);
            assert!(balance::value(&lp) == 12000, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 31000 && amount_b == 26000 && lp_supply == 57000, 0);

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
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(1);
            let input_b = balance::create_for_testing<B>(1);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, input_b, 0);

            assert!(balance::value(&remaining_a) == 0, 0);
            assert!(balance::value(&remaining_b) == 0, 0);
            assert!(balance::value(&lp) == 2, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 31001 && amount_b == 26001 && lp_supply == 57002, 0);

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
    fun test_add_liquidity_aborts_on_min_lp_out() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(20000);
            let input_b = balance::create_for_testing<B>(20000);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, input_b, 40001);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

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
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_remove_liquidity_aborts_on_zero_input_lp() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let lp = balance::zero();
            let factory = take_shared<Factory>(&scenario);
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp, 0, 0);
            return_shared(factory);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_remove_liquidity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 1300);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let mut lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp_coin) == 10300, 0);

            let ctx = ctx(&mut scenario);
            let lp_in = coin::into_balance(coin::split(&mut lp_coin, 1300, ctx));
            let factory = take_shared<Factory>(&scenario);
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 1150, 149);
            return_shared(factory);

            assert!(balance::value(&a_out) == 1150, 0);
            assert!(balance::value(&b_out) == 149, 0);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 8850 && amount_b == 1151 && lp_supply == 10000, 0);

            return_shared(pool);
            return_to_sender(&scenario, lp_coin);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let mut lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp_coin) == 9000, 0);

            let ctx = ctx(&mut scenario);
            let lp_in = coin::into_balance(coin::split(&mut lp_coin, 1000, ctx));
            let factory = take_shared<Factory>(&scenario);
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 885, 115);
            return_shared(factory);

            assert!(balance::value(&a_out) == 885, 0);
            assert!(balance::value(&b_out) == 115, 0);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 7965 && amount_b == 1036 && lp_supply == 9000, 0);

            return_shared(pool);
            return_to_sender(&scenario, lp_coin);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp_coin) == 8000, 0);

            let lp_in = coin::into_balance(lp_coin);
            let factory = take_shared<Factory>(&scenario);
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 7080, 920);
            return_shared(factory);

            assert!(balance::value(&a_out) == 7080, 0);
            assert!(balance::value(&b_out) == 920, 0);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 885 && amount_b == 116 && lp_supply == 1000, 0);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_remove_liquidity_allowed_when_factory_paused() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let admin_cap = take_from_sender<AdminCap>(&scenario);

            admin::set_factory_paused(&mut factory, &admin_cap, true);

            return_to_sender<AdminCap>(&scenario, admin_cap);
            return_shared(factory);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);

            let (a_out, b_out) = swap::remove_liquidity(&mut pool, coin::into_balance(lp_coin), 9500, 9500);
            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);

            assert!(balance::value(&a_out) == 9500, 0);
            assert!(balance::value(&b_out) == 9500, 0);
            assert!(amount_a == 500, 0);
            assert!(amount_b == 500, 0);
            assert!(lp_supply == 1000, 0);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);
            return_shared(factory);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_remove_liquidity_aborts_on_min_a_out() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let mut lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            let ctx = ctx(&mut scenario);

            let lp_in = coin::into_balance(coin::split(&mut lp_coin, 5000, ctx));
            let factory = take_shared<Factory>(&scenario);
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 2501, 2500);
            return_shared(factory);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
            return_to_sender(&scenario, lp_coin);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_remove_liquidity_aborts_on_min_b_out() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let mut lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            let ctx = ctx(&mut scenario);

            let lp_in = coin::into_balance(coin::split(&mut lp_coin, 5000, ctx));
            let factory = take_shared<Factory>(&scenario);
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 2500, 2501);
            return_shared(factory);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
            return_to_sender(&scenario, lp_coin);
        };

        test_scenario::end(scenario);
    }
}
