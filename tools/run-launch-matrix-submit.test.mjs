#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath, pathToFileURL } from "node:url";

import { submitLaunchMatrixRoutesConfigFile } from "./run-launch-matrix-submit.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const routerDistUrl = pathToFileURL(path.join(repoRoot, "sdk/router/dist/index.js")).href;

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-submit-"));
}

function routePair() {
  return {
    packageId: "0x1",
    typeA: "0x1::coin_a::COIN_A",
    typeB: "0x1::coin_b::COIN_B",
    pool: "0x2",
    oracleSourceCount: 1,
    updatePayloadByteLength: 0
  };
}

function routePairBC() {
  return {
    packageId: "0x1",
    typeA: "0x1::coin_b::COIN_B",
    typeB: "0x1::coin_c::COIN_C",
    pool: "0x8",
    oracleSourceCount: 1,
    updatePayloadByteLength: 0
  };
}

function writeMatrix(root, overrides = {}) {
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
    routeCases: [
      {
        name: "custom exact input route",
        kind: "exact-input",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x3",
        minOutputs: ["1"]
      },
      {
        name: "custom add liquidity route",
        kind: "add-liquidity",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x4",
        inputB: "0x5",
        minLpOut: "1"
      },
      {
        name: "custom remove liquidity route",
        kind: "remove-liquidity",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x7",
        minAOut: "1",
        minBOut: "1"
      }
    ],
    ...overrides
  });
  return config;
}

function writeRuntime(root, options = {}) {
  const runtime = path.join(root, "runtime.mjs");
  fs.writeFileSync(
    runtime,
    `import { createRoutePriceProviderRegistry } from ${JSON.stringify(routerDistUrl)};

function createTransaction(label) {
  return {
    calls: [],
    transfers: [],
    splits: [],
    merges: [],
    sender: "0xabc",
    object(id) {
      return { kind: "object", id };
    },
    pure: {
      address(value) {
        return { kind: "address", value };
      },
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
        2: { value: nested(2), enumerable: false },
        [Symbol.iterator]: {
          value: function* iterator() {
            yield this[0];
            yield this[1];
            yield this[2];
          },
          enumerable: false
        }
      });
      this.calls.push(call);
      return result;
    },
    transferObjects(objects, recipient) {
      this.transfers.push({ objects, recipient });
    },
    splitCoins(coin, amounts) {
      this.splits.push({ coin, amounts });
      return amounts.map((_amount, index) => ({ kind: "split", index }));
    },
    mergeCoins(coin, sources) {
      this.merges.push({ coin, sources });
    }
  };
}

export async function createLaunchMatrixRuntime(options = {}) {
  if (${JSON.stringify(options.expectedRuntimeConfig ?? null)} !== null &&
      options.runtimeConfig !== ${JSON.stringify(options.expectedRuntimeConfig ?? null)}) {
    throw new Error("runtimeConfig:" + options.runtimeConfig);
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
    routeTransactionFactory(routeCase, index) {
      return createTransaction(routeCase.kind + "-" + index);
    },
    async executeTransaction(_tx, context) {
      if (${JSON.stringify(options.requireTransfers ?? false)} && _tx.transfers.length === 0) {
        throw new Error("expected route outputs to be transferred");
      }
      const expectedTransferObjectCounts = ${JSON.stringify(options.expectedTransferObjectCounts ?? null)};
      const expectedTransferObjectCount = expectedTransferObjectCounts?.[context.index];
      if (
        expectedTransferObjectCount !== undefined &&
        _tx.transfers[0]?.objects.length !== expectedTransferObjectCount
      ) {
        throw new Error(
          "expected " + expectedTransferObjectCount + " transferred route outputs, got " +
            (_tx.transfers[0]?.objects.length ?? 0)
        );
      }
      if (${JSON.stringify(options.requireSplits ?? false)} && _tx.splits.length === 0) {
        throw new Error("expected route inputs to be split");
      }
      const digest = "digest-" + context.index;
      return {
        digest,
        effects: {
          transactionDigest: digest,
          status: {
            status: ${JSON.stringify(options.status ?? "success")}
          }
        }
      };
    }
  };
}
`
  );
  return runtime;
}

test("submitLaunchMatrixRoutesConfigFile submits route cases and returns tx evidence", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const runtime = writeRuntime(root);

  const report = await submitLaunchMatrixRoutesConfigFile({ config, runtime });

  assert.deepEqual(report.summary, {
    routeCaseCount: 3,
    providerIds: ["custom"],
    routeCases: [
      {
        name: "custom exact input route",
        kind: "exact-input",
        providerId: "custom",
        digest: "digest-0"
      },
      {
        name: "custom add liquidity route",
        kind: "add-liquidity",
        providerId: "custom",
        digest: "digest-1"
      },
      {
        name: "custom remove liquidity route",
        kind: "remove-liquidity",
        providerId: "custom",
        digest: "digest-2"
      }
    ]
  });
  assert.deepEqual(report.txEvidence, [
    {
      name: "custom exact input route",
      digest: "digest-0",
      expectedMoveCalls: [
        "0x1::router::swap_exact_a_for_b_with_bundle"
      ],
      expectedEventTypes: [
        "0x1::events::OracleQuorumUsed",
        "0x1::events::Sync",
        "0x1::events::PriceBundleUsed",
        "0x1::events::SwapExecuted",
        "0x1::events::Swap"
      ]
    },
    {
      name: "custom add liquidity route",
      digest: "digest-1",
      expectedMoveCalls: [
        "0x1::router::add_liquidity_with_bundle"
      ],
      expectedEventTypes: [
        "0x1::events::OracleQuorumUsed",
        "0x1::events::Sync",
        "0x1::events::AddLiquidity"
      ]
    },
    {
      name: "custom remove liquidity route",
      digest: "digest-2",
      expectedMoveCalls: [
        "0x1::router::remove_liquidity_with_coins"
      ],
      expectedEventTypes: ["0x1::events::Sync", "0x1::events::RemoveLiquidity"]
    }
  ]);
});

test("submitLaunchMatrixRoutesConfigFile transfers returned route outputs before execution", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [
      {
        name: "custom exact input route",
        kind: "exact-input",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x3",
        minOutputs: ["1"]
      }
    ]
  });
  const runtime = writeRuntime(root, { requireTransfers: true });

  const report = await submitLaunchMatrixRoutesConfigFile({ config, runtime });

  assert.equal(report.summary.routeCaseCount, 1);
});

test("submitLaunchMatrixRoutesConfigFile transfers exact-output change and output coins", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [
      {
        name: "custom exact output route",
        kind: "exact-output",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x3",
        amountOut: "1"
      }
    ]
  });
  const runtime = writeRuntime(root, {
    requireTransfers: true,
    expectedTransferObjectCounts: [2]
  });

  const report = await submitLaunchMatrixRoutesConfigFile({ config, runtime });

  assert.equal(report.summary.routeCaseCount, 1);
});

test("submitLaunchMatrixRoutesConfigFile transfers all add-liquidity returned coins", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [
      {
        name: "custom add liquidity route",
        kind: "add-liquidity",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x4",
        inputB: "0x5",
        minLpOut: "1"
      }
    ]
  });
  const runtime = writeRuntime(root, {
    requireTransfers: true,
    expectedTransferObjectCounts: [3]
  });

  const report = await submitLaunchMatrixRoutesConfigFile({ config, runtime });

  assert.equal(report.summary.routeCaseCount, 1);
});

test("submitLaunchMatrixRoutesConfigFile transfers zap outputs and reports zap evidence", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [
      {
        name: "custom zap in A route",
        kind: "zap-in-a",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x4",
        minBFromSwap: "1",
        minLpOut: "1"
      },
      {
        name: "custom zap out B route",
        kind: "zap-out-b",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x7",
        minOut: "1"
      }
    ]
  });
  const runtime = writeRuntime(root, {
    requireTransfers: true,
    expectedTransferObjectCounts: [3, 1]
  });

  const report = await submitLaunchMatrixRoutesConfigFile({ config, runtime });

  assert.deepEqual(report.summary.routeCases, [
    {
      name: "custom zap in A route",
      kind: "zap-in-a",
      providerId: "custom",
      digest: "digest-0"
    },
    {
      name: "custom zap out B route",
      kind: "zap-out-b",
      providerId: "custom",
      digest: "digest-1"
    }
  ]);
  assert.deepEqual(report.txEvidence, [
    {
      name: "custom zap in A route",
      digest: "digest-0",
      expectedMoveCalls: ["0x1::router::zap_in_a_with_bundle"],
      expectedEventTypes: [
        "0x1::events::OracleQuorumUsed",
        "0x1::events::Sync",
        "0x1::events::PriceBundleUsed",
        "0x1::events::SwapExecuted",
        "0x1::events::Swap",
        "0x1::events::AddLiquidity"
      ]
    },
    {
      name: "custom zap out B route",
      digest: "digest-1",
      expectedMoveCalls: ["0x1::router::zap_out_b_with_bundle"],
      expectedEventTypes: [
        "0x1::events::OracleQuorumUsed",
        "0x1::events::Sync",
        "0x1::events::PriceBundleUsed",
        "0x1::events::SwapExecuted",
        "0x1::events::Swap",
        "0x1::events::RemoveLiquidity"
      ]
    }
  ]);
});

test("submitLaunchMatrixRoutesConfigFile can split configured route input amounts", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [
      {
        name: "custom exact input route",
        kind: "exact-input",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x3",
        inputAmount: "1000000",
        minOutputs: ["1"]
      }
    ]
  });
  const runtime = writeRuntime(root, { requireSplits: true });

  const report = await submitLaunchMatrixRoutesConfigFile({ config, runtime });

  assert.equal(report.summary.routeCaseCount, 1);
});

test("submitLaunchMatrixRoutesConfigFile can split configured flash fee coin amounts", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [
      {
        name: "custom flash borrow A",
        kind: "flash-borrow-a",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        amount: "1000",
        feeCoin: "0x4",
        feeCoinAmount: "1"
      }
    ]
  });
  const runtime = writeRuntime(root, { requireSplits: true });

  const report = await submitLaunchMatrixRoutesConfigFile({ config, runtime });

  assert.equal(report.summary.routeCaseCount, 1);
});

test("submitLaunchMatrixRoutesConfigFile forwards runtimeConfig to runtime modules", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [
      {
        name: "custom exact input route",
        kind: "exact-input",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x3",
        minOutputs: ["1"]
      }
    ]
  });
  const runtime = writeRuntime(root, { expectedRuntimeConfig: "runtime.local.json" });

  const report = await submitLaunchMatrixRoutesConfigFile({
    config,
    runtime,
    runtimeConfig: "runtime.local.json"
  });

  assert.equal(report.summary.routeCaseCount, 1);
});

test("submitLaunchMatrixRoutesConfigFile infers exact-output Move call evidence", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeLimits: {
      maxHops: 2,
      maxOracleSourcesPerHop: 1,
      maxAmmSourcesPerHop: 0,
      maxUpdatePayloadBytes: 0
    },
    routeCases: [
      {
        name: "custom exact output route",
        kind: "exact-output",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x3",
        amountOut: "1"
      },
      {
        name: "custom exact output results route",
        kind: "exact-output-results",
        providerId: "custom",
        clock: "0x6",
        path: [
          "0x1::coin_a::COIN_A",
          "0x1::coin_b::COIN_B",
          "0x1::coin_c::COIN_C"
        ],
        pairs: [routePair(), routePairBC()],
        input: "0x4",
        amountOut: "1"
      }
    ]
  });
  const runtime = writeRuntime(root);

  const report = await submitLaunchMatrixRoutesConfigFile({ config, runtime });

  assert.deepEqual(
    report.txEvidence.map((entry) => ({
      name: entry.name,
      expectedMoveCalls: entry.expectedMoveCalls
    })),
    [
      {
        name: "custom exact output route",
        expectedMoveCalls: ["0x1::router::swap_a_for_exact_b_with_bundle"]
      },
      {
        name: "custom exact output results route",
        expectedMoveCalls: [
          "0x1::swap::quote_a_for_exact_b_with_bundle",
          "0x1::router::swap_a_for_exact_b_with_bundle",
          "0x1::router::swap_a_for_exact_b_with_bundle"
        ]
      }
    ]
  );
});

test("submitLaunchMatrixRoutesConfigFile rejects matrices without route cases", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [],
    quoteCases: [
      {
        name: "custom quote",
        kind: "exact-input-quote",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        amountIn: "100"
      }
    ]
  });
  const runtime = writeRuntime(root);

  await assert.rejects(
    () => submitLaunchMatrixRoutesConfigFile({ config, runtime }),
    /Launch matrix submit requires at least one route case/
  );
});

test("submitLaunchMatrixRoutesConfigFile rejects failed execution status", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const runtime = writeRuntime(root, { status: "failure" });

  await assert.rejects(
    () => submitLaunchMatrixRoutesConfigFile({ config, runtime }),
    /Launch matrix submit custom exact input route failed with status failure/
  );
});

test("submitLaunchMatrixRoutesConfigFile verifies submitted tx evidence when requested", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const runtime = writeRuntime(root);
  const calls = [];

  const report = await submitLaunchMatrixRoutesConfigFile({
    config,
    runtime,
    txEvidenceVerification: {
      rpcUrl: "https://fullnode.devnet.sui.io:443",
      execFileSync(command, args) {
        calls.push({ command, args });
        const payload = JSON.parse(args[args.indexOf("--data") + 1]);
        const digest = payload.params[0];
        const evidence = {
          "digest-0": {
            moveCalls: ["0x1::router::swap_exact_a_for_b_with_bundle"],
            eventTypes: [
              "0x1::events::OracleQuorumUsed",
              "0x1::events::Sync",
              "0x1::events::PriceBundleUsed",
              "0x1::events::SwapExecuted",
              "0x1::events::Swap"
            ]
          },
          "digest-1": {
            moveCalls: ["0x1::router::add_liquidity_with_bundle"],
            eventTypes: [
              "0x1::events::OracleQuorumUsed",
              "0x1::events::Sync",
              "0x1::events::AddLiquidity"
            ]
          },
          "digest-2": {
            moveCalls: ["0x1::router::remove_liquidity_with_coins"],
            eventTypes: ["0x1::events::Sync", "0x1::events::RemoveLiquidity"]
          }
        }[digest];
        return JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            transaction: {
              data: {
                transaction: {
                  transactions: evidence.moveCalls.map((target) => {
                    const [pkg, module, fn] = target.split("::");
                    return {
                      MoveCall: {
                        package: pkg,
                        module,
                        function: fn
                      }
                    };
                  })
                }
              }
            },
            effects: {
              status: { status: "success" },
              transactionDigest: digest
            },
            events: evidence.eventTypes.map((type) => ({ type })),
            checkpoint: "12",
            timestampMs: "1780000000000"
          }
        });
      }
    }
  });

  assert.equal(calls.length, 3);
  assert.deepEqual(
    report.txVerification.map((entry) => ({ txName: entry.txName, digest: entry.digest })),
    [
      { txName: "custom exact input route", digest: "digest-0" },
      { txName: "custom add liquidity route", digest: "digest-1" },
      { txName: "custom remove liquidity route", digest: "digest-2" }
    ]
  );
});

test("submitLaunchMatrixRoutesConfigFile forwards tx evidence RPC retry options", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [
      {
        name: "custom exact input route",
        kind: "exact-input",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x3",
        minOutputs: ["1"]
      }
    ]
  });
  const runtime = writeRuntime(root);
  const calls = [];

  const report = await submitLaunchMatrixRoutesConfigFile({
    config,
    runtime,
    txEvidenceVerification: {
      rpcUrl: "https://fullnode.devnet.sui.io:443",
      rpcRetries: 1,
      rpcRetryDelayMs: 0,
      execFileSync(command, args) {
        calls.push({ command, args });
        const payload = JSON.parse(args[args.indexOf("--data") + 1]);
        const digest = payload.params[0];
        if (calls.length === 1) {
          return JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: {
              code: -32602,
              message: `Could not find the referenced transaction [TransactionDigest(${digest})]`
            }
          });
        }
        return JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          result: {
            transaction: {
              data: {
                transaction: {
                  transactions: [
                    {
                      MoveCall: {
                        package: "0x1",
                        module: "router",
                        function: "swap_exact_a_for_b_with_bundle"
                      }
                    }
                  ]
                }
              }
            },
            effects: {
              status: { status: "success" },
              transactionDigest: digest
            },
            events: [
              { type: "0x1::events::OracleQuorumUsed" },
              { type: "0x1::events::Sync" },
              { type: "0x1::events::PriceBundleUsed" },
              { type: "0x1::events::SwapExecuted" },
              { type: "0x1::events::Swap" }
            ],
            checkpoint: "12",
            timestampMs: "1780000000000"
          }
        });
      }
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(report.txVerification[0].digest, "digest-0");
});

test("submitLaunchMatrixRoutesConfigFile writes partial tx evidence before verification failure", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root, {
    routeCases: [
      {
        name: "custom exact input route",
        kind: "exact-input",
        providerId: "custom",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [routePair()],
        input: "0x3",
        minOutputs: ["1"]
      }
    ]
  });
  const runtime = writeRuntime(root);
  const out = path.join(root, "submit.json");

  await assert.rejects(
    () =>
      submitLaunchMatrixRoutesConfigFile({
        config,
        runtime,
        out,
        txEvidenceVerification: {
          rpcUrl: "https://fullnode.devnet.sui.io:443",
          execFileSync() {
            return JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              error: {
                code: -32000,
                message: "permanent verifier failure"
              }
            });
          }
        }
      }),
    /Sui JSON-RPC tx evidence failed for custom exact input route: -32000 permanent verifier failure/
  );

  const partial = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.deepEqual(partial.summary.routeCases, [
    {
      name: "custom exact input route",
      kind: "exact-input",
      providerId: "custom",
      digest: "digest-0"
    }
  ]);
  assert.equal(partial.txEvidence[0].digest, "digest-0");
  assert.equal(partial.txVerification, undefined);
});

test("submitLaunchMatrixRoutesConfigFile resumes from prefix tx evidence", async () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const runtime = writeRuntime(root);
  const resumeFrom = path.join(root, "existing-submit.json");
  writeJson(resumeFrom, {
    summary: {
      routeCaseCount: 1,
      providerIds: ["custom"],
      routeCases: [
        {
          name: "custom exact input route",
          kind: "exact-input",
          providerId: "custom",
          digest: "existing-digest-0"
        }
      ]
    },
    txEvidence: [
      {
        name: "custom exact input route",
        digest: "existing-digest-0",
        expectedMoveCalls: ["0x1::router::swap_exact_a_for_b_with_bundle"],
        expectedEventTypes: [
          "0x1::events::OracleQuorumUsed",
          "0x1::events::Sync",
          "0x1::events::PriceBundleUsed",
          "0x1::events::SwapExecuted",
          "0x1::events::Swap"
        ]
      }
    ]
  });

  const report = await submitLaunchMatrixRoutesConfigFile({
    config,
    runtime,
    resumeFrom
  });

  assert.deepEqual(
    report.summary.routeCases.map((routeCase) => routeCase.digest),
    ["existing-digest-0", "digest-1", "digest-2"]
  );
  assert.deepEqual(
    report.txEvidence.map((entry) => entry.digest),
    ["existing-digest-0", "digest-1", "digest-2"]
  );
});

test("run-launch-matrix-submit CLI prints submitted tx evidence", () => {
  const root = fixtureRoot();
  const config = writeMatrix(root);
  const runtime = writeRuntime(root);

  const output = execFileSync(
    process.execPath,
    ["tools/run-launch-matrix-submit.mjs", "--config", config, "--runtime", runtime],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );

  assert.deepEqual(JSON.parse(output).summary.routeCases.map((item) => item.digest), [
    "digest-0",
    "digest-1",
    "digest-2"
  ]);
});
