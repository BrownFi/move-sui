#!/usr/bin/env node

import fs from "node:fs";
import { execFileSync as defaultExecFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

import { loadLaunchMatrixConfigFile } from "./validate-launch-matrix.mjs";

function usage() {
  console.error(
    [
      "Usage: node tools/verify-sui-cli-tx-evidence.mjs --config <file> --tx <name> [--use-rtk]",
      "       node tools/verify-sui-cli-tx-evidence.mjs --config <file> --setup <name> [--use-rtk]",
      "       node tools/verify-sui-cli-tx-evidence.mjs --config <file> --all [--use-rtk]",
      "       node tools/verify-sui-cli-tx-evidence.mjs --config <file> --tx <name> --rpc-url <url> [--use-rtk]",
      "       node tools/verify-sui-cli-tx-evidence.mjs --config <file> --tx <name> --tx-json <file>",
      "",
      "Verifies a landed Sui transaction digest from a BrownFi launch matrix txEvidence or setupEvidence entry."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") {
      args.config = argv[++i];
    } else if (arg === "--tx") {
      args.txName = argv[++i];
    } else if (arg === "--setup") {
      args.setupName = argv[++i];
    } else if (arg === "--all") {
      args.all = true;
    } else if (arg === "--tx-json") {
      args.txJsonFile = argv[++i];
    } else if (arg === "--rpc-url") {
      args.rpcUrl = argv[++i];
    } else if (arg === "--use-rtk") {
      args.useRtk = true;
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  const selectorCount = [
    args.txName !== undefined,
    args.setupName !== undefined,
    args.all === true
  ].filter(Boolean).length;
  if (!args.config || selectorCount !== 1) {
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

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return value;
}

function loadTxEvidence(rawConfig, txName) {
  const entries = rawConfig.txEvidence;
  if (!Array.isArray(entries)) {
    throw new Error("Launch matrix config must declare txEvidence entries");
  }
  const entry = entries.find((candidate) => candidate?.name === txName);
  if (entry === undefined) {
    throw new Error(`Launch matrix tx evidence not found: ${txName}`);
  }
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`Launch matrix tx evidence ${txName} must be an object`);
  }
  return entry;
}

function loadSetupEvidence(rawConfig, setupName) {
  const entries = rawConfig.setupEvidence;
  if (entries === null || typeof entries !== "object" || Array.isArray(entries)) {
    throw new Error("Launch matrix config must declare setupEvidence entries");
  }
  const entry = entries[setupName];
  if (entry === undefined) {
    throw new Error(`Launch matrix setup evidence not found: ${setupName}`);
  }
  if (entry === null || typeof entry !== "object" || Array.isArray(entry)) {
    throw new Error(`Launch matrix setup evidence ${setupName} must be an object`);
  }
  return entry;
}

function loadAllEvidence(rawConfig) {
  const entries = [];
  if (rawConfig.setupEvidence !== undefined) {
    const setupEntries = rawConfig.setupEvidence;
    if (
      setupEntries === null ||
      typeof setupEntries !== "object" ||
      Array.isArray(setupEntries)
    ) {
      throw new Error("Launch matrix config setupEvidence must be an object when present");
    }
    for (const [setupName, evidence] of Object.entries(setupEntries)) {
      requireString(setupName, "Launch matrix setup evidence name");
      if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence)) {
        throw new Error(`Launch matrix setup evidence ${setupName} must be an object`);
      }
      entries.push({ txName: `setup:${setupName}`, evidence });
    }
  }

  if (rawConfig.txEvidence !== undefined) {
    const txEntries = rawConfig.txEvidence;
    if (!Array.isArray(txEntries)) {
      throw new Error("Launch matrix config txEvidence must be an array when present");
    }
    for (const evidence of txEntries) {
      if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence)) {
        throw new Error("Launch matrix tx evidence entries must be objects");
      }
      entries.push({
        txName: requireString(evidence.name, "Launch matrix tx evidence name"),
        evidence
      });
    }
  }

  if (entries.length === 0) {
    throw new Error("Launch matrix config must declare setupEvidence or txEvidence entries");
  }
  return entries;
}

function txBlockArgs(network, digest) {
  const args = ["client"];
  if (network !== undefined) {
    args.push("--client.env", network);
  }
  args.push("tx-block", digest, "--json");
  return args;
}

function runSuiTxBlock(execFileSync, network, digest, useRtk) {
  const args = txBlockArgs(network, digest);
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

function rpcPayload(digest) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "sui_getTransactionBlock",
    params: [
      digest,
      {
        showInput: true,
        showEffects: true,
        showEvents: true,
        showObjectChanges: true
      }
    ]
  });
}

function runSuiRpcTxBlock(execFileSync, rpcUrl, digest, useRtk) {
  const args = [
    "-sS",
    "-m",
    "20",
    "-X",
    "POST",
    "-H",
    "content-type:application/json",
    "--data",
    rpcPayload(digest),
    requireString(rpcUrl, "Sui JSON-RPC URL")
  ];
  const command = useRtk ? "rtk" : "curl";
  const commandArgs = useRtk ? ["curl", ...args] : args;
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

function txResultFromRpc(output, txName) {
  const response = JSON.parse(output);
  if (response?.error !== undefined) {
    const code = response.error?.code ?? "unknown";
    const message = response.error?.message ?? "missing message";
    throw new Error(`Sui JSON-RPC tx evidence failed for ${txName}: ${code} ${message}`);
  }
  if (response?.result === undefined) {
    throw new Error(`Sui JSON-RPC tx evidence failed for ${txName}: missing result`);
  }
  return response.result;
}

function nonNegativeInteger(value, label) {
  if (value === undefined) return 0;
  const stringValue = String(value);
  if (!/^[0-9]+$/.test(stringValue)) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return Number(stringValue);
}

function sleepMs(delayMs) {
  if (delayMs <= 0) return;
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, delayMs);
}

function isTransientRpcTxIndexingError(error) {
  const message = error instanceof Error ? error.message : String(error);
  return /could not find the referenced transaction|transaction not found/i.test(message);
}

function txResultFromRpcWithRetry({
  execFileSync,
  rpcUrl,
  digest,
  useRtk,
  txName,
  rpcRetries,
  rpcRetryDelayMs
}) {
  const retries = nonNegativeInteger(rpcRetries, "Sui JSON-RPC tx evidence retry count");
  const delayMs = nonNegativeInteger(
    rpcRetryDelayMs,
    "Sui JSON-RPC tx evidence retry delay"
  );

  for (let attempt = 0; ; attempt += 1) {
    try {
      return txResultFromRpc(runSuiRpcTxBlock(execFileSync, rpcUrl, digest, useRtk), txName);
    } catch (error) {
      if (attempt >= retries || !isTransientRpcTxIndexingError(error)) {
        throw error;
      }
      sleepMs(delayMs);
    }
  }
}

function eventTypes(result) {
  if (!Array.isArray(result.events)) return [];
  return result.events
    .map((event) => event?.type)
    .filter((type) => typeof type === "string" && type.length > 0);
}

function moveCalls(result) {
  const transactions = result?.transaction?.data?.transaction?.transactions;
  if (!Array.isArray(transactions)) return [];
  return transactions
    .map((transaction) => transaction?.MoveCall)
    .filter((call) => call !== undefined && call !== null)
    .map((call) => {
      const pkg = requireString(call.package, "Sui tx MoveCall package");
      const moduleName = requireString(call.module, "Sui tx MoveCall module");
      const functionName = requireString(call.function, "Sui tx MoveCall function");
      return `${pkg}::${moduleName}::${functionName}`;
    });
}

function objectChanges(result) {
  return Array.isArray(result.objectChanges) ? result.objectChanges : [];
}

function assertTxSucceeded(result, txName) {
  const status = result?.effects?.status?.status;
  if (status !== "success") {
    const error = result?.effects?.status?.error;
    throw new Error(
      `Sui CLI tx evidence failed for ${txName}: ${status ?? "missing status"}${error ? ` ${error}` : ""}`
    );
  }
}

function assertTxDigestMatches(result, expectedDigest, txName) {
  const actualDigest = requireString(result?.effects?.transactionDigest, "Sui tx transaction digest");
  if (actualDigest !== expectedDigest) {
    throw new Error(
      `Sui CLI tx evidence ${txName} digest mismatch: expected ${expectedDigest}, got ${actualDigest}`
    );
  }
  return actualDigest;
}

function assertExpectedValues(actual, expected, label, txName) {
  const remaining = new Map();
  for (const item of actual) {
    remaining.set(item, (remaining.get(item) ?? 0) + 1);
  }
  for (const item of expected) {
    const count = remaining.get(item) ?? 0;
    if (count === 0) {
      throw new Error(`Sui CLI tx evidence ${txName} missing expected ${label} ${item}`);
    }
    remaining.set(item, count - 1);
  }
}

function assertExpectedObjectChange(changes, expectedId, label, txName) {
  if (expectedId === undefined) return;
  const id = requireString(expectedId, `Launch matrix tx evidence ${txName} ${label}`);
  const found = changes.some((change) => {
    if (label === "packageId") {
      return change?.type === "published" && change?.packageId === id;
    }
    return change?.objectId === id;
  });
  if (!found) {
    throw new Error(`Sui CLI tx evidence ${txName} missing expected object change ${id}`);
  }
}

function assertExpectedObjectChanges(result, evidence, txName) {
  const changes = objectChanges(result);
  assertExpectedObjectChange(changes, evidence.packageId, "packageId", txName);
  assertExpectedObjectChange(changes, evidence.objectId, "objectId", txName);
  assertExpectedObjectChange(changes, evidence.lpCoin, "lpCoin", txName);
}

export function verifySuiTxEvidence({
  network,
  evidence,
  txName,
  txJsonFile,
  rpcUrl,
  useRtk = false,
  rpcRetries,
  rpcRetryDelayMs,
  execFileSync = defaultExecFileSync
}) {
  if (!txName) throw new Error("Missing launch matrix tx evidence name");
  if (evidence === null || typeof evidence !== "object" || Array.isArray(evidence)) {
    throw new Error(`Launch matrix tx evidence ${txName} must be an object`);
  }
  const digest = requireString(evidence.digest, `Launch matrix tx evidence ${txName} digest`);

  const result = txJsonFile
    ? readJson(txJsonFile)
    : rpcUrl
      ? txResultFromRpcWithRetry({
          execFileSync,
          rpcUrl,
          digest,
          useRtk,
          txName,
          rpcRetries,
          rpcRetryDelayMs
        })
      : JSON.parse(runSuiTxBlock(execFileSync, network, digest, useRtk));
  assertTxSucceeded(result, txName);
  const actualDigest = assertTxDigestMatches(result, digest, txName);

  const actualEventTypes = eventTypes(result);
  const actualMoveCalls = moveCalls(result);
  assertExpectedObjectChanges(result, evidence, txName);
  const expectedEventTypes = evidence.expectedEventTypes ?? [];
  const expectedMoveCalls = evidence.expectedMoveCalls ?? [];
  requireStringArray(expectedEventTypes, `Launch matrix tx evidence ${txName} expectedEventTypes`);
  requireStringArray(expectedMoveCalls, `Launch matrix tx evidence ${txName} expectedMoveCalls`);
  assertExpectedValues(actualEventTypes, expectedEventTypes, "event", txName);
  assertExpectedValues(actualMoveCalls, expectedMoveCalls, "Move call", txName);

  return {
    txName,
    digest: actualDigest,
    status: "success",
    checkpoint: result.checkpoint,
    timestampMs: result.timestampMs,
    moveCalls: actualMoveCalls,
    eventTypes: actualEventTypes
  };
}

export function verifySuiCliTxEvidenceConfigFile({
  config,
  txName,
  setupName,
  all = false,
  txJsonFile,
  rpcUrl,
  useRtk = false,
  rpcRetries,
  rpcRetryDelayMs,
  execFileSync = defaultExecFileSync
}) {
  if (!config) throw new Error("Missing launch matrix config path");
  const selectorCount = [
    txName !== undefined,
    setupName !== undefined,
    all === true
  ].filter(Boolean).length;
  if (selectorCount !== 1) {
    throw new Error("Specify exactly one launch matrix tx evidence name, setup evidence name, or all");
  }

  const matrixConfig = loadLaunchMatrixConfigFile({ config, requireLiveValues: true });
  const rawConfig = readJson(config);
  if (all) {
    if (txJsonFile !== undefined) {
      throw new Error("Cannot verify all launch matrix evidence entries from one tx JSON file");
    }
    return loadAllEvidence(rawConfig).map(({ txName: evidenceName, evidence }) =>
      verifySuiTxEvidence({
        network: matrixConfig.network,
        evidence,
        txName: evidenceName,
        txJsonFile,
        rpcUrl,
        useRtk,
        rpcRetries,
        rpcRetryDelayMs,
        execFileSync
      })
    );
  }

  const evidence =
    setupName === undefined
      ? loadTxEvidence(rawConfig, txName)
      : loadSetupEvidence(rawConfig, setupName);
  const evidenceName = setupName === undefined ? txName : `setup:${setupName}`;
  return verifySuiTxEvidence({
    network: matrixConfig.network,
    evidence,
    txName: evidenceName,
    txJsonFile,
    rpcUrl,
    useRtk,
    rpcRetries,
    rpcRetryDelayMs,
    execFileSync
  });
}

function main() {
  const summary = verifySuiCliTxEvidenceConfigFile(parseArgs(process.argv.slice(2)));
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
