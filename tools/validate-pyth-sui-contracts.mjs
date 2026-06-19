#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getPythSuiContractConfig } from "../sdk/router/dist/index.js";

const PYTH_SUI_NETWORKS = ["mainnet", "testnet"];
const PYTH_SUI_CONTRACT_SETS = ["current", "upgraded"];
const REQUIRED_CONTRACT_FIELDS = [
  "pythStateId",
  "pythPackageId",
  "wormholeStateId",
  "wormholePackageId"
];

function usage() {
  console.error(
    [
      "Usage: node tools/validate-pyth-sui-contracts.mjs --manifest <file>",
      "",
      "Validates the documented Pyth Sui contract manifest against sdk/router constants."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--manifest") {
      args.manifest = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.manifest) {
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

function requireHexObjectId(value, label) {
  const objectId = requireString(value, label);
  if (!/^0x[0-9a-f]{64}$/.test(objectId)) {
    throw new Error(`${label} must be a 32-byte lowercase hex object ID`);
  }
  return objectId;
}

function validateManifestShape(manifest) {
  const root = requireRecord(manifest, "Pyth Sui contract manifest");
  const defaultContractSet = requireString(
    root.defaultContractSet,
    "Pyth Sui contract manifest defaultContractSet"
  );
  if (defaultContractSet !== "upgraded") {
    throw new Error("Pyth Sui contract manifest defaultContractSet must be upgraded");
  }

  const networks = requireRecord(root.networks, "Pyth Sui contract manifest networks");
  const entries = [];
  for (const network of PYTH_SUI_NETWORKS) {
    const networkRecord = requireRecord(networks[network], `Pyth Sui contract manifest ${network}`);
    for (const contractSet of PYTH_SUI_CONTRACT_SETS) {
      const manifestConfig = requireRecord(
        networkRecord[contractSet],
        `Pyth Sui contract manifest ${network}/${contractSet}`
      );
      for (const field of REQUIRED_CONTRACT_FIELDS) {
        requireHexObjectId(
          manifestConfig[field],
          `Pyth Sui contract manifest ${network}/${contractSet}.${field}`
        );
      }
      entries.push(`${network}/${contractSet}`);
    }
  }

  return { defaultContractSet, entries };
}

function assertSdkMatchesManifest(manifest) {
  for (const network of PYTH_SUI_NETWORKS) {
    for (const contractSet of PYTH_SUI_CONTRACT_SETS) {
      const manifestConfig = manifest.networks[network][contractSet];
      const sdkConfig = getPythSuiContractConfig(network, contractSet);
      for (const field of REQUIRED_CONTRACT_FIELDS) {
        if (sdkConfig[field] !== manifestConfig[field]) {
          throw new Error(
            `Pyth Sui SDK config mismatch for ${network}/${contractSet}.${field}: expected ${manifestConfig[field]}, got ${sdkConfig[field]}`
          );
        }
      }
    }
  }
}

export function validatePythSuiContractManifestFile({ manifest }) {
  if (!manifest) throw new Error("Missing Pyth Sui contract manifest path");
  const manifestPath = path.resolve(manifest);
  const value = readJson(manifestPath);
  const shape = validateManifestShape(value);
  assertSdkMatchesManifest(value);

  return {
    networkCount: PYTH_SUI_NETWORKS.length,
    contractSetCount: shape.entries.length,
    defaultContractSet: shape.defaultContractSet,
    entries: shape.entries
  };
}

function main() {
  const summary = validatePythSuiContractManifestFile(parseArgs(process.argv.slice(2)));
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
