#[test_only]
module brownfi_amm::swap_test {
    use sui::test_scenario::{Self, next_tx, take_shared, return_shared, take_from_sender};
    use sui::balance;
    use sui::coin::{Self, Coin};
    use sui::clock::Clock;
    use brownfi_amm::swap;
    use brownfi_amm::pool::{Pool, LP};
    use brownfi_amm::factory::Factory;
    use brownfi_oracle::oracle::OracleAdapter;
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B};
    use pyth::price_info::PriceInfoObject;

    const ADDR1: address = @0xA;
    const ADDR2: address = @0xB;

    #[test]
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_swap_a_for_b_aborts_on_zero_input_a() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::zero<A>();
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
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_swap_b_for_a_aborts_on_zero_input_b() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_b = balance::zero<B>();
            let a_out = swap::swap_b_for_a(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_b, 0);

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
    fun test_swap_a_for_b_uses_locked_reserves_after_owner_exit() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);

            let (a_out, b_out) = swap::remove_liquidity(&mut pool, coin::into_balance(lp_coin), 0, 0);
            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 500 && amount_b == 500 && lp_supply == 1000, 0);

            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(10);
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
    fun test_swap_b_for_a_uses_locked_reserves_after_owner_exit() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);

            let (a_out, b_out) = swap::remove_liquidity(&mut pool, coin::into_balance(lp_coin), 0, 0);
            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 500 && amount_b == 500 && lp_supply == 1000, 0);

            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_b = balance::create_for_testing<B>(10);
            let a_out = swap::swap_b_for_a(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_b, 0);

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
    fun test_swap_a_for_b() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 20000, 10000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(1300);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 1298);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 21300 && amount_b == 8702 && lp_supply == 30000, 0);
            assert!(balance::value(&b_out) == 1298, 0);

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
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(1);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 0);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 21301 && amount_b == 8702 && lp_supply == 30000, 0);
            assert!(balance::value(&b_out) == 0, 0);

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
    fun test_swap_b_for_a() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 20000, 10000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_b = balance::create_for_testing<B>(1300);
            let a_out = swap::swap_b_for_a(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_b, 1298);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 18702 && amount_b == 11300 && lp_supply == 30000, 0);
            assert!(balance::value(&a_out) == 1298, 0);

            balance::destroy_for_testing(a_out);

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

            let input_b = balance::create_for_testing<B>(1);
            let a_out = swap::swap_b_for_a(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_b, 0);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 18702 && amount_b == 11301 && lp_supply == 30000, 0);
            assert!(balance::value(&a_out) == 0, 0);

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
    fun test_swap_a_for_b_transfer_wrapper_accepts_recipient() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 20000, 10000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = coin::from_balance(balance::create_for_testing<A>(1300), test_scenario::ctx(&mut scenario));
            swap::swap_a_for_b_with_coin_and_transfer(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                1298,
                ADDR1,
                test_scenario::ctx(&mut scenario)
            );

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let b_coin = take_from_sender<Coin<B>>(&scenario);
            assert!(coin::value(&b_coin) == 1298, 0);
            balance::destroy_for_testing(coin::into_balance(b_coin));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_b_for_a_transfer_wrapper_accepts_recipient() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 20000, 10000);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_b = coin::from_balance(balance::create_for_testing<B>(1300), test_scenario::ctx(&mut scenario));
            swap::swap_b_for_a_with_coin_and_transfer(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_b,
                1298,
                ADDR1,
                test_scenario::ctx(&mut scenario)
            );

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let a_coin = take_from_sender<Coin<A>>(&scenario);
            assert!(coin::value(&a_coin) == 1298, 0);
            balance::destroy_for_testing(coin::into_balance(a_coin));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_liquidity_transfer_wrapper_accepts_recipient() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 20000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = coin::from_balance(balance::create_for_testing<A>(2000), test_scenario::ctx(&mut scenario));
            let input_b = coin::from_balance(balance::create_for_testing<B>(1000), test_scenario::ctx(&mut scenario));
            swap::add_liquidity_with_coins_and_transfer(
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                &mut pool,
                input_a,
                input_b,
                1,
                ADDR2,
                test_scenario::ctx(&mut scenario)
            );

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp_coin) > 0, 0);
            balance::destroy_for_testing(coin::into_balance(lp_coin));
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_remove_liquidity_transfer_wrapper_accepts_recipient() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 20000, 10000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);

            swap::remove_liquidity_with_coins_and_transfer(
                &mut pool,
                lp_coin,
                1,
                1,
                ADDR2,
                test_scenario::ctx(&mut scenario)
            );

            return_shared(factory);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let a_coin = take_from_sender<Coin<A>>(&scenario);
            let b_coin = take_from_sender<Coin<B>>(&scenario);
            assert!(coin::value(&a_coin) > 0, 0);
            assert!(coin::value(&b_coin) > 0, 1);
            balance::destroy_for_testing(coin::into_balance(a_coin));
            balance::destroy_for_testing(coin::into_balance(b_coin));
        };

        test_scenario::end(scenario);
    }

    // --- Parametric swap scenarios ---

    fun run_swap_a_for_b_scenario(init_a: u64, init_b: u64, swap_amount: u64, expected_out: u64) {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, init_a, init_b);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(swap_amount);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 0);

            assert!(balance::value(&b_out) == expected_out, 0);
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

    fun run_swap_b_for_a_scenario(init_a: u64, init_b: u64, swap_amount: u64, expected_out: u64) {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, init_a, init_b);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_b = balance::create_for_testing<B>(swap_amount);
            let a_out = swap::swap_b_for_a(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_b, 0);

            assert!(balance::value(&a_out) == expected_out, 0);
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
    fun test_swap_scenario_1_5_10() {
        run_swap_a_for_b_scenario(5_000_000_000, 10_000_000_000, 1_000_000_000, 998_945_566);
    }

    #[test]
    fun test_swap_scenario_1_10_5() {
        run_swap_a_for_b_scenario(10_000_000_000, 5_000_000_000, 1_000_000_000, 998_876_314);
    }

    #[test]
    fun test_swap_scenario_2_5_10() {
        run_swap_a_for_b_scenario(5_000_000_000, 10_000_000_000, 2_000_000_000, 1_997_752_629);
    }

    #[test]
    fun test_swap_scenario_2_10_5() {
        run_swap_a_for_b_scenario(10_000_000_000, 5_000_000_000, 2_000_000_000, 1_997_337_694);
    }

    #[test]
    fun test_swap_scenario_1_10_10() {
        run_swap_a_for_b_scenario(10_000_000_000, 10_000_000_000, 1_000_000_000, 998_945_566);
    }

    #[test]
    fun test_swap_scenario_1_100_100() {
        run_swap_a_for_b_scenario(100_000_000_000, 100_000_000_000, 1_000_000_000, 998_995_958);
    }

    #[test]
    fun test_swap_scenario_1_1000_1000() {
        run_swap_a_for_b_scenario(1_000_000_000_000, 1_000_000_000_000, 1_000_000_000, 999_000_499);
    }

    #[test]
    fun test_reverse_swap_scenario_1_5_10() {
        run_swap_b_for_a_scenario(5_000_000_000, 10_000_000_000, 1_000_000_000, 998_876_314);
    }

    #[test]
    fun test_reverse_swap_scenario_1_10_5() {
        run_swap_b_for_a_scenario(10_000_000_000, 5_000_000_000, 1_000_000_000, 998_945_566);
    }

    // --- Multi-swap tests ---

    #[test]
    fun test_consecutive_swaps_same_direction() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100_000_000_000, 100_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a_1 = balance::create_for_testing<A>(1_000_000_000);
            let b_out_1 = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a_1, 0);
            let first_output = balance::value(&b_out_1);
            balance::destroy_for_testing(b_out_1);

            let input_a_2 = balance::create_for_testing<A>(1_000_000_000);
            let b_out_2 = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a_2, 0);
            let second_output = balance::value(&b_out_2);
            balance::destroy_for_testing(b_out_2);

            assert!(first_output == 998_995_958, 0);
            assert!(second_output == 998_995_906, 0);
            assert!(second_output < first_output, 0);

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
    fun test_swap_back_and_forth() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100_000_000_000, 100_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let (initial_a, initial_b, _) = swap::pool_balances(&pool);

            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);

            let input_a = balance::create_for_testing<A>(10_000_000_000);
            let b_out = swap::swap_a_for_b(&oracle, &pio_a, &pio_b, &clock, &mut pool, input_a, 0);

            let a_out = swap::swap_b_for_a(&oracle, &pio_a, &pio_b, &clock, &mut pool, b_out, 0);
            let a_amount = balance::value(&a_out);

            assert!(a_amount < 10_000_000_000, 0);

            balance::destroy_for_testing(a_out);

            let (final_a, final_b, _) = swap::pool_balances(&pool);
            assert!(final_a > initial_a, 0);
            assert!(final_b == initial_b, 0);

            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }
}
