#[test_only]
module brownfi_amm::v3_stork_source_test;

use brownfi_amm::pool;
use brownfi_amm::stork_source;

#[test]
fun test_stork_source_identity_constants() {
    assert!(pool::oracle_source_stork() == 2, 0);
    assert!(pool::oracle_source_mask_stork() == 4, 1);
}

#[test]
fun test_stork_quantized_value_normalizes_to_brownfi_price_scale() {
    assert!(
        stork_source::normalize_quantized_to_9_for_test(
            2_500_000_000_000_000_000,
            false
        ) == 2_500_000_000,
        0
    );
}
