module brownfi_usdt_test_coin::usdt {
    use std::option;
    use sui::coin::{Self, TreasuryCap};
    use sui::transfer;
    use sui::tx_context::{Self, TxContext};

    const INITIAL_COIN_AMOUNT: u64 = 1_000_000_000_000_000;

    public struct USDT has drop {}

    #[allow(deprecated_usage)]
    fun init(witness: USDT, ctx: &mut TxContext) {
        let sender = tx_context::sender(ctx);
        let (mut treasury, metadata) = coin::create_currency(
            witness,
            9,
            b"USDT",
            b"BrownFi Test USDT",
            b"BrownFi V3 testnet USDT token",
            option::none(),
            ctx
        );
        let init_coin = coin::mint(&mut treasury, INITIAL_COIN_AMOUNT, ctx);
        let input_coin = coin::mint(&mut treasury, INITIAL_COIN_AMOUNT, ctx);

        transfer::public_freeze_object(metadata);
        transfer::public_transfer(init_coin, sender);
        transfer::public_transfer(input_coin, sender);
        transfer::public_transfer(treasury, sender);
    }

    public fun mint(
        treasury: &mut TreasuryCap<USDT>,
        amount: u64,
        recipient: address,
        ctx: &mut TxContext
    ) {
        transfer::public_transfer(coin::mint(treasury, amount, ctx), recipient);
    }

    public fun type_name(): vector<u8> {
        b"USDT"
    }

    public fun decimals(): u8 {
        9
    }
}
