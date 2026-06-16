#[test_only]
module brownfi_amm::v3_switchboard_source_test;

use brownfi_amm::pool;
use brownfi_amm::switchboard_source;

#[test]
fun test_switchboard_source_identity_constants() {
    assert!(pool::oracle_source_switchboard() == 1, 0);
    assert!(pool::oracle_source_mask_switchboard() == 2, 1);
}

#[test]
fun test_switchboard_decimal_normalizes_to_brownfi_price_scale() {
    assert!(
        switchboard_source::normalize_decimal_to_9_for_test(
            2_500_000_000_000_000_000,
            false
        ) == 2_500_000_000,
        0
    );
}
