#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

function usage() {
  console.error(
    [
      "Usage: node tools/extract-launch-pool-create-objects.mjs --tx-json <file> [--out <file>]",
      "",
      "Extracts BrownFi live matrix pool and LP coin replacement values from a create-pool tx JSON."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--tx-json") {
      args.txJson = argv[++i];
    } else if (arg === "--out") {
      args.out = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.txJson) {
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

function assertTxSucceeded(result) {
  const status = result?.effects?.status?.status;
  if (status !== "success") {
    const error = result?.effects?.status?.error;
    throw new Error(
      `Sui create-pool transaction failed: ${status ?? "missing status"}${error ? ` ${error}` : ""}`
    );
  }
}

function poolCreatedEvent(result) {
  const events = Array.isArray(result?.events) ? result.events : [];
  const matches = events.filter(
    (event) => typeof event?.type === "string" && event.type.endsWith("::events::PoolCreated")
  );
  if (matches.length === 0) {
    throw new Error("Sui create-pool transaction missing PoolCreated event");
  }
  if (matches.length > 1) {
    throw new Error("Sui create-pool transaction has multiple PoolCreated events");
  }
  return matches[0];
}

function packageIdFromEventType(eventType) {
  const suffix = "::events::PoolCreated";
  if (!eventType.endsWith(suffix)) {
    throw new Error(`Invalid PoolCreated event type: ${eventType}`);
  }
  return eventType.slice(0, -suffix.length);
}

function poolIdFromEvent(event) {
  return requireString(
    event?.parsedJson?.pool_id ?? event?.parsedJson?.poolId,
    "PoolCreated event pool_id"
  );
}

function lpCoinObjectId(result) {
  const changes = Array.isArray(result?.objectChanges) ? result.objectChanges : [];
  const matches = changes.filter(
    (change) =>
      change?.type === "created" &&
      typeof change?.objectType === "string" &&
      change.objectType.startsWith("0x2::coin::Coin<") &&
      change.objectType.includes("::pool::LP<")
  );
  if (matches.length === 0) {
    throw new Error("Sui create-pool transaction missing created LP coin object");
  }
  if (matches.length > 1) {
    throw new Error("Sui create-pool transaction has multiple created LP coin objects");
  }
  return requireString(matches[0].objectId, "Sui create-pool LP coin objectId");
}

export function extractLaunchPoolCreateObjects(result) {
  assertTxSucceeded(result);
  const event = poolCreatedEvent(result);
  const packageId = packageIdFromEventType(requireString(event.type, "PoolCreated event type"));
  const pool = poolIdFromEvent(event);
  const lpCoin = lpCoinObjectId(result);

  return {
    status: "success",
    transactionDigest: requireString(
      result.effects.transactionDigest,
      "Sui create-pool transaction digest"
    ),
    packageId,
    pool,
    lpCoin,
    replacements: {
      POOL: pool,
      LP_COIN: lpCoin
    }
  };
}

export function extractLaunchPoolCreateObjectsFile({ txJson, out }) {
  if (!txJson) throw new Error("Missing create-pool tx JSON path");
  const result = extractLaunchPoolCreateObjects(readJson(txJson));
  if (out !== undefined) {
    writeJson(out, result);
  }
  return result;
}

function main() {
  const summary = extractLaunchPoolCreateObjectsFile(parseArgs(process.argv.slice(2)));
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
