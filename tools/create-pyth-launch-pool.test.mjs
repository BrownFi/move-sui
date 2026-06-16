#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { createPythLaunchPoolConfig } from "./create-pyth-launch-pool.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-pyth-pool-"));
}

function id(fill) {
  return `0x${fill.repeat(64)}`;
}

const packageId = id("a");
const typeA = `${id("1")}::coin_a::COIN_A`;
const typeB = `${id("2")}::coin_b::COIN_B`;
const factory = id("3");
const poolCreatorCap = id("4");
const oracle = id("5");
const initA = id("6");
const initB = id("7");
const feedA = id("8");
const feedB = id("9");

function createTransactionRecorder() {
  return {
    calls: [],
    splits: [],
    object(id) {
      return { kind: "object", id };
    },
    pure: {
      id(value) {
        return { kind: "id", value };
      },
      vector(type, values) {
        return { kind: "vector", type, values: Array.from(values) };
      },
      u8(value) {
        return { kind: "u8", value: String(value) };
      },
      u64(value) {
        return { kind: "u64", value: String(value) };
      },
      bool(value) {
        return { kind: "bool", value };
      }
    },
    makeMoveVec(vector) {
      return { kind: "vector", vector };
    },
    moveCall(call) {
      this.calls.push(call);
      return { kind: "result", index: this.calls.length - 1 };
    },
    splitCoins(coin, amounts) {
      this.splits.push({ coin, amounts });
      return amounts.map((_amount, index) => ({ kind: "split", index }));
    }
  };
}

function poolConfig(overrides = {}) {
  return {
    network: "testnet",
    packageId,
    typeA,
    typeB,
    factory,
    poolCreatorCap,
    oracle,
    feedIds: [feedA, feedB],
    clock: "0x6",
    initA,
    initB,
    tokenADecimals: 6,
    tokenBDecimals: 9,
    ...overrides
  };
}

function successfulCreatePoolResult() {
  return {
    effects: {
      transactionDigest: "create-digest",
      status: { status: "success" }
    },
    events: [
      {
        type: `${packageId}::events::Sync`,
        parsedJson: { pool_id: "0xPOOL" }
      },
      {
        type: `${packageId}::events::PoolCreated`,
        parsedJson: { pool_id: "0xPOOL" }
      }
    ],
    objectChanges: [
      {
        type: "created",
        objectId: "0xLP",
        objectType: `0x2::coin::Coin<${packageId}::pool::LP<${typeA}, ${typeB}>>`
      }
    ]
  };
}

function successfulFlashEnableResult() {
  return {
    effects: {
      transactionDigest: "flash-enable-digest",
      status: { status: "success" }
    },
    events: [
      {
        type: `${packageId}::events::PoolGateStateChanged`,
        parsedJson: { pool_id: "0xPOOL", gate: "flash_enabled", enabled: true }
      }
    ],
    objectChanges: []
  };
}

test("createPythLaunchPoolConfig updates Pyth before creating the BrownFi pool", async () => {
  const root = fixtureRoot();
  const config = path.join(root, "pool.json");
  writeJson(config, poolConfig());
  const tx = createTransactionRecorder();
  const calls = [];

  const runtime = {
    network: "testnet",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIds) {
        calls.push(["fetch", feedIds]);
        return [{ update: "a-b" }];
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updates, feedIds) {
        calls.push(["update", txArg, updates, feedIds]);
        assert.equal(txArg, tx);
        assert.equal(tx.calls.length, 0);
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    pythContractConfig: {
      pythStateId: id("b")
    },
    poolTransactionFactory() {
      return tx;
    },
    async executeTransaction(txArg, context) {
      calls.push(["execute", txArg, context]);
      assert.equal(txArg, tx);
      return successfulCreatePoolResult();
    }
  };

  const report = await createPythLaunchPoolConfig({ config, runtime });

  assert.deepEqual(calls, [
    ["fetch", [feedA, feedB]],
    ["update", tx, [{ update: "a-b" }], [feedA, feedB]],
    [
      "execute",
      tx,
      {
        kind: "create-pool",
        packageId,
        typeA,
        typeB
      }
    ]
  ]);
  assert.deepEqual(tx.calls, [
    {
      target: `${packageId}::oracle::configure_token`,
      typeArguments: [typeA],
      arguments: [
        { kind: "object", id: oracle },
        { kind: "vector", type: "u8", values: [112, 121, 116, 104] },
        { kind: "id", value: id("b") },
        {
          kind: "vector",
          type: "u8",
          values: Array.from(Buffer.from(feedA.slice(2), "hex"))
        }
      ]
    },
    {
      target: `${packageId}::oracle::configure_token`,
      typeArguments: [typeB],
      arguments: [
        { kind: "object", id: oracle },
        { kind: "vector", type: "u8", values: [112, 121, 116, 104] },
        { kind: "id", value: id("b") },
        {
          kind: "vector",
          type: "u8",
          values: Array.from(Buffer.from(feedB.slice(2), "hex"))
        }
      ]
    },
    {
      target: `${packageId}::swap::create_pool_with_coins_and_transfer_lp_to_sender`,
      typeArguments: [typeA, typeB],
      arguments: [
        { kind: "object", id: factory },
        { kind: "object", id: poolCreatorCap },
        { kind: "object", id: oracle },
        { kind: "object", id: "0xPRICEA" },
        { kind: "object", id: "0xPRICEB" },
        { kind: "object", id: "0x6" },
        { kind: "object", id: initA },
        { kind: "object", id: initB },
        { kind: "u8", value: "6" },
        { kind: "u8", value: "9" }
      ]
    }
  ]);
  assert.deepEqual(report, {
    status: "success",
    network: "testnet",
    transactionDigest: "create-digest",
    packageId,
    pool: "0xPOOL",
    lpCoin: "0xLP",
    priceInfoObjects: ["0xPRICEA", "0xPRICEB"],
    replacements: {
      POOL: "0xPOOL",
      LP_COIN: "0xLP"
    },
    txEvidence: {
      name: "pyth create pool",
      digest: "create-digest",
      expectedMoveCalls: [
        `${packageId}::swap::create_pool_with_coins_and_transfer_lp_to_sender`
      ],
      expectedEventTypes: [
        `${packageId}::events::PoolCreated`,
        `${packageId}::events::Sync`
      ]
    }
  });
});

test("createPythLaunchPoolConfig can enable flash after pool creation", async () => {
  const root = fixtureRoot();
  const config = path.join(root, "pool.json");
  const pauseCap = id("c");
  writeJson(config, poolConfig({ flashEnabled: true, pauseCap }));
  const poolTx = createTransactionRecorder();
  const flashTx = createTransactionRecorder();
  const calls = [];

  const runtime = {
    network: "testnet",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIds) {
        calls.push(["fetch", feedIds]);
        return [{ update: "a-b" }];
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updates, feedIds) {
        calls.push(["update", txArg, updates, feedIds]);
        assert.equal(txArg, poolTx);
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    pythContractConfig: {
      pythStateId: id("b")
    },
    poolTransactionFactory(context) {
      calls.push(["tx-factory", context]);
      return context.kind === "enable-flash" ? flashTx : poolTx;
    },
    async executeTransaction(txArg, context) {
      calls.push(["execute", txArg, context]);
      if (context.kind === "enable-flash") {
        assert.equal(txArg, flashTx);
        return successfulFlashEnableResult();
      }
      assert.equal(txArg, poolTx);
      return successfulCreatePoolResult();
    }
  };

  const report = await createPythLaunchPoolConfig({ config, runtime });

  assert.deepEqual(calls, [
    [
      "tx-factory",
      {
        kind: "create-pool",
        packageId,
        typeA,
        typeB
      }
    ],
    ["fetch", [feedA, feedB]],
    ["update", poolTx, [{ update: "a-b" }], [feedA, feedB]],
    [
      "execute",
      poolTx,
      {
        kind: "create-pool",
        packageId,
        typeA,
        typeB
      }
    ],
    [
      "tx-factory",
      {
        kind: "enable-flash",
        packageId,
        typeA,
        typeB,
        pool: "0xPOOL"
      }
    ],
    [
      "execute",
      flashTx,
      {
        kind: "enable-flash",
        packageId,
        typeA,
        typeB,
        pool: "0xPOOL"
      }
    ]
  ]);
  assert.deepEqual(flashTx.calls, [
    {
      target: `${packageId}::admin::set_pool_flash_enabled`,
      typeArguments: [typeA, typeB],
      arguments: [
        { kind: "object", id: "0xPOOL" },
        { kind: "object", id: pauseCap },
        { kind: "bool", value: true }
      ]
    }
  ]);
  assert.deepEqual(report.flashEnable, {
    status: "success",
    transactionDigest: "flash-enable-digest",
    txEvidence: {
      name: "pyth enable flash",
      digest: "flash-enable-digest",
      expectedMoveCalls: [`${packageId}::admin::set_pool_flash_enabled`],
      expectedEventTypes: [`${packageId}::events::PoolGateStateChanged`]
    }
  });
});

test("createPythLaunchPoolConfig retries flash enable when the new shared pool is briefly unavailable", async () => {
  const root = fixtureRoot();
  const config = path.join(root, "pool.json");
  const pauseCap = id("c");
  writeJson(config, poolConfig({ flashEnabled: true, pauseCap }));
  const poolTx = createTransactionRecorder();
  const flashTxs = [];
  const calls = [];
  let flashAttempts = 0;

  const runtime = {
    network: "testnet",
    flashEnableRetryAttempts: 2,
    flashEnableRetryDelayMs: 0,
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIds) {
        calls.push(["fetch", feedIds]);
        return [{ update: "a-b" }];
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updates, feedIds) {
        calls.push(["update", txArg, updates, feedIds]);
        assert.equal(txArg, poolTx);
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    pythContractConfig: {
      pythStateId: id("b")
    },
    poolTransactionFactory(context) {
      calls.push(["tx-factory", context]);
      if (context.kind !== "enable-flash") return poolTx;
      const flashTx = createTransactionRecorder();
      flashTxs.push(flashTx);
      return flashTx;
    },
    async executeTransaction(txArg, context) {
      calls.push(["execute", txArg, context]);
      if (context.kind !== "enable-flash") {
        assert.equal(txArg, poolTx);
        return successfulCreatePoolResult();
      }
      flashAttempts += 1;
      if (flashAttempts === 1) {
        throw new Error(
          'The following input objects are invalid: {"code":"notExists","object_id":"0xPOOL"}'
        );
      }
      return successfulFlashEnableResult();
    }
  };

  const report = await createPythLaunchPoolConfig({ config, runtime });

  assert.equal(flashAttempts, 2);
  assert.equal(flashTxs.length, 2);
  assert.deepEqual(
    flashTxs.map((tx) => tx.calls[0]?.target),
    [
      `${packageId}::admin::set_pool_flash_enabled`,
      `${packageId}::admin::set_pool_flash_enabled`
    ]
  );
  assert.equal(report.flashEnable.transactionDigest, "flash-enable-digest");
});

test("createPythLaunchPoolConfig creates missing Pyth feed objects before pool creation", async () => {
  const root = fixtureRoot();
  const config = path.join(root, "pool.json");
  writeJson(config, poolConfig());
  const feedTx = createTransactionRecorder();
  const poolTx = createTransactionRecorder();
  const calls = [];
  let feedsCreated = false;

  const runtime = {
    network: "testnet",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIds) {
        calls.push(["fetch", feedIds]);
        return feedIds.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async getPriceFeedObjectId(feedId) {
        calls.push(["get-feed", feedId, feedsCreated]);
        if (!feedsCreated) return undefined;
        return feedId === feedA ? "0xPRICEA" : "0xPRICEB";
      },
      async createPriceFeed(txArg, updates) {
        calls.push(["create-feed", txArg, updates]);
        assert.equal(txArg, feedTx);
      },
      async updatePriceFeeds(txArg, updates, feedIds) {
        calls.push(["update", txArg, updates, feedIds]);
        assert.equal(txArg, poolTx);
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    pythContractConfig: {
      pythStateId: id("b")
    },
    poolTransactionFactory(context) {
      calls.push(["tx-factory", context]);
      return context.kind === "create-pyth-price-feeds" ? feedTx : poolTx;
    },
    async executeTransaction(txArg, context) {
      calls.push(["execute", txArg, context]);
      if (context.kind === "create-pyth-price-feeds") {
        feedsCreated = true;
        return {
          effects: {
            transactionDigest: "feed-create-digest",
            status: { status: "success" }
          }
        };
      }
      return successfulCreatePoolResult();
    }
  };

  const report = await createPythLaunchPoolConfig({ config, runtime });

  assert.deepEqual(calls.slice(0, 8), [
    ["get-feed", feedA, false],
    ["get-feed", feedB, false],
    [
      "tx-factory",
      {
        kind: "create-pyth-price-feeds",
        packageId,
        feedIds: [feedA, feedB]
      }
    ],
    ["fetch", [feedA, feedB]],
    ["create-feed", feedTx, [{ update: feedA }, { update: feedB }]],
    [
      "execute",
      feedTx,
      {
        kind: "create-pyth-price-feeds",
        packageId,
        feedIds: [feedA, feedB]
      }
    ],
    [
      "tx-factory",
      {
        kind: "create-pool",
        packageId,
        typeA,
        typeB
      }
    ],
    ["fetch", [feedA, feedB]]
  ]);
  assert.deepEqual(calls.at(8), [
    "update",
    poolTx,
    [{ update: feedA }, { update: feedB }],
    [feedA, feedB]
  ]);
  assert.equal(report.transactionDigest, "create-digest");
});

test("createPythLaunchPoolConfig can split smaller initial liquidity amounts", async () => {
  const root = fixtureRoot();
  const config = path.join(root, "pool.json");
  writeJson(config, poolConfig({ initAAmount: "1000000000", initBAmount: "2000000000" }));
  const tx = createTransactionRecorder();

  const runtime = {
    network: "testnet",
    priceFeedConnection: {
      async getPriceFeedsUpdateData() {
        return [{ update: "a-b" }];
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    pythContractConfig: {
      pythStateId: id("b")
    },
    poolTransactionFactory() {
      return tx;
    },
    async executeTransaction() {
      return successfulCreatePoolResult();
    }
  };

  await createPythLaunchPoolConfig({ config, runtime });

  assert.deepEqual(tx.splits, [
    {
      coin: { kind: "object", id: initA },
      amounts: [{ kind: "u64", value: "1000000000" }]
    },
    {
      coin: { kind: "object", id: initB },
      amounts: [{ kind: "u64", value: "2000000000" }]
    }
  ]);
  assert.equal(tx.calls.at(-1).arguments[6].kind, "split");
  assert.equal(tx.calls.at(-1).arguments[6].index, 0);
  assert.equal(tx.calls.at(-1).arguments[7].kind, "split");
  assert.equal(tx.calls.at(-1).arguments[7].index, 0);
});

test("createPythLaunchPoolConfig forwards runtimeConfig to runtime modules", async () => {
  const root = fixtureRoot();
  const config = path.join(root, "pool.json");
  const runtime = path.join(root, "runtime.mjs");
  writeJson(config, poolConfig());
  fs.writeFileSync(
    runtime,
    `
export default async function createRuntime(options) {
  if (options.runtimeConfig !== "runtime.local.json") {
    throw new Error("runtimeConfig:" + options.runtimeConfig);
  }
  return {
    network: "testnet",
    priceFeedConnection: {
      async getPriceFeedsUpdateData() {
        return [{ update: "a-b" }];
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    pythContractConfig: {
      pythStateId: "${id("b")}"
    },
    poolTransactionFactory() {
      return {
        object(id) {
          return { kind: "object", id };
        },
        pure: {
          id(value) {
            return { kind: "id", value };
          },
          vector(type, values) {
            return { kind: "vector", type, values: Array.from(values) };
          },
          u8(value) {
            return { kind: "u8", value: String(value) };
          }
        },
        makeMoveVec(vector) {
          return { kind: "vector", vector };
        },
        moveCall() {}
      };
    },
    async executeTransaction() {
      return ${JSON.stringify(successfulCreatePoolResult())};
    }
  };
}
`
  );

  const report = await createPythLaunchPoolConfig({
    config,
    runtime,
    runtimeConfig: "runtime.local.json"
  });

  assert.equal(report.transactionDigest, "create-digest");
});

test("createPythLaunchPoolConfig rejects runtime network mismatches", async () => {
  const root = fixtureRoot();
  const config = path.join(root, "pool.json");
  writeJson(config, poolConfig({ network: "mainnet" }));

  await assert.rejects(
    createPythLaunchPoolConfig({
      config,
      runtime: {
        network: "testnet",
        priceFeedConnection: {},
        pythClient: {},
        poolTransactionFactory() {},
        async executeTransaction() {}
      }
    }),
    /pool network mainnet does not match runtime network testnet/
  );
});

test("createPythLaunchPoolConfig rejects unresolved live-value placeholders", async () => {
  const root = fixtureRoot();
  const config = path.join(root, "pool.json");
  writeJson(
    config,
    poolConfig({
      packageId: "0xBROWNFI_PACKAGE",
      typeA: "TYPE_A",
      typeB: "TYPE_B"
    })
  );

  await assert.rejects(
    createPythLaunchPoolConfig({
      config,
      runtime: {
        network: "testnet",
        priceFeedConnection: {
          async getPriceFeedsUpdateData() {
            throw new Error("runtime should not be used");
          }
        },
        pythClient: {},
        poolTransactionFactory() {
          throw new Error("runtime should not be used");
        },
        async executeTransaction() {
          throw new Error("runtime should not be used");
        }
      }
    }),
    /Pyth launch pool config contains placeholder value at packageId: 0xBROWNFI_PACKAGE/
  );
});

test("createPythLaunchPoolConfig rejects malformed Pyth feed IDs before runtime use", async () => {
  const root = fixtureRoot();
  const config = path.join(root, "pool.json");
  writeJson(config, poolConfig({ feedIds: ["feed-a", "feed-b"] }));

  await assert.rejects(
    createPythLaunchPoolConfig({
      config,
      runtime: {
        network: "testnet",
        priceFeedConnection: {
          async getPriceFeedsUpdateData() {
            throw new Error("runtime should not be used");
          }
        },
        pythClient: {},
        poolTransactionFactory() {
          throw new Error("runtime should not be used");
        },
        async executeTransaction() {
          throw new Error("runtime should not be used");
        }
      }
    }),
    /Pyth launch pool config feedIds\[0\] must be a 32-byte hex feed ID/
  );
});
