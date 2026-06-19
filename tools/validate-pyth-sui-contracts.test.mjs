#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";

import { validatePythSuiContractManifestFile } from "./validate-pyth-sui-contracts.mjs";

test("validatePythSuiContractManifestFile confirms SDK Pyth Sui contract IDs", () => {
  const summary = validatePythSuiContractManifestFile({
    manifest: "configs/oracles/pyth-sui-contracts.json"
  });

  assert.deepEqual(summary, {
    networkCount: 2,
    contractSetCount: 4,
    defaultContractSet: "upgraded",
    entries: [
      "mainnet/current",
      "mainnet/upgraded",
      "testnet/current",
      "testnet/upgraded"
    ]
  });
});
