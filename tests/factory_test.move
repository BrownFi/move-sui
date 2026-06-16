#[test_only]
module brownfi_amm::factory_test {
    use sui::test_scenario::{Self, next_tx, ctx, take_shared, return_shared, take_from_sender, return_to_sender};
    use sui::tx_context::sender;
    use sui::balance;
    use sui::coin;
    use sui::clock::Clock;
    use brownfi_amm::swap;
    use brownfi_amm::pool::Pool;
    use brownfi_amm::factory::{Self as factory_module, Factory, PoolCreatorCap};
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B, C};
    use brownfi_oracle::oracle::OracleAdapter;
    use pyth::price_info::PriceInfoObject;

    const ADDR1: address = @0xA;

    #[test]
    #[expected_failure(abort_code = brownfi_amm::factory::EUnauthorized)]
    fun test_create_pool_aborts_on_wrong_creator_cap_factory() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);

        next_tx(&mut scenario, ADDR1);
        {
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);
            let mut other_factory = factory_module::test_new(ctx);

            let init_a = balance::create_for_testing<A>(6_000_000_000);
            let init_b = balance::create_for_testing<B>(5_000_000_000);

            let lp = swap::create_pool(
                &mut other_factory,
                &pool_creator_cap,
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                init_a,
                init_b,
                9,
                9,
                ctx
            );
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
            factory_module::test_destroy_empty(other_factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EZeroInput)]
    fun test_create_pool_aborts_on_init_a_zero() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::zero<A>();
            let init_b = balance::create_for_testing<B>(100);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 9, 9, ctx);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
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
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(100);
            let init_b = balance::zero<B>();

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 9, 9, ctx);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
            return_shared(factory);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::EUnsupportedTokenDecimals)]
    fun test_create_pool_aborts_on_unsupported_token_decimals() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(20_000_000_000);
            let init_b = balance::create_for_testing<B>(20_000);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 19, 9, ctx);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
            return_shared(factory);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = swap::ENoLiquidity)]
    fun test_create_pool_aborts_below_documented_initial_value_floor() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(5_000_000_000);
            let init_b = balance::create_for_testing<B>(4_999_999_999);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 9, 9, ctx);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
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
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(6_000_000_000);
            let init_b = balance::create_for_testing<B>(5_000_000_000);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 9, 9, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(factory);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(2000);
            let init_b = balance::create_for_testing<B>(1000);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 9, 9, ctx);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
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
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(200);
            let init_b = balance::create_for_testing<A>(100);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 0, 0, ctx);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
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
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<B>(200);
            let init_b = balance::create_for_testing<A>(100);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 0, 0, ctx);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
            return_shared(factory);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_create_pool_mints_initial_lp_from_value_and_locks_minimum() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(6_000_000_000);
            let init_b = balance::create_for_testing<B>(5_000_000_000);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 9, 9, ctx);
            assert!(balance::value(&lp) == 10_999_999_000, 0);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(factory);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);
            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);

            assert!(amount_a == 6_000_000_000, 0);
            assert!(amount_b == 5_000_000_000, 0);
            assert!(lp_supply == 11_000_000_000, 0);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_create_pool() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(200);
            let init_b = balance::create_for_testing<B>(100);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 0, 0, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(factory);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);

            let (amount_a, amount_b, lp_supply) = swap::pool_balances(&pool);
            assert!(amount_a == 200, 0);
            assert!(amount_b == 100, 0);
            assert!(lp_supply == 300_000_000_000, 0);

            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let mut factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let pio_a = take_shared<PriceInfoObject>(&scenario);
            let pio_b = take_shared<PriceInfoObject>(&scenario);
            let pool_creator_cap = take_from_sender<PoolCreatorCap>(&scenario);
            let ctx = ctx(&mut scenario);

            let init_a = balance::create_for_testing<A>(200);
            let init_b = balance::create_for_testing<C>(100);

            let lp = swap::create_pool(&mut factory, &pool_creator_cap, &oracle, &pio_a, &pio_b, &clock, init_a, init_b, 0, 0, ctx);
            transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

            return_to_sender(&scenario, pool_creator_cap);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pio_a);
            return_shared(pio_b);
            return_shared(factory);
        };

        test_scenario::end(scenario);
    }
}
