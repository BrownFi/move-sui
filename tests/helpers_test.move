#[test_only]
module brownfi_amm::helpers_test {
    use sui::test_scenario::{Self, Scenario, next_tx, ctx};
    use sui::balance;
    use sui::clock::{Self, Clock};
    use brownfi_amm::factory::{Self, Factory};
    use brownfi_amm::swap;
    // Pool type is used in create_test_pool function signature via swap::create_pool return type
    use brownfi_oracle::oracle::{Self, OracleAdapter};

    // Test coin types
    public struct A has drop {}
    public struct B has drop {}
    public struct C has drop {}

    /// Initialize test scenario with factory, oracle, and clock deployed
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
        
        // Configure oracle for test tokens
        next_tx(&mut scenario, sender);
        {
            let mut oracle_adapter = test_scenario::take_shared<OracleAdapter>(&scenario);
            let clock_obj = test_scenario::take_shared<Clock>(&scenario);
            
            // Configure test tokens with mock oracle
            // Using test source type that returns fixed price of 1.0 in Q64 format
            let price_feed_a = sui::object::id_from_address(@0xAAAA);
            let price_feed_b = sui::object::id_from_address(@0xBBBB);
            let price_feed_c = sui::object::id_from_address(@0xCCCC);
            
            oracle::configure_token<A>(&mut oracle_adapter, b"test", price_feed_a, vector::empty());
            oracle::configure_token<B>(&mut oracle_adapter, b"test", price_feed_b, vector::empty());
            oracle::configure_token<C>(&mut oracle_adapter, b"test", price_feed_c, vector::empty());
            
            test_scenario::return_shared(clock_obj);
            test_scenario::return_shared(oracle_adapter);
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
            
            let init_a = balance::create_for_testing<A>(init_a);
            let init_b = balance::create_for_testing<B>(init_b);

            let lp = swap::create_pool(
                &mut factory,
                &oracle,
                &clock,
                init_a,
                init_b,
                9, // decimals_a
                9, // decimals_b
                ctx(scenario)
            );
            sui::transfer::public_transfer(sui::coin::from_balance(lp, ctx(scenario)), @0xA);

            test_scenario::return_shared(factory);
            test_scenario::return_shared(oracle);
            test_scenario::return_shared(clock);
        };
    }
}
