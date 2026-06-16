module brownfi_amm::pool;

use sui::balance::{Self, Balance, Supply};

public struct LP<phantom A, phantom B> has drop {}

public struct OraclePolicy has store {
    /// Pool-local oracle policy version.
    policy_version: u64,
    /// Maximum oracle price age accepted by this pool, in seconds.
    max_price_age: u64,
    /// Minimum oracle source count required by this pool.
    min_sources: u8,
    /// Required oracle source mask.
    required_source_mask: u64,
    /// Allowed oracle source mask.
    allowed_source_mask: u64,
    /// Primary oracle source index.
    primary_source: u8,
    /// Maximum timestamp delta accepted for paired base/quote source readings, in milliseconds.
    max_pair_time_delta_ms: u64,
    /// Maximum per-source confidence accepted in PRECISION units; zero means not enforced yet.
    max_confidence: u64,
    /// Maximum cross-source relative deviation accepted in PRECISION units; zero means not enforced yet.
    max_deviation: u64,
    /// Oracle aggregation mode.
    mode: u8,
    /// Oracle source type captured for token A at pool creation.
    source_type_a: vector<u8>,
    /// Oracle source type captured for token B at pool creation.
    source_type_b: vector<u8>,
    /// Oracle source object ID captured for token A at pool creation.
    source_id_a: ID,
    /// Oracle source object ID captured for token B at pool creation.
    source_id_b: ID,
    /// Oracle source-specific config captured for token A at pool creation.
    config_data_a: vector<u8>,
    /// Oracle source-specific config captured for token B at pool creation.
    config_data_b: vector<u8>,
}

public struct AmmPolicy has store {
    /// Whether AMM TWAP policy is enabled for this pool.
    twap_enabled: bool,
    /// AMM TWAP blend weight in PRECISION units.
    blend_weight: u32,
    /// Minimum AMM TWAP source count required by this pool.
    min_sources: u8,
    /// AMM fallback mode.
    fallback_mode: u8,
    /// Maximum accepted AMM/oracle relative spread in PRECISION units.
    max_ospread: u32,
    /// Minimum active AMM liquidity in quote-value units.
    min_liquidity_quote: u128,
    /// Minimum AMM TWAP window in seconds.
    min_window_seconds: u64,
    /// Maximum AMM TWAP window in seconds.
    max_window_seconds: u64,
    /// Allowed AMM source mask.
    allowed_source_mask: u64,
    /// Optional exact AMM source object allowlist. Empty means source-ID filtering is disabled.
    allowed_source_ids: vector<ID>,
    /// Maximum AMM source count accepted by this pool.
    source_count_limit: u8,
}

const LP_DECIMALS: u8 = 18;
const ORACLE_SOURCE_MASK_PYTH: u64 = 1;
const ORACLE_SOURCE_MASK_SWITCHBOARD: u64 = 2;
const ORACLE_SOURCE_MASK_STORK: u64 = 4;
const ORACLE_SOURCE_MASK_SUPRA: u64 = 8;
const ORACLE_SOURCE_PYTH: u8 = 0;
const ORACLE_SOURCE_SWITCHBOARD: u8 = 1;
const ORACLE_SOURCE_STORK: u8 = 2;
const ORACLE_SOURCE_SUPRA: u8 = 3;
const ORACLE_MODE_PRIMARY_WITH_SANITY: u8 = 0;
const ORACLE_MODE_MEDIAN: u8 = 1;
const ORACLE_MODE_WEIGHTED_MEDIAN: u8 = 2;
const AMM_FALLBACK_ORACLE_ONLY: u8 = 0;
const AMM_FALLBACK_FAIL_CLOSED: u8 = 1;

/// BrownFi-local LP display metadata. This is not Sui CoinMetadata/Currency registration.
public fun lp_name(): vector<u8> {
    b"BrownFi V3"
}

public fun lp_symbol(): vector<u8> {
    b"BF-V3"
}

public fun lp_decimals(): u8 {
    LP_DECIMALS
}

public struct Pool<phantom A, phantom B> has key {
    id: UID,
    balance_a: Balance<A>,
    balance_b: Balance<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    lp_supply: Supply<LP<A, B>>,
    locked_lp: Balance<LP<A, B>>,
    protocol_lp: Balance<LP<A, B>>,
    fee_to: Option<address>,
    paused_swaps: bool,
    paused_add_liquidity: bool,
    /// Index of quote token: 0 means A is quote, 1 means B is quote.
    quote_token_index: u8,
    /// Trading fee in PRECISION units.
    fee: u32,
    /// Protocol fee split in PRECISION units.
    fee_split: u32,
    /// Sell-side inventory parameter in Q32.
    k_b: u64,
    /// Buy-side inventory parameter in Q32.
    k_q: u64,
    /// Skewness parameter lambda in Q32.
    lambda: u64,
    /// Oracle spread compression in PRECISION units.
    compress: u32,
    /// Additional sell spread in PRECISION units.
    s_sell: u32,
    /// Additional buy spread in PRECISION units.
    s_buy: u32,
    /// Fixed spread in PRECISION units.
    fix_s: u32,
    /// Maximum oracle discrepancy in PRECISION units.
    dis_threshold: u32,
    /// Skew floor/bound in PRECISION units.
    s_bound: u32,
    /// Pyth weight in PRECISION units.
    pyth_weight: u32,
    /// Gamma cutoff in PRECISION units.
    gamma: u32,
    oracle: OraclePolicy,
    amm: AmmPolicy,
    /// Whether flash borrow/repay is enabled for this pool.
    flash_enabled: bool,
    /// Whether typed router helpers are enabled for this pool.
    router_enabled: bool,
}

public(package) fun new<A, B>(
    balance_a: Balance<A>,
    balance_b: Balance<B>,
    token_a_decimals: u8,
    token_b_decimals: u8,
    quote_token_index: u8,
    fee: u32,
    fee_split: u32,
    k_b: u64,
    k_q: u64,
    lambda: u64,
    compress: u32,
    s_sell: u32,
    s_buy: u32,
    fix_s: u32,
    dis_threshold: u32,
    s_bound: u32,
    pyth_weight: u32,
    gamma: u32,
    oracle_policy_version: u64,
    oracle_max_price_age: u64,
    oracle_min_sources: u8,
    oracle_required_source_mask: u64,
    oracle_allowed_source_mask: u64,
    oracle_primary_source: u8,
    oracle_max_pair_time_delta_ms: u64,
    oracle_max_confidence: u64,
    oracle_max_deviation: u64,
    oracle_mode: u8,
    oracle_source_type_a: vector<u8>,
    oracle_source_type_b: vector<u8>,
    oracle_source_id_a: ID,
    oracle_source_id_b: ID,
    oracle_config_data_a: vector<u8>,
    oracle_config_data_b: vector<u8>,
    amm_twap_enabled: bool,
    amm_blend_weight: u32,
    amm_min_sources: u8,
    amm_fallback_mode: u8,
    amm_max_ospread: u32,
    amm_min_liquidity_quote: u128,
    amm_min_window_seconds: u64,
    amm_max_window_seconds: u64,
    amm_allowed_source_mask: u64,
    amm_source_count_limit: u8,
    flash_enabled: bool,
    router_enabled: bool,
    ctx: &mut TxContext
): Pool<A, B> {
    Pool<A, B> {
        id: object::new(ctx),
        balance_a,
        balance_b,
        token_a_decimals,
        token_b_decimals,
        lp_supply: balance::create_supply(LP<A, B> {}),
        locked_lp: balance::zero<LP<A, B>>(),
        protocol_lp: balance::zero<LP<A, B>>(),
        fee_to: option::none(),
        paused_swaps: false,
        paused_add_liquidity: false,
        quote_token_index,
        fee,
        fee_split,
        k_b,
        k_q,
        lambda,
        compress,
        s_sell,
        s_buy,
        fix_s,
        dis_threshold,
        s_bound,
        pyth_weight,
        gamma,
        oracle: OraclePolicy {
            policy_version: oracle_policy_version,
            max_price_age: oracle_max_price_age,
            min_sources: oracle_min_sources,
            required_source_mask: oracle_required_source_mask,
            allowed_source_mask: oracle_allowed_source_mask,
            primary_source: oracle_primary_source,
            max_pair_time_delta_ms: oracle_max_pair_time_delta_ms,
            max_confidence: oracle_max_confidence,
            max_deviation: oracle_max_deviation,
            mode: oracle_mode,
            source_type_a: oracle_source_type_a,
            source_type_b: oracle_source_type_b,
            source_id_a: oracle_source_id_a,
            source_id_b: oracle_source_id_b,
            config_data_a: oracle_config_data_a,
            config_data_b: oracle_config_data_b,
        },
        amm: AmmPolicy {
            twap_enabled: amm_twap_enabled,
            blend_weight: amm_blend_weight,
            min_sources: amm_min_sources,
            fallback_mode: amm_fallback_mode,
            max_ospread: amm_max_ospread,
            min_liquidity_quote: amm_min_liquidity_quote,
            min_window_seconds: amm_min_window_seconds,
            max_window_seconds: amm_max_window_seconds,
            allowed_source_mask: amm_allowed_source_mask,
            allowed_source_ids: vector[],
            source_count_limit: amm_source_count_limit,
        },
        flash_enabled,
        router_enabled,
    }
}

public(package) fun share<A, B>(pool: Pool<A, B>) {
    transfer::share_object(pool);
}

public fun balance_a<A, B>(pool: &Pool<A, B>): u64 {
    balance::value(&pool.balance_a)
}

public fun balance_b<A, B>(pool: &Pool<A, B>): u64 {
    balance::value(&pool.balance_b)
}

public fun lp_supply<A, B>(pool: &Pool<A, B>): u64 {
    balance::supply_value(&pool.lp_supply)
}

public fun fee<A, B>(pool: &Pool<A, B>): u32 {
    pool.fee
}

public fun k<A, B>(pool: &Pool<A, B>): u64 {
    pool.k_b
}

public fun k_b<A, B>(pool: &Pool<A, B>): u64 {
    pool.k_b
}

public fun k_q<A, B>(pool: &Pool<A, B>): u64 {
    pool.k_q
}

public fun lambda<A, B>(pool: &Pool<A, B>): u64 {
    pool.lambda
}

public fun protocol_fee<A, B>(pool: &Pool<A, B>): u32 {
    pool.fee_split
}

public fun fee_split<A, B>(pool: &Pool<A, B>): u32 {
    pool.fee_split
}

public fun quote_token_index<A, B>(pool: &Pool<A, B>): u8 {
    pool.quote_token_index
}

public fun compress<A, B>(pool: &Pool<A, B>): u32 {
    pool.compress
}

public fun s_sell<A, B>(pool: &Pool<A, B>): u32 {
    pool.s_sell
}

public fun s_buy<A, B>(pool: &Pool<A, B>): u32 {
    pool.s_buy
}

public fun fix_s<A, B>(pool: &Pool<A, B>): u32 {
    pool.fix_s
}

public fun dis_threshold<A, B>(pool: &Pool<A, B>): u32 {
    pool.dis_threshold
}

public fun s_bound<A, B>(pool: &Pool<A, B>): u32 {
    pool.s_bound
}

public fun pyth_weight<A, B>(pool: &Pool<A, B>): u32 {
    pool.pyth_weight
}

public fun gamma<A, B>(pool: &Pool<A, B>): u32 {
    pool.gamma
}

public fun oracle_policy_version<A, B>(pool: &Pool<A, B>): u64 {
    pool.oracle.policy_version
}

public fun oracle_max_price_age<A, B>(pool: &Pool<A, B>): u64 {
    pool.oracle.max_price_age
}

public fun oracle_min_sources<A, B>(pool: &Pool<A, B>): u8 {
    pool.oracle.min_sources
}

public fun oracle_required_source_mask<A, B>(pool: &Pool<A, B>): u64 {
    pool.oracle.required_source_mask
}

public fun oracle_allowed_source_mask<A, B>(pool: &Pool<A, B>): u64 {
    pool.oracle.allowed_source_mask
}

public fun oracle_primary_source<A, B>(pool: &Pool<A, B>): u8 {
    pool.oracle.primary_source
}

public fun oracle_max_pair_time_delta_ms<A, B>(pool: &Pool<A, B>): u64 {
    pool.oracle.max_pair_time_delta_ms
}

public fun oracle_max_confidence<A, B>(pool: &Pool<A, B>): u64 {
    pool.oracle.max_confidence
}

public fun oracle_max_deviation<A, B>(pool: &Pool<A, B>): u64 {
    pool.oracle.max_deviation
}

public fun oracle_mode<A, B>(pool: &Pool<A, B>): u8 {
    pool.oracle.mode
}

public fun oracle_source_type_a<A, B>(pool: &Pool<A, B>): vector<u8> {
    pool.oracle.source_type_a
}

public fun oracle_source_type_b<A, B>(pool: &Pool<A, B>): vector<u8> {
    pool.oracle.source_type_b
}

public fun oracle_source_id_a<A, B>(pool: &Pool<A, B>): ID {
    pool.oracle.source_id_a
}

public fun oracle_source_id_b<A, B>(pool: &Pool<A, B>): ID {
    pool.oracle.source_id_b
}

public fun oracle_config_data_a<A, B>(pool: &Pool<A, B>): vector<u8> {
    pool.oracle.config_data_a
}

public fun oracle_config_data_b<A, B>(pool: &Pool<A, B>): vector<u8> {
    pool.oracle.config_data_b
}

public fun amm_twap_enabled<A, B>(pool: &Pool<A, B>): bool {
    pool.amm.twap_enabled
}

public fun amm_blend_weight<A, B>(pool: &Pool<A, B>): u32 {
    pool.amm.blend_weight
}

public fun amm_min_sources<A, B>(pool: &Pool<A, B>): u8 {
    pool.amm.min_sources
}

public fun amm_fallback_mode<A, B>(pool: &Pool<A, B>): u8 {
    pool.amm.fallback_mode
}

public fun amm_max_ospread<A, B>(pool: &Pool<A, B>): u32 {
    pool.amm.max_ospread
}

public fun amm_min_liquidity_quote<A, B>(pool: &Pool<A, B>): u128 {
    pool.amm.min_liquidity_quote
}

public fun amm_min_window_seconds<A, B>(pool: &Pool<A, B>): u64 {
    pool.amm.min_window_seconds
}

public fun amm_max_window_seconds<A, B>(pool: &Pool<A, B>): u64 {
    pool.amm.max_window_seconds
}

public fun amm_allowed_source_mask<A, B>(pool: &Pool<A, B>): u64 {
    pool.amm.allowed_source_mask
}

public fun amm_allowed_source_ids<A, B>(pool: &Pool<A, B>): vector<ID> {
    pool.amm.allowed_source_ids
}

public fun amm_source_count_limit<A, B>(pool: &Pool<A, B>): u8 {
    pool.amm.source_count_limit
}

public fun flash_enabled<A, B>(pool: &Pool<A, B>): bool {
    pool.flash_enabled
}

public fun router_enabled<A, B>(pool: &Pool<A, B>): bool {
    pool.router_enabled
}

public fun oracle_source_mask_pyth(): u64 {
    ORACLE_SOURCE_MASK_PYTH
}

public fun oracle_source_mask_switchboard(): u64 {
    ORACLE_SOURCE_MASK_SWITCHBOARD
}

public fun oracle_source_mask_stork(): u64 {
    ORACLE_SOURCE_MASK_STORK
}

public fun oracle_source_mask_supra(): u64 {
    ORACLE_SOURCE_MASK_SUPRA
}

public fun oracle_source_pyth(): u8 {
    ORACLE_SOURCE_PYTH
}

public fun oracle_source_switchboard(): u8 {
    ORACLE_SOURCE_SWITCHBOARD
}

public fun oracle_source_stork(): u8 {
    ORACLE_SOURCE_STORK
}

public fun oracle_source_supra(): u8 {
    ORACLE_SOURCE_SUPRA
}

public fun oracle_mode_primary_with_sanity(): u8 {
    ORACLE_MODE_PRIMARY_WITH_SANITY
}

public fun oracle_mode_median(): u8 {
    ORACLE_MODE_MEDIAN
}

public fun oracle_mode_weighted_median(): u8 {
    ORACLE_MODE_WEIGHTED_MEDIAN
}

public fun amm_fallback_oracle_only(): u8 {
    AMM_FALLBACK_ORACLE_ONLY
}

public fun amm_fallback_fail_closed(): u8 {
    AMM_FALLBACK_FAIL_CLOSED
}

public fun protocol_lp_value<A, B>(pool: &Pool<A, B>): u64 {
    balance::value(&pool.protocol_lp)
}

public fun fee_to<A, B>(pool: &Pool<A, B>): Option<address> {
    pool.fee_to
}

public fun has_fee_to<A, B>(pool: &Pool<A, B>): bool {
    option::is_some(&pool.fee_to)
}

public fun swaps_paused<A, B>(pool: &Pool<A, B>): bool {
    pool.paused_swaps
}

public fun add_liquidity_paused<A, B>(pool: &Pool<A, B>): bool {
    pool.paused_add_liquidity
}

public fun token_a_decimals<A, B>(pool: &Pool<A, B>): u8 {
    pool.token_a_decimals
}

public fun token_b_decimals<A, B>(pool: &Pool<A, B>): u8 {
    pool.token_b_decimals
}

public fun get_balances<A, B>(pool: &Pool<A, B>): (u64, u64, u64) {
    (
        balance::value(&pool.balance_a),
        balance::value(&pool.balance_b),
        balance::supply_value(&pool.lp_supply)
    )
}

public fun id<A, B>(pool: &Pool<A, B>): ID {
    object::id(pool)
}

public(package) fun deposit_a<A, B>(pool: &mut Pool<A, B>, balance: Balance<A>) {
    balance::join(&mut pool.balance_a, balance);
}

public(package) fun deposit_b<A, B>(pool: &mut Pool<A, B>, balance: Balance<B>) {
    balance::join(&mut pool.balance_b, balance);
}

public(package) fun withdraw_a<A, B>(pool: &mut Pool<A, B>, amount: u64): Balance<A> {
    balance::split(&mut pool.balance_a, amount)
}

public(package) fun withdraw_b<A, B>(pool: &mut Pool<A, B>, amount: u64): Balance<B> {
    balance::split(&mut pool.balance_b, amount)
}

public(package) fun mint_lp<A, B>(pool: &mut Pool<A, B>, amount: u64): Balance<LP<A, B>> {
    balance::increase_supply(&mut pool.lp_supply, amount)
}

public(package) fun burn_lp<A, B>(pool: &mut Pool<A, B>, lp: Balance<LP<A, B>>) {
    balance::decrease_supply(&mut pool.lp_supply, lp);
}

public(package) fun borrow_mut_balance_a<A, B>(pool: &mut Pool<A, B>): &mut Balance<A> {
    &mut pool.balance_a
}

public(package) fun borrow_mut_balance_b<A, B>(pool: &mut Pool<A, B>): &mut Balance<B> {
    &mut pool.balance_b
}

public(package) fun borrow_mut_lp_supply<A, B>(pool: &mut Pool<A, B>): &mut Supply<LP<A, B>> {
    &mut pool.lp_supply
}

/// Update pool parameters (only callable by authorized modules)
public(package) fun set_fee<A, B>(pool: &mut Pool<A, B>, new_fee: u32) {
    pool.fee = new_fee;
}

public(package) fun set_k<A, B>(pool: &mut Pool<A, B>, new_k: u64) {
    pool.k_b = new_k;
    pool.k_q = new_k;
}

public(package) fun set_lambda<A, B>(pool: &mut Pool<A, B>, new_lambda: u64) {
    pool.lambda = new_lambda;
}

public(package) fun set_protocol_fee<A, B>(pool: &mut Pool<A, B>, new_protocol_fee: u32) {
    pool.fee_split = new_protocol_fee;
}

/// Get all pool parameters at once for efficient reading
public fun get_parameters<A, B>(pool: &Pool<A, B>): (u32, u64, u64, u32) {
    (pool.fee, pool.k_b, pool.lambda, pool.fee_split)
}

public(package) fun set_k_b<A, B>(pool: &mut Pool<A, B>, new_k: u64) {
    pool.k_b = new_k;
}

public(package) fun set_k_q<A, B>(pool: &mut Pool<A, B>, new_k: u64) {
    pool.k_q = new_k;
}

public(package) fun set_fee_split<A, B>(pool: &mut Pool<A, B>, new_fee_split: u32) {
    pool.fee_split = new_fee_split;
}

public(package) fun set_fee_to<A, B>(pool: &mut Pool<A, B>, fee_to: address) {
    pool.fee_to = option::some(fee_to);
}

public(package) fun set_swaps_paused<A, B>(pool: &mut Pool<A, B>, paused: bool) {
    pool.paused_swaps = paused;
}

public(package) fun set_add_liquidity_paused<A, B>(pool: &mut Pool<A, B>, paused: bool) {
    pool.paused_add_liquidity = paused;
}

public(package) fun set_gamma<A, B>(pool: &mut Pool<A, B>, new_gamma: u32) {
    pool.gamma = new_gamma;
}

public(package) fun set_spreads<A, B>(
    pool: &mut Pool<A, B>,
    compress: u32,
    s_sell: u32,
    s_buy: u32,
    fix_s: u32,
    dis_threshold: u32,
    s_bound: u32
) {
    pool.compress = compress;
    pool.s_sell = s_sell;
    pool.s_buy = s_buy;
    pool.fix_s = fix_s;
    pool.dis_threshold = dis_threshold;
    pool.s_bound = s_bound;
}

public(package) fun set_pyth_weight<A, B>(pool: &mut Pool<A, B>, new_weight: u32) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.pyth_weight = new_weight;
}

public(package) fun set_oracle_max_price_age<A, B>(pool: &mut Pool<A, B>, new_age: u64) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.oracle.max_price_age = new_age;
}

public(package) fun set_oracle_quorum<A, B>(
    pool: &mut Pool<A, B>,
    min_sources: u8,
    required_source_mask: u64,
    allowed_source_mask: u64
) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.oracle.min_sources = min_sources;
    pool.oracle.required_source_mask = required_source_mask;
    pool.oracle.allowed_source_mask = allowed_source_mask;
}

public(package) fun set_oracle_aggregation_policy<A, B>(
    pool: &mut Pool<A, B>,
    primary_source: u8,
    max_pair_time_delta_ms: u64,
    max_confidence: u64,
    max_deviation: u64,
    mode: u8
) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.oracle.primary_source = primary_source;
    pool.oracle.max_pair_time_delta_ms = max_pair_time_delta_ms;
    pool.oracle.max_confidence = max_confidence;
    pool.oracle.max_deviation = max_deviation;
    pool.oracle.mode = mode;
}

public(package) fun set_oracle_sources<A, B>(
    pool: &mut Pool<A, B>,
    source_type_a: vector<u8>,
    source_type_b: vector<u8>,
    source_id_a: ID,
    source_id_b: ID,
    config_data_a: vector<u8>,
    config_data_b: vector<u8>
) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.oracle.source_type_a = source_type_a;
    pool.oracle.source_type_b = source_type_b;
    pool.oracle.source_id_a = source_id_a;
    pool.oracle.source_id_b = source_id_b;
    pool.oracle.config_data_a = config_data_a;
    pool.oracle.config_data_b = config_data_b;
}

public(package) fun set_amm_policy<A, B>(
    pool: &mut Pool<A, B>,
    enabled: bool,
    blend_weight: u32,
    min_sources: u8,
    fallback_mode: u8
) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.amm.twap_enabled = enabled;
    pool.amm.blend_weight = blend_weight;
    pool.amm.min_sources = min_sources;
    pool.amm.fallback_mode = fallback_mode;
}

public(package) fun set_amm_source_policy<A, B>(
    pool: &mut Pool<A, B>,
    max_ospread: u32,
    min_liquidity_quote: u128,
    min_window_seconds: u64,
    max_window_seconds: u64,
    allowed_source_mask: u64,
    source_count_limit: u8
) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.amm.max_ospread = max_ospread;
    pool.amm.min_liquidity_quote = min_liquidity_quote;
    pool.amm.min_window_seconds = min_window_seconds;
    pool.amm.max_window_seconds = max_window_seconds;
    pool.amm.allowed_source_mask = allowed_source_mask;
    pool.amm.source_count_limit = source_count_limit;
}

public(package) fun set_amm_source_ids<A, B>(pool: &mut Pool<A, B>, source_ids: vector<ID>) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.amm.allowed_source_ids = source_ids;
}

public(package) fun set_flash_enabled<A, B>(pool: &mut Pool<A, B>, enabled: bool) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.flash_enabled = enabled;
}

public(package) fun set_router_enabled<A, B>(pool: &mut Pool<A, B>, enabled: bool) {
    pool.oracle.policy_version = pool.oracle.policy_version + 1;
    pool.router_enabled = enabled;
}

public(package) fun deposit_protocol_lp<A, B>(pool: &mut Pool<A, B>, lp: Balance<LP<A, B>>) {
    balance::join(&mut pool.protocol_lp, lp);
}

public(package) fun deposit_locked_lp<A, B>(pool: &mut Pool<A, B>, lp: Balance<LP<A, B>>) {
    balance::join(&mut pool.locked_lp, lp);
}

public(package) fun withdraw_protocol_lp<A, B>(pool: &mut Pool<A, B>): Balance<LP<A, B>> {
    let amount = balance::value(&pool.protocol_lp);
    balance::split(&mut pool.protocol_lp, amount)
}
