#[test_only]
module brownfi_amm::v3_supra_source_test;

use brownfi_amm::pool;
use brownfi_amm::supra_source;

#[test]
fun test_supra_source_identity_constants() {
    assert!(pool::oracle_source_supra() == 3, 0);
    assert!(pool::oracle_source_mask_supra() == 8, 1);
}

#[test]
fun test_supra_pair_id_config_uses_bcs_u32() {
    assert!(
        supra_source::pair_id_config(0x01020304) == vector[4u8, 3u8, 2u8, 1u8],
        0
    );
}

#[test]
fun test_supra_price_normalizes_to_brownfi_price_scale() {
    assert!(supra_source::normalize_price_to_9_for_test(25_000_000, 8) == 250_000_000, 0);
    assert!(supra_source::normalize_price_to_9_for_test(2_500_000_000, 9) == 2_500_000_000, 1);
    assert!(
        supra_source::normalize_price_to_9_for_test(
            2_500_000_000_000,
            12
        ) == 2_500_000_000,
        2
    );
}
