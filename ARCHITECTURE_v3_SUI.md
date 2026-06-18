# BrownFi V3 Sui Architecture

Status: design and implementation tracking draft
Date: 2026-06-08
Scope: Sui Move architecture only. This is not an implementation diff.

Current active scope as of 2026-06-17: Pyth-only implementation and live validation. The verified launch lane is `configs/launch/pyth-current-testnet.json` with `providerIds: ["pyth"]`, no AMM providers, and only the Pyth source adapter in the publish source set. Other oracle adapters and provider SDK notes in this document are historical or optional scaffolding, not active deliverables, unless explicitly re-requested.

Current Pyth launch surface: the current-Pyth template now covers exact-input swap, exact-output swap, result-aware exact-output swap, add liquidity, remove liquidity, single-pair zap-in A/B, single-pair zap-out A/B, cutoff-aware and raw/no-cutoff exact-input/exact-output quote cases, an exact-output round-trip quote case, a max-bound quote case, and single-pair `flash-borrow-a` / `flash-borrow-b` routes. Flash is disabled by default at the pool layer, so the Pyth pool setup template enables it explicitly with the launch `PauseCap` before route submission. The Pyth launch tooling can also opt into protocol-fee setup through pool config `feeCap` / `riskCap` / `feeTo` / `protocolFee`, then claim protocol LP after route submission, transfer it to configured `feeTo`, and record tx evidence for `admin::claim_protocol_lp`; `configs/launch/pyth-current-testnet.protocol-fee.pool.example.json` plus pool-only `--pool-values` are the checked optional template path, while the default current-Pyth template still leaves protocol fee disabled. The checked live-evidence matrix now proves landed current-Pyth package/pool setup, protocol-fee setup, flash-enable, exact-input swap, exact-output swap, result-aware exact-output swap, add liquidity, remove liquidity, zap-in A/B, zap-out A/B, flash-borrow A/B, and protocol-LP claim transactions from the 2026-06-17 protocol-fee launch, and the tx-evidence verifier can verify all checked setup and route evidence entries in one `--all` pass. Additional 2026-06-18 testnet evidence proves a native SUI / test USDT Pyth-only pool can execute landed exact-input SUI -> USDT swap, add-liquidity, and remove-liquidity transactions against package `0x7d082a9b04ef6cee7793da2553cbf59def37e740fa0e63cf839f55a5cb46e8c4` and pool `0x04a273289ecabd5731f9fab769fbcdae1df130cba13b0ba0f9687a7b766dd183`; tx-evidence verification confirmed the expected BrownFi calls/events plus Pyth update calls on swap/add. Local Move router coverage includes the active Pyth bundle liquidity path for add-then-remove round trips plus unreachable add/remove minimum guards. It also includes the Solidity periphery zap round-trip invariant for Pyth bundle zaps: zap in with token A, zap out to token A, and keep total returned token A above 95% of the input after fees/slippage. Pyth bundle zap tests also cover Solidity-style slippage guards for unreachable zap-in swap minimums and zap-out final output minimums.

Current Pyth launch route cases can optionally set `recipient`. When omitted, route output transfer behavior remains sender-directed for compatibility. When present, the submitter sends final swap/zap outputs, LP from add/zap-in, and remove-liquidity outputs to `recipient`, while exact-output input/intermediate change coins and add/zap-in residual token coins are refunded to the runtime sender. The preflight runner also transfers returned route coin objects before dry-run when the runtime exposes a sender, so state-changing route PTBs are simulated with all non-drop outputs consumed. Direct Pyth convenience preflight wrappers now cover the same recipient-aware transfer variants for dynamic exact-input routes, result-aware exact-output routes, add-liquidity, remove-liquidity, and zap.

## Verdict

Verdict: Better approach available

Why:
- A direct EVM port is the wrong target. BrownFi V3 math and economics should be preserved, but Sui execution should be object and PTB native.
- Adding AMM TWAP blending, multi-oracle quorum, universal router, and flash swaps from day one is acceptable only if "day one" means the architecture, state layout, typed interfaces, events, and per-pool gates exist from the start.
- It is a bad approach to block core BrownFi V3 parity on fully production-grade integrations for every oracle, every AMM TWAP source, a generic router language, and flash swaps. That would maximize integration risk before the base invariant is proven.

Better answer:
- Build a small, parity-correct BrownFi V3 core first, with the extension points and safety gates included in the initial object model.
- Ship each external source behind an adapter that can be disabled per pool until verified.
- Treat the router as PTB-first, not as an EVM-style universal router clone.
- Treat flash swaps as hot-potato receipts, not as callback/reentrancy.

Action:
- Implement from this document only after the architecture decisions are accepted.
- Before coding, write implementation milestones and tests for each invariant listed here.

## Core Decision

BrownFi V3 on Sui should be:

- One shared `Pool<A, B>` object per token pair.
- Pool-local risk, fee, oracle, AMM, router, and flash settings.
- A factory for creation, registry, and admin discovery, not a hot-path dependency for every swap.
- A price pipeline that produces unforgeable price bundles from oracle readings and AMM readings.
- A router/SDK model that uses Sui programmable transaction blocks (PTBs) and typed Move helpers.
- Flash swaps implemented through linear hot-potato receipts that must be repaid in the same PTB.

The current prototype is useful as a sketch, but it is not BrownFi V3 parity yet. The biggest gaps are:

- `Factory` has been removed from swap/add/remove/quote/router/oracle-gateway execution APIs. Factory remains for pool creation, pair registry, defaults, and admin discovery. Global `OracleAdapter` is no longer borrowed by BrownFi-owned source adapters or source-provider SDK paths; it remains only on legacy direct Pyth compatibility wrappers, so those wrappers are not the preferred Sui hot path.
- `oracle_gateway.move` is no longer only a single Pyth pair path, but it is not full provider parity yet. The current Sui slice normalizes Pyth exponent/confidence for Pyth-only fallback, validates the current `OracleAdapter` config against the pool-local source/config snapshot captured at creation or updated by `OracleCap`, and emits policy/price digests over modeled bundle state. `pyth_source.move` can now mint BrownFi-owned Pyth `PriceReading` values and the gateway can consume either one source pair or a source-paired vector into a bundle. The direct Pyth compatibility wrapper now constructs internal Pyth `PriceReading` values and delegates through the same bundle path, so direct and BrownFi-owned reading bundles have matching policy/price digests for the same Pyth object data. The vector path implements primary-with-sanity quorum over BrownFi-owned readings: it requires the configured primary pair, counts unique allowed source masks, enforces required/allowed source masks and min source count, rejects stale/high-confidence readings, and rejects secondary relative prices outside `oracle_max_deviation`. The vector path also implements `MEDIAN` mode for an odd number of valid source pairs: it sorts relative candidates, resolves to the middle candidate, checks all candidates against the median reference when `oracle_max_deviation` is configured, and fails closed on even source counts because BrownFi docs do not define tie handling yet. BrownFi reading-pair bundles now commit oracle source/feed/timestamp/relative-candidate metadata into `price_digest`. The gateway also has a BrownFi-owned `AmmReading` path that filters invalid advisory AMM readings, including exact source-ID allowlist failures and per-source `amm_max_ospread` failures, aggregates accepted AMM relative-price readings by quote liquidity, falls back to oracle-only when no valid AMM source remains and AMM is not required, and blends accepted AMM readings with either the primary-with-sanity oracle relative price or the resolved median oracle relative price. The gateway applies pool skewness to `adj_price` before sell/buy spread using the Solidity-compatible `fee / (2 + fee) + s_bound` cap, and the bundle policy digest commits to `fee` and `lambda` because they affect skewed prices. Pyth confidence-derived `Ospread` is covered on both rejection and within-threshold success paths, and the fixed/side spread pipeline has exact sell/buy price coverage for Solidity spreadsheet-audit cases. `PriceBundle` carries separate oracle and AMM relative prices for liquidity minting, and `price_digest` commits to those values plus AMM metadata when AMM readings are used. The FlowX CLMM adapter now mints BrownFi-owned `AmmReading` values for direct pools and typed two-hop `B -> I -> A` paths, including spot-mode, TWAP/TWAL paths, quote-liquidity weighting, and both FlowX pool IDs in path reading digests/source allowlist checks. Typed two-hop prebuilt-bundle routes now have AMM-active per-hop metadata coverage in both directions. The SDK/PTB route layer now has a provider registry boundary that selects a route price provider before exact-input/exact-output execution; Pyth is the first provider and custom provider tests prove the dynamic route planners no longer require Pyth feed metadata; exact-input registered/Pyth routes can now chain more than two hops through sequential single-hop bundle swaps; registered/Pyth quote-only routes expose exact-input and exact-output amount chains after provider bundle construction; the compatibility registered/Pyth exact-output helpers keep their one/two-hop return shape, while `swapExactOutputWithRegisteredRouteResults` and `swapExactOutputWithPythRouteResults` can quote-chain arbitrary positive-length registered-provider/Pyth paths and expose all intermediate change coins plus the final output. `switchboard_source.move` now compiles against Switchboard's documented Quote Verifier API, mints BrownFi-owned Switchboard `PriceReading` values from verified quotes, normalizes Switchboard 18-decimal `Decimal` values to BrownFi 9-decimal prices, and uses queue ID/feed hash as source ID/config. `stork_source.move` reads Stork `StorkState`, validates `b"stork"` pool config, uses the Stork state object ID as BrownFi source ID, uses encoded asset/feed bytes as config data, normalizes Stork's 18-decimal signed quantized values to BrownFi 9-decimal prices, converts nanosecond timestamps to milliseconds, and emits zero confidence because the Sui read API exposes no confidence range. `supra_source.move` reads Supra push `OracleHolder` prices through the documented `SupraSValueFeed::get_price` ABI, validates `b"supra"` pool config, uses the Supra holder object ID as BrownFi source ID, uses BCS-encoded `u32` pair IDs as config data, normalizes Supra decimal-scaled values to BrownFi 9-decimal prices, and emits zero confidence because the push API exposes no confidence range. `supra_pull_source.move` verifies Supra pull proof bytes through the current `DkgState`/mutable `OracleHolder`/mutable `MerkleRootHash`/`Clock`/`price_data_pull_v2::verify_oracle_proof` ABI, extracts the two configured BCS `u32` pair IDs from one verification result, normalizes values to BrownFi 9-decimal prices, converts pull timestamps from seconds to milliseconds, emits zero confidence because the pull ABI exposes no confidence range, and returns a pool-bound `PriceBundle` directly, with a separate AMM-reading variant for BrownFi AMM blending. The local `packages/supra-sui` package is an ABI stub for the official push plus current pull/validator interfaces; native proof validation aborts locally and needs live Sui validation. The Switchboard SDK provider fetches one quote update per route and builds reading-pair bundles, and the SDK now includes official-shape helpers for `new SwitchboardClient(suiClient)` plus `fetchQuoteUpdate(client, feedIds, tx, options?)` without hard-coded deployments; the Stork SDK provider runs injected provider-specific feed-update logic once per route before building reading-pair bundles; the Supra push SDK provider builds reading-pair bundles without update hooks; the Supra pull SDK provider builds one proof-verified bundle per hop from caller-supplied proof bytes and mutable Supra objects; the FlowX direct and two-hop AMM route wrappers build `amm_flowx` readings per hop, append them to caller-supplied `ammReadings`, and delegate to any route price provider; generic AMM route wrapping can now append caller-built BrownFi-owned `AmmReading` handles per hop before delegating to any route price provider, and the standard registry can opt into that generic builder as well as FlowX wrappers, so non-FlowX AMM readers can be composed once their source-specific adapters are reviewed; `createStandardRoutePriceProviderRegistry` wires explicit Pyth, Switchboard, Stork, Stork-REST, Supra-push, and Supra-pull runtime configs into one registry without hard-coding secrets or live object IDs. Runtime PTB coverage with live Switchboard `fetchQuoteUpdate` quotes, live Stork provider payloads, live Supra push holder reads, and live Supra pull proof payloads remains pending. The `WEIGHTED_MEDIAN` mode constant remains reserved, but admin config rejects that mode until source-weight state is explicitly designed. Weighted-median aggregation, full multi-source weights, additional source-specific AMM adapters, production TWAP proof review, and source-specific non-FlowX AMM adapters are not implemented yet.
- SDK update: `sdk/router` now includes a Supra pull REST proof fetcher for the documented Dora REST `/get_proof` Sui response shape, endpoint helpers for mainnet/testnet, proof-byte hex decoding, response pair-index validation, a `supra-pull-rest` route price provider, and standard-registry wiring. This is SDK/PTB construction support only; live on-chain execution against real Supra Sui objects and proof payloads is still pending.
- SDK update: Pyth Sui update fees are now explicit at the PTB-builder layer through `readPythTotalUpdateFeeInMist`, which targets the upstream `pyth::get_total_update_fee(&PythState, n)` view. Normal Pyth route construction still delegates update payment to `SuiPythClient.updatePriceFeeds`, which reads the base update fee and splits SUI gas coins per feed; the helper exists for fee inspection/composition parity with Stork's fee-read builders. `tools/read-pyth-sui-update-fee.mjs` can now dev-inspect the documented Pyth Sui contract set from `configs/oracles/pyth-sui-contracts.json` and return the live `u64` fee, without relying on the active CLI env.
- SDK update: Solidity `quoteAmountsOutWithUpdate` / `quoteAmountsInWithUpdate` map to quote-only PTB route composition on Sui. `quoteExactInputWithRegisteredRoute` and `quoteExactOutputWithRegisteredRoute` build provider price bundles, then chain single-hop bundle quote calls and return route-order amount handles. Cutoff-aware exact-output route amounts expose each hop's effective output, while the raw/no-cutoff exact-output helpers keep the requested-output / raw-required-input chain. `quoteExactInputWithPythRoute`, `quoteExactOutputWithPythRoute`, and `quoteMaxBoundWithPythRoute` add the Pyth fetch/update step before the same quote chain; matching `preflightQuote*WithPythRoute` wrappers build those quote-only PTBs and pass them through the fail-closed Sui dry-run gate.
- SDK update: `sdk/router` now includes Stork REST endpoint helpers, latest-price response extraction, `createStorkRestSignedPriceFetcher`, a `stork-rest` route price provider, and standard-registry wiring for the documented `/v1/prices/latest?assets=...` response shape and `Authorization: Basic <token>` header. It feeds the existing Stork signed-price updater before BrownFi Stork reading bundles; live Stork update execution against real Sui state remains pending.
- SDK update: `sdk/router` now includes dependency-free `dryRunBuiltTransactionBlock`, `buildAndDryRunTransactionBlock`, `getDryRunTransactionBlockStatus`, `assertDryRunTransactionBlockSucceeded`, `preflightBuiltTransactionBlock`, and `buildAndPreflightTransactionBlock` helpers for caller-provided Sui transaction/client objects. It also includes `preflightSwapExactInputWithRegisteredRoute`, `preflightSwapExactOutputWithRegisteredRoute`, and `preflightSwapExactOutputWithRegisteredRouteResults` wrappers that build the registered-provider route PTB, then build and fail-fast dry-run the exact transaction bytes, plus `preflightRegisteredRouteCases` for running a named exact-input/exact-output/result-aware exact-output route matrix through the same gate. `buildRegisteredRoutePreflightCases` hydrates serializable named route configs with a caller-provided transaction factory and provider registry, validates provider IDs and executable route shape before creating transactions, and keeps deployment object IDs outside the SDK while still feeding the same fail-fast matrix runner. Pyth provider coverage now proves hydrated exact-input, exact-output, and add-liquidity route cases fetch update payloads, call `updatePriceFeeds` before any BrownFi Move calls, build the Pyth reading-pair bundle, then dry-run the same PTB bytes; Pyth remove-liquidity route coverage proves LP burn preflight skips oracle updates and goes straight to `remove_liquidity_with_coins`. `buildRegisteredRouteCaseTransaction` and `buildRegisteredRouteCaseTransactions` compose those hydrated route cases into PTB commands without dry-running, so launch tooling can share the same route construction path for both preflight and landed submission. Registered-route matrix preflight can now take a `transferRecipient` and consume returned route coin objects before dry-run, matching landed-submit output ownership while preserving previous behavior when no transfer recipient is supplied. This exposes the documented Sui PTB build-to-`dryRunTransactionBlock` path and a preflight layer that requires `effects.status.status == "success"` before treating a route transaction as simulated successfully; it does not by itself replace live validation against real provider objects.
- SDK update: registered route preflight cases now also support single-pair `add-liquidity` and `remove-liquidity` cases. The add-liquidity hydrator validates one resolved pair in pair type order, builds the selected provider's bundle, calls `router::add_liquidity_with_bundle`, and dry-runs the PTB through the same launch preflight gate. The remove-liquidity hydrator uses the same pair-order validation and dry-run gate, but calls `router::remove_liquidity_with_coins` directly because LP burns do not need an oracle price bundle. The Pyth-current, Pyth-upgraded, and no-Supra launch matrix templates now include add-liquidity and remove-liquidity cases alongside swap and quote coverage.
- SDK/tooling update: registered route preflight and landed-submit cases now also support single-pair `zap-in-a`, `zap-in-b`, `zap-out-a`, and `zap-out-b`. Zap-in cases validate one pair in pair type order, build one provider bundle, call `router::zap_in_a_with_bundle` or `router::zap_in_b_with_bundle`, and transfer the two residual coins plus LP coin returned by Move. Zap-out cases validate the same pair shape, split the configured LP coin when `inputAmount` is set, call `router::zap_out_a_with_bundle` or `router::zap_out_b_with_bundle`, and transfer the single returned output coin. The current-Pyth launch matrix template and verifier-only live-evidence matrix both include all four zap cases while keeping `providerIds: ["pyth"]`.
- SDK update: `sdk/router` also exposes launch-validation quote case builders: `createExactInputRouteQuoteValidationCase`, `createExactInputWithoutCutoffRouteQuoteValidationCase`, `createExactOutputRouteQuoteValidationCase`, `createExactOutputRoundTripRouteQuoteValidationCase`, `createExactOutputWithoutCutoffRouteQuoteValidationCase`, `createMaxBoundRouteQuoteValidationCase`, `buildLaunchValidationQuoteCases`, `preflightLaunchValidationCase`, `preflightLaunchValidationCases`, and `preflightLaunchValidationQuoteCases`. These helpers bind named registered-provider quote routes to the same fail-fast dry-run gate, creating a fresh caller-supplied transaction per matrix case. Serializable quote case configs can now be hydrated into runnable validation cases or preflighted directly, so deployment object IDs can live outside the SDK while still feeding the same matrix runner. Pyth quote-preflight coverage now proves both launch-matrix quote cases and direct Pyth quote preflight wrappers fetch Pyth update payloads, call `updatePriceFeeds` before any BrownFi Move calls, build the Pyth reading-pair bundle, then dry-run cutoff-aware, raw/no-cutoff, and max-bound quote-only PTB bytes; the exact-output round-trip quote case feeds the cutoff-aware exact-output required-input handle into the matching exact-input quote chain in the same PTB. Quote config hydration validates provider IDs and executable route shape against the supplied registry/pairs before PTB construction, and max-bound launch quote configs are single-hop because the underlying Move helper is single-hop. They are scaffolding for live Pyth/Switchboard/Stork/Supra launch checks and intentionally do not hard-code provider secrets, package IDs, pools, feed IDs, or Sui object IDs.
- SDK update: `buildLaunchValidationMatrix` and `preflightLaunchValidationMatrix` compose the state-changing registered-route preflight section and quote-only launch-validation section into one dependency-free launch matrix. The matrix rejects configs with no route or quote cases, requires transaction factories only for populated sections, dry-runs route cases before quote-only cases, uses caller-supplied transaction factories for PTB creation, and returns sectioned results so launch scripts can report route execution failures separately from provider quote-read failures without accidentally reporting success for a no-op matrix. `validateLaunchValidationMatrixConfig` hydrates the same serializable matrix with offline provider stubs, enforces provider IDs, executable route shape, launch route limits, coverage for every declared launch provider, FlowX AMM route/quote coverage whenever `ammProviderIds` declares `flowx`, and optional live provider metadata checks; the current provider-metadata check requires every resolved `pyth` route/quote hop to carry exactly two 32-byte hex feed IDs. It then returns deterministic route/quote-kind/provider coverage before any real provider fetch/update or PTB construction. The CLI launch-matrix validator also compares matrix `providerIds` and `ammProviderIds` against the launch package profile when `--launch-config` is supplied, and enables provider-metadata checks when `--require-live-values` is used, so oracle/AMM source subsets and live Pyth feed metadata cannot drift between package generation and matrix validation. `summarizeLaunchValidationMatrixPreflightResult` turns successful sectioned results into deterministic route/quote-kind/provider coverage for deployment logs without inspecting arbitrary Sui dry-run payloads, and `runLaunchValidationMatrixPreflight` composes the live dry-run and summary steps into a single launch-report helper.
- Tooling update: `tools/check-sui-gas-readiness.mjs` checks live SUI gas before attempting landed launch transactions. It can use `sui client gas --json` or JSON-RPC `suix_getCoins` through `curl`, requires at least one SUI gas coin plus an optional minimum total mist, and emits the Sui testnet faucet URL for unfunded testnet addresses. `tools/run-launch-matrix-preflight.mjs --check-gas` and `tools/run-launch-matrix-submit.mjs --check-gas` now run this gate after live matrix validation but before runtime import, provider fetch/update work, PTB construction, dry-run, or submission. The current testnet launch address is funded; the latest Node 24 current-Pyth readiness check before the current-HEAD launch saw `9,479,827,764` mist, and the post-launch gas check saw `8,831,111,940` mist.
- Tooling update: `tools/publish-launch-package.mjs` is the live counterpart to the publish dry-run verifier. It rebuilds the selected launch package, optionally checks Sui gas, publishes with an explicit `--client.env <network>`, requires successful effects, verifies expected published modules/dependencies, and returns the published package ID plus extracted publish objects needed to materialize the pool-create config and live launch matrices. Earlier current-Pyth publish evidence exists for package `0x97a004455b11ab75b10bd3bf4d9fe1b01e4da17140d30dcb2ddfe24319076c98` in transaction `3JhxmCnFGDHBmZ1TxYijvLzGJg9EXC6ghEmxe8GefPUb`; the active verifier-ready package/pool/route evidence is tracked in the current-Pyth evidence section below. The upgraded-Pyth path remains a separate launch-readiness item.
- Tooling update: `tools/materialize-launch-matrix.mjs` turns a placeholder matrix template plus explicit live replacement values, optional publish result, and optional pool-create result into a live-value-clean matrix. It validates the result with the existing launch-matrix validator before writing the output, so missing pool, coin, feed, LP, or package IDs fail before provider fetch/update or Sui submission work.
- Tooling update: launch matrix templates use explicit `TYPE_A`/`TYPE_B` placeholders for token types instead of deriving token types from `0xBROWNFI_PACKAGE`. The BrownFi launch package does not define sample `coin_a`/`coin_b` modules, so token package IDs must be supplied as live values independently from the BrownFi package ID.
- Tooling update: `tools/extract-launch-publish-objects.mjs` parses Sui publish JSON and extracts the published package ID, shared `Factory`, shared `OracleAdapter`, factory-bound `PoolCreatorCap`, and known factory capability IDs. Together with the SDK `createPoolWithCoins` builders, this closes the offline handoff from live package publish to the pool-creation transaction inputs required before matrix preflight/submit.
- Tooling update: `tools/materialize-pyth-launch-pool.mjs` turns the Pyth pool template, publish-object extraction output or publish-runner summary, and explicit live token/feed/init-coin values into a live-value-clean pool-create config. It treats BrownFi package/factory/oracle/cap IDs as publish-derived values, token types/feed IDs/init coins as explicit live values, supports token decimal overrides, accepts the explicit `--publish-result` CLI flag for publish-runner summaries, and validates through the same pool-create config gate before writing output. `configs/launch/pyth-upgraded-testnet.values.example.json` records the shared live-value shape used by both the Pyth pool materializer and the launch-matrix materializer.
- Tooling update: `packages/launch-test-coins` is a separate launch-only Sui package for testnet/devnet validation tokens. It uses the current `coin_registry::new_currency_with_otw` path, publishes `coin_a::COIN_A` and `coin_b::COIN_B`, mints two 9-decimal coins for each token during publish, and transfers treasury caps to the publisher for follow-up minting. It is intentionally outside the BrownFi core package so production BrownFi does not ship sample token modules. `tools/publish-launch-test-coins.mjs` publishes that package and returns the same replacement shape as `tools/extract-launch-test-coins.mjs`.
- Tooling update: `tools/materialize-pyth-launch-pool.mjs` and `tools/materialize-launch-matrix.mjs` now accept repeated `--values` files and merge known replacements with conflict checks. This lets operators feed test-coin publish output plus a small Pyth feed-values file into both pool creation and add/remove/swap matrix materialization without manually merging JSON. `configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json` records the current live feed values used by the current-Pyth testnet path, `configs/launch/pyth-upgraded-testnet.feeds.example.json` records the generic feed-only replacement shape, and `tools/launch-assembly.test.mjs` proves the checked-in Pyth-current and Pyth-upgraded pool/matrix templates can be assembled from BrownFi publish output, launch test-coin output, feed values, and pool-create output.
- Tooling update: `tools/run-pyth-launch-sequence.mjs` is the thin Pyth-backed live launch orchestrator over the existing checked tools. By default it uses the verified current-Pyth testnet profile: `configs/launch/pyth-current-testnet.json`, `configs/launch/pyth-current-testnet.pool.example.json`, and `configs/launch/pyth-current-testnet.matrix.example.json`. The Pyth-upgraded profile remains selectable explicitly with `--launch-config`, `--pool-template`, and `--matrix-template` while its live update path is kept separate. The sequence publishes launch test coins, publishes the BrownFi launch package, writes `test-coins.json` and `brownfi-publish.json`, materializes the Pyth pool config, creates the Pyth-backed pool, materializes the exact-input/exact-output/result-aware exact-output swap plus add/remove/zap/flash launch matrix, can dry-run the no-spend quote cases with `--preflight-quotes`, submits state-changing route cases, optionally claims protocol LP after route submission when the pool-create report includes protocol-fee setup evidence, and writes `pool-result.json`, `matrix.json`, optional `quote-preflight.json`, `submit.json`, optional `protocol-lp-claim.json`, and `summary.json` under one output directory. It does not bypass the existing gas, signer, Pyth runtime, quote preflight, or tx-evidence gates; with `--verify-tx-evidence`, it verifies generated setup evidence before route submission, submit verifies route evidence as each route lands, and optional protocol-LP claim evidence is verified after route submission. The sequence can resume explicitly with `--resume-existing-artifacts`, which reuses already-successful test-coin publish, BrownFi publish, pool-create, and optional protocol-LP claim artifacts instead of duplicating landed setup transactions; setup verification still rechecks those resumed artifacts when requested, and submit still writes incremental snapshots and resumes from prefix `txEvidence`. Current-Pyth testnet evidence now exists for package publish, pool creation, protocol-fee setup, flash enable, exact-input swap, exact-output swap, result-aware exact-output swap, add liquidity, remove liquidity, zap-in A/B, zap-out A/B, flash-borrow A/B, and protocol-LP claim.
- Tooling update: `tools/extract-launch-pool-create-objects.mjs` parses a successful pool-creation transaction JSON, requires the BrownFi `PoolCreated` event, extracts the pool ID, finds the created LP coin object, and emits `POOL`/`LP_COIN` replacement values for matrix materialization.
- SDK update: `fetchAndUpdatePythPriceInfoObjectsFromFeeds` fetches Hermes update data through a caller-provided Pyth price-service connection and calls a caller-provided `SuiPythClient.updatePriceFeeds`, returning the updated `PriceInfoObject` IDs without constructing a BrownFi price bundle. This covers the pre-pool launch step where `swap::create_pool_with_coins` needs live Pyth `PriceInfoObject` inputs before any BrownFi pool exists.
- Tooling update: `tools/create-pyth-launch-pool.mjs` composes the pre-pool Pyth update step with `swap::create_pool_with_coins_and_transfer_lp_to_sender`, requires the Pyth runtime to expose its price-service connection/client plus object-change-aware execution, rejects unresolved pool-config placeholders and malformed 32-byte Pyth feed IDs before touching the runtime, extracts the created pool/LP coin, and returns `txEvidence` plus `POOL`/`LP_COIN` replacements for matrix materialization. `configs/launch/pyth-upgraded-testnet.pool.example.json` records the expected live pool-creation config shape.
- Tooling update: launch-matrix `--require-live-values` now rejects generic uppercase snake-case provider placeholders such as `SUPRA_HOLDER_ID`, in addition to the existing BrownFi/Pyth/Stork/Switchboard template tokens and placeholder-looking `0x...` values. This keeps live dry-run gates fail-fast when non-Pyth provider object/feed/proof placeholders are still present.
- SDK update: `addLiquidityWithRegisteredRoute` now composes a selected route price provider's single-hop bundle with `router::add_liquidity_with_bundle`. This gives live launch runtimes the same provider-registry boundary for add-liquidity PTBs that swaps and route quotes already use, without defining unsupported multi-hop liquidity semantics.
- Source hot-path update: BrownFi-owned Pyth, Switchboard, Stork, Supra push, and Supra pull source reads now take only the concrete provider objects/proofs, `Clock`, and `Pool`. They validate pool-local source type, source object ID, source config, and max-age policy directly instead of borrowing the global `OracleAdapter`. Direct `OracleAdapter` wrappers remain as compatibility entry points.
- SDK update: the Pyth-only convenience layer now covers the current launch route surface, not only swaps and quotes. `addLiquidityWithPythRoute`, `removeLiquidityWithPythRoute`, `zapWithPythRoute`, and `flashBorrowWithPythRoute` are thin wrappers over the registered-route builders and existing bundle/flash entrypoints; remove-liquidity remains oracle-free and does not fetch Pyth updates. The same convenience layer also exposes recipient-aware `addLiquidityWithPythRouteAndTransfer`, `removeLiquidityWithPythRouteAndTransfer`, and `zapWithPythRouteAndTransfer` wrappers over the existing Move transfer entrypoints, matching the Solidity router `to` behavior for LP/output delivery while keeping residual/change handling inside the Move functions. Pyth swap convenience wrappers now also have recipient-aware single-hop and typed two-hop exact-input/exact-output variants over the existing bundle transfer entrypoints. For arbitrary-hop exact-input token paths, `swapExactInputWithPythRouteAndTransfer` composes the existing dynamic SDK/PTB route with a final `transferObjects` command for the output coin. For result-aware arbitrary-hop exact-output token paths, `swapExactOutputWithPythRouteResultsAndTransfer` composes the existing quote-chain route planner with explicit transfer commands that send change coins to caller-supplied `refundRecipient` and the final output coin to `recipient`; no on-chain dynamic generic router is introduced. `preflightSwapExactInputWithPythRoute`, `preflightSwapExactOutputWithPythRoute`, `preflightSwapExactOutputWithPythRouteResults`, `preflightAddLiquidityWithPythRoute`, `preflightRemoveLiquidityWithPythRoute`, `preflightZapWithPythRoute`, `preflightFlashBorrowWithPythRoute`, `preflightQuoteExactInputWithPythRoute`, `preflightQuoteExactInputWithoutCutoffWithPythRoute`, `preflightQuoteExactOutputWithPythRoute`, `preflightQuoteExactOutputWithoutCutoffWithPythRoute`, and `preflightQuoteMaxBoundWithPythRoute` give Pyth callers the same build-then-dry-run gate as registered-provider routes and launch quote cases without manually constructing a Pyth-only provider registry.
- Exact-input swap output now uses the BrownFi V3 Q32 forward formula, including the K=2 constant-product branch. Core, single-hop router, and typed two-hop router exact-input/exact-output swaps can consume prebuilt `PriceBundle` values, while legacy direct-`OracleAdapter` wrappers remain for compatibility. Exact-input quote helpers now expose the effective output, raw pre-cutoff output, and gamma-cutoff output for both direct and bundle paths. Single-hop direct/bundle max-bound quote helpers now expose `(max_input, max_output)` under the current gamma cutoff and Sui integer-rounding semantics, with router delegators and SDK builders for frontend/PTB use. Typed two-hop bundle exact-input quote helpers now expose forward/reverse route amounts for cutoff-aware and raw/no-cutoff paths, matching the Solidity periphery `getAmountsOut` / `getAmountsOutWithoutCutoff` split in a typed Sui form. The SDK registered-provider exact-input quote path now also has `quoteExactInputWithoutCutoffWithRegisteredRoute`, which chains the raw pre-cutoff output returned by each single-hop bundle quote. Exact-output/backward quote math, single-hop state-changing exact-output core/router entry points, single-hop direct/bundle raw exact-output quote helpers, typed forward/reverse two-hop exact-input and exact-output router helpers, typed two-hop bundle exact-output route quote helpers, typed two-hop bundle raw/no-cutoff exact-output route quote helpers, and core/router bundle add-liquidity entry points exist. Direct compatibility wrappers now include recipient-aware exact-input/exact-output swaps including typed two-hop A/B/C helpers, add-liquidity, remove-liquidity, and zap-in/zap-out entrypoints, with the older sender wrappers retained as compatibility delegators where they already existed. Bundle exact-input and exact-output swap wrappers now include recipient-aware A->B, B->A, A-for-exact-B, and B-for-exact-A entrypoints; exact-input wrappers send the output coin to the requested recipient, while exact-output wrappers refund unused input coins to `tx_context::sender` and send the requested output coin to the requested recipient. Bundle add-liquidity now includes a recipient-aware entrypoint that sends residual token coins back to `tx_context::sender` and LP to the requested recipient. Bundle zap wrappers now include recipient-aware zap-in/zap-out entrypoints; zap-in sends LP to the requested recipient while refunding residual token coins to `tx_context::sender`, matching Solidity's documented `to` plus dust-refund split. Typed two-hop exact-output helpers now reject a second-hop gamma cutoff before executing the first hop for both direct and bundle paths, and the typed bundle quote helpers surface the required input, intermediate effective output, and terminal effective output for Solidity `getAmountsIn`-style cutoff propagation. The raw/no-cutoff exact-output helpers skip the gamma iteration and chain required inputs backward, matching Solidity `getAmountsInWithoutCutoff` for quote-only use. `sdk/router` now has tested TypeScript PTB thunks for BrownFi-owned Pyth reading construction, Pyth Hermes-fetch/update-to-BrownFi bundle orchestration through injected `SuiPriceServiceConnection`- and `SuiPythClient`-compatible objects, source-backed Pyth Hermes/Sui client configuration helpers with upgraded Sui contract IDs as the default, route-level Pyth bundle construction that deduplicates feed updates across typed hops, Switchboard quote-fetch-to-BrownFi bundle orchestration through an injected `fetchQuoteUpdate`-compatible function, official-shape Switchboard `SwitchboardClient`/`fetchQuoteUpdate` provider construction with quote-update options pass-through, Stork update-to-BrownFi bundle orchestration through an injected `updatePriceFeeds`-compatible function, Supra-push route bundle construction without update hooks, Supra-pull proof-to-bundle construction with optional AMM readings, oracle-only reading-pair bundle construction, FlowX direct and two-hop AMM reading construction, provider-independent FlowX direct and two-hop AMM route wrappers, AMM-blended reading-pair bundle construction, bundle-native single-hop exact-input/exact-output swaps, direct `OracleAdapter` compatibility swaps/add-liquidity/quotes/zaps, add/remove liquidity, recipient-directed direct single-hop/two-hop swap/add/remove/zap builders, recipient-directed bundle exact-input/exact-output swap builders, recipient-directed bundle add-liquidity builders, recipient-directed bundle zap builders, flash coin borrow/repay, single-hop bundle quotes including max-bound quote builders, typed two-hop bundle quotes, typed two-hop prebuilt-bundle exact-input/exact-output swap calls, mixed-orientation typed two-hop exact-output swap calls, direct typed two-hop `OracleAdapter` compatibility swap calls, Pyth-backed typed single-hop/two-hop exact-input/exact-output route swap orchestration, provider-registered exact-input/exact-output route planning, registered and Pyth exact-input/exact-output raw/no-cutoff route quote planning, cutoff-aware registered/Pyth exact-output quote amount chains that expose effective route outputs, result-aware registered and Pyth exact-output route quote-chaining and preflight for arbitrary positive-length paths, Switchboard, Stork, Stork-REST, Supra-push, and Supra-pull registered-provider route planning, standard provider registry construction for explicit Pyth/Switchboard/Stork/Stork-REST/Supra-push/Supra-pull config with optional FlowX direct/two-hop AMM wrapping, dynamic exact-input Pyth PTB route planning for arbitrary positive-length token paths, arbitrary-hop exact-input Pyth route output transfer through SDK/PTB composition, compatibility dynamic exact-output Pyth planning for all current one/two-hop orientation combinations, result-aware arbitrary-hop Pyth exact-output planning through `swapExactOutputWithPythRouteResults`, and result-aware exact-output change/output transfers through `swapExactOutputWithPythRouteResultsAndTransfer`. Scaled 9-decimal Sui fixtures now cover all 12 Solidity periphery `TX_CASES` forward `getAmountOut` raw outputs and backward `getAmountIn` required inputs under the Solidity test's 50 bps tolerance, all 36 Solidity Core Module symmetric-kappa library data rows across B1/B2/B3 for both forward and backward quote directions under their 100 bps tolerance, all 48 Solidity periphery/Core Module library round-trip `getAmountOut(getAmountIn(out))` rows under their 10 bps tolerance, the Solidity Core Module vector A tx1 SELL exact-output/protocol-LP path and tx1+tx2 BUY continuation with the same LP tolerances used by the Solidity tests, all 36 Solidity periphery `LP_MINT_B1/B2/B3` Pyth-only protocol-LP sequence rows under their documented 200 bps tolerance, the Solidity Pair integration initial/existing-pool balanced mint, imbalanced mint, equal-price `lp1 == lp2` path, and burn/remint LP cases, and the Pair integration high-fee exact-output underpayment/sufficient-input cases in scaled Sui form; the BUY continuation models EVM fee-grossed prefund as Sui overpayment with explicit change, underpaid exact-output max input aborts before pool mutation, and Solidity's same-token/out-token prefund guard is structural on Sui because callers cannot raw-transfer into pool balances. Pyth launch runtime validation now fails early when `requirePythApiKey` is set and the configured environment variable is missing, but production secret provisioning, live Stork/Switchboard update integration, live Supra push holder validation, live Supra pull proof validation, and broader shared EVM/core fixture parity are still pending.
- Typed two-hop prebuilt-bundle exact-input swaps now also have recipient-directed final-output wrappers and SDK builders for the forward A->C via B and reverse C->A via B routes. Existing return-coin functions remain the composable PTB path.
- Typed two-hop prebuilt-bundle exact-output swaps now also have recipient-directed wrappers and SDK builders for the forward A-for-exact-C via B and reverse C-for-exact-A via B routes. They refund non-output coins to `tx_context::sender` and transfer the final output coin to the requested recipient; existing return-coin functions remain the composable PTB path.
- Fee handling now uses `pseudo_in = actual_in * PRECISION / (PRECISION + fee)`, rounded down.
- Protocol fee recipient state is now pool-local for protocol LP accrual and claiming.
- Swap and add-liquidity pause state is now pool-local with separate bits; factory pause no longer blocks swaps/adds.
- Initial LP minting now uses Pyth-only value with `MINIMUM_LIQUIDITY = 1000` locked in a pool-owned non-withdrawable balance, and pool creation rejects token decimals above the Solidity-backed `18` bound. The Solidity `$10` initial-value threshold is implemented as `MIN_INITIAL_POOL_VALUE = 10_000_000_000` in Sui's normalized 9-decimal value units. Pool exposes BrownFi-local LP display helpers matching `BrownFiV3ERC20` name/symbol/decimals; this deliberately does not register official Sui `CoinMetadata`/Currency for LP because that would require a separate supply-authority design.
- Pool creation now requires a factory-bound `PoolCreatorCap`; factory hot-path removal for execution APIs is implemented, while global oracle hot-path removal remains separate.
- The V3 gamma cutoff and inventory check are present for exact-input and exact-output swaps; gamma cutoff uses `adj_price`, while inventory verification uses the direction-selected base price (`sell_price` for sell, `buy_price` for buy), matching Solidity. The legacy fixed 80 percent swap size guard has been removed.

## Architecture Debate

| Topic | Option A | Option B | Decision | Reason |
|---|---|---|---|---|
| Core shape | Clone EVM Factory plus PairConfig plus Pair | Sui-native pool object with pool-local hot config | Use Sui-native | Sui shared object locking makes a global factory/oracle hot path unnecessary and costly. |
| Config location | External PairConfig object | Pool-local `Config` fields plus admin capabilities | Pool-local | Swap should borrow one mutable pool and read its own settings. Admin can still emit config events. |
| Oracle ownership | Global `OracleAdapter` keyed by token type | Pool-local oracle policy with source IDs/feed IDs | Pool-local policy | Different pairs need different quorum, staleness, confidence, and fallback rules. |
| Price values | User passes raw prices | Adapter mints unforgeable `PriceReading` values | Unforgeable readings | Public raw price inputs are forgeable. Readings must carry source, feed ID, timestamp, confidence, scale, and signer/proof validation. |
| AMM TWAP | Generic DEX interface | Per-DEX adapters | Per-DEX | Cetus, Turbos, Aftermath, DeepBook, and other sources expose different state and TWAP/liquidity semantics. |
| Multi-oracle updates | Update all oracles inside swap | Separate update phase from read/quorum phase | Separate | Pyth, Stork, Switchboard, and Supra have different update proofs, fee coins, and object mutability. |
| Router | EVM dynamic `address[] path` | PTB SDK plus typed Move helpers | PTB-first | Move generics are static. PTBs are the universal composition layer. |
| Flash swap | EVM callback | Hot-potato receipt | Hot-potato | Sui has no EVM-style reentrancy/callback model. Receipt validation is the correct linear-resource pattern. |
| Math precision | Port Q64/u256 blindly | Use bounded fixed point with explicit rounding | Bounded and tested | Sui Move integer and gas constraints require explicit bounds and rounding tests. |
| Day-one scope | Fully implement every integration | Include all interfaces and gates, implement sources incrementally | Interfaces plus gates | This preserves upgrade path without pretending unverified adapters are safe. |

## High-Level Graph

```text
User wallet / aggregator
        |
        v
Programmable Transaction Block
        |
        +--> optional Pyth / Stork / Switchboard / Supra update calls
        |
        +--> BrownFi router SDK or typed Move helper
                 |
                 +--> oracle adapters produce PriceReading values
                 +--> AMM adapters produce AmmReading values
                 +--> oracle_gateway builds PriceBundle
                 |
                 v
              swap / liquidity / flash modules
                 |
                 v
              Pool<A, B>
```

Factory is outside the hot graph:

```text
Factory
  - create pool
  - register pair
  - emit discovery events
  - hold package-wide defaults only
  - never required for normal swap math
```

## Package Layout

Initial package boundaries:

Runtime oracle policy is configurable per DEX/pool/route. The DEX does not need to enable every oracle adapter supported by the codebase; it should declare only the providers selected for that deployment, and pools should allow/require only the source masks they actually use. Sui package membership is a separate publish-time decision. Disabled adapters in the same package are still verified by Sui during publish, so a launch package should include only the source modules selected for that deployment and proven against the current Sui verifier. Shipping a source module does not mean every pool must enable it; pool oracle/AMM policy and SDK provider config choose the active sources. Disabled, unverified, or verifier-blocked adapters should be left out of the package variant or moved behind a deliberately designed BrownFi-owned adapter package API.

The active live-evidence launch profile is `configs/launch/pyth-current-testnet.json`, built with `tools/build-launch-package.mjs`: it selects only `pyth`, copies Pyth current testnet contracts, rewrites Pyth and the root package to a repo-local exact Sui Wormhole source under `packages/wormhole-sui-current`, copies a launch-only `wormhole_link` shim so Sui publish includes current Wormhole in the direct dependency list, and excludes optional non-Pyth adapters from the publish source set. Supported adapters are not implicitly enabled for a DEX, pool, or launch profile: the published package source set, launch config `providerIds`, launch config `ammProviderIds`, pool source masks/configs, SDK provider registry, and matrix `providerIds` must all agree on the selected oracle and AMM subsets. The package generator rejects launch profiles that declare a known oracle or AMM provider without selecting its required BrownFi source module, and also rejects known provider source modules selected without a matching provider ID. That catches both missing-module and accidentally-enabled-module drift before Sui package generation. `configs/launch/no-supra.json` remains a broader reproducible development profile for historical/non-Pyth adapter testing, not the current active launch target. `configs/launch/pyth-upgraded-testnet.json` remains an explicit upgraded-Pyth validation profile, separate from the current-Pyth lane.

The companion launch-matrix templates are `configs/launch/no-supra.matrix.example.json`, `configs/launch/pyth-current-testnet.matrix.example.json`, and `configs/launch/pyth-upgraded-testnet.matrix.example.json`, validated offline with `tools/validate-launch-matrix.mjs --config <file>`. This checks provider IDs, route shape, launch route limits, and deterministic route/quote-kind/provider coverage before live provider fetch/update work or Sui PTB dry-runs. The Pyth-current template includes one-hop exact-input and exact-output route cases, add/remove liquidity cases, zap-in/zap-out cases, flash-borrow-A/B cases, cutoff-aware plus raw/no-cutoff exact-input/exact-output quote cases, an exact-output round-trip quote case, and a max-bound quote case. The Pyth-upgraded template remains a narrower explicit validation profile with one-hop swap, add/remove, and quote coverage. `providerIds` is the configured launch subset, not a list of every BrownFi-supported oracle. `ammProviderIds` is the configured launch AMM subset, separate from oracle providers. Every provider listed in `providerIds` must appear in at least one route or quote case, so the selected launch source set is also a validation coverage set. Every known AMM provider listed in `ammProviderIds` must likewise appear in route/quote data that exercises its source-specific AMM route fields; today that means `flowxDirectAmm` or `flowxTwoHopAmm` for `flowx`. Providers omitted from `providerIds` or `ammProviderIds` are intentionally disabled for that matrix and require no coverage. Passing `--launch-config <file>` additionally requires the matrix `providerIds` and `ammProviderIds` to match the launch package profile, preventing a Pyth-only or no-Supra package profile from being validated against the wrong oracle or AMM set. The templates contain placeholder package, pool, coin, feed, and verifier object IDs; before live dry-runs, run the same tool with `--require-live-values` so template placeholders and malformed live Pyth feed IDs fail before provider calls or Sui PTB construction. Placeholder templates are still allowed through the normal offline validator so launch profiles can be checked before concrete feed/object IDs exist. `configs/oracles/pyth-sui-contracts.json` records the documented Pyth Sui current/upgraded contract IDs for mainnet/testnet, with `upgraded` as the generic SDK helper default, and `tools/validate-pyth-sui-contracts.mjs --manifest configs/oracles/pyth-sui-contracts.json` checks that manifest against `sdk/router` constants. `configs/launch/pyth-current-testnet.runtime.example.json` is the default live launch runtime config, while `configs/launch/pyth-upgraded-testnet.runtime.example.json` remains available for explicit upgraded-Pyth validation. `tools/validate-pyth-launch-runtime.mjs --runtime-config <file> --manifest <file>` validates either runtime config against the documented Pyth manifest before live provider work. With `--matrix <file> --launch-config <file> --require-live-values`, the same tool additionally requires a Pyth-only live matrix and two 32-byte Pyth feed IDs per route or quote hop. `tools/read-pyth-sui-update-fee.mjs --manifest configs/oracles/pyth-sui-contracts.json --network <network> --contract-set <set>` dev-inspects the same manifest-backed Pyth contracts for their live update fee; when `--contract-set` is omitted it defaults to `current`, matching the verified BrownFi current-Pyth launch profile, while `--contract-set upgraded` remains explicit. `tools/verify-launch-package-publish-dry-run.mjs --config <file> --network <network>` regenerates a launch package, runs Sui publish dry-run, and can assert expected published modules plus external dependency package IDs; the Pyth-current and Pyth-upgraded testnet profiles use it to prove the generated package links to the selected Pyth/Wormhole contracts instead of disabled oracle packages. These are config drift, provider-contract readiness, and publish-verifier guards only; they do not prove a live Pyth-backed BrownFi route. `configs/launch/devnet-smoke.matrix.json` is the current live-value-clean devnet artifact for the landed launch-shaped smoke package and pool, using the temporary `devnet_smoke` source wrapper rather than real oracle providers; it now records both landed add/swap/remove transaction evidence and a successful Sui CLI dry-run of a state-changing smoke swap route. `tools/verify-sui-cli-tx-evidence.mjs --config <file> --tx <name>` verifies a matrix `txEvidence` digest by querying either `sui client tx-block --json` or Sui JSON-RPC via `--rpc-url`, requires success, verifies the digest, and checks expected Move call targets and event types; it also accepts `--tx-json <file>` for environments where transaction output is prefetched. `tools/verify-sui-cli-dry-run-evidence.mjs --config <file> --case <name>` replays route-case `suiCliDryRun` commands and requires successful Sui dry-run status plus expected BrownFi event types, so smoke evidence can be refreshed instead of copied from terminal output. `tools/run-launch-matrix-preflight.mjs --config <file> --launch-config <file> --runtime <module>` is the live-runner boundary for SDK/provider-backed matrix dry-runs: it requires live-ready values, checks matrix provider IDs against the launch profile when supplied, imports a caller-supplied runtime module for Sui client, transaction factories, and provider registry wiring, checks the runtime network against matrix `network` when declared, then prints deterministic coverage after `runLaunchValidationMatrixPreflight` succeeds. `tools/run-launch-matrix-submit.mjs --config <file> --launch-config <file> --runtime <module>` uses the same live-ready/runtime/gas gates for state-changing route cases, composes them through the SDK registered-route builder, calls a runtime-provided `executeTransaction`, requires successful execution effects, and prints `txEvidence`-ready digests with inferred BrownFi Move-call and event expectations for swap/add/remove/zap/flash cases. Replacing placeholder values and supplying a real runtime module with current Sui/provider objects is still required before production routing.

Submit verification update: `tools/run-launch-matrix-submit.mjs --verify-tx-evidence` immediately verifies generated submitted-route evidence through Sui CLI or JSON-RPC and returns `txVerification` summaries only after the landed transaction includes the expected BrownFi Move calls and events. The submitter supports bounded RPC retries for transient Sui fullnode indexing lag, transfers all linear coin outputs returned by route calls, including exact-output change/output coins and the three-return `router::add_liquidity_with_bundle` shape, can write incremental `--out` snapshots after every submitted digest, and can resume from prefix `txEvidence` in an existing submit report without duplicating already-landed route transactions.

Current-Pyth testnet launch evidence: the verifier-ready live evidence artifact at `configs/launch/pyth-current-testnet.live-evidence.matrix.json` records the 2026-06-17 protocol-fee launch. Test coins package `0x7f05d737f545fdca57539f9c85b44f50e66860832e161b80c58a5e0cbd7856ef` landed in digest `6cFqREnD264yWR14fToWiwwfuNkXutHcpsHXfjkHqifh`; BrownFi package `0x80503414708cfc44705615b9b10c31676af8b37ba6c83bbd86fefc3e069ecad9` landed in digest `13Sny17FWN4czLC2GybBRv5TPNMTBaRY4vPXkW5W9Tot`; pool `0x7bebba8475103e2779c2a951b00a003f588003602bf58656ad1fa74c4f222887` was created in digest `4ynf6oiMHk7wZUXFpqELwoCVwGnvmKPmoAG3L2BotrMu`; LP coin `0x0417af08ac65eeca14c4b3c3eb785232469305dc1b41b5110d3f387d5ea33032` was returned to the creator; protocol fee was configured in digest `HaxcXDwFRjxfn3D15hJDnZxrzibex75o5XqcM8x4pge`; flash was enabled in digest `9ozBVd3vD646e5GjYW9s8yUp3ZX5eS7FyRCHyq7R5W9`; and protocol LP was claimed in digest `AfcMRm9SQyNZ2zy8thJddAW3XftGMuVQikmuzK1zc4wH`. Each setup entry is recheckable with `tools/verify-sui-cli-tx-evidence.mjs --setup <name>`. Package publish setup checks verify digest, successful effects, and published package ID through Sui object changes. Pool setup also verifies the pool object ID, LP coin ID, expected BrownFi pool-create call, and `Sync` / `PoolCreated` events. Protocol-fee setup verifies `admin::set_pool_fee_to`, `admin::set_pool_protocol_fee`, and the expected fee/config update events. Protocol-LP claim verifies `admin::claim_protocol_lp` and `ProtocolLpClaimed`. The checked route evidence covers exact-input swap `HwRwdNGzGGpTWbX6ygoWbQR29JLVGQdMiwVbv5P51Af1`, exact-output swap `5LE3UMidsg8awmHUzSoHvXr24huRzYJUKT6AAZYGV9pM`, result-aware exact-output swap `87w8zKy94PfVWcYTzBKZHUFL74k2cpJyWsp4SSumTaVR`, add liquidity `4vMiuTdNHmqqmQVyHJxLLQB87HGNyqHhLpZYhCMdjVvh`, remove liquidity `A4RyrfATPS7HPWhQZAcemHqcuanoWfw6cz4ztQftKGc9`, zap-in-A `7VRTg2M9Uzoy1kc1NTZg6vjkhxnoVd9Xdo2UGhV6nEgx`, zap-in-B `G2rBTNqdkwwysCiRRfF2sKHXZ5T2VFtYHBUBAtvtM1R8`, zap-out-A `CBPqUWXwV8o6qiywcfxfbDBQYk68rD9BQMzfkhyRkSfm`, zap-out-B `9gNSeQ5EMTnjbHbUCeGTHQPZ5EWjFf9jbydbjk7PBvkJ`, flash-borrow-A `BtNqLWGRVTrogXAN63x52JixVL5TBeV4PeJxcjDcTkTG`, and flash-borrow-B `85kRkpDmcEXndb2bnncTS9FRzgBrnCYUfydwrkXiLJED`, each recheckable with `tools/verify-sui-cli-tx-evidence.mjs --tx <name>`. The same live-value-clean matrix also includes cutoff-aware exact-input/exact-output, exact-output round-trip, and raw/no-cutoff exact-input/exact-output quote cases so quote coverage is validated alongside the landed route evidence; quote cases intentionally have no `txEvidence` because they are no-spend validation cases.

Pyth runtime update: `tools/pyth-launch-runtime.mjs` is the checked-in runtime module for Pyth-only launch matrices. It loads `configs/launch/pyth-current-testnet.runtime.example.json` by default, or `BROWNFI_PYTH_RUNTIME_CONFIG` when set, wires `@mysten/sui` client/transaction primitives with Pyth's `SuiPriceServiceConnection` and `SuiPythClient` from `@pythnetwork/pyth-sui-js`, builds the SDK standard provider registry for `pyth`, and exposes the `suiClient`, route/quote transaction factories, and `executeTransaction` hook expected by the preflight and submit runners. `tools/package.json` plus `tools/package-lock.json` pin the live runtime dependency set; current Pyth JS packages declare Node `^24.0.0`, so launch operators should run the runtime under Node 24 even though this development shell can execute the dependency-injected tests under Node 25. Runtime secrets stay in env: RPC URL via `BROWNFI_SUI_RPC_URL`, submit key via `BROWNFI_SUI_PRIVATE_KEY`, optional dry-run sender via `BROWNFI_SUI_SENDER`, and optional Hermes token via the configured Pyth API-key env.

Pyth readiness update: `tools/check-pyth-launch-readiness.mjs` combines the live Pyth runtime validator, Node 24 engine check, dependency import check, optional submit-signer env check, and optional Sui gas check into one fail-fast guard before Pyth provider preflight or submission. It defaults matrix validation to live-value mode so placeholder package, pool, coin, and feed IDs fail before oracle fetch/update work.

Pyth operator runbook: `docs/PYTH_CURRENT_TESTNET_RUNBOOK.md` is the current handoff for the verified current-Pyth testnet path. It lists the checked defaults, no-spend validation commands, update-fee read, landed swap/add/remove evidence verification, fresh launch sequence, and resume flow.

- `pool.move`: pool object, LP supply, balances, pool-local config, deposits, withdrawals, LP mint/burn helpers.
- `config.move`: config structs, validation, bounds, update functions callable through capabilities.
- `factory.move`: pool creation, pair registry, admin cap minting, discovery events.
- `oracle_gateway.move`: quorum, AMM blend, skew, spread, and final `PriceBundle`.
- `pyth_source.move`: Pyth reading adapter.
- `stork_source.move`: Stork reading adapter.
- `switchboard_source.move`: Switchboard reading adapter.
- `supra_source.move`: optional Supra push reading adapter, included only in a package variant after the live ABI/package verifies cleanly.
- `supra_pull_source.move`: optional Supra pull proof-to-bundle adapter, included only in a package variant after the live ABI/package verifies cleanly.
- `amm_cetus.move`: Cetus adapter once verified.
- `amm_turbos.move`: Turbos adapter once verified.
- `amm_*.move`: other AMM adapters added only after source-specific review.
- `swap.move`: exact-input, exact-output, inventory verification, protocol fee LP accounting.
- `liquidity.move`: create/add/remove liquidity logic.
- `flash.move`: flash borrow/repay with hot-potato receipts.
- `router.move`: narrow typed convenience entry points only.
- `events.move`: analytics and monitoring events.
- `math.move`: fixed point, sqrt, mul-div, rounding helpers, bound checks.

The names can change during implementation, but the dependency direction should not:

```text
adapters -> oracle_gateway -> swap/liquidity -> pool
config -> pool
factory -> pool
router -> adapters + oracle_gateway + swap/liquidity/flash
```

`pool.move` should not depend on oracle adapters, factory, router, or external DEX packages.

## Pool Object

The pool should hold the state required for normal operation:

```move
public struct Pool<phantom A, phantom B> has key {
    id: UID,
    balance_a: Balance<A>,
    balance_b: Balance<B>,
    lp_supply: Supply<LP<A, B>>,
    protocol_lp: Balance<LP<A, B>>,

    token_a_decimals: u8,
    token_b_decimals: u8,
    quote_token_index: u8,

    config: PoolConfig,
    oracle_policy: OraclePolicy,
    amm_policy: AmmPolicy,

    fee_to: Option<address>,
    paused_swaps: bool,
    paused_add_liquidity: bool,
    flash_enabled: bool,
    router_enabled: bool,

    version: u64,
}
```

Rationale:
- Swap needs pool balances, token orientation, config, and price policy. It should not read factory state.
- `fee_to` is pool-local so protocol fee behavior can differ by market without shared-object contention.
- Separate pause bits allow swaps/adds to stop while removals stay available.
- `version` supports migration checks for future config layout changes.

Do not store arbitrary external object IDs without type/source validation. Any external source ID in `OraclePolicy` or `AmmPolicy` must include source kind, package/version expectation, token orientation, staleness limit, confidence/deviation bounds, and enabled flag.

## Factory Object

Factory responsibilities:

- Create and share `Pool<A, B>`.
- Enforce sorted type order and unique pair registration.
- Emit `PoolCreated`.
- Optionally store package-level default config templates.
- Own admin discovery fields for dashboards.

Factory should not be required by:

- `swap_exact_in`.
- `swap_exact_out`.
- `add_liquidity`.
- `remove_liquidity`.
- `flash_borrow`.
- `flash_repay`.

Factory can remain an admin entry point that forwards to pool config updates, but the pool must be enough for execution.

Current implementation status: swap, exact-output quote/execution, add/remove liquidity, router helpers, and oracle-gateway price-bundle APIs no longer take `Factory`. Pool creation still takes `&mut Factory` plus a factory-bound `PoolCreatorCap`, which is expected because creation needs registry/default/template state.

## Capabilities And Governance

Use Sui capability objects instead of EVM roles:

- `AdminCap`: emergency and migration authority.
- `PoolCreatorCap`: create pools.
- `RiskCap`: set kB, kQ, lambda, gamma, spread, fee, fee split.
- `OracleCap`: set oracle policies, source allowlists, feed IDs, quorum thresholds.
- `AmmCap`: set AMM sources, TWAP windows, liquidity floors, AMM blend weight.
- `FeeCap`: set `fee_to` and claim protocol LP.
- `PauseCap`: pause swaps/add liquidity and enable/disable flash by pool.
- `RouterCap`: register typed helper modules if needed.

Governance/timelock should wrap capability use at the application layer. The core package should make authority explicit and narrow, not rely on one all-powerful shared admin object in every path.

Current implementation status: `AdminCap`, factory-bound `PoolCreatorCap`, `FeeCap`, `RiskCap`, `OracleCap`, `AmmCap`, `RouterCap`, and `PauseCap` exist. `FeeCap` gates pool `fee_to` updates and protocol LP claims. `RiskCap` gates pool fee, fee split/protocol fee, k, kB, kQ, lambda, gamma, and spreads. `OracleCap` gates pool oracle max price age, quorum/source-mask policy, supported aggregation policy, source/config updates, and the current Pyth/oracle-side weight. Oracle quorum config rejects `min_sources` values that exceed the number of allowed source-mask bits. Pools capture oracle source type, source object ID, and source config data at creation; direct Pyth compatibility paths validate the live `OracleAdapter` config against that snapshot before pricing, while BrownFi-owned source adapters validate pool-local source policy against their concrete source object/proof without borrowing `OracleAdapter`. For Pyth, Switchboard, Stork, and Supra push/pull, source config data is the feed ID/feed hash/encoded asset ID bytes or BCS-encoded `u32` Supra pair ID. Updating the pool source/config, aggregation policy, or Pyth weight increments policy version so old bundles and flash receipts fail closed. `pyth_source.move` now validates the pool-local Pyth source/config policy and mints BrownFi-owned `PriceReading` values through a package-only constructor; `switchboard_source.move` validates `switchboard` pool config, verifies Switchboard `Quotes` through a `QuoteVerifier`, normalizes 18-decimal quote results to 9-decimal BrownFi prices, and mints BrownFi-owned `PriceReading` values with zero confidence because Switchboard `Quote` exposes no confidence range; `stork_source.move` validates `stork` pool config, reads Stork `StorkState`, normalizes 18-decimal signed quantized values, enforces BrownFi staleness, and mints zero-confidence `PriceReading` values because Stork's Sui read API exposes no confidence range; `supra_source.move` validates `supra` pool config, reads Supra push `OracleHolder` values through `SupraSValueFeed::get_price`, normalizes decimal-scaled values, enforces BrownFi staleness, and mints zero-confidence `PriceReading` values because the push API exposes no confidence range; `supra_pull_source.move` validates the same `supra` pool config, verifies one pull proof through `price_data_pull_v2::verify_oracle_proof`, extracts both configured pair IDs, normalizes decimal-scaled values, enforces BrownFi staleness, and returns a `PriceBundle` directly with an AMM-reading variant. `oracle_gateway.move` can consume one reading pair or a vector of source-paired BrownFi readings into a `PriceBundle`; core, single-hop router, and typed two-hop router exact-input/exact-output swaps can consume pool-bound bundles directly. The direct Pyth compatibility wrapper constructs the same internal reading shape before bundle construction, preserving direct-wrapper compatibility while making direct and reading bundle digests match for the same Pyth object data. Core and router add-liquidity can now consume a pool-bound bundle and mint against the lower of oracle-quorum valuation and AMM valuation when AMM readings are present. The current multi-reading path supports primary-with-sanity and odd-source-count median mode. Primary-with-sanity uses the primary pair as the resolved price while secondary pairs satisfy quorum and deviation checks. Median mode sorts valid relative candidates, resolves to the middle candidate, checks candidates against the median reference when `oracle_max_deviation` is configured, and fails closed on even source counts until a tie policy is specified. Admin config rejects weighted-median mode until source-weight state is added. BrownFi reading-pair bundle `price_digest` values commit to every supplied reading's source, feed ID, price bounds, confidence, publish/validity time, exponent, decimals, and relative pair candidate. `AmmCap` gates pool AMM enabled, blend-weight, required-source, fallback policy, max AMM/oracle spread, quote-liquidity floor, TWAP window bounds, allowed source mask, exact source-ID allowlist, and source count limit. AMM policy changes are committed into the bundle policy digest, and admin setters reject configurations that would make AMM blend pricing active while `pyth_weight` is zero or require more AMM sources than an explicit allowed source mask, nonzero source-count cap, or non-empty exact source-ID allowlist can satisfy. The gateway can consume BrownFi-owned `AmmReading` values, filter readings outside AMM policy including per-source AMM/oracle spread and optional exact source-ID allowlisting, fail closed when required source counts are not met, aggregate accepted relative prices by quote liquidity, compute aggregate AMM/oracle `Ospread`, and blend using the Solidity-compatible `pyth_weight` oracle weight against either the primary-with-sanity reference or the median reference. The bundle `price_digest` commits to separate oracle and AMM relative prices, AMM aggregate metadata, the pool-local AMM source-ID allowlist, and every accepted AMM candidate's source, price, liquidity, window, and timestamps through an AMM metadata digest. `RouterCap` gates the pool router enabled flag. `PauseCap` gates pool swap pause, add-liquidity pause, and flash enable/disable. Pool-local gate setters emit `PoolGateStateChanged` with pool ID, gate kind, and enabled state; swap and add-liquidity pause setters also retain the old bool `PauseStateChanged` emission for compatibility. Dynamic Pyth PTB route planning exists for arbitrary-length exact-input token paths, compatibility one/two-hop exact-output token paths across the current typed orientation combinations, and result-aware arbitrary-hop exact-output paths through `swapExactOutputWithPythRouteResults`; registered-provider exact-output has the same result-aware quote-chain helper shape for arbitrary positive-length token paths that exposes every change coin for caller handling. The SDK route planner can now select registered route price providers before executing those bundle routes, including Switchboard, Stork, and Stork-REST providers that update once per route, Supra push providers that do not require update hooks, and Supra pull providers that verify caller-supplied proof bytes per hop. `createStandardRoutePriceProviderRegistry` now wires explicit Pyth/Switchboard/Stork/Stork-REST/Supra-push/Supra-pull provider configs into the registry without baking in secrets or live object IDs. Full multi-source weights, weighted-median aggregation, additional source-specific AMM adapters, production TWAP proof review, live Switchboard/Stork/Supra PTB validation, and any future typed-helper registry remain pending.

SDK preflight status: route callers can now build exact-input/exact-output registered-provider route PTBs, including result-aware arbitrary-hop exact-output routes, dry-run the built bytes, require a successful Sui effects status before proceeding, hydrate serializable named route configs with caller-supplied transaction builders, and run a named provider/route matrix through that same fail-fast gate. This improves local/live validation ergonomics, but the project still needs a current V3 deployment config and real-object dry-runs for each oracle provider configuration before production launch.

## Price Types

Do not pass raw `(price, timestamp, confidence)` tuples into swaps.

Adapter modules should produce unforgeable structs:

```move
public struct PriceReading has drop {
    source: u8,
    feed_id: vector<u8>,
    price_q: u256_or_u128,
    confidence_q: u256_or_u128,
    publish_time_ms: u64,
    expo: i32_or_encoded,
    decimals: u8,
}

public struct AmmReading has drop {
    pool_id: ID,
    source_mask: u64,
    source_id: ID,
    relative_price_q32: u64,
    liquidity_quote: u256_or_u128,
    window_seconds: u64,
    observed_at_ms: u64,
    valid_until_ms: u64,
}

public struct PriceBundle has drop {
    pool_id: ID,
    policy_version: u64,
    policy_digest: vector<u8>,
    quote_token_index: u8,
    base_type_name: vector<u8>,
    quote_type_name: vector<u8>,
    created_at_ms: u64,
    valid_until_ms: u64,
    price_digest: vector<u8>,
    pyth_or_quorum_base_q: u256_or_u128,
    pyth_or_quorum_quote_q: u256_or_u128,
    oracle_rel_q: u256_or_u128,
    amm_rel_q: Option<u256_or_u128>,
    adj_rel_q: u256_or_u128,
    o_spread: u64,
    skew_rel_q: u256_or_u128,
    sell_price_q: u256_or_u128,
    buy_price_q: u256_or_u128,
    source_count: u8,
    amm_source_count: u8,
}
```

The exact integer type is an implementation decision after compiler checks. The architecture requires:

- No forgeable price data.
- Every reading binds to a source and feed ID.
- Every reading carries staleness data.
- Every reading carries confidence/range/deviation data where the source exposes it.
- Every final price bundle can be emitted for monitoring and post-trade analysis.
- Every final price bundle binds to a pool ID, quote orientation, policy version, policy digest, and same-PTB validity window.
- `PriceBundle` and reading constructors must be `public(package)` or stricter. Users can receive and pass these values, but they must not be able to mint them.
- `AmmReading.relative_price_q32` is already normalized to the BrownFi pool quote orientation. Source-specific adapters must validate token orientation before minting the reading.

## Adapter Trust Boundary

BrownFi must not accept readings directly from arbitrary external packages.

Approved pattern:

- BrownFi owns the `PriceReading`, `AmmReading`, and `PriceBundle` types.
- BrownFi adapter modules call external oracle/DEX packages, validate source data, and construct BrownFi readings.
- The gateway consumes only BrownFi reading types.
- External package IDs, object IDs, and expected versions are stored in pool policy and checked by the adapter.
- If an oracle or DEX package upgrades, the adapter or dependency must be reviewed before the source is re-enabled.

Rejected pattern:

- Any external package can return a type that BrownFi treats as a trusted price.
- A user can pass raw price numbers into swap.
- A user can pass a reading whose source object, feed ID, or package version is not checked against policy.

Pyth-specific boundary:

- BrownFi Move code may consume `PriceInfoObject` through `pyth::get_price_no_older_than`.
- BrownFi Move code must not hard-code calls to `pyth::update_single_price_feed`.
- Pyth updates must be built client-side in the PTB using the latest Pyth package call-site and current state IDs.
- The router SDK must treat Pyth package/address changes as runtime configuration, not as constants embedded in BrownFi core.

## Oracle Pipeline

The price pipeline:

1. Adapter validates source data and emits `PriceReading`.
2. `oracle_gateway` filters readings by source allowlist, feed ID, staleness, confidence, and enabled flags.
3. Gateway forms source-local base/quote relative candidates. A source can contribute a relative candidate only when both token readings pass freshness, confidence, feed ID, and maximum timestamp-delta checks.
4. Gateway computes quorum over relative base/quote candidates.
5. AMM adapters provide `AmmReading` values for allowed sources.
6. Gateway filters AMM readings by window, source age, optional exact source-ID allowlist, orientation, minimum liquidity, and deviation.
7. Gateway computes TVL/liquidity-weighted AMM relative price.
8. Gateway blends oracle relative price and AMM relative price using pool weight.
9. Gateway computes `Ospread`.
10. Gateway rejects if `Ospread > dis_threshold`.
11. Gateway applies skewness.
12. Gateway applies sell/buy spread.
13. Gateway returns a pool-bound `PriceBundle`.

Current implementation status: BrownFi-owned AMM readings are implemented at the gateway boundary through `AmmReading` and `get_swap_price_bundle_from_reading_pairs_and_amm_readings`. The gateway filters pool ID, allowed source mask, optional exact source-ID allowlist, duplicate source mask, expiry, minimum quote liquidity, TWAP window bounds, and per-source AMM/oracle `amm_max_ospread` before aggregation; source count limit violations still abort as a route/policy cap, and required source count shortfalls fail closed. New pools start with the Solidity-compatible 50/50 AMM blend gate available but with an empty allowed-source mask, so AMM readings are ignored until `AmmCap` registers an allowed source policy; after source-policy registration, valid AMM readings can blend without a second AMM-enable call. An empty source-ID allowlist means exact-ID filtering is disabled for advisory/manual readings; a non-empty allowlist binds accepted readings to configured source object IDs. It aggregates accepted AMM relative prices by quote liquidity, computes aggregate `Ospread` against the supported oracle relative reference, rejects above `amm_max_ospread` when configured, and blends with that oracle reference using pool `pyth_weight`. If no valid AMM source remains, `amm_fallback_mode = oracle_only` may return an oracle-only bundle only when AMM source count is not required; `fail_closed` and `min_amm_sources > 0` abort.

Current fallback rules:

- If no valid AMM source exists, use oracle quorum only.
- If oracle quorum fails, swap and add-liquidity must fail closed.
- If an advisory AMM source fails pool/source/expiry/liquidity/window/per-source-deviation checks, ignore that AMM source.
- If AMM blend weight is nonzero but all AMM sources fail, behavior is controlled by `amm_fallback_mode`.
- `amm_fallback_mode = oracle_only` is allowed only when AMM is advisory.
- `amm_fallback_mode = fail_closed` is required when AMM is configured as a quorum/sanity requirement.
- Aggregate `amm_max_ospread` remains fail-closed after accepted AMM readings are aggregated.
- If `buy_spread >= PRECISION`, reject because buy price is zero or negative.

## Multi-Oracle Quorum

Day-one architecture includes quorum. Day-one launch can require only Pyth until other adapters pass review.

`OraclePolicy` should include:

```move
public struct OraclePolicy has store {
    policy_version: u64,
    min_sources: u8,
    required_mask: u64,
    allowed_mask: u64,
    primary_source: u8,
    max_age_ms: u64,
    max_pair_time_delta_ms: u64,
    max_confidence_p: u64,
    max_deviation_p: u64,
    mode: u8,              // median, weighted median, primary plus sanity sources
    pyth_feed_a: vector<u8>,
    pyth_feed_b: vector<u8>,
    stork_feed_a: vector<u8>,
    stork_feed_b: vector<u8>,
    switchboard_feed_a: vector<u8>,
    switchboard_feed_b: vector<u8>,
    supra_pair_a: u32,
    supra_pair_b: u32,
}
```

Initial modes:

- `PRIMARY_WITH_SANITY`: Pyth is primary, at least one secondary must be within deviation when enabled.
- `MEDIAN`: use median of valid sources.
- `WEIGHTED_MEDIAN`: weight by configured source weights. This is reserved but not configurable until the source-weight state and update authority are defined.

Current implementation status: `PRIMARY_WITH_SANITY` and `MEDIAN` are implemented for BrownFi-owned reading-pair vectors, including the AMM-reading blend path. Median mode requires an odd number of valid source pairs and fails closed for even counts until BrownFi docs specify tie handling. Quorum config rejects unsatisfiable `min_sources` / `allowed_mask` combinations. `WEIGHTED_MEDIAN` remains pending and is rejected by the admin aggregation-policy setter until source-weight state exists.

Do not average sources before applying deviation checks. Validate first, aggregate second.

Quorum must operate on relative base/quote candidates, not blindly on independently aggregated token/USD prices. A source reading for base and quote can be paired only when:

- Both readings are from the same source family unless policy explicitly allows cross-source pairs.
- Both feed IDs match pool policy.
- Both readings pass staleness and confidence checks.
- Their timestamps differ by at most `max_pair_time_delta_ms`.
- The resulting relative candidate is within `max_deviation_p` of the primary or median reference.

Provider notes from current Sui docs and source review:

- Pyth Sui uses `PriceInfoObject`, `get_price_no_older_than`, and SDK-built PTBs to update price feeds. The local Pyth Sui SDK reads `base_update_fee` from Pyth state and splits SUI gas coins for each feed update; BrownFi's SDK orchestration helpers can call an injected `SuiPriceServiceConnection`-compatible fetcher for Hermes update data and then an injected `SuiPythClient`-compatible updater before constructing BrownFi `PriceReading` and `PriceBundle` values. BrownFi's SDK now also exposes source-backed helpers for the documented upgraded Hermes endpoint, binary price-feed requests, API-key enforcement when requested, and current/upgraded Sui Pyth/Wormhole state IDs.
- Pyth update fee must not be hard-coded. Use the on-chain state or SDK path.
- Pyth Core on Sui is upgrading on July 31, 2026. Pyth's Sui guide says new integrations should use upgraded Sui contracts, Hermes calls require API-key handling, and Sui users must update package revs/state IDs manually before that date.
- Launch must use the upgraded Pyth Sui contract path or explicitly document why the legacy package is still present as a compatibility dependency.
- Stork Sui exposes update functions that take `fee: Coin<SUI>` and exposes `single_update_fee_in_mist` plus total-fee reads from `StorkState`. BrownFi's SDK now exposes PTB thunks for those state fee reads, gas-coin SUI splitting, Stork REST `stork_signed_price` payload normalization into EVM update-data fields, Stork single/batch EVM update-data construction, Stork single/batch EVM update entry points, Stork update wrappers that split a fee coin from gas before calling the update entry point, and a signed-price updater factory plus stork-rest route provider that fetch caller-authorized signed payloads before route bundle reads. Callers still choose authenticated Stork provider/asset flows and trust policy outside the BrownFi SDK.
- Switchboard Sui on-demand uses the Quote Verifier flow. Current docs/source show `new SwitchboardClient(suiClient)` and `fetchQuoteUpdate(client, feedIds, tx, options?)`, with the returned `Quotes` PTB argument consumed by Move calls after the update step. BrownFi forwards quote-update options for Crossbar, oracle count, fee coin/type, and package/address overrides without interpreting them. Deployment IDs remain external runtime config and are not hard-coded in BrownFi SDK helpers.
- Supra Sui push oracle exposes `OracleHolder` plus `SupraSValueFeed::get_price`; BrownFi's current adapter supports this push path using the holder ID as source ID and BCS `u32` pair IDs as config data, and the SDK exposes `encodeSupraPairIdConfig` for off-chain setup.
- Supra Sui pull oracle verifies proof bytes through `DkgState`, mutable `OracleHolder`, mutable `MerkleRootHash`, `Clock`, and `price_data_pull_v2::verify_oracle_proof`; BrownFi now has a source-backed pull adapter that verifies one proof per pool/hop, extracts the configured BCS `u32` pair IDs, normalizes returned values to BrownFi 9 decimals, and returns a `PriceBundle` directly so the mutable proof path is not consumed once per token side. `sdk/router` can fetch and normalize documented Dora REST Sui proof responses per route hop before building BrownFi bundles. The local `packages/supra-sui` package stubs the current native pull/validator ABI for compilation; live Sui validation with real Supra pull payloads and object IDs remains pending.

Architecture consequence:

- Oracle update and oracle consumption are separate steps.
- Router SDKs should build update calls before BrownFi consumption calls.
- BrownFi swap functions should consume validated readings/bundles, not update every external source internally.

## AMM TWAP Blending

AMM TWAP blending is included from day one as policy and adapter interface, but each AMM adapter must be accepted separately.

`AmmPolicy` should include:

```move
public struct AmmPolicy has store {
    enabled: bool,
    blend_weight_p: u64,
    min_amm_sources: u8,
    fallback_mode: u8,      // oracle_only or fail_closed
    max_ospread_p: u64,
    min_liquidity_quote_q: u256_or_u128,
    min_window_seconds: u64,
    max_window_seconds: u64,
    allowed_source_mask: u64,
    allowed_source_ids: vector<ID>,
    source_count_limit: u8,
}
```

Adapter acceptance criteria:

- Verifies the source pool token types match `Pool<A, B>`.
- Verifies orientation: base/quote must match BrownFi `quote_token_index`.
- Uses TWAP when the DEX provides it.
- If only spot price is available, the adapter must be disabled for production pricing unless governance explicitly accepts spot mode for that pool.
- Applies minimum active liquidity, not just total token balances.
- Emits window, observed timestamp, source object ID, and liquidity used for weighting.
- Documents rounding direction from DEX native price format into BrownFi fixed point.

Current Sui DEX implication:

- Cetus exposes CLMM state such as `current_sqrt_price`, `current_tick_index`, and `liquidity`. That is not enough by itself to call it a manipulation-resistant TWAP source.
- Turbos exposes CLMM spot state such as `sqrt_price` and `liquidity`, and its separate oracle repository is an external price/time oracle path rather than a pool-observation TWAP adapter. That is not enough by itself to call Turbos CLMM a BrownFi AMM TWAP source.
- FlowX CLMM is the first reviewed Sui source that exposes a Uniswap-v3-shaped on-chain observation path. Its public `pool::observe<X, Y>(pool, seconds_agos, clock)` returns tick cumulatives and seconds-per-liquidity cumulatives, and its pool state exposes `sqrt_price_current`, `liquidity`, `observation_index`, `observation_cardinality`, and `observation_cardinality_next`. A direct FlowX adapter can therefore mirror the Solidity V3 direct-pool TWAP design: TWAP price from average tick over `twap_window`, harmonic TWAL liquidity over a longer window, virtual quote-notional conversion, then lower-of spot/TWAL liquidity weighting.
- FlowX is the first production AMM adapter target. The Move adapter supports one direct FlowX CLMM pool and a typed two-hop `B -> I -> A` path for the default BrownFi `Pool<A, B>` orientation where A is quote and B is base. The two-hop path mirrors Solidity path liquidity semantics by converting both legs into base-equivalent liquidity, taking the bottleneck, then converting the bottleneck back into quote liquidity for gateway weighting.
- No generic DEX oracle interface should be assumed.

Current implementation status: `sources/oracle_gateway.move` defines a BrownFi-owned `AmmReading` type with pool ID, source mask, primary source ID, optional secondary source ID, relative Q32 price, quote liquidity, window, observed time, and validity time. The package-only constructors let reviewed BrownFi adapter modules mint direct-pool or path readings without exposing raw AMM price inputs to users. The gateway path filters invalid advisory readings, including zero-liquidity AMM candidates, exact source-ID allowlist failures across both path legs, and per-source AMM/oracle spread failures, aggregates accepted readings by quote liquidity, falls back to oracle-only when policy permits and no AMM reading remains, and blends accepted AMM readings with the supported oracle relative reference. `sources/amm_flowx.move` now implements the FlowX CLMM adapter for direct pools and a typed two-hop `B -> I -> A` path for default quote-A/base-B BrownFi pools. Direct reads use the same token ordering as the BrownFi pool, convert FlowX Q64.64 sqrt price to BrownFi quote-per-base Q32 orientation, support Solidity-compatible spot mode when `twap_window = 0`, support TWAP mode from FlowX tick cumulatives, compute harmonic TWAL liquidity from seconds-per-liquidity cumulatives, convert active liquidity to 9-decimal quote notional using virtual reserves, weight by the lower of spot and TWAL quote liquidity, and mint an `AmmReading` with the FlowX pool ID as `source_id`. Zero-active-liquidity FlowX spot readings can now reach the gateway and be skipped by AMM liquidity policy instead of aborting before oracle-only fallback can apply. FlowX TWAP/TWAL reads also preflight public observation timestamps before calling `pool::observe`; when the requested history is unavailable, the adapter returns a zero-liquidity spot-priced AMM candidate so the gateway can apply the same fallback or fail-closed policy instead of hitting an uncaught Move abort. Two-hop reads combine the `B/I` and `I/A` FlowX prices into BrownFi quote-per-base Q32, compute each leg's lower-of spot/TWAL active liquidity, convert both into BrownFi base-equivalent liquidity, weight by the bottleneck converted back to quote liquidity, and commit both FlowX pool IDs into the reading/digest so exact source-ID allowlists must authorize both legs. The SDK exposes `readFlowXDirectPool`, `readFlowXTwoHopPath`, provider-independent FlowX route wrappers, a generic caller-built AMM-reading route wrapper, and standard-registry FlowX wrapper flags that build those readings before delegating to any route price provider. The default token-A-is-quote path now inverts raw FlowX price with decimal scale still in `u256` precision, then divides once, so mismatched token decimals do not round before inversion; tests cover this path at FlowX tick 0 spot and tick 60 TWAP with a 6/9 decimal mismatch. Cetus, Turbos, Aftermath, DeepBook, other source-specific adapters, non-default quote orientation if it becomes configurable, and FlowX paths beyond two legs remain unimplemented.

Weight semantics:

- Solidity V3 uses `pythWeight` as the oracle-side blend weight: `adj = oracle_rel * pythWeight + amm_rel * (1 - pythWeight)`.
- The current Move gateway preserves that behavior with pool `pyth_weight`.
- Pool `amm_blend_weight` currently gates whether AMM readings may affect pricing; it is not the arithmetic blend weight used by the gateway formula.

Default launch:

- `AmmPolicy.enabled = true` is acceptable only with `blend_weight_p = 0`.
- If `min_amm_sources > 0`, `fallback_mode` must be `fail_closed`.
- If `min_amm_sources > 0`, allowed AMM source mask, nonzero source-count cap, and non-empty exact source-ID allowlist must be able to satisfy it.
- If `fallback_mode = oracle_only`, AMM is advisory and must not be described as quorum.
- First verified AMM adapter can be enabled by pool after tests and audit review.

## Skew And Spread

The Sui gateway must preserve V3 semantics:

- `adj_rel_price = oracle_rel * oracle_weight + amm_rel * (1 - oracle_weight)`.
- `Ospread = abs(oracle_rel - amm_rel) / adj_rel_price` when AMM exists.
- If AMM does not exist, `Ospread` comes from oracle confidence/range.
- `S = (base_value - quote_value) / (base_value + quote_value)`.
- `SF = sign(S) * min(abs(S) * lambda, fee / (2 + fee) + s_bound)`.
- `skew_price = adj_price * (1 - SF) / (1 + SF)`.
- `sell_price = skew_price * (1 + fix_s + Ospread * compress + s_sell)`.
- `buy_price = skew_price * (1 - fix_s - Ospread * compress - s_buy)`.

Validation:

- `math::q32() / 10000 <= kB, kQ <= math::q32() * 2`, matching BrownFi V3's documented `[0.0001, 2]` kappa range in Q32 units.
- `lambda * 2 <= min(kB, kQ)`.
- `0 < gamma <= PRECISION`, matching BrownFi V3's documented `(0, 1]` max-imbalance range in PRECISION units.
- `10_000 <= fee <= 50_000_000`, matching Solidity V3's `[0.01%, 50%]` bound in PRECISION units.
- `0 <= fee_split <= PRECISION`.
- Nonzero `fee_split` requires pool-local `fee_to` to be configured, matching Solidity V3's nonzero fee-split guard.
- `fix_s <= 1%`.
- `0 < dis_threshold <= 10%`.
- Config-time spread Constraint 2 uses the worst allowed discrepancy: `fix_s + ceil(compress * dis_threshold / PRECISION) + s_buy < PRECISION`.
- Runtime buy spread must still satisfy `fix_s + Ospread * compress + s_buy < PRECISION`.
- `s_bound` follows the stricter Solidity V3 parity bound `[0, 10_000_000)`.
- Move admin setters enforce a nonzero `pyth_weight` whenever AMM blend pricing is active or being activated, so a pool cannot silently become 100 percent AMM-priced.
- `pyth_weight = 0` remains accepted only while AMM blend pricing is disabled.

## Swap Architecture

Core swap entry points:

```move
public fun swap_exact_a_for_b<A, B>(
    pool: &mut Pool<A, B>,
    price_bundle: PriceBundle,
    input: Coin<A>,
    min_out: u64,
    clock: &Clock,
    ctx: &mut TxContext
): Coin<B>

public fun swap_exact_b_for_a<A, B>(...)

public fun swap_b_for_exact_a<A, B>(...)
public fun swap_a_for_exact_b<A, B>(...)
```

Exact-input quote helpers should expose the same data Solidity periphery separates through raw and cutoff helpers: the effective output used by execution, the raw pre-cutoff output, and the gamma-cutoff output. The current Move implementation exposes this for single-hop direct and bundle quote paths, and typed two-hop bundle router helpers expose cutoff-aware and raw/no-cutoff route amounts for `A -> B -> C` and `C -> B -> A`. Single-hop direct and bundle helpers also expose a max-bound `(max_input, max_output)` pair for Section 5.3 cutoff-bound routing under the exact integer rounding used by Sui execution.

Exact-output should use backward quote math and max-input execution semantics: spend only the required input, return the unused input coin, and abort if gamma cutoff makes the requested output unavailable. The current Move implementation exposes this for single-hop typed core/router entry points plus typed two-hop `A -> B -> C` and `C -> B -> A` helpers. Typed two-hop helpers assert the final-hop quote's `effective_out` before executing the first hop, so a clipped final output aborts as a cutoff failure rather than as a zero intermediate hop. Typed two-hop bundle quote helpers also expose route-style `(required input, intermediate effective output, terminal effective output)` values. General arbitrary exact-output route propagation still belongs in the universal router/PTB design.

Execution order:

1. Validate pool is not swap-paused.
2. Validate price bundle was constructed for this pool ID, token type pair, quote orientation, policy version, and policy digest.
3. Compute direction: sell when output is base, buy when output is quote.
4. Normalize reserves and amounts.
5. Compute pseudo input:

```text
pseudo_in = actual_in * PRECISION / (PRECISION + fee)
```

6. Compute raw output using BrownFi V3 quadratic formula.
7. Compute gamma cutoff using `adj_rel_price`.
8. Use `amount_out = min(raw_output, cutoff)`.
9. Deposit input and withdraw output.
10. Recompute post-trade no-fee balances.
11. Check inventory:

```text
post_value_no_fee >= pre_value + inventory_penalty
```

Inventory valuation uses the direction-selected pre-trade base price (`sell_price` for sell, `buy_price` for buy), while gamma cutoff remains based on `adj_rel_price`.

12. Mint protocol LP if `fee_split > 0` and `fee_to` is set.
13. Emit swap event with price bundle metadata.

Never label the implementation BrownFi V3 complete until both exact-input forward and exact-output backward formulas match the EVM/core behavior under broader shared fixtures. The current suite includes all 12 Solidity periphery `TX_CASES` forward `getAmountOut` raw-output fixtures and backward `getAmountIn` required-input fixtures in scaled 9-decimal Sui form, all 36 Solidity Core Module symmetric-kappa library rows across B1/B2/B3 for both forward and backward quote directions, all 48 Solidity periphery/Core Module quote-library round-trip rows, Solidity §4.3 exact-output gamma cutoff quote guards for clipped output, zero clamp, and non-binding cutoff, the Solidity Core Module vector A tx1 SELL exact-output/protocol-LP fixture and tx1+tx2 BUY continuation in Sui's coin-owned exact-output form, all 36 Solidity periphery `LP_MINT_B1/B2/B3` Pyth-only protocol-LP sequence rows, a Sui router exact-input tx1-tx12 execution sequence over the Solidity periphery `TX_CASES` input amounts, the Solidity periphery router tx1-tx12 exact-output sequence through Sui single-hop router helpers, Pyth bundle exact-input 9-decimal/6-decimal and 6-decimal/9-decimal cases that pin trader-output downward rounding in both swap directions, Pyth bundle exact-output 6-decimal/9-decimal and 9-decimal/6-decimal cases that pin required-input upward rounding in both swap directions, Pyth bundle add-liquidity 6-decimal/9-decimal and 9-decimal/6-decimal cases that pin LP minting to raw-representable deposited amounts and return unmatched dust, and the current Pair integration LP/underpayment slices. Additional exact-input fixture classes, exact-output variants, broader decimal matrix coverage, broader multi-transaction coverage, and PTB fixture coverage beyond the current SDK three-hop exact-input Pyth route coverage are still required.

`PriceBundle` validity:

- It must be an ephemeral same-PTB value with no `store`, `key`, or `copy`.
- `created_at_ms <= clock.timestamp_ms() <= valid_until_ms`.
- For Pyth readings, `valid_until_ms` is `publish_time_ms + max_price_age * 1000`, not `current_clock_ms + max_price_age * 1000`.
- `pool_id`, `quote_token_index`, token type names, `policy_version`, and `policy_digest` must match the pool.
- `price_digest` must commit to source IDs, feed IDs, source timestamps, relative candidates, AMM candidates, final prices, and policy digest.

## Gamma Cutoff

Gamma cutoff is not a fixed percentage of output reserve.

For sell direction, output is base:

```text
cutoff_base =
  max(0, base_reserve - (1 - gamma) * (quote_reserve + pseudo_quote_in)
                     / ((1 + gamma) * adj_price))
```

For buy direction, output is quote:

```text
cutoff_quote =
  max(0, quote_reserve - (1 - gamma) * (base_reserve + pseudo_base_in) * adj_price
                      / (1 + gamma))
```

Rounding:

- The subtracted term should round up.
- The final output should round down to token decimals.
- The result must be less than or equal to the mathematical cutoff.

This is the replacement for the prototype's fixed 80 percent reserve guard.

## Liquidity Architecture

Create pool:

- Pool creation is permissioned by `PoolCreatorCap`.
- Initial liquidity should be value-based, not geometric mean.
- Initial LP should burn `MINIMUM_LIQUIDITY` to an unrecoverable address/object pattern.
- Token decimals above the Solidity-backed `18` bound are rejected.
- Pool stores feed IDs and policies at creation; feed IDs cannot be arbitrary user input after launch without `OracleCap`.

Add liquidity:

- Router/SDK sizes deposits to 50/50 value where possible.
- Pool minting uses the minimum of oracle-quorum valuation and AMM valuation when a valid AMM source exists.
- If no AMM source exists, mint uses oracle-quorum valuation only.
- Excess coin should be returned to the caller.
- LP minted rounds down.

Current implementation status: direct `add_liquidity` compatibility still accepts `OracleAdapter`/Pyth objects, but it now builds a pool-bound `PriceBundle` through `oracle_gateway` and delegates to `swap::add_liquidity_with_bundle`. That means the direct path validates the live adapter against the pool-local source/config snapshot, enforces gateway staleness, confidence/`Ospread`, quorum, and AMM fail-closed policy, then uses the same bundle valuation path as router bundle adds. The bundle path validates the `PriceBundle`, uses the resolved oracle relative price for the oracle valuation, uses the aggregate AMM relative price when AMM sources are present, mints LP from the lower valuation, rounds down, deposits the 50/50 value amount under the valuation source that set the LP floor, and returns the greater-side residual. For non-9-decimal tokens, LP is recomputed after raw token-decimal conversion so the pool does not mint against value it cannot actually receive; tests cover both 6-decimal quote and 6-decimal base Pyth bundle deposits. `PriceBundle` stores the oracle and AMM relative prices separately so add-liquidity does not accidentally use the blended swap `adj_price`. Scaled 9-decimal Sui tests cover the Solidity Pair integration existing-pool balanced mint, imbalanced mint capped by the minimum side, and burn/remint after the owner's full LP burn while preserving locked `MINIMUM_LIQUIDITY`; imbalanced Sui adds assert returned residuals because Sui does not retain arbitrary prefunded surplus like the EVM pair.

Remove liquidity:

- Must not require oracle data.
- Must not be blocked by swap pause.
- Burns LP and returns pro-rata balances.
- Output amounts round down.

## Protocol Fee LP

Protocol fee should mint LP tokens to the pool's protocol balance or directly to `fee_to`.

Formula:

```text
new_lp = total_supply * protocol_fee_value / (post_trade_pool_value - protocol_fee_value)
```

Rules:

- Protocol fee value is based on the fee portion of the input after applying `pseudo_in = actual / (1 + fee)`.
- Pool value should be the fee-inclusive post-trade value when matching the EVM V3 accounting.
- Protocol fee valuation uses the direction-selected pre-trade base/quote price (`sell_price` for sell, `buy_price` for buy), not the blended `adj_price`.
- `new_lp` rounds down.
- Nonzero `fee_split` requires `fee_to` to be configured; with no `fee_to`, the configured fee split must remain zero and no protocol LP is minted.
- Claiming protocol LP should require `FeeCap`; `fee_to` must be configured so protocol LP accrual has an explicit recipient policy.
- `ProtocolLpAccrued` should emit the pool ID, configured `fee_to`, LP minted into the pool protocol balance, and the fee-inclusive post-trade pool value used by the mint formula.
- `ProtocolLpClaimed` should emit the pool ID, configured `fee_to`, and LP claimed. In the current Sui design the claim function returns the LP coin to the `FeeCap` holder; the event's `fee_to` field records the configured recipient policy, not an automatic transfer recipient.

## Universal Router

Verdict: EVM-style universal router is a bad fit if interpreted literally.

Why:
- Move function type parameters are static.
- A dynamic vector of token addresses cannot dispatch arbitrary generic swap functions on-chain.
- Sui PTBs already provide atomic multi-step composition across packages.

BrownFi Sui router should be:

- A TypeScript SDK/PTB builder for arbitrary routes.
- Typed Move helpers for common routes.
- Narrow on-chain modules, not a generic bytecode command interpreter.

Day-one router scope:

- `swap_exact_a_for_b` typed helper.
- `swap_exact_b_for_a` typed helper.
- Two-hop typed helpers for known `A/B/C` paths in both directions.
- Add-liquidity helper with oracle update step support.
- Remove-liquidity helper.
- Direct `OracleAdapter` compatibility zap-in/zap-out helpers for the legacy Pyth path.
- Bundle-native zap-in helpers that return dust coins plus LP instead of refunding by transfer.
- Bundle-native zap-out helpers that return one output coin after burning LP and swapping the opposite side.
- Flash sequence builder in the SDK.

Router SDK responsibilities:

- Fetch oracle update payloads.
- Split SUI coins for update fees.
- Place update calls before BrownFi consumption calls.
- Fetch or build AMM readings. The SDK can build direct and two-hop FlowX readings per route hop through provider wrappers or standard-registry FlowX flags before delegating to a selected route price provider. It can also append caller-built BrownFi `AmmReading` handles per hop through `createAmmReadingRoutePriceProvider` or `createStandardRoutePriceProviderRegistry({ buildAmmReadings })`; non-FlowX source-specific adapters remain separate reviewed adapter work.
- Quote raw and cutoff outputs. Single-hop direct/bundle Move quote helpers, typed two-hop bundle exact-input quote helpers, and typed two-hop bundle exact-output quote helpers now expose these values for implemented typed routes; registered-provider exact-input/exact-output quote propagation is implemented in the SDK/PTB layer rather than as a generic on-chain route interpreter.
- Surface when gamma cutoff makes requested exact-output unavailable.
- Return excess input/output coins.
- Build flash borrow/repay PTB calls from a pool-bound price bundle, caller-owned repayment coins, and the borrow receipt produced earlier in the same PTB.
- Build PTBs that compose BrownFi with other Sui protocols.
- Preflight caller-built BrownFi PTBs through the caller's Sui client using Sui dry-run before signing/execution.

The on-chain router should not become a second AMM core.

Current implementation status: bundle-native `zap_in_a_with_bundle` and `zap_in_b_with_bundle` exist for single-pool zap-in. They split the input coin in half, use the existing bundle swap path for the half-swap, use the existing bundle add-liquidity path for minting, enforce the swap-output and LP minimums through those delegated paths, and return any residual input/output coins plus the LP coin to the caller. Bundle-native `zap_out_a_with_bundle` and `zap_out_b_with_bundle` exist for single-pool zap-out. They burn LP through existing remove-liquidity math, swap the opposite burned side through the existing bundle swap path, enforce the final output minimum through the delegated swap minimum when needed, join balances, and return one output coin. Recipient-aware bundle transfer wrappers also exist: `zap_in_a_with_bundle_and_transfer` and `zap_in_b_with_bundle_and_transfer` send the LP coin to the requested recipient and refund residual token coins to `tx_context::sender`; `zap_out_a_with_bundle_and_transfer` and `zap_out_b_with_bundle_and_transfer` send the final output coin to the requested recipient. Direct `OracleAdapter` compatibility `zap_in_a`, `zap_in_b`, `zap_out_a`, and `zap_out_b` also exist for the legacy Pyth path and delegate to the existing direct swap/add/remove primitives. Recipient-aware direct wrappers `zap_in_a_and_transfer`, `zap_in_b_and_transfer`, `zap_out_a_and_transfer`, and `zap_out_b_and_transfer` mirror the bundle transfer behavior. The SDK exposes matching PTB thunks `zapInA`, `zapInB`, `zapOutA`, `zapOutB`, `zapInAAndTransfer`, `zapInBAndTransfer`, `zapOutAAndTransfer`, `zapOutBAndTransfer`, `zapInAWithBundle`, `zapInBWithBundle`, `zapOutAWithBundle`, `zapOutBWithBundle`, `zapInAWithBundleAndTransfer`, `zapInBWithBundleAndTransfer`, `zapOutAWithBundleAndTransfer`, and `zapOutBWithBundleAndTransfer`.

Router limits:

- Each PTB route must declare a maximum hop count before quoting.
- Each hop must cap oracle source count and AMM source count.
- Each hop must specify exact fallback behavior when an oracle update, quorum, AMM source, or gamma cutoff fails.
- Exact-output routes must fail if any hop clips output below the requested terminal amount.
- SDK quotes must include both raw output and cutoff output per hop.
- The SDK must surface update fees per provider and must not assume Pyth, Stork, Switchboard, and Supra fees share one payment model. Stork state fee-read PTB thunks and gas-coin fee splitting helpers exist; raw signed-update construction and live provider validation are still provider-flow responsibilities.

## Flash Swaps

Flash swaps must be hot-potato receipt based.

Flow:

```text
flash_borrow_a(pool, amount, price_bundle) -> (Coin<A>, FlashReceipt<A, B>)
user PTB actions with borrowed coin
flash_repay_a(pool, repayment_coin, receipt, price_bundle)
```

Receipt fields:

```move
public struct FlashReceipt<phantom A, phantom B> {
    pool_id: ID,
    direction: u8,
    borrowed_amount: u64,
    amount_due: u64,
    fee_amount: u64,
    pre_balance_a: u64,
    pre_balance_b: u64,
    policy_version: u64,
    policy_digest: vector<u8>,
    price_digest: vector<u8>,
}
```

Receipt must have no `drop`, `copy`, `store`, or `key`.

Safety rules:

- Store source `pool_id` in receipt.
- `flash_repay` must assert receipt pool ID equals the passed pool.
- `flash_repay` must assert direction and token type.
- `flash_repay` must consume the receipt.
- `flash_repay` must check amount due and inventory invariant.
- `flash_repay` must assert the repay bundle digest, policy version, and policy digest match the receipt unless the flash policy explicitly allows a stricter reprice rule.
- Borrowed output and repayment token must be validated by generic type, not by user-supplied index.
- Flash must be disabled per pool by default until tests and audit review pass.

This follows the Sui hot-potato pattern, but with explicit source-object validation because hot-potato alone does not guarantee the receipt is repaid into the correct object.

Current implementation status: flash borrow/repay exists with no drop/copy/store/key receipt semantics, per-pool disabled-by-default gating, balance-level core APIs, `Coin<T>` PTB-friendly wrappers, exact repayment plus fee checks, raw pool balance restoration checks, borrow-time rejection when the rounded-up flash fee would push the repaid pool balance above the raw pool balance cap, pool/policy-version validation, receipt-bound `policy_digest` / `price_digest` checks, and `FlashBorrowed` / `FlashRepaid` events that emit pool ID, token type, direction, amount/fee fields, policy version, policy digest, and price digest. `sdk/router` exposes tested PTB thunks for `borrow_a_with_coin`, `borrow_b_with_coin`, `repay_a_with_coin`, and `repay_b_with_coin`, preserving the Move argument order `(pool, price_bundle, clock, amount_or_repayment, receipt)`. It also exposes borrow-result helpers that split the Sui multi-return `moveCall` result into borrowed coin and receipt handles for same-PTB repay composition, plus fee-merge helpers that merge a caller-supplied fee coin into the borrowed coin before repayment so nonzero-fee flash PTBs can satisfy exact repayment. Current digests commit to modeled policy, resolved bundle fields, source counts, AMM source count, BrownFi `PriceReading` metadata when reading-pair bundles are used, AMM candidate metadata when AMM readings are used, and the pool-local oracle source/config snapshot. The direct Pyth compatibility path now constructs internal readings before bundle construction, so direct-wrapper flash receipts bind the same extracted Pyth source/feed/price-bound/confidence/timestamp/exponent metadata as the BrownFi-owned reading path for the same Pyth object data. The current multi-reading gateway can enforce source-paired primary-with-sanity quorum and odd-count median aggregation, and the current AMM reading gateway can enforce source-counted AMM blend policy against either supported oracle reference, but live non-Pyth provider PTB validation, additional AMM adapters, and weighted-median aggregation remain pending.

## Math And Rounding

This is a high-risk area on Sui. The implementation must define one fixed-point format and prove bounds before coding.

Preferred direction:

- Use `u256` internally if supported by the target Sui Move toolchain and gas is acceptable.
- Use `u128` or Q32 only where bounded tests prove no overflow and acceptable precision.
- Store external token amounts as `u64`.
- Normalize to a canonical internal decimal unit for formulas.

Rounding table:

| Operation | Direction | Reason |
|---|---:|---|
| Exact-input output | Down | Trader must not receive more than formula output. |
| Exact-output input | Up | Trader must pay enough to satisfy inventory. |
| Pseudo input from actual input | Down | Fee stays with pool. |
| Gamma cutoff subterm | Up | Final output remains below safe boundary. |
| Gamma cutoff output | Down | Pool-safe. |
| Sell spread price | Up | LP-safe ask price. |
| Buy spread price | Down | LP-safe bid price. |
| Inventory penalty | Up | LP-safe premium. |
| LP mint | Down | Existing LP-safe. |
| LP burn outputs | Down | Pool-safe dust handling. |
| Protocol LP mint | Down | Avoid over-crediting protocol. |
| Oracle price scaling | Source-specific | Must be documented per adapter. |

Required math tests:

- Golden tests against EVM V3 fixtures for exact input. All 12 Solidity periphery `TX_CASES` forward `getAmountOut` raw-output fixtures and all 36 Solidity Core Module symmetric-kappa library rows across B1/B2/B3 are covered in scaled 9-decimal Sui form; Sui router state-changing coverage now runs a tx1-tx12 sequence over the Solidity periphery `TX_CASES` input amounts and asserts quoted output equals executed output without inventory aborts; Pyth bundle 9-decimal/6-decimal, 6-decimal/9-decimal, 9-decimal/12-decimal, 12-decimal/9-decimal, 6-decimal/12-decimal, and 12-decimal/6-decimal exact-input cases pin output conversion before execution; SDK/PTB coverage pins a three-hop exact-input Pyth route with deduped Pyth updates plus recipient transfer; remaining exact-input fixture classes and broader PTB coverage are pending.
- Golden tests against EVM V3 fixtures for exact output. All 12 Solidity periphery `TX_CASES` backward `getAmountIn` required-input fixtures and all 36 Solidity Core Module symmetric-kappa library rows across B1/B2/B3 are covered for backward required-input quotes; Solidity §4.3 gamma cutoff quote behavior is pinned for clipped output, zero clamp, and non-binding cutoff; Core Module vector A tx1 SELL, tx1+tx2 BUY continuation, all 36 periphery `LP_MINT_B1/B2/B3` Pyth-only protocol-LP sequence rows, the Solidity periphery router tx1-tx12 exact-output sequence, and Pyth bundle 6-decimal/9-decimal, 9-decimal/6-decimal, 12-decimal/9-decimal, 9-decimal/12-decimal, 6-decimal/12-decimal, and 12-decimal/6-decimal exact-output required-input cases are covered in Sui state-changing exact-output form; remaining fixture variants and broader PTB coverage are pending.
- Pyth bundle add-liquidity decimal tests now pin raw-representable LP-safe minting and residual returns for 6-decimal quote/base deposits, 12-decimal quote/base deposits, and both-token 6/12 and 12/6 mixed-decimal deposits.
- Golden round-trip quote tests against EVM V3 fixtures. All 12 Solidity periphery `TX_CASES` and all 36 Solidity Core Module B1/B2/B3 `getAmountOut(getAmountIn(out))` rows are covered under the Solidity suite's 10 bps tolerance. Typed two-hop bundle router coverage now checks the route-level exact-output quote's required input against the corresponding exact-input quote for `A -> B -> C`; SDK/PTB builder coverage also verifies that registered-route and Pyth convenience-route exact-output quote handles can feed the matching exact-input quote chain in one composed transaction. Live provider-backed PTB round-trip execution remains pending.
- Boundary tests for `kB`, `kQ`, `lambda`, `gamma`, fee, decimals, and reserves are covered by config/factory boundary tests, Pyth bundle add-liquidity reserve-cap and cap-addition-overflow abort tests, Pyth bundle swap input reserve-cap abort tests, and a flash-fee cap abort test that prevents fee dust from pushing a repaid pool balance above the raw cap.
- Rounding monotonicity tests. Single-hop Pyth bundle exact-input quote outputs and exact-output quote required inputs are covered for both directions, including after a state-changing Pyth bundle swap sequence mutates reserves. Typed two-hop Pyth bundle route quotes now cover increasing exact-input route amounts and increasing exact-output route requests in both directions, including after state-changing route swaps mutate both pools, in a mixed-decimal 6/9/12-token route fixture, and in all six 6/9/12-token decimal-order state sequences after both forward and reverse route swaps. Broader decimal-set matrices remain pending.
- Overflow bound tests. Coverage pins checked overflow behavior for low-decimal raw-to-standard amount scaling, `u256` to `u64` downcasts, a public Pyth bundle exact-input quote whose low-decimal input overflows standard normalization, a public Pyth bundle exact-output quote whose required input overflows raw token representability, large exact-output inventory-penalty intermediate math, and high-price protocol-fee LP intermediate math; broader exact-input quadratic/intermediate and AMM arithmetic bounds remain pending.
- Pyth exponent/confidence conversion tests. BrownFi-owned Pyth source readings cover negative-exponent and positive-exponent price/confidence normalization into the 9-decimal BrownFi scale, and bundle digest coverage proves exponent metadata is committed even when normalized prices match; broader live-provider/PTB conversion evidence remains pending.
- AMM sqrt-price to relative-price tests per adapter.

## Sui-Specific Differences From EVM

| EVM V3 | Sui Move design |
|---|---|
| Pair holds ERC20 balances and measures transfer deltas | Pool owns `Balance<T>` and receives `Coin<T>` or `Balance<T>` directly. |
| Router transfers token to pair then calls `swap` | PTB passes input coin into BrownFi function. |
| Exact-output swaps can be prefunded by transferring more input than required to the pair | Exact-output swaps compute required input, consume the caller's coin, and return explicit change. |
| Pair needs runtime `WRONG_INPUT_TOKEN` guards against same-token/out-token prefunding | Typed entry points accept only the expected input coin type, and users cannot mutate pool balances through raw token transfers. |
| Callback based flash swaps | Hot-potato receipt with same-PTB repayment. |
| `address[] path` dynamic routing | SDK/PTB builder plus typed helper functions. |
| Factory and PairConfig read on hot path | Pool-local config and policies. |
| `msg.value` for Pyth update fee | SUI coin split and provider-specific update calls. |
| Solidity `uint256` by default | Move integer width must be chosen and bounded explicitly. |
| Reentrancy lock | Move resource model and object borrowing reduce reentrancy, but receipt and source-object validation remain critical. |
| AccessManager roles | Capability objects and governance wrappers. |

## Events

Required events:

- `PoolCreated`
- `ConfigUpdated`
- `OraclePolicyUpdated`
- `AmmPolicyUpdated`
- `PriceBundleUsed`
- `OracleQuorumUsed`
- `AmmTwapUsed`
- `SwapExecuted`
- `AddLiquidity`
- `RemoveLiquidity`
- `Sync`
- `ProtocolLpAccrued`
- `ProtocolLpClaimed`
- `FlashBorrowed`
- `FlashRepaid`
- `PauseStateChanged`
- `PoolGateStateChanged`

Config and policy update events:

- `ConfigUpdated` emits pool ID, a parameter group name, and `values: vector<u128>`. Parameter groups are group-equivalent to the Solidity V3 config events: `fee`, `fee_split`, `kappa`, `lambda`, `spread`, `fix_spread`, `dis_threshold`, `s_bound`, and `gamma`.
- `OraclePolicyUpdated` emits pool ID, oracle policy version, a parameter group name, and `values: vector<u128>` for Pyth weight, max price age, quorum/masks, aggregation policy, and source/config updates.
- `AmmPolicyUpdated` emits pool ID, AMM policy version, a parameter group name, and `values: vector<u128>` for AMM enable/blend/source/fallback policy.
- `PoolParametersUpdated` remains emitted by the same setters for compatibility while the dedicated events are introduced.
- `PoolGateStateChanged` emits pool ID, gate kind (`swap`, `add_liquidity`, or `flash`), and whether that gate is enabled. `PauseStateChanged` remains the bool-shaped compatibility/global pause event.
- Oracle source/config updates use an empty `values` vector plus the incremented policy version to signal the update. Source IDs and config bytes remain in pool state and policy digest rather than being packed into a generic event value list.
- Event values use `u128` so AMM min-liquidity policy values are not truncated.

Oracle and AMM observability events:

- `OracleQuorumUsed` emits when the gateway mints a valid `PriceBundle`. It records pool ID, policy version, policy digest, price digest, oracle aggregation mode, primary source, accepted source mask/count, required source mask, minimum source count, resolved relative price, and bundle validity.
- `AmmTwapUsed` emits only when accepted AMM readings contribute to a valid `PriceBundle`. It records pool ID, policy version, policy digest, price digest, accepted AMM source mask/count, aggregate AMM relative price, oracle reference relative price, adjusted relative price, `Ospread`, total quote liquidity used for weighting as `u256`, configured window bounds, and bundle validity.
- These events are emitted at bundle construction rather than swap execution. On Sui this keeps full quorum/TWAP metadata out of the hot-potato `PriceBundle`; normal swap/router flows still build and consume the non-storable bundle in the same PTB.

Current implementation status: `ConfigUpdated`, `OraclePolicyUpdated`, and `AmmPolicyUpdated` exist for the current risk, oracle, and AMM cap setters. `OracleQuorumUsed` exists for successful gateway bundle construction, including the default single-Pyth-source quorum and multi-source reading paths. `AmmTwapUsed` exists for successful gateway bundles where accepted AMM readings contribute to pricing; it does not imply any source-specific AMM adapter has been reviewed or implemented. `PriceBundleUsed` exists for state-changing bundle swap execution paths. It emits the pool ID, input/output token type names, policy version, policy digest, price digest, Pyth price A/B values, oracle relative price, AMM relative price, adjusted price, sell price, buy price, the direction-selected pre-trade price, oracle source count, and AMM source count. Direct Pyth compatibility swap wrappers delegate through the bundle paths, so they emit the same event. AMM-active bundle swap coverage now verifies non-equal accepted AMM readings move the adjusted price between oracle and AMM and propagate into `PriceBundleUsed` and `SwapExecuted`; the real-Berachain numeric event fixture is covered at the BrownFi-owned reading/gateway layer, while source-specific AMM adapter parity remains pending. `AddLiquidity` exists for state-changing add-liquidity paths and now emits deposited token amounts, LP minted, Pyth price A/B values, oracle relative price, AMM relative price, oracle source count, and AMM source count, mirroring the Solidity `Mint` event's price-observability fields in the Sui bundle model. `Sync` exists as a pool-bound reserve observability event carrying pool ID and current reserves after pool creation, add/remove liquidity, and state-changing swaps; this mirrors Solidity reserve observability without copying public EVM `sync()` or `skim()` APIs. `SwapExecuted` exists for state-changing bundle swap execution paths and emits pool ID, direction (`0` sell, `1` buy), token type names, actual input, pseudo input, raw/pre-cutoff or requested output, cutoff-checked output, final output, fee amount, protocol LP accrued, adjusted/sell/buy prices, source counts, and `Ospread`. Exact-input paths report pre-cutoff raw output plus the gamma-clipped output; exact-output paths report the requested output plus the backward quote's cutoff-checked `effective_out`, and execution requires those to match. `ProtocolLpAccrued` and `ProtocolLpClaimed` exist for protocol-fee LP accounting; accrual emits pool ID, configured `fee_to`, LP minted, and the fee-inclusive post-trade pool value used by the mint formula, while claim emits pool ID, configured `fee_to`, and LP claimed. `FlashBorrowed` and `FlashRepaid` exist for flash receipt flows and emit pool ID, token type, direction, amount/fee fields, policy version, policy digest, and price digest. `PoolGateStateChanged` exists for pool-local swap, add-liquidity, and flash gate changes; it records the pool ID, gate kind, and enabled state.

`SwapExecuted` should include:

- Pool ID.
- Direction.
- Input token type name.
- Output token type name.
- Actual input.
- Pseudo input.
- Raw output.
- Cutoff output.
- Final output.
- Fee amount.
- Protocol LP minted.
- `adj_rel_q`, `sell_price_q`, `buy_price_q`.
- Source counts.
- Ospread.

## Launch Gates

Day-one architecture should include all gates. Day-one production settings should be conservative:

- Multi-oracle quorum: Pyth required, secondaries disabled until adapter review.
- Oracle source modules: include only deployment-selected, verifier-clean source adapters in the launch package; runtime policy can disable sources per pool, but it cannot prevent Sui from verifying included modules at publish time.
- AMM TWAP: policy present; blend gate defaults to the Solidity-compatible 50/50 setting, but the allowed-source mask starts empty until `AmmCap` registers reviewed AMM source policy.
- AMM fallback: `oracle_only` only for advisory AMM mode; `fail_closed` when `min_amm_sources > 0`.
- Universal router: SDK/PTB builder and direct typed helpers first.
- Flash swaps: module present, per-pool disabled by default.
- Exact-input swaps: only after quadratic parity and inventory tests pass.
- Exact-output swaps: enabled after backward formula and cutoff tests pass.
- Remove liquidity: always available unless a catastrophic package-level emergency path is explicitly designed.
- Pyth launch path: upgraded Sui package/state IDs and Hermes API-key handling must be validated before mainnet deployment.

Do not enable an adapter just because it compiles. Enable only after:

- Source docs reviewed.
- Object IDs and package versions pinned.
- Staleness and fee behavior tested.
- Rounding conversion tested.
- Manipulation assumptions documented.
- Integration test runs against a fork/local fixture where possible.

## Non-Negotiable Invariants

- No user-forgeable price readings.
- No user-forgeable or cross-pool reusable price bundles.
- No stale oracle data accepted.
- No pool can silently become 100 percent AMM-priced unless governance explicitly allows that mode.
- No AMM-required pool may silently downgrade to oracle-only pricing.
- No AMM-required pool may require more sources than a configured exact source-ID allowlist can satisfy.
- No swap path depends on mutable global factory state.
- No remove-liquidity path depends on oracle data or swap pause.
- No flash receipt can be repaid into the wrong pool.
- No flash receipt can be repaid against a mismatched price/policy digest.
- No generic asset index can override generic token type.
- No AMM TWAP source is accepted without token orientation and liquidity checks.
- No "BrownFi V3 complete" claim before quadratic math, gamma cutoff, fee semantics, and inventory checks match the EVM design.

## Open Items Before Implementation

These must be decided before writing Move code:

1. Exact internal fixed-point format: `u256` with Q64, or bounded `u128`/Q32.
2. Canonical token decimal normalization target.
3. Initial source policy: Pyth-only primary with optional sanity sources, or two-source quorum from launch.
4. First AMM adapter to verify on Sui.
5. Whether `PriceBundle` is built inside `swap` or built by a separate gateway call in the same PTB.
6. Whether adapter modules are all in the BrownFi package or split into separately upgradeable BrownFi-owned adapter packages.
7. Remaining source-weight/TWAP-source authority and whether governance wrappers live in this package or a separate ops package.
8. Flash enable policy and audit threshold.
9. Whether protocol LP is held inside pool balance first or minted/transferred directly to `fee_to`.
10. Whether feed IDs and exact AMM source IDs need dynamic-field registries beyond the current pool-local fields.
11. Whether exact-output Move entry points launch together with exact-input or after parity tests.
12. Exact deployment values for launch route limits: max hops, max oracle sources per hop, max AMM sources per hop, and max update payload bytes.
13. Pyth deployment mode: upgraded package only, or dual dependency for legacy compatibility during migration.

Current router-limit status: on-chain typed helpers remain capped at two hops. The SDK registered-provider route planner can still compose arbitrary positive-length exact-input and result-aware exact-output routes for PTB flexibility, but launch-validation hydration now accepts `routeLimits.maxHops`, `routeLimits.maxOracleSourcesPerHop`, `routeLimits.maxAmmSourcesPerHop`, and `routeLimits.maxUpdatePayloadBytes`. Oversized state-changing or quote-only validation cases are rejected before transaction factories, provider fetch/update hooks, or dry-runs run. `maxOracleSourcesPerHop` intentionally requires each resolved route hop to declare `oracleSourceCount`; the SDK does not infer oracle source count from feed IDs because two feed IDs are one source pair for Pyth/Switchboard/Stork-style providers. `maxAmmSourcesPerHop` counts both prebuilt `ammReadings` and reviewed source-specific FlowX AMM route inputs before wrapper-generated readings exist, so a launch cap of zero cannot silently accept FlowX AMM fields. `maxUpdatePayloadBytes` intentionally requires each resolved route hop to declare `updatePayloadByteLength`, including `0` for no-update providers, because Pyth, Switchboard, Stork, and Supra pull materialize update/proof payloads through different provider paths. This lets deployment configs enforce launch hop, oracle-source, AMM-source, and update-payload caps without removing generic SDK composition.

## Implementation Milestones

Do not implement all features at once. Suggested milestones:

1. Math parity only.
   - Verify: golden tests against EVM library for exact-input, exact-output, gamma cutoff, and inventory penalty.
2. Pool-local config and liquidity parity.
   - Verify: initial mint, add, remove, protocol LP accounting.
3. Pyth adapter and oracle bundle.
   - Verify: exponent, confidence, staleness, feed ID, upgraded package/state IDs, API-key-aware SDK path, and update-fee path.
4. Swap exact-input with Pyth-only bundle.
   - Verify: pool-bound bundle cannot be reused across pools/policies; invariant tests and EVM fixture comparisons pass.
5. Multi-oracle reading interface and quorum.
   - Verify: forged readings impossible, stale/deviating sources rejected, and relative base/quote quorum never combines incoherent timestamps.
6. AMM adapter interface with one disabled source.
   - Verify: policy gating, `oracle_only` fallback, and `fail_closed` fallback behavior.
7. Router SDK/PTB builder.
   - Verify: route limits enforced, Pyth registered-route preflight proves update calls precede consumption calls across swap/add route cases, provider fees are surfaced, and coin leftovers are returned.
8. Flash receipt module disabled by default.
   - Verify: receipt cannot be dropped, copied, stored, repaid into another pool, or repaid against mismatched policy/price digest.
9. First production AMM TWAP adapter.
   - First source implemented: FlowX direct CLMM pool plus typed two-hop `B -> I -> A` path for default quote-A/base-B BrownFi pools.
   - Covered: default token-A quote orientation at FlowX tick 0 spot and tick 60 TWAP with mismatched token decimals; two-hop path price/liquidity weighting; two-leg exact source-ID allowlist filtering.
   - SDK route wrappers covered: provider-independent and standard-registry direct/two-hop FlowX AMM reading construction before bundle-provider delegation.
   - Verify next: non-default quote orientation if it becomes configurable, paths beyond two legs, and source-specific non-FlowX AMM adapters.

## Sources Reviewed

Local BrownFi design and EVM implementation:

- `/Users/manhtrv/coding/brownfi/BrownAMM-dev/V3 architecture.md`
- `/Users/manhtrv/coding/brownfi/BrownAMM-dev/brownfiV3-design.md`
- `/Users/manhtrv/coding/brownfi/BrownAMM-dev/BrownFi_V3 dynamic LPing.md`
- `/Users/manhtrv/coding/brownfi/BrownAMM-dev/Roundtrip-attack.md`
- `/Users/manhtrv/coding/brownfi/v3-core/contracts/BrownFiV3Pair.sol`
- `/Users/manhtrv/coding/brownfi/v3-core/contracts/adapters/OracleGateway.sol`
- `/Users/manhtrv/coding/brownfi/v3-periphery/contracts/BrownFiV3Router.sol`
- `/Users/manhtrv/coding/brownfi/v3-periphery/contracts/libraries/BrownFiV3Library.sol`

Current Sui Move prototype:

- `/Users/manhtrv/coding/brownfi/BrownFi-Move-Sui/sources/factory.move`
- `/Users/manhtrv/coding/brownfi/BrownFi-Move-Sui/sources/pool.move`
- `/Users/manhtrv/coding/brownfi/BrownFi-Move-Sui/sources/swap.move`
- `/Users/manhtrv/coding/brownfi/BrownFi-Move-Sui/sources/oracle_gateway.move`
- `/Users/manhtrv/coding/brownfi/BrownFi-Move-Sui/packages/oracle/sources/pyth_adapter.move`

External Sui references:

- Sui Move and PTBs: https://www.sui.io/move
- Sui PTB transaction builder: https://docs.sui.io/develop/transactions/ptbs/building-ptb
- Sui PTB overview: https://blog.sui.io/programmable-transaction-blocks-explained/
- Pyth Sui pull integration: https://docs.pyth.network/price-feeds/core/use-real-time-data/pull-integration/sui
- Pyth Sui Core upgrade notes: https://docs.pyth.network/price-feeds/core/upgrade/preparing/sui
- Pyth current fees: https://docs.pyth.network/price-feeds/core/current-fees
- Stork REST API: https://docs.stork.network/api-reference/rest-api
- Stork Sui API: https://docs.stork.network/api-reference/contract-apis/sui
- Stork Sui addresses: https://docs.stork.network/resources/contract-addresses/sui
- Switchboard Sui docs: https://docs.switchboard.xyz/docs-by-chain/sui
- Switchboard Sui source: https://github.com/switchboard-xyz/sui
- Switchboard Sui npm package: https://www.npmjs.com/package/@switchboard-xyz/sui-sdk
- Supra Sui push oracle: https://docs.supra.com/oracles/data-feeds/push-oracle
- Supra Sui pull oracle: https://docs.supra.com/oracles/data-feeds/pull-oracle
- Supra pull example source: https://github.com/Entropy-Foundation/oracle-pull-example/tree/feat/DoraV2
- OpenZeppelin Sui Move bug patterns: https://www.openzeppelin.com/news/critical-bug-patterns-in-sui-move
- Cetus CLMM interface checkout inspected locally at `/tmp/brownfi-cetus-clmm-interface`, commit `74e98b69334ecc84fc419d10a59d3d4e1f832d32`.
- Turbos Sui Move interface checkout inspected locally at `/tmp/brownfi-turbos-sui-move-interface`, commit `cff693265bfc41c7de2233afe31c9d7428adc9e1`.
- Turbos oracle checkout inspected locally at `/tmp/brownfi-turbos-oracle`, commit `22f926c934e156bc02df9bbbb4f2d699322914f9`.
- FlowX CLMM checkout inspected locally at `/tmp/brownfi-flowx-clmm-contracts`, commit `95441b22ca9d5d7420a6e527afcfc1a2639fcc39`.
