#[test_only]
module brownfi_amm::v3_supra_pull_source_test;

use brownfi_amm::pool;
use brownfi_amm::supra_pull_source;

#[test]
fun test_supra_pull_source_identity_constants() {
    assert!(pool::oracle_source_supra() == 3, 0);
    assert!(pool::oracle_source_mask_supra() == 8, 1);
}

#[test]
fun test_supra_pull_pair_id_config_uses_bcs_u32() {
    assert!(
        supra_pull_source::pair_id_config(0x01020304) == vector[4u8, 3u8, 2u8, 1u8],
        0
    );
}

#[test]
fun test_supra_pull_price_normalizes_to_brownfi_price_scale() {
    assert!(supra_pull_source::normalize_price_to_9_for_test(25_000_000, 8) == 250_000_000, 0);
    assert!(supra_pull_source::normalize_price_to_9_for_test(2_500_000_000, 9) == 2_500_000_000, 1);
    assert!(
        supra_pull_source::normalize_price_to_9_for_test(
            2_500_000_000_000,
            12
        ) == 2_500_000_000,
        2
    );
}

#[test]
fun test_supra_pull_timestamp_seconds_normalizes_to_ms() {
    assert!(
        supra_pull_source::timestamp_seconds_to_ms_for_test(1_716_000_001) == 1_716_000_001_000,
        0
    );
}
