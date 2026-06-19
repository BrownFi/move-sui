#[test_only]
module brownfi_amm::math_v3_test {
    use brownfi_amm::math;

    #[test]
    fun test_mul_div_down_u128_rounds_toward_zero() {
        assert!(math::mul_div_down_u128(10, 3, 5) == 6, 0);
        assert!(math::mul_div_down_u128(10, 3, 4) == 7, 0);
        assert!(math::mul_div_down_u128(0, 3, 4) == 0, 0);
    }

    #[test]
    fun test_mul_div_up_u128_rounds_up_only_when_needed() {
        assert!(math::mul_div_up_u128(10, 3, 5) == 6, 0);
        assert!(math::mul_div_up_u128(10, 3, 4) == 8, 0);
        assert!(math::mul_div_up_u128(0, 3, 4) == 0, 0);
    }

    #[test]
    fun test_mul_div_to_u64_helpers() {
        assert!(math::mul_div_down_to_u64(10, 3, 4) == 7, 0);
        assert!(math::mul_div_up_to_u64(10, 3, 4) == 8, 0);
    }

    #[test]
    fun test_parse_amount_from_standard_decimals_up_rounds_required_input() {
        assert!(math::parse_amount_from_standard_decimals_up(6, 1_000, 9) == 1, 0);
        assert!(math::parse_amount_from_standard_decimals_up(6, 1_001, 9) == 2, 0);
        assert!(math::parse_amount_from_standard_decimals_up(12, 1_000, 9) == 1_000_000, 0);
    }

    #[test]
    fun test_parse_amount_to_standard_decimals_checks_multiply_boundary() {
        assert!(math::parse_amount_to_standard_decimals(0, 18_446_744_073, 9) == 18_446_744_073_000_000_000, 0);
    }

    #[test]
    #[expected_failure(abort_code = 0)]
    fun test_parse_amount_to_standard_decimals_aborts_with_module_overflow_code() {
        math::parse_amount_to_standard_decimals(0, 18_446_744_074, 9);
    }

    #[test]
    #[expected_failure(abort_code = 0)]
    fun test_u256_to_u64_checked_aborts_above_u64_max() {
        math::u256_to_u64_checked(18_446_744_073_709_551_616u256);
    }

    #[test]
    fun test_pseudo_in_from_actual_uses_v3_fee_denominator() {
        let precision = 100_000_000u128;

        assert!(math::pseudo_in_from_actual_u128(100_100, 100_000, precision) == 100_000, 0);
        assert!(math::pseudo_in_from_actual_u128(100_000, 100_000, precision) == 99_900, 0);
        assert!(math::pseudo_in_from_actual_u128(10, 100_000, precision) == 9, 0);
        assert!(math::pseudo_in_from_actual_u128(10, 0, precision) == 10, 0);
    }

    #[test]
    fun test_fee_from_pseudo_input_uses_v3_rounding() {
        let precision = 100_000_000u128;

        assert!(math::fee_from_pseudo_input_u128(100_000, 100_000, precision) == 100, 0);
        assert!(math::fee_from_pseudo_input_u128(999_000_999, 100_000, precision) == 999_000, 0);
        assert!(math::fee_from_pseudo_input_u128(9, 100_000, precision) == 0, 0);
    }
}
