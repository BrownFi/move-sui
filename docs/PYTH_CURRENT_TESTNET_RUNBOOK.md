# BrownFi V3 Current-Pyth Testnet Runbook

Status: Pyth-only operational runbook.

This runbook uses the checked current-Pyth launch defaults:

- Launch profile: `configs/launch/pyth-current-testnet.json`
- Pool template: `configs/launch/pyth-current-testnet.pool.example.json`
- Matrix template: `configs/launch/pyth-current-testnet.matrix.example.json`
- Runtime config: `configs/launch/pyth-current-testnet.runtime.example.json`
- Feed values: `configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json`

The checked live evidence file is verifier-only:

- `configs/launch/pyth-current-testnet.live-evidence.matrix.json`

It records historical landed transactions. Its route input coin IDs may be spent, so do not submit from it.
It also carries live-value-clean cutoff-aware and raw/no-cutoff exact-input and exact-output quote cases for coverage validation; those quote cases do not have tx evidence because they are no-spend cases.

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
The 2026-06-16 testnet run returned four Pyth quote cases and zero route cases.

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
  --setup flashEnable \
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

This publishes launch test coins, publishes the BrownFi current-Pyth package, creates a Pyth-backed pool, enables flash for that pool when the pool template sets `flashEnabled: true`, verifies setup evidence when `--verify-tx-evidence` is set, submits exact-input and exact-output swap plus add/remove/zap-in/zap-out/flash-borrow route cases, writes artifacts under `OUT_DIR`, and verifies landed route evidence. The checked `pyth-current-testnet.live-evidence.matrix.json` is verifier-only for the latest landed Pyth setup, swap, liquidity, zap, and flash transactions.

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
  --verify-tx-evidence \
  --tx-evidence-rpc-url "$BROWNFI_SUI_RPC_URL" \
  --tx-evidence-use-rtk \
  --tx-evidence-rpc-retries 12 \
  --tx-evidence-rpc-retry-delay-ms 1000
```

The sequence writes:

- `$OUT_DIR/test-coins.json`
- `$OUT_DIR/brownfi-publish.json`
- `$OUT_DIR/pool.json`
- `$OUT_DIR/pool-result.json`
- `$OUT_DIR/matrix.json`
- `$OUT_DIR/submit.json`
- `$OUT_DIR/summary.json`

`summary.json` includes generated `setupEvidence` for the test-coin publish, BrownFi package publish, pool-create, and optional flash-enable transactions. When `--verify-tx-evidence` is set, it also includes `setupVerification`; route evidence and route verification remain in `submit.json`.

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

The checked evidence matrix records:

- Test coins package: `0xff23e4c74d9fdc8820ea55ee8c79ea498d10e0b6a97ad1925d0e379989d3883c`
- Test coins digest: `bJHz72312R777BkUihaGMeRVoU9QaxB1fXC7UUEfpw2`
- BrownFi package: `0x26e904b6dd56a7f8ff1671584eb0b7da138993663e5d48294d3c2c004fe2a629`
- BrownFi package digest: `3n3WhX63AQ8SVjbhL8EcyGWpP2xSoX74BhjuSnPEYJEz`
- Pool: `0xafbf7faf6b99f573a2717684451e9f9ecf9904cce6aa4b8cca1d75a730fe09ca`
- Pool-create digest: `BFuhrzvjtgZKRvCNLrP7oNaSzFHiQy2hpXKWkQgnMjjz`
- LP coin: `0x3e933f5af65654f4792348d98e58cbec7ee1b20441edcf5dc68e38a3bfa4f590`
- Flash-enable digest: `24jBprRwgqPG9aqcFAjZaeDHP6D86JjyDyW8t6EMWs6J`
- Exact-input swap digest: `FhmphFaiT4RzHXfEprH4zGmZUtKDWSoeHT1x1u1jf9Ht`
- Exact-output swap digest: `F6uVciswJ2SHphVExbrPRyeavmfmVegUFjpoC5diu1ga`
- Add-liquidity digest: `praGFhbZZFK7C7Aa3kWSsK9qWWBgriygZbdYBY6nuSE`
- Remove-liquidity digest: `GMb2P1Xhi9x3Y2NPc2t6wDzDZYodzhXyy33ATKiTZyDb`
- Zap-in-A digest: `6qZzpQUT9ioZCPKbggQhMZwZ2Koh7AQuDR4SiJGiLXva`
- Zap-in-B digest: `B24ehmKuXAyTTZRakE4DZ3YDRvX2hYAL2YoqXTJPwUhh`
- Zap-out-A digest: `6Tw53jsQgbkBzgWMpknXrdrdntnSsMtUBod1Lr1gdzUr`
- Zap-out-B digest: `ALnNCR5JfxFE6x5zTpiQZZfaTzgEMjE5wWw7PHKCCuNx`
- Flash-borrow-A digest: `EQrn4T1LHaRLu7zuxKkTGsD2NGYHdW2NCapJa3onRvC9`
- Flash-borrow-B digest: `HiYzRpQUXRi4KTfn2DJMoaMmiyp7Q47WuyZmBeqwobuS`
