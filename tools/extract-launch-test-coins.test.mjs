#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  extractLaunchTestCoins,
  extractLaunchTestCoinsFile
} from "./extract-launch-test-coins.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function publishResult() {
  const packageId = "0xabc";
  return {
    effects: {
      status: { status: "success" },
      transactionDigest: "TEST_COIN_PUBLISH_DIGEST"
    },
    objectChanges: [
      {
        type: "published",
        packageId,
        modules: ["coin_a", "coin_b"]
      },
      {
        type: "created",
        objectId: "0xcap_a",
        objectType: `0x2::coin::TreasuryCap<${packageId}::coin_a::COIN_A>`,
        owner: { AddressOwner: "0xsender" }
      },
      {
        type: "created",
        objectId: "0xinit_a",
        objectType: `0x2::coin::Coin<${packageId}::coin_a::COIN_A>`,
        owner: { AddressOwner: "0xsender" }
      },
      {
        type: "created",
        objectId: "0xinput_a",
        objectType: `0x2::coin::Coin<${packageId}::coin_a::COIN_A>`,
        owner: { AddressOwner: "0xsender" }
      },
      {
        type: "created",
        objectId: "0xcap_b",
        objectType: `0x2::coin::TreasuryCap<${packageId}::coin_b::COIN_B>`,
        owner: { AddressOwner: "0xsender" }
      },
      {
        type: "created",
        objectId: "0xinit_b",
        objectType: `0x2::coin::Coin<${packageId}::coin_b::COIN_B>`,
        owner: { AddressOwner: "0xsender" }
      },
      {
        type: "created",
        objectId: "0xinput_b",
        objectType: `0x2::coin::Coin<${packageId}::coin_b::COIN_B>`,
        owner: { AddressOwner: "0xsender" }
      }
    ]
  };
}

test("extractLaunchTestCoins extracts token types and initial route coins", () => {
  const result = extractLaunchTestCoins(publishResult());

  assert.deepEqual(result, {
    status: "success",
    transactionDigest: "TEST_COIN_PUBLISH_DIGEST",
    packageId: "0xabc",
    typeA: "0xabc::coin_a::COIN_A",
    typeB: "0xabc::coin_b::COIN_B",
    treasuryCapA: "0xcap_a",
    treasuryCapB: "0xcap_b",
    initCoinA: "0xinit_a",
    initCoinB: "0xinit_b",
    inputCoinA: "0xinput_a",
    inputCoinB: "0xinput_b",
    inputCoin: "0xinput_a",
    replacements: {
      TYPE_A: "0xabc::coin_a::COIN_A",
      TYPE_B: "0xabc::coin_b::COIN_B",
      INIT_COIN_A: "0xinit_a",
      INIT_COIN_B: "0xinit_b",
      INPUT_COIN: "0xinput_a",
      INPUT_COIN_A: "0xinput_a",
      INPUT_COIN_B: "0xinput_b",
      TOKEN_A_DECIMALS: 9,
      TOKEN_B_DECIMALS: 9
    }
  });
});

test("extractLaunchTestCoinsFile reads publish JSON and can write replacements", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-test-coins-"));
  const publishJson = path.join(root, "publish.json");
  const out = path.join(root, "coins.json");
  writeJson(publishJson, publishResult());

  const result = extractLaunchTestCoinsFile({ publishJson, out });

  assert.equal(result.typeA, "0xabc::coin_a::COIN_A");
  assert.deepEqual(JSON.parse(fs.readFileSync(out, "utf8")), result);
});

test("extractLaunchTestCoins rejects missing route coin", () => {
  const result = publishResult();
  result.objectChanges = result.objectChanges.filter(
    (change) => change.objectId !== "0xinput_b"
  );

  assert.throws(
    () => extractLaunchTestCoins(result),
    /Sui test coin publish result must create at least two coins for 0xabc::coin_b::COIN_B/
  );
});

test("extractLaunchTestCoins rejects failed publish status", () => {
  const result = publishResult();
  result.effects.status = {
    status: "failure",
    error: "insufficient gas"
  };

  assert.throws(
    () => extractLaunchTestCoins(result),
    /Sui test coin publish result failed: failure insufficient gas/
  );
});
