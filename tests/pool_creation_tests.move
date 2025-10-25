#[test_only]
module brownfi_amm::pool_creation_tests {
    use sui::test_scenario::{Self, next_tx, ctx, take_shared, return_shared};
    use sui::tx_context::sender;
    use sui::balance;
    use sui::coin;
    use brownfi_amm::swap;
    use brownfi_amm::pool::Pool;
    use brownfi_amm::factory::Factory;
    use brownfi_amm::test_helpers::{Self, A, B, C};

    const ADDR1: address = @0xA;

    #[test]
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_create_pool_aborts_on_init_a_zero() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::zero<A>();
            let init_b = balance::create_for_testing<B>(100);

            let lp = swap::create_pool(&mut factory, init_a, init_b, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_shared(factory);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_create_pool_aborts_on_init_b_zero() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(100);
            let init_b = balance::zero<B>();

            let lp = swap::create_pool(&mut factory, init_a, init_b, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_shared(factory);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = brownfi_amm::factory::EPoolAlreadyExists)]
    fun test_create_pool_aborts_on_duplicate_pair() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(200);
            let init_b = balance::create_for_testing<B>(100);

            let lp = swap::create_pool(&mut factory, init_a, init_b, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_shared(factory);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(200);
            let init_b = balance::create_for_testing<B>(100);

            let lp = swap::create_pool(&mut factory, init_a, init_b, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_shared(factory);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = brownfi_amm::factory::EInvalidPair)]
    fun test_create_pool_aborts_on_same_type() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(200);
            let init_b = balance::create_for_testing<A>(100);

            let lp = swap::create_pool(&mut factory, init_a, init_b, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_shared(factory);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = brownfi_amm::factory::EInvalidPair)]
    fun test_create_pool_aborts_on_wrong_order() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<B>(200);
            let init_b = balance::create_for_testing<A>(100);

            let lp = swap::create_pool(&mut factory, init_a, init_b, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_shared(factory);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_create_pool() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        {
            let ctx = ctx(&mut scenario);
            swap::test_init(ctx);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(200);
            let init_b = balance::create_for_testing<B>(100);

            let lp = swap::create_pool(&mut factory, init_a, init_b, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_shared(factory);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 200, 0);
            assert!(amount_b == 100, 0);
            assert!(lp_supply == 141, 0);

            let fee_points = swap::pool_fees(&pool);
            assert!(fee_points == 30, 0);

            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(200);
            let init_b = balance::create_for_testing<C>(100);

            let lp = swap::create_pool(&mut factory, init_a, init_b, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_shared(factory);
        };

        test_scenario::end(scenario);
    }
}
