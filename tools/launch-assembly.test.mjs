#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { materializeLaunchMatrix } from "./materialize-launch-matrix.mjs";
import { materializePythLaunchPoolConfig } from "./materialize-pyth-launch-pool.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function id(fill) {
  return `0x${fill.repeat(64)}`;
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-assembly-"));
  const publishResult = path.join(root, "brownfi-publish.json");
  writeJson(publishResult, {
    status: "success",
    packageId: id("a"),
    publishObjects: {
      status: "success",
      transactionDigest: "BROWNFI_PUBLISH_DIGEST",
      packageId: id("a"),
      factory: id("b"),
      oracleAdapter: id("c"),
      poolCreatorCap: id("d"),
      caps: {
        PoolCreatorCap: id("d"),
        PauseCap: id("f")
      }
    }
  });
  const testCoins = path.join(root, "test-coins.json");
  writeJson(testCoins, {
    status: "success",
    packageId: id("e"),
    replacements: {
      TYPE_A: `${id("e")}::coin_a::COIN_A`,
      TYPE_B: `${id("e")}::coin_b::COIN_B`,
      INIT_COIN_A: id("1"),
      INIT_COIN_B: id("2"),
      INPUT_COIN: id("3"),
      INPUT_COIN_A: id("4"),
      INPUT_COIN_B: id("5"),
      TOKEN_A_DECIMALS: 9,
      TOKEN_B_DECIMALS: 9
    }
  });
  const feeds = path.join(root, "feeds.json");
  writeJson(feeds, {
    replacements: {
      BASE_FEED_ID: id("6"),
      QUOTE_FEED_ID: id("7")
    }
  });
  const poolResult = path.join(root, "pool-result.json");
  writeJson(poolResult, {
    status: "success",
    packageId: id("a"),
    pool: id("8"),
    lpCoin: id("9"),
    replacements: {
      POOL: id("8"),
      LP_COIN: id("9")
    }
  });
  return { root, publishResult, testCoins, feeds, poolResult };
}

function routeCaseByName(matrix, name) {
  const routeCase = matrix.routeCases.find((item) => item.name === name);
  assert.ok(routeCase, `missing route case ${name}`);
  return routeCase;
}

function quoteCaseByName(matrix, name) {
  const quoteCase = matrix.quoteCases.find((item) => item.name === name);
  assert.ok(quoteCase, `missing quote case ${name}`);
  return quoteCase;
}

test("pyth upgraded launch artifacts assemble from test coins and feed values", () => {
  const { root, publishResult, testCoins, feeds, poolResult } = fixtureRoot();
  const poolOut = path.join(root, "pool.json");
  const matrixOut = path.join(root, "matrix.json");

  materializePythLaunchPoolConfig({
    template: "configs/launch/pyth-upgraded-testnet.pool.example.json",
    publishObjects: publishResult,
    values: [testCoins, feeds],
    out: poolOut
  });
  materializeLaunchMatrix({
    template: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
    launchConfig: "configs/launch/pyth-upgraded-testnet.json",
    publishResult,
    poolResult,
    values: [testCoins, feeds],
    out: matrixOut
  });

  const pool = JSON.parse(fs.readFileSync(poolOut, "utf8"));
  const matrix = JSON.parse(fs.readFileSync(matrixOut, "utf8"));
  assert.equal(pool.packageId, id("a"));
  assert.equal(pool.typeA, `${id("e")}::coin_a::COIN_A`);
  assert.equal(pool.typeB, `${id("e")}::coin_b::COIN_B`);
  assert.equal(pool.pauseCap, id("f"));
  assert.equal(pool.flashEnabled, true);
  assert.equal(pool.initAAmount, "10000000000");
  assert.equal(pool.initBAmount, "10000000000");
  assert.deepEqual(pool.feedIds, [id("6"), id("7")]);
  const exactInput = routeCaseByName(matrix, "pyth upgraded testnet exact input route");
  const exactOutput = routeCaseByName(matrix, "pyth upgraded testnet exact output route");
  const exactOutputResults = routeCaseByName(
    matrix,
    "pyth upgraded testnet exact output results route"
  );
  const addLiquidity = routeCaseByName(matrix, "pyth upgraded testnet add liquidity");
  const removeLiquidity = routeCaseByName(matrix, "pyth upgraded testnet remove liquidity");
  const zapInA = routeCaseByName(matrix, "pyth upgraded testnet zap in A");
  const zapInB = routeCaseByName(matrix, "pyth upgraded testnet zap in B");
  const zapOutA = routeCaseByName(matrix, "pyth upgraded testnet zap out A");
  const zapOutB = routeCaseByName(matrix, "pyth upgraded testnet zap out B");
  const flashA = routeCaseByName(matrix, "pyth upgraded testnet flash borrow A");
  const flashB = routeCaseByName(matrix, "pyth upgraded testnet flash borrow B");
  assert.equal(exactInput.pairs[0].packageId, id("a"));
  assert.equal(exactInput.pairs[0].pool, id("8"));
  assert.equal(exactInput.input, id("5"));
  assert.equal(exactOutput.input, id("5"));
  assert.equal(exactOutput.amountOut, "1");
  assert.equal(exactOutputResults.kind, "exact-output-results");
  assert.equal(exactOutputResults.input, id("5"));
  assert.equal(exactOutputResults.amountOut, "1");
  assert.equal(addLiquidity.input, id("4"));
  assert.equal(addLiquidity.inputB, id("5"));
  assert.equal(removeLiquidity.input, id("9"));
  assert.equal(removeLiquidity.inputAmount, "1000000");
  assert.equal(zapInA.input, id("4"));
  assert.equal(zapInA.minBFromSwap, "1");
  assert.equal(zapInB.input, id("5"));
  assert.equal(zapInB.minAFromSwap, "1");
  assert.equal(zapOutA.input, id("9"));
  assert.equal(zapOutA.inputAmount, "1000000");
  assert.equal(zapOutB.input, id("9"));
  assert.equal(zapOutB.minOut, "1");
  assert.equal(flashA.kind, "flash-borrow-a");
  assert.equal(flashA.amount, "1000");
  assert.equal(flashA.feeCoin, id("4"));
  assert.equal(flashA.feeCoinAmount, "1");
  assert.equal(flashB.kind, "flash-borrow-b");
  assert.equal(flashB.amount, "1000");
  assert.equal(flashB.feeCoin, id("5"));
  assert.equal(flashB.feeCoinAmount, "1");
  assert.equal(
    quoteCaseByName(matrix, "pyth upgraded testnet exact output quote").amountOut,
    "1"
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth upgraded testnet exact output round-trip quote").amountOut,
    "1"
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth upgraded testnet max-bound quote").kind,
    "max-bound-quote"
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth upgraded testnet max-bound quote").amountIn,
    undefined
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth upgraded testnet max-bound quote").amountOut,
    undefined
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth upgraded testnet exact input raw quote").amountIn,
    "1000000"
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth upgraded testnet exact output raw quote").amountOut,
    "1"
  );
});

test("pyth current launch artifacts assemble from test coins and live feed values", () => {
  const { root, publishResult, testCoins, poolResult } = fixtureRoot();
  const poolOut = path.join(root, "pool-current.json");
  const matrixOut = path.join(root, "matrix-current.json");
  const feeds = "configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json";

  materializePythLaunchPoolConfig({
    template: "configs/launch/pyth-current-testnet.pool.example.json",
    publishObjects: publishResult,
    values: [testCoins, feeds],
    out: poolOut
  });
  materializeLaunchMatrix({
    template: "configs/launch/pyth-current-testnet.matrix.example.json",
    launchConfig: "configs/launch/pyth-current-testnet.json",
    publishResult,
    poolResult,
    values: [testCoins, feeds],
    out: matrixOut
  });

  const feedValues = JSON.parse(fs.readFileSync(feeds, "utf8")).replacements;
  const pool = JSON.parse(fs.readFileSync(poolOut, "utf8"));
  const matrix = JSON.parse(fs.readFileSync(matrixOut, "utf8"));
  assert.equal(pool.packageId, id("a"));
  assert.equal(pool.typeA, `${id("e")}::coin_a::COIN_A`);
  assert.equal(pool.typeB, `${id("e")}::coin_b::COIN_B`);
  assert.equal(pool.pauseCap, id("f"));
  assert.equal(pool.flashEnabled, true);
  assert.deepEqual(pool.feedIds, [feedValues.BASE_FEED_ID, feedValues.QUOTE_FEED_ID]);
  assert.equal(matrix.providerIds[0], "pyth");
  const exactInput = routeCaseByName(matrix, "pyth current testnet exact input route");
  const exactOutput = routeCaseByName(matrix, "pyth current testnet exact output route");
  const exactOutputResults = routeCaseByName(
    matrix,
    "pyth current testnet exact output results route"
  );
  const addLiquidity = routeCaseByName(matrix, "pyth current testnet add liquidity");
  const removeLiquidity = routeCaseByName(matrix, "pyth current testnet remove liquidity");
  const zapInA = routeCaseByName(matrix, "pyth current testnet zap in A");
  const zapInB = routeCaseByName(matrix, "pyth current testnet zap in B");
  const zapOutA = routeCaseByName(matrix, "pyth current testnet zap out A");
  const zapOutB = routeCaseByName(matrix, "pyth current testnet zap out B");
  const flashA = routeCaseByName(matrix, "pyth current testnet flash borrow A");
  const flashB = routeCaseByName(matrix, "pyth current testnet flash borrow B");
  assert.equal(exactInput.pairs[0].packageId, id("a"));
  assert.equal(exactInput.pairs[0].pool, id("8"));
  assert.deepEqual(exactInput.pairs[0].feedIds, [
    feedValues.BASE_FEED_ID,
    feedValues.QUOTE_FEED_ID
  ]);
  assert.equal(exactInput.input, id("5"));
  assert.equal(exactOutput.input, id("5"));
  assert.deepEqual(exactOutput.pairs[0].feedIds, [
    feedValues.BASE_FEED_ID,
    feedValues.QUOTE_FEED_ID
  ]);
  assert.equal(exactOutput.amountOut, "1");
  assert.equal(exactOutputResults.kind, "exact-output-results");
  assert.equal(exactOutputResults.input, id("5"));
  assert.equal(exactOutputResults.amountOut, "1");
  assert.deepEqual(exactOutputResults.pairs[0].feedIds, [
    feedValues.BASE_FEED_ID,
    feedValues.QUOTE_FEED_ID
  ]);
  assert.equal(addLiquidity.input, id("4"));
  assert.equal(addLiquidity.inputB, id("5"));
  assert.equal(removeLiquidity.input, id("9"));
  assert.equal(removeLiquidity.inputAmount, "1000000");
  assert.equal(zapInA.input, id("4"));
  assert.equal(zapInA.minBFromSwap, "1");
  assert.equal(zapInB.input, id("5"));
  assert.equal(zapInB.minAFromSwap, "1");
  assert.equal(zapOutA.input, id("9"));
  assert.equal(zapOutA.inputAmount, "1000000");
  assert.equal(zapOutB.input, id("9"));
  assert.equal(zapOutB.minOut, "1");
  assert.equal(flashA.kind, "flash-borrow-a");
  assert.equal(flashA.amount, "1000");
  assert.equal(flashA.feeCoin, id("4"));
  assert.equal(flashA.feeCoinAmount, "1");
  assert.equal(flashB.kind, "flash-borrow-b");
  assert.equal(flashB.amount, "1000");
  assert.equal(flashB.feeCoin, id("5"));
  assert.equal(flashB.feeCoinAmount, "1");
  assert.equal(
    quoteCaseByName(matrix, "pyth current testnet exact input raw quote").amountIn,
    "1000000"
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth current testnet exact output quote").amountOut,
    "1"
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth current testnet exact output round-trip quote").amountOut,
    "1"
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth current testnet max-bound quote").kind,
    "max-bound-quote"
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth current testnet max-bound quote").amountIn,
    undefined
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth current testnet max-bound quote").amountOut,
    undefined
  );
  assert.equal(
    quoteCaseByName(matrix, "pyth current testnet exact output raw quote").amountOut,
    "1"
  );
});

test("pyth current protocol-fee pool artifact assembles from publish caps and fee recipient", () => {
  const { root, publishResult, testCoins } = fixtureRoot();
  const parsedPublish = JSON.parse(fs.readFileSync(publishResult, "utf8"));
  parsedPublish.publishObjects.caps.FeeCap = id("a1");
  parsedPublish.publishObjects.caps.RiskCap = id("a2");
  writeJson(publishResult, parsedPublish);
  const feeValues = path.join(root, "fee-values.json");
  writeJson(feeValues, {
    replacements: {
      FEE_TO: id("a3")
    }
  });
  const poolOut = path.join(root, "pool-current-protocol-fee.json");
  const feeds = "configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json";

  materializePythLaunchPoolConfig({
    template: "configs/launch/pyth-current-testnet.protocol-fee.pool.example.json",
    publishObjects: publishResult,
    values: [testCoins, feeds, feeValues],
    out: poolOut
  });

  const pool = JSON.parse(fs.readFileSync(poolOut, "utf8"));
  assert.equal(pool.packageId, id("a"));
  assert.equal(pool.typeA, `${id("e")}::coin_a::COIN_A`);
  assert.equal(pool.typeB, `${id("e")}::coin_b::COIN_B`);
  assert.equal(pool.pauseCap, id("f"));
  assert.equal(pool.feeCap, id("a1"));
  assert.equal(pool.riskCap, id("a2"));
  assert.equal(pool.feeTo, id("a3"));
  assert.equal(pool.protocolFee, 20000000);
  assert.equal(pool.flashEnabled, true);
});

test("pyth upgraded feed values example declares only feed replacements", () => {
  const values = JSON.parse(
    fs.readFileSync("configs/launch/pyth-upgraded-testnet.feeds.example.json", "utf8")
  );

  assert.deepEqual(Object.keys(values.replacements).sort(), [
    "BASE_FEED_ID",
    "QUOTE_FEED_ID"
  ]);
});

test("pyth current live feed values declare only feed replacements", () => {
  const values = JSON.parse(
    fs.readFileSync("configs/launch/pyth-current-testnet.feeds.beta-usdt-sdai.json", "utf8")
  );

  assert.deepEqual(Object.keys(values.replacements).sort(), [
    "BASE_FEED_ID",
    "QUOTE_FEED_ID"
  ]);
});

test("pyth current protocol-fee values example declares only fee recipient replacement", () => {
  const values = JSON.parse(
    fs.readFileSync("configs/launch/pyth-current-testnet.protocol-fee.values.example.json", "utf8")
  );

  assert.deepEqual(Object.keys(values.replacements).sort(), ["FEE_TO"]);
});
