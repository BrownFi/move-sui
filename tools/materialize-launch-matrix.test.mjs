#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { materializeLaunchMatrix } from "./materialize-launch-matrix.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function id(fill) {
  return `0x${fill.repeat(64)}`;
}

function feed(fill) {
  return `0x${fill.repeat(64)}`;
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-materialize-matrix-"));
  const publishResult = path.join(root, "publish.json");
  writeJson(publishResult, {
    packageId: id("a"),
    transactionDigest: "PUBLISH_DIGEST"
  });
  const poolResult = path.join(root, "pool.json");
  writeJson(poolResult, {
    packageId: id("a"),
    pool: id("b"),
    lpCoin: id("f"),
    transactionDigest: "POOL_DIGEST",
    replacements: {
      POOL: id("b"),
      LP_COIN: id("f")
    }
  });
  const values = path.join(root, "values.json");
  writeJson(values, {
    replacements: {
      TYPE_A: `${id("7")}::coin_a::COIN_A`,
      TYPE_B: `${id("8")}::coin_b::COIN_B`,
      INPUT_COIN: id("c"),
      INPUT_COIN_A: id("d"),
      INPUT_COIN_B: id("e"),
      BASE_FEED_ID: feed("1"),
      QUOTE_FEED_ID: feed("2")
    }
  });
  return { root, publishResult, poolResult, values };
}

function splitValuesFixture(root) {
  const tokenValues = path.join(root, "token-values.json");
  writeJson(tokenValues, {
    replacements: {
      TYPE_A: `${id("7")}::coin_a::COIN_A`,
      TYPE_B: `${id("8")}::coin_b::COIN_B`,
      INPUT_COIN: id("c"),
      INPUT_COIN_A: id("d"),
      INPUT_COIN_B: id("e")
    }
  });
  const feedValues = path.join(root, "feed-values.json");
  writeJson(feedValues, {
    replacements: {
      BASE_FEED_ID: feed("1"),
      QUOTE_FEED_ID: feed("2")
    }
  });
  return { tokenValues, feedValues };
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

test("materializeLaunchMatrix replaces template placeholders and validates live values", () => {
  const { root, publishResult, poolResult, values } = fixtureRoot();
  const out = path.join(root, "live-matrix.json");

  const result = materializeLaunchMatrix({
    template: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
    launchConfig: "configs/launch/pyth-upgraded-testnet.json",
    publishResult,
    poolResult,
    values,
    out
  });

  const matrix = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(result.status, "success");
  assert.equal(result.packageId, id("a"));
  assert.equal(result.validation.routeCaseCount, 11);
  assert.equal(result.validation.quoteCaseCount, 6);
  const exactInput = routeCaseByName(matrix, "pyth upgraded testnet exact input route");
  const exactOutput = routeCaseByName(matrix, "pyth upgraded testnet exact output route");
  const addLiquidity = routeCaseByName(matrix, "pyth upgraded testnet add liquidity");
  const removeLiquidity = routeCaseByName(matrix, "pyth upgraded testnet remove liquidity");
  assert.equal(exactInput.path[0], `${id("8")}::coin_b::COIN_B`);
  assert.equal(exactInput.path[1], `${id("7")}::coin_a::COIN_A`);
  assert.equal(exactInput.pairs[0].packageId, id("a"));
  assert.equal(exactInput.pairs[0].typeA, `${id("7")}::coin_a::COIN_A`);
  assert.equal(exactInput.pairs[0].typeB, `${id("8")}::coin_b::COIN_B`);
  assert.equal(exactInput.pairs[0].pool, id("b"));
  assert.deepEqual(exactInput.pairs[0].feedIds, [feed("1"), feed("2")]);
  assert.equal(exactInput.input, id("e"));
  assert.equal(exactOutput.input, id("e"));
  assert.equal(exactOutput.amountOut, "1");
  assert.equal(addLiquidity.input, id("d"));
  assert.equal(addLiquidity.inputB, id("e"));
  assert.equal(removeLiquidity.input, id("f"));
  assert.equal(quoteCaseByName(matrix, "pyth upgraded testnet exact output quote").amountOut, "1");
});

test("materializeLaunchMatrix rejects if placeholders remain", () => {
  const { root, publishResult, poolResult, values } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(values, "utf8"));
  delete parsed.replacements.INPUT_COIN_B;
  fs.writeFileSync(values, `${JSON.stringify(parsed, null, 2)}\n`);
  const out = path.join(root, "live-matrix.json");

  assert.throws(
    () =>
      materializeLaunchMatrix({
        template: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
        launchConfig: "configs/launch/pyth-upgraded-testnet.json",
        publishResult,
        poolResult,
        values,
        out
      }),
    /Launch matrix config contains placeholder value at routeCases\[0\]\.input: 0xINPUT_COIN_B/
  );
  assert.equal(fs.existsSync(out), false);
});

test("materializeLaunchMatrix rejects conflicting package replacements", () => {
  const { root, publishResult, values } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(values, "utf8"));
  parsed.replacements.BROWNFI_PACKAGE = id("9");
  fs.writeFileSync(values, `${JSON.stringify(parsed, null, 2)}\n`);

  assert.throws(
    () =>
      materializeLaunchMatrix({
        template: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
        publishResult,
        values,
        out: path.join(root, "live-matrix.json")
      }),
    /Publish result packageId conflicts with replacement BROWNFI_PACKAGE/
  );
});

test("materializeLaunchMatrix rejects conflicting pool-result replacements", () => {
  const { root, publishResult, poolResult, values } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(values, "utf8"));
  parsed.replacements.POOL = id("9");
  fs.writeFileSync(values, `${JSON.stringify(parsed, null, 2)}\n`);

  assert.throws(
    () =>
      materializeLaunchMatrix({
        template: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
        publishResult,
        poolResult,
        values,
        out: path.join(root, "live-matrix.json")
      }),
    /Pool result POOL conflicts with replacement POOL/
  );
});

test("materializeLaunchMatrix can merge multiple values files", () => {
  const { root, publishResult, poolResult } = fixtureRoot();
  const { tokenValues, feedValues } = splitValuesFixture(root);
  const out = path.join(root, "live-matrix-split-values.json");

  const result = materializeLaunchMatrix({
    template: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
    launchConfig: "configs/launch/pyth-upgraded-testnet.json",
    publishResult,
    poolResult,
    values: [tokenValues, feedValues],
    out
  });

  const matrix = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(result.status, "success");
  const exactInput = routeCaseByName(matrix, "pyth upgraded testnet exact input route");
  const exactOutput = routeCaseByName(matrix, "pyth upgraded testnet exact output route");
  const addLiquidity = routeCaseByName(matrix, "pyth upgraded testnet add liquidity");
  assert.equal(exactInput.path[0], `${id("8")}::coin_b::COIN_B`);
  assert.equal(exactInput.path[1], `${id("7")}::coin_a::COIN_A`);
  assert.deepEqual(exactInput.pairs[0].feedIds, [feed("1"), feed("2")]);
  assert.equal(exactInput.input, id("e"));
  assert.equal(exactOutput.input, id("e"));
  assert.equal(exactOutput.amountOut, "1");
  assert.equal(addLiquidity.input, id("d"));
  assert.equal(addLiquidity.inputB, id("e"));
});

test("pyth upgraded testnet values example declares the shared launch replacements", () => {
  const values = JSON.parse(
    fs.readFileSync("configs/launch/pyth-upgraded-testnet.values.example.json", "utf8")
  );

  assert.deepEqual(Object.keys(values.replacements).sort(), [
    "BASE_FEED_ID",
    "INPUT_COIN",
    "INPUT_COIN_A",
    "INPUT_COIN_B",
    "INIT_COIN_A",
    "INIT_COIN_B",
    "QUOTE_FEED_ID",
    "TOKEN_A_DECIMALS",
    "TOKEN_B_DECIMALS",
    "TYPE_A",
    "TYPE_B"
  ].sort());
});
