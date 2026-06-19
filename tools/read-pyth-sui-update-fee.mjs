#!/usr/bin/env node

import { execFileSync as defaultExecFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { validatePythSuiContractManifestFile } from "./validate-pyth-sui-contracts.mjs";

const DEFAULT_GAS_BUDGET = "10000000";
const DEFAULT_CONTRACT_SET = "current";
const SUPPORTED_NETWORKS = new Set(["mainnet", "testnet"]);
const SUPPORTED_CONTRACT_SETS = new Set(["current", "upgraded"]);

function usage() {
  console.error(
    [
      "Usage: node tools/read-pyth-sui-update-fee.mjs --manifest <file> --network <mainnet|testnet> [--contract-set <current|upgraded>] [--num-updates <n>] [--use-rtk]",
      "",
      "Dev-inspects pyth::get_total_update_fee from the documented Pyth Sui contract manifest.",
      `Defaults --contract-set to ${DEFAULT_CONTRACT_SET}, matching the verified BrownFi current-Pyth launch profile.`
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {
    contractSet: DEFAULT_CONTRACT_SET,
    gasBudget: DEFAULT_GAS_BUDGET,
    numUpdates: 2
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--manifest") {
      args.manifest = argv[++i];
    } else if (arg === "--network") {
      args.network = argv[++i];
    } else if (arg === "--contract-set") {
      args.contractSet = argv[++i];
    } else if (arg === "--num-updates") {
      args.numUpdates = Number(argv[++i]);
    } else if (arg === "--gas-budget") {
      args.gasBudget = argv[++i];
    } else if (arg === "--use-rtk") {
      args.useRtk = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.manifest || !args.network) {
    usage();
    process.exit(2);
  }

  return args;
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function requireSupported(value, supported, label) {
  const text = requireString(value, label);
  if (!supported.has(text)) {
    throw new Error(`${label} must be one of: ${Array.from(supported).join(", ")}`);
  }
  return text;
}

function requirePositiveInteger(value, label) {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer`);
  }
  return value;
}

function manifestContractConfig(manifest, network, contractSet) {
  const config = manifest?.networks?.[network]?.[contractSet];
  if (config === undefined || config === null || typeof config !== "object") {
    throw new Error(`Pyth Sui contract manifest missing ${network}/${contractSet}`);
  }
  return {
    pythPackageId: requireString(
      config.pythPackageId,
      `Pyth Sui contract manifest ${network}/${contractSet}.pythPackageId`
    ),
    pythStateId: requireString(
      config.pythStateId,
      `Pyth Sui contract manifest ${network}/${contractSet}.pythStateId`
    )
  };
}

function devInspectArgs({ network, pythPackageId, pythStateId, numUpdates, gasBudget }) {
  return [
    "client",
    "--client.env",
    network,
    "call",
    "--package",
    pythPackageId,
    "--module",
    "pyth",
    "--function",
    "get_total_update_fee",
    "--args",
    pythStateId,
    String(numUpdates),
    "--dev-inspect",
    "--gas-budget",
    requireString(gasBudget, "Pyth Sui update-fee gasBudget"),
    "--json"
  ];
}

function runSuiDevInspect(execFileSync, options) {
  const args = devInspectArgs(options);
  const command = options.useRtk ? "rtk" : "sui";
  const commandArgs = options.useRtk ? ["sui", ...args] : args;
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

function devInspectStatus(result) {
  return (
    result?.transaction?.effects?.V2?.status ??
    result?.transaction?.effects?.status?.status ??
    result?.effects?.status?.status
  );
}

function devInspectDigest(result) {
  return (
    result?.transaction?.effects?.V2?.transaction_digest ??
    result?.transaction?.effects?.transactionDigest ??
    result?.effects?.transactionDigest
  );
}

function updateFeeInMist(result) {
  const value = result?.command_outputs?.[0]?.returnValues?.[0]?.json;
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    throw new Error("Pyth Sui update-fee dev-inspect did not return a u64 JSON value");
  }
  return value;
}

export function readPythSuiUpdateFee({
  manifest,
  network,
  contractSet = DEFAULT_CONTRACT_SET,
  numUpdates = 2,
  gasBudget = DEFAULT_GAS_BUDGET,
  useRtk = false,
  execFileSync = defaultExecFileSync
}) {
  if (!manifest) throw new Error("Missing Pyth Sui contract manifest path");
  const resolvedNetwork = requireSupported(network, SUPPORTED_NETWORKS, "Pyth Sui network");
  const resolvedContractSet = requireSupported(
    contractSet,
    SUPPORTED_CONTRACT_SETS,
    "Pyth Sui contract set"
  );
  const resolvedNumUpdates = requirePositiveInteger(numUpdates, "Pyth Sui numUpdates");
  const manifestPath = path.resolve(manifest);
  validatePythSuiContractManifestFile({ manifest: manifestPath });
  const contractConfig = manifestContractConfig(
    readJson(manifestPath),
    resolvedNetwork,
    resolvedContractSet
  );

  const output = runSuiDevInspect(execFileSync, {
    network: resolvedNetwork,
    ...contractConfig,
    numUpdates: resolvedNumUpdates,
    gasBudget,
    useRtk
  });
  const result = JSON.parse(output);
  const status = devInspectStatus(result);
  if (status !== "Success" && status !== "success") {
    throw new Error(
      `Pyth Sui update-fee dev-inspect failed for ${resolvedNetwork}/${resolvedContractSet}: ${status ?? "missing status"}`
    );
  }

  return {
    network: resolvedNetwork,
    contractSet: resolvedContractSet,
    numUpdates: resolvedNumUpdates,
    ...contractConfig,
    status: "success",
    transactionDigest: requireString(
      devInspectDigest(result),
      "Pyth Sui update-fee transaction digest"
    ),
    updateFeeInMist: updateFeeInMist(result)
  };
}

function main() {
  const summary = readPythSuiUpdateFee(parseArgs(process.argv.slice(2)));
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
