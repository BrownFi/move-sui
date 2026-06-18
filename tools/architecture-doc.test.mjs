#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateLaunchMatrixConfigFile } from "./validate-launch-matrix.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function pythMatrixSurface(config, launchConfig) {
  const summary = validateLaunchMatrixConfigFile({ config, launchConfig });
  return {
    routeCaseCount: summary.routeCaseCount,
    quoteCaseCount: summary.quoteCaseCount,
    routeKinds: summary.routeCases.map((routeCase) => routeCase.kind),
    quoteKinds: summary.quoteCases.map((quoteCase) => quoteCase.kind)
  };
}

test("architecture Pyth matrix surface matches current and upgraded launch templates", () => {
  const current = pythMatrixSurface(
    "configs/launch/pyth-current-testnet.matrix.example.json",
    "configs/launch/pyth-current-testnet.json"
  );
  const upgraded = pythMatrixSurface(
    "configs/launch/pyth-upgraded-testnet.matrix.example.json",
    "configs/launch/pyth-upgraded-testnet.json"
  );

  assert.equal(current.routeCaseCount, 11);
  assert.equal(current.quoteCaseCount, 6);
  assert.deepEqual(upgraded, current);

  const architecture = fs.readFileSync(path.join(repoRoot, "ARCHITECTURE_v3_SUI.md"), "utf8");
  assert.match(
    architecture,
    /Pyth-current and Pyth-upgraded templates both include the same one-hop Pyth route and quote coverage: 11 route cases and 6 quote cases\./
  );
  assert.doesNotMatch(
    architecture,
    /Pyth-upgraded template remains a narrower explicit validation profile/
  );
});
