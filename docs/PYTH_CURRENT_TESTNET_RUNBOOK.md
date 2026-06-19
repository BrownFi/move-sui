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

The checked live evidence files are verifier-only:

- `configs/launch/pyth-current-testnet.live-evidence.matrix.json` for the 2026-06-17 protocol-fee launch.
- `configs/launch/pyth-current-testnet.current-source-live-evidence.matrix.json` for the 2026-06-18 fresh current-source launch.
- `configs/launch/pyth-current-testnet.sui-usdt-live-evidence.matrix.json` for the 2026-06-18 native SUI / test USDT launch.

They record historical landed transactions. Their route input coin IDs may be spent, so do not submit from them.
They also carry live-value-clean quote cases for coverage validation; those quote cases do not have tx evidence because they are no-spend cases.

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

This publishes launch test coins, publishes the BrownFi current-Pyth package, creates a Pyth-backed pool, enables flash for that pool when the pool template sets `flashEnabled: true`, optionally dry-runs quote-only cases with `--preflight-quotes`, verifies setup evidence when `--verify-tx-evidence` is set, submits exact-input, exact-output, result-aware exact-output, add/remove, zap-in/zap-out, and flash-borrow route cases, writes artifacts under `OUT_DIR`, and verifies landed route evidence. `pyth-current-testnet.current-source-live-evidence.matrix.json` is verifier-only for the 2026-06-18 fresh current-source default launch; `pyth-current-testnet.live-evidence.matrix.json` remains the 2026-06-17 protocol-fee evidence matrix.

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

Additional 2026-06-18 fresh current-source current-Pyth evidence:

- Test coins package: `0x03b90ff3c760df885b36ae6f55920f93ccffade73486913876968c88fe7cd43a`
- Test coins digest: `5Sa6iJXYEyvaNN6DYMdPpVrtNmjYzhn3fSbZ97E1b6rx`
- BrownFi package: `0x23b6db1a5ba301e6d71123a375de6fcf963a22a8a1e9c0b7bb84c826e19b57be`
- BrownFi package digest: `GbtuJKydpVdrknqYfsnUio9wzuqXfe4iCPn3tRuXmjUJ`
- Pool: `0xcf260008fc7ff1f0604856a8cfdbcb36cc041dc457969e1f262b22d1412d31b6`
- Pool-create digest: `9HBaPD9LihZz5LPvxZ2mYPyosdCryfBmBxDAajVwPG96`
- LP coin: `0xefd0cead49416b086368da8f85992d02521bcff0a6f5f30798f5747cdbb13359`
- Flash-enable digest: `FQw7Ev987bsHgaeX3esYfbqs6K6ohRvR3wPTg6rTQ9Nu`
- Exact-input swap digest: `9i5ncFWzQNPUa16qGCGRJrHkBgHfHfsRdmbBR8J5oAUP`
- Exact-output swap digest: `7QqujEjLRwaZMPQGAFpKpqtwsEdvAYWuawA2fYTuDC81`
- Result-aware exact-output digest: `2ZsQaXFtU2RkBwTreKyMcbct2URr3iQyteSbQW3shPrp`
- Add-liquidity digest: `6grxXsCS6p2T91xaCkjszowN5zagWqmPrtiW8x7Q38tV`
- Remove-liquidity digest: `2YQnCbByJo4QNQTeaFSj9ESQeK2hjJMy9EgTRhfx1MnX`
- Zap-in-A digest: `CVJpLn74uhnD3yt1mXp6zx7Rsv5NVEZW6RU9Cqye1Mwb`
- Zap-in-B digest: `3Ev5vHpUGWeFZfZ4XF7EaT61GkdaQrCE1NasyU2s6a1R`
- Zap-out-A digest: `PJWWqd3GNozETJbxqMB12EpzgT3c9s6xFUEjAeazGqu`
- Zap-out-B digest: `HtkmmPKfrVgmoexCZi2PtHkM3N4VzgVJrTjqQJnKUhPN`
- Flash-borrow-A digest: `6DhVChgWvKsEu2qZngct1aFh4L4buYsTnfui2qQNWEiP`
- Flash-borrow-B digest: `3iQVdSQ5WH1ifDasYht1qnkRum9DKqJtJzFnPnh2ospW`

The checked verifier-only matrix for this fresh current-source run is `configs/launch/pyth-current-testnet.current-source-live-evidence.matrix.json`. It records setup evidence, all 11 landed route transactions, and six quote-only cases: exact-input, exact-output, exact-output round-trip, max-bound, raw exact-input, and raw exact-output.

```bash
rtk node tools/validate-launch-matrix.mjs \
  --config configs/launch/pyth-current-testnet.current-source-live-evidence.matrix.json \
  --launch-config configs/launch/pyth-current-testnet.json \
  --require-live-values
```

```bash
rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.current-source-live-evidence.matrix.json \
  --all \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk
```

Additional 2026-06-18 native SUI / test USDT evidence:

- BrownFi package: `0x7d082a9b04ef6cee7793da2553cbf59def37e740fa0e63cf839f55a5cb46e8c4`
- Pool: `0x04a273289ecabd5731f9fab769fbcdae1df130cba13b0ba0f9687a7b766dd183`
- USDT type: `0x429630f969bec64e7e583df35090d4b764bb2ed8abeabbe697dd2a599b598c9f::usdt::USDT`
- USDT metadata registry finalization digest: `AnVMW1vp3qaBJY33aXU9o81WvGi5A1mhWL7EpnCeRdic`
- USDT shared currency object: `0x31b1b7cc75a468699c79356f312c52ea3b854eb1b4abd6e73a917d23eeac239b`
- Initial exact-input SUI -> USDT digest: `4rz84gvfC7tccf4oHUXLDwfXLWS9VbMddm47H3SswJnf`
- Initial add-liquidity digest: `7N93fdPcCqQD2MFCgxxUxVX3Xxg1Qcxgx7P4oSoeggQS`
- Initial remove-liquidity digest: `RHq79ynHyCqVZBLY1YgY94fWxj1NkDmW6j4x3dHWhB9`
- Exact-output digest: `Cvur9khNv9DZbzf78u2QgpAzPv1LXFdGJtGc674be761`
- Result-aware exact-output digest: `GpsXRtpqMeEpcNpUXX7AN8Ra2izsFLcTT4rYovuNS2gG`
- Zap-in-A digest: `XoPQp2RESM9gSR3Byw7f2io8WnhhJRDXWbuUAcke1X8`
- Zap-in-B digest: `HrcYrQo6Y4zKf6H3E3dG9G8aR58nNBF3fLqQUL2tiwtY`
- Zap-out-A digest: `8YbvXsqToZTSvhoftLWUtEZ9YhQmTYHuw9SZ55snxFPs`
- Zap-out-B digest: `D8xh4UTNrPfVPcbYPmjYeEpCZHR1fgfbUDTSmy1RZNJB`
- Flash-borrow-A digest: `7cUPxu8v1kAjong6iBbYsDvFNAjy8PLxcWv9c511Qqq`
- Flash-borrow-B digest: `HxfcRu6CapUjHTF1UNEWLiFdPJZTcWouSDCjH8CvMvbw`

The checked verifier-only matrix for this native SUI / test USDT run is `configs/launch/pyth-current-testnet.sui-usdt-live-evidence.matrix.json`. It records historical input coin IDs, so use it to verify landed tx evidence rather than to resubmit routes. The same matrix includes quote-only cases for exact-input, exact-output, exact-output round-trip, raw exact-input, and raw exact-output preflight against the live SUI/USDT pool; it intentionally omits the newer max-bound quote case because package `0x7d082a9b04ef6cee7793da2553cbf59def37e740fa0e63cf839f55a5cb46e8c4` does not expose `quote_max_*` helpers.

```bash
rtk node tools/verify-sui-cli-tx-evidence.mjs \
  --config configs/launch/pyth-current-testnet.sui-usdt-live-evidence.matrix.json \
  --all \
  --rpc-url https://fullnode.testnet.sui.io:443 \
  --use-rtk
```

```bash
rtk env BROWNFI_SUI_SENDER=0x3eb3bafd39074ef149c53fc5c6aa0b9f7c08552df956011f85dd41026fe88c04 \
  /Applications/Codex.app/Contents/Resources/node tools/run-launch-matrix-preflight.mjs \
  --config configs/launch/pyth-current-testnet.sui-usdt-live-evidence.matrix.json \
  --launch-config configs/launch/pyth-current-testnet.json \
  --runtime tools/pyth-launch-runtime.mjs \
  --runtime-config configs/launch/pyth-current-testnet.runtime.example.json \
  --quote-only
```

The SUI/USDT remaining-route matrix used configured input and flash-fee coin splits during preflight, then route submission kept one submit-time split per configured amount. The final route preflight passed 8/8 before the exact-output, zap, and flash transactions above were submitted and verified.
