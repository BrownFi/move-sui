#[test_only]
module brownfi_amm::swap_test {
    use sui::test_scenario::{Self, next_tx, take_shared, return_shared, take_from_sender};
    use sui::balance;
    use sui::coin::{Self, Coin};
    use brownfi_amm::swap;
    use brownfi_amm::pool::{Pool, LP};
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B};

    const ADDR1: address = @0xA;
    const ADDR2: address = @0xB;

    #[test]
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_swap_a_for_b_aborts_on_zero_input_a() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::zero<A>();
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_swap_b_for_a_aborts_on_zero_input_b() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_b = balance::zero<B>();
            let a_out = swap::swap_b_for_a(&mut pool, input_b, 0);

            balance::destroy_for_testing(a_out);

            return_shared(pool);
        }; 

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::ENoLiquidity)]
    fun test_swap_a_for_b_aborts_on_zero_pool_balances() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);

            let (a_out, b_out) = swap::remove_liquidity(&mut pool, coin::into_balance(lp_coin), 0, 0);
            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let input_a = balance::create_for_testing<A>(10);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::ENoLiquidity)]
    fun test_swap_b_for_a_aborts_on_zero_pool_balances() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);

            let (a_out, b_out) = swap::remove_liquidity(&mut pool, coin::into_balance(lp_coin), 0, 0);
            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let input_b = balance::create_for_testing<B>(10);
            let a_out = swap::swap_b_for_a(&mut pool, input_b, 0);

            balance::destroy_for_testing(a_out);

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

            let input_a = balance::create_for_testing<A>(1300);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 608);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 21300 && amount_b == 9392 && lp_supply == 14142, 0);
            assert!(balance::value(&b_out) == 608, 0);

            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(1);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 21301 && amount_b == 9392 && lp_supply == 14142, 0);
            assert!(balance::value(&b_out) == 0, 0);

            balance::destroy_for_testing(b_out);

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

            let input_b = balance::create_for_testing<B>(1300);
            let a_out = swap::swap_b_for_a(&mut pool, input_b, 2294);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 17706 && amount_b == 11300 && lp_supply == 14142, 0);
            assert!(balance::value(&a_out) == 2294, 0);

            balance::destroy_for_testing(a_out);

            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_b = balance::create_for_testing<B>(1);
            let a_out = swap::swap_b_for_a(&mut pool, input_b, 0);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 17706 && amount_b == 11301 && lp_supply == 14142, 0);
            assert!(balance::value(&a_out) == 0, 0);

            balance::destroy_for_testing(a_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_scenario_1_5_10() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 5_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000_000_000);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            assert!(balance::value(&b_out) == 1_662_497_915, 0);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_scenario_1_10_5() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 5_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000_000_000);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            assert!(balance::value(&b_out) == 453_305_446, 0);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_scenario_2_5_10() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 5_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(2_000_000_000);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            assert!(balance::value(&b_out) == 2_851_015_155, 0);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_scenario_2_10_5() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 5_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(2_000_000_000);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            assert!(balance::value(&b_out) == 831_248_957, 0);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_scenario_1_10_10() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000_000_000);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            assert!(balance::value(&b_out) == 906_610_893, 0);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_scenario_1_100_100() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100_000_000_000, 100_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000_000_000);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            assert!(balance::value(&b_out) == 987_158_034, 0);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_swap_scenario_1_1000_1000() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000_000_000, 1_000_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(1_000_000_000);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            assert!(balance::value(&b_out) == 996_006_981, 0);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_reverse_swap_scenario_1_5_10() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 5_000_000_000, 10_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_b = balance::create_for_testing<B>(1_000_000_000);
            let a_out = swap::swap_b_for_a(&mut pool, input_b, 0);

            assert!(balance::value(&a_out) == 453_305_446, 0);
            balance::destroy_for_testing(a_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_reverse_swap_scenario_1_10_5() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 10_000_000_000, 5_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_b = balance::create_for_testing<B>(1_000_000_000);
            let a_out = swap::swap_b_for_a(&mut pool, input_b, 0);

            assert!(balance::value(&a_out) == 1_662_497_915, 0);
            balance::destroy_for_testing(a_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_consecutive_swaps_same_direction() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100_000_000_000, 100_000_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a_1 = balance::create_for_testing<A>(1_000_000_000);
            let b_out_1 = swap::swap_a_for_b(&mut pool, input_a_1, 0);
            let first_output = balance::value(&b_out_1);
            balance::destroy_for_testing(b_out_1);

            let input_a_2 = balance::create_for_testing<A>(1_000_000_000);
            let b_out_2 = swap::swap_a_for_b(&mut pool, input_a_2, 0);
            let second_output = balance::value(&b_out_2);
            balance::destroy_for_testing(b_out_2);

            assert!(second_output < first_output, 0);

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

            let input_a = balance::create_for_testing<A>(10_000_000_000);
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0);

            let a_out = swap::swap_b_for_a(&mut pool, b_out, 0);
            let a_amount = balance::value(&a_out);

            assert!(a_amount < 10_000_000_000, 0);

            balance::destroy_for_testing(a_out);

            let (final_a, final_b, _) = swap::pool_balances(&pool);
            assert!(final_a > initial_a, 0);
            assert!(final_b == initial_b, 0);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }
}
