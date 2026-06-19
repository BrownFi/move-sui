#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  extractLaunchPoolCreateObjects,
  extractLaunchPoolCreateObjectsFile
} from "./extract-launch-pool-create-objects.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function poolCreateTx({
  status = "success",
  packageId = "0xabc",
  poolId = "0xpool",
  lpCoinId = "0xlpcoin"
} = {}) {
  const typeA = `${packageId}::coin_a::COIN_A`;
  const typeB = `${packageId}::coin_b::COIN_B`;
  return {
    effects: {
      status: { status },
      transactionDigest: "CREATE_POOL_DIGEST"
    },
    events: [
      {
        type: `${packageId}::events::Sync`,
        parsedJson: {
          pool_id: poolId
        }
      },
      {
        type: `${packageId}::events::PoolCreated`,
        parsedJson: {
          pool_id: poolId,
          init_a: "1000000000",
          init_b: "1000000000",
          lp_minted: "1999999000"
        }
      }
    ],
    objectChanges: [
      {
        type: "created",
        objectId: poolId,
        objectType: `${packageId}::pool::Pool<${typeA}, ${typeB}>`,
        owner: { Shared: { initial_shared_version: 1 } }
      },
      {
        type: "created",
        objectId: lpCoinId,
        objectType: `0x2::coin::Coin<${packageId}::pool::LP<${typeA}, ${typeB}>>`,
        owner: { AddressOwner: "0xsender" }
      }
    ]
  };
}

test("extractLaunchPoolCreateObjects extracts pool and LP coin IDs", () => {
  const result = extractLaunchPoolCreateObjects(poolCreateTx());

  assert.deepEqual(result, {
    status: "success",
    transactionDigest: "CREATE_POOL_DIGEST",
    packageId: "0xabc",
    pool: "0xpool",
    lpCoin: "0xlpcoin",
    replacements: {
      POOL: "0xpool",
      LP_COIN: "0xlpcoin"
    }
  });
});

test("extractLaunchPoolCreateObjectsFile reads tx JSON and can write replacements", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-pool-create-objects-"));
  const txJson = path.join(root, "tx.json");
  const out = path.join(root, "pool.json");
  writeJson(txJson, poolCreateTx());

  const result = extractLaunchPoolCreateObjectsFile({ txJson, out });

  assert.equal(result.pool, "0xpool");
  assert.deepEqual(JSON.parse(fs.readFileSync(out, "utf8")), result);
});

test("extractLaunchPoolCreateObjects rejects missing LP coin", () => {
  const tx = poolCreateTx();
  tx.objectChanges = tx.objectChanges.filter(
    (change) => !String(change.objectType).includes("::pool::LP<")
  );

  assert.throws(
    () => extractLaunchPoolCreateObjects(tx),
    /Sui create-pool transaction missing created LP coin object/
  );
});

test("extractLaunchPoolCreateObjects rejects failed tx status", () => {
  assert.throws(
    () => extractLaunchPoolCreateObjects(poolCreateTx({ status: "failure" })),
    /Sui create-pool transaction failed: failure/
  );
});
