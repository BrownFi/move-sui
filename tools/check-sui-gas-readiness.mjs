#!/usr/bin/env node

import { execFileSync as defaultExecFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const DEFAULT_MIN_MIST = "1";

function usage() {
  console.error(
    [
      "Usage: node tools/check-sui-gas-readiness.mjs --network <sui-env> [--min-mist <n>] [--active-address <address>] [--use-rtk]",
      "       node tools/check-sui-gas-readiness.mjs --network <sui-env> --active-address <address> --rpc-url <url> [--min-mist <n>] [--use-rtk]",
      "",
      "Checks that the selected Sui CLI environment has at least one gas coin and enough total mist for live transactions."
    ].join("\n")
  );
}

function parseArgs(argv) {
  const args = {
    minMist: DEFAULT_MIN_MIST
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--network") {
      args.network = argv[++i];
    } else if (arg === "--min-mist") {
      args.minMist = argv[++i];
    } else if (arg === "--active-address") {
      args.activeAddress = argv[++i];
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

function parseMist(value, label) {
  const text = typeof value === "number" ? String(value) : requireString(value, label);
  if (!/^\d+$/.test(text)) {
    throw new Error(`${label} must be an unsigned integer mist value`);
  }
  return BigInt(text);
}

function runSuiGas(execFileSync, { network, useRtk }) {
  const args = ["client", "--client.env", network, "gas", "--json"];
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

function rpcPayload(owner, cursor) {
  return JSON.stringify({
    jsonrpc: "2.0",
    id: 1,
    method: "suix_getCoins",
    params: [owner, "0x2::sui::SUI", cursor, null]
  });
}

function runSuiRpcGasPage(execFileSync, { network, activeAddress, rpcUrl, cursor, useRtk }) {
  const args = [
    "-sS",
    "-m",
    "20",
    "-X",
    "POST",
    "-H",
    "content-type:application/json",
    "--data",
    rpcPayload(activeAddress, cursor),
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

function rpcGasCoins(execFileSync, { network, activeAddress, rpcUrl, useRtk }) {
  const owner = requireString(activeAddress, "Sui active address");
  const coins = [];
  let cursor = null;
  do {
    const response = JSON.parse(
      runSuiRpcGasPage(execFileSync, { network, activeAddress: owner, rpcUrl, cursor, useRtk })
    );
    if (response?.error !== undefined) {
      const code = response.error?.code ?? "unknown";
      const message = response.error?.message ?? "missing message";
      throw new Error(`Sui JSON-RPC gas readiness failed for ${network}: ${code} ${message}`);
    }
    const result = response?.result;
    if (result === undefined || result === null || typeof result !== "object") {
      throw new Error(`Sui JSON-RPC gas readiness failed for ${network}: missing result`);
    }
    if (!Array.isArray(result.data)) {
      throw new Error(`Sui JSON-RPC gas readiness failed for ${network}: result.data must be an array`);
    }
    for (const coin of result.data) {
      coins.push({
        gasCoinId: coin?.coinObjectId,
        mistBalance: coin?.balance
      });
    }
    cursor = result.hasNextPage ? result.nextCursor : null;
  } while (cursor !== null && cursor !== undefined);
  return coins;
}

function faucetGuidance(network, activeAddress) {
  if (network !== "testnet") return "";
  if (activeAddress) {
    return ` Fund the address at https://faucet.sui.io/?address=${activeAddress}`;
  }
  return " Fund the address at https://faucet.sui.io/";
}

export function checkSuiGasReadiness({
  network,
  minMist = DEFAULT_MIN_MIST,
  activeAddress,
  rpcUrl,
  useRtk = false,
  execFileSync = defaultExecFileSync
}) {
  const resolvedNetwork = requireString(network, "Sui network");
  const requiredMist = parseMist(minMist, "Sui gas minimum");
  const gas = rpcUrl
    ? rpcGasCoins(execFileSync, {
        network: resolvedNetwork,
        activeAddress,
        rpcUrl,
        useRtk
      })
    : JSON.parse(runSuiGas(execFileSync, { network: resolvedNetwork, useRtk }));
  if (!Array.isArray(gas)) {
    throw new Error("Sui gas command did not return a JSON array");
  }

  const gasCoins = gas.map((coin, index) => {
    if (coin === null || typeof coin !== "object") {
      throw new Error(`Sui gas coin ${index} must be an object`);
    }
    return {
      gasCoinId: requireString(coin.gasCoinId, `Sui gas coin ${index}.gasCoinId`),
      mistBalance: parseMist(coin.mistBalance, `Sui gas coin ${index}.mistBalance`).toString()
    };
  });
  const totalMist = gasCoins.reduce((sum, coin) => sum + BigInt(coin.mistBalance), 0n);

  if (gasCoins.length === 0) {
    const owner = activeAddress ? ` for ${activeAddress}` : "";
    throw new Error(
      `No Sui gas coins found on ${resolvedNetwork}${owner}.${faucetGuidance(
        resolvedNetwork,
        activeAddress
      )}`.trim()
    );
  }
  if (totalMist < requiredMist) {
    throw new Error(
      `Sui gas on ${resolvedNetwork} is below required minimum: total ${totalMist} mist < required ${requiredMist} mist`
    );
  }

  return {
    network: resolvedNetwork,
    minMist: requiredMist.toString(),
    status: "success",
    gasCoinCount: gasCoins.length,
    totalMist: totalMist.toString(),
    gasCoins
  };
}

function main() {
  const summary = checkSuiGasReadiness(parseArgs(process.argv.slice(2)));
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
