#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import {
  buildRegisteredRouteCaseTransaction,
  buildRegisteredRoutePreflightCases
} from "../sdk/router/dist/index.js";
import { checkSuiGasReadiness } from "./check-sui-gas-readiness.mjs";
import {
  loadLaunchMatrixConfigFile,
  validateLaunchMatrixConfigFile
} from "./validate-launch-matrix.mjs";
import { verifySuiTxEvidence } from "./verify-sui-cli-tx-evidence.mjs";

function usage() {
  console.error(
    [
      "Usage: node tools/run-launch-matrix-submit.mjs --config <file> [--launch-config <file>] --runtime <module> [--runtime-config <file>]",
      "       node tools/run-launch-matrix-submit.mjs --config <file> [--launch-config <file>] --runtime <module> [--runtime-config <file>] --check-gas --active-address <address> [--rpc-url <url>] [--min-gas-mist <n>] [--use-rtk]",
      "       node tools/run-launch-matrix-submit.mjs --config <file> [--launch-config <file>] --runtime <module> [--runtime-config <file>] --out <file> [--resume-from <file>]",
      "       node tools/run-launch-matrix-submit.mjs --config <file> [--launch-config <file>] --runtime <module> [--runtime-config <file>] --verify-tx-evidence [--tx-evidence-rpc-url <url>] [--tx-evidence-use-rtk] [--tx-evidence-rpc-retries <n>] [--tx-evidence-rpc-retry-delay-ms <n>]",
      "",
      "Submits state-changing BrownFi launch matrix route cases through a caller-supplied runtime module and prints txEvidence-ready JSON."
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
    } else if (arg === "--runtime-config") {
      args.runtimeConfig = argv[++i];
    } else if (arg === "--out") {
      args.out = argv[++i];
    } else if (arg === "--resume-from") {
      args.resumeFrom = argv[++i];
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

async function loadRuntime(runtimePath, config, runtimeConfig) {
  const runtimeUrl = pathToFileURL(path.resolve(runtimePath)).href;
  const runtimeModule = await import(runtimeUrl);
  const createRuntime = runtimeModule.createLaunchMatrixRuntime ?? runtimeModule.default;
  if (typeof createRuntime !== "function") {
    throw new Error("Launch matrix runtime module must export createLaunchMatrixRuntime");
  }
  const runtime = await createRuntime({ config, runtimeConfig });
  if (runtime === null || typeof runtime !== "object") {
    throw new Error("Launch matrix runtime factory must return an object");
  }
  if (runtime.providerRegistry === undefined) {
    throw new Error("Launch matrix runtime must provide providerRegistry");
  }
  if (typeof runtime.routeTransactionFactory !== "function") {
    throw new Error("Launch matrix submit runtime must provide routeTransactionFactory");
  }
  if (typeof runtime.executeTransaction !== "function") {
    throw new Error("Launch matrix submit runtime must provide executeTransaction");
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

function requireString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`${label} must be a non-empty string`);
  }
  return value;
}

function packageIdForRouteCase(routeCase) {
  if (
    routeCase.kind === "add-liquidity" ||
    routeCase.kind === "remove-liquidity" ||
    routeCase.kind === "zap-in-a" ||
    routeCase.kind === "zap-in-b" ||
    routeCase.kind === "zap-out-a" ||
    routeCase.kind === "zap-out-b" ||
    routeCase.kind === "flash-borrow-a" ||
    routeCase.kind === "flash-borrow-b"
  ) {
    return requireString(routeCase.pair?.packageId, "Launch matrix route pair packageId");
  }
  const pair = routeCase.pairs?.[0];
  return requireString(pair?.packageId, "Launch matrix route first pair packageId");
}

function moveTarget(packageId, moduleName, functionName) {
  return `${packageId}::${moduleName}::${functionName}`;
}

function routeHopCount(pathItems) {
  if (!Array.isArray(pathItems) || pathItems.length < 2) {
    throw new Error("Launch matrix route path must contain at least two token types");
  }
  return pathItems.length - 1;
}

function resolveRouteHop(pairs, inputType, outputType) {
  if (!Array.isArray(pairs)) {
    throw new Error("Launch matrix route pairs must be an array");
  }
  const matches = [];
  for (const pair of pairs) {
    if (pair?.typeA === inputType && pair?.typeB === outputType) {
      matches.push({ pair, direction: "a_to_b" });
    } else if (pair?.typeA === outputType && pair?.typeB === inputType) {
      matches.push({ pair, direction: "b_to_a" });
    }
  }
  if (matches.length === 0) {
    throw new Error(`Launch matrix route has no pair for ${inputType} -> ${outputType}`);
  }
  if (matches.length > 1) {
    throw new Error(`Launch matrix route has ambiguous pair for ${inputType} -> ${outputType}`);
  }
  return matches[0];
}

function resolveRoute(pathItems, pairs) {
  const route = [];
  for (let i = 0; i < routeHopCount(pathItems); i += 1) {
    route.push(resolveRouteHop(pairs, pathItems[i], pathItems[i + 1]));
  }
  return route;
}

function swapExactInputFunctionName(direction) {
  return direction === "a_to_b"
    ? "swap_exact_a_for_b_with_bundle"
    : "swap_exact_b_for_a_with_bundle";
}

function quoteExactOutputFunctionName(direction) {
  return direction === "a_to_b"
    ? "quote_a_for_exact_b_with_bundle"
    : "quote_b_for_exact_a_with_bundle";
}

function swapExactOutputFunctionName(direction) {
  return direction === "a_to_b"
    ? "swap_a_for_exact_b_with_bundle"
    : "swap_b_for_exact_a_with_bundle";
}

function expectedMoveCallsForRouteCase(routeCase) {
  if (routeCase.kind === "add-liquidity") {
    return [moveTarget(routeCase.pair.packageId, "router", "add_liquidity_with_bundle")];
  }
  if (routeCase.kind === "remove-liquidity") {
    return [moveTarget(routeCase.pair.packageId, "router", "remove_liquidity_with_coins")];
  }
  if (routeCase.kind === "zap-in-a") {
    return [moveTarget(routeCase.pair.packageId, "router", "zap_in_a_with_bundle")];
  }
  if (routeCase.kind === "zap-in-b") {
    return [moveTarget(routeCase.pair.packageId, "router", "zap_in_b_with_bundle")];
  }
  if (routeCase.kind === "zap-out-a") {
    return [moveTarget(routeCase.pair.packageId, "router", "zap_out_a_with_bundle")];
  }
  if (routeCase.kind === "zap-out-b") {
    return [moveTarget(routeCase.pair.packageId, "router", "zap_out_b_with_bundle")];
  }
  if (routeCase.kind === "flash-borrow-a") {
    return [
      moveTarget(routeCase.pair.packageId, "flash", "borrow_a_with_coin"),
      moveTarget(routeCase.pair.packageId, "flash", "repay_a_with_coin")
    ];
  }
  if (routeCase.kind === "flash-borrow-b") {
    return [
      moveTarget(routeCase.pair.packageId, "flash", "borrow_b_with_coin"),
      moveTarget(routeCase.pair.packageId, "flash", "repay_b_with_coin")
    ];
  }

  const route = resolveRoute(routeCase.path, routeCase.pairs);
  if (routeCase.kind === "exact-input") {
    return route.map((hop) =>
      moveTarget(hop.pair.packageId, "router", swapExactInputFunctionName(hop.direction))
    );
  }

  if (routeCase.kind === "exact-output-results") {
    const calls = [];
    for (let i = route.length - 1; i > 0; i -= 1) {
      calls.push(
        moveTarget(route[i].pair.packageId, "swap", quoteExactOutputFunctionName(route[i].direction))
      );
    }
    for (const hop of route) {
      calls.push(
        moveTarget(hop.pair.packageId, "router", swapExactOutputFunctionName(hop.direction))
      );
    }
    return calls;
  }

  if (route.length === 1) {
    const hop = route[0];
    return [moveTarget(hop.pair.packageId, "router", swapExactOutputFunctionName(hop.direction))];
  }

  const samePackageId = route[0].pair.packageId;
  if (route.some((hop) => hop.pair.packageId !== samePackageId)) {
    throw new Error("Launch matrix exact-output route helper requires one package ID");
  }
  const first = route[0];
  const second = route[1];
  if (route.length !== 2) {
    throw new Error("Launch matrix exact-output submit evidence supports one or two hops");
  }
  if (first.direction === "a_to_b" && second.direction === "a_to_b") {
    return [moveTarget(samePackageId, "router", "swap_a_for_exact_c_via_b_with_bundles")];
  }
  if (first.direction === "b_to_a" && second.direction === "b_to_a") {
    return [moveTarget(samePackageId, "router", "swap_c_for_exact_a_via_b_with_bundles")];
  }
  if (first.direction === "a_to_b") {
    return [
      moveTarget(samePackageId, "router", "swap_a_for_exact_c_via_b_with_reversed_second_bundle")
    ];
  }
  return [
    moveTarget(samePackageId, "router", "swap_a_for_exact_c_via_b_with_reversed_first_bundle")
  ];
}

function swapRouteEventTypes(route) {
  const events = [];
  for (const hop of route) {
    const eventType = (name) => moveTarget(hop.pair.packageId, "events", name);
    events.push(
      eventType("OracleQuorumUsed"),
      eventType("Sync"),
      eventType("PriceBundleUsed"),
      eventType("SwapExecuted"),
      eventType("Swap")
    );
  }
  return events;
}

function expectedEventTypesForRouteCase(routeCase) {
  const packageId = packageIdForRouteCase(routeCase);
  const eventType = (name) => `${packageId}::events::${name}`;
  if (routeCase.kind === "add-liquidity") {
    return [
      eventType("OracleQuorumUsed"),
      eventType("Sync"),
      eventType("AddLiquidity")
    ];
  }
  if (routeCase.kind === "remove-liquidity") {
    return [eventType("Sync"), eventType("RemoveLiquidity")];
  }
  if (routeCase.kind === "zap-in-a" || routeCase.kind === "zap-in-b") {
    return [
      eventType("OracleQuorumUsed"),
      eventType("Sync"),
      eventType("PriceBundleUsed"),
      eventType("SwapExecuted"),
      eventType("Swap"),
      eventType("AddLiquidity")
    ];
  }
  if (routeCase.kind === "zap-out-a" || routeCase.kind === "zap-out-b") {
    return [
      eventType("OracleQuorumUsed"),
      eventType("Sync"),
      eventType("PriceBundleUsed"),
      eventType("SwapExecuted"),
      eventType("Swap"),
      eventType("RemoveLiquidity")
    ];
  }
  if (routeCase.kind === "flash-borrow-a" || routeCase.kind === "flash-borrow-b") {
    return [
      eventType("OracleQuorumUsed"),
      eventType("FlashBorrowed"),
      eventType("FlashRepaid")
    ];
  }
  return swapRouteEventTypes(resolveRoute(routeCase.path, routeCase.pairs));
}

function executionStatus(executionResult) {
  return executionResult?.effects?.status?.status;
}

function executionDigest(executionResult) {
  return executionResult?.digest ?? executionResult?.effects?.transactionDigest;
}

function assertExecutionSucceeded(executionResult, routeCase) {
  const status = executionStatus(executionResult);
  if (status !== "success") {
    throw new Error(
      `Launch matrix submit ${routeCase.name} failed with status ${status ?? "missing status"}`
    );
  }
  return requireString(
    executionDigest(executionResult),
    `Launch matrix submit ${routeCase.name} digest`
  );
}

function transactionResultAt(result, index, label) {
  const value = result?.[index];
  if (value === undefined) {
    throw new Error(`Launch matrix submit missing ${label}`);
  }
  return value;
}

function routeResultOutputs(routeResult) {
  if (routeResult.kind === "exact-input") {
    return [routeResult.swapResult];
  }
  if (routeResult.kind === "exact-output-results") {
    return [...(routeResult.changeCoins ?? []), routeResult.output];
  }
  if (routeResult.kind === "add-liquidity") {
    return [
      transactionResultAt(routeResult.liquidityResult, 0, "add-liquidity remaining coin A"),
      transactionResultAt(routeResult.liquidityResult, 1, "add-liquidity remaining coin B"),
      transactionResultAt(routeResult.liquidityResult, 2, "add-liquidity LP coin")
    ];
  }
  if (routeResult.kind === "remove-liquidity") {
    return [
      transactionResultAt(routeResult.liquidityResult, 0, "remove-liquidity coin A"),
      transactionResultAt(routeResult.liquidityResult, 1, "remove-liquidity coin B")
    ];
  }
  if (routeResult.kind === "zap-in-a" || routeResult.kind === "zap-in-b") {
    return [
      transactionResultAt(routeResult.zapResult, 0, "zap-in remaining input-side coin"),
      transactionResultAt(routeResult.zapResult, 1, "zap-in remaining paired coin"),
      transactionResultAt(routeResult.zapResult, 2, "zap-in LP coin")
    ];
  }
  if (routeResult.kind === "zap-out-a" || routeResult.kind === "zap-out-b") {
    return [routeResult.zapResult];
  }
  if (routeResult.kind === "flash-borrow-a" || routeResult.kind === "flash-borrow-b") {
    return [];
  }
  const swapResult = routeResult.swapResult;
  if (swapResult?.[2] !== undefined) {
    return [
      transactionResultAt(swapResult, 0, "exact-output input change coin"),
      transactionResultAt(swapResult, 1, "exact-output intermediate change coin"),
      transactionResultAt(swapResult, 2, "exact-output output coin")
    ];
  }
  if (swapResult?.[0] !== undefined && swapResult?.[1] !== undefined) {
    return [
      transactionResultAt(swapResult, 0, "exact-output change coin"),
      transactionResultAt(swapResult, 1, "exact-output output coin")
    ];
  }
  return [swapResult];
}

function runtimeSender(runtime, tx) {
  const sender = runtime.sender ?? tx.sender;
  if (typeof sender !== "string" || sender.length === 0) {
    throw new Error("Launch matrix submit runtime must expose sender to transfer route outputs");
  }
  return sender;
}

function optionalRouteRecipient(routeCaseConfig) {
  const recipient = routeCaseConfig?.recipient;
  if (recipient === undefined) return undefined;
  if (typeof recipient !== "string" || recipient.length === 0) {
    throw new Error("Launch matrix route case recipient must be a non-empty address when present");
  }
  return recipient;
}

function routeResultTransferGroups(routeResult, senderAddress, recipientAddress) {
  const defaultRecipient = recipientAddress ?? senderAddress;
  if (recipientAddress === undefined || recipientAddress === senderAddress) {
    return [{ recipient: senderAddress, outputs: routeResultOutputs(routeResult) }];
  }
  if (routeResult.kind === "exact-input") {
    return [{ recipient: recipientAddress, outputs: [routeResult.swapResult] }];
  }
  if (routeResult.kind === "exact-output-results") {
    return [
      { recipient: senderAddress, outputs: routeResult.changeCoins ?? [] },
      { recipient: recipientAddress, outputs: [routeResult.output] }
    ];
  }
  if (routeResult.kind === "add-liquidity") {
    return [
      {
        recipient: senderAddress,
        outputs: [
          transactionResultAt(routeResult.liquidityResult, 0, "add-liquidity remaining coin A"),
          transactionResultAt(routeResult.liquidityResult, 1, "add-liquidity remaining coin B")
        ]
      },
      {
        recipient: recipientAddress,
        outputs: [transactionResultAt(routeResult.liquidityResult, 2, "add-liquidity LP coin")]
      }
    ];
  }
  if (routeResult.kind === "remove-liquidity") {
    return [{ recipient: recipientAddress, outputs: routeResultOutputs(routeResult) }];
  }
  if (routeResult.kind === "zap-in-a" || routeResult.kind === "zap-in-b") {
    return [
      {
        recipient: senderAddress,
        outputs: [
          transactionResultAt(routeResult.zapResult, 0, "zap-in remaining input-side coin"),
          transactionResultAt(routeResult.zapResult, 1, "zap-in remaining paired coin")
        ]
      },
      {
        recipient: recipientAddress,
        outputs: [transactionResultAt(routeResult.zapResult, 2, "zap-in LP coin")]
      }
    ];
  }
  if (routeResult.kind === "zap-out-a" || routeResult.kind === "zap-out-b") {
    return [{ recipient: recipientAddress, outputs: [routeResult.zapResult] }];
  }
  if (routeResult.kind === "flash-borrow-a" || routeResult.kind === "flash-borrow-b") {
    return [];
  }
  const swapResult = routeResult.swapResult;
  if (swapResult?.[2] !== undefined) {
    return [
      {
        recipient: senderAddress,
        outputs: [
          transactionResultAt(swapResult, 0, "exact-output input change coin"),
          transactionResultAt(swapResult, 1, "exact-output intermediate change coin")
        ]
      },
      {
        recipient: recipientAddress,
        outputs: [transactionResultAt(swapResult, 2, "exact-output output coin")]
      }
    ];
  }
  if (swapResult?.[0] !== undefined && swapResult?.[1] !== undefined) {
    return [
      {
        recipient: senderAddress,
        outputs: [transactionResultAt(swapResult, 0, "exact-output change coin")]
      },
      {
        recipient: recipientAddress,
        outputs: [transactionResultAt(swapResult, 1, "exact-output output coin")]
      }
    ];
  }
  return [{ recipient: defaultRecipient, outputs: [swapResult] }];
}

function transferRouteResultOutputs(tx, runtime, routeResult, routeCaseConfig) {
  const senderAddress = runtimeSender(runtime, tx);
  const recipientAddress = optionalRouteRecipient(routeCaseConfig);
  const groups = routeResultTransferGroups(routeResult, senderAddress, recipientAddress);
  const nonEmptyGroups = groups
    .map((group) => ({
      recipient: group.recipient,
      outputs: group.outputs.filter((item) => item !== undefined)
    }))
    .filter((group) => group.outputs.length > 0);
  if (nonEmptyGroups.length === 0) return;
  if (typeof tx.transferObjects !== "function") {
    throw new Error("Launch matrix submit transaction builder must support transferObjects");
  }
  if (typeof tx.pure?.address !== "function") {
    throw new Error("Launch matrix submit transaction builder must support pure address values");
  }
  for (const group of nonEmptyGroups) {
    tx.transferObjects(group.outputs, tx.pure.address(group.recipient));
  }
}

function optionalU64(value, label) {
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

function splitCoinIfConfigured(tx, coin, amount, label) {
  const splitAmount = optionalU64(amount, label);
  if (splitAmount === undefined) return coin;
  if (typeof tx.splitCoins !== "function") {
    throw new Error("Launch matrix submit transaction builder must support splitCoins");
  }
  const [split] = tx.splitCoins(tx.object(coin), [tx.pure.u64(splitAmount)]);
  if (split === undefined) {
    throw new Error("Launch matrix submit transaction builder did not return a split coin");
  }
  return split;
}

function applyRouteInputSplits(routeCase, routeCaseConfig) {
  if (routeCaseConfig === undefined) return;
  if (
    routeCase.kind === "exact-input" ||
    routeCase.kind === "exact-output" ||
    routeCase.kind === "exact-output-results"
  ) {
    routeCase.input = splitCoinIfConfigured(
      routeCase.tx,
      routeCase.input,
      routeCaseConfig.inputAmount,
      `Launch matrix route case ${routeCase.name} inputAmount`
    );
    return;
  }
  if (routeCase.kind === "add-liquidity") {
    routeCase.inputA = splitCoinIfConfigured(
      routeCase.tx,
      routeCase.inputA,
      routeCaseConfig.inputAAmount ?? routeCaseConfig.inputAmount,
      `Launch matrix route case ${routeCase.name} inputAAmount`
    );
    routeCase.inputB = splitCoinIfConfigured(
      routeCase.tx,
      routeCase.inputB,
      routeCaseConfig.inputBAmount,
      `Launch matrix route case ${routeCase.name} inputBAmount`
    );
    return;
  }
  if (routeCase.kind === "remove-liquidity") {
    routeCase.lpIn = splitCoinIfConfigured(
      routeCase.tx,
      routeCase.lpIn,
      routeCaseConfig.inputAmount,
      `Launch matrix route case ${routeCase.name} inputAmount`
    );
    return;
  }
  if (routeCase.kind === "zap-in-a") {
    routeCase.inputA = splitCoinIfConfigured(
      routeCase.tx,
      routeCase.inputA,
      routeCaseConfig.inputAmount,
      `Launch matrix route case ${routeCase.name} inputAmount`
    );
    return;
  }
  if (routeCase.kind === "zap-in-b") {
    routeCase.inputB = splitCoinIfConfigured(
      routeCase.tx,
      routeCase.inputB,
      routeCaseConfig.inputAmount,
      `Launch matrix route case ${routeCase.name} inputAmount`
    );
    return;
  }
  if (routeCase.kind === "zap-out-a" || routeCase.kind === "zap-out-b") {
    routeCase.lpIn = splitCoinIfConfigured(
      routeCase.tx,
      routeCase.lpIn,
      routeCaseConfig.inputAmount,
      `Launch matrix route case ${routeCase.name} inputAmount`
    );
    return;
  }
  if (routeCase.kind === "flash-borrow-a" || routeCase.kind === "flash-borrow-b") {
    routeCase.feeCoin = splitCoinIfConfigured(
      routeCase.tx,
      routeCase.feeCoin,
      routeCaseConfig.feeCoinAmount,
      `Launch matrix route case ${routeCase.name} feeCoinAmount`
    );
  }
}

function summarizeSubmittedRouteCases(submittedRouteCases) {
  const providerIds = [];
  const seenProviderIds = new Set();
  for (const routeCase of submittedRouteCases) {
    if (!seenProviderIds.has(routeCase.providerId)) {
      seenProviderIds.add(routeCase.providerId);
      providerIds.push(routeCase.providerId);
    }
  }
  return {
    routeCaseCount: submittedRouteCases.length,
    providerIds,
    routeCases: submittedRouteCases
  };
}

function reportForSubmittedRoutes(submittedRouteCases, txEvidence, txVerification) {
  const report = {
    summary: summarizeSubmittedRouteCases(submittedRouteCases),
    txEvidence
  };
  if (txVerification.length > 0) {
    report.txVerification = txVerification;
  }
  return report;
}

function evidenceForRouteCase(routeCase, digest) {
  return {
    name: routeCase.name,
    digest,
    expectedMoveCalls: expectedMoveCallsForRouteCase(routeCase),
    expectedEventTypes: expectedEventTypesForRouteCase(routeCase)
  };
}

function requireStringArray(value, label) {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string" || item.length === 0)) {
    throw new Error(`${label} must be an array of non-empty strings`);
  }
  return value;
}

function arraysEqual(left, right) {
  return left.length === right.length && left.every((item, index) => item === right[index]);
}

function assertResumeEvidenceMatches(existing, expected) {
  if (existing === null || typeof existing !== "object" || Array.isArray(existing)) {
    throw new Error(`Launch matrix resume evidence ${expected.name} must be an object`);
  }
  const name = requireString(existing.name, "Launch matrix resume evidence name");
  if (name !== expected.name) {
    throw new Error(
      `Launch matrix resume evidence must be a prefix of current route cases: expected ${expected.name}, got ${name}`
    );
  }
  requireString(existing.digest, `Launch matrix resume evidence ${name} digest`);
  const existingMoveCalls = requireStringArray(
    existing.expectedMoveCalls,
    `Launch matrix resume evidence ${name} expectedMoveCalls`
  );
  const existingEventTypes = requireStringArray(
    existing.expectedEventTypes,
    `Launch matrix resume evidence ${name} expectedEventTypes`
  );
  if (!arraysEqual(existingMoveCalls, expected.expectedMoveCalls)) {
    throw new Error(`Launch matrix resume evidence ${name} Move-call expectations do not match current matrix`);
  }
  if (!arraysEqual(existingEventTypes, expected.expectedEventTypes)) {
    throw new Error(`Launch matrix resume evidence ${name} event expectations do not match current matrix`);
  }
}

function loadResumeEvidence(resumeFrom) {
  if (resumeFrom === undefined || !fs.existsSync(resumeFrom)) return [];
  const raw = JSON.parse(fs.readFileSync(resumeFrom, "utf8"));
  if (raw === null || typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("Launch matrix resume report must be an object");
  }
  if (!Array.isArray(raw.txEvidence)) {
    throw new Error("Launch matrix resume report must contain txEvidence");
  }
  return raw.txEvidence;
}

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function writeSubmitSnapshot(out, submittedRouteCases, txEvidence, txVerification) {
  if (out === undefined) return;
  writeJson(out, reportForSubmittedRoutes(submittedRouteCases, txEvidence, txVerification));
}

export async function submitLaunchMatrixRoutesConfigFile({
  config,
  launchConfig,
  runtime,
  runtimeConfig,
  gasReadiness,
  txEvidenceVerification,
  out,
  resumeFrom
}) {
  if (!config) throw new Error("Missing launch matrix config path");
  if (!runtime) throw new Error("Missing launch matrix runtime module path");

  validateLaunchMatrixConfigFile({ config, launchConfig, requireLiveValues: true });
  const matrixConfig = loadLaunchMatrixConfigFile({ config, launchConfig, requireLiveValues: true });
  const routeCaseConfigs = matrixConfig.routeCases ?? [];
  if (routeCaseConfigs.length === 0) {
    throw new Error("Launch matrix submit requires at least one route case");
  }
  maybeCheckGasReadiness(matrixConfig, gasReadiness);
  const launchRuntime = await loadRuntime(runtime, matrixConfig, runtimeConfig);
  assertRuntimeNetworkMatchesConfig(launchRuntime, matrixConfig);

  const routeCases = buildRegisteredRoutePreflightCases({
    providerRegistry: launchRuntime.providerRegistry,
    txFactory: launchRuntime.routeTransactionFactory,
    cases: routeCaseConfigs,
    routeLimits: matrixConfig.routeLimits
  });

  const submittedRouteCases = [];
  const txEvidence = [];
  const txVerification = [];
  const resumeEvidence = loadResumeEvidence(resumeFrom);
  if (resumeEvidence.length > routeCases.length) {
    throw new Error("Launch matrix resume report has more txEvidence entries than current route cases");
  }
  for (let i = 0; i < routeCases.length; i += 1) {
    const routeCase = routeCases[i];
    const existingEvidence = resumeEvidence[i];
    if (existingEvidence !== undefined) {
      const expected = evidenceForRouteCase(
        routeCase,
        requireString(
          existingEvidence.digest,
          `Launch matrix resume evidence ${routeCase.name} digest`
        )
      );
      assertResumeEvidenceMatches(existingEvidence, expected);
      submittedRouteCases.push({
        name: routeCase.name,
        kind: routeCase.kind,
        providerId: routeCase.providerId,
        digest: expected.digest
      });
      txEvidence.push(expected);
      writeSubmitSnapshot(out, submittedRouteCases, txEvidence, txVerification);
      if (txEvidenceVerification !== undefined) {
        txVerification.push(
          verifySuiTxEvidence({
            network: matrixConfig.network,
            evidence: expected,
            txName: routeCase.name,
            rpcUrl: txEvidenceVerification.rpcUrl,
            useRtk: txEvidenceVerification.useRtk,
            rpcRetries: txEvidenceVerification.rpcRetries,
            rpcRetryDelayMs: txEvidenceVerification.rpcRetryDelayMs,
            execFileSync: txEvidenceVerification.execFileSync
          })
        );
        writeSubmitSnapshot(out, submittedRouteCases, txEvidence, txVerification);
      }
      continue;
    }
    applyRouteInputSplits(routeCase, routeCaseConfigs[i]);
    const routeResult = await buildRegisteredRouteCaseTransaction(routeCase);
    transferRouteResultOutputs(routeCase.tx, launchRuntime, routeResult, routeCaseConfigs[i]);
    const executionResult = await launchRuntime.executeTransaction(routeCase.tx, {
      config: matrixConfig,
      index: i,
      routeCase,
      routeResult
    });
    const digest = assertExecutionSucceeded(executionResult, routeCase);
    submittedRouteCases.push({
      name: routeCase.name,
      kind: routeCase.kind,
      providerId: routeCase.providerId,
      digest
    });
    const evidence = evidenceForRouteCase(routeCase, digest);
    txEvidence.push(evidence);
    writeSubmitSnapshot(out, submittedRouteCases, txEvidence, txVerification);
    if (txEvidenceVerification !== undefined) {
      txVerification.push(
        verifySuiTxEvidence({
          network: matrixConfig.network,
          evidence,
          txName: routeCase.name,
          rpcUrl: txEvidenceVerification.rpcUrl,
          useRtk: txEvidenceVerification.useRtk,
          rpcRetries: txEvidenceVerification.rpcRetries,
          rpcRetryDelayMs: txEvidenceVerification.rpcRetryDelayMs,
          execFileSync: txEvidenceVerification.execFileSync
        })
      );
      writeSubmitSnapshot(out, submittedRouteCases, txEvidence, txVerification);
    }
  }

  const report = reportForSubmittedRoutes(submittedRouteCases, txEvidence, txVerification);
  if (txEvidenceVerification !== undefined && txVerification.length === 0) {
    report.txVerification = txVerification;
  }
  if (out !== undefined) writeJson(out, report);
  return report;
}

async function main() {
  const report = await submitLaunchMatrixRoutesConfigFile(parseArgs(process.argv.slice(2)));
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
