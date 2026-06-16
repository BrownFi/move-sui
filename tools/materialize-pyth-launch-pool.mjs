#!/usr/bin/env node

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { loadPythLaunchPoolConfigFile } from "./create-pyth-launch-pool.mjs";

const PLACEHOLDER_LITERALS = new Map([
  ["BROWNFI_PACKAGE", "0xBROWNFI_PACKAGE"],
  ["TYPE_A", "TYPE_A"],
  ["TYPE_B", "TYPE_B"],
  ["FACTORY", "0xFACTORY"],
  ["POOL_CREATOR_CAP", "0xPOOL_CREATOR_CAP"],
  ["PAUSE_CAP", "0xPAUSE_CAP"],
  ["ORACLE_ADAPTER", "0xORACLE_ADAPTER"],
  ["BASE_FEED_ID", "0xBASE_FEED_ID"],
  ["QUOTE_FEED_ID", "0xQUOTE_FEED_ID"],
  ["INIT_COIN_A", "0xINIT_COIN_A"],
  ["INIT_COIN_B", "0xINIT_COIN_B"],
  ["INPUT_COIN", "0xINPUT_COIN"],
  ["INPUT_COIN_A", "0xINPUT_COIN_A"],
  ["INPUT_COIN_B", "0xINPUT_COIN_B"],
  ["TOKEN_A_DECIMALS", "TOKEN_A_DECIMALS"],
  ["TOKEN_B_DECIMALS", "TOKEN_B_DECIMALS"]
]);

function usage() {
  console.error(
    [
      "Usage: node tools/materialize-pyth-launch-pool.mjs --template <file> --values <file> [--values <file>...] --publish-result <file> --out <file>",
      "       Alias: --publish-objects <file>",
      "",
      "Replaces Pyth pool-create placeholders with live values and validates the result."
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
    } else if (arg === "--publish-objects" || arg === "--publish-result") {
      args.publishObjects = argv[++i];
    } else if (arg === "--out") {
      args.out = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.template || args.values.length === 0 || !args.publishObjects || !args.out) {
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

function requireU8(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`${label} must be a u8 integer`);
  }
  return value;
}

function valuesRecord(valuesFile) {
  const raw = requireRecord(readJson(valuesFile), "Pyth launch pool values");
  return requireRecord(raw.replacements ?? raw, "Pyth launch pool replacements");
}

function valuesFiles(values) {
  if (Array.isArray(values)) return values;
  return [values];
}

function replacementLiteral(key) {
  if (!PLACEHOLDER_LITERALS.has(key)) {
    throw new Error(`Unknown Pyth launch pool replacement key: ${key}`);
  }
  return PLACEHOLDER_LITERALS.get(key);
}

function addReplacement(replacements, key, value, sourceLabel) {
  const literal = replacementLiteral(key);
  const replacement =
    key === "TOKEN_A_DECIMALS" || key === "TOKEN_B_DECIMALS"
      ? requireU8(value, `Pyth launch pool replacement ${key}`)
      : requireString(value, `Pyth launch pool replacement ${key}`);
  const existing = replacements.get(literal);
  if (existing !== undefined && existing !== replacement) {
    throw new Error(`${sourceLabel} conflicts with replacement ${key}`);
  }
  replacements.set(literal, replacement);
}

function loadPublishObjectReplacements(file) {
  const raw = requireRecord(readJson(file), "Pyth launch publish objects");
  const publishObjects = requireRecord(
    raw.publishObjects ?? raw,
    "Pyth launch publish objects"
  );
  const replacements = {
    BROWNFI_PACKAGE: requireString(publishObjects.packageId, "Publish objects packageId"),
    FACTORY: requireString(publishObjects.factory, "Publish objects factory"),
    POOL_CREATOR_CAP: requireString(
      publishObjects.poolCreatorCap,
      "Publish objects poolCreatorCap"
    ),
    ORACLE_ADAPTER: requireString(
      publishObjects.oracleAdapter,
      "Publish objects oracleAdapter"
    )
  };
  if (publishObjects.caps?.PauseCap !== undefined) {
    replacements.PAUSE_CAP = requireString(
      publishObjects.caps.PauseCap,
      "Publish objects caps.PauseCap"
    );
  }
  return replacements;
}

function loadReplacements({ values, publishObjects }) {
  const replacements = new Map();
  for (const valuesFile of valuesFiles(values)) {
    for (const [key, value] of Object.entries(valuesRecord(valuesFile))) {
      addReplacement(replacements, key, value, `Pyth launch pool values ${valuesFile}`);
    }
  }
  for (const [key, value] of Object.entries(loadPublishObjectReplacements(publishObjects))) {
    addReplacement(replacements, key, value, `Publish objects ${key.toLowerCase()}`);
  }
  return replacements;
}

function replaceString(value, replacements) {
  let replaced = value;
  const entries = [...replacements.entries()].sort((a, b) => b[0].length - a[0].length);
  for (const [literal, replacement] of entries) {
    if (typeof replacement !== "string") continue;
    replaced = replaced.split(literal).join(replacement);
  }
  return replaced;
}

function applyReplacements(value, replacements) {
  if (typeof value === "string") {
    const direct = replacements.get(value);
    if (direct !== undefined && typeof direct !== "string") {
      return direct;
    }
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

function applyDecimalOverrides(pool, replacements) {
  const tokenADecimals = replacements.get("TOKEN_A_DECIMALS");
  const tokenBDecimals = replacements.get("TOKEN_B_DECIMALS");
  return {
    ...pool,
    tokenADecimals: tokenADecimals ?? pool.tokenADecimals,
    tokenBDecimals: tokenBDecimals ?? pool.tokenBDecimals
  };
}

function validateBeforeWrite(pool) {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-materialized-pyth-pool-"));
  const tempFile = path.join(tempDir, "pool.json");
  writeJson(tempFile, pool);
  return loadPythLaunchPoolConfigFile({ config: tempFile, requireLiveValues: true });
}

export function materializePythLaunchPoolConfig({ template, values, publishObjects, out }) {
  if (!template) throw new Error("Missing Pyth launch pool template path");
  if (!values) throw new Error("Missing Pyth launch pool values path");
  if (!publishObjects) throw new Error("Missing Pyth launch publish objects path");
  if (!out) throw new Error("Missing materialized Pyth launch pool output path");

  const replacements = loadReplacements({ values, publishObjects });
  const pool = applyDecimalOverrides(
    applyReplacements(readJson(template), replacements),
    replacements
  );
  const validation = validateBeforeWrite(pool);
  writeJson(out, pool);

  return {
    status: "success",
    template,
    out,
    packageId: validation.packageId,
    replacementCount: replacements.size,
    validation
  };
}

function main() {
  const summary = materializePythLaunchPoolConfig(parseArgs(process.argv.slice(2)));
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
