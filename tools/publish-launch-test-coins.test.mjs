#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { publishLaunchTestCoins } from "./publish-launch-test-coins.mjs";

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-test-coin-publish-"));
  write(
    path.join(root, "Move.toml"),
    `[package]
name = "brownfi_launch_test_coins"
edition = "2024.beta"
version = "0.0.0"

[addresses]
brownfi_launch_test_coins = "0x0"
`
  );
  write(path.join(root, "sources", "coin_a.move"), "module brownfi_launch_test_coins::coin_a;\n");
  write(path.join(root, "sources", "coin_b.move"), "module brownfi_launch_test_coins::coin_b;\n");
  write(path.join(root, "Published.toml"), "[published.testnet]\npublished-at = \"0xabc\"\n");
  return root;
}

function publishResult({
  digest = "TEST_COIN_PUBLISH_DIGEST",
  packageId = "0xabc"
} = {}) {
  return JSON.stringify({
    effects: {
      status: { status: "success" },
      transactionDigest: digest
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
        objectType: `0x2::coin::TreasuryCap<${packageId}::coin_a::COIN_A>`
      },
      {
        type: "created",
        objectId: "0xinit_a",
        objectType: `0x2::coin::Coin<${packageId}::coin_a::COIN_A>`
      },
      {
        type: "created",
        objectId: "0xinput_a",
        objectType: `0x2::coin::Coin<${packageId}::coin_a::COIN_A>`
      },
      {
        type: "created",
        objectId: "0xcap_b",
        objectType: `0x2::coin::TreasuryCap<${packageId}::coin_b::COIN_B>`
      },
      {
        type: "created",
        objectId: "0xinit_b",
        objectType: `0x2::coin::Coin<${packageId}::coin_b::COIN_B>`
      },
      {
        type: "created",
        objectId: "0xinput_b",
        objectType: `0x2::coin::Coin<${packageId}::coin_b::COIN_B>`
      }
    ]
  });
}

test("publishLaunchTestCoins publishes a launch test-coin package and extracts values", () => {
  const packagePath = fixtureRoot();
  const calls = [];

  const result = publishLaunchTestCoins({
    packagePath,
    network: "testnet",
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return publishResult();
    }
  });

  assert.equal(calls[0].command, "sui");
  const publishPackagePath = calls[0].args.at(-1);
  assert.notEqual(publishPackagePath, packagePath);
  assert.equal(path.dirname(path.dirname(publishPackagePath)), os.tmpdir());
  assert.equal(fs.existsSync(path.join(publishPackagePath, "Published.toml")), false);
  assert.deepEqual(calls[0].args, [
    "client",
    "--client.env",
    "testnet",
    "publish",
    "--allow-dirty",
    "--json",
    "--silence-warnings",
    "--gas-budget",
    "1000000000",
    publishPackagePath
  ]);
  assert.equal(result.status, "success");
  assert.equal(result.packageId, "0xabc");
  assert.equal(result.replacements.TYPE_A, "0xabc::coin_a::COIN_A");
  assert.equal(result.replacements.INIT_COIN_A, "0xinit_a");
});

test("publishLaunchTestCoins omits source Published.toml from the publish copy", () => {
  const packagePath = fixtureRoot();
  const calls = [];

  publishLaunchTestCoins({
    packagePath,
    network: "testnet",
    execFileSync(command, args) {
      calls.push({ command, args });
      return publishResult();
    }
  });

  assert.equal(calls[0].command, "sui");
  const publishPackagePath = calls[0].args.at(-1);
  assert.notEqual(publishPackagePath, packagePath);
  assert.equal(fs.existsSync(path.join(packagePath, "Published.toml")), true);
  assert.equal(fs.existsSync(path.join(publishPackagePath, "Published.toml")), false);
});

test("publishLaunchTestCoins can gate gas before publishing", () => {
  const packagePath = fixtureRoot();
  const calls = [];

  publishLaunchTestCoins({
    packagePath,
    network: "devnet",
    useRtk: true,
    gasReadiness: {
      activeAddress: "0x123",
      minMist: "100"
    },
    execFileSync(command, args) {
      calls.push({ command, args });
      if (calls.length === 1) {
        return JSON.stringify([{ gasCoinId: "0xgas", mistBalance: "100" }]);
      }
      return publishResult();
    }
  });

  assert.equal(calls[0].command, "rtk");
  assert.deepEqual(calls[0].args, [
    "sui",
    "client",
    "--client.env",
    "devnet",
    "gas",
    "--json"
  ]);
  assert.equal(calls[1].command, "rtk");
  assert.deepEqual(calls[1].args.slice(0, 5), [
    "sui",
    "client",
    "--client.env",
    "devnet",
    "publish"
  ]);
});

test("publishLaunchTestCoins rejects failed publish status", () => {
  const packagePath = fixtureRoot();

  assert.throws(
    () =>
      publishLaunchTestCoins({
        packagePath,
        network: "testnet",
        execFileSync() {
          return JSON.stringify({
            effects: {
              status: {
                status: "failure",
                error: "insufficient gas"
              }
            },
            objectChanges: []
          });
        }
      }),
    /Sui test coin publish failed: failure insufficient gas/
  );
});
