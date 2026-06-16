#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function fixtureRoot() {
  return fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-pyth-launch-sequence-"));
}

test("parsePythLaunchSequenceArgs accepts tx evidence RPC retry options", async () => {
  const { parsePythLaunchSequenceArgs } = await import("./run-pyth-launch-sequence.mjs");

  const args = parsePythLaunchSequenceArgs([
    "--network",
    "testnet",
    "--feeds",
    "feeds.json",
    "--runtime",
    "runtime.mjs",
    "--out-dir",
    "out",
    "--verify-tx-evidence",
    "--tx-evidence-rpc-url",
    "https://fullnode.testnet.sui.io:443",
    "--tx-evidence-rpc-retries",
    "12",
    "--tx-evidence-rpc-retry-delay-ms",
    "1000"
  ]);

  assert.deepEqual(args.txEvidenceVerification, {
    rpcUrl: "https://fullnode.testnet.sui.io:443",
    rpcRetries: "12",
    rpcRetryDelayMs: "1000"
  });
});

test("parsePythLaunchSequenceArgs accepts explicit artifact resume", async () => {
  const { parsePythLaunchSequenceArgs } = await import("./run-pyth-launch-sequence.mjs");

  const args = parsePythLaunchSequenceArgs([
    "--network",
    "testnet",
    "--feeds",
    "feeds.json",
    "--runtime",
    "runtime.mjs",
    "--out-dir",
    "out",
    "--resume-existing-artifacts"
  ]);

  assert.equal(args.resumeExistingArtifacts, true);
});

test("parsePythLaunchSequenceArgs accepts explicit runtime config", async () => {
  const { parsePythLaunchSequenceArgs } = await import("./run-pyth-launch-sequence.mjs");

  const args = parsePythLaunchSequenceArgs([
    "--network",
    "testnet",
    "--feeds",
    "feeds.json",
    "--runtime",
    "runtime.mjs",
    "--runtime-config",
    "runtime.local.json",
    "--out-dir",
    "out"
  ]);

  assert.equal(args.runtimeConfig, "runtime.local.json");
});

test("parsePythLaunchSequenceArgs defaults to the verified current-Pyth launch profile", async () => {
  const { parsePythLaunchSequenceArgs } = await import("./run-pyth-launch-sequence.mjs");

  const args = parsePythLaunchSequenceArgs([
    "--network",
    "testnet",
    "--feeds",
    "configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json",
    "--runtime",
    "tools/pyth-launch-runtime.mjs",
    "--out-dir",
    "out"
  ]);

  assert.equal(args.launchConfig, "configs/launch/pyth-current-testnet.json");
  assert.equal(args.poolTemplate, "configs/launch/pyth-current-testnet.pool.example.json");
  assert.equal(args.matrixTemplate, "configs/launch/pyth-current-testnet.matrix.example.json");
});

test("runPythLaunchSequence verifies setup evidence before submitting routes when requested", async () => {
  const { runPythLaunchSequence } = await import("./run-pyth-launch-sequence.mjs");
  const root = fixtureRoot();
  const outDir = path.join(root, "out");
  const calls = [];

  const testCoins = {
    status: "success",
    transactionDigest: "digest-testcoins",
    packageId: "0xtestcoins",
    replacements: {
      TYPE_A: "0xtestcoins::coin_a::COIN_A",
      TYPE_B: "0xtestcoins::coin_b::COIN_B",
      INIT_COIN_A: "0xinita",
      INIT_COIN_B: "0xinitb",
      INPUT_COIN: "0xinput",
      INPUT_COIN_A: "0xinputa",
      INPUT_COIN_B: "0xinputb",
      TOKEN_A_DECIMALS: 9,
      TOKEN_B_DECIMALS: 9
    }
  };
  const publish = {
    status: "success",
    transactionDigest: "digest-brownfi",
    packageId: "0xbrownfi",
    publishObjects: {
      packageId: "0xbrownfi",
      factory: "0xfactory",
      oracleAdapter: "0xoracle",
      poolCreatorCap: "0xpoolcap"
    }
  };
  const poolCreate = {
    status: "success",
    transactionDigest: "digest-pool",
    packageId: "0xbrownfi",
    pool: "0xpool",
    lpCoin: "0xlp",
    replacements: {
      POOL: "0xpool",
      LP_COIN: "0xlp"
    },
    txEvidence: {
      name: "pyth create pool",
      digest: "digest-pool",
      expectedMoveCalls: [
        "0xbrownfi::swap::create_pool_with_coins_and_transfer_lp_to_sender"
      ],
      expectedEventTypes: [
        "0xbrownfi::events::PoolCreated",
        "0xbrownfi::events::Sync"
      ]
    },
    flashEnable: {
      status: "success",
      transactionDigest: "digest-flash-enable",
      txEvidence: {
        name: "pyth enable flash",
        digest: "digest-flash-enable",
        expectedMoveCalls: [
          "0xbrownfi::admin::set_pool_flash_enabled"
        ],
        expectedEventTypes: [
          "0xbrownfi::events::PoolGateStateChanged"
        ]
      }
    }
  };
  const submit = {
    summary: {
      routeCaseCount: 1,
      providerIds: ["pyth"],
      routeCases: []
    },
    txEvidence: [],
    txVerification: []
  };

  const report = await runPythLaunchSequence({
    root,
    network: "testnet",
    launchConfig: "configs/launch/pyth-current-testnet.json",
    poolTemplate: "configs/launch/pyth-current-testnet.pool.example.json",
    matrixTemplate: "configs/launch/pyth-current-testnet.matrix.example.json",
    feeds: "configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json",
    runtime: "tools/pyth-launch-runtime.mjs",
    outDir,
    txEvidenceVerification: {
      rpcUrl: "https://fullnode.testnet.sui.io:443",
      useRtk: true,
      rpcRetries: "2",
      rpcRetryDelayMs: "10"
    },
    dependencies: {
      publishLaunchTestCoins(options) {
        calls.push(["publish-test-coins", options]);
        return testCoins;
      },
      publishLaunchPackage(options) {
        calls.push(["publish-brownfi", options]);
        return publish;
      },
      materializePythLaunchPoolConfig(options) {
        calls.push(["materialize-pool", options]);
        return { status: "success", out: options.out };
      },
      async createPythLaunchPoolConfig(options) {
        calls.push(["create-pool", options]);
        return poolCreate;
      },
      verifySuiTxEvidence(options) {
        calls.push(["verify-setup", options]);
        return {
          txName: options.txName,
          digest: options.evidence.digest,
          status: "success"
        };
      },
      materializeLaunchMatrix(options) {
        calls.push(["materialize-matrix", options]);
        return { status: "success", out: options.out };
      },
      async submitLaunchMatrixRoutesConfigFile(options) {
        calls.push(["submit-matrix", options]);
        return submit;
      }
    }
  });

  assert.deepEqual(calls.map(([name]) => name), [
    "publish-test-coins",
    "publish-brownfi",
    "materialize-pool",
    "create-pool",
    "verify-setup",
    "verify-setup",
    "verify-setup",
    "verify-setup",
    "materialize-matrix",
    "submit-matrix"
  ]);
  assert.deepEqual(
    calls.slice(4, 8).map(([, options]) => ({
      txName: options.txName,
      evidence: options.evidence,
      rpcUrl: options.rpcUrl,
      useRtk: options.useRtk,
      rpcRetries: options.rpcRetries,
      rpcRetryDelayMs: options.rpcRetryDelayMs
    })),
    [
      {
        txName: "setup:testCoins",
        evidence: {
          packageId: "0xtestcoins",
          digest: "digest-testcoins"
        },
        rpcUrl: "https://fullnode.testnet.sui.io:443",
        useRtk: true,
        rpcRetries: "2",
        rpcRetryDelayMs: "10"
      },
      {
        txName: "setup:brownfiPackage",
        evidence: {
          packageId: "0xbrownfi",
          digest: "digest-brownfi"
        },
        rpcUrl: "https://fullnode.testnet.sui.io:443",
        useRtk: true,
        rpcRetries: "2",
        rpcRetryDelayMs: "10"
      },
      {
        txName: "setup:pool",
        evidence: {
          objectId: "0xpool",
          digest: "digest-pool",
          lpCoin: "0xlp",
          expectedMoveCalls: [
            "0xbrownfi::swap::create_pool_with_coins_and_transfer_lp_to_sender"
          ],
          expectedEventTypes: [
            "0xbrownfi::events::PoolCreated",
            "0xbrownfi::events::Sync"
          ]
        },
        rpcUrl: "https://fullnode.testnet.sui.io:443",
        useRtk: true,
        rpcRetries: "2",
        rpcRetryDelayMs: "10"
      },
      {
        txName: "setup:flashEnable",
        evidence: {
          digest: "digest-flash-enable",
          expectedMoveCalls: [
            "0xbrownfi::admin::set_pool_flash_enabled"
          ],
          expectedEventTypes: [
            "0xbrownfi::events::PoolGateStateChanged"
          ]
        },
        rpcUrl: "https://fullnode.testnet.sui.io:443",
        useRtk: true,
        rpcRetries: "2",
        rpcRetryDelayMs: "10"
      }
    ]
  );
  assert.deepEqual(report.results.setupVerification, [
    {
      txName: "setup:testCoins",
      digest: "digest-testcoins",
      status: "success"
    },
    {
      txName: "setup:brownfiPackage",
      digest: "digest-brownfi",
      status: "success"
    },
    {
      txName: "setup:pool",
      digest: "digest-pool",
      status: "success"
    },
    {
      txName: "setup:flashEnable",
      digest: "digest-flash-enable",
      status: "success"
    }
  ]);
});

test("runPythLaunchSequence writes launch artifacts and submits routes in order", async () => {
  const { runPythLaunchSequence } = await import("./run-pyth-launch-sequence.mjs");
  const root = fixtureRoot();
  const outDir = path.join(root, "out");
  const calls = [];

  const testCoins = {
    status: "success",
    transactionDigest: "digest-testcoins",
    packageId: "0xtestcoins",
    replacements: {
      TYPE_A: "0xtestcoins::coin_a::COIN_A",
      TYPE_B: "0xtestcoins::coin_b::COIN_B",
      INIT_COIN_A: "0xinita",
      INIT_COIN_B: "0xinitb",
      INPUT_COIN: "0xinput",
      INPUT_COIN_A: "0xinputa",
      INPUT_COIN_B: "0xinputb",
      TOKEN_A_DECIMALS: 9,
      TOKEN_B_DECIMALS: 9
    }
  };
  const publish = {
    status: "success",
    transactionDigest: "digest-brownfi",
    packageId: "0xbrownfi",
    publishObjects: {
      packageId: "0xbrownfi",
      factory: "0xfactory",
      oracleAdapter: "0xoracle",
      poolCreatorCap: "0xpoolcap"
    }
  };
  const poolCreate = {
    status: "success",
    transactionDigest: "digest-pool",
    pool: "0xpool",
    lpCoin: "0xlp",
    replacements: {
      POOL: "0xpool",
      LP_COIN: "0xlp"
    },
    txEvidence: {
      name: "pyth create pool",
      digest: "digest-pool",
      expectedMoveCalls: [
        "0xbrownfi::swap::create_pool_with_coins_and_transfer_lp_to_sender"
      ],
      expectedEventTypes: [
        "0xbrownfi::events::PoolCreated",
        "0xbrownfi::events::Sync"
      ]
    }
  };
  const submit = {
    summary: {
      routeCaseCount: 3,
      providerIds: ["pyth"],
      routeCases: []
    },
    txEvidence: []
  };

  const report = await runPythLaunchSequence({
    root,
    network: "testnet",
    launchConfig: "configs/launch/pyth-upgraded-testnet.json",
    poolTemplate: "configs/launch/pyth-upgraded-testnet.pool.example.json",
    matrixTemplate: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
    feeds: "configs/launch/pyth-upgraded-testnet.feeds.json",
    runtime: "tools/pyth-launch-runtime.mjs",
    runtimeConfig: "runtime.local.json",
    outDir,
    useRtk: true,
    gasReadiness: {
      activeAddress: "0xsender",
      minMist: "100000000"
    },
    txEvidenceVerification: {
      rpcUrl: "https://fullnode.testnet.sui.io:443",
      useRtk: true
    },
    expectedModules: ["pool", "router"],
    expectedDependencyIds: ["0x2"],
    dependencies: {
      publishLaunchTestCoins(options) {
        calls.push(["publish-test-coins", options]);
        return testCoins;
      },
      publishLaunchPackage(options) {
        calls.push(["publish-brownfi", options]);
        return publish;
      },
      materializePythLaunchPoolConfig(options) {
        calls.push(["materialize-pool", options]);
        return { status: "success", out: options.out };
      },
      async createPythLaunchPoolConfig(options) {
        calls.push(["create-pool", options]);
        return poolCreate;
      },
      verifySuiTxEvidence(options) {
        calls.push(["verify-setup", options]);
        return {
          txName: options.txName,
          digest: options.evidence.digest,
          status: "success"
        };
      },
      materializeLaunchMatrix(options) {
        calls.push(["materialize-matrix", options]);
        return { status: "success", out: options.out };
      },
      async submitLaunchMatrixRoutesConfigFile(options) {
        calls.push(["submit-matrix", options]);
        return submit;
      }
    }
  });

  assert.deepEqual(calls.map(([name]) => name), [
    "publish-test-coins",
    "publish-brownfi",
    "materialize-pool",
    "create-pool",
    "verify-setup",
    "verify-setup",
    "verify-setup",
    "materialize-matrix",
    "submit-matrix"
  ]);

  const testCoinsOut = path.join(outDir, "test-coins.json");
  const publishOut = path.join(outDir, "brownfi-publish.json");
  const poolConfigOut = path.join(outDir, "pool.json");
  const poolResultOut = path.join(outDir, "pool-result.json");
  const matrixOut = path.join(outDir, "matrix.json");
  const submitOut = path.join(outDir, "submit.json");
  const summaryOut = path.join(outDir, "summary.json");

  assert.deepEqual(readJson(testCoinsOut), testCoins);
  assert.deepEqual(readJson(publishOut), publish);
  assert.deepEqual(readJson(poolResultOut), poolCreate);
  assert.deepEqual(readJson(submitOut), submit);
  assert.deepEqual(readJson(summaryOut), report);

  assert.equal(calls[0][1].packagePath, path.join(root, "packages/launch-test-coins"));
  assert.equal(calls[0][1].network, "testnet");
  assert.equal(calls[0][1].useRtk, true);
  assert.deepEqual(calls[0][1].gasReadiness, {
    activeAddress: "0xsender",
    minMist: "100000000"
  });

  assert.equal(calls[1][1].root, root);
  assert.equal(calls[1][1].config, "configs/launch/pyth-upgraded-testnet.json");
  assert.equal(calls[1][1].out, path.join(outDir, "package"));
  assert.deepEqual(calls[1][1].expectedModules, ["pool", "router"]);
  assert.deepEqual(calls[1][1].expectedDependencyIds, ["0x2"]);

  assert.deepEqual(calls[2][1], {
    template: "configs/launch/pyth-upgraded-testnet.pool.example.json",
    values: [testCoinsOut, "configs/launch/pyth-upgraded-testnet.feeds.json"],
    publishObjects: publishOut,
    out: poolConfigOut
  });
  assert.deepEqual(calls[3][1], {
    config: poolConfigOut,
    runtime: "tools/pyth-launch-runtime.mjs",
    runtimeConfig: "runtime.local.json",
    out: poolResultOut
  });
  assert.deepEqual(calls[7][1], {
    template: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
    values: [testCoinsOut, "configs/launch/pyth-upgraded-testnet.feeds.json"],
    out: matrixOut,
    publishResult: publishOut,
    poolResult: poolResultOut,
    launchConfig: "configs/launch/pyth-upgraded-testnet.json"
  });
  assert.deepEqual(calls[8][1], {
    config: matrixOut,
    launchConfig: "configs/launch/pyth-upgraded-testnet.json",
    runtime: "tools/pyth-launch-runtime.mjs",
    runtimeConfig: "runtime.local.json",
    out: submitOut,
    resumeFrom: submitOut,
    gasReadiness: {
      activeAddress: "0xsender",
      minMist: "100000000",
      useRtk: true
    },
    txEvidenceVerification: {
      rpcUrl: "https://fullnode.testnet.sui.io:443",
      useRtk: true
    }
  });
  assert.deepEqual(report.artifacts, {
    testCoins: testCoinsOut,
    brownfiPublish: publishOut,
    poolConfig: poolConfigOut,
    poolResult: poolResultOut,
    matrix: matrixOut,
    submit: submitOut,
    summary: summaryOut
  });
  assert.equal(report.status, "success");
});

test("runPythLaunchSequence reuses existing successful tx artifacts when requested", async () => {
  const { runPythLaunchSequence } = await import("./run-pyth-launch-sequence.mjs");
  const root = fixtureRoot();
  const outDir = path.join(root, "out");
  fs.mkdirSync(outDir, { recursive: true });
  const calls = [];

  const testCoins = {
    status: "success",
    transactionDigest: "digest-testcoins",
    packageId: "0xtestcoins",
    replacements: {
      TYPE_A: "0xtestcoins::coin_a::COIN_A",
      TYPE_B: "0xtestcoins::coin_b::COIN_B",
      INIT_COIN_A: "0xinita",
      INIT_COIN_B: "0xinitb",
      INPUT_COIN: "0xinput",
      INPUT_COIN_A: "0xinputa",
      INPUT_COIN_B: "0xinputb",
      TOKEN_A_DECIMALS: 9,
      TOKEN_B_DECIMALS: 9
    }
  };
  const publish = {
    status: "success",
    transactionDigest: "digest-brownfi",
    packageId: "0xbrownfi",
    publishObjects: {
      packageId: "0xbrownfi",
      factory: "0xfactory",
      oracleAdapter: "0xoracle",
      poolCreatorCap: "0xpoolcap"
    }
  };
  const poolCreate = {
    status: "success",
    transactionDigest: "digest-pool",
    pool: "0xpool",
    lpCoin: "0xlp",
    replacements: {
      POOL: "0xpool",
      LP_COIN: "0xlp"
    }
  };
  const submit = {
    summary: {
      routeCaseCount: 1,
      providerIds: ["pyth"],
      routeCases: []
    },
    txEvidence: []
  };

  fs.writeFileSync(path.join(outDir, "test-coins.json"), `${JSON.stringify(testCoins)}\n`);
  fs.writeFileSync(path.join(outDir, "brownfi-publish.json"), `${JSON.stringify(publish)}\n`);
  fs.writeFileSync(path.join(outDir, "pool-result.json"), `${JSON.stringify(poolCreate)}\n`);

  const report = await runPythLaunchSequence({
    root,
    network: "testnet",
    launchConfig: "configs/launch/pyth-upgraded-testnet.json",
    poolTemplate: "configs/launch/pyth-upgraded-testnet.pool.example.json",
    matrixTemplate: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
    feeds: "configs/launch/pyth-upgraded-testnet.feeds.json",
    runtime: "tools/pyth-launch-runtime.mjs",
    outDir,
    resumeExistingArtifacts: true,
    dependencies: {
      publishLaunchTestCoins() {
        throw new Error("test coins should not be republished");
      },
      publishLaunchPackage() {
        throw new Error("BrownFi package should not be republished");
      },
      materializePythLaunchPoolConfig(options) {
        calls.push(["materialize-pool", options]);
        return { status: "success", out: options.out };
      },
      async createPythLaunchPoolConfig() {
        throw new Error("pool should not be recreated");
      },
      materializeLaunchMatrix(options) {
        calls.push(["materialize-matrix", options]);
        return { status: "success", out: options.out };
      },
      async submitLaunchMatrixRoutesConfigFile(options) {
        calls.push(["submit-matrix", options]);
        return submit;
      }
    }
  });

  assert.deepEqual(calls.map(([name]) => name), [
    "materialize-pool",
    "materialize-matrix",
    "submit-matrix"
  ]);
  assert.deepEqual(report.results.testCoins, testCoins);
  assert.deepEqual(report.results.brownfiPublish, publish);
  assert.deepEqual(report.results.poolCreate, poolCreate);
});
