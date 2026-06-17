#!/usr/bin/env node

import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { runLaunchValidationMatrixPreflight } from "../sdk/router/dist/index.js";
import {
  loadLaunchMatrixConfigFile,
  validateLaunchMatrixConfigFile
} from "./validate-launch-matrix.mjs";
import { checkSuiGasReadiness } from "./check-sui-gas-readiness.mjs";

function usage() {
  console.error(
    [
      "Usage: node tools/run-launch-matrix-preflight.mjs --config <file> [--launch-config <file>] --runtime <module>",
      "       node tools/run-launch-matrix-preflight.mjs --config <file> [--launch-config <file>] --runtime <module> --check-gas --active-address <address> [--rpc-url <url>] [--min-gas-mist <n>] [--use-rtk]",
      "       add --quote-only to dry-run only quote cases from a mixed matrix",
      "",
      "Runs a live-ready BrownFi launch matrix through a caller-supplied Sui/provider runtime module."
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
    } else if (arg === "--runtime") {
      args.runtime = argv[++i];
    } else if (arg === "--quote-only") {
      args.quoteOnly = true;
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
    } else if (arg === "--use-rtk") {
      args.gasReadiness = args.gasReadiness ?? {};
      args.gasReadiness.useRtk = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.config || !args.runtime) {
    usage();
    process.exit(2);
  }

  return args;
}

function maybeCheckGasReadiness(matrixConfig, gasReadiness) {
  if (gasReadiness === undefined) return undefined;
  return checkSuiGasReadiness({
    network: matrixConfig.network,
    activeAddress: gasReadiness.activeAddress,
    rpcUrl: gasReadiness.rpcUrl,
    minMist: gasReadiness.minMist,
    useRtk: gasReadiness.useRtk,
    execFileSync: gasReadiness.execFileSync
  });
}

async function loadRuntime(runtimePath, config) {
  const runtimeUrl = pathToFileURL(path.resolve(runtimePath)).href;
  const runtimeModule = await import(runtimeUrl);
  const createRuntime = runtimeModule.createLaunchMatrixRuntime ?? runtimeModule.default;
  if (typeof createRuntime !== "function") {
    throw new Error("Launch matrix runtime module must export createLaunchMatrixRuntime");
  }
  const runtime = await createRuntime({ config });
  if (runtime === null || typeof runtime !== "object") {
    throw new Error("Launch matrix runtime factory must return an object");
  }
  if (runtime.providerRegistry === undefined) {
    throw new Error("Launch matrix runtime must provide providerRegistry");
  }
  if (runtime.suiClient === undefined) {
    throw new Error("Launch matrix runtime must provide suiClient");
  }
  return runtime;
}

function assertRuntimeNetworkMatchesConfig(runtime, config) {
  if (config.network === undefined) return;
  if (typeof runtime.network !== "string" || runtime.network.length === 0) {
    throw new Error(
      `Launch matrix network ${config.network} requires runtime network to be declared`
    );
  }
  if (runtime.network !== config.network) {
    throw new Error(
      `Launch matrix network ${config.network} does not match runtime network ${runtime.network}`
    );
  }
}

export async function runLaunchMatrixPreflightConfigFile({
  config,
  launchConfig,
  runtime,
  quoteOnly = false,
  gasReadiness
}) {
  if (!config) throw new Error("Missing launch matrix config path");
  if (!runtime) throw new Error("Missing launch matrix runtime module path");

  validateLaunchMatrixConfigFile({ config, launchConfig, requireLiveValues: true });
  const matrixConfig = loadLaunchMatrixConfigFile({ config, launchConfig, requireLiveValues: true });
  maybeCheckGasReadiness(matrixConfig, gasReadiness);
  const launchRuntime = await loadRuntime(runtime, matrixConfig);
  assertRuntimeNetworkMatchesConfig(launchRuntime, matrixConfig);

  const routeCases = quoteOnly ? [] : matrixConfig.routeCases;
  const transferRecipient =
    typeof launchRuntime.sender === "string" && launchRuntime.sender.length > 0
      ? launchRuntime.sender
      : undefined;
  return runLaunchValidationMatrixPreflight({
    providerRegistry: launchRuntime.providerRegistry,
    routeTransactionFactory: launchRuntime.routeTransactionFactory,
    quoteTransactionFactory: launchRuntime.quoteTransactionFactory,
    suiClient: launchRuntime.suiClient,
    routeLimits: matrixConfig.routeLimits,
    transferRecipient,
    routeCases,
    quoteCases: matrixConfig.quoteCases
  });
}

async function main() {
  const report = await runLaunchMatrixPreflightConfigFile(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report.summary, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
