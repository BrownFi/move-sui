import assert from "node:assert/strict";
import fs from "node:fs";
import test from "node:test";

test("checked USDT test coin package creates legacy Sui CoinMetadata", () => {
  const source = fs.readFileSync("packages/usdt-test-coin/sources/usdt.move", "utf8");

  assert.match(source, /coin::create_currency/);
  assert.match(source, /transfer::public_freeze_object\(metadata\)/);
  assert.match(source, /b"USDT"/);
  assert.match(source, /b"BrownFi Test USDT"/);
});
