import fs from "node:fs";

import {
  createPythSuiClients,
  createStandardRoutePriceProviderRegistry
} from "../sdk/router/dist/index.js";

const DEFAULT_RUNTIME_CONFIG = "configs/launch/pyth-current-testnet.runtime.example.json";
const DEFAULT_RPC_URL_ENV = "BROWNFI_SUI_RPC_URL";
const DEFAULT_PRIVATE_KEY_ENV = "BROWNFI_SUI_PRIVATE_KEY";
const DEFAULT_SENDER_ADDRESS_ENV = "BROWNFI_SUI_SENDER";
const REQUIRED_NODE_MAJOR = "24";
const SUI_KEY_SCHEME_ED25519_FLAG = 0;

const PYTH_NETWORKS = new Set(["mainnet", "testnet"]);
const PYTH_CONTRACT_SETS = new Set(["current", "upgraded"]);

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

function optionalBool(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean when present`);
  }
  return value;
}

function requireOneOf(value, supported, label) {
  const stringValue = requireString(value, label);
  if (!supported.has(stringValue)) {
    throw new Error(`${label} must be one of: ${Array.from(supported).join(", ")}`);
  }
  return stringValue;
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
}

function loadRuntimeConfig(file) {
  const config = requireRecord(readJson(file), "Pyth launch runtime config");
  const providerId = requireString(
    config.providerId ?? "pyth",
    "Pyth launch runtime config providerId"
  );
  if (providerId !== "pyth") {
    throw new Error("Pyth launch runtime config providerId must be pyth");
  }

  return {
    network: requireOneOf(
      config.network,
      PYTH_NETWORKS,
      "Pyth launch runtime config network"
    ),
    providerId,
    contractSet: requireOneOf(
      config.contractSet,
      PYTH_CONTRACT_SETS,
      "Pyth launch runtime config contractSet"
    ),
    requirePythApiKey:
      optionalBool(
        config.requirePythApiKey,
        "Pyth launch runtime config requirePythApiKey"
      ) ?? false,
    pythApiKeyEnv: optionalString(
      config.pythApiKeyEnv,
      "Pyth launch runtime config pythApiKeyEnv"
    ),
    pythHermesEndpoint: optionalString(
      config.pythHermesEndpoint,
      "Pyth launch runtime config pythHermesEndpoint"
    ),
    pythHermesEndpointEnv: optionalString(
      config.pythHermesEndpointEnv,
      "Pyth launch runtime config pythHermesEndpointEnv"
    ),
    rpcUrl: optionalString(config.rpcUrl, "Pyth launch runtime config rpcUrl"),
    rpcUrlEnv: optionalString(config.rpcUrlEnv, "Pyth launch runtime config rpcUrlEnv"),
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

function resolveRuntimeConfigPath(runtimeConfig, env) {
  return runtimeConfig ?? env.BROWNFI_PYTH_RUNTIME_CONFIG ?? DEFAULT_RUNTIME_CONFIG;
}

function assertMatrixNetworkMatches(runtime, matrixConfig) {
  if (matrixConfig?.network === undefined) return;
  if (matrixConfig.network !== runtime.network) {
    throw new Error(
      `Pyth launch runtime network ${runtime.network} does not match matrix network ${matrixConfig.network}`
    );
  }
}

function requireExport(module, name, packageName) {
  const value = module[name];
  if (value === undefined) {
    throw new Error(`${packageName} must export ${name}`);
  }
  return value;
}

async function loadDefaultDependencies(importModule) {
  try {
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

    const Ed25519Keypair = requireExport(
      ed25519Module,
      "Ed25519Keypair",
      "@mysten/sui/keypairs/ed25519"
    );
    const decodeSuiPrivateKey = requireExport(
      cryptographyModule,
      "decodeSuiPrivateKey",
      "@mysten/sui/cryptography"
    );
    const fromB64 = requireExport(utilsModule, "fromB64", "@mysten/sui/utils");

    return {
      SuiClient: requireExport(suiClientModule, "SuiClient", "@mysten/sui/client"),
      getFullnodeUrl: requireExport(suiClientModule, "getFullnodeUrl", "@mysten/sui/client"),
      Transaction: requireExport(transactionModule, "Transaction", "@mysten/sui/transactions"),
      SuiPriceServiceConnection: requireExport(
        pythSuiModule,
        "SuiPriceServiceConnection",
        "@pythnetwork/pyth-sui-js"
      ),
      SuiPythClient: requireExport(pythSuiModule, "SuiPythClient", "@pythnetwork/pyth-sui-js"),
      keypairFromPrivateKey(privateKey) {
        const decoded = decodeSuiPrivateKey(privateKey);
        if (decoded.schema !== "ED25519") {
          throw new Error("Pyth launch runtime currently supports ED25519 Sui private keys only");
        }
        return Ed25519Keypair.fromSecretKey(decoded.secretKey);
      },
      keypairFromSuiKeystoreEntry(entry) {
        const bytes = fromB64(entry);
        if (bytes.length !== 33) {
          throw new Error("Sui CLI keystore entries must decode to 33 bytes");
        }
        if (bytes[0] !== SUI_KEY_SCHEME_ED25519_FLAG) {
          throw new Error("Pyth launch runtime currently supports ED25519 Sui keystore keys only");
        }
        return Ed25519Keypair.fromSecretKey(bytes.slice(1));
      }
    };
  } catch (error) {
    throw new Error(
      `Pyth launch runtime dependencies are missing or incompatible: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

function signerAddress(signer) {
  const publicKey = signer?.getPublicKey?.();
  const address = publicKey?.toSuiAddress?.();
  return typeof address === "string" && address.length > 0 ? address : undefined;
}

function makeTransactionFactory(Transaction, sender) {
  return () => {
    const tx = new Transaction();
    if (sender !== undefined && typeof tx.setSender === "function") {
      tx.setSender(sender);
    }
    return tx;
  };
}

function loadSuiKeystoreSigners(keystorePath, keypairFromSuiKeystoreEntry) {
  const entries = JSON.parse(fs.readFileSync(keystorePath, "utf8"));
  if (!Array.isArray(entries)) {
    throw new Error("Sui CLI keystore file must contain an array");
  }
  return entries.map((entry, index) => {
    if (typeof entry !== "string" || entry.length === 0) {
      throw new Error(`Sui CLI keystore entry ${index} must be a non-empty string`);
    }
    const signer = keypairFromSuiKeystoreEntry(entry);
    return {
      signer,
      address: signerAddress(signer)
    };
  });
}

function signerFromSuiKeystore({ runtime, env, configuredSender, keypairFromSuiKeystoreEntry }) {
  const keystorePath =
    runtime.suiKeystorePath ?? envValue(env, runtime.suiKeystorePathEnv);
  if (keystorePath === undefined) return undefined;
  const targetAddress =
    runtime.suiKeystoreAddress ??
    envValue(env, runtime.suiKeystoreAddressEnv) ??
    configuredSender;
  const signers = loadSuiKeystoreSigners(keystorePath, keypairFromSuiKeystoreEntry);
  if (targetAddress === undefined) {
    if (signers.length !== 1) {
      throw new Error("Pyth launch runtime Sui keystore signer requires a configured address");
    }
    return signers[0].signer;
  }
  const match = signers.find((entry) => entry.address === targetAddress);
  if (match === undefined) {
    throw new Error(`Pyth launch runtime Sui keystore has no signer for ${targetAddress}`);
  }
  return match.signer;
}

export async function createPythLaunchMatrixRuntime({
  config,
  runtimeConfig,
  env = process.env,
  importModule = (specifier) => import(specifier),
  SuiClient,
  getFullnodeUrl,
  Transaction,
  SuiPriceServiceConnection,
  SuiPythClient,
  keypairFromPrivateKey,
  keypairFromSuiKeystoreEntry,
  nodeVersion = process.version,
  routerSdk = {
    createPythSuiClients,
    createStandardRoutePriceProviderRegistry
  }
} = {}) {
  const runtime = loadRuntimeConfig(resolveRuntimeConfigPath(runtimeConfig, env));
  assertMatrixNetworkMatches(runtime, config);

  let dependencies = {
    SuiClient,
    getFullnodeUrl,
    Transaction,
    SuiPriceServiceConnection,
    SuiPythClient,
    keypairFromPrivateKey,
    keypairFromSuiKeystoreEntry
  };
  if (
    dependencies.SuiClient === undefined ||
    dependencies.getFullnodeUrl === undefined ||
    dependencies.Transaction === undefined ||
    dependencies.SuiPriceServiceConnection === undefined ||
    dependencies.SuiPythClient === undefined ||
    dependencies.keypairFromPrivateKey === undefined ||
    ((runtime.suiKeystorePath !== undefined ||
      envValue(env, runtime.suiKeystorePathEnv) !== undefined) &&
      dependencies.keypairFromSuiKeystoreEntry === undefined)
  ) {
    assertNodeEngine(nodeVersion);
    dependencies = {
      ...dependencies,
      ...(await loadDefaultDependencies(importModule))
    };
  }

  const rpcUrl =
    runtime.rpcUrl ??
    envValue(env, runtime.rpcUrlEnv ?? DEFAULT_RPC_URL_ENV) ??
    dependencies.getFullnodeUrl(runtime.network);
  const suiClient = new dependencies.SuiClient({ url: rpcUrl });
  const configuredSender =
    runtime.senderAddress ??
    envValue(env, runtime.senderAddressEnv ?? DEFAULT_SENDER_ADDRESS_ENV);
  const privateKey = envValue(env, runtime.privateKeyEnv ?? DEFAULT_PRIVATE_KEY_ENV);
  const signer =
    privateKey === undefined
      ? signerFromSuiKeystore({
          runtime,
          env,
          configuredSender,
          keypairFromSuiKeystoreEntry: dependencies.keypairFromSuiKeystoreEntry
        })
      : dependencies.keypairFromPrivateKey(privateKey);
  const sender = configuredSender ?? signerAddress(signer);

  const pythClients = routerSdk.createPythSuiClients({
    SuiPriceServiceConnection: dependencies.SuiPriceServiceConnection,
    SuiPythClient: dependencies.SuiPythClient,
    suiClient,
    network: runtime.network,
    contractSet: runtime.contractSet,
    endpoint:
      runtime.pythHermesEndpoint ??
      envValue(env, runtime.pythHermesEndpointEnv),
    requireApiKey: runtime.requirePythApiKey,
    apiKey: envValue(env, runtime.pythApiKeyEnv)
  });
  const providerRegistry = routerSdk.createStandardRoutePriceProviderRegistry({
    pyth: {
      priceFeedConnection: pythClients.priceFeedConnection,
      pythClient: pythClients.pythClient
    }
  });
  const transactionFactory = makeTransactionFactory(dependencies.Transaction, sender);

  return {
    network: runtime.network,
    sender,
    suiClient,
    priceFeedConnection: pythClients.priceFeedConnection,
    pythClient: pythClients.pythClient,
    pythContractConfig: pythClients.contractConfig,
    providerRegistry,
    poolTransactionFactory: transactionFactory,
    routeTransactionFactory: transactionFactory,
    quoteTransactionFactory: transactionFactory,
    async executeTransaction(tx) {
      if (signer === undefined) {
        throw new Error(
          `Pyth launch runtime submit requires ${runtime.privateKeyEnv ?? DEFAULT_PRIVATE_KEY_ENV} to be set`
        );
      }
      return suiClient.signAndExecuteTransaction({
        signer,
        transaction: tx,
        options: {
          showEffects: true,
          showEvents: true,
          showInput: true,
          showObjectChanges: true
        }
      });
    }
  };
}

export async function createLaunchMatrixRuntime(options = {}) {
  return createPythLaunchMatrixRuntime(options);
}
