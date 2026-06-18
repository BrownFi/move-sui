#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

function runCheck(args = []) {
  return execFileSync(process.execPath, ["tools/check-move-struct-fields.mjs", ...args], {
    encoding: "utf8"
  }).trim();
}

test("check-move-struct-fields default roots cover launch publish packages", () => {
  const explicit = runCheck([
    "sources",
    "packages/oracle/sources",
    "packages/stork-sui/sources",
    "packages/supra-sui/sources",
    "packages/launch-test-coins/sources",
    "packages/usdt-test-coin/sources"
  ]);

  assert.equal(runCheck(), explicit);
});
