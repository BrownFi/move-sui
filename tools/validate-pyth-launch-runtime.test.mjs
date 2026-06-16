#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { validatePythLaunchRuntimeConfigFile } from "./validate-pyth-launch-runtime.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-pyth-runtime-"));
}

function liveId(suffix) {
  return `0x${suffix.repeat(64).slice(0, 64)}`;
}

function writeLaunchConfig(root) {
  const config = path.join(root, "launch.json");
  writeJson(config, {
    providerIds: ["pyth"]
  });
  return config;
}

function writeRuntimeConfig(root, overrides = {}) {
  const config = path.join(root, "runtime.json");
  writeJson(config, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "upgraded",
    requirePythApiKey: false,
    ...overrides
  });
  return config;
}

function writeMatrix(root, overrides = {}) {
  const config = path.join(root, "matrix.json");
  const pair = {
    packageId: liveId("1"),
    typeA: `${liveId("1")}::coin_a::COIN_A`,
    typeB: `${liveId("1")}::coin_b::COIN_B`,
    pool: liveId("2"),
    feedIds: [liveId("a"), liveId("b")],
    oracleSourceCount: 1,
    updatePayloadByteLength: 0,
    ...(overrides.pair ?? {})
  };
  writeJson(config, {
    network: "testnet",
    providerIds: ["pyth"],
    routeLimits: {
      maxHops: 1,
      maxOracleSourcesPerHop: 1,
      maxAmmSourcesPerHop: 0,
      maxUpdatePayloadBytes: 250000
    },
    routeCases: [
      {
        name: "pyth exact input route",
        kind: "exact-input",
        providerId: "pyth",
        clock: "0x6",
        path: [pair.typeA, pair.typeB],
        pairs: [pair],
        input: liveId("3"),
        minOutputs: ["1"]
      }
    ],
    quoteCases: [
      {
        name: "pyth exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        clock: "0x6",
        path: [pair.typeA, pair.typeB],
        pairs: [pair],
        amountIn: "1000000"
      }
    ],
    ...overrides.matrix
  });
  return config;
}

test("validatePythLaunchRuntimeConfigFile validates Pyth-only live runtime inputs", () => {
  const root = fixtureRoot();
  const runtimeConfig = writeRuntimeConfig(root);
  const matrix = writeMatrix(root);
  const launchConfig = writeLaunchConfig(root);

  const summary = validatePythLaunchRuntimeConfigFile({
    runtimeConfig,
    matrix,
    launchConfig,
    manifest: "configs/oracles/pyth-sui-contracts.json",
    requireLiveValues: true
  });

  assert.deepEqual(summary, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "upgraded",
    matrixCaseCount: 2,
    feedIdCount: 2,
    pythPackageId: "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd"
  });
});

test("validatePythLaunchRuntimeConfigFile rejects missing required Pyth API key env value", () => {
  const root = fixtureRoot();
  const runtimeConfig = writeRuntimeConfig(root, {
    requirePythApiKey: true,
    pythApiKeyEnv: "PYTH_HERMES_API_KEY"
  });

  assert.throws(
    () =>
      validatePythLaunchRuntimeConfigFile({
        runtimeConfig,
        manifest: "configs/oracles/pyth-sui-contracts.json",
        env: {}
      }),
    /Pyth launch runtime requires PYTH_HERMES_API_KEY to be set/
  );
});

test("validatePythLaunchRuntimeConfigFile rejects non-Pyth matrix providers", () => {
  const root = fixtureRoot();
  const runtimeConfig = writeRuntimeConfig(root);
  const matrix = writeMatrix(root, {
    matrix: {
      providerIds: ["pyth", "stork-rest"]
    }
  });

  assert.throws(
    () =>
      validatePythLaunchRuntimeConfigFile({
        runtimeConfig,
        matrix,
        manifest: "configs/oracles/pyth-sui-contracts.json"
      }),
    /Pyth launch runtime matrix providerIds must be exactly pyth/
  );
});

test("validatePythLaunchRuntimeConfigFile rejects malformed Pyth feed IDs", () => {
  const root = fixtureRoot();
  const runtimeConfig = writeRuntimeConfig(root);
  const matrix = writeMatrix(root, {
    pair: {
      feedIds: ["feed-a", liveId("b")]
    }
  });
  const launchConfig = writeLaunchConfig(root);

  assert.throws(
    () =>
      validatePythLaunchRuntimeConfigFile({
        runtimeConfig,
        matrix,
        launchConfig,
        manifest: "configs/oracles/pyth-sui-contracts.json"
      }),
    /Pyth launch runtime routeCases\[0\]\.pairs\[0\]\.feedIds\[0\] must be a 32-byte hex feed ID/
  );
});

test("validatePythLaunchRuntimeConfigFile allows placeholder feed IDs when live values are not required", () => {
  const root = fixtureRoot();
  const runtimeConfig = writeRuntimeConfig(root);
  const matrix = writeMatrix(root, {
    pair: {
      feedIds: ["0xBASE_FEED_ID", "0xQUOTE_FEED_ID"]
    }
  });
  const launchConfig = writeLaunchConfig(root);

  const summary = validatePythLaunchRuntimeConfigFile({
    runtimeConfig,
    matrix,
    launchConfig,
    manifest: "configs/oracles/pyth-sui-contracts.json"
  });

  assert.deepEqual(summary, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "upgraded",
    matrixCaseCount: 2,
    feedIdCount: 0,
    pythPackageId: "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd"
  });
});

test("pyth-upgraded testnet runtime example matches documented Pyth contract set", () => {
  const summary = validatePythLaunchRuntimeConfigFile({
    runtimeConfig: "configs/launch/pyth-upgraded-testnet.runtime.example.json",
    manifest: "configs/oracles/pyth-sui-contracts.json"
  });

  assert.deepEqual(summary, {
    network: "testnet",
    providerId: "pyth",
    contractSet: "upgraded",
    matrixCaseCount: 0,
    feedIdCount: 0,
    pythPackageId: "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd"
  });
});
