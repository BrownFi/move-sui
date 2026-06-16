#[test_only]
module brownfi_amm::helpers_test {
    use sui::test_scenario::{Self, Scenario, next_tx, ctx};
    use sui::balance;
    use sui::clock::{Self, Clock};
    use brownfi_amm::factory::{Self, Factory, PoolCreatorCap};
    use brownfi_amm::swap;
    use brownfi_oracle::oracle::{Self, OracleAdapter};
    use pyth::price_info::{Self, PriceInfoObject};
    use pyth::price_feed;
    use pyth::price_identifier;
    use pyth::price;
    use pyth::i64;

    // Test coin types
    public struct A has drop {}
    public struct B has drop {}
    public struct C has drop {}

    /// Create a mock PriceInfoObject with a dummy price feed
    public fun create_mock_price_info_object(feed_id: vector<u8>, ctx: &mut TxContext): PriceInfoObject {
        let dummy_price = price::new(i64::new(1, false), 1, i64::new(0, false), 0);
        let dummy_ema = price::new(i64::new(1, false), 1, i64::new(0, false), 0);
        let feed = price_feed::new(
            price_identifier::from_byte_vec(feed_id),
            dummy_price,
            dummy_ema
        );
        let info = price_info::new_price_info(0, 0, feed);
        price_info::new_price_info_object_for_test(info, ctx)
    }

    /// Initialize test scenario with factory, oracle, clock, and mock PriceInfoObjects deployed
    public fun init_test_scenario(sender: address): Scenario {
        let mut scenario = test_scenario::begin(sender);

        // Create factory
        next_tx(&mut scenario, sender);
        {
            factory::create_and_share(ctx(&mut scenario));
        };

        // Create oracle
        next_tx(&mut scenario, sender);
        {
            oracle::create_and_share(15, ctx(&mut scenario)); // 15 seconds max staleness
        };

        // Create clock
        next_tx(&mut scenario, sender);
        {
            let clock = clock::create_for_testing(ctx(&mut scenario));
            clock::share_for_testing(clock);
        };

        // Configure oracle for test tokens and create mock PriceInfoObjects
        next_tx(&mut scenario, sender);
        {
            let mut oracle_adapter = test_scenario::take_shared<OracleAdapter>(&scenario);

            let price_feed_a = sui::object::id_from_address(@0xAAAA);
            let price_feed_b = sui::object::id_from_address(@0xBBBB);
            let price_feed_c = sui::object::id_from_address(@0xCCCC);

            oracle::configure_token<A>(&mut oracle_adapter, b"test", price_feed_a, vector[]);
            oracle::configure_token<B>(&mut oracle_adapter, b"test", price_feed_b, vector[]);
            oracle::configure_token<C>(&mut oracle_adapter, b"test", price_feed_c, vector[]);

            test_scenario::return_shared(oracle_adapter);
        };

        // Create and share mock PriceInfoObjects
        next_tx(&mut scenario, sender);
        {
            // Use distinct 32-byte feed IDs for each token
            let pio_a = create_mock_price_info_object(
                x"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
                ctx(&mut scenario)
            );
            let pio_b = create_mock_price_info_object(
                x"bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb",
                ctx(&mut scenario)
            );
            transfer::public_share_object(pio_a);
            transfer::public_share_object(pio_b);
        };

        next_tx(&mut scenario, sender);
        scenario
    }

    /// Create a pool with given initial balances
    public fun create_test_pool(scenario: &mut Scenario, init_a: u64, init_b: u64) {
        next_tx(scenario, @0xA);
        {
            let mut factory = test_scenario::take_shared<Factory>(scenario);
            let oracle = test_scenario::take_shared<OracleAdapter>(scenario);
            let clock = test_scenario::take_shared<Clock>(scenario);
            let pio_a = test_scenario::take_shared<PriceInfoObject>(scenario);
            let pio_b = test_scenario::take_shared<PriceInfoObject>(scenario);
            let pool_creator_cap = test_scenario::take_from_sender<PoolCreatorCap>(scenario);

            let init_a = balance::create_for_testing<A>(init_a);
            let init_b = balance::create_for_testing<B>(init_b);

            let lp = swap::create_pool_for_testing(
                &mut factory,
                &pool_creator_cap,
                &oracle,
                &pio_a,
                &pio_b,
                &clock,
                init_a,
                init_b,
                9, // decimals_a
                9, // decimals_b
                ctx(scenario)
            );
            sui::transfer::public_transfer(sui::coin::from_balance(lp, ctx(scenario)), @0xA);

            test_scenario::return_to_sender(scenario, pool_creator_cap);
            test_scenario::return_shared(factory);
            test_scenario::return_shared(oracle);
            test_scenario::return_shared(clock);
            test_scenario::return_shared(pio_a);
            test_scenario::return_shared(pio_b);
        };
    }
}
