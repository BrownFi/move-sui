module SupraOracle::price_data_pull_v2 {
    use sui::clock::Clock;
    use sui::object::UID;
    use sui::tx_context::TxContext;
    use SupraOracle::SupraSValueFeed::OracleHolder;
    use supra_validator::validator_v2::DkgState;

    const ELocalAbiStub: u64 = 0;

    struct PriceData has copy, drop {}
    struct MerkleRootHash has key, store { id: UID }

    public fun price_data_split(_price_data: &PriceData): (u32, u128, u64, u16, u64) {
        abort ELocalAbiStub
    }

    public fun verify_oracle_proof(
        _dkg_state: &DkgState,
        _oracle_holder: &mut OracleHolder,
        _merkle_root_hash: &mut MerkleRootHash,
        _clock: &Clock,
        _bytes: vector<u8>,
        _ctx: &mut TxContext
    ): vector<PriceData> {
        abort ELocalAbiStub
    }
}
