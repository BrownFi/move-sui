module brownfi_launch_test_coins::coin_a {
    use sui::coin::{Self, TreasuryCap};
    use sui::coin_registry;
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const INITIAL_COIN_AMOUNT: u64 = 1_000_000_000_000_000;

    public struct COIN_A has drop {}

    fun init(witness: COIN_A, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let (builder, mut treasury) = coin_registry::new_currency_with_otw(
            witness,
            9,
            b"BFV3A".to_string(),
            b"BrownFi V3 Launch Test A".to_string(),
            b"BrownFi V3 launch validation token A".to_string(),
            b"".to_string(),
            ctx
        );
        let init_coin = coin::mint(&mut treasury, INITIAL_COIN_AMOUNT, ctx);
        let input_coin = coin::mint(&mut treasury, INITIAL_COIN_AMOUNT, ctx);

        coin_registry::finalize_and_delete_metadata_cap(builder, ctx);
        transfer::public_transfer(init_coin, sender);
        transfer::public_transfer(input_coin, sender);
        transfer::public_transfer(treasury, sender);
    }

    public fun mint(
        treasury: &mut TreasuryCap<COIN_A>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        transfer::public_transfer(coin::mint(treasury, amount, ctx), recipient);
    }

    public fun type_name(): vector<u8> {
        b"COIN_A"
    }

    public fun decimals(): u8 {
        9
    }
}
