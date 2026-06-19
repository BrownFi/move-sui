#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validateLaunchValidationMatrixConfig } from "../sdk/router/dist/index.js";

const PLACEHOLDER_TOKENS = [
  "BROWNFI_PACKAGE",
  "TYPE_A",
  "TYPE_B",
  "POOL",
  "INPUT_COIN",
  "BASE_FEED_ID",
  "QUOTE_FEED_ID",
  "BASE_ASSET_ID",
  "QUOTE_ASSET_ID",
  "BASE_FEED_HASH",
  "QUOTE_FEED_HASH",
  "SWITCHBOARD_QUOTE_VERIFIER"
];
const PLACEHOLDER_WORDS = new Set([
  "ADDRESS",
  "ASSET",
  "COIN",
  "DIGEST",
  "FEED",
  "HASH",
  "HOLDER",
  "ID",
  "OBJECT",
  "PACKAGE",
  "POOL",
  "PROOF",
  "STATE",
  "TOKEN",
  "VERIFIER"
]);

function usage() {
  console.error(
    [
      "Usage: node tools/validate-launch-matrix.mjs --config <file> [--launch-config <file>] [--require-live-values]",
      "",
      "Validates a serializable BrownFi launch route/quote matrix offline and prints coverage JSON."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") {
      args.config = argv[++i];
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

  if (!args.config) {
    usage();
    process.exit(2);
  }

  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function sortedSet(values) {
  return [...new Set(values)].sort();
}

function assertStringArray(config, key) {
  const value = config[key] ?? [];
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`Launch matrix config field '${key}' must be an array of non-empty strings`);
  }
  return value;
}

function assertOptionalString(config, key) {
  const value = config[key];
  if (value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Launch matrix config field '${key}' must be a non-empty string when present`);
  }
  return value;
}

function configPathPart(parent, key) {
  return typeof key === "number" ? `${parent}[${key}]` : (parent ? `${parent}.${key}` : key);
}

function placeholderString(value) {
  if (PLACEHOLDER_TOKENS.some((token) => value.includes(token))) {
    return true;
  }
  const normalized = value.startsWith("0x") ? value.slice(2) : value;
  if (/^[A-Z0-9]+(?:_[A-Z0-9]+)+$/.test(normalized)) {
    const parts = normalized.split("_");
    if (parts.some((part) => PLACEHOLDER_WORDS.has(part))) {
      return true;
    }
  }
  return /^0x[A-Z0-9_]*[G-Z_][A-Z0-9_]*$/.test(value);
}

function assertNoPlaceholderValues(value, pathName = "") {
  if (typeof value === "string") {
    if (placeholderString(value)) {
      throw new Error(`Launch matrix config contains placeholder value at ${pathName}: ${value}`);
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPlaceholderValues(item, configPathPart(pathName, index)));
    return;
  }
  if (typeof value === "object" && value !== null) {
    for (const [key, item] of Object.entries(value)) {
      assertNoPlaceholderValues(item, configPathPart(pathName, key));
    }
  }
}

function loadConfig(configPath, options = {}) {
  const config = readJson(configPath);
  if (options.requireLiveValues) {
    assertNoPlaceholderValues(config);
  }
  const providerIds = assertStringArray(config, "providerIds");
  if (providerIds.length === 0) {
    throw new Error("Launch matrix config must declare at least one provider ID");
  }
  return {
    network: assertOptionalString(config, "network"),
    providerIds,
    ammProviderIds: assertStringArray(config, "ammProviderIds"),
    routeLimits: config.routeLimits,
    routeCases: config.routeCases,
    quoteCases: config.quoteCases
  };
}

function loadLaunchConfigProviderSelection(launchConfigPath) {
  const launchConfig = readJson(launchConfigPath);
  const providerIds = assertStringArray(launchConfig, "providerIds");
  if (providerIds.length === 0) {
    throw new Error("Launch config must declare at least one provider ID when used for matrix validation");
  }
  return {
    providerIds,
    ammProviderIds: assertStringArray(launchConfig, "ammProviderIds")
  };
}

function assertProviderIdsMatchLaunchConfig(matrixProviderIds, launchProviderIds, fieldName = "providerIds") {
  const matrixSet = sortedSet(matrixProviderIds);
  const launchSet = sortedSet(launchProviderIds);
  if (
    matrixSet.length !== launchSet.length ||
    matrixSet.some((providerId, index) => providerId !== launchSet[index])
  ) {
    throw new Error(
      `Launch matrix ${fieldName} must match launch config ${fieldName}: matrix=${matrixSet.join(",")} launch=${launchSet.join(",")}`
    );
  }
}

export function loadLaunchMatrixConfigFile({ config, launchConfig, requireLiveValues = false }) {
  if (!config) throw new Error("Missing launch matrix config path");
  const configPath = path.resolve(config);
  const matrixConfig = loadConfig(configPath, { requireLiveValues });
  if (launchConfig) {
    const launchProviderSelection = loadLaunchConfigProviderSelection(path.resolve(launchConfig));
    assertProviderIdsMatchLaunchConfig(
      matrixConfig.providerIds,
      launchProviderSelection.providerIds
    );
    assertProviderIdsMatchLaunchConfig(
      matrixConfig.ammProviderIds,
      launchProviderSelection.ammProviderIds,
      "ammProviderIds"
    );
  }
  return matrixConfig;
}

export function validateLaunchMatrixConfigFile({ config, launchConfig, requireLiveValues = false }) {
  return validateLaunchValidationMatrixConfig(
    {
      ...loadLaunchMatrixConfigFile({ config, launchConfig, requireLiveValues }),
      requireProviderMetadata: requireLiveValues
    }
  );
}

function main() {
  const summary = validateLaunchMatrixConfigFile(parseArgs(process.argv.slice(2)));
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
