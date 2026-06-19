#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const REQUIRED_OBJECT_TYPES = {
  factory: "factory::Factory",
  oracleAdapter: "oracle::OracleAdapter",
  poolCreatorCap: "factory::PoolCreatorCap"
};

const FACTORY_CAP_NAMES = new Set([
  "AdminCap",
  "PoolCreatorCap",
  "FeeCap",
  "RiskCap",
  "OracleCap",
  "AmmCap",
  "RouterCap",
  "PauseCap"
]);

function usage() {
  console.error(
    [
      "Usage: node tools/extract-launch-publish-objects.mjs --publish-json <file> [--out <file>]",
      "",
      "Extracts BrownFi launch setup object IDs from Sui publish JSON."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--publish-json") {
      args.publishJson = argv[++i];
    } else if (arg === "--out") {
      args.out = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.publishJson) {
    usage();
    process.exit(2);
  }

  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function assertPublishSucceeded(result) {
  const status = result?.effects?.status?.status;
  if (status !== "success") {
    const error = result?.effects?.status?.error;
    throw new Error(
      `Sui publish result failed: ${status ?? "missing status"}${error ? ` ${error}` : ""}`
    );
  }
}

function publishedPackageId(result) {
  const changes = Array.isArray(result?.objectChanges) ? result.objectChanges : [];
  const published = changes.find((change) => change?.type === "published");
  if (published === undefined) {
    throw new Error("Sui publish result missing published object change");
  }
  return requireString(published.packageId, "Sui publish package ID");
}

function createdObjectChanges(result) {
  const changes = result?.objectChanges;
  if (!Array.isArray(changes)) {
    throw new Error("Sui publish result objectChanges must be an array");
  }
  return changes.filter((change) => change?.type === "created");
}

function objectIdForType(created, objectType) {
  const matches = created.filter((change) => change?.objectType === objectType);
  if (matches.length === 0) {
    throw new Error(`Sui publish result missing required created object ${objectType}`);
  }
  if (matches.length > 1) {
    throw new Error(`Sui publish result has multiple created objects ${objectType}`);
  }
  return requireString(matches[0].objectId, `Sui publish created object ${objectType} objectId`);
}

function capNameFromObjectType(packageId, objectType) {
  if (typeof objectType !== "string") return undefined;
  const prefix = `${packageId}::factory::`;
  if (!objectType.startsWith(prefix)) return undefined;
  const capName = objectType.slice(prefix.length);
  return FACTORY_CAP_NAMES.has(capName) ? capName : undefined;
}

function capObjectIds(packageId, created) {
  const caps = {};
  for (const change of created) {
    const capName = capNameFromObjectType(packageId, change?.objectType);
    if (capName === undefined) continue;
    if (caps[capName] !== undefined) {
      throw new Error(`Sui publish result has multiple created objects ${change.objectType}`);
    }
    caps[capName] = requireString(
      change.objectId,
      `Sui publish created object ${change.objectType} objectId`
    );
  }
  return caps;
}

export function extractLaunchPublishObjects(result) {
  assertPublishSucceeded(result);
  const packageId = publishedPackageId(result);
  const created = createdObjectChanges(result);
  const objectType = (suffix) => `${packageId}::${suffix}`;

  const caps = capObjectIds(packageId, created);
  return {
    status: "success",
    transactionDigest: requireString(
      result.effects.transactionDigest,
      "Sui publish transaction digest"
    ),
    packageId,
    factory: objectIdForType(created, objectType(REQUIRED_OBJECT_TYPES.factory)),
    oracleAdapter: objectIdForType(created, objectType(REQUIRED_OBJECT_TYPES.oracleAdapter)),
    poolCreatorCap: objectIdForType(created, objectType(REQUIRED_OBJECT_TYPES.poolCreatorCap)),
    caps
  };
}

export function extractLaunchPublishObjectsFile({ publishJson, out }) {
  if (!publishJson) throw new Error("Missing Sui publish JSON path");
  const result = extractLaunchPublishObjects(readJson(publishJson));
  if (out !== undefined) {
    writeJson(out, result);
  }
  return result;
}

function main() {
  const summary = extractLaunchPublishObjectsFile(parseArgs(process.argv.slice(2)));
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
