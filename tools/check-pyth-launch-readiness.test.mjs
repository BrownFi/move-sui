#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { checkPythLaunchReadiness } from "./check-pyth-launch-readiness.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-pyth-readiness-"));
}

function liveId(suffix) {
  return `0x${suffix.repeat(64).slice(0, 64)}`;
}

function writeLaunchConfig(root) {
  const file = path.join(root, "launch.json");
  writeJson(file, {
    providerIds: ["pyth"]
  });
  return file;
}

function writeRuntimeConfig(root, overrides = {}) {
  const file = path.join(root, "runtime.json");
  writeJson(file, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "upgraded",
    rpcUrlEnv: "BROWNFI_RPC_URL",
    privateKeyEnv: "BROWNFI_PRIVATE_KEY",
    senderAddressEnv: "BROWNFI_SENDER",
    requirePythApiKey: true,
    pythApiKeyEnv: "BROWNFI_PYTH_KEY",
    ...overrides
  });
  return file;
}

function writeMatrix(root) {
  const file = path.join(root, "matrix.json");
  const packageId = liveId("1");
  const typeA = `${packageId}::coin_a::COIN_A`;
  const typeB = `${packageId}::coin_b::COIN_B`;
  writeJson(file, {
    network: "testnet",
    providerIds: ["pyth"],
    routeLimits: {
      maxHops: 1,
      maxOracleSourcesPerHop: 1,
      maxAmmSourcesPerHop: 0,
      maxUpdatePayloadBytes: 250000
    },
    routeCases: [
      {
        name: "pyth exact input route",
        kind: "exact-input",
        providerId: "pyth",
        clock: "0x6",
        path: [typeA, typeB],
        pairs: [
          {
            packageId,
            typeA,
            typeB,
            pool: liveId("2"),
            feedIds: [liveId("a"), liveId("b")],
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        input: liveId("3"),
        minOutputs: ["1"]
      }
    ]
  });
  return file;
}

function dependencyImporter(imports) {
  return async (specifier) => {
    imports.push(specifier);
    if (specifier === "@mysten/sui/client") {
      return {
        SuiClient: class FakeSuiClient {},
        getFullnodeUrl() {
          return "https://fullnode.testnet.sui.io:443";
        }
      };
    }
    if (specifier === "@mysten/sui/transactions") {
      return {
        Transaction: class FakeTransaction {}
      };
    }
    if (specifier === "@mysten/sui/keypairs/ed25519") {
      return {
        Ed25519Keypair: class FakeKeypair {
          static fromSecretKey(secretKey) {
            return {
              getPublicKey() {
                return {
                  toSuiAddress() {
                    return secretKey[0] === 2 ? liveId("c") : liveId("d");
                  }
                };
              }
            };
          }
        }
      };
    }
    if (specifier === "@mysten/sui/cryptography") {
      return {
        decodeSuiPrivateKey() {}
      };
    }
    if (specifier === "@mysten/sui/utils") {
      return {
        fromB64(entry) {
          const bytes = new Uint8Array(33);
          bytes[1] = entry === "matching" ? 2 : 1;
          return bytes;
        }
      };
    }
    if (specifier === "@pythnetwork/pyth-sui-js") {
      return {
        SuiPythClient: class FakePythClient {},
        SuiPriceServiceConnection: class FakeConnection {}
      };
    }
    throw new Error(`unexpected import ${specifier}`);
  };
}

test("checkPythLaunchReadiness validates runtime, dependencies, signer, and gas", async () => {
  const root = fixtureRoot();
  const runtimeConfig = writeRuntimeConfig(root);
  const matrix = writeMatrix(root);
  const launchConfig = writeLaunchConfig(root);
  const imports = [];

  const summary = await checkPythLaunchReadiness({
    runtimeConfig,
    manifest: "configs/oracles/pyth-sui-contracts.json",
    matrix,
    launchConfig,
    requireSubmitSigner: true,
    nodeVersion: "v24.3.0",
    importModule: dependencyImporter(imports),
    env: {
      BROWNFI_RPC_URL: "https://fullnode.testnet.sui.io:443",
      BROWNFI_PRIVATE_KEY: "suiprivkey-test",
      BROWNFI_SENDER: liveId("c"),
      BROWNFI_PYTH_KEY: "pyth-token"
    },
    gasReadiness: {
      rpcUrl: "https://fullnode.testnet.sui.io:443",
      minMist: "100",
      execFileSync() {
        return JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            data: [
              {
                coinObjectId: liveId("d"),
                balance: "1000"
              }
            ],
            hasNextPage: false,
            nextCursor: null
          }
        });
      }
    }
  });

  assert.equal(summary.status, "success");
  assert.equal(summary.network, "testnet");
  assert.equal(summary.providerId, "pyth");
  assert.deepEqual(summary.node, {
    status: "success",
    requiredMajor: "24",
    actualVersion: "v24.3.0"
  });
  assert.equal(summary.dependencies.status, "success");
  assert.deepEqual(imports.sort(), [
    "@mysten/sui/client",
    "@mysten/sui/cryptography",
    "@mysten/sui/keypairs/ed25519",
    "@mysten/sui/transactions",
    "@mysten/sui/utils",
    "@pythnetwork/pyth-sui-js"
  ]);
  assert.deepEqual(summary.submitSigner, {
    status: "success",
    signerSource: "env-private-key",
    privateKeyEnv: "BROWNFI_PRIVATE_KEY"
  });
  assert.equal(summary.gas.status, "success");
  assert.equal(summary.gas.totalMist, "1000");
});

test("checkPythLaunchReadiness accepts an explicit Sui CLI keystore signer", async () => {
  const root = fixtureRoot();
  const keystore = path.join(root, "sui.keystore");
  writeJson(keystore, ["not-matching", "matching"]);
  const runtimeConfig = writeRuntimeConfig(root, {
    privateKeyEnv: "BROWNFI_PRIVATE_KEY",
    suiKeystorePath: keystore,
    senderAddress: liveId("c")
  });

  const summary = await checkPythLaunchReadiness({
    runtimeConfig,
    manifest: "configs/oracles/pyth-sui-contracts.json",
    requireSubmitSigner: true,
    nodeVersion: "v24.3.0",
    importModule: dependencyImporter([]),
    env: {
      BROWNFI_PYTH_KEY: "pyth-token"
    }
  });

  assert.deepEqual(summary.submitSigner, {
    status: "success",
    signerSource: "sui-keystore",
    address: liveId("c")
  });
});

test("checkPythLaunchReadiness rejects unsupported Node major versions", async () => {
  const root = fixtureRoot();

  await assert.rejects(
    () =>
      checkPythLaunchReadiness({
        runtimeConfig: writeRuntimeConfig(root),
        manifest: "configs/oracles/pyth-sui-contracts.json",
        nodeVersion: "v25.9.0",
        importModule: dependencyImporter([]),
        env: {
          BROWNFI_PYTH_KEY: "pyth-token"
        }
      }),
    /Pyth launch runtime requires Node major 24/
  );
});

test("checkPythLaunchReadiness rejects missing submit signer env", async () => {
  const root = fixtureRoot();

  await assert.rejects(
    () =>
      checkPythLaunchReadiness({
        runtimeConfig: writeRuntimeConfig(root),
        manifest: "configs/oracles/pyth-sui-contracts.json",
        requireSubmitSigner: true,
        nodeVersion: "v24.3.0",
        importModule: dependencyImporter([]),
        env: {
          BROWNFI_PYTH_KEY: "pyth-token"
        }
      }),
    /Pyth launch readiness requires BROWNFI_PRIVATE_KEY to be set for submit/
  );
});

test("checkPythLaunchReadiness checks gas before dependency imports", async () => {
  const root = fixtureRoot();

  await assert.rejects(
    () =>
      checkPythLaunchReadiness({
        runtimeConfig: writeRuntimeConfig(root),
        manifest: "configs/oracles/pyth-sui-contracts.json",
        nodeVersion: "v24.3.0",
        importModule() {
          throw new Error("dependency import should not run before gas");
        },
        env: {
          BROWNFI_PYTH_KEY: "pyth-token"
        },
        gasReadiness: {
          network: "testnet",
          activeAddress: liveId("c"),
          rpcUrl: "https://fullnode.testnet.sui.io:443",
          minMist: "100",
          execFileSync() {
            return JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              result: {
                data: [],
                hasNextPage: false,
                nextCursor: null
              }
            });
          }
        }
      }),
    /No Sui gas coins found on testnet for 0xcccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccccc/
  );
});
