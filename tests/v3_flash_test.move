#[test_only]
module brownfi_amm::v3_flash_test {
    use std::type_name;
    use sui::balance;
    use sui::coin;
    use sui::clock::Clock;
    use sui::event;
    use sui::object;
    use sui::test_scenario::{Self, next_tx, take_shared, return_shared, take_from_sender, return_to_sender};
    use pyth::price_info::{Self, PriceInfoObject};
    use pyth::price_feed;
    use pyth::price_identifier;
    use pyth::price;
    use pyth::i64;
    use brownfi_amm::admin;
    use brownfi_amm::events;
    use brownfi_amm::factory::{Factory, OracleCap, PauseCap, PoolCreatorCap};
    use brownfi_amm::flash;
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B};
    use brownfi_amm::oracle_gateway;
    use brownfi_amm::pool::{Self as pool, Pool};
    use brownfi_amm::swap;
    use brownfi_oracle::oracle::{Self as oracle, OracleAdapter};

    const ADDR1: address = @0xA;

    #[test]
    #[expected_failure(abort_code = flash::EFlashDisabled)]
    fun test_flash_borrow_a_aborts_when_disabled() {
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

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let (mut borrowed, receipt) = flash::borrow_a(&mut pool, &bundle, &clock, 1_000);
            let fee = flash::fee_amount(&receipt);
            if (fee > 0) {
                balance::join(&mut borrowed, balance::create_for_testing<A>(fee));
            };
            flash::repay_a(&mut pool, &bundle, &clock, borrowed, receipt);

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
    fun test_flash_borrow_and_repay_a_collects_fee() {
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
            let pause_cap = take_from_sender<PauseCap>(&scenario);

            admin::set_pool_flash_enabled(&mut pool, &pause_cap, true);
            return_to_sender<PauseCap>(&scenario, pause_cap);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let (mut borrowed, receipt) = flash::borrow_a(&mut pool, &bundle, &clock, 1_000);
            assert!(balance::value(&borrowed) == 1_000, 0);
            assert!(flash::fee_amount(&receipt) == 1, 0);
            assert!(flash::amount_due(&receipt) == 1_001, 0);
            assert!(brownfi_amm::pool::balance_a(&pool) == 999_000, 0);
            assert!(brownfi_amm::pool::balance_b(&pool) == 1_000_000, 0);

            balance::join(&mut borrowed, balance::create_for_testing<A>(flash::fee_amount(&receipt)));
            flash::repay_a(&mut pool, &bundle, &clock, borrowed, receipt);

            assert!(brownfi_amm::pool::balance_a(&pool) == 1_000_001, 0);
            assert!(brownfi_amm::pool::balance_b(&pool) == 1_000_000, 0);

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
    fun test_flash_borrow_and_repay_a_emit_events() {
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
            let pause_cap = take_from_sender<PauseCap>(&scenario);

            admin::set_pool_flash_enabled(&mut pool, &pause_cap, true);
            return_to_sender<PauseCap>(&scenario, pause_cap);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let pool_id = pool::id(&pool);
            let policy_version = oracle_gateway::bundle_policy_version(&bundle);
            let policy_digest = oracle_gateway::bundle_policy_digest(&bundle);
            let price_digest = oracle_gateway::bundle_price_digest(&bundle);
            let (mut borrowed, receipt) = flash::borrow_a(&mut pool, &bundle, &clock, 1_000);
            let fee_amount = flash::fee_amount(&receipt);
            let amount_due = flash::amount_due(&receipt);

            let borrowed_events = event::events_by_type<events::FlashBorrowed>();
            assert!(borrowed_events.length() == 1, 0);
            events::assert_flash_borrowed_for_testing(
                borrowed_events[0],
                pool_id,
                type_name::with_defining_ids<A>(),
                0,
                1_000,
                amount_due,
                fee_amount,
                policy_version,
                policy_digest,
                price_digest
            );

            balance::join(&mut borrowed, balance::create_for_testing<A>(fee_amount));
            flash::repay_a(&mut pool, &bundle, &clock, borrowed, receipt);

            let repaid_events = event::events_by_type<events::FlashRepaid>();
            assert!(repaid_events.length() == 1, 1);
            events::assert_flash_repaid_for_testing(
                repaid_events[0],
                pool_id,
                type_name::with_defining_ids<A>(),
                0,
                amount_due,
                fee_amount,
                policy_version,
                oracle_gateway::bundle_policy_digest(&bundle),
                oracle_gateway::bundle_price_digest(&bundle)
            );

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
    fun test_flash_borrow_and_repay_b_collects_fee() {
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
            let pause_cap = take_from_sender<PauseCap>(&scenario);

            admin::set_pool_flash_enabled(&mut pool, &pause_cap, true);
            return_to_sender<PauseCap>(&scenario, pause_cap);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let (mut borrowed, receipt) = flash::borrow_b(&mut pool, &bundle, &clock, 2_000);
            assert!(balance::value(&borrowed) == 2_000, 0);
            assert!(flash::borrowed_amount(&receipt) == 2_000, 0);
            assert!(flash::fee_amount(&receipt) == 2, 0);
            assert!(flash::amount_due(&receipt) == 2_002, 0);
            assert!(brownfi_amm::pool::balance_a(&pool) == 1_000_000, 0);
            assert!(brownfi_amm::pool::balance_b(&pool) == 998_000, 0);

            balance::join(&mut borrowed, balance::create_for_testing<B>(flash::fee_amount(&receipt)));
            flash::repay_b(&mut pool, &bundle, &clock, borrowed, receipt);

            assert!(brownfi_amm::pool::balance_a(&pool) == 1_000_000, 0);
            assert!(brownfi_amm::pool::balance_b(&pool) == 1_000_002, 0);

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
    fun test_flash_borrow_and_repay_a_with_coin_wrappers_collects_fee() {
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
            let pause_cap = take_from_sender<PauseCap>(&scenario);

            admin::set_pool_flash_enabled(&mut pool, &pause_cap, true);
            return_to_sender<PauseCap>(&scenario, pause_cap);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let (mut borrowed, receipt) = flash::borrow_a_with_coin(
                &mut pool,
                &bundle,
                &clock,
                1_000,
                test_scenario::ctx(&mut scenario)
            );

            balance::join(
                coin::balance_mut(&mut borrowed),
                balance::create_for_testing<A>(flash::fee_amount(&receipt))
            );
            flash::repay_a_with_coin(&mut pool, &bundle, &clock, borrowed, receipt);

            assert!(brownfi_amm::pool::balance_a(&pool) == 1_000_001, 0);
            assert!(brownfi_amm::pool::balance_b(&pool) == 1_000_000, 0);

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
    fun test_flash_borrow_and_repay_b_with_coin_wrappers_collects_fee() {
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
            let pause_cap = take_from_sender<PauseCap>(&scenario);

            admin::set_pool_flash_enabled(&mut pool, &pause_cap, true);
            return_to_sender<PauseCap>(&scenario, pause_cap);

            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let (mut borrowed, receipt) = flash::borrow_b_with_coin(
                &mut pool,
                &bundle,
                &clock,
                2_000,
                test_scenario::ctx(&mut scenario)
            );

            balance::join(
                coin::balance_mut(&mut borrowed),
                balance::create_for_testing<B>(flash::fee_amount(&receipt))
            );
            flash::repay_b_with_coin(&mut pool, &bundle, &clock, borrowed, receipt);

            assert!(brownfi_amm::pool::balance_a(&pool) == 1_000_000, 0);
            assert!(brownfi_amm::pool::balance_b(&pool) == 1_000_002, 0);

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
    #[expected_failure(abort_code = flash::EFlashPolicyMismatch)]
    fun test_flash_repay_rejects_policy_version_change() {
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
            let pause_cap = take_from_sender<PauseCap>(&scenario);

            admin::set_pool_flash_enabled(&mut pool, &pause_cap, true);
            let bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &pio_a,
                &pio_b,
                &clock,
                &pool
            );
            let (mut borrowed, receipt) = flash::borrow_a(&mut pool, &bundle, &clock, 1_000);
            balance::join(&mut borrowed, balance::create_for_testing<A>(flash::fee_amount(&receipt)));

            admin::set_pool_oracle_max_price_age(&mut pool, &oracle_cap, 30);
            return_to_sender<PauseCap>(&scenario, pause_cap);
            return_to_sender<OracleCap>(&scenario, oracle_cap);

            flash::repay_a(&mut pool, &bundle, &clock, borrowed, receipt);

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
    #[expected_failure(abort_code = flash::EFlashPriceBundleMismatch)]
    fun test_flash_repay_rejects_different_price_bundle() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        create_pyth_test_pool(&mut scenario);

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            let oracle = take_shared<OracleAdapter>(&scenario);
            let clock = take_shared<Clock>(&scenario);
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let pause_cap = take_from_sender<PauseCap>(&scenario);
            let borrow_pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                &mut scenario
            );
            let borrow_pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                100_000_000,
                0,
                &mut scenario
            );

            admin::set_pool_flash_enabled(&mut pool, &pause_cap, true);
            return_to_sender<PauseCap>(&scenario, pause_cap);

            let borrow_bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &borrow_pio_a,
                &borrow_pio_b,
                &clock,
                &pool
            );
            let (mut borrowed, receipt) = flash::borrow_a(&mut pool, &borrow_bundle, &clock, 1_000);
            balance::join(&mut borrowed, balance::create_for_testing<A>(flash::fee_amount(&receipt)));

            let alt_pio_a = new_pyth_price_info(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                100_000_000,
                0,
                &mut scenario
            );
            let alt_pio_b = new_pyth_price_info(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                200_000_000,
                0,
                &mut scenario
            );
            let repay_bundle = oracle_gateway::get_swap_price_bundle(&oracle,
                &alt_pio_a,
                &alt_pio_b,
                &clock,
                &pool
            );

            flash::repay_a(&mut pool, &repay_bundle, &clock, borrowed, receipt);

            price_info::destroy(borrow_pio_a);
            price_info::destroy(borrow_pio_b);
            price_info::destroy(alt_pio_a);
            price_info::destroy(alt_pio_b);
            return_shared(factory);
            return_shared(oracle);
            return_shared(clock);
            return_shared(pool);
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
                test_scenario::ctx(scenario)
            );

            sui::transfer::public_transfer(
                sui::coin::from_balance(lp, test_scenario::ctx(scenario)),
                ADDR1
            );
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
        price_info::new_price_info_object_for_test(info, test_scenario::ctx(scenario))
    }
}
