#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { verifySuiCliDryRunEvidenceConfigFile } from "./verify-sui-cli-dry-run-evidence.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureConfig() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-sui-cli-evidence-"));
  const config = path.join(root, "matrix.json");
  writeJson(config, {
    providerIds: ["devnet-smoke"],
    network: "devnet",
    routeCases: [
      {
        name: "devnet smoke exact input swap dry-run",
        kind: "exact-input",
        providerId: "devnet-smoke",
        clock: "0x6",
        path: ["0x1::a::A", "0x2::sui::SUI"],
        pairs: [
          {
            packageId: "0x1",
            typeA: "0x1::a::A",
            typeB: "0x2::sui::SUI",
            pool: "0x3",
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        input: "0x4",
        minOutputs: ["0"],
        suiCliDryRun: {
          package: "0x1",
          module: "devnet_smoke",
          function: "swap_smoke_for_sui",
          args: ["0x3", "0x4", "0", "0x6"],
          gasBudget: "100000000",
          expectedEventTypes: [
            "0x1::events::OracleQuorumUsed",
            "0x1::events::SwapExecuted"
          ]
        }
      }
    ]
  });
  return config;
}

test("verifySuiCliDryRunEvidenceConfigFile runs configured Sui CLI dry-run", () => {
  const calls = [];
  const result = verifySuiCliDryRunEvidenceConfigFile({
    config: fixtureConfig(),
    caseName: "devnet smoke exact input swap dry-run",
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return JSON.stringify({
        effects: {
          status: { status: "success" },
          transactionDigest: "DRY_RUN_DIGEST"
        },
        events: [
          { type: "0x1::events::OracleQuorumUsed" },
          { type: "0x1::events::SwapExecuted" }
        ]
      });
    }
  });

  assert.equal(calls[0].command, "sui");
  assert.deepEqual(calls[0].args, [
    "client",
    "--client.env",
    "devnet",
    "call",
    "--package",
    "0x1",
    "--module",
    "devnet_smoke",
    "--function",
    "swap_smoke_for_sui",
    "--args",
    "0x3",
    "0x4",
    "0",
    "0x6",
    "--dry-run",
    "--gas-budget",
    "100000000",
    "--json"
  ]);
  assert.equal(calls[0].options.encoding, "utf8");
  assert.deepEqual(result, {
    caseName: "devnet smoke exact input swap dry-run",
    status: "success",
    transactionDigest: "DRY_RUN_DIGEST",
    eventTypes: [
      "0x1::events::OracleQuorumUsed",
      "0x1::events::SwapExecuted"
    ]
  });
});

test("verifySuiCliDryRunEvidenceConfigFile rejects missing expected events", () => {
  assert.throws(
    () =>
      verifySuiCliDryRunEvidenceConfigFile({
        config: fixtureConfig(),
        caseName: "devnet smoke exact input swap dry-run",
        execFileSync() {
          return JSON.stringify({
            effects: {
              status: { status: "success" },
              transactionDigest: "DRY_RUN_DIGEST"
            },
            events: [{ type: "0x1::events::OracleQuorumUsed" }]
          });
        }
      }),
    /Sui CLI dry-run missing expected event 0x1::events::SwapExecuted/
  );
});

test("verifySuiCliDryRunEvidenceConfigFile rejects missing duplicate expected events", () => {
  const config = fixtureConfig();
  const matrix = JSON.parse(fs.readFileSync(config, "utf8"));
  matrix.routeCases[0].suiCliDryRun.expectedEventTypes = [
    "0x1::events::OracleQuorumUsed",
    "0x1::events::SwapExecuted",
    "0x1::events::SwapExecuted"
  ];
  writeJson(config, matrix);

  assert.throws(
    () =>
      verifySuiCliDryRunEvidenceConfigFile({
        config,
        caseName: "devnet smoke exact input swap dry-run",
        execFileSync() {
          return JSON.stringify({
            effects: {
              status: { status: "success" },
              transactionDigest: "DRY_RUN_DIGEST"
            },
            events: [
              { type: "0x1::events::OracleQuorumUsed" },
              { type: "0x1::events::SwapExecuted" }
            ]
          });
        }
      }),
    /Sui CLI dry-run missing expected event 0x1::events::SwapExecuted/
  );
});

test("verifySuiCliDryRunEvidenceConfigFile can run Sui through rtk", () => {
  const calls = [];
  verifySuiCliDryRunEvidenceConfigFile({
    config: fixtureConfig(),
    caseName: "devnet smoke exact input swap dry-run",
    useRtk: true,
    execFileSync(command, args) {
      calls.push({ command, args });
      return JSON.stringify({
        effects: {
          status: { status: "success" },
          transactionDigest: "DRY_RUN_DIGEST"
        },
        events: [
          { type: "0x1::events::OracleQuorumUsed" },
          { type: "0x1::events::SwapExecuted" }
        ]
      });
    }
  });

  assert.equal(calls[0].command, "rtk");
  assert.deepEqual(calls[0].args.slice(0, 5), [
    "sui",
    "client",
    "--client.env",
    "devnet",
    "call"
  ]);
});
