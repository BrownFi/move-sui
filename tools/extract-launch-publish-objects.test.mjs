#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  extractLaunchPublishObjects,
  extractLaunchPublishObjectsFile
} from "./extract-launch-publish-objects.mjs";

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function publishResult() {
  const packageId = "0xabc";
  return {
    effects: {
      status: { status: "success" },
      transactionDigest: "PUBLISH_DIGEST"
    },
    objectChanges: [
      {
        type: "published",
        packageId,
        modules: ["factory", "swap", "oracle"]
      },
      {
        type: "created",
        objectId: "0xfactory",
        objectType: `${packageId}::factory::Factory`,
        owner: { Shared: { initial_shared_version: 1 } }
      },
      {
        type: "created",
        objectId: "0oracle",
        objectType: `${packageId}::oracle::OracleAdapter`,
        owner: { Shared: { initial_shared_version: 1 } }
      },
      {
        type: "created",
        objectId: "0poolcap",
        objectType: `${packageId}::factory::PoolCreatorCap`,
        owner: { AddressOwner: "0xsender" }
      },
      {
        type: "created",
        objectId: "0admin",
        objectType: `${packageId}::factory::AdminCap`,
        owner: { AddressOwner: "0xsender" }
      }
    ]
  };
}

test("extractLaunchPublishObjects extracts launch setup IDs from Sui publish JSON", () => {
  const result = extractLaunchPublishObjects(publishResult());

  assert.deepEqual(result, {
    status: "success",
    transactionDigest: "PUBLISH_DIGEST",
    packageId: "0xabc",
    factory: "0xfactory",
    oracleAdapter: "0oracle",
    poolCreatorCap: "0poolcap",
    caps: {
      AdminCap: "0admin",
      PoolCreatorCap: "0poolcap"
    }
  });
});

test("extractLaunchPublishObjectsFile reads publish JSON and can write a values file", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-publish-objects-"));
  const publishJson = path.join(root, "publish.json");
  const out = path.join(root, "objects.json");
  writeJson(publishJson, publishResult());

  const result = extractLaunchPublishObjectsFile({ publishJson, out });

  assert.equal(result.factory, "0xfactory");
  assert.deepEqual(JSON.parse(fs.readFileSync(out, "utf8")), result);
});

test("extractLaunchPublishObjects rejects missing pool creator cap", () => {
  const result = publishResult();
  result.objectChanges = result.objectChanges.filter(
    (change) => change.objectType !== "0xabc::factory::PoolCreatorCap"
  );

  assert.throws(
    () => extractLaunchPublishObjects(result),
    /Sui publish result missing required created object 0xabc::factory::PoolCreatorCap/
  );
});

test("extractLaunchPublishObjects rejects failed publish status", () => {
  const result = publishResult();
  result.effects.status = {
    status: "failure",
    error: "Publish failed"
  };

  assert.throws(
    () => extractLaunchPublishObjects(result),
    /Sui publish result failed: failure Publish failed/
  );
});
