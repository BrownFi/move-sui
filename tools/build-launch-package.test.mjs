#!/usr/bin/env node

import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { buildLaunchPackage } from "./build-launch-package.mjs";

function write(file, contents) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function fixtureRoot() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-fixture-"));

  write(
    path.join(root, "Move.toml"),
    `[package]
name = "brownfi_amm"
edition = "2024.beta"
version = "2.0.0"

[dependencies]
brownfi_oracle = { local = "./packages/oracle" }

[dependencies.Switchboard]
git = "https://github.com/switchboard-xyz/sui.git"
subdir = "on_demand/"
rev = "mainnet"

[dependencies.SupraOracle]
local = "./packages/supra-sui"

[addresses]
brownfi_amm = "0x0"
supra_validator = "0xabc"
`
  );
  write(path.join(root, "Move.lock"), "stale lock should not be copied\n");
  write(path.join(root, "sources", "pool.move"), "module brownfi_amm::pool;\n");
  write(path.join(root, "sources", "swap.move"), "module brownfi_amm::swap;\n");
  write(path.join(root, "sources", "pyth_source.move"), "module brownfi_amm::pyth_source;\n");
  write(path.join(root, "sources", "supra_source.move"), "module brownfi_amm::supra_source;\n");
  write(path.join(root, "sources", "amm_flowx.move"), "module brownfi_amm::amm_flowx;\n");
  write(path.join(root, "packages", "oracle", "Move.toml"), "[package]\nname = \"brownfi_oracle\"\n");
  write(path.join(root, "packages", "pyth", "Move.toml"), "[package]\nname = \"Pyth\"\n");
  write(
    path.join(root, "packages", "pyth", "Move.upgraded.toml"),
    `[package]
name = "PythUpgraded"

[addresses]
pyth = "0x1"
wormhole = "0x2"
`
  );
  write(path.join(root, "packages", "supra-sui", "Move.toml"), "[package]\nname = \"SupraOracle\"\n");
  write(path.join(root, "build", "ignored.txt"), "ignored\n");

  const config = path.join(root, "launch.json");
  write(
    config,
    JSON.stringify(
      {
        name: "fixture-no-supra",
        sources: ["pool", "swap"],
        copyPaths: ["packages/oracle"],
        removeDependencies: ["SupraOracle"],
        removeAddresses: ["supra_validator"]
      },
      null,
      2
    )
  );

  return { root, config };
}

test("buildLaunchPackage copies selected modules and strips disabled dependencies", () => {
  const { root, config } = fixtureRoot();
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-out-")), "package");

  const result = buildLaunchPackage({ root, config, out });

  assert.deepEqual(result.sources, ["pool", "swap"]);
  assert.deepEqual(result.removedDependencies, ["SupraOracle"]);
  assert.deepEqual(result.removedAddresses, ["supra_validator"]);
  assert.equal(fs.existsSync(path.join(out, "sources", "pool.move")), true);
  assert.equal(fs.existsSync(path.join(out, "sources", "swap.move")), true);
  assert.equal(fs.existsSync(path.join(out, "sources", "supra_source.move")), false);
  assert.equal(fs.existsSync(path.join(out, "packages", "oracle", "Move.toml")), true);
  assert.equal(fs.existsSync(path.join(out, "packages", "supra-sui")), false);
  assert.equal(fs.existsSync(path.join(out, "Move.lock")), false);
  assert.equal(fs.existsSync(path.join(out, "build")), false);

  const manifest = fs.readFileSync(path.join(out, "Move.toml"), "utf8");
  assert.equal(manifest.includes("[dependencies.SupraOracle]"), false);
  assert.equal(manifest.includes("supra_validator"), false);
  assert.equal(manifest.includes("[dependencies.Switchboard]"), true);
});

test("buildLaunchPackage copies external paths to configured package targets", () => {
  const { root, config } = fixtureRoot();
  const external = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-external-dep-"));
  write(path.join(external, "Move.toml"), "[package]\nname = \"ExternalDep\"\n");
  write(path.join(external, "sources", "dep.move"), "module dep::dep;\n");
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  parsed.copyPaths.push({
    source: external,
    target: "packages/external-dep"
  });
  fs.writeFileSync(config, JSON.stringify(parsed));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-out-")), "package");

  const result = buildLaunchPackage({ root, config, out });

  assert.equal(fs.existsSync(path.join(out, "packages", "external-dep", "Move.toml")), true);
  assert.equal(fs.existsSync(path.join(out, "packages", "external-dep", "sources", "dep.move")), true);
  assert.deepEqual(result.copyPaths, ["packages/external-dep", "packages/oracle"]);
});

test("buildLaunchPackage fails when a selected source module is missing", () => {
  const { root, config } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  parsed.sources.push("missing");
  fs.writeFileSync(config, JSON.stringify(parsed));

  assert.throws(
    () => buildLaunchPackage({ root, config, out: path.join(root, "out") }),
    /Selected source module does not exist: missing/
  );
});

test("buildLaunchPackage rejects provider IDs whose source modules are not selected", () => {
  const { root, config } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  parsed.providerIds = ["switchboard"];
  fs.writeFileSync(config, JSON.stringify(parsed));

  assert.throws(
    () => buildLaunchPackage({ root, config, out: path.join(root, "out") }),
    /Launch config provider switchboard requires selected source module switchboard_source/
  );
});

test("buildLaunchPackage rejects selected provider source modules without matching provider IDs", () => {
  const { root, config } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  parsed.providerIds = ["pyth"];
  parsed.sources = ["pool", "swap", "pyth_source", "supra_source"];
  fs.writeFileSync(config, JSON.stringify(parsed));

  assert.throws(
    () => buildLaunchPackage({ root, config, out: path.join(root, "out") }),
    /Launch config source module supra_source requires matching provider ID/
  );
});

test("buildLaunchPackage rejects AMM provider IDs whose source modules are not selected", () => {
  const { root, config } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  parsed.ammProviderIds = ["flowx"];
  fs.writeFileSync(config, JSON.stringify(parsed));

  assert.throws(
    () => buildLaunchPackage({ root, config, out: path.join(root, "out") }),
    /Launch config AMM provider flowx requires selected source module amm_flowx/
  );
});

test("buildLaunchPackage rejects selected AMM source modules without matching AMM provider IDs", () => {
  const { root, config } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  parsed.ammProviderIds = [];
  parsed.sources = ["pool", "swap", "amm_flowx"];
  fs.writeFileSync(config, JSON.stringify(parsed));

  assert.throws(
    () => buildLaunchPackage({ root, config, out: path.join(root, "out") }),
    /Launch config AMM source module amm_flowx requires matching AMM provider ID/
  );
});

test("buildLaunchPackage can rewrite selected dependencies to local paths", () => {
  const { root, config } = fixtureRoot();
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-out-")), "package");

  const result = buildLaunchPackage({
    root,
    config,
    out,
    localDependencies: {
      Switchboard: "/tmp/switchboard-on-demand"
    }
  });

  assert.deepEqual(result.overriddenDependencies, ["Switchboard"]);

  const manifest = fs.readFileSync(path.join(out, "Move.toml"), "utf8");
  assert.match(manifest, /\[dependencies\.Switchboard\]\nlocal = "\/tmp\/switchboard-on-demand"/);
  assert.equal(manifest.includes("git = \"https://github.com/switchboard-xyz/sui.git\""), false);
  assert.equal(manifest.includes("subdir = \"on_demand/\""), false);
  assert.equal(manifest.includes("rev = \"mainnet\""), false);
});

test("buildLaunchPackage can add config local dependencies", () => {
  const { root, config } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  parsed.localDependencies = {
    pyth: "./packages/pyth"
  };
  fs.writeFileSync(config, JSON.stringify(parsed));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-out-")), "package");

  const result = buildLaunchPackage({ root, config, out });

  assert.deepEqual(result.overriddenDependencies, ["pyth"]);

  const manifest = fs.readFileSync(path.join(out, "Move.toml"), "utf8");
  assert.match(manifest, /\[dependencies\.pyth\]\nlocal = "\.\/packages\/pyth"/);
});

test("buildLaunchPackage can override copied dependency manifests", () => {
  const { root, config } = fixtureRoot();
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  parsed.copyPaths.push("packages/pyth");
  parsed.manifestOverrides = [
    {
      path: "packages/pyth",
      manifest: "Move.upgraded.toml",
      removeAddresses: ["wormhole"]
    }
  ];
  fs.writeFileSync(config, JSON.stringify(parsed));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-out-")), "package");

  const result = buildLaunchPackage({ root, config, out });

  assert.deepEqual(result.manifestOverrides, ["packages/pyth/Move.toml"]);
  assert.equal(
    fs.readFileSync(path.join(out, "packages", "pyth", "Move.toml"), "utf8"),
    `[package]
name = "PythUpgraded"

[addresses]
pyth = "0x1"
`
  );
});

test("buildLaunchPackage can rewrite dependencies inside copied dependency manifests", () => {
  const { root, config } = fixtureRoot();
  write(
    path.join(root, "packages", "pyth", "Move.current.toml"),
    `[package]
name = "Pyth"

[dependencies.Wormhole]
git = "https://github.com/wormhole-foundation/wormhole.git"
subdir = "sui/wormhole"
rev = "testnet"

[addresses]
pyth = "0x1"
`
  );
  const parsed = JSON.parse(fs.readFileSync(config, "utf8"));
  parsed.copyPaths.push("packages/pyth");
  parsed.manifestOverrides = [
    {
      path: "packages/pyth",
      manifest: "Move.current.toml",
      localDependencies: {
        Wormhole: "/tmp/wormhole-current-testnet"
      }
    }
  ];
  fs.writeFileSync(config, JSON.stringify(parsed));
  const out = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-out-")), "package");

  buildLaunchPackage({ root, config, out });

  const manifest = fs.readFileSync(path.join(out, "packages", "pyth", "Move.toml"), "utf8");
  assert.match(manifest, /\[dependencies\.Wormhole\]\nlocal = "\/tmp\/wormhole-current-testnet"/);
  assert.equal(manifest.includes("github.com/wormhole-foundation/wormhole.git"), false);
});

test("real launch profiles have coherent provider source selections", () => {
  for (const config of [
    "configs/launch/no-supra.json",
    "configs/launch/pyth-current-testnet.json",
    "configs/launch/pyth-upgraded-testnet.json"
  ]) {
    const out = path.join(
      fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-out-")),
      "package"
    );

    const result = buildLaunchPackage({ config, out });

    assert.equal(result.providerIds.length > 0, true);
  }
});

test("pyth-current testnet profile selects only Pyth oracle source modules", () => {
  const out = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-out-")),
    "package"
  );

  const result = buildLaunchPackage({
    config: "configs/launch/pyth-current-testnet.json",
    out
  });

  assert.deepEqual(result.providerIds, ["pyth"]);
  assert.deepEqual(result.ammProviderIds, []);
  assert.deepEqual(result.sources, [
    "admin",
    "events",
    "factory",
    "flash",
    "library",
    "math",
    "oracle_gateway",
    "pool",
    "pyth_source",
    "router",
    "swap"
  ]);
  assert.equal(fs.existsSync(path.join(out, "sources", "pyth_source.move")), true);
  assert.equal(fs.existsSync(path.join(out, "sources", "stork_source.move")), false);
  assert.equal(fs.existsSync(path.join(out, "sources", "supra_source.move")), false);
  assert.equal(fs.existsSync(path.join(out, "sources", "supra_pull_source.move")), false);
  assert.equal(fs.existsSync(path.join(out, "sources", "switchboard_source.move")), false);
  assert.equal(fs.existsSync(path.join(out, "sources", "amm_flowx.move")), false);
});

test("pyth-current testnet profile keeps Pyth's pinned Sui Wormhole dependency", () => {
  const out = path.join(
    fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-out-")),
    "package"
  );

  const result = buildLaunchPackage({
    config: "configs/launch/pyth-current-testnet.json",
    out
  });

  assert.equal(
    result.copyPaths.includes(
      "packages/pyth-crosschain/target_chains/sui/vendor/wormhole_iota_testnet/wormhole"
    ),
    false
  );
  assert.equal(result.copyPaths.includes("packages/wormhole-sui-current"), true);
  assert.equal(result.copyPaths.includes("sources/wormhole_link.move"), true);
  assert.equal(fs.existsSync(path.join(out, "sources", "wormhole_link.move")), true);
  assert.equal(
    fs.existsSync(path.join(out, "packages", "wormhole-sui-current", "sources", "vaa.move")),
    true
  );

  const pythManifest = fs.readFileSync(
    path.join(out, "packages", "pyth-crosschain", "target_chains", "sui", "contracts", "Move.toml"),
    "utf8"
  );
  assert.match(
    pythManifest,
    /\[dependencies\.Wormhole\]\nlocal = "\.\.\/\.\.\/\.\.\/\.\.\/wormhole-sui-current"/
  );

  const rootManifest = fs.readFileSync(path.join(out, "Move.toml"), "utf8");
  assert.match(
    rootManifest,
    /\[dependencies\.Wormhole\]\nlocal = "\.\/packages\/wormhole-sui-current"/
  );

  const wormholeManifest = fs.readFileSync(
    path.join(out, "packages", "wormhole-sui-current", "Move.toml"),
    "utf8"
  );
  assert.match(
    wormholeManifest,
    /published-at = "0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94"/
  );
});
