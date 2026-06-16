#!/usr/bin/env node

import assert from "node:assert/strict";
import test from "node:test";

import { checkSuiGasReadiness } from "./check-sui-gas-readiness.mjs";

test("checkSuiGasReadiness reads Sui gas through the selected CLI env", () => {
  const calls = [];
  const summary = checkSuiGasReadiness({
    network: "devnet",
    minMist: "1000",
    useRtk: true,
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return JSON.stringify([
        {
          gasCoinId: "0xGAS1",
          mistBalance: 700,
          suiBalance: "0.0000007"
        },
        {
          gasCoinId: "0xGAS2",
          mistBalance: "500",
          suiBalance: "0.0000005"
        }
      ]);
    }
  });

  assert.deepEqual(calls, [
    {
      command: "rtk",
      args: ["sui", "client", "--client.env", "devnet", "gas", "--json"],
      options: {
        encoding: "utf8",
        maxBuffer: 16777216
      }
    }
  ]);
  assert.deepEqual(summary, {
    network: "devnet",
    minMist: "1000",
    status: "success",
    gasCoinCount: 2,
    totalMist: "1200",
    gasCoins: [
      {
        gasCoinId: "0xGAS1",
        mistBalance: "700"
      },
      {
        gasCoinId: "0xGAS2",
        mistBalance: "500"
      }
    ]
  });
});

test("checkSuiGasReadiness can read SUI gas through JSON-RPC", () => {
  const calls = [];
  const summary = checkSuiGasReadiness({
    network: "testnet",
    activeAddress: "0xabc",
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    minMist: "10",
    useRtk: true,
    execFileSync(command, args, options) {
      calls.push({ command, args, options, payload: JSON.parse(args[args.indexOf("--data") + 1]) });
      return JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: {
          data: [
            {
              coinObjectId: "0xGAS",
              balance: "42"
            }
          ],
          hasNextPage: false,
          nextCursor: null
        }
      });
    }
  });

  assert.equal(calls[0].command, "rtk");
  assert.deepEqual(calls[0].args.slice(0, 2), ["curl", "-sS"]);
  assert.equal(calls[0].payload.method, "suix_getCoins");
  assert.deepEqual(calls[0].payload.params, ["0xabc", "0x2::sui::SUI", null, null]);
  assert.deepEqual(summary, {
    network: "testnet",
    minMist: "10",
    status: "success",
    gasCoinCount: 1,
    totalMist: "42",
    gasCoins: [
      {
        gasCoinId: "0xGAS",
        mistBalance: "42"
      }
    ]
  });
});

test("checkSuiGasReadiness rejects empty testnet gas with faucet guidance", () => {
  assert.throws(
    () =>
      checkSuiGasReadiness({
        network: "testnet",
        activeAddress: "0xabc",
        execFileSync() {
          return "[]";
        }
      }),
    /No Sui gas coins found on testnet for 0xabc\. Fund the address at https:\/\/faucet\.sui\.io\/\?address=0xabc/
  );
});

test("checkSuiGasReadiness rejects JSON-RPC gas errors", () => {
  assert.throws(
    () =>
      checkSuiGasReadiness({
        network: "testnet",
        activeAddress: "0xabc",
        rpcUrl: "https://fullnode.testnet.sui.io:443",
        execFileSync() {
          return JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: {
              code: -32000,
              message: "owner not found"
            }
          });
        }
      }),
    /Sui JSON-RPC gas readiness failed for testnet: -32000 owner not found/
  );
});

test("checkSuiGasReadiness rejects gas below the requested minimum", () => {
  assert.throws(
    () =>
      checkSuiGasReadiness({
        network: "devnet",
        minMist: "2000",
        execFileSync() {
          return JSON.stringify([
            {
              gasCoinId: "0xGAS",
              mistBalance: "1999"
            }
          ]);
        }
      }),
    /Sui gas on devnet is below required minimum: total 1999 mist < required 2000 mist/
  );
});
