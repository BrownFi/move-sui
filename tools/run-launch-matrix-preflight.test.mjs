#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runLaunchMatrixPreflightConfigFile } from "./run-launch-matrix-preflight.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const routerDistUrl = pathToFileURL(path.join(repoRoot, "sdk/router/dist/index.js")).href;

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-preflight-"));
}

function writeMatrix(root) {
  const config = path.join(root, "matrix.json");
  writeJson(config, {
    providerIds: ["custom"],
    network: "devnet",
    routeLimits: {
      maxHops: 1,
      maxOracleSourcesPerHop: 1,
      maxAmmSourcesPerHop: 0,
      maxUpdatePayloadBytes: 0
    },
    quoteCases: [
      {
        name: "custom exact input quote",
        kind: "exact-input-quote",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [
          {
            packageId: "0x1",
            typeA: "0x1::coin_a::COIN_A",
            typeB: "0x1::coin_b::COIN_B",
            pool: "0x2",
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        amountIn: "100"
      }
    ]
  });
  return config;
}

function writeMixedMatrix(root) {
  const config = path.join(root, "mixed-matrix.json");
  writeJson(config, {
    providerIds: ["custom"],
    network: "devnet",
    routeLimits: {
      maxHops: 1,
      maxOracleSourcesPerHop: 1,
      maxAmmSourcesPerHop: 0,
      maxUpdatePayloadBytes: 0
    },
    routeCases: [
      {
        name: "custom exact input route",
        kind: "exact-input",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [
          {
            packageId: "0x1",
            typeA: "0x1::coin_a::COIN_A",
            typeB: "0x1::coin_b::COIN_B",
            pool: "0x2",
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        input: "0x3",
        inputAmount: "100",
        minOutputs: ["1"]
      }
    ],
    quoteCases: [
      {
        name: "custom exact input quote",
        kind: "exact-input-quote",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [
          {
            packageId: "0x1",
            typeA: "0x1::coin_a::COIN_A",
            typeB: "0x1::coin_b::COIN_B",
            pool: "0x2",
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        amountIn: "100"
      }
    ]
  });
  return config;
}

function writeLaunchConfig(root, providerIds) {
  const config = path.join(root, "launch.json");
  writeJson(config, { providerIds });
  return config;
}

function writeRuntime(root) {
  const runtime = path.join(root, "runtime.mjs");
  fs.writeFileSync(
    runtime,
    `import { createRoutePriceProviderRegistry } from ${JSON.stringify(routerDistUrl)};

function createTransaction(label) {
  return {
    calls: [],
    object(id) {
      return { kind: "object", id };
    },
    pure: {
      u64(value) {
        return { kind: "u64", value: String(value) };
      }
    },
    makeMoveVec(vector) {
      return { kind: "vector", label, vector };
    },
    moveCall(call) {
      const result = { kind: "result", label, index: this.calls.length };
      const nested = (resultIndex) => ({
        kind: "nested-result",
        index: result.index,
        resultIndex
      });
      Object.defineProperties(result, {
        0: { value: nested(0), enumerable: false },
        1: { value: nested(1), enumerable: false },
        [Symbol.iterator]: {
          value: function* iterator() {
            yield this[0];
            yield this[1];
          },
          enumerable: false
        }
      });
      this.calls.push(call);
      return result;
    },
    async build() {
      return "built-" + label;
    }
  };
}

export async function createLaunchMatrixRuntime({ config }) {
  if (config.providerIds[0] !== "custom") {
    throw new Error("runtime received unexpected provider IDs");
  }
  return {
    network: "devnet",
    providerRegistry: createRoutePriceProviderRegistry([
      {
        id: "custom",
        async buildPriceBundles(_tx, options) {
          return options.hops.map((hop) => ({ kind: "bundle", pool: hop.pool }));
        }
      }
    ]),
    quoteTransactionFactory(_validationCase, index) {
      return createTransaction("quote-" + index);
    },
    suiClient: {
      async dryRunTransactionBlock(input) {
        return { effects: { status: { status: "success" } }, input };
      }
    }
  };
}
`
  );
  return runtime;
}

function writeQuoteOnlyRuntime(root) {
  const runtime = path.join(root, "runtime-quote-only.mjs");
  fs.writeFileSync(
    runtime,
    `import { createRoutePriceProviderRegistry } from ${JSON.stringify(routerDistUrl)};

function createTransaction(label) {
  return {
    calls: [],
    object(id) {
      return { kind: "object", id };
    },
    pure: {
      u64(value) {
        return { kind: "u64", value: String(value) };
      }
    },
    makeMoveVec(vector) {
      return { kind: "vector", label, vector };
    },
    moveCall(call) {
      const result = { kind: "result", label, index: this.calls.length };
      const nested = (resultIndex) => ({
        kind: "nested-result",
        index: result.index,
        resultIndex
      });
      Object.defineProperties(result, {
        0: { value: nested(0), enumerable: false },
        1: { value: nested(1), enumerable: false },
        [Symbol.iterator]: {
          value: function* iterator() {
            yield this[0];
            yield this[1];
          },
          enumerable: false
        }
      });
      this.calls.push(call);
      return result;
    },
    async build() {
      return "built-" + label;
    }
  };
}

export async function createLaunchMatrixRuntime() {
  return {
    network: "devnet",
    providerRegistry: createRoutePriceProviderRegistry([
      {
        id: "custom",
        async buildPriceBundles(_tx, options) {
          return options.hops.map((hop) => ({ kind: "bundle", pool: hop.pool }));
        }
      }
    ]),
    routeTransactionFactory() {
      throw new Error("quote-only preflight should skip route transaction construction");
    },
    quoteTransactionFactory(_validationCase, index) {
      return createTransaction("quote-" + index);
    },
    suiClient: {
      async dryRunTransactionBlock(input) {
        return { effects: { status: { status: "success" } }, input };
      }
    }
  };
}
`
  );
  return runtime;
}

function writeSenderRouteRuntime(root) {
  const runtime = path.join(root, "runtime-sender-route.mjs");
  fs.writeFileSync(
    runtime,
    `import { createRoutePriceProviderRegistry } from ${JSON.stringify(routerDistUrl)};

function createTransaction(label) {
  return {
    calls: [],
    transfers: [],
    object(id) {
      return { kind: "object", id };
    },
    pure: {
      u64(value) {
        return { kind: "u64", value: String(value) };
      },
      address(value) {
        return { kind: "address", value };
      }
    },
    makeMoveVec(vector) {
      return { kind: "vector", label, vector };
    },
    transferObjects(objects, recipient) {
      this.transfers.push({ objects, recipient });
    },
    moveCall(call) {
      const result = { kind: "result", label, index: this.calls.length };
      const nested = (resultIndex) => ({
        kind: "nested-result",
        index: result.index,
        resultIndex
      });
      Object.defineProperties(result, {
        0: { value: nested(0), enumerable: false },
        1: { value: nested(1), enumerable: false },
        [Symbol.iterator]: {
          value: function* iterator() {
            yield this[0];
            yield this[1];
          },
          enumerable: false
        }
      });
      this.calls.push(call);
      return result;
    },
    async build() {
      return "built-" + label + "-transfers-" + this.transfers.length;
    }
  };
}

export async function createLaunchMatrixRuntime() {
  return {
    network: "devnet",
    sender: "0xSENDER",
    providerRegistry: createRoutePriceProviderRegistry([
      {
        id: "custom",
        async buildPriceBundles(_tx, options) {
          return options.hops.map((hop) => ({ kind: "bundle", pool: hop.pool }));
        }
      }
    ]),
    routeTransactionFactory(_routeCase, index) {
      return createTransaction("route-" + index);
    },
    quoteTransactionFactory(_validationCase, index) {
      return createTransaction("quote-" + index);
    },
    suiClient: {
      async dryRunTransactionBlock(input) {
        return { effects: { status: { status: "success" } }, input };
      }
    }
  };
}
`
  );
  return runtime;
}

function writeNetworkRuntime(root, network) {
  const runtime = path.join(root, "runtime-network.mjs");
  fs.writeFileSync(
    runtime,
    `import { createRoutePriceProviderRegistry } from ${JSON.stringify(routerDistUrl)};

export async function createLaunchMatrixRuntime() {
  return {
    network: ${JSON.stringify(network)},
    providerRegistry: createRoutePriceProviderRegistry([
      {
        id: "custom",
        async buildPriceBundles() {
          throw new Error("network mismatch should stop before provider execution");
        }
      }
    ]),
    quoteTransactionFactory() {
      throw new Error("network mismatch should stop before PTB construction");
    },
    suiClient: {
      async dryRunTransactionBlock() {
        throw new Error("network mismatch should stop before dry-run");
      }
    }
  };
}
`
  );
  return runtime;
}

test("runLaunchMatrixPreflightConfigFile dry-runs a live-ready matrix through runtime wiring", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const runtime = writeRuntime(root);

  const report = await runLaunchMatrixPreflightConfigFile({ config, runtime });

  assert.deepEqual(report.summary, {
    routeCaseCount: 0,
    quoteCaseCount: 1,
    totalCaseCount: 1,
    providerIds: ["custom"],
    routeCases: [],
    quoteCases: [
      {
        name: "custom exact input quote",
        kind: "exact-input-quote",
        providerId: "custom"
      }
    ]
  });
  assert.deepEqual(report.preflightResult.quoteResults[0].dryRunResult, {
    effects: { status: { status: "success" } },
    input: { transactionBlock: "built-quote-0" }
  });
});

test("runLaunchMatrixPreflightConfigFile can dry-run only quote cases from a mixed matrix", async () => {
  const root = fixtureRoot();
  const config = writeMixedMatrix(root);
  const runtime = writeQuoteOnlyRuntime(root);

  const report = await runLaunchMatrixPreflightConfigFile({
    config,
    runtime,
    quoteOnly: true
  });

  assert.deepEqual(report.summary, {
    routeCaseCount: 0,
    quoteCaseCount: 1,
    totalCaseCount: 1,
    providerIds: ["custom"],
    routeCases: [],
    quoteCases: [
      {
        name: "custom exact input quote",
        kind: "exact-input-quote",
        providerId: "custom"
      }
    ]
  });
  assert.deepEqual(report.preflightResult.routeResults, []);
  assert.equal(report.preflightResult.quoteResults.length, 1);
});

test("runLaunchMatrixPreflightConfigFile transfers route outputs when runtime exposes sender", async () => {
  const root = fixtureRoot();
  const config = writeMixedMatrix(root);
  const runtime = writeSenderRouteRuntime(root);

  const report = await runLaunchMatrixPreflightConfigFile({ config, runtime });

  assert.equal(
    report.preflightResult.routeResults[0].dryRunResult.input.transactionBlock,
    "built-route-0-transfers-1"
  );
  assert.equal(
    report.preflightResult.quoteResults[0].dryRunResult.input.transactionBlock,
    "built-quote-0-transfers-0"
  );
});

test("runLaunchMatrixPreflightConfigFile rejects runtime network mismatch before dry-run", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const runtime = writeNetworkRuntime(root, "testnet");

  await assert.rejects(
    () => runLaunchMatrixPreflightConfigFile({ config, runtime }),
    /Launch matrix network devnet does not match runtime network testnet/
  );
});

test("runLaunchMatrixPreflightConfigFile rejects launch provider mismatch before runtime load", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const launchConfig = writeLaunchConfig(root, ["pyth"]);
  const runtime = path.join(root, "missing-runtime.mjs");

  await assert.rejects(
    () => runLaunchMatrixPreflightConfigFile({ config, launchConfig, runtime }),
    /Launch matrix providerIds must match launch config providerIds/
  );
});

test("runLaunchMatrixPreflightConfigFile checks gas readiness before runtime load", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const runtime = path.join(root, "missing-runtime.mjs");
  const calls = [];

  await assert.rejects(
    () =>
      runLaunchMatrixPreflightConfigFile({
        config,
        runtime,
        gasReadiness: {
          activeAddress: "0xabc",
          rpcUrl: "https://fullnode.devnet.sui.io:443",
          minMist: "1",
          useRtk: true,
          execFileSync(command, args, options) {
            calls.push({ command, args, options });
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
    /No Sui gas coins found on devnet for 0xabc/
  );
  assert.equal(calls.length, 1);
  assert.equal(calls[0].command, "rtk");
  assert.deepEqual(calls[0].args.slice(0, 2), ["curl", "-sS"]);
});

test("run-launch-matrix-preflight CLI prints launch coverage summary", () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const runtime = writeRuntime(root);

  const output = execFileSync(
    process.execPath,
    ["tools/run-launch-matrix-preflight.mjs", "--config", config, "--runtime", runtime],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );

  assert.deepEqual(JSON.parse(output), {
    routeCaseCount: 0,
    quoteCaseCount: 1,
    totalCaseCount: 1,
    providerIds: ["custom"],
    routeCases: [],
    quoteCases: [
      {
        name: "custom exact input quote",
        kind: "exact-input-quote",
        providerId: "custom"
      }
    ]
  });
});
