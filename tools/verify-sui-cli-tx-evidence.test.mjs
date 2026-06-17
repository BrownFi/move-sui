#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  verifySuiCliTxEvidenceConfigFile,
  verifySuiTxEvidence
} from "./verify-sui-cli-tx-evidence.mjs";

const SWAP_DIGEST = "5otmGQH838V8yNucRv7CPNPczDkTvJtW9MzdrNFXHyQx";
const SETUP_DIGEST = "2n2eGQH838V8yNucRv7CPNPczDkTvJtW9MzdrNFXHyQx";
const OTHER_DIGEST = "9ogGTqGLsM461dZozHsG6Ep5BrYKAH2ReCV2tyd2SzwJ";
const PACKAGE_ID = "0x1";
const POOL_ID = "0x3";
const LP_COIN_ID = "0x5";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureConfig() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-sui-cli-tx-evidence-"));
  const config = path.join(root, "matrix.json");
  writeJson(config, {
    providerIds: ["devnet-smoke"],
    network: "devnet",
    setupEvidence: {
      brownfiPackage: {
        packageId: PACKAGE_ID,
        digest: SETUP_DIGEST
      },
      pool: {
        objectId: POOL_ID,
        lpCoin: LP_COIN_ID,
        digest: SETUP_DIGEST
      }
    },
    routeCases: [
      {
        name: "devnet smoke exact input swap",
        kind: "exact-input",
        providerId: "devnet-smoke",
        clock: "0x6",
        path: ["0x1::a::A", "0x2::sui::SUI"],
        pairs: [
          {
            packageId: "0x1",
            typeA: "0x1::a::A",
            typeB: "0x2::sui::SUI",
            pool: "0x3",
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        input: "0x4",
        minOutputs: ["0"]
      }
    ],
    txEvidence: [
      {
        name: "swap",
        digest: SWAP_DIGEST,
        expectedMoveCalls: ["0x1::devnet_smoke::swap_smoke_for_sui"],
        expectedEventTypes: [
          "0x1::events::OracleQuorumUsed",
          "0x1::events::SwapExecuted"
        ]
      }
    ]
  });
  return config;
}

function txBlockResult({
  digest = SWAP_DIGEST,
  status = "success",
  eventTypes = ["0x1::events::OracleQuorumUsed", "0x1::events::SwapExecuted"],
  moveCalls = ["0x1::devnet_smoke::swap_smoke_for_sui"],
  objectChanges = [
    {
      type: "published",
      packageId: PACKAGE_ID
    },
    {
      type: "created",
      objectId: POOL_ID,
      objectType: "0x1::pool::Pool<0x1::a::A, 0x2::sui::SUI>"
    },
    {
      type: "created",
      objectId: LP_COIN_ID,
      objectType: "0x2::coin::Coin<0x1::pool::LP<0x1::a::A, 0x2::sui::SUI>>"
    }
  ]
} = {}) {
  return JSON.stringify({
    digest,
    transaction: {
      data: {
        transaction: {
          transactions: moveCalls.map((target) => {
            const [pkg, module, fn] = target.split("::");
            return {
              MoveCall: {
                package: pkg,
                module,
                function: fn
              }
            };
          })
        }
      }
    },
    effects: {
      status: { status },
      transactionDigest: digest
    },
    events: eventTypes.map((type) => ({ type })),
    objectChanges,
    checkpoint: "123",
    timestampMs: "1780000000000"
  });
}

test("verifySuiCliTxEvidenceConfigFile queries configured landed tx evidence", () => {
  const calls = [];
  const result = verifySuiCliTxEvidenceConfigFile({
    config: fixtureConfig(),
    txName: "swap",
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return txBlockResult();
    }
  });

  assert.equal(calls[0].command, "sui");
  assert.deepEqual(calls[0].args, [
    "client",
    "--client.env",
    "devnet",
    "tx-block",
    SWAP_DIGEST,
    "--json"
  ]);
  assert.equal(calls[0].options.encoding, "utf8");
  assert.deepEqual(result, {
    txName: "swap",
    digest: SWAP_DIGEST,
    status: "success",
    checkpoint: "123",
    timestampMs: "1780000000000",
    moveCalls: ["0x1::devnet_smoke::swap_smoke_for_sui"],
    eventTypes: [
      "0x1::events::OracleQuorumUsed",
      "0x1::events::SwapExecuted"
    ]
  });
});

test("verifySuiCliTxEvidenceConfigFile queries configured setup evidence", () => {
  const calls = [];
  const result = verifySuiCliTxEvidenceConfigFile({
    config: fixtureConfig(),
    setupName: "brownfiPackage",
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return txBlockResult({
        digest: SETUP_DIGEST,
        moveCalls: [],
        eventTypes: []
      });
    }
  });

  assert.equal(calls[0].command, "sui");
  assert.deepEqual(calls[0].args, [
    "client",
    "--client.env",
    "devnet",
    "tx-block",
    SETUP_DIGEST,
    "--json"
  ]);
  assert.deepEqual(result, {
    txName: "setup:brownfiPackage",
    digest: SETUP_DIGEST,
    status: "success",
    checkpoint: "123",
    timestampMs: "1780000000000",
    moveCalls: [],
    eventTypes: []
  });
});

test("verifySuiCliTxEvidenceConfigFile verifies configured setup object changes", () => {
  const calls = [];
  const result = verifySuiCliTxEvidenceConfigFile({
    config: fixtureConfig(),
    setupName: "pool",
    rpcUrl: "https://fullnode.devnet.sui.io:443",
    execFileSync(command, args) {
      calls.push({ command, args });
      return JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: JSON.parse(txBlockResult({
          digest: SETUP_DIGEST,
          moveCalls: [],
          eventTypes: []
        }))
      });
    }
  });

  const payload = JSON.parse(calls[0].args[calls[0].args.indexOf("--data") + 1]);
  assert.equal(payload.params[1].showObjectChanges, true);
  assert.equal(result.digest, SETUP_DIGEST);
});

test("verifySuiCliTxEvidenceConfigFile can verify every configured setup and route evidence entry", () => {
  const calls = [];
  const result = verifySuiCliTxEvidenceConfigFile({
    config: fixtureConfig(),
    all: true,
    execFileSync(command, args) {
      calls.push({ command, args });
      const digest = args[args.indexOf("tx-block") + 1];
      return txBlockResult({
        digest,
        moveCalls: digest === SWAP_DIGEST ? ["0x1::devnet_smoke::swap_smoke_for_sui"] : [],
        eventTypes:
          digest === SWAP_DIGEST
            ? ["0x1::events::OracleQuorumUsed", "0x1::events::SwapExecuted"]
            : []
      });
    }
  });

  assert.deepEqual(
    result.map((entry) => entry.txName),
    ["setup:brownfiPackage", "setup:pool", "swap"]
  );
  assert.deepEqual(
    calls.map((call) => call.args[call.args.indexOf("tx-block") + 1]),
    [SETUP_DIGEST, SETUP_DIGEST, SWAP_DIGEST]
  );
});

test("verifySuiCliTxEvidenceConfigFile rejects missing configured setup object changes", () => {
  assert.throws(
    () =>
      verifySuiCliTxEvidenceConfigFile({
        config: fixtureConfig(),
        setupName: "pool",
        execFileSync() {
          return txBlockResult({
            digest: SETUP_DIGEST,
            moveCalls: [],
            eventTypes: [],
            objectChanges: [
              {
                type: "created",
                objectId: POOL_ID
              }
            ]
          });
        }
      }),
    new RegExp(`Sui CLI tx evidence setup:pool missing expected object change ${LP_COIN_ID}`)
  );
});

test("verifySuiTxEvidence verifies a generated tx evidence entry without a matrix file", () => {
  const calls = [];
  const result = verifySuiTxEvidence({
    network: "devnet",
    txName: "swap",
    evidence: {
      digest: SWAP_DIGEST,
      expectedMoveCalls: ["0x1::devnet_smoke::swap_smoke_for_sui"],
      expectedEventTypes: ["0x1::events::OracleQuorumUsed"]
    },
    execFileSync(command, args) {
      calls.push({ command, args });
      return txBlockResult();
    }
  });

  assert.deepEqual(calls[0].args, [
    "client",
    "--client.env",
    "devnet",
    "tx-block",
    SWAP_DIGEST,
    "--json"
  ]);
  assert.equal(result.digest, SWAP_DIGEST);
});

test("verifySuiCliTxEvidenceConfigFile rejects missing expected events", () => {
  assert.throws(
    () =>
      verifySuiCliTxEvidenceConfigFile({
        config: fixtureConfig(),
        txName: "swap",
        execFileSync() {
          return txBlockResult({
            eventTypes: ["0x1::events::OracleQuorumUsed"]
          });
        }
      }),
    /Sui CLI tx evidence swap missing expected event 0x1::events::SwapExecuted/
  );
});

test("verifySuiCliTxEvidenceConfigFile rejects failed tx status", () => {
  assert.throws(
    () =>
      verifySuiCliTxEvidenceConfigFile({
        config: fixtureConfig(),
        txName: "swap",
        execFileSync() {
          return txBlockResult({ status: "failure" });
        }
      }),
    /Sui CLI tx evidence failed for swap: failure/
  );
});

test("verifySuiCliTxEvidenceConfigFile can run Sui through rtk", () => {
  const calls = [];
  verifySuiCliTxEvidenceConfigFile({
    config: fixtureConfig(),
    txName: "swap",
    useRtk: true,
    execFileSync(command, args) {
      calls.push({ command, args });
      return txBlockResult();
    }
  });

  assert.equal(calls[0].command, "rtk");
  assert.deepEqual(calls[0].args.slice(0, 4), ["sui", "client", "--client.env", "devnet"]);
});

test("verifySuiCliTxEvidenceConfigFile can query tx evidence through Sui JSON-RPC", () => {
  const calls = [];
  const result = verifySuiCliTxEvidenceConfigFile({
    config: fixtureConfig(),
    txName: "swap",
    rpcUrl: "https://fullnode.devnet.sui.io:443",
    execFileSync(command, args, options) {
      calls.push({ command, args, options });
      return JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: JSON.parse(txBlockResult())
      });
    }
  });

  assert.equal(calls[0].command, "curl");
  assert.deepEqual(calls[0].args.slice(0, 7), [
    "-sS",
    "-m",
    "20",
    "-X",
    "POST",
    "-H",
    "content-type:application/json"
  ]);
  assert.equal(calls[0].args.at(-1), "https://fullnode.devnet.sui.io:443");
  const payload = JSON.parse(calls[0].args[calls[0].args.indexOf("--data") + 1]);
  assert.equal(payload.method, "sui_getTransactionBlock");
  assert.equal(payload.params[0], SWAP_DIGEST);
  assert.deepEqual(payload.params[1], {
    showInput: true,
    showEffects: true,
    showEvents: true,
    showObjectChanges: true
  });
  assert.equal(calls[0].options.encoding, "utf8");
  assert.equal(result.digest, SWAP_DIGEST);
});

test("verifySuiTxEvidence retries transient Sui JSON-RPC tx indexing misses", () => {
  const calls = [];
  const result = verifySuiTxEvidence({
    txName: "swap",
    evidence: {
      digest: SWAP_DIGEST,
      expectedMoveCalls: ["0x1::devnet_smoke::swap_smoke_for_sui"],
      expectedEventTypes: ["0x1::events::OracleQuorumUsed"]
    },
    rpcUrl: "https://fullnode.devnet.sui.io:443",
    rpcRetries: 1,
    rpcRetryDelayMs: 0,
    execFileSync(command, args) {
      calls.push({ command, args });
      if (calls.length === 1) {
        return JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          error: {
            code: -32602,
            message: `Could not find the referenced transaction [TransactionDigest(${SWAP_DIGEST})]`
          }
        });
      }
      return JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        result: JSON.parse(txBlockResult())
      });
    }
  });

  assert.equal(calls.length, 2);
  assert.equal(result.digest, SWAP_DIGEST);
});

test("verifySuiCliTxEvidenceConfigFile rejects Sui JSON-RPC errors", () => {
  assert.throws(
    () =>
      verifySuiCliTxEvidenceConfigFile({
        config: fixtureConfig(),
        txName: "swap",
        rpcUrl: "https://fullnode.devnet.sui.io:443",
        execFileSync() {
          return JSON.stringify({
            jsonrpc: "2.0",
            id: 1,
            error: {
              code: -32000,
              message: "transaction not found"
            }
          });
        }
      }),
    /Sui JSON-RPC tx evidence failed for swap: -32000 transaction not found/
  );
});

test("verifySuiCliTxEvidenceConfigFile can verify a pre-fetched tx JSON file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-sui-cli-tx-json-"));
  const txJsonFile = path.join(root, "swap.json");
  fs.writeFileSync(txJsonFile, txBlockResult());

  const calls = [];
  const result = verifySuiCliTxEvidenceConfigFile({
    config: fixtureConfig(),
    txName: "swap",
    txJsonFile,
    execFileSync(command, args) {
      calls.push({ command, args });
      throw new Error("should not query Sui CLI when txJsonFile is provided");
    }
  });

  assert.deepEqual(calls, []);
  assert.equal(result.digest, SWAP_DIGEST);
});

test("verifySuiCliTxEvidenceConfigFile rejects all evidence with one tx JSON file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-sui-cli-tx-json-all-"));
  const txJsonFile = path.join(root, "setup.json");
  fs.writeFileSync(txJsonFile, txBlockResult({
    digest: SETUP_DIGEST,
    moveCalls: [],
    eventTypes: []
  }));

  assert.throws(
    () =>
      verifySuiCliTxEvidenceConfigFile({
        config: fixtureConfig(),
        all: true,
        txJsonFile
      }),
    /Cannot verify all launch matrix evidence entries from one tx JSON file/
  );
});

test("verifySuiCliTxEvidenceConfigFile rejects mismatched tx JSON digest", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-sui-cli-tx-json-"));
  const txJsonFile = path.join(root, "swap.json");
  fs.writeFileSync(txJsonFile, txBlockResult({ digest: OTHER_DIGEST }));

  assert.throws(
    () =>
      verifySuiCliTxEvidenceConfigFile({
        config: fixtureConfig(),
        txName: "swap",
        txJsonFile
      }),
    new RegExp(
      `Sui CLI tx evidence swap digest mismatch: expected ${SWAP_DIGEST}, got ${OTHER_DIGEST}`
    )
  );
});
