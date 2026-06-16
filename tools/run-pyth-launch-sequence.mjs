#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { createPythLaunchPoolConfig } from "./create-pyth-launch-pool.mjs";
import { materializeLaunchMatrix } from "./materialize-launch-matrix.mjs";
import { materializePythLaunchPoolConfig } from "./materialize-pyth-launch-pool.mjs";
import { publishLaunchPackage } from "./publish-launch-package.mjs";
import { publishLaunchTestCoins } from "./publish-launch-test-coins.mjs";
import { submitLaunchMatrixRoutesConfigFile } from "./run-launch-matrix-submit.mjs";
import { verifySuiTxEvidence } from "./verify-sui-cli-tx-evidence.mjs";

const DEFAULT_LAUNCH_CONFIG = "configs/launch/pyth-current-testnet.json";
const DEFAULT_POOL_TEMPLATE = "configs/launch/pyth-current-testnet.pool.example.json";
const DEFAULT_MATRIX_TEMPLATE = "configs/launch/pyth-current-testnet.matrix.example.json";

function usage() {
  console.error(
    [
      "Usage: node tools/run-pyth-launch-sequence.mjs --network <network> --feeds <file> --runtime <module> --out-dir <dir>",
      "       [--launch-config <file>] [--pool-template <file>] [--matrix-template <file>] [--root <dir>]",
      "       [--test-coin-package-path <dir>] [--package-out <dir>] [--runtime-config <file>] [--use-rtk]",
      "       [--resume-existing-artifacts]",
      "       [--test-coin-gas-budget <mist>] [--package-gas-budget <mist>]",
      "       [--expected-dependency <object-id>]... [--expected-module <module>]...",
      "       [--check-gas --active-address <address> [--rpc-url <url>] [--min-gas-mist <n>]]",
      "       [--verify-tx-evidence [--tx-evidence-rpc-url <url>] [--tx-evidence-use-rtk] [--tx-evidence-rpc-retries <n>] [--tx-evidence-rpc-retry-delay-ms <n>]]",
      "",
      "Publishes BrownFi launch test coins and a Pyth-backed BrownFi package, creates a pool, then submits the launch route matrix."
    ].join("\n")
  );
}

export function parsePythLaunchSequenceArgs(argv) {
  const args = {
    root: process.cwd(),
    launchConfig: DEFAULT_LAUNCH_CONFIG,
    poolTemplate: DEFAULT_POOL_TEMPLATE,
    matrixTemplate: DEFAULT_MATRIX_TEMPLATE,
    feeds: [],
    expectedDependencyIds: [],
    expectedModules: []
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--network") {
      args.network = argv[++i];
    } else if (arg === "--feeds" || arg === "--feed-values") {
      args.feeds.push(argv[++i]);
    } else if (arg === "--runtime") {
      args.runtime = argv[++i];
    } else if (arg === "--runtime-config") {
      args.runtimeConfig = argv[++i];
    } else if (arg === "--out-dir") {
      args.outDir = argv[++i];
    } else if (arg === "--launch-config") {
      args.launchConfig = argv[++i];
    } else if (arg === "--pool-template") {
      args.poolTemplate = argv[++i];
    } else if (arg === "--matrix-template") {
      args.matrixTemplate = argv[++i];
    } else if (arg === "--root") {
      args.root = argv[++i];
    } else if (arg === "--test-coin-package-path") {
      args.testCoinPackagePath = argv[++i];
    } else if (arg === "--package-out") {
      args.packageOut = argv[++i];
    } else if (arg === "--test-coin-gas-budget") {
      args.testCoinGasBudget = argv[++i];
    } else if (arg === "--package-gas-budget") {
      args.packageGasBudget = argv[++i];
    } else if (arg === "--expected-dependency") {
      args.expectedDependencyIds.push(argv[++i]);
    } else if (arg === "--expected-module") {
      args.expectedModules.push(argv[++i]);
    } else if (arg === "--use-rtk") {
      args.useRtk = true;
    } else if (arg === "--resume-existing-artifacts") {
      args.resumeExistingArtifacts = true;
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
    } else if (arg === "--verify-tx-evidence") {
      args.txEvidenceVerification = args.txEvidenceVerification ?? {};
    } else if (arg === "--tx-evidence-rpc-url") {
      args.txEvidenceVerification = args.txEvidenceVerification ?? {};
      args.txEvidenceVerification.rpcUrl = argv[++i];
    } else if (arg === "--tx-evidence-use-rtk") {
      args.txEvidenceVerification = args.txEvidenceVerification ?? {};
      args.txEvidenceVerification.useRtk = true;
    } else if (arg === "--tx-evidence-rpc-retries") {
      args.txEvidenceVerification = args.txEvidenceVerification ?? {};
      args.txEvidenceVerification.rpcRetries = argv[++i];
    } else if (arg === "--tx-evidence-rpc-retry-delay-ms") {
      args.txEvidenceVerification = args.txEvidenceVerification ?? {};
      args.txEvidenceVerification.rpcRetryDelayMs = argv[++i];
    } else if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }

  if (!args.network || args.feeds.length === 0 || !args.runtime || !args.outDir) {
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

function optionalStringArray(value, label) {
  if (value === undefined) return [];
  return requireStringArray(value, label);
}

function valuesFiles(value, label) {
  if (Array.isArray(value)) return requireStringArray(value, label);
  return [requireString(value, label)];
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function readSuccessfulArtifact(file, label) {
  if (!fs.existsSync(file)) return undefined;
  const artifact = readJson(file);
  if (artifact?.status !== "success") {
    throw new Error(`${label} at ${file} is not a successful artifact`);
  }
  return artifact;
}

function submitGasReadiness(gasReadiness, useRtk) {
  if (gasReadiness === undefined) return undefined;
  if (!useRtk) return { ...gasReadiness };
  return {
    ...gasReadiness,
    useRtk: true
  };
}

function defaultDependencies() {
  return {
    publishLaunchTestCoins,
    publishLaunchPackage,
    materializePythLaunchPoolConfig,
    createPythLaunchPoolConfig,
    materializeLaunchMatrix,
    submitLaunchMatrixRoutesConfigFile,
    verifySuiTxEvidence
  };
}

function setupEvidenceForLaunch({ testCoins, brownfiPublish, poolCreate }) {
  const evidence = {
    testCoins: {
      packageId: requireString(testCoins.packageId, "Pyth launch test coin package ID"),
      digest: requireString(
        testCoins.transactionDigest,
        "Pyth launch test coin transaction digest"
      )
    },
    brownfiPackage: {
      packageId: requireString(brownfiPublish.packageId, "Pyth launch BrownFi package ID"),
      digest: requireString(
        brownfiPublish.transactionDigest,
        "Pyth launch BrownFi package transaction digest"
      )
    },
    pool: {
      objectId: requireString(poolCreate.pool, "Pyth launch pool object ID"),
      digest: requireString(
        poolCreate.txEvidence?.digest ?? poolCreate.transactionDigest,
        "Pyth launch pool transaction digest"
      ),
      lpCoin: requireString(poolCreate.lpCoin, "Pyth launch pool LP coin ID"),
      expectedMoveCalls: optionalStringArray(
        poolCreate.txEvidence?.expectedMoveCalls,
        "Pyth launch pool expectedMoveCalls"
      ),
      expectedEventTypes: optionalStringArray(
        poolCreate.txEvidence?.expectedEventTypes,
        "Pyth launch pool expectedEventTypes"
      )
    }
  };
  if (poolCreate.flashEnable?.txEvidence !== undefined) {
    evidence.flashEnable = {
      digest: requireString(
        poolCreate.flashEnable.txEvidence.digest,
        "Pyth launch flash enable transaction digest"
      ),
      expectedMoveCalls: optionalStringArray(
        poolCreate.flashEnable.txEvidence.expectedMoveCalls,
        "Pyth launch flash enable expectedMoveCalls"
      ),
      expectedEventTypes: optionalStringArray(
        poolCreate.flashEnable.txEvidence.expectedEventTypes,
        "Pyth launch flash enable expectedEventTypes"
      )
    };
  }
  return evidence;
}

function verifySetupEvidence({
  network,
  setupEvidence,
  txEvidenceVerification,
  verifySuiTxEvidence
}) {
  if (txEvidenceVerification === undefined) return undefined;
  return Object.entries(setupEvidence).map(([name, evidence]) =>
    verifySuiTxEvidence({
      network,
      evidence,
      txName: `setup:${name}`,
      rpcUrl: txEvidenceVerification.rpcUrl,
      useRtk: txEvidenceVerification.useRtk,
      rpcRetries: txEvidenceVerification.rpcRetries,
      rpcRetryDelayMs: txEvidenceVerification.rpcRetryDelayMs,
      execFileSync: txEvidenceVerification.execFileSync
    })
  );
}

export async function runPythLaunchSequence({
  root = process.cwd(),
  network,
  launchConfig = DEFAULT_LAUNCH_CONFIG,
  poolTemplate = DEFAULT_POOL_TEMPLATE,
  matrixTemplate = DEFAULT_MATRIX_TEMPLATE,
  feeds,
  runtime,
  runtimeConfig,
  outDir,
  testCoinPackagePath = path.join(root, "packages/launch-test-coins"),
  packageOut,
  testCoinGasBudget,
  packageGasBudget,
  expectedDependencyIds = [],
  expectedModules = [],
  gasReadiness,
  useRtk = false,
  resumeExistingArtifacts = false,
  txEvidenceVerification,
  dependencies = {}
}) {
  const deps = {
    ...defaultDependencies(),
    ...dependencies
  };
  const resolvedRoot = requireString(root, "Pyth launch root");
  const launchValues = valuesFiles(feeds, "Pyth launch feed values");
  const artifacts = {
    testCoins: path.join(requireString(outDir, "Pyth launch output directory"), "test-coins.json"),
    brownfiPublish: path.join(outDir, "brownfi-publish.json"),
    poolConfig: path.join(outDir, "pool.json"),
    poolResult: path.join(outDir, "pool-result.json"),
    matrix: path.join(outDir, "matrix.json"),
    submit: path.join(outDir, "submit.json"),
    summary: path.join(outDir, "summary.json")
  };

  let testCoins = resumeExistingArtifacts
    ? readSuccessfulArtifact(artifacts.testCoins, "Pyth launch test coins")
    : undefined;
  if (testCoins === undefined) {
    testCoins = deps.publishLaunchTestCoins({
      packagePath: testCoinPackagePath,
      network: requireString(network, "Pyth launch network"),
      gasBudget: testCoinGasBudget,
      gasReadiness,
      useRtk
    });
    writeJson(artifacts.testCoins, testCoins);
  }

  let brownfiPublish = resumeExistingArtifacts
    ? readSuccessfulArtifact(artifacts.brownfiPublish, "Pyth launch BrownFi publish")
    : undefined;
  if (brownfiPublish === undefined) {
    brownfiPublish = deps.publishLaunchPackage({
      root: resolvedRoot,
      config: requireString(launchConfig, "Pyth launch package config"),
      out: packageOut ?? path.join(outDir, "package"),
      network,
      gasBudget: packageGasBudget,
      expectedDependencyIds,
      expectedModules,
      gasReadiness,
      useRtk
    });
    writeJson(artifacts.brownfiPublish, brownfiPublish);
  }

  const poolMaterialization = deps.materializePythLaunchPoolConfig({
    template: requireString(poolTemplate, "Pyth launch pool template"),
    values: [artifacts.testCoins, ...launchValues],
    publishObjects: artifacts.brownfiPublish,
    out: artifacts.poolConfig
  });

  let poolCreate = resumeExistingArtifacts
    ? readSuccessfulArtifact(artifacts.poolResult, "Pyth launch pool result")
    : undefined;
  if (poolCreate === undefined) {
    poolCreate = await deps.createPythLaunchPoolConfig({
      config: artifacts.poolConfig,
      runtime: requireString(runtime, "Pyth launch runtime module"),
      runtimeConfig,
      out: artifacts.poolResult
    });
    writeJson(artifacts.poolResult, poolCreate);
  }
  const setupEvidence = setupEvidenceForLaunch({ testCoins, brownfiPublish, poolCreate });
  const setupVerification = verifySetupEvidence({
    network,
    setupEvidence,
    txEvidenceVerification,
    verifySuiTxEvidence: deps.verifySuiTxEvidence
  });

  const matrixMaterialization = deps.materializeLaunchMatrix({
    template: requireString(matrixTemplate, "Pyth launch matrix template"),
    values: [artifacts.testCoins, ...launchValues],
    out: artifacts.matrix,
    publishResult: artifacts.brownfiPublish,
    poolResult: artifacts.poolResult,
    launchConfig
  });

  const submit = await deps.submitLaunchMatrixRoutesConfigFile({
    config: artifacts.matrix,
    launchConfig,
    runtime,
    runtimeConfig,
    out: artifacts.submit,
    resumeFrom: artifacts.submit,
    gasReadiness: submitGasReadiness(gasReadiness, useRtk),
    txEvidenceVerification
  });
  writeJson(artifacts.submit, submit);

  const report = {
    status: "success",
    network,
    artifacts,
    results: {
      testCoins,
      brownfiPublish,
      poolMaterialization,
      poolCreate,
      setupEvidence,
      setupVerification,
      matrixMaterialization,
      submit
    }
  };
  writeJson(artifacts.summary, report);
  return report;
}

async function main() {
  const report = await runPythLaunchSequence(parsePythLaunchSequenceArgs(process.argv.slice(2)));
  console.log(JSON.stringify(report, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
