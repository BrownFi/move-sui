#!/usr/bin/env node

import { execFileSync as defaultExecFileSync } from "node:child_process";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { buildLaunchPackage } from "./build-launch-package.mjs";
import { checkSuiGasReadiness } from "./check-sui-gas-readiness.mjs";
import { extractLaunchPublishObjects } from "./extract-launch-publish-objects.mjs";

function usage() {
  console.error(
    [
      "Usage: node tools/publish-launch-package.mjs --config <file> --network <network> [--out <dir>] [--root <dir>] [--use-rtk]",
      "       [--gas-budget <mist>] [--expected-dependency <object-id>]... [--expected-module <module>]...",
      "       [--check-gas --active-address <address> [--rpc-url <url>] [--min-gas-mist <n>]]",
      "",
      "Builds a BrownFi launch package variant, publishes it to Sui, and prints the package ID evidence."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {
    root: process.cwd(),
    gasBudget: "2000000000",
    expectedDependencyIds: [],
    expectedModules: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") {
      args.config = argv[++i];
    } else if (arg === "--network") {
      args.network = argv[++i];
    } else if (arg === "--out") {
      args.out = argv[++i];
    } else if (arg === "--root") {
      args.root = argv[++i];
    } else if (arg === "--gas-budget") {
      args.gasBudget = argv[++i];
    } else if (arg === "--expected-dependency") {
      args.expectedDependencyIds.push(argv[++i]);
    } else if (arg === "--expected-module") {
      args.expectedModules.push(argv[++i]);
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

  if (!args.config || !args.network) {
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

function defaultOutDir(config) {
  const suffix = path.basename(config, path.extname(config));
  return path.join(os.tmpdir(), `brownfi-${suffix}-publish`);
}

function publishArgs({ network, gasBudget, out }) {
  return [
    "client",
    "--client.env",
    requireString(network, "Sui publish network"),
    "publish",
    "--allow-dirty",
    "--with-unpublished-dependencies",
    "--json",
    "--silence-warnings",
    "--gas-budget",
    requireString(gasBudget, "Sui publish gasBudget"),
    requireString(out, "Sui publish package path")
  ];
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
    throw new Error(`Sui publish failed: ${status ?? "missing status"}${error ? ` ${error}` : ""}`);
  }
}

function publishedChange(result) {
  const changes = Array.isArray(result?.objectChanges) ? result.objectChanges : [];
  const published = changes.find((change) => change?.type === "published");
  if (published === undefined) {
    throw new Error("Sui publish did not return a published object change");
  }
  return published;
}

function publishDependencies(result) {
  const txs =
    result?.input?.transaction?.transactions ??
    result?.transaction?.data?.transaction?.transactions;
  if (!Array.isArray(txs)) return [];
  for (const tx of txs) {
    if (Array.isArray(tx?.Publish)) {
      return tx.Publish.filter((dependency) => typeof dependency === "string");
    }
  }
  return [];
}

function assertIncludesAll(actual, expected, label) {
  for (const item of expected) {
    if (!actual.includes(item)) {
      throw new Error(`Sui publish missing expected ${label} ${item}`);
    }
  }
}

export function publishLaunchPackage({
  root = process.cwd(),
  config,
  out = defaultOutDir(config),
  network,
  gasBudget = "2000000000",
  expectedDependencyIds = [],
  expectedModules = [],
  gasReadiness,
  useRtk = false,
  execFileSync = defaultExecFileSync
}) {
  if (!config) throw new Error("Missing launch package config path");
  requireString(network, "Sui publish network");
  requireStringArray(expectedDependencyIds, "Sui publish expectedDependencyIds");
  requireStringArray(expectedModules, "Sui publish expectedModules");

  buildLaunchPackage({
    root,
    config,
    out,
    force: true
  });
  maybeCheckGasReadiness({ network, gasReadiness, useRtk, execFileSync });

  const result = JSON.parse(
    runPublish(execFileSync, {
      network,
      gasBudget,
      out,
      useRtk
    })
  );
  assertPublishSucceeded(result);

  const published = publishedChange(result);
  const modules = requireStringArray(published.modules, "Sui publish published modules");
  const dependencies = publishDependencies(result);
  assertIncludesAll(modules, expectedModules, "module");
  assertIncludesAll(dependencies, expectedDependencyIds, "dependency");

  return {
    config,
    network,
    status: "success",
    transactionDigest: requireString(result.effects.transactionDigest, "Sui publish transaction digest"),
    packageId: requireString(published.packageId, "Sui publish package ID"),
    modules,
    dependencies,
    publishObjects: extractLaunchPublishObjects(result)
  };
}

function main() {
  const summary = publishLaunchPackage(parseArgs(process.argv.slice(2)));
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
