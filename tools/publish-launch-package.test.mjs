#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { publishLaunchPackage } from "./publish-launch-package.mjs";

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-publish-fixture-"));
  write(
    path.join(root, "Move.toml"),
    `[package]
name = "brownfi_amm"
edition = "2024.beta"
version = "2.0.0"

[addresses]
brownfi_amm = "0x0"
`
  );
  write(path.join(root, "sources", "pool.move"), "module brownfi_amm::pool;\n");
  write(path.join(root, "sources", "swap.move"), "module brownfi_amm::swap;\n");

  const config = path.join(root, "launch.json");
  write(
    config,
    JSON.stringify(
      {
        name: "fixture-publish",
        sources: ["pool", "swap"]
      },
      null,
      2
    )
  );
  return { root, config };
}

function publishResult({
  digest = "PUBLISH_DIGEST",
  packageId = "0xabc",
  modules = ["pool", "swap"],
  dependencies = ["0x2"]
} = {}) {
  return JSON.stringify({
    input: {
      transaction: {
        transactions: [
          {
            Publish: dependencies
          }
        ]
      }
    },
    effects: {
      status: { status: "success" },
      transactionDigest: digest
    },
    objectChanges: [
      {
        type: "published",
        packageId,
        modules
      },
      {
        type: "created",
        objectId: "0xfactory",
        objectType: `${packageId}::factory::Factory`
      },
      {
        type: "created",
        objectId: "0oracle",
        objectType: `${packageId}::oracle::OracleAdapter`
      },
      {
        type: "created",
        objectId: "0poolcap",
        objectType: `${packageId}::factory::PoolCreatorCap`
      },
      {
        type: "created",
        objectId: "0riskcap",
        objectType: `${packageId}::factory::RiskCap`
      }
    ]
  });
}

function currentSuiPublishResult({
  digest = "PUBLISH_DIGEST",
  packageId = "0xabc",
  modules = ["pool", "swap"],
  dependencies = ["0x1", "0x2"]
} = {}) {
  const result = JSON.parse(publishResult({ digest, packageId, modules, dependencies: [] }));
  result.input = undefined;
  result.transaction = {
    data: {
      transaction: {
        transactions: [
          {
            Publish: dependencies
          }
        ]
      }
    }
  };
  return JSON.stringify(result);
}

test("publishLaunchPackage builds and publishes a launch package", () => {
  const { root, config } = fixtureRoot();
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-publish-out-")), "pkg");
  const calls = [];

  const result = publishLaunchPackage({
    root,
    config,
    out,
    network: "testnet",
    expectedModules: ["pool", "swap"],
    expectedDependencyIds: ["0x2"],
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return publishResult();
    }
  });

  assert.equal(fs.existsSync(path.join(out, "sources", "pool.move")), true);
  assert.equal(calls[0].command, "sui");
  assert.deepEqual(calls[0].args, [
    "client",
    "--client.env",
    "testnet",
    "publish",
    "--allow-dirty",
    "--with-unpublished-dependencies",
    "--json",
    "--silence-warnings",
    "--gas-budget",
    "2000000000",
    out
  ]);
  assert.equal(calls[0].options.encoding, "utf8");
  assert.deepEqual(result, {
    config,
    network: "testnet",
    status: "success",
    transactionDigest: "PUBLISH_DIGEST",
    packageId: "0xabc",
    modules: ["pool", "swap"],
    dependencies: ["0x2"],
    publishObjects: {
      status: "success",
      transactionDigest: "PUBLISH_DIGEST",
      packageId: "0xabc",
      factory: "0xfactory",
      oracleAdapter: "0oracle",
      poolCreatorCap: "0poolcap",
      caps: {
        PoolCreatorCap: "0poolcap",
        RiskCap: "0riskcap"
      }
    }
  });
});

test("publishLaunchPackage validates dependencies from current Sui tx JSON shape", () => {
  const { root, config } = fixtureRoot();
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-publish-out-")), "pkg");

  const result = publishLaunchPackage({
    root,
    config,
    out,
    network: "testnet",
    expectedDependencyIds: ["0x1", "0x2"],
    execFileSync() {
      return currentSuiPublishResult();
    }
  });

  assert.deepEqual(result.dependencies, ["0x1", "0x2"]);
});

test("publishLaunchPackage can gate gas before publishing", () => {
  const { root, config } = fixtureRoot();
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-publish-out-")), "pkg");
  const calls = [];

  publishLaunchPackage({
    root,
    config,
    out,
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

test("publishLaunchPackage rejects failed publish status", () => {
  const { root, config } = fixtureRoot();

  assert.throws(
    () =>
      publishLaunchPackage({
        root,
        config,
        out: path.join(root, "out"),
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
    /Sui publish failed: failure insufficient gas/
  );
});
