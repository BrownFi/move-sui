#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  createPoolWithCoinsAndTransferLpToSender,
  fetchAndUpdatePythPriceInfoObjectsFromFeeds,
  setPoolFlashEnabled,
  setPoolFeeTo,
  setPoolProtocolFee
} from "../sdk/router/dist/index.js";
import { extractLaunchPoolCreateObjects } from "./extract-launch-pool-create-objects.mjs";

const PLACEHOLDER_TOKENS = [
  "BROWNFI_PACKAGE",
  "TYPE_A",
  "TYPE_B",
  "FACTORY",
  "POOL_CREATOR_CAP",
  "PAUSE_CAP",
  "FEE_CAP",
  "RISK_CAP",
  "FEE_TO",
  "ORACLE_ADAPTER",
  "BASE_FEED_ID",
  "QUOTE_FEED_ID",
  "INIT_COIN_A",
  "INIT_COIN_B"
];
const PLACEHOLDER_WORDS = new Set([
  "ADAPTER",
  "ADDRESS",
  "ASSET",
  "CAP",
  "COIN",
  "DIGEST",
  "FACTORY",
  "FEED",
  "HASH",
  "HOLDER",
  "ID",
  "OBJECT",
  "ORACLE",
  "PACKAGE",
  "POOL",
  "PROOF",
  "STATE",
  "TOKEN",
  "TYPE",
  "VERIFIER"
]);

function usage() {
  console.error(
    [
      "Usage: node tools/create-pyth-launch-pool.mjs --config <file> --runtime <module> [--runtime-config <file>] [--out <file>]",
      "",
      "Creates a Pyth-backed BrownFi pool, transfers initial LP to the sender, and prints matrix replacement values."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {};

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--config") {
      args.config = argv[++i];
    } else if (arg === "--runtime") {
      args.runtime = argv[++i];
    } else if (arg === "--runtime-config") {
      args.runtimeConfig = argv[++i];
    } else if (arg === "--out") {
      args.out = argv[++i];
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

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
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

function requireFeedIds(value) {
  if (
    !Array.isArray(value) ||
    value.length !== 2 ||
    value.some((item) => typeof item !== "string" || item.length === 0)
  ) {
    throw new Error("Pyth launch pool config feedIds must contain exactly two non-empty strings");
  }
  return value.map((item, index) => requireHexFeedId(item, `Pyth launch pool config feedIds[${index}]`));
}

function requireHexFeedId(value, label) {
  const stringValue = requireString(value, label);
  if (!/^0x[0-9a-fA-F]{64}$/.test(stringValue)) {
    throw new Error(`${label} must be a 32-byte hex feed ID`);
  }
  return stringValue;
}

function requireU8(value, label) {
  if (!Number.isInteger(value) || value < 0 || value > 255) {
    throw new Error(`${label} must be a u8 integer`);
  }
  return value;
}

function requireOptionalBoolean(value, label) {
  if (value === undefined) return false;
  if (typeof value !== "boolean") {
    throw new Error(`${label} must be a boolean when present`);
  }
  return value;
}

function requireOptionalU64(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`${label} must be a positive u64 integer when present`);
  }
  const stringValue = String(value);
  if (!/^[0-9]+$/.test(stringValue)) {
    throw new Error(`${label} must be a positive u64 integer when present`);
  }
  const parsed = BigInt(stringValue);
  if (parsed <= 0n || parsed > 18446744073709551615n) {
    throw new Error(`${label} must be a positive u64 integer when present`);
  }
  return stringValue;
}

function requireOptionalU32(value, label) {
  if (value === undefined) return undefined;
  if (typeof value !== "string" && typeof value !== "number" && typeof value !== "bigint") {
    throw new Error(`${label} must be a u32 integer when present`);
  }
  const stringValue = String(value);
  if (!/^[0-9]+$/.test(stringValue)) {
    throw new Error(`${label} must be a u32 integer when present`);
  }
  const parsed = BigInt(stringValue);
  if (parsed > 4294967295n) {
    throw new Error(`${label} must be a u32 integer when present`);
  }
  return Number(parsed);
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
      throw new Error(
        `Pyth launch pool config contains placeholder value at ${pathName}: ${value}`
      );
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoPlaceholderValues(item, configPathPart(pathName, index)));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      assertNoPlaceholderValues(item, configPathPart(pathName, key));
    }
  }
}

function loadPoolConfig(file) {
  const config = requireRecord(readJson(file), "Pyth launch pool config");
  return {
    network: requireString(config.network, "Pyth launch pool config network"),
    packageId: requireString(config.packageId, "Pyth launch pool config packageId"),
    typeA: requireString(config.typeA, "Pyth launch pool config typeA"),
    typeB: requireString(config.typeB, "Pyth launch pool config typeB"),
    factory: requireString(config.factory, "Pyth launch pool config factory"),
    poolCreatorCap: requireString(
      config.poolCreatorCap,
      "Pyth launch pool config poolCreatorCap"
    ),
    pauseCap: config.pauseCap === undefined
      ? undefined
      : requireString(config.pauseCap, "Pyth launch pool config pauseCap"),
    feeCap: config.feeCap === undefined
      ? undefined
      : requireString(config.feeCap, "Pyth launch pool config feeCap"),
    riskCap: config.riskCap === undefined
      ? undefined
      : requireString(config.riskCap, "Pyth launch pool config riskCap"),
    feeTo: config.feeTo === undefined
      ? undefined
      : requireString(config.feeTo, "Pyth launch pool config feeTo"),
    protocolFee: requireOptionalU32(
      config.protocolFee,
      "Pyth launch pool config protocolFee"
    ),
    oracle: requireString(config.oracle, "Pyth launch pool config oracle"),
    feedIds: requireFeedIds(config.feedIds),
    clock: requireString(config.clock, "Pyth launch pool config clock"),
    initA: requireString(config.initA, "Pyth launch pool config initA"),
    initB: requireString(config.initB, "Pyth launch pool config initB"),
    initAAmount: requireOptionalU64(
      config.initAAmount,
      "Pyth launch pool config initAAmount"
    ),
    initBAmount: requireOptionalU64(
      config.initBAmount,
      "Pyth launch pool config initBAmount"
    ),
    tokenADecimals: requireU8(
      config.tokenADecimals,
      "Pyth launch pool config tokenADecimals"
    ),
    tokenBDecimals: requireU8(
      config.tokenBDecimals,
      "Pyth launch pool config tokenBDecimals"
    ),
    flashEnabled: requireOptionalBoolean(
      config.flashEnabled,
      "Pyth launch pool config flashEnabled"
    )
  };
}

export function loadPythLaunchPoolConfigFile({ config, requireLiveValues = true }) {
  if (!config) throw new Error("Missing Pyth launch pool config path");
  const poolConfig = loadPoolConfig(config);
  if (requireLiveValues) {
    assertNoPlaceholderValues(poolConfig);
  }
  return poolConfig;
}

async function loadRuntime(runtimePath, poolConfig, runtimeConfig) {
  const runtimeUrl = pathToFileURL(path.resolve(runtimePath)).href;
  const runtimeModule = await import(runtimeUrl);
  const createRuntime =
    runtimeModule.createPythLaunchMatrixRuntime ??
    runtimeModule.createLaunchMatrixRuntime ??
    runtimeModule.default;
  if (typeof createRuntime !== "function") {
    throw new Error("Pyth launch pool runtime module must export createLaunchMatrixRuntime");
  }
  const runtime = await createRuntime({ config: poolConfig, runtimeConfig });
  if (runtime === null || typeof runtime !== "object") {
    throw new Error("Pyth launch pool runtime factory must return an object");
  }
  return runtime;
}

function assertRuntimeNetworkMatchesConfig(runtime, config) {
  if (typeof runtime.network !== "string" || runtime.network.length === 0) {
    throw new Error(`Pyth launch pool network ${config.network} requires runtime network`);
  }
  if (runtime.network !== config.network) {
    throw new Error(
      `Pyth launch pool network ${config.network} does not match runtime network ${runtime.network}`
    );
  }
}

function pythStateIdFromRuntime(runtime) {
  const pythStateId =
    runtime.pythContractConfig?.pythStateId ??
    runtime.contractConfig?.pythStateId ??
    runtime.pyth?.contractConfig?.pythStateId;
  if (typeof pythStateId !== "string" || pythStateId.length === 0) {
    throw new Error("Pyth launch pool runtime must provide Pyth contractConfig.pythStateId");
  }
  return pythStateId;
}

function runtimePythClients(runtime) {
  const priceFeedConnection = runtime.priceFeedConnection ?? runtime.pyth?.priceFeedConnection;
  const pythClient = runtime.pythClient ?? runtime.pyth?.pythClient;
  if (priceFeedConnection === undefined) {
    throw new Error("Pyth launch pool runtime must provide priceFeedConnection");
  }
  if (pythClient === undefined) {
    throw new Error("Pyth launch pool runtime must provide pythClient");
  }
  return { priceFeedConnection, pythClient };
}

function runtimePoolTransactionFactory(runtime) {
  const factory =
    runtime.poolTransactionFactory ??
    runtime.transactionFactory ??
    runtime.routeTransactionFactory;
  if (typeof factory !== "function") {
    throw new Error("Pyth launch pool runtime must provide poolTransactionFactory");
  }
  return factory;
}

function assertExecuteTransaction(runtime) {
  if (typeof runtime.executeTransaction !== "function") {
    throw new Error("Pyth launch pool runtime must provide executeTransaction");
  }
}

function assertTransactionSucceeded(result, label) {
  const status = result?.effects?.status?.status;
  if (status !== "success") {
    const error = result?.effects?.status?.error;
    throw new Error(`${label} failed: ${status ?? "missing status"}${error ? ` ${error}` : ""}`);
  }
}

async function missingPythFeedIds(pythClient, feedIds) {
  if (typeof pythClient.getPriceFeedObjectId !== "function") return [];
  const missing = [];
  for (const feedId of feedIds) {
    const objectId = await pythClient.getPriceFeedObjectId(feedId);
    if (objectId === undefined) {
      missing.push(feedId);
    }
  }
  return missing;
}

async function maybeCreateMissingPythFeeds({
  runtime,
  transactionFactory,
  priceFeedConnection,
  pythClient,
  config
}) {
  if (typeof pythClient.getPriceFeedObjectId !== "function") return undefined;
  const missingFeedIds = await missingPythFeedIds(pythClient, config.feedIds);
  if (missingFeedIds.length === 0) {
    return {
      status: "skipped",
      reason: "all-feeds-exist",
      feedIds: []
    };
  }
  if (typeof pythClient.createPriceFeed !== "function") {
    throw new Error("Pyth launch pool runtime pythClient must provide createPriceFeed for missing feeds");
  }

  const context = {
    kind: "create-pyth-price-feeds",
    packageId: config.packageId,
    feedIds: Array.from(missingFeedIds)
  };
  const tx = transactionFactory(context);
  const updates = await priceFeedConnection.getPriceFeedsUpdateData(Array.from(missingFeedIds));
  await pythClient.createPriceFeed(tx, Array.from(updates));
  const result = await runtime.executeTransaction(tx, context);
  assertTransactionSucceeded(result, "Pyth price feed creation transaction");
  return {
    status: "success",
    transactionDigest: result.effects.transactionDigest,
    feedIds: Array.from(missingFeedIds)
  };
}

function hexToBytes(hex) {
  const value = hex.startsWith("0x") ? hex.slice(2) : hex;
  if (value.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(value)) {
    throw new Error("Hex bytes value must have an even number of hex characters");
  }
  const bytes = [];
  for (let i = 0; i < value.length; i += 2) {
    bytes.push(Number.parseInt(value.slice(i, i + 2), 16));
  }
  return bytes;
}

function pureVectorU8(tx, bytes) {
  if (typeof tx.pure?.vector !== "function") {
    throw new Error("Pyth launch pool transaction builder must support pure vector values");
  }
  return tx.pure.vector("u8", bytes);
}

function pureId(tx, value) {
  if (typeof tx.pure?.id === "function") {
    return tx.pure.id(value);
  }
  if (typeof tx.pure?.address === "function") {
    return tx.pure.address(value);
  }
  throw new Error("Pyth launch pool transaction builder must support pure object ID values");
}

function splitCoinIfAmountConfigured(tx, coinId, amount) {
  const coin = tx.object(coinId);
  if (amount === undefined) return coin;
  if (typeof tx.splitCoins !== "function") {
    throw new Error("Pyth launch pool transaction builder must support coin splitting");
  }
  const [split] = tx.splitCoins(coin, [tx.pure.u64(amount)]);
  if (split === undefined) {
    throw new Error("Pyth launch pool transaction builder did not return a split coin");
  }
  return split;
}

function configurePythOracleToken({ tx, config, type, oracleArg, pythStateId, feedId }) {
  tx.moveCall({
    target: `${config.packageId}::oracle::configure_token`,
    typeArguments: [type],
    arguments: [
      oracleArg,
      pureVectorU8(tx, [112, 121, 116, 104]),
      pureId(tx, pythStateId),
      pureVectorU8(tx, hexToBytes(feedId))
    ]
  });
}

function expectedMoveTarget(config) {
  return `${config.packageId}::swap::create_pool_with_coins_and_transfer_lp_to_sender`;
}

function expectedEvents(config) {
  return [
    `${config.packageId}::events::PoolCreated`,
    `${config.packageId}::events::Sync`
  ];
}

function expectedFlashEnableMoveTarget(config) {
  return `${config.packageId}::admin::set_pool_flash_enabled`;
}

function expectedFlashEnableEvents(config) {
  return [`${config.packageId}::events::PoolGateStateChanged`];
}

function expectedProtocolFeeSetupMoveTargets(config) {
  return [
    `${config.packageId}::admin::set_pool_fee_to`,
    `${config.packageId}::admin::set_pool_protocol_fee`
  ];
}

function expectedProtocolFeeSetupEvents(config) {
  return [
    `${config.packageId}::events::FeeToUpdated`,
    `${config.packageId}::events::PoolParametersUpdated`,
    `${config.packageId}::events::ConfigUpdated`
  ];
}

function nonNegativeInteger(value, fallback) {
  return Number.isSafeInteger(value) && value >= 0 ? value : fallback;
}

function isTransientMissingObjectError(error, objectId) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("notExists") &&
    message.includes(objectId)
  );
}

async function sleep(ms) {
  if (ms <= 0) return;
  await new Promise((resolve) => setTimeout(resolve, ms));
}

function assertExtractedPackageMatchesConfig(extracted, config) {
  if (extracted.packageId !== config.packageId) {
    throw new Error(
      `Created pool package ${extracted.packageId} does not match config package ${config.packageId}`
    );
  }
}

async function maybeEnableFlash({ config, runtime, transactionFactory, pool, routerSdk }) {
  if (!config.flashEnabled) return undefined;
  const pauseCap = requireString(
    config.pauseCap,
    "Pyth launch pool config pauseCap"
  );
  const context = {
    kind: "enable-flash",
    packageId: config.packageId,
    typeA: config.typeA,
    typeB: config.typeB,
    pool
  };
  const attempts = Math.max(1, nonNegativeInteger(runtime.flashEnableRetryAttempts, 6));
  const retryDelayMs = nonNegativeInteger(runtime.flashEnableRetryDelayMs, 1000);
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tx = transactionFactory(context);
    routerSdk.setPoolFlashEnabled({
      packageId: config.packageId,
      typeA: config.typeA,
      typeB: config.typeB,
      pool,
      pauseCap,
      enabled: true
    })(tx);
    try {
      result = await runtime.executeTransaction(tx, context);
      break;
    } catch (error) {
      if (attempt >= attempts || !isTransientMissingObjectError(error, pool)) {
        throw error;
      }
      await sleep(retryDelayMs);
    }
  }
  assertTransactionSucceeded(result, "Pyth launch flash enable transaction");
  const digest = requireString(
    result.effects.transactionDigest,
    "Pyth launch flash enable transaction digest"
  );
  return {
    status: "success",
    transactionDigest: digest,
    txEvidence: {
      name: "pyth enable flash",
      digest,
      expectedMoveCalls: [expectedFlashEnableMoveTarget(config)],
      expectedEventTypes: expectedFlashEnableEvents(config)
    }
  };
}

async function maybeConfigureProtocolFee({ config, runtime, transactionFactory, pool, routerSdk }) {
  if (config.protocolFee === undefined) return undefined;
  const feeCap = requireString(
    config.feeCap,
    "Pyth launch pool config feeCap"
  );
  const riskCap = requireString(
    config.riskCap,
    "Pyth launch pool config riskCap"
  );
  const feeTo = requireString(
    config.feeTo,
    "Pyth launch pool config feeTo"
  );
  const context = {
    kind: "configure-protocol-fee",
    packageId: config.packageId,
    typeA: config.typeA,
    typeB: config.typeB,
    pool
  };
  const attempts = Math.max(1, nonNegativeInteger(runtime.protocolFeeSetupRetryAttempts, 6));
  const retryDelayMs = nonNegativeInteger(runtime.protocolFeeSetupRetryDelayMs, 1000);
  let result;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const tx = transactionFactory(context);
    routerSdk.setPoolFeeTo({
      packageId: config.packageId,
      typeA: config.typeA,
      typeB: config.typeB,
      pool,
      feeCap,
      feeTo
    })(tx);
    routerSdk.setPoolProtocolFee({
      packageId: config.packageId,
      typeA: config.typeA,
      typeB: config.typeB,
      pool,
      riskCap,
      newProtocolFee: config.protocolFee
    })(tx);
    try {
      result = await runtime.executeTransaction(tx, context);
      break;
    } catch (error) {
      if (attempt >= attempts || !isTransientMissingObjectError(error, pool)) {
        throw error;
      }
      await sleep(retryDelayMs);
    }
  }
  assertTransactionSucceeded(result, "Pyth launch protocol fee setup transaction");
  const digest = requireString(
    result.effects.transactionDigest,
    "Pyth launch protocol fee setup transaction digest"
  );
  return {
    status: "success",
    transactionDigest: digest,
    txEvidence: {
      name: "pyth configure protocol fee",
      digest,
      expectedMoveCalls: expectedProtocolFeeSetupMoveTargets(config),
      expectedEventTypes: expectedProtocolFeeSetupEvents(config)
    }
  };
}

export async function createPythLaunchPool({
  poolConfig,
  runtime,
  routerSdk = {
    createPoolWithCoinsAndTransferLpToSender,
    fetchAndUpdatePythPriceInfoObjectsFromFeeds,
    setPoolFlashEnabled,
    setPoolFeeTo,
    setPoolProtocolFee
  }
}) {
  const config = requireRecord(poolConfig, "Pyth launch pool config");
  assertNoPlaceholderValues(config);
  const runtimeObject = requireRecord(runtime, "Pyth launch pool runtime");
  assertRuntimeNetworkMatchesConfig(runtimeObject, config);
  const { priceFeedConnection, pythClient } = runtimePythClients(runtimeObject);
  const transactionFactory = runtimePoolTransactionFactory(runtimeObject);
  assertExecuteTransaction(runtimeObject);

  const pythFeedCreation = await maybeCreateMissingPythFeeds({
    runtime: runtimeObject,
    transactionFactory,
    priceFeedConnection,
    pythClient,
    config
  });

  const context = {
    kind: "create-pool",
    packageId: config.packageId,
    typeA: config.typeA,
    typeB: config.typeB
  };
  const tx = transactionFactory(context);
  const oracleArg = tx.object(config.oracle);
  const pythStateId = pythStateIdFromRuntime(runtimeObject);
  const priceInfoObjects = await routerSdk.fetchAndUpdatePythPriceInfoObjectsFromFeeds(tx, {
    priceFeedConnection,
    pythClient,
    feedIds: config.feedIds
  });
  if (priceInfoObjects.length !== 2) {
    throw new Error("Pyth launch pool update must return exactly two PriceInfoObject IDs");
  }

  configurePythOracleToken({
    tx,
    config,
    type: config.typeA,
    oracleArg,
    pythStateId,
    feedId: config.feedIds[0]
  });
  configurePythOracleToken({
    tx,
    config,
    type: config.typeB,
    oracleArg,
    pythStateId,
    feedId: config.feedIds[1]
  });

  const initAArg = splitCoinIfAmountConfigured(tx, config.initA, config.initAAmount);
  const initBArg = splitCoinIfAmountConfigured(tx, config.initB, config.initBAmount);

  routerSdk.createPoolWithCoinsAndTransferLpToSender({
    packageId: config.packageId,
    typeA: config.typeA,
    typeB: config.typeB,
    factory: config.factory,
    poolCreatorCap: config.poolCreatorCap,
    oracle: oracleArg,
    priceInfoObjectA: priceInfoObjects[0],
    priceInfoObjectB: priceInfoObjects[1],
    clock: config.clock,
    initA: initAArg,
    initB: initBArg,
    tokenADecimals: config.tokenADecimals,
    tokenBDecimals: config.tokenBDecimals
  })(tx);

  const txResult = await runtimeObject.executeTransaction(tx, context);
  const extracted = extractLaunchPoolCreateObjects(txResult);
  assertExtractedPackageMatchesConfig(extracted, config);
  const protocolFeeSetup = await maybeConfigureProtocolFee({
    config,
    runtime: runtimeObject,
    transactionFactory,
    pool: extracted.pool,
    routerSdk
  });
  const flashEnable = await maybeEnableFlash({
    config,
    runtime: runtimeObject,
    transactionFactory,
    pool: extracted.pool,
    routerSdk
  });

  const report = {
    status: "success",
    network: config.network,
    transactionDigest: extracted.transactionDigest,
    packageId: extracted.packageId,
    pool: extracted.pool,
    lpCoin: extracted.lpCoin,
    priceInfoObjects: Array.from(priceInfoObjects),
    replacements: extracted.replacements,
    ...(protocolFeeSetup === undefined ? {} : { protocolFeeSetup }),
    ...(flashEnable === undefined ? {} : { flashEnable }),
    txEvidence: {
      name: "pyth create pool",
      digest: extracted.transactionDigest,
      expectedMoveCalls: [expectedMoveTarget(config)],
      expectedEventTypes: expectedEvents(config)
    }
  };
  if (pythFeedCreation !== undefined) {
    report.pythFeedCreation = pythFeedCreation;
  }
  return report;
}

export async function createPythLaunchPoolConfig({ config, runtime, runtimeConfig, out }) {
  const poolConfig = loadPythLaunchPoolConfigFile({ config });
  const runtimeObject =
    typeof runtime === "string" ? await loadRuntime(runtime, poolConfig, runtimeConfig) : runtime;
  const summary = await createPythLaunchPool({ poolConfig, runtime: runtimeObject });
  if (out !== undefined) {
    writeJson(out, summary);
  }
  return summary;
}

async function main() {
  const summary = await createPythLaunchPoolConfig(parseArgs(process.argv.slice(2)));
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
