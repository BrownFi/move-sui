#!/usr/bin/env node

import { execFileSync as defaultExecFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { checkSuiGasReadiness } from "./check-sui-gas-readiness.mjs";
import { extractLaunchTestCoins } from "./extract-launch-test-coins.mjs";

function usage() {
  console.error(
    [
      "Usage: node tools/publish-launch-test-coins.mjs --network <network> [--package-path <dir>] [--use-rtk]",
      "       [--gas-budget <mist>] [--check-gas --active-address <address> [--rpc-url <url>] [--min-gas-mist <n>]]",
      "",
      "Publishes the BrownFi launch test-coin package and prints live token/coin replacement values."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {
    packagePath: "packages/launch-test-coins",
    gasBudget: "1000000000"
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--network") {
      args.network = argv[++i];
    } else if (arg === "--package-path") {
      args.packagePath = argv[++i];
    } else if (arg === "--gas-budget") {
      args.gasBudget = argv[++i];
    } else if (arg === "--use-rtk") {
      args.useRtk = true;
    } else if (arg === "--check-gas") {
      args.gasReadiness = args.gasReadiness ?? {};
    } else if (arg === "--active-address") {
      args.gasReadiness = args.gasReadiness ?? {};
      args.gasReadiness.activeAddress = argv[++i];
    } else if (arg === "--rpc-url") {
      args.gasReadiness = args.gasReadiness ?? {};
      args.gasReadiness.rpcUrl = argv[++i];
    } else if (arg === "--min-gas-mist") {
      args.gasReadiness = args.gasReadiness ?? {};
      args.gasReadiness.minMist = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.network) {
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

function publishArgs({ network, gasBudget, packagePath }) {
  return [
    "client",
    "--client.env",
    requireString(network, "Sui test coin publish network"),
    "publish",
    "--allow-dirty",
    "--json",
    "--silence-warnings",
    "--gas-budget",
    requireString(gasBudget, "Sui test coin publish gasBudget"),
    requireString(packagePath, "Sui test coin package path")
  ];
}

function createPublishPackageCopy(packagePath) {
  const source = requireString(packagePath, "Sui test coin package path");
  const parent = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-test-coins-package-"));
  const destination = path.join(parent, path.basename(source));
  fs.cpSync(source, destination, {
    recursive: true,
    filter(sourcePath) {
      return path.basename(sourcePath) !== "Published.toml";
    }
  });
  return destination;
}

function runPublish(execFileSync, options) {
  const args = publishArgs(options);
  const command = options.useRtk ? "rtk" : "sui";
  const commandArgs = options.useRtk ? ["sui", ...args] : args;
  try {
    return execFileSync(command, commandArgs, {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024
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

function maybeCheckGasReadiness({ network, gasReadiness, useRtk, execFileSync }) {
  if (gasReadiness === undefined) return undefined;
  return checkSuiGasReadiness({
    network,
    activeAddress: gasReadiness.activeAddress,
    rpcUrl: gasReadiness.rpcUrl,
    minMist: gasReadiness.minMist,
    useRtk,
    execFileSync
  });
}

function assertPublishSucceeded(result) {
  const status = result?.effects?.status?.status;
  if (status !== "success") {
    const error = result?.effects?.status?.error;
    throw new Error(
      `Sui test coin publish failed: ${status ?? "missing status"}${error ? ` ${error}` : ""}`
    );
  }
}

export function publishLaunchTestCoins({
  packagePath = "packages/launch-test-coins",
  network,
  gasBudget = "1000000000",
  gasReadiness,
  useRtk = false,
  execFileSync = defaultExecFileSync
}) {
  requireString(network, "Sui test coin publish network");
  const resolvedPackagePath = path.resolve(packagePath);
  const publishPackagePath = createPublishPackageCopy(resolvedPackagePath);

  maybeCheckGasReadiness({ network, gasReadiness, useRtk, execFileSync });
  const result = JSON.parse(
    runPublish(execFileSync, {
      network,
      gasBudget,
      packagePath: publishPackagePath,
      useRtk
    })
  );
  assertPublishSucceeded(result);
  return extractLaunchTestCoins(result);
}

function main() {
  const summary = publishLaunchTestCoins(parseArgs(process.argv.slice(2)));
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
