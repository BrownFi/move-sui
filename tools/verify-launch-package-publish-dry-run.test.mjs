#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifyLaunchPackagePublishDryRun } from "./verify-launch-package-publish-dry-run.mjs";

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-publish-dry-run-fixture-"));
  fs.mkdirSync(path.join(root, "sources"), { recursive: true });
  fs.writeFileSync(
    path.join(root, "Move.toml"),
    `[package]
name = "brownfi_amm"
edition = "2024.beta"
version = "2.0.0"

[dependencies]

[addresses]
brownfi_amm = "0x0"
`
  );
  fs.writeFileSync(path.join(root, "sources", "pool.move"), "module brownfi_amm::pool;\n");
  fs.writeFileSync(path.join(root, "sources", "swap.move"), "module brownfi_amm::swap;\n");
  const config = path.join(root, "launch.json");
  fs.writeFileSync(
    config,
    `${JSON.stringify(
      {
        name: "fixture-pyth-upgraded",
        sources: ["pool", "swap"],
        copyPaths: [],
        removeDependencies: [],
        removeAddresses: []
      },
      null,
      2
    )}\n`
  );
  return { root, config };
}

test("verifyLaunchPackagePublishDryRun builds package and validates Sui publish dry-run evidence", () => {
  const { root, config } = fixtureRoot();
  const out = path.join(root, "out");
  const calls = [];

  const summary = verifyLaunchPackagePublishDryRun({
    root,
    config,
    out,
    network: "testnet",
    gasBudget: "2000000000",
    expectedDependencyIds: [
      "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd",
      "0xe79f4e3e02ce132f40f39e73220493a802329d3cb6ad7f789e98a78910fc0053"
    ],
    expectedModules: ["pool", "swap"],
    useRtk: true,
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return JSON.stringify({
        effects: {
          status: { status: "success" },
          transactionDigest: "PUBLISH_DRY_RUN_DIGEST"
        },
        objectChanges: [
          {
            type: "published",
            packageId: "0xPUBLISHED",
            modules: ["pool", "swap"]
          }
        ],
        input: {
          transaction: {
            transactions: [
              {
                Publish: [
                  "0x1",
                  "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd",
                  "0x2",
                  "0xe79f4e3e02ce132f40f39e73220493a802329d3cb6ad7f789e98a78910fc0053"
                ]
              }
            ]
          }
        }
      });
    }
  });

  assert.equal(fs.existsSync(path.join(out, "Move.toml")), true);
  assert.deepEqual(calls, [
    {
      command: "rtk",
      args: [
        "sui",
        "client",
        "--client.env",
        "testnet",
        "publish",
        "--allow-dirty",
        "--with-unpublished-dependencies",
        "--dry-run",
        "--json",
        "--silence-warnings",
        "--gas-budget",
        "2000000000",
        out
      ],
      options: {
        encoding: "utf8",
        maxBuffer: 33554432
      }
    }
  ]);
  assert.deepEqual(summary, {
    config,
    network: "testnet",
    status: "success",
    transactionDigest: "PUBLISH_DRY_RUN_DIGEST",
    packageId: "0xPUBLISHED",
    modules: ["pool", "swap"],
    dependencies: [
      "0x1",
      "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd",
      "0x2",
      "0xe79f4e3e02ce132f40f39e73220493a802329d3cb6ad7f789e98a78910fc0053"
    ]
  });
});

test("verifyLaunchPackagePublishDryRun rejects missing expected dependency IDs", () => {
  const { root, config } = fixtureRoot();

  assert.throws(
    () =>
      verifyLaunchPackagePublishDryRun({
        root,
        config,
        out: path.join(root, "out"),
        network: "testnet",
        expectedDependencyIds: ["0xMISSING"],
        execFileSync() {
          return JSON.stringify({
            effects: {
              status: { status: "success" },
              transactionDigest: "PUBLISH_DRY_RUN_DIGEST"
            },
            objectChanges: [
              {
                type: "published",
                packageId: "0xPUBLISHED",
                modules: ["pool", "swap"]
              }
            ],
            input: {
              transaction: {
                transactions: [{ Publish: ["0x1"] }]
              }
            }
          });
        }
      }),
    /Sui publish dry-run missing expected dependency 0xMISSING/
  );
});
