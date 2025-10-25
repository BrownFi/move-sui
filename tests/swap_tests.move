#[test_only]
module brownfi_amm::swap_tests {
    use sui::test_scenario::{Self, next_tx, ctx, take_shared, return_shared, take_from_sender, return_to_sender};
    use sui::balance;
    use sui::coin::{Self, Coin};
    use brownfi_amm::swap;
    use brownfi_amm::pool::{Pool, LP};
    use brownfi_amm::test_helpers::{Self, A, B};

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
            let b_out = swap::swap_a_for_b(&mut pool, input_a, 0); // aborts here

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

            let input_b = balance::create_for_testing<B>(10); // aborts here
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

        // swap; (20000, 10000, 14142) -> (21300, 9302, 14142)
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

        // swap too small amount; (21300, 9302, 14142) -> (21301, 9302, 14142)
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

        // swap; (20000, 10000, 14142) -> (17706, 11300, 14142)
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

        // swap too small amount; (17706, 11300, 14142) -> (17706, 11301, 14142)
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
}

