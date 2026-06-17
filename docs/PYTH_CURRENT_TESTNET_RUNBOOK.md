# BrownFi V3 Current-Pyth Testnet Runbook

Status: Pyth-only operational runbook.

This runbook uses the checked current-Pyth launch defaults:

- Launch profile: `configs/launch/pyth-current-testnet.json`
- Pool template: `configs/launch/pyth-current-testnet.pool.example.json`
- Matrix template: `configs/launch/pyth-current-testnet.matrix.example.json`
- Runtime config: `configs/launch/pyth-current-testnet.runtime.example.json`
- Feed values: `configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json`

Optional protocol-fee launch values are separate from route-matrix values:

- Protocol-fee pool template: `configs/launch/pyth-current-testnet.protocol-fee.pool.example.json`
- Protocol-fee pool-only values: `configs/launch/pyth-current-testnet.protocol-fee.values.example.json`

The checked live evidence file is verifier-only:

- `configs/launch/pyth-current-testnet.live-evidence.matrix.json`

It records historical landed transactions. Its route input coin IDs may be spent, so do not submit from it.
It also carries live-value-clean cutoff-aware and raw/no-cutoff exact-input and exact-output quote cases, plus an exact-output round-trip quote case, for coverage validation; those quote cases do not have tx evidence because they are no-spend cases.

## Requirements

Use Node 24 for live runtime execution because the current Pyth JS packages declare that engine range.
In this Codex desktop environment, `/Applications/Codex.app/Contents/Resources/node` is Node `v24.14.0`.

```sh
export NODE24="/Applications/Codex.app/Contents/Resources/node"
```

Set runtime environment values:

```sh
export BROWNFI_SUI_RPC_URL="https://fullnode.testnet.sui.io:443"
export BROWNFI_SUI_SENDER="0x..."
export BROWNFI_SUI_PRIVATE_KEY="suiprivkey..."
```

`BROWNFI_SUI_PRIVATE_KEY` can be replaced by the Sui CLI keystore path/address fields in the runtime config. The checked current-Pyth runtime config pins `https://hermes-beta.pyth.network` for the old-docs current contract lane; edit `pythHermesEndpoint` in the runtime config if a different Hermes endpoint is required.

## No-Spend Checks

Validate the current-Pyth live evidence matrix:

```sh
rtk node tools/validate-launch-matrix.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --launch-config configs/launch/pyth-current-testnet.json \
  --require-live-values
```

Dry-run only the no-spend quote cases from the checked live-evidence matrix:

```sh
rtk "$NODE24" tools/run-launch-matrix-preflight.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --launch-config configs/launch/pyth-current-testnet.json \
  --runtime tools/pyth-launch-runtime.mjs \
  --quote-only
```

The quote-only preflight skips historical route input coins from the evidence matrix.
The 2026-06-17 historical live-evidence dry-run returned five Pyth quote cases: cutoff-aware exact input/output, exact-output round trip, and raw/no-cutoff exact input/output. It returned zero route cases in `--quote-only` mode. The fresh current-source matrix template has a sixth max-bound quote case, which requires a package published from the current source.

Check current-Pyth runtime readiness without submitting transactions:

```sh
rtk "$NODE24" tools/check-pyth-launch-readiness.mjs \
  --runtime-config configs/launch/pyth-current-testnet.runtime.example.json \
  --manifest configs/oracles/pyth-sui-contracts.json \
  --matrix configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --launch-config configs/launch/pyth-current-testnet.json
```

Check the fresh-launch template plus signer/gas readiness before submitting new transactions:

```sh
rtk "$NODE24" tools/check-pyth-launch-readiness.mjs \
  --runtime-config configs/launch/pyth-current-testnet.runtime.example.json \
  --manifest configs/oracles/pyth-sui-contracts.json \
  --matrix configs/launch/pyth-current-testnet.matrix.example.json \
  --launch-config configs/launch/pyth-current-testnet.json \
  --allow-placeholders \
  --require-submit-signer \
  --check-gas \
  --active-address "$BROWNFI_SUI_SENDER" \
  --rpc-url "$BROWNFI_SUI_RPC_URL" \
  --min-gas-mist 1000000000
```

If the shell is not Node 24 and this is only a static readiness check, add `--skip-node-engine-check`. Do not skip the engine check for fresh launch or submission.

Verify the publish profile links to current Pyth and current Wormhole:

```sh
rtk node tools/verify-launch-package-publish-dry-run.mjs \
  --config configs/launch/pyth-current-testnet.json \
  --network testnet \
  --use-rtk \
  --expected-dependency 0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837 \
  --expected-dependency 0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94 \
  --expected-module swap \
  --expected-module router \
  --expected-module oracle_gateway \
  --expected-module pyth_source \
  --expected-module flash \
  --expected-module wormhole_link
```

Read the current-Pyth update fee:

```sh
rtk node tools/read-pyth-sui-update-fee.mjs \
  --manifest configs/oracles/pyth-sui-contracts.json \
  --network testnet \
  --use-rtk
```

The default contract set is `current`. Pass `--contract-set upgraded` only when intentionally testing the upgraded profile.

## Verify Landed Evidence

These commands query Sui JSON-RPC and verify that the checked current-Pyth setup and route digests landed successfully. Package publish setup checks verify digest, successful effects, and the published package ID from object changes. Pool creation checks verify the pool ID, LP coin ID, expected BrownFi Move call, and expected events. Route checks verify expected BrownFi Move calls and events.

Verify every checked setup and route evidence entry in one pass:

```sh
rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --all \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk
```

Individual evidence checks remain useful when isolating a failed digest:

```sh
rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --setup testCoins \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --setup brownfiPackage \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --setup pool \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --setup protocolFeeSetup \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --setup flashEnable \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --setup protocolLpClaim \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet exact input route' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet exact output route' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet exact output results route' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet add liquidity' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet remove liquidity' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet zap in A' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet zap in B' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet zap out A' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet zap out B' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet flash borrow A' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk

rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.live-evidence.matrix.json \
  --tx 'pyth current testnet flash borrow B' \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk
```

## Fresh Live Launch

This publishes launch test coins, publishes the BrownFi current-Pyth package, creates a Pyth-backed pool, enables flash for that pool when the pool template sets `flashEnabled: true`, optionally dry-runs quote-only cases with `--preflight-quotes`, verifies setup evidence when `--verify-tx-evidence` is set, submits exact-input, exact-output, result-aware exact-output, add/remove, zap-in/zap-out, and flash-borrow route cases, writes artifacts under `OUT_DIR`, and verifies landed route evidence. The checked `pyth-current-testnet.live-evidence.matrix.json` is verifier-only for the latest landed Pyth setup, swap, liquidity, zap, flash, and result-aware exact-output transactions.

```sh
OUT_DIR=/private/tmp/brownfi-pyth-current-testnet-$(date +%Y%m%d-%H%M%S)

rtk "$NODE24" tools/run-pyth-launch-sequence.mjs \
  --network testnet \
  --feeds configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json \
  --runtime tools/pyth-launch-runtime.mjs \
  --runtime-config configs/launch/pyth-current-testnet.runtime.example.json \
  --out-dir "$OUT_DIR" \
  --use-rtk \
  --check-gas \
  --active-address "$BROWNFI_SUI_SENDER" \
  --rpc-url "$BROWNFI_SUI_RPC_URL" \
  --min-gas-mist 100000000 \
  --expected-dependency 0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837 \
  --expected-dependency 0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94 \
  --expected-module swap \
  --expected-module router \
  --expected-module oracle_gateway \
  --expected-module pyth_source \
  --expected-module flash \
  --expected-module wormhole_link \
  --preflight-quotes \
  --verify-tx-evidence \
  --tx-evidence-rpc-url "$BROWNFI_SUI_RPC_URL" \
  --tx-evidence-use-rtk \
  --tx-evidence-rpc-retries 12 \
  --tx-evidence-rpc-retry-delay-ms 1000
```

For an opt-in protocol-fee run, create a local pool-only values file from
`configs/launch/pyth-current-testnet.protocol-fee.values.example.json` with a live `FEE_TO`, then add:

```sh
  --pool-template configs/launch/pyth-current-testnet.protocol-fee.pool.example.json \
  --pool-values /path/to/protocol-fee-values.json
```

`--pool-values` are passed only to pool materialization, so `FEE_TO` does not leak into matrix materialization. When the protocol-fee pool template is used, the sequence configures `fee_to` and protocol fee after pool creation, submits routes, then claims protocol LP, transfers the claimed LP coin to configured `FEE_TO`, and verifies `setup:protocolLpClaim` when `--verify-tx-evidence` is set.

The sequence writes:

- `$OUT_DIR/test-coins.json`
- `$OUT_DIR/brownfi-publish.json`
- `$OUT_DIR/pool.json`
- `$OUT_DIR/pool-result.json`
- `$OUT_DIR/matrix.json`
- `$OUT_DIR/quote-preflight.json` when `--preflight-quotes` is set
- `$OUT_DIR/submit.json`
- `$OUT_DIR/protocol-lp-claim.json` when protocol fee setup is enabled
- `$OUT_DIR/summary.json`

`summary.json` includes generated `setupEvidence` for the test-coin publish, BrownFi package publish, pool-create, optional protocol-fee setup, and optional flash-enable transactions. When `--preflight-quotes` is set, quote-only dry-run results are written to `quote-preflight.json` and summarized under `results.quotePreflight`; for a fresh current-source package this includes the max-bound quote case from the checked matrix template. When `--verify-tx-evidence` is set, it also includes `setupVerification`; route evidence and route verification remain in `submit.json`. Protocol-LP claim evidence and the configured fee recipient are written under `results.protocolLpClaim` when protocol fee setup is enabled.

If setup transactions already landed but later verification failed, rerun with:

```sh
rtk "$NODE24" tools/run-pyth-launch-sequence.mjs \
  --network testnet \
  --feeds configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json \
  --runtime tools/pyth-launch-runtime.mjs \
  --runtime-config configs/launch/pyth-current-testnet.runtime.example.json \
  --out-dir "$OUT_DIR" \
  --use-rtk \
  --resume-existing-artifacts \
  --verify-tx-evidence \
  --tx-evidence-rpc-url "$BROWNFI_SUI_RPC_URL" \
  --tx-evidence-use-rtk \
  --tx-evidence-rpc-retries 12 \
  --tx-evidence-rpc-retry-delay-ms 1000
```

`--resume-existing-artifacts` reuses successful `test-coins.json`, `brownfi-publish.json`, and `pool-result.json`; route submission resumes from prefix `txEvidence` in `submit.json`.

## Current Known Landed Evidence

The checked evidence matrix records the 2026-06-17 protocol-fee launch:

- Test coins package: `0x7f05d737f545fdca57539f9c85b44f50e66860832e161b80c58a5e0cbd7856ef`
- Test coins digest: `6cFqREnD264yWR14fToWiwwfuNkXutHcpsHXfjkHqifh`
- BrownFi package: `0x80503414708cfc44705615b9b10c31676af8b37ba6c83bbd86fefc3e069ecad9`
- BrownFi package digest: `13Sny17FWN4czLC2GybBRv5TPNMTBaRY4vPXkW5W9Tot`
- Pool: `0x7bebba8475103e2779c2a951b00a003f588003602bf58656ad1fa74c4f222887`
- Pool-create digest: `4ynf6oiMHk7wZUXFpqELwoCVwGnvmKPmoAG3L2BotrMu`
- LP coin: `0x0417af08ac65eeca14c4b3c3eb785232469305dc1b41b5110d3f387d5ea33032`
- Protocol-fee setup digest: `HaxcXDwFRjxfn3D15hJDnZxrzibex75o5XqcM8x4pge`
- Flash-enable digest: `9ozBVd3vD646e5GjYW9s8yUp3ZX5eS7FyRCHyq7R5W9`
- Protocol-LP claim digest: `AfcMRm9SQyNZ2zy8thJddAW3XftGMuVQikmuzK1zc4wH`
- Exact-input swap digest: `HwRwdNGzGGpTWbX6ygoWbQR29JLVGQdMiwVbv5P51Af1`
- Exact-output swap digest: `5LE3UMidsg8awmHUzSoHvXr24huRzYJUKT6AAZYGV9pM`
- Result-aware exact-output digest: `87w8zKy94PfVWcYTzBKZHUFL74k2cpJyWsp4SSumTaVR`
- Add-liquidity digest: `4vMiuTdNHmqqmQVyHJxLLQB87HGNyqHhLpZYhCMdjVvh`
- Remove-liquidity digest: `A4RyrfATPS7HPWhQZAcemHqcuanoWfw6cz4ztQftKGc9`
- Zap-in-A digest: `7VRTg2M9Uzoy1kc1NTZg6vjkhxnoVd9Xdo2UGhV6nEgx`
- Zap-in-B digest: `G2rBTNqdkwwysCiRRfF2sKHXZ5T2VFtYHBUBAtvtM1R8`
- Zap-out-A digest: `CBPqUWXwV8o6qiywcfxfbDBQYk68rD9BQMzfkhyRkSfm`
- Zap-out-B digest: `9gNSeQ5EMTnjbHbUCeGTHQPZ5EWjFf9jbydbjk7PBvkJ`
- Flash-borrow-A digest: `BtNqLWGRVTrogXAN63x52JixVL5TBeV4PeJxcjDcTkTG`
- Flash-borrow-B digest: `85kRkpDmcEXndb2bnncTS9FRzgBrnCYUfydwrkXiLJED`
