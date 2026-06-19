#!/usr/bin/env node

import { execFileSync as defaultExecFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadLaunchMatrixConfigFile } from "./validate-launch-matrix.mjs";

function usage() {
  console.error(
    [
      "Usage: node tools/verify-sui-cli-dry-run-evidence.mjs --config <file> --case <name> [--use-rtk]",
      "",
      "Runs a configured Sui CLI dry-run evidence check from a BrownFi launch matrix route case."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") {
      args.config = argv[++i];
    } else if (arg === "--case") {
      args.caseName = argv[++i];
    } else if (arg === "--use-rtk") {
      args.useRtk = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.config || !args.caseName) {
    usage();
    process.exit(2);
  }

  return args;
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return value;
}

function findRouteCase(matrixConfig, caseName) {
  const routeCase = (matrixConfig.routeCases ?? []).find((candidate) => candidate.name === caseName);
  if (routeCase === undefined) {
    throw new Error(`Launch matrix route case not found: ${caseName}`);
  }
  return routeCase;
}

function dryRunArgs(network, config) {
  const args = requireStringArray(config.args, "Sui CLI dry-run args");
  const clientArgs = ["client"];
  if (network !== undefined) {
    clientArgs.push("--client.env", requireString(network, "Sui CLI dry-run network"));
  }
  return [
    ...clientArgs,
    "call",
    "--package",
    requireString(config.package, "Sui CLI dry-run package"),
    "--module",
    requireString(config.module, "Sui CLI dry-run module"),
    "--function",
    requireString(config.function, "Sui CLI dry-run function"),
    "--args",
    ...args,
    "--dry-run",
    "--gas-budget",
    requireString(config.gasBudget, "Sui CLI dry-run gasBudget"),
    "--json"
  ];
}

function runSuiDryRun(execFileSync, network, config, useRtk) {
  const args = dryRunArgs(network, config);
  const command = useRtk ? "rtk" : "sui";
  const commandArgs = useRtk ? ["sui", ...args] : args;
  try {
    return execFileSync(command, commandArgs, {
      encoding: "utf8",
      maxBuffer: 16 * 1024 * 1024
    });
  } catch (error) {
    const stdout = error?.stdout ? String(error.stdout).trim() : "";
    const stderr = error?.stderr ? String(error.stderr).trim() : "";
    const detail = [stdout, stderr].filter((part) => part.length > 0).join("\n");
    throw new Error(
      detail.length > 0
        ? `${error instanceof Error ? error.message : String(error)}\n${detail}`
        : error instanceof Error
          ? error.message
          : String(error)
    );
  }
}

function assertDryRunSucceeded(result, caseName) {
  const status = result?.effects?.status?.status;
  if (status !== "success") {
    const error = result?.effects?.status?.error;
    throw new Error(
      `Sui CLI dry-run failed for ${caseName}: ${status ?? "missing status"}${error ? ` ${error}` : ""}`
    );
  }
}

function eventTypes(result) {
  if (!Array.isArray(result.events)) return [];
  return result.events
    .map((event) => event?.type)
    .filter((type) => typeof type === "string" && type.length > 0);
}

function assertExpectedEventsPresent(actualEventTypes, expectedEventTypes) {
  const remaining = new Map();
  for (const eventType of actualEventTypes) {
    remaining.set(eventType, (remaining.get(eventType) ?? 0) + 1);
  }
  for (const expected of expectedEventTypes) {
    const count = remaining.get(expected) ?? 0;
    if (count === 0) {
      throw new Error(`Sui CLI dry-run missing expected event ${expected}`);
    }
    remaining.set(expected, count - 1);
  }
}

export function verifySuiCliDryRunEvidenceConfigFile({
  config,
  caseName,
  useRtk = false,
  execFileSync = defaultExecFileSync
}) {
  if (!config) throw new Error("Missing launch matrix config path");
  if (!caseName) throw new Error("Missing launch matrix route case name");

  const matrixConfig = loadLaunchMatrixConfigFile({ config, requireLiveValues: true });
  const routeCase = findRouteCase(matrixConfig, caseName);
  const dryRunConfig = routeCase.suiCliDryRun;
  if (dryRunConfig === undefined || dryRunConfig === null || typeof dryRunConfig !== "object") {
    throw new Error(`Launch matrix route case ${caseName} has no suiCliDryRun config`);
  }

  const output = runSuiDryRun(execFileSync, matrixConfig.network, dryRunConfig, useRtk);
  const result = JSON.parse(output);
  assertDryRunSucceeded(result, caseName);

  const actualEventTypes = eventTypes(result);
  const expectedEventTypes = dryRunConfig.expectedEventTypes ?? [];
  requireStringArray(expectedEventTypes, "Sui CLI dry-run expectedEventTypes");
  assertExpectedEventsPresent(actualEventTypes, expectedEventTypes);

  return {
    caseName,
    status: "success",
    transactionDigest: requireString(
      result.effects.transactionDigest,
      "Sui CLI dry-run transaction digest"
    ),
    eventTypes: actualEventTypes
  };
}

function main() {
  const summary = verifySuiCliDryRunEvidenceConfigFile(parseArgs(process.argv.slice(2)));
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
