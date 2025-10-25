#[test_only]
module brownfi_amm::test_helpers {
    use sui::test_scenario::{Self, Scenario, next_tx, ctx};
    use sui::tx_context::sender;
    use sui::balance;
    use sui::coin;
    use brownfi_amm::swap;
    use brownfi_amm::factory::Factory;

    // Test coin types
    public struct A has drop {}
    public struct B has drop {}
    public struct C has drop {}

    /// Initialize test scenario with factory deployed
    public fun init_test_scenario(sender: address): Scenario {
        let mut scenario = test_scenario::begin(sender);
        {
            let ctx = ctx(&mut scenario);
            swap::test_init(ctx);
        };
        next_tx(&mut scenario, sender);
        scenario
    }

    /// Create a pool with given initial balances
    public fun create_test_pool(scenario: &mut Scenario, init_a: u64, init_b: u64) {
        let mut factory = test_scenario::take_shared<Factory>(scenario);
        let ctx = ctx(scenario);

        let init_a = balance::create_for_testing<A>(init_a);
        let init_b = balance::create_for_testing<B>(init_b);

        let lp = swap::create_pool(&mut factory, init_a, init_b, ctx);
        transfer::public_transfer(coin::from_balance(lp, ctx), sender(ctx));

        test_scenario::return_shared(factory);
    }
}
