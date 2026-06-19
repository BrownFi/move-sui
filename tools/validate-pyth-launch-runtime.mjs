#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadLaunchMatrixConfigFile } from "./validate-launch-matrix.mjs";

const PYTH_NETWORKS = new Set(["mainnet", "testnet"]);
const PYTH_CONTRACT_SETS = new Set(["current", "upgraded"]);

function usage() {
  console.error(
    [
      "Usage: node tools/validate-pyth-launch-runtime.mjs --runtime-config <file> --manifest <file> [--matrix <file> --launch-config <file>] [--require-live-values]",
      "",
      "Validates BrownFi Pyth launch runtime config before live provider/PTB preflight."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--runtime-config") {
      args.runtimeConfig = argv[++i];
    } else if (arg === "--manifest") {
      args.manifest = argv[++i];
    } else if (arg === "--matrix") {
      args.matrix = argv[++i];
    } else if (arg === "--launch-config") {
      args.launchConfig = argv[++i];
    } else if (arg === "--require-live-values") {
      args.requireLiveValues = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.runtimeConfig || !args.manifest) {
    usage();
    process.exit(2);
  }

  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireRecord(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object`);
  }
  return value;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireOneOf(value, supported, label) {
  const stringValue = requireString(value, label);
  if (!supported.has(stringValue)) {
    throw new Error(`${label} must be one of: ${Array.from(supported).join(", ")}`);
  }
  return stringValue;
}

function requireOptionalBool(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean when present`);
  }
  return value;
}

function requireHexObjectId(value, label) {
  const stringValue = requireString(value, label);
  if (!/^0x[0-9a-f]{64}$/.test(stringValue)) {
    throw new Error(`${label} must be a 32-byte lowercase hex object ID`);
  }
  return stringValue;
}

function requireHexFeedId(value, label) {
  const stringValue = requireString(value, label);
  if (!/^0x[0-9a-fA-F]{64}$/.test(stringValue)) {
    throw new Error(`${label} must be a 32-byte hex feed ID`);
  }
  return stringValue.toLowerCase();
}

function placeholderFeedId(value) {
  if (typeof value !== "string") return false;
  const stringValue = value;
  return /^0x(?:BASE|QUOTE)_FEED_ID$/.test(stringValue)
    || /^(?:BASE|QUOTE)_FEED_ID$/.test(stringValue);
}

function loadRuntimeConfig(file) {
  const config = requireRecord(readJson(file), "Pyth launch runtime config");
  const network = requireOneOf(config.network, PYTH_NETWORKS, "Pyth launch runtime config network");
  const providerId = requireString(
    config.providerId ?? "pyth",
    "Pyth launch runtime config providerId"
  );
  if (providerId !== "pyth") {
    throw new Error("Pyth launch runtime config providerId must be pyth");
  }
  const contractSet = requireOneOf(
    config.contractSet,
    PYTH_CONTRACT_SETS,
    "Pyth launch runtime config contractSet"
  );
  const requirePythApiKey = requireOptionalBool(
    config.requirePythApiKey,
    "Pyth launch runtime config requirePythApiKey"
  ) ?? false;
  if (requirePythApiKey) {
    requireString(config.pythApiKeyEnv, "Pyth launch runtime config pythApiKeyEnv");
  }

  return {
    network,
    providerId,
    contractSet,
    requirePythApiKey,
    pythApiKeyEnv: config.pythApiKeyEnv
  };
}

function assertPythApiKeyReady(runtime, env) {
  if (!runtime.requirePythApiKey) return;
  const envName = requireString(
    runtime.pythApiKeyEnv,
    "Pyth launch runtime config pythApiKeyEnv"
  );
  const value = env[envName];
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Pyth launch runtime requires ${envName} to be set`);
  }
}

function loadPythContractConfig(manifestFile, network, contractSet) {
  const manifest = requireRecord(readJson(manifestFile), "Pyth Sui contract manifest");
  const networks = requireRecord(manifest.networks, "Pyth Sui contract manifest networks");
  const networkConfig = requireRecord(
    networks[network],
    `Pyth Sui contract manifest ${network}`
  );
  const contractConfig = requireRecord(
    networkConfig[contractSet],
    `Pyth Sui contract manifest ${network}/${contractSet}`
  );
  return {
    pythStateId: requireHexObjectId(
      contractConfig.pythStateId,
      `Pyth Sui contract manifest ${network}/${contractSet}.pythStateId`
    ),
    pythPackageId: requireHexObjectId(
      contractConfig.pythPackageId,
      `Pyth Sui contract manifest ${network}/${contractSet}.pythPackageId`
    ),
    wormholeStateId: requireHexObjectId(
      contractConfig.wormholeStateId,
      `Pyth Sui contract manifest ${network}/${contractSet}.wormholeStateId`
    ),
    wormholePackageId: requireHexObjectId(
      contractConfig.wormholePackageId,
      `Pyth Sui contract manifest ${network}/${contractSet}.wormholePackageId`
    )
  };
}

function assertPythOnlyMatrix(matrixConfig) {
  const providerIds = [...new Set(matrixConfig.providerIds)].sort();
  if (providerIds.length !== 1 || providerIds[0] !== "pyth") {
    throw new Error("Pyth launch runtime matrix providerIds must be exactly pyth");
  }
}

function casesFromMatrix(matrixConfig) {
  return [
    ...(matrixConfig.routeCases ?? []).map((routeCase, index) => ({
      section: "routeCases",
      index,
      case: routeCase
    })),
    ...(matrixConfig.quoteCases ?? []).map((quoteCase, index) => ({
      section: "quoteCases",
      index,
      case: quoteCase
    }))
  ];
}

function validatePythCaseFeedIds(matrixConfig, { requireLiveValues = false } = {}) {
  const feedIds = new Set();
  for (const entry of casesFromMatrix(matrixConfig)) {
    if (entry.case.providerId !== "pyth") {
      throw new Error(`Pyth launch runtime ${entry.section}[${entry.index}].providerId must be pyth`);
    }
    const pairs = entry.case.pairs ?? [];
    for (let pairIndex = 0; pairIndex < pairs.length; pairIndex += 1) {
      const pair = pairs[pairIndex];
      const pairFeedIds = pair.feedIds;
      if (!Array.isArray(pairFeedIds) || pairFeedIds.length !== 2) {
        throw new Error(
          `Pyth launch runtime ${entry.section}[${entry.index}].pairs[${pairIndex}].feedIds must contain exactly two feed IDs`
        );
      }
      for (let feedIndex = 0; feedIndex < pairFeedIds.length; feedIndex += 1) {
        if (!requireLiveValues && placeholderFeedId(pairFeedIds[feedIndex])) {
          continue;
        }
        feedIds.add(
          requireHexFeedId(
            pairFeedIds[feedIndex],
            `Pyth launch runtime ${entry.section}[${entry.index}].pairs[${pairIndex}].feedIds[${feedIndex}]`
          )
        );
      }
    }
  }
  return feedIds;
}

export function validatePythLaunchRuntimeConfigFile({
  runtimeConfig,
  manifest,
  matrix,
  launchConfig,
  requireLiveValues = false,
  env = process.env
}) {
  if (!runtimeConfig) throw new Error("Missing Pyth launch runtime config path");
  if (!manifest) throw new Error("Missing Pyth Sui contract manifest path");

  const runtime = loadRuntimeConfig(path.resolve(runtimeConfig));
  assertPythApiKeyReady(runtime, env);
  const pythContracts = loadPythContractConfig(
    path.resolve(manifest),
    runtime.network,
    runtime.contractSet
  );
  let matrixCaseCount = 0;
  let feedIdCount = 0;

  if (matrix !== undefined) {
    const matrixConfig = loadLaunchMatrixConfigFile({
      config: matrix,
      launchConfig,
      requireLiveValues
    });
    if (matrixConfig.network !== undefined && matrixConfig.network !== runtime.network) {
      throw new Error(
        `Pyth launch runtime network ${runtime.network} does not match matrix network ${matrixConfig.network}`
      );
    }
    assertPythOnlyMatrix(matrixConfig);
    const feedIds = validatePythCaseFeedIds(matrixConfig, { requireLiveValues });
    matrixCaseCount = casesFromMatrix(matrixConfig).length;
    feedIdCount = feedIds.size;
  }

  return {
    network: runtime.network,
    providerId: runtime.providerId,
    contractSet: runtime.contractSet,
    matrixCaseCount,
    feedIdCount,
    pythPackageId: pythContracts.pythPackageId
  };
}

function main() {
  const summary = validatePythLaunchRuntimeConfigFile(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
