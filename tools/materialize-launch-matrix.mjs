#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateLaunchMatrixConfigFile } from "./validate-launch-matrix.mjs";

const PLACEHOLDER_LITERALS = new Map([
  ["BROWNFI_PACKAGE", "0xBROWNFI_PACKAGE"],
  ["TYPE_A", "TYPE_A"],
  ["TYPE_B", "TYPE_B"],
  ["POOL", "0xPOOL"],
  ["INPUT_COIN_A", "0xINPUT_COIN_A"],
  ["INPUT_COIN_B", "0xINPUT_COIN_B"],
  ["INPUT_COIN", "0xINPUT_COIN"],
  ["LP_COIN", "0xLP_COIN"],
  ["BASE_FEED_ID", "0xBASE_FEED_ID"],
  ["QUOTE_FEED_ID", "0xQUOTE_FEED_ID"],
  ["BASE_ASSET_ID", "BASE_ASSET_ID"],
  ["QUOTE_ASSET_ID", "QUOTE_ASSET_ID"],
  ["BASE_FEED_HASH", "BASE_FEED_HASH"],
  ["QUOTE_FEED_HASH", "QUOTE_FEED_HASH"],
  ["SWITCHBOARD_QUOTE_VERIFIER", "0xSWITCHBOARD_QUOTE_VERIFIER"]
]);
const IGNORED_SHARED_VALUE_KEYS = new Set([
  "INIT_COIN_A",
  "INIT_COIN_B",
  "TOKEN_A_DECIMALS",
  "TOKEN_B_DECIMALS"
]);

function usage() {
  console.error(
    [
      "Usage: node tools/materialize-launch-matrix.mjs --template <file> --values <file> [--values <file>...] --out <file>",
      "       [--publish-result <file>] [--pool-result <file>] [--launch-config <file>]",
      "",
      "Replaces explicit launch-matrix placeholders with live values and validates the result."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = { values: [] };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--template") {
      args.template = argv[++i];
    } else if (arg === "--values") {
      args.values.push(argv[++i]);
    } else if (arg === "--out") {
      args.out = argv[++i];
    } else if (arg === "--publish-result") {
      args.publishResult = argv[++i];
    } else if (arg === "--pool-result") {
      args.poolResult = argv[++i];
    } else if (arg === "--launch-config") {
      args.launchConfig = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.template || args.values.length === 0 || !args.out) {
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

function valuesRecord(valuesFile) {
  const raw = requireRecord(readJson(valuesFile), "Launch matrix values");
  return requireRecord(raw.replacements ?? raw, "Launch matrix replacements");
}

function valuesFiles(values) {
  if (Array.isArray(values)) return values;
  return [values];
}

function replacementLiteral(key) {
  if (PLACEHOLDER_LITERALS.has(key)) {
    return PLACEHOLDER_LITERALS.get(key);
  }
  if (key.startsWith("0x")) {
    const withoutPrefix = key.slice(2);
    if ([...PLACEHOLDER_LITERALS.values()].includes(key)) {
      return key;
    }
    throw new Error(`Unknown launch matrix replacement key: ${key}`);
  }
  throw new Error(`Unknown launch matrix replacement key: ${key}`);
}

function addReplacement(replacements, key, value, sourceLabel) {
  if (IGNORED_SHARED_VALUE_KEYS.has(key)) return;
  const literal = replacementLiteral(key);
  const stringValue = requireString(value, `Launch matrix replacement ${key}`);
  const existing = replacements.get(literal);
  if (existing !== undefined && existing !== stringValue) {
    throw new Error(`${sourceLabel} conflicts with replacement ${key}`);
  }
  replacements.set(literal, stringValue);
}

function addPoolResultReplacements(replacements, poolResult) {
  if (poolResult === undefined) return;
  const result = readJson(poolResult);
  const pool = result.replacements?.POOL ?? result.pool;
  const lpCoin = result.replacements?.LP_COIN ?? result.lpCoin;
  addReplacement(replacements, "POOL", pool, "Pool result POOL");
  addReplacement(replacements, "LP_COIN", lpCoin, "Pool result LP_COIN");
}

function loadReplacements({ values, publishResult, poolResult }) {
  const replacements = new Map();
  for (const valuesFile of valuesFiles(values)) {
    for (const [key, value] of Object.entries(valuesRecord(valuesFile))) {
      addReplacement(replacements, key, value, `Launch matrix values ${valuesFile}`);
    }
  }
  if (publishResult !== undefined) {
    const packageId = requireString(
      readJson(publishResult).packageId,
      "Publish result packageId"
    );
    addReplacement(replacements, "BROWNFI_PACKAGE", packageId, "Publish result packageId");
  }
  addPoolResultReplacements(replacements, poolResult);
  return replacements;
}

function replaceString(value, replacements) {
  let replaced = value;
  const entries = [...replacements.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [literal, replacement] of entries) {
    replaced = replaced.replaceAll(
      new RegExp(`${escapeRegExp(literal)}(?![A-Z0-9_])`, "g"),
      replacement
    );
  }
  return replaced;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function applyReplacements(value, replacements) {
  if (typeof value === "string") {
    return replaceString(value, replacements);
  }
  if (Array.isArray(value)) {
    return value.map((item) => applyReplacements(item, replacements));
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, applyReplacements(item, replacements)])
    );
  }
  return value;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function validateBeforeWrite(matrix, launchConfig) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-materialized-matrix-"));
  const tempFile = path.join(tempDir, "matrix.json");
  writeJson(tempFile, matrix);
  return validateLaunchMatrixConfigFile({
    config: tempFile,
    launchConfig,
    requireLiveValues: true
  });
}

export function materializeLaunchMatrix({
  template,
  values,
  out,
  publishResult,
  poolResult,
  launchConfig
}) {
  if (!template) throw new Error("Missing launch matrix template path");
  if (!values) throw new Error("Missing launch matrix values path");
  if (!out) throw new Error("Missing materialized launch matrix output path");

  const replacements = loadReplacements({ values, publishResult, poolResult });
  const matrix = applyReplacements(readJson(template), replacements);
  const validation = validateBeforeWrite(matrix, launchConfig);
  writeJson(out, matrix);

  return {
    status: "success",
    template,
    out,
    packageId: replacements.get("0xBROWNFI_PACKAGE"),
    replacementCount: replacements.size,
    validation
  };
}

function main() {
  const summary = materializeLaunchMatrix(parseArgs(process.argv.slice(2)));
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
