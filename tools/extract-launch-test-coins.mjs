#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const MODULE_A = "coin_a";
const MODULE_B = "coin_b";
const COIN_A = "COIN_A";
const COIN_B = "COIN_B";
const DECIMALS_A = 9;
const DECIMALS_B = 9;

function usage() {
  console.error(
    [
      "Usage: node tools/extract-launch-test-coins.mjs --publish-json <file> [--out <file>]",
      "",
      "Extracts launch test-coin token types and coin object IDs from Sui publish JSON."
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
      `Sui test coin publish result failed: ${status ?? "missing status"}${error ? ` ${error}` : ""}`
    );
  }
}

function publishedPackageId(result) {
  const changes = Array.isArray(result?.objectChanges) ? result.objectChanges : [];
  const published = changes.find((change) => change?.type === "published");
  if (published === undefined) {
    throw new Error("Sui test coin publish result missing published object change");
  }
  return requireString(published.packageId, "Sui test coin publish package ID");
}

function createdObjectChanges(result) {
  const changes = result?.objectChanges;
  if (!Array.isArray(changes)) {
    throw new Error("Sui test coin publish result objectChanges must be an array");
  }
  return changes.filter((change) => change?.type === "created");
}

function typeA(packageId) {
  return `${packageId}::${MODULE_A}::${COIN_A}`;
}

function typeB(packageId) {
  return `${packageId}::${MODULE_B}::${COIN_B}`;
}

function objectIdForType(created, objectType) {
  const matches = created.filter((change) => change?.objectType === objectType);
  if (matches.length === 0) {
    throw new Error(`Sui test coin publish result missing required created object ${objectType}`);
  }
  if (matches.length > 1) {
    throw new Error(`Sui test coin publish result has multiple created objects ${objectType}`);
  }
  return requireString(
    matches[0].objectId,
    `Sui test coin publish created object ${objectType} objectId`
  );
}

function coinObjectIds(created, coinType) {
  const objectType = `0x2::coin::Coin<${coinType}>`;
  const coins = created
    .filter((change) => change?.objectType === objectType)
    .map((change) =>
      requireString(change.objectId, `Sui test coin publish created object ${objectType} objectId`)
    );
  if (coins.length < 2) {
    throw new Error(
      `Sui test coin publish result must create at least two coins for ${coinType}`
    );
  }
  return coins;
}

export function extractLaunchTestCoins(result) {
  assertPublishSucceeded(result);
  const packageId = publishedPackageId(result);
  const created = createdObjectChanges(result);
  const coinTypeA = typeA(packageId);
  const coinTypeB = typeB(packageId);
  const coinsA = coinObjectIds(created, coinTypeA);
  const coinsB = coinObjectIds(created, coinTypeB);
  const initCoinA = coinsA[0];
  const inputCoinA = coinsA[1];
  const initCoinB = coinsB[0];
  const inputCoinB = coinsB[1];

  return {
    status: "success",
    transactionDigest: requireString(
      result.effects.transactionDigest,
      "Sui test coin publish transaction digest"
    ),
    packageId,
    typeA: coinTypeA,
    typeB: coinTypeB,
    treasuryCapA: objectIdForType(created, `0x2::coin::TreasuryCap<${coinTypeA}>`),
    treasuryCapB: objectIdForType(created, `0x2::coin::TreasuryCap<${coinTypeB}>`),
    initCoinA,
    initCoinB,
    inputCoinA,
    inputCoinB,
    inputCoin: inputCoinA,
    replacements: {
      TYPE_A: coinTypeA,
      TYPE_B: coinTypeB,
      INIT_COIN_A: initCoinA,
      INIT_COIN_B: initCoinB,
      INPUT_COIN: inputCoinA,
      INPUT_COIN_A: inputCoinA,
      INPUT_COIN_B: inputCoinB,
      TOKEN_A_DECIMALS: DECIMALS_A,
      TOKEN_B_DECIMALS: DECIMALS_B
    }
  };
}

export function extractLaunchTestCoinsFile({ publishJson, out }) {
  if (!publishJson) throw new Error("Missing Sui test coin publish JSON path");
  const result = extractLaunchTestCoins(readJson(publishJson));
  if (out !== undefined) {
    writeJson(out, result);
  }
  return result;
}

function main() {
  const summary = extractLaunchTestCoinsFile(parseArgs(process.argv.slice(2)));
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
