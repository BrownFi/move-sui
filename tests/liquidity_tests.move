#[test_only]
module brownfi_amm::liquidity_tests {
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
    fun test_add_liquidity_aborts_on_zero_input_a() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::zero<A>();
            let input_b = balance::create_for_testing<B>(10);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&mut pool, input_a, input_b, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_add_liquidity_aborts_on_zero_input_b() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(10);
            let input_b = balance::zero<B>();
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&mut pool, input_a, input_b, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_liquidity_on_empty_pool() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let lp_coin = take_from_sender<Coin<LP<A,B>>>(&scenario);
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, coin::into_balance(lp_coin), 0, 0);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 0 && amount_b == 0 && lp_supply == 0, 0);

            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(200);
            let input_b = balance::create_for_testing<B>(100);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&mut pool, input_a, input_b, 141);

            assert!(balance::value(&remaining_a) == 0, 0);
            assert!(balance::value(&remaining_b) == 0, 0);
            assert!(balance::value(&lp) == 141, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);
            
            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 200 && amount_b == 100 && lp_supply == 141, 0);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_add_liquidity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 50);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(200);
            let input_b = balance::create_for_testing<B>(100);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&mut pool, input_a, input_b, 140);

            assert!(balance::value(&remaining_a) == 0, 0);
            assert!(balance::value(&remaining_b) == 0, 0);
            assert!(balance::value(&lp) == 140, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 300 && amount_b == 150 && lp_supply == 210, 0);

            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(110);
            let input_b = balance::create_for_testing<B>(50);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&mut pool, input_a, input_b, 70);

            assert!(balance::value(&remaining_a) == 10, 0);
            assert!(balance::value(&remaining_b) == 0, 0);
            assert!(balance::value(&lp) == 70, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 400 && amount_b == 200 && lp_supply == 280, 0);

            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(100);
            let input_b = balance::create_for_testing<B>(60);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&mut pool, input_a, input_b, 70);

            assert!(balance::value(&remaining_a) == 0, 0);
            assert!(balance::value(&remaining_b) == 10, 0);
            assert!(balance::value(&lp) == 70, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 500 && amount_b == 250 && lp_supply == 350, 0);

            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(1);
            let input_b = balance::create_for_testing<B>(1);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&mut pool, input_a, input_b, 0);

            assert!(balance::value(&remaining_a) == 0, 0);
            assert!(balance::value(&remaining_b) == 0, 0);
            assert!(balance::value(&lp) == 0, 0);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 501 && amount_b == 251 && lp_supply == 350, 0);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    } 

    #[test]
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_add_liquidity_aborts_on_min_lp_out() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR2);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let input_a = balance::create_for_testing<A>(200);
            let input_b = balance::create_for_testing<B>(200);
            let (remaining_a, remaining_b, lp) = swap::add_liquidity(&mut pool, input_a, input_b, 201);

            balance::destroy_for_testing(remaining_a);
            balance::destroy_for_testing(remaining_b);
            balance::destroy_for_testing(lp);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_remove_liquidity_aborts_on_zero_input_lp() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);

            let lp = balance::zero();
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp, 0, 0);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_remove_liquidity() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 13);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let mut lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp_coin) == 36, 0);

            let ctx = ctx(&mut scenario);
            let lp_in = coin::into_balance(coin::split(&mut lp_coin, 13, ctx));
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 36, 4);

            assert!(balance::value(&a_out) == 36, 0);
            assert!(balance::value(&b_out) == 4, 0);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 64 && amount_b == 9 && lp_supply == 23, 0);

            return_shared(pool);
            return_to_sender(&scenario, lp_coin);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let mut lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp_coin) == 23, 0);

            let ctx = ctx(&mut scenario);
            let lp_in = coin::into_balance(coin::split(&mut lp_coin, 1, ctx));
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 2, 0);

            assert!(balance::value(&a_out) == 2, 0);
            assert!(balance::value(&b_out) == 0, 0);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 62 && amount_b == 9 && lp_supply == 22, 0);

            return_shared(pool);
            return_to_sender(&scenario, lp_coin);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            assert!(coin::value(&lp_coin) == 22, 0);

            let lp_in = coin::into_balance(lp_coin);
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 62, 9);

            assert!(balance::value(&a_out) == 62, 0);
            assert!(balance::value(&b_out) == 9, 0);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 0 && amount_b == 0 && lp_supply == 0, 0);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EExcessiveSlippage)]
    fun test_remove_liquidity_aborts_on_min_a_out() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let mut lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            let ctx = ctx(&mut scenario);

            let lp_in = coin::into_balance(coin::split(&mut lp_coin, 50, ctx));
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 51, 50);

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
        test_helpers::create_test_pool(&mut scenario, 100, 100);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let mut lp_coin = take_from_sender<Coin<LP<A, B>>>(&scenario);
            let ctx = ctx(&mut scenario);

            let lp_in = coin::into_balance(coin::split(&mut lp_coin, 50, ctx));
            let (a_out, b_out) = swap::remove_liquidity(&mut pool, lp_in, 50, 51);

            balance::destroy_for_testing(a_out);
            balance::destroy_for_testing(b_out);

            return_shared(pool);
            return_to_sender(&scenario, lp_coin);
        };

        test_scenario::end(scenario);
    }
}
