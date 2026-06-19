module SupraOracle::SupraSValueFeed {

    use sui::object::UID;

    const ELocalAbiStub: u64 = 0;

    struct OracleHolder has key, store { id: UID }

    struct Price has drop {
        pair: u32,
        value: u128,
        decimal: u16,
        timestamp: u128,
        round: u64
    }

    /// It will return the priceFeedData value for that particular tradingPair
    public fun get_price(_oracle_holder: &OracleHolder, _pair: u32): (u128, u16, u128, u64) {
        abort ELocalAbiStub
    }

    /// It will return the priceFeedData value for that multiple tradingPair
    public fun get_prices(_oracle_holder: &OracleHolder, _pairs: vector<u32>): vector<Price> {
        abort ELocalAbiStub
    }

    /// It will return the extracted price value for the Price struct
    public fun extract_price(_price: &Price): (u32, u128, u16, u128, u64) {
        abort ELocalAbiStub
    }

    /// Derived pairs are the one whose price info is calculated using two compatible pairs using either multiplication or division.
    /// Return values in tuple
    ///     1. derived_price : u128
    ///     2. decimal : u16
    ///     3. round-difference : u64
    ///     4. `"base" as compared to "quote"` : u8 (Where 0=>LESS, 1=>GREATER, 2=>EQUAL)
    public fun get_derived_price(
        _oracle_holder: &OracleHolder,
        _pair_id1: u32,
        _pair_id2: u32,
        _operation: u8
    ): (u128, u16, u64, u8) {
        abort ELocalAbiStub
    }
}
