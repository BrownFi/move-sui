#[test_only]
module brownfi_amm::v3_config_test {
    use sui::event;
    use sui::object;
    use sui::test_scenario::{Self, next_tx, take_shared, return_shared, take_from_sender, return_to_sender};
    use brownfi_amm::admin;
    use brownfi_amm::events;
    use brownfi_amm::factory::{AmmCap, Factory, FeeCap, OracleCap, PauseCap, RiskCap};
    use brownfi_amm::helpers_test::{Self as test_helpers, A, B};
    use brownfi_amm::math;
    use brownfi_amm::pool::Pool;

    const ADDR1: address = @0xA;

    #[test]
    fun test_v3_default_pool_config() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let pool = take_shared<Pool<A, B>>(&scenario);

            assert!(brownfi_amm::pool::quote_token_index(&pool) == 0, 0);
            assert!(brownfi_amm::pool::fee(&pool) == 100_000, 0);
            assert!(brownfi_amm::pool::fee_split(&pool) == 0, 0);
            assert!(brownfi_amm::pool::k_b(&pool) == math::q32() / 1000, 0);
            assert!(brownfi_amm::pool::k_q(&pool) == math::q32() / 1000, 0);
            assert!(brownfi_amm::pool::lambda(&pool) == 0, 0);
            assert!(brownfi_amm::pool::gamma(&pool) == 80_000_000, 0);
            assert!(brownfi_amm::pool::pyth_weight(&pool) == 50_000_000, 0);
            assert!(brownfi_amm::pool::oracle_policy_version(&pool) == 0, 0);
            assert!(brownfi_amm::pool::oracle_max_price_age(&pool) == 15, 0);
            assert!(brownfi_amm::pool::oracle_min_sources(&pool) == 1, 0);
            assert!(brownfi_amm::pool::oracle_required_source_mask(&pool) == brownfi_amm::pool::oracle_source_mask_pyth(), 0);
            assert!(brownfi_amm::pool::oracle_allowed_source_mask(&pool) == brownfi_amm::pool::oracle_source_mask_pyth(), 0);
            assert!(brownfi_amm::pool::oracle_primary_source(&pool) == brownfi_amm::pool::oracle_source_pyth(), 0);
            assert!(brownfi_amm::pool::oracle_max_pair_time_delta_ms(&pool) == 0, 0);
            assert!(brownfi_amm::pool::oracle_max_confidence(&pool) == 0, 0);
            assert!(brownfi_amm::pool::oracle_max_deviation(&pool) == 0, 0);
            assert!(brownfi_amm::pool::oracle_mode(&pool) == brownfi_amm::pool::oracle_mode_primary_with_sanity(), 0);
            assert!(brownfi_amm::pool::amm_twap_enabled(&pool), 0);
            assert!(brownfi_amm::pool::amm_blend_weight(&pool) == 50_000_000, 0);
            assert!(brownfi_amm::pool::amm_min_sources(&pool) == 0, 0);
            assert!(brownfi_amm::pool::amm_fallback_mode(&pool) == brownfi_amm::pool::amm_fallback_oracle_only(), 0);
            assert!(brownfi_amm::pool::amm_max_ospread(&pool) == 0, 0);
            assert!(brownfi_amm::pool::amm_min_liquidity_quote(&pool) == 0, 0);
            assert!(brownfi_amm::pool::amm_min_window_seconds(&pool) == 0, 0);
            assert!(brownfi_amm::pool::amm_max_window_seconds(&pool) == 0, 0);
            assert!(brownfi_amm::pool::amm_allowed_source_mask(&pool) == 0, 0);
            assert!(brownfi_amm::pool::amm_source_count_limit(&pool) == 0, 0);
            assert!(!brownfi_amm::pool::flash_enabled(&pool), 0);
            assert!(brownfi_amm::pool::router_enabled(&pool), 0);

            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_risk_cap_updates_fee_emits_config_updated_event() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);
            let pool_id = brownfi_amm::pool::id(&pool);

            admin::set_pool_fee(&mut pool, &risk_cap, 200_000);

            assert!(brownfi_amm::pool::fee(&pool) == 200_000, 0);

            let mut emitted = event::events_by_type<events::ConfigUpdated>();
            assert!(vector::length(&emitted) == 1, 1);
            let event = vector::pop_back(&mut emitted);
            events::assert_config_updated_for_testing(
                event,
                pool_id,
                b"fee",
                vector[200_000]
            );

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_pause_cap_emits_pool_gate_state_events() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let pause_cap = take_from_sender<PauseCap>(&scenario);
            let pool_id = brownfi_amm::pool::id(&pool);

            admin::set_pool_swaps_paused(&mut pool, &pause_cap, true);
            admin::set_pool_add_liquidity_paused(&mut pool, &pause_cap, true);
            admin::set_pool_flash_enabled(&mut pool, &pause_cap, true);

            assert!(brownfi_amm::pool::swaps_paused(&pool), 0);
            assert!(brownfi_amm::pool::add_liquidity_paused(&pool), 1);
            assert!(brownfi_amm::pool::flash_enabled(&pool), 2);

            let mut emitted = event::events_by_type<events::PoolGateStateChanged>();
            assert!(vector::length(&emitted) == 3, 3);

            let flash_event = vector::pop_back(&mut emitted);
            events::assert_pool_gate_state_changed_for_testing(
                flash_event,
                pool_id,
                events::pool_gate_flash(),
                true
            );

            let add_liquidity_event = vector::pop_back(&mut emitted);
            events::assert_pool_gate_state_changed_for_testing(
                add_liquidity_event,
                pool_id,
                events::pool_gate_add_liquidity(),
                false
            );

            let swap_event = vector::pop_back(&mut emitted);
            events::assert_pool_gate_state_changed_for_testing(
                swap_event,
                pool_id,
                events::pool_gate_swap(),
                false
            );

            return_to_sender<PauseCap>(&scenario, pause_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_risk_cap_accepts_documented_fee_boundaries() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee(&mut pool, &risk_cap, 10_000);
            assert!(brownfi_amm::pool::fee(&pool) == 10_000, 0);

            admin::set_pool_fee(&mut pool, &risk_cap, 50_000_000);
            assert!(brownfi_amm::pool::fee(&pool) == 50_000_000, 1);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EFeeTooLow)]
    fun test_risk_cap_rejects_fee_below_documented_min() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee(&mut pool, &risk_cap, 9_999);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EFeeTooHigh)]
    fun test_risk_cap_rejects_fee_above_documented_max() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee(&mut pool, &risk_cap, 50_000_001);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_risk_cap_accepts_documented_fee_split_boundaries() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let fee_cap = take_from_sender<FeeCap>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee_split(&mut pool, &risk_cap, 0);
            assert!(brownfi_amm::pool::fee_split(&pool) == 0, 0);

            admin::set_pool_fee_to(&mut pool, &fee_cap, ADDR1);
            admin::set_pool_fee_split(&mut pool, &risk_cap, 100_000_000);
            assert!(brownfi_amm::pool::fee_split(&pool) == 100_000_000, 1);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_to_sender<FeeCap>(&scenario, fee_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EProtocolFeeTooHigh)]
    fun test_risk_cap_rejects_fee_split_above_documented_max() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee_split(&mut pool, &risk_cap, 100_000_001);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EFeeToNotSet)]
    fun test_risk_cap_rejects_nonzero_fee_split_without_fee_to() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_fee_split(&mut pool, &risk_cap, 1);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_risk_cap_accepts_documented_kappa_boundaries() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            let min_k = math::q32() / 10000;
            let max_k = math::q32() * 2;

            admin::set_pool_k(&mut pool, &risk_cap, min_k);
            assert!(brownfi_amm::pool::k_b(&pool) == min_k, 0);
            assert!(brownfi_amm::pool::k_q(&pool) == min_k, 1);

            admin::set_pool_k_b(&mut pool, &risk_cap, max_k);
            assert!(brownfi_amm::pool::k_b(&pool) == max_k, 2);

            admin::set_pool_k_q(&mut pool, &risk_cap, max_k);
            assert!(brownfi_amm::pool::k_q(&pool) == max_k, 3);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EKTooLow)]
    fun test_risk_cap_rejects_k_b_below_documented_min() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_k_b(&mut pool, &risk_cap, math::q32() / 10000 - 1);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EKTooLow)]
    fun test_risk_cap_rejects_k_q_below_documented_min() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_k_q(&mut pool, &risk_cap, math::q32() / 10000 - 1);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EKTooLow)]
    fun test_risk_cap_rejects_symmetric_k_below_documented_min() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_k(&mut pool, &risk_cap, math::q32() / 10000 - 1);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_risk_cap_accepts_documented_gamma_boundaries() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_gamma(&mut pool, &risk_cap, 1);
            assert!(brownfi_amm::pool::gamma(&pool) == 1, 0);

            admin::set_pool_gamma(&mut pool, &risk_cap, 100_000_000);
            assert!(brownfi_amm::pool::gamma(&pool) == 100_000_000, 1);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EGammaOutOfBounds)]
    fun test_risk_cap_rejects_zero_gamma() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_gamma(&mut pool, &risk_cap, 0);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EGammaOutOfBounds)]
    fun test_risk_cap_rejects_gamma_above_one() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_gamma(&mut pool, &risk_cap, 100_000_001);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_oracle_cap_updates_pyth_weight_policy_version() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);
            let pool_id = brownfi_amm::pool::id(&pool);

            admin::set_pool_pyth_weight(&mut pool, &oracle_cap, 60_000_000);

            assert!(brownfi_amm::pool::pyth_weight(&pool) == 60_000_000, 0);
            assert!(brownfi_amm::pool::oracle_policy_version(&pool) == 1, 1);

            let mut emitted = event::events_by_type<events::OraclePolicyUpdated>();
            assert!(vector::length(&emitted) == 1, 2);
            let event = vector::pop_back(&mut emitted);
            events::assert_oracle_policy_updated_for_testing(
                event,
                pool_id,
                1,
                b"pyth_weight",
                vector[60_000_000]
            );

            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_oracle_cap_allows_zero_pyth_weight_after_amm_blend_disabled() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                false,
                0,
                0,
                brownfi_amm::pool::amm_fallback_oracle_only()
            );
            admin::set_pool_pyth_weight(&mut pool, &oracle_cap, 0);

            assert!(brownfi_amm::pool::pyth_weight(&pool) == 0, 0);
            assert!(brownfi_amm::pool::amm_blend_weight(&pool) == 0, 1);

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EAmmPolicyInvalid)]
    fun test_oracle_cap_rejects_zero_pyth_weight_when_amm_blend_enabled() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                1,
                0,
                brownfi_amm::pool::amm_fallback_oracle_only()
            );
            admin::set_pool_pyth_weight(&mut pool, &oracle_cap, 0);

            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EAmmPolicyInvalid)]
    fun test_amm_cap_rejects_enabling_amm_blend_when_pyth_weight_is_zero() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                false,
                0,
                0,
                brownfi_amm::pool::amm_fallback_oracle_only()
            );
            admin::set_pool_pyth_weight(&mut pool, &oracle_cap, 0);
            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                1,
                0,
                brownfi_amm::pool::amm_fallback_oracle_only()
            );

            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_oracle_cap_updates_aggregation_policy_version() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                brownfi_amm::pool::oracle_source_pyth(),
                2_000,
                1_000_000,
                5_000_000,
                brownfi_amm::pool::oracle_mode_primary_with_sanity()
            );

            assert!(brownfi_amm::pool::oracle_primary_source(&pool) == brownfi_amm::pool::oracle_source_pyth(), 0);
            assert!(brownfi_amm::pool::oracle_max_pair_time_delta_ms(&pool) == 2_000, 1);
            assert!(brownfi_amm::pool::oracle_max_confidence(&pool) == 1_000_000, 2);
            assert!(brownfi_amm::pool::oracle_max_deviation(&pool) == 5_000_000, 3);
            assert!(brownfi_amm::pool::oracle_mode(&pool) == brownfi_amm::pool::oracle_mode_primary_with_sanity(), 4);
            assert!(brownfi_amm::pool::oracle_policy_version(&pool) == 1, 5);

            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EOraclePolicyInvalid)]
    fun test_oracle_cap_rejects_quorum_min_sources_above_allowed_mask() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_quorum(
                &mut pool,
                &oracle_cap,
                2,
                brownfi_amm::pool::oracle_source_mask_pyth(),
                brownfi_amm::pool::oracle_source_mask_pyth()
            );

            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EOraclePolicyInvalid)]
    fun test_oracle_cap_rejects_weighted_median_until_weights_are_configured() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let oracle_cap = take_from_sender<OracleCap>(&scenario);

            admin::set_pool_oracle_aggregation_policy(
                &mut pool,
                &oracle_cap,
                brownfi_amm::pool::oracle_source_pyth(),
                0,
                1_000_000,
                5_000_000,
                brownfi_amm::pool::oracle_mode_weighted_median()
            );

            return_to_sender<OracleCap>(&scenario, oracle_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    fun test_amm_cap_updates_twap_source_policy_version() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);
            let pool_id = brownfi_amm::pool::id(&pool);

            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                5_000_000,
                1_000_000_000,
                60,
                900,
                1,
                4
            );

            assert!(brownfi_amm::pool::amm_max_ospread(&pool) == 5_000_000, 0);
            assert!(brownfi_amm::pool::amm_min_liquidity_quote(&pool) == 1_000_000_000, 1);
            assert!(brownfi_amm::pool::amm_min_window_seconds(&pool) == 60, 2);
            assert!(brownfi_amm::pool::amm_max_window_seconds(&pool) == 900, 3);
            assert!(brownfi_amm::pool::amm_allowed_source_mask(&pool) == 1, 4);
            assert!(brownfi_amm::pool::amm_source_count_limit(&pool) == 4, 5);
            assert!(brownfi_amm::pool::oracle_policy_version(&pool) == 1, 6);

            let mut emitted = event::events_by_type<events::AmmPolicyUpdated>();
            assert!(vector::length(&emitted) == 1, 7);
            let event = vector::pop_back(&mut emitted);
            events::assert_amm_policy_updated_for_testing(
                event,
                pool_id,
                1,
                b"amm_source_policy",
                vector[5_000_000, 1_000_000_000, 60, 900, 1, 4]
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EAmmPolicyInvalid)]
    fun test_amm_cap_rejects_required_sources_above_allowed_mask() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                5_000_000,
                1_000_000_000,
                60,
                900,
                1,
                0
            );
            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                1,
                2,
                brownfi_amm::pool::amm_fallback_fail_closed()
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EAmmPolicyInvalid)]
    fun test_amm_cap_rejects_required_sources_above_allowed_source_ids() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_source_policy(
                &mut pool,
                &amm_cap,
                5_000_000,
                1_000_000_000,
                60,
                900,
                3,
                4
            );
            admin::set_pool_amm_source_ids(
                &mut pool,
                &amm_cap,
                vector[object::id_from_address(@0xF10A)]
            );
            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                1,
                2,
                brownfi_amm::pool::amm_fallback_fail_closed()
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::ESpreadTooHigh)]
    fun test_spreads_reject_constraint2_with_compressed_dis_threshold() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                100_000_000,
                0,
                90_000_000,
                0,
                10_000_000,
                0
            );

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::ESpreadTooHigh)]
    fun test_spreads_reject_zero_dis_threshold() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                0,
                0,
                0
            );

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::ESpreadTooHigh)]
    fun test_spreads_reject_fix_s_above_one_percent() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                1_000_001,
                1,
                0
            );

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::ESpreadTooHigh)]
    fun test_spreads_reject_s_bound_at_ten_percent() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_spreads(
                &mut pool,
                &risk_cap,
                0,
                0,
                0,
                0,
                1,
                10_000_000
            );

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::ELambdaTooHigh)]
    fun test_lambda_must_not_exceed_half_min_kappa() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let risk_cap = take_from_sender<RiskCap>(&scenario);

            admin::set_pool_lambda(&mut pool, &risk_cap, math::q32() / 100);

            return_to_sender<RiskCap>(&scenario, risk_cap);
            return_shared(pool);
        };

        next_tx(&mut scenario, ADDR1);
        {
            let factory = take_shared<Factory>(&scenario);
            return_shared(factory);
        };

        test_scenario::end(scenario);
    }

    #[test]
    #[expected_failure(abort_code = admin::EAmmFallbackInvalid)]
    fun test_amm_required_sources_must_fail_closed() {
        let mut scenario = test_helpers::init_test_scenario(ADDR1);
        test_helpers::create_test_pool(&mut scenario, 1_000_000, 1_000_000);

        next_tx(&mut scenario, ADDR1);
        {
            let mut pool = take_shared<Pool<A, B>>(&scenario);
            let amm_cap = take_from_sender<AmmCap>(&scenario);

            admin::set_pool_amm_policy(
                &mut pool,
                &amm_cap,
                true,
                0,
                1,
                brownfi_amm::pool::amm_fallback_oracle_only()
            );

            return_to_sender<AmmCap>(&scenario, amm_cap);
            return_shared(pool);
        };

        test_scenario::end(scenario);
    }
}
