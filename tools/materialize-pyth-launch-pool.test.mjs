#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { materializePythLaunchPoolConfig } from "./materialize-pyth-launch-pool.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function id(fill) {
  return `0x${fill.repeat(64)}`;
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-materialize-pyth-pool-"));
  const publishObjects = path.join(root, "publish-objects.json");
  writeJson(publishObjects, {
    packageId: id("a"),
    factory: id("b"),
    poolCreatorCap: id("c"),
    oracleAdapter: id("d")
  });
  const values = path.join(root, "values.json");
  writeJson(values, {
    replacements: {
      TYPE_A: `${id("1")}::coin_a::COIN_A`,
      TYPE_B: `${id("2")}::coin_b::COIN_B`,
      BASE_FEED_ID: id("3"),
      QUOTE_FEED_ID: id("4"),
      INIT_COIN_A: id("5"),
      INIT_COIN_B: id("6"),
      TOKEN_A_DECIMALS: 6,
      TOKEN_B_DECIMALS: 9
    }
  });
  return { root, publishObjects, values };
}

function splitValuesFixture(root) {
  const tokenValues = path.join(root, "token-values.json");
  writeJson(tokenValues, {
    replacements: {
      TYPE_A: `${id("1")}::coin_a::COIN_A`,
      TYPE_B: `${id("2")}::coin_b::COIN_B`,
      INIT_COIN_A: id("5"),
      INIT_COIN_B: id("6"),
      TOKEN_A_DECIMALS: 6,
      TOKEN_B_DECIMALS: 9
    }
  });
  const feedValues = path.join(root, "feed-values.json");
  writeJson(feedValues, {
    replacements: {
      BASE_FEED_ID: id("3"),
      QUOTE_FEED_ID: id("4")
    }
  });
  return { tokenValues, feedValues };
}

test("materializePythLaunchPoolConfig merges publish objects and live values", () => {
  const { root, publishObjects, values } = fixtureRoot();
  const out = path.join(root, "pool.json");

  const result = materializePythLaunchPoolConfig({
    template: "configs/launch/pyth-upgraded-testnet.pool.example.json",
    publishObjects,
    values,
    out
  });

  const pool = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(result.status, "success");
  assert.equal(result.packageId, id("a"));
  assert.equal(pool.packageId, id("a"));
  assert.equal(pool.typeA, `${id("1")}::coin_a::COIN_A`);
  assert.equal(pool.typeB, `${id("2")}::coin_b::COIN_B`);
  assert.equal(pool.factory, id("b"));
  assert.equal(pool.poolCreatorCap, id("c"));
  assert.equal(pool.oracle, id("d"));
  assert.deepEqual(pool.feedIds, [id("3"), id("4")]);
  assert.equal(pool.initA, id("5"));
  assert.equal(pool.initB, id("6"));
  assert.equal(pool.tokenADecimals, 6);
  assert.equal(pool.tokenBDecimals, 9);
});

test("materializePythLaunchPoolConfig rejects unresolved placeholders", () => {
  const { root, publishObjects, values } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(values, "utf8"));
  delete parsed.replacements.INIT_COIN_A;
  writeJson(values, parsed);

  assert.throws(
    () =>
      materializePythLaunchPoolConfig({
        template: "configs/launch/pyth-upgraded-testnet.pool.example.json",
        publishObjects,
        values,
        out: path.join(root, "pool.json")
      }),
    /Pyth launch pool config contains placeholder value at initA: 0xINIT_COIN_A/
  );
});

test("materializePythLaunchPoolConfig rejects conflicting publish object replacements", () => {
  const { root, publishObjects, values } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(values, "utf8"));
  parsed.replacements.FACTORY = id("9");
  writeJson(values, parsed);

  assert.throws(
    () =>
      materializePythLaunchPoolConfig({
        template: "configs/launch/pyth-upgraded-testnet.pool.example.json",
        publishObjects,
        values,
        out: path.join(root, "pool.json")
      }),
    /Publish objects factory conflicts with replacement FACTORY/
  );
});

test("materializePythLaunchPoolConfig accepts publish runner summaries", () => {
  const { root, publishObjects, values } = fixtureRoot();
  const publishSummary = path.join(root, "publish-summary.json");
  writeJson(publishSummary, {
    status: "success",
    packageId: id("9"),
    publishObjects: JSON.parse(fs.readFileSync(publishObjects, "utf8"))
  });
  const out = path.join(root, "pool-from-summary.json");

  const result = materializePythLaunchPoolConfig({
    template: "configs/launch/pyth-upgraded-testnet.pool.example.json",
    publishObjects: publishSummary,
    values,
    out
  });

  const pool = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(result.packageId, id("a"));
  assert.equal(pool.packageId, id("a"));
  assert.equal(pool.factory, id("b"));
});

test("materialize-pyth-launch-pool CLI accepts explicit --publish-result alias", () => {
  const { root, publishObjects, values } = fixtureRoot();
  const publishSummary = path.join(root, "publish-summary.json");
  writeJson(publishSummary, {
    status: "success",
    packageId: id("9"),
    publishObjects: JSON.parse(fs.readFileSync(publishObjects, "utf8"))
  });
  const out = path.join(root, "pool-from-cli.json");

  const stdout = execFileSync(
    process.execPath,
    [
      "tools/materialize-pyth-launch-pool.mjs",
      "--template",
      "configs/launch/pyth-upgraded-testnet.pool.example.json",
      "--values",
      values,
      "--publish-result",
      publishSummary,
      "--out",
      out
    ],
    { encoding: "utf8" }
  );

  const result = JSON.parse(stdout);
  const pool = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(result.status, "success");
  assert.equal(pool.packageId, id("a"));
  assert.equal(pool.factory, id("b"));
});

test("materializePythLaunchPoolConfig can merge multiple values files", () => {
  const { root, publishObjects } = fixtureRoot();
  const { tokenValues, feedValues } = splitValuesFixture(root);
  const out = path.join(root, "pool-from-split-values.json");

  const result = materializePythLaunchPoolConfig({
    template: "configs/launch/pyth-upgraded-testnet.pool.example.json",
    publishObjects,
    values: [tokenValues, feedValues],
    out
  });

  const pool = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(result.status, "success");
  assert.equal(pool.typeA, `${id("1")}::coin_a::COIN_A`);
  assert.equal(pool.typeB, `${id("2")}::coin_b::COIN_B`);
  assert.deepEqual(pool.feedIds, [id("3"), id("4")]);
  assert.equal(pool.initA, id("5"));
  assert.equal(pool.initB, id("6"));
});

test("materializePythLaunchPoolConfig can materialize optional protocol fee setup fields", () => {
  const { root, publishObjects, values } = fixtureRoot();
  writeJson(publishObjects, {
    packageId: id("a"),
    factory: id("b"),
    poolCreatorCap: id("c"),
    oracleAdapter: id("d"),
    caps: {
      FeeCap: id("7"),
      RiskCap: id("8")
    }
  });
  const parsedValues = JSON.parse(fs.readFileSync(values, "utf8"));
  parsedValues.replacements.FEE_TO = id("9");
  writeJson(values, parsedValues);
  const template = path.join(root, "protocol-fee-pool-template.json");
  writeJson(template, {
    name: "protocol-fee-pool",
    network: "testnet",
    packageId: "0xBROWNFI_PACKAGE",
    typeA: "TYPE_A",
    typeB: "TYPE_B",
    factory: "0xFACTORY",
    poolCreatorCap: "0xPOOL_CREATOR_CAP",
    feeCap: "0xFEE_CAP",
    riskCap: "0xRISK_CAP",
    feeTo: "0xFEE_TO",
    protocolFee: 10000000,
    oracle: "0xORACLE_ADAPTER",
    feedIds: ["0xBASE_FEED_ID", "0xQUOTE_FEED_ID"],
    clock: "0x6",
    initA: "0xINIT_COIN_A",
    initB: "0xINIT_COIN_B",
    tokenADecimals: 9,
    tokenBDecimals: 9
  });
  const out = path.join(root, "protocol-fee-pool.json");

  const result = materializePythLaunchPoolConfig({
    template,
    publishObjects,
    values,
    out
  });

  const pool = JSON.parse(fs.readFileSync(out, "utf8"));
  assert.equal(result.status, "success");
  assert.equal(pool.feeCap, id("7"));
  assert.equal(pool.riskCap, id("8"));
  assert.equal(pool.feeTo, id("9"));
  assert.equal(pool.protocolFee, 10000000);
  assert.equal(result.validation.feeCap, id("7"));
  assert.equal(result.validation.riskCap, id("8"));
  assert.equal(result.validation.feeTo, id("9"));
  assert.equal(result.validation.protocolFee, 10000000);
});
