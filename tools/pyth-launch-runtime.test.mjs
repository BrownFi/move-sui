#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import {
  createLaunchMatrixRuntime,
  createPythLaunchMatrixRuntime
} from "./pyth-launch-runtime.mjs";

const toolsDir = path.dirname(fileURLToPath(import.meta.url));

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-pyth-launch-runtime-"));
}

test("createPythLaunchMatrixRuntime wires Pyth provider registry and Sui execution", async () => {
  const root = fixtureRoot();
  const runtimeConfig = path.join(root, "runtime.json");
  writeJson(runtimeConfig, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "upgraded",
    rpcUrlEnv: "BROWNFI_RPC_URL",
    privateKeyEnv: "BROWNFI_PRIVATE_KEY",
    senderAddressEnv: "BROWNFI_SENDER",
    requirePythApiKey: true,
    pythApiKeyEnv: "BROWNFI_PYTH_KEY",
    pythHermesEndpointEnv: "BROWNFI_PYTH_ENDPOINT"
  });

  const calls = [];
  class FakeSuiClient {
    constructor(options) {
      this.options = options;
      calls.push(["SuiClient", options]);
    }

    async signAndExecuteTransaction(input) {
      calls.push(["signAndExecuteTransaction", input]);
      return {
        digest: "digest-0",
        effects: {
          status: { status: "success" },
          transactionDigest: "digest-0"
        }
      };
    }
  }
  class FakeTransaction {
    constructor() {
      this.sender = undefined;
    }

    setSender(sender) {
      this.sender = sender;
    }
  }

  const runtime = await createPythLaunchMatrixRuntime({
    config: { network: "testnet" },
    runtimeConfig,
    env: {
      BROWNFI_RPC_URL: "https://fullnode.testnet.sui.io:443",
      BROWNFI_PRIVATE_KEY: "suiprivkey-test",
      BROWNFI_SENDER: "0xabc",
      BROWNFI_PYTH_KEY: "pyth-token",
      BROWNFI_PYTH_ENDPOINT: "https://hermes.pyth.network"
    },
    SuiClient: FakeSuiClient,
    getFullnodeUrl(network) {
      return `https://${network}.fallback.example`;
    },
    Transaction: FakeTransaction,
    SuiPriceServiceConnection: class FakeConnection {},
    SuiPythClient: class FakePythClient {},
    keypairFromPrivateKey(privateKey) {
      calls.push(["keypairFromPrivateKey", privateKey]);
      return { kind: "signer" };
    },
    routerSdk: {
      createPythSuiClients(options) {
        calls.push(["createPythSuiClients", options]);
        return {
          priceFeedConnection: { kind: "connection" },
          pythClient: { kind: "pyth-client" },
          contractConfig: { pythStateId: "0x1", wormholeStateId: "0x2" }
        };
      },
      createStandardRoutePriceProviderRegistry(options) {
        calls.push(["createStandardRoutePriceProviderRegistry", options]);
        return { kind: "registry", options };
      }
    }
  });

  assert.equal(runtime.network, "testnet");
  assert.equal(runtime.sender, "0xabc");
  assert.equal(runtime.suiClient.options.url, "https://fullnode.testnet.sui.io:443");
  assert.deepEqual(runtime.providerRegistry, {
    kind: "registry",
    options: {
      pyth: {
        priceFeedConnection: { kind: "connection" },
        pythClient: { kind: "pyth-client" }
      }
    }
  });
  assert.deepEqual(runtime.priceFeedConnection, { kind: "connection" });
  assert.deepEqual(runtime.pythClient, { kind: "pyth-client" });
  assert.deepEqual(runtime.pythContractConfig, { pythStateId: "0x1", wormholeStateId: "0x2" });

  const poolTx = runtime.poolTransactionFactory();
  const routeTx = runtime.routeTransactionFactory();
  const quoteTx = runtime.quoteTransactionFactory();
  assert.equal(poolTx.sender, "0xabc");
  assert.equal(routeTx.sender, "0xabc");
  assert.equal(quoteTx.sender, "0xabc");

  const execution = await runtime.executeTransaction(routeTx);
  assert.equal(execution.digest, "digest-0");
  assert.deepEqual(calls.find((call) => call[0] === "keypairFromPrivateKey"), [
    "keypairFromPrivateKey",
    "suiprivkey-test"
  ]);
  assert.equal(
    calls.find((call) => call[0] === "createPythSuiClients")[1].apiKey,
    "pyth-token"
  );
  assert.equal(
    calls.find((call) => call[0] === "createPythSuiClients")[1].endpoint,
    "https://hermes.pyth.network"
  );
  assert.equal(
    calls.find((call) => call[0] === "signAndExecuteTransaction")[1].options.showEffects,
    true
  );
  assert.equal(
    calls.find((call) => call[0] === "signAndExecuteTransaction")[1].options
      .showObjectChanges,
    true
  );
});

test("createPythLaunchMatrixRuntime rejects matrix/runtime network mismatch", async () => {
  const root = fixtureRoot();
  const runtimeConfig = path.join(root, "runtime.json");
  writeJson(runtimeConfig, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "upgraded"
  });

  await assert.rejects(
    () =>
      createPythLaunchMatrixRuntime({
        config: { network: "mainnet" },
        runtimeConfig,
        env: {},
        SuiClient: class FakeSuiClient {},
        getFullnodeUrl(network) {
          return `https://${network}.fallback.example`;
        },
        Transaction: class FakeTransaction {},
        SuiPriceServiceConnection: class FakeConnection {},
        SuiPythClient: class FakePythClient {},
        routerSdk: {
          createPythSuiClients() {
            return {};
          },
          createStandardRoutePriceProviderRegistry() {
            return {};
          }
        }
      }),
    /Pyth launch runtime network testnet does not match matrix network mainnet/
  );
});

test("createLaunchMatrixRuntime forwards runtimeConfig to the Pyth runtime", async () => {
  const root = fixtureRoot();
  const runtimeConfig = path.join(root, "runtime.json");
  writeJson(runtimeConfig, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "current",
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    senderAddress: "0xabc",
    pythHermesEndpoint: "https://hermes-beta.pyth.network"
  });

  const calls = [];
  const runtime = await createLaunchMatrixRuntime({
    config: { network: "testnet" },
    runtimeConfig,
    env: {},
    SuiClient: class FakeSuiClient {},
    getFullnodeUrl(network) {
      return `https://${network}.fallback.example`;
    },
    Transaction: class FakeTransaction {
      setSender(sender) {
        this.sender = sender;
      }
    },
    SuiPriceServiceConnection: class FakeConnection {},
    SuiPythClient: class FakePythClient {},
    keypairFromPrivateKey() {
      throw new Error("private key should not be required");
    },
    routerSdk: {
      createPythSuiClients(options) {
        calls.push(["createPythSuiClients", options]);
        return {
          priceFeedConnection: {},
          pythClient: {},
          contractConfig: {}
        };
      },
      createStandardRoutePriceProviderRegistry() {
        return {};
      }
    }
  });

  assert.equal(runtime.sender, "0xabc");
  assert.equal(
    calls.find((call) => call[0] === "createPythSuiClients")[1].endpoint,
    "https://hermes-beta.pyth.network"
  );
  assert.equal(
    calls.find((call) => call[0] === "createPythSuiClients")[1].contractSet,
    "current"
  );
});

test("createLaunchMatrixRuntime defaults to the verified current-Pyth runtime config", async () => {
  const calls = [];

  await createLaunchMatrixRuntime({
    config: { network: "testnet" },
    env: {
      BROWNFI_SUI_RPC_URL: "https://fullnode.testnet.sui.io:443",
      BROWNFI_SUI_SENDER: "0xabc"
    },
    SuiClient: class FakeSuiClient {},
    getFullnodeUrl(network) {
      return `https://${network}.fallback.example`;
    },
    Transaction: class FakeTransaction {
      setSender(sender) {
        this.sender = sender;
      }
    },
    SuiPriceServiceConnection: class FakeConnection {},
    SuiPythClient: class FakePythClient {},
    keypairFromPrivateKey() {
      throw new Error("private key should not be required");
    },
    routerSdk: {
      createPythSuiClients(options) {
        calls.push(["createPythSuiClients", options]);
        return {
          priceFeedConnection: {},
          pythClient: {},
          contractConfig: {}
        };
      },
      createStandardRoutePriceProviderRegistry() {
        return {};
      }
    }
  });

  assert.equal(
    calls.find((call) => call[0] === "createPythSuiClients")[1].contractSet,
    "current"
  );
  assert.equal(
    calls.find((call) => call[0] === "createPythSuiClients")[1].endpoint,
    "https://hermes-beta.pyth.network"
  );
});

test("createPythLaunchMatrixRuntime rejects unsupported Node major versions before default imports", async () => {
  const root = fixtureRoot();
  const runtimeConfig = path.join(root, "runtime.json");
  writeJson(runtimeConfig, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "current"
  });

  await assert.rejects(
    () =>
      createPythLaunchMatrixRuntime({
        config: { network: "testnet" },
        runtimeConfig,
        nodeVersion: "v25.9.0",
        importModule() {
          throw new Error("dependency imports should not run before node engine check");
        }
      }),
    /Pyth launch runtime requires Node major 24/
  );
});

test("createPythLaunchMatrixRuntime can sign with an explicit Sui CLI keystore", async () => {
  const root = fixtureRoot();
  const keystore = path.join(root, "sui.keystore");
  writeJson(keystore, ["entry-a", "entry-b"]);
  const runtimeConfig = path.join(root, "runtime.json");
  writeJson(runtimeConfig, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "upgraded",
    suiKeystorePath: keystore,
    senderAddress: "0xbbb"
  });

  const calls = [];
  class FakeSuiClient {
    constructor(options) {
      this.options = options;
    }

    async signAndExecuteTransaction(input) {
      calls.push(["signAndExecuteTransaction", input]);
      return {
        digest: "digest-keystore"
      };
    }
  }

  const runtime = await createPythLaunchMatrixRuntime({
    config: { network: "testnet" },
    runtimeConfig,
    env: {},
    SuiClient: FakeSuiClient,
    getFullnodeUrl(network) {
      return `https://${network}.fallback.example`;
    },
    Transaction: class FakeTransaction {
      setSender(sender) {
        this.sender = sender;
      }
    },
    SuiPriceServiceConnection: class FakeConnection {},
    SuiPythClient: class FakePythClient {},
    keypairFromPrivateKey() {
      throw new Error("private key env should not be required");
    },
    keypairFromSuiKeystoreEntry(entry) {
      calls.push(["keypairFromSuiKeystoreEntry", entry]);
      const address = entry === "entry-b" ? "0xbbb" : "0xaaa";
      return {
        entry,
        getPublicKey() {
          return {
            toSuiAddress() {
              return address;
            }
          };
        }
      };
    },
    routerSdk: {
      createPythSuiClients() {
        return {
          priceFeedConnection: {},
          pythClient: {}
        };
      },
      createStandardRoutePriceProviderRegistry() {
        return {};
      }
    }
  });

  const tx = runtime.routeTransactionFactory();
  assert.equal(tx.sender, "0xbbb");
  const result = await runtime.executeTransaction(tx);
  assert.equal(result.digest, "digest-keystore");
  assert.deepEqual(
    calls.filter((call) => call[0] === "keypairFromSuiKeystoreEntry"),
    [
      ["keypairFromSuiKeystoreEntry", "entry-a"],
      ["keypairFromSuiKeystoreEntry", "entry-b"]
    ]
  );
  assert.equal(
    calls.find((call) => call[0] === "signAndExecuteTransaction")[1].signer.entry,
    "entry-b"
  );
});

test("createPythLaunchMatrixRuntime loads SuiPriceServiceConnection from pyth-sui-js", async () => {
  const root = fixtureRoot();
  const runtimeConfig = path.join(root, "runtime.json");
  writeJson(runtimeConfig, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "upgraded"
  });

  const runtime = await createPythLaunchMatrixRuntime({
    config: { network: "testnet" },
    runtimeConfig,
    nodeVersion: "v24.3.0",
    importModule(specifier) {
      if (specifier === "@mysten/sui/client") {
        return {
          SuiClient: class FakeSuiClient {
            constructor(options) {
              this.options = options;
            }
          },
          getFullnodeUrl(network) {
            return `https://${network}.fallback.example`;
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
              return { secretKey };
            }
          }
        };
      }
      if (specifier === "@mysten/sui/cryptography") {
        return {
          decodeSuiPrivateKey() {
            return { schema: "ED25519", secretKey: new Uint8Array([1]) };
          }
        };
      }
      if (specifier === "@mysten/sui/utils") {
        return {
          fromB64() {
            return new Uint8Array([0, 1]);
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
    },
    routerSdk: {
      createPythSuiClients(options) {
        assert.equal(options.SuiPriceServiceConnection.name, "FakeConnection");
        return {
          priceFeedConnection: {},
          pythClient: {}
        };
      },
      createStandardRoutePriceProviderRegistry() {
        return {};
      }
    }
  });

  assert.equal(runtime.network, "testnet");
});

test("tools package manifest declares live Pyth launch runtime dependencies", () => {
  const manifest = JSON.parse(fs.readFileSync(path.join(toolsDir, "package.json"), "utf8"));

  assert.equal(manifest.type, "module");
  assert.equal(typeof manifest.scripts?.test, "string");
  assert.equal(typeof manifest.dependencies?.["@mysten/sui"], "string");
  assert.match(manifest.dependencies["@mysten/sui"], /^\^1\./);
  assert.equal(typeof manifest.dependencies?.["@pythnetwork/pyth-sui-js"], "string");
  assert.match(manifest.dependencies["@pythnetwork/pyth-sui-js"], /^\^3\./);
});
