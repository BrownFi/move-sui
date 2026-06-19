#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";

import { readPythSuiUpdateFee } from "./read-pyth-sui-update-fee.mjs";

test("readPythSuiUpdateFee defaults to the verified current-Pyth launch contract set", () => {
  const calls = [];
  const summary = readPythSuiUpdateFee({
    manifest: "configs/oracles/pyth-sui-contracts.json",
    network: "testnet",
    numUpdates: 2,
    useRtk: true,
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return JSON.stringify({
        transaction: {
          effects: {
            V2: {
              status: "Success",
              transaction_digest: "current-dev-inspect-digest"
            }
          }
        },
        command_outputs: [
          {
            returnValues: [
              {
                json: "2"
              }
            ]
          }
        ]
      });
    }
  });

  assert.deepEqual(calls[0].args.slice(0, 11), [
    "sui",
    "client",
    "--client.env",
    "testnet",
    "call",
    "--package",
    "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837",
    "--module",
    "pyth",
    "--function",
    "get_total_update_fee"
  ]);
  assert.deepEqual(calls[0].args.slice(12, 14), [
    "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
    "2"
  ]);
  assert.deepEqual(summary, {
    network: "testnet",
    contractSet: "current",
    numUpdates: 2,
    pythPackageId: "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837",
    pythStateId: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
    status: "success",
    transactionDigest: "current-dev-inspect-digest",
    updateFeeInMist: "2"
  });
});

test("readPythSuiUpdateFee dev-inspects documented Pyth Sui update fee", () => {
  const calls = [];
  const summary = readPythSuiUpdateFee({
    manifest: "configs/oracles/pyth-sui-contracts.json",
    network: "testnet",
    contractSet: "upgraded",
    numUpdates: 2,
    useRtk: true,
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return JSON.stringify({
        transaction: {
          effects: {
            V2: {
              status: "Success",
              transaction_digest: "dev-inspect-digest"
            }
          }
        },
        command_outputs: [
          {
            returnValues: [
              {
                json: "0"
              }
            ]
          }
        ]
      });
    }
  });

  assert.deepEqual(calls, [
    {
      command: "rtk",
      args: [
        "sui",
        "client",
        "--client.env",
        "testnet",
        "call",
        "--package",
        "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd",
        "--module",
        "pyth",
        "--function",
        "get_total_update_fee",
        "--args",
        "0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e",
        "2",
        "--dev-inspect",
        "--gas-budget",
        "10000000",
        "--json"
      ],
      options: {
        encoding: "utf8",
        maxBuffer: 16777216
      }
    }
  ]);
  assert.deepEqual(summary, {
    network: "testnet",
    contractSet: "upgraded",
    numUpdates: 2,
    pythPackageId: "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd",
    pythStateId: "0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e",
    status: "success",
    transactionDigest: "dev-inspect-digest",
    updateFeeInMist: "0"
  });
});

test("readPythSuiUpdateFee rejects failed dev-inspect status", () => {
  assert.throws(
    () =>
      readPythSuiUpdateFee({
        manifest: "configs/oracles/pyth-sui-contracts.json",
        network: "testnet",
        contractSet: "upgraded",
        numUpdates: 2,
        execFileSync() {
          return JSON.stringify({
            transaction: {
              effects: {
                V2: {
                  status: "Failure"
                }
              }
            },
            command_outputs: []
          });
        }
      }),
    /Pyth Sui update-fee dev-inspect failed for testnet\/upgraded: Failure/
  );
});
