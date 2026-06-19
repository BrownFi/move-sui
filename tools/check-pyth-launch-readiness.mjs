#!/usr/bin/env node

import fs from "node:fs";
import { fileURLToPath } from "node:url";

import { checkSuiGasReadiness } from "./check-sui-gas-readiness.mjs";
import { validatePythLaunchRuntimeConfigFile } from "./validate-pyth-launch-runtime.mjs";

const DEFAULT_PRIVATE_KEY_ENV = "BROWNFI_SUI_PRIVATE_KEY";
const DEFAULT_RPC_URL_ENV = "BROWNFI_SUI_RPC_URL";
const DEFAULT_SENDER_ADDRESS_ENV = "BROWNFI_SUI_SENDER";
const REQUIRED_NODE_MAJOR = "24";
const SUI_KEY_SCHEME_ED25519_FLAG = 0;

function usage() {
  console.error(
    [
      "Usage: node tools/check-pyth-launch-readiness.mjs --runtime-config <file> --manifest <file> [--matrix <file>] [--launch-config <file>]",
      "       [--require-submit-signer] [--check-gas --active-address <address> [--rpc-url <url>] [--min-gas-mist <n>] [--use-rtk]]",
      "",
      "Checks Pyth-only BrownFi launch runtime prerequisites before live provider preflight or submission."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {
    requireLiveValues: true,
    checkDependencyImports: true,
    checkNodeEngine: true
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--runtime-config") {
      args.runtimeConfig = argv[++i];
    } else if (arg === "--manifest") {
      args.manifest = argv[++i];
    } else if (arg === "--matrix") {
      args.matrix = argv[++i];
    } else if (arg === "--launch-config") {
      args.launchConfig = argv[++i];
    } else if (arg === "--allow-placeholders") {
      args.requireLiveValues = false;
    } else if (arg === "--require-submit-signer") {
      args.requireSubmitSigner = true;
    } else if (arg === "--skip-node-engine-check") {
      args.checkNodeEngine = false;
    } else if (arg === "--skip-dependency-imports") {
      args.checkDependencyImports = false;
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

  if (!args.runtimeConfig || !args.manifest) {
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

function optionalString(value, label) {
  if (value === undefined) return undefined;
  return requireString(value, label);
}

function loadRuntimeConfigForReadiness(file) {
  const config = requireRecord(readJson(file), "Pyth launch runtime config");
  return {
    network: requireString(config.network, "Pyth launch runtime config network"),
    privateKeyEnv: optionalString(
      config.privateKeyEnv,
      "Pyth launch runtime config privateKeyEnv"
    ),
    suiKeystorePath: optionalString(
      config.suiKeystorePath,
      "Pyth launch runtime config suiKeystorePath"
    ),
    suiKeystorePathEnv: optionalString(
      config.suiKeystorePathEnv,
      "Pyth launch runtime config suiKeystorePathEnv"
    ),
    suiKeystoreAddress: optionalString(
      config.suiKeystoreAddress,
      "Pyth launch runtime config suiKeystoreAddress"
    ),
    suiKeystoreAddressEnv: optionalString(
      config.suiKeystoreAddressEnv,
      "Pyth launch runtime config suiKeystoreAddressEnv"
    ),
    rpcUrl: optionalString(config.rpcUrl, "Pyth launch runtime config rpcUrl"),
    rpcUrlEnv: optionalString(config.rpcUrlEnv, "Pyth launch runtime config rpcUrlEnv"),
    senderAddress: optionalString(
      config.senderAddress,
      "Pyth launch runtime config senderAddress"
    ),
    senderAddressEnv: optionalString(
      config.senderAddressEnv,
      "Pyth launch runtime config senderAddressEnv"
    )
  };
}

function envValue(env, key) {
  return key === undefined ? undefined : env[key];
}

function assertNodeEngine(nodeVersion) {
  const match = String(nodeVersion).match(/^v?(\d+)\./);
  if (match === null) {
    throw new Error(`Unable to parse Node version: ${nodeVersion}`);
  }
  if (match[1] !== REQUIRED_NODE_MAJOR) {
    throw new Error(
      `Pyth launch runtime requires Node major ${REQUIRED_NODE_MAJOR}; got ${nodeVersion}`
    );
  }
  return {
    status: "success",
    requiredMajor: REQUIRED_NODE_MAJOR,
    actualVersion: String(nodeVersion)
  };
}

function requireExport(module, name, packageName) {
  if (module?.[name] === undefined) {
    throw new Error(`${packageName} must export ${name}`);
  }
  return module[name];
}

async function checkDependencyImports(importModule) {
  const [
    suiClientModule,
    transactionModule,
    ed25519Module,
    cryptographyModule,
    utilsModule,
    pythSuiModule
  ] =
    await Promise.all([
      importModule("@mysten/sui/client"),
      importModule("@mysten/sui/transactions"),
      importModule("@mysten/sui/keypairs/ed25519"),
      importModule("@mysten/sui/cryptography"),
      importModule("@mysten/sui/utils"),
      importModule("@pythnetwork/pyth-sui-js")
    ]);

  requireExport(suiClientModule, "SuiClient", "@mysten/sui/client");
  requireExport(suiClientModule, "getFullnodeUrl", "@mysten/sui/client");
  requireExport(transactionModule, "Transaction", "@mysten/sui/transactions");
  requireExport(ed25519Module, "Ed25519Keypair", "@mysten/sui/keypairs/ed25519");
  requireExport(cryptographyModule, "decodeSuiPrivateKey", "@mysten/sui/cryptography");
  requireExport(utilsModule, "fromB64", "@mysten/sui/utils");
  requireExport(pythSuiModule, "SuiPythClient", "@pythnetwork/pyth-sui-js");
  requireExport(pythSuiModule, "SuiPriceServiceConnection", "@pythnetwork/pyth-sui-js");

  return {
    status: "success",
    packages: [
      "@mysten/sui/client",
      "@mysten/sui/transactions",
      "@mysten/sui/keypairs/ed25519",
      "@mysten/sui/cryptography",
      "@mysten/sui/utils",
      "@pythnetwork/pyth-sui-js"
    ]
  };
}

async function addressFromSuiKeystoreEntry(entry, importModule) {
  const [ed25519Module, utilsModule] = await Promise.all([
    importModule("@mysten/sui/keypairs/ed25519"),
    importModule("@mysten/sui/utils")
  ]);
  const Ed25519Keypair = requireExport(
    ed25519Module,
    "Ed25519Keypair",
    "@mysten/sui/keypairs/ed25519"
  );
  const fromB64 = requireExport(utilsModule, "fromB64", "@mysten/sui/utils");
  const bytes = fromB64(entry);
  if (bytes.length !== 33) {
    throw new Error("Sui CLI keystore entries must decode to 33 bytes");
  }
  if (bytes[0] !== SUI_KEY_SCHEME_ED25519_FLAG) {
    throw new Error("Pyth launch readiness currently supports ED25519 Sui keystore keys only");
  }
  return Ed25519Keypair.fromSecretKey(bytes.slice(1)).getPublicKey().toSuiAddress();
}

async function checkSuiKeystoreSigner(runtime, env, importModule) {
  const keystorePath =
    runtime.suiKeystorePath ?? envValue(env, runtime.suiKeystorePathEnv);
  if (keystorePath === undefined) return undefined;
  const targetAddress =
    runtime.suiKeystoreAddress ??
    envValue(env, runtime.suiKeystoreAddressEnv) ??
    runtime.senderAddress ??
    envValue(env, runtime.senderAddressEnv ?? DEFAULT_SENDER_ADDRESS_ENV);
  const entries = JSON.parse(fs.readFileSync(keystorePath, "utf8"));
  if (!Array.isArray(entries)) {
    throw new Error("Sui CLI keystore file must contain an array");
  }
  if (targetAddress === undefined && entries.length !== 1) {
    throw new Error("Pyth launch readiness Sui keystore signer requires a configured address");
  }
  for (const entry of entries) {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error("Sui CLI keystore entries must be non-empty strings");
    }
    const address = await addressFromSuiKeystoreEntry(entry, importModule);
    if (targetAddress === undefined || address === targetAddress) {
      return {
        status: "success",
        signerSource: "sui-keystore",
        address
      };
    }
  }
  throw new Error(`Pyth launch readiness Sui keystore has no signer for ${targetAddress}`);
}

async function checkSubmitSigner(runtime, env, requireSubmitSigner, importModule) {
  if (requireSubmitSigner !== true) {
    return {
      status: "skipped"
    };
  }
  const privateKeyEnv = runtime.privateKeyEnv ?? DEFAULT_PRIVATE_KEY_ENV;
  const privateKey = envValue(env, privateKeyEnv);
  if (typeof privateKey === "string" && privateKey.length > 0) {
    return {
      status: "success",
      signerSource: "env-private-key",
      privateKeyEnv
    };
  }
  const keystoreSigner = await checkSuiKeystoreSigner(runtime, env, importModule);
  if (keystoreSigner !== undefined) return keystoreSigner;
  throw new Error(`Pyth launch readiness requires ${privateKeyEnv} to be set for submit`);
}

function maybeCheckGas(runtime, env, gasReadiness) {
  if (gasReadiness === undefined) {
    return {
      status: "skipped"
    };
  }
  return checkSuiGasReadiness({
    network: runtime.network,
    activeAddress:
      gasReadiness.activeAddress ??
      runtime.senderAddress ??
      envValue(env, runtime.senderAddressEnv ?? DEFAULT_SENDER_ADDRESS_ENV),
    rpcUrl:
      gasReadiness.rpcUrl ??
      runtime.rpcUrl ??
      envValue(env, runtime.rpcUrlEnv ?? DEFAULT_RPC_URL_ENV),
    minMist: gasReadiness.minMist,
    useRtk: gasReadiness.useRtk,
    execFileSync: gasReadiness.execFileSync
  });
}

export async function checkPythLaunchReadiness({
  runtimeConfig,
  manifest,
  matrix,
  launchConfig,
  requireLiveValues = true,
  requireSubmitSigner = false,
  checkNodeEngine = true,
  checkDependencyImports: shouldCheckDependencyImports = true,
  nodeVersion = process.version,
  env = process.env,
  importModule = (specifier) => import(specifier),
  gasReadiness
}) {
  if (!runtimeConfig) throw new Error("Missing Pyth launch runtime config path");
  if (!manifest) throw new Error("Missing Pyth Sui contract manifest path");

  const runtime = loadRuntimeConfigForReadiness(runtimeConfig);
  const validation = validatePythLaunchRuntimeConfigFile({
    runtimeConfig,
    manifest,
    matrix,
    launchConfig,
    requireLiveValues,
    env
  });
  const node = checkNodeEngine
    ? assertNodeEngine(nodeVersion)
    : {
        status: "skipped"
      };
  const gas = maybeCheckGas(runtime, env, gasReadiness);
  const dependencies = shouldCheckDependencyImports
    ? await checkDependencyImports(importModule)
    : {
        status: "skipped"
      };
  const submitSigner = await checkSubmitSigner(
    runtime,
    env,
    requireSubmitSigner,
    importModule
  );

  return {
    status: "success",
    network: validation.network,
    providerId: validation.providerId,
    contractSet: validation.contractSet,
    matrixCaseCount: validation.matrixCaseCount,
    feedIdCount: validation.feedIdCount,
    pythPackageId: validation.pythPackageId,
    node,
    dependencies,
    submitSigner,
    gas
  };
}

async function main() {
  const summary = await checkPythLaunchReadiness(parseArgs(process.argv.slice(2)));
  console.log(JSON.stringify(summary, null, 2));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    await main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
