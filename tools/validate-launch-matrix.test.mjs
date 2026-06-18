#!/usr/bin/env node

import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { validateLaunchMatrixConfigFile } from "./validate-launch-matrix.mjs";

const repoRoot = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function writeJson(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

function fixtureConfig() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-matrix-"));
  const config = path.join(root, "matrix.json");
  writeJson(config, {
    providerIds: ["pyth", "stork-rest"],
    routeLimits: {
      maxHops: 2,
      maxOracleSourcesPerHop: 1,
      maxAmmSourcesPerHop: 0,
      maxUpdatePayloadBytes: 1000
    },
    routeCases: [
      {
        name: "pyth exact input route",
        kind: "exact-input",
        providerId: "pyth",
        clock: "0x6",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB",
            oracleSourceCount: 1,
            updatePayloadByteLength: 512
          }
        ],
        input: "0xCOINA",
        minOutputs: ["9"]
      }
    ],
    quoteCases: [
      {
        name: "stork exact output quote",
        kind: "exact-output-quote",
        providerId: "stork-rest",
        clock: "0x6",
        path: ["B", "C"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "B",
            typeB: "C",
            pool: "0xPOOLBC",
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        amountOut: "5"
      }
    ]
  });
  return config;
}

test("validateLaunchMatrixConfigFile returns deterministic coverage for JSON config", () => {
  const summary = validateLaunchMatrixConfigFile({ config: fixtureConfig() });

  assert.deepEqual(summary, {
    routeCaseCount: 1,
    quoteCaseCount: 1,
    totalCaseCount: 2,
    providerIds: ["pyth", "stork-rest"],
    routeCases: [
      {
        name: "pyth exact input route",
        kind: "exact-input",
        providerId: "pyth"
      }
    ],
    quoteCases: [
      {
        name: "stork exact output quote",
        kind: "exact-output-quote",
        providerId: "stork-rest"
      }
    ]
  });
});

test("validate-launch-matrix CLI prints JSON coverage", () => {
  const output = execFileSync(
    process.execPath,
    ["tools/validate-launch-matrix.mjs", "--config", fixtureConfig()],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );

  assert.deepEqual(JSON.parse(output), {
    routeCaseCount: 1,
    quoteCaseCount: 1,
    totalCaseCount: 2,
    providerIds: ["pyth", "stork-rest"],
    routeCases: [
      {
        name: "pyth exact input route",
        kind: "exact-input",
        providerId: "pyth"
      }
    ],
    quoteCases: [
      {
        name: "stork exact output quote",
        kind: "exact-output-quote",
        providerId: "stork-rest"
      }
    ]
  });
});

test("validateLaunchMatrixConfigFile rejects declared providers without coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-matrix-"));
  const config = path.join(root, "matrix.json");
  writeJson(config, {
    providerIds: ["pyth", "stork-rest"],
    quoteCases: [
      {
        name: "pyth exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        clock: "0x6",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountIn: "10"
      }
    ]
  });

  assert.throws(
    () => validateLaunchMatrixConfigFile({ config }),
    /BrownFi launch validation matrix declared provider stork-rest has no route or quote coverage/
  );
});

test("validateLaunchMatrixConfigFile rejects provider sets that differ from launch config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-matrix-"));
  const config = path.join(root, "matrix.json");
  const launchConfig = path.join(root, "launch.json");
  writeJson(launchConfig, {
    providerIds: ["pyth"]
  });
  writeJson(config, {
    providerIds: ["pyth", "stork-rest"],
    quoteCases: [
      {
        name: "pyth exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        clock: "0x6",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountIn: "10"
      },
      {
        name: "stork exact input quote",
        kind: "exact-input-quote",
        providerId: "stork-rest",
        clock: "0x6",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountIn: "10"
      }
    ]
  });

  assert.throws(
    () => validateLaunchMatrixConfigFile({ config, launchConfig }),
    /Launch matrix providerIds must match launch config providerIds/
  );
});

test("validateLaunchMatrixConfigFile rejects AMM provider sets that differ from launch config", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-matrix-"));
  const config = path.join(root, "matrix.json");
  const launchConfig = path.join(root, "launch.json");
  writeJson(launchConfig, {
    providerIds: ["pyth"],
    ammProviderIds: []
  });
  writeJson(config, {
    providerIds: ["pyth"],
    ammProviderIds: ["flowx"],
    quoteCases: [
      {
        name: "pyth exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        clock: "0x6",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountIn: "10"
      }
    ]
  });

  assert.throws(
    () => validateLaunchMatrixConfigFile({ config, launchConfig }),
    /Launch matrix ammProviderIds must match launch config ammProviderIds/
  );
});

test("validateLaunchMatrixConfigFile rejects declared AMM providers without coverage", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-matrix-"));
  const config = path.join(root, "matrix.json");
  writeJson(config, {
    providerIds: ["pyth"],
    ammProviderIds: ["flowx"],
    quoteCases: [
      {
        name: "pyth exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        clock: "0x6",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountIn: "10"
      }
    ]
  });

  assert.throws(
    () => validateLaunchMatrixConfigFile({ config }),
    /BrownFi launch validation matrix declared AMM provider flowx has no route or quote coverage/
  );
});

test("validateLaunchMatrixConfigFile can require live-ready values", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-matrix-"));
  const config = path.join(root, "matrix.json");
  writeJson(config, {
    providerIds: ["pyth"],
    quoteCases: [
      {
        name: "pyth exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        clock: "0x6",
        path: ["TYPE_A", "TYPE_B"],
        pairs: [
          {
            packageId: "0xBROWNFI_PACKAGE",
            typeA: "TYPE_A",
            typeB: "TYPE_B",
            pool: "0xPOOL",
            feedIds: ["0xBASE_FEED_ID", "0xQUOTE_FEED_ID"],
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        amountIn: "10"
      }
    ]
  });

  assert.throws(
    () => validateLaunchMatrixConfigFile({ config, requireLiveValues: true }),
    /Launch matrix config contains placeholder value at quoteCases\[0\]\.path\[0\]: TYPE_A/
  );
});

test("validateLaunchMatrixConfigFile rejects generic provider placeholders when live values are required", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-matrix-"));
  const config = path.join(root, "matrix.json");
  writeJson(config, {
    providerIds: ["pyth"],
    quoteCases: [
      {
        name: "pyth exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        clock: "0x6",
        path: ["0x1::coin_a::COIN_A", "0x1::coin_b::COIN_B"],
        pairs: [
          {
            packageId: "0x1",
            typeA: "0x1::coin_a::COIN_A",
            typeB: "0x1::coin_b::COIN_B",
            pool: "0x2",
            sourceObject: "SUPRA_HOLDER_ID",
            feedIds: [
              "0x0101010101010101010101010101010101010101010101010101010101010101",
              "0x0202020202020202020202020202020202020202020202020202020202020202"
            ],
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        amountIn: "10"
      }
    ]
  });

  assert.throws(
    () => validateLaunchMatrixConfigFile({ config, requireLiveValues: true }),
    /Launch matrix config contains placeholder value at quoteCases\[0\]\.pairs\[0\]\.sourceObject: SUPRA_HOLDER_ID/
  );
});

test("validateLaunchMatrixConfigFile rejects malformed live Pyth feed IDs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "brownfi-launch-matrix-"));
  const config = path.join(root, "matrix.json");
  const typeA = "0x1::coin_a::COIN_A";
  const typeB = "0x1::coin_b::COIN_B";
  writeJson(config, {
    providerIds: ["pyth"],
    quoteCases: [
      {
        name: "pyth exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        clock: "0x6",
        path: [typeA, typeB],
        pairs: [
          {
            packageId: "0x1",
            typeA,
            typeB,
            pool: "0x2",
            feedIds: ["feed-a", "feed-b"],
            oracleSourceCount: 1,
            updatePayloadByteLength: 0
          }
        ],
        amountIn: "10"
      }
    ]
  });

  assert.throws(
    () => validateLaunchMatrixConfigFile({ config, requireLiveValues: true }),
    /BrownFi launch validation pyth exact input quote hop 0 feedIds\[0\] must be a 32-byte hex feed ID/
  );
});

test("validate-launch-matrix CLI can require live-ready values", () => {
  const result = spawnSync(
    process.execPath,
    [
      "tools/validate-launch-matrix.mjs",
      "--config",
      "configs/launch/no-supra.matrix.example.json",
      "--require-live-values"
    ],
    {
      cwd: repoRoot,
      encoding: "utf8"
    }
  );

  assert.equal(result.status, 1);
  assert.match(
    result.stderr,
    /Launch matrix config contains placeholder value at routeCases\[0\]\.path\[0\]: TYPE_A/
  );
});

test("devnet smoke launch matrix is live-value clean", () => {
  const summary = validateLaunchMatrixConfigFile({
    config: "configs/launch/devnet-smoke.matrix.json",
    requireLiveValues: true
  });

  assert.deepEqual(summary, {
    routeCaseCount: 1,
    quoteCaseCount: 1,
    totalCaseCount: 2,
    providerIds: ["devnet-smoke"],
    routeCases: [
      {
        name: "devnet smoke exact input swap dry-run",
        kind: "exact-input",
        providerId: "devnet-smoke"
      }
    ],
    quoteCases: [
      {
        name: "devnet smoke exact input quote",
        kind: "exact-input-quote",
        providerId: "devnet-smoke"
      }
    ]
  });
});

test("no-supra launch matrix matches launch profile provider set", () => {
  const summary = validateLaunchMatrixConfigFile({
    config: "configs/launch/no-supra.matrix.example.json",
    launchConfig: "configs/launch/no-supra.json"
  });

  assert.deepEqual(summary.providerIds, ["pyth", "stork-rest", "switchboard"]);
  assert.deepEqual(summary.routeCases, [
    {
      name: "pyth exact input smoke route",
      kind: "exact-input",
      providerId: "pyth"
    },
    {
      name: "pyth add liquidity smoke route",
      kind: "add-liquidity",
      providerId: "pyth"
    },
    {
      name: "pyth remove liquidity smoke route",
      kind: "remove-liquidity",
      providerId: "pyth"
    }
  ]);
});

test("pyth-upgraded testnet launch matrix matches Pyth-only launch profile", () => {
  const summary = validateLaunchMatrixConfigFile({
    config: "configs/launch/pyth-upgraded-testnet.matrix.example.json",
    launchConfig: "configs/launch/pyth-upgraded-testnet.json"
  });

  assert.deepEqual(summary, {
    routeCaseCount: 4,
    quoteCaseCount: 2,
    totalCaseCount: 6,
    providerIds: ["pyth"],
    routeCases: [
      {
        name: "pyth upgraded testnet exact input route",
        kind: "exact-input",
        providerId: "pyth"
      },
      {
        name: "pyth upgraded testnet exact output route",
        kind: "exact-output",
        providerId: "pyth"
      },
      {
        name: "pyth upgraded testnet add liquidity",
        kind: "add-liquidity",
        providerId: "pyth"
      },
      {
        name: "pyth upgraded testnet remove liquidity",
        kind: "remove-liquidity",
        providerId: "pyth"
      }
    ],
    quoteCases: [
      {
        name: "pyth upgraded testnet exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth"
      },
      {
        name: "pyth upgraded testnet exact output quote",
        kind: "exact-output-quote",
        providerId: "pyth"
      }
    ]
  });
});

test("pyth-current testnet launch matrix matches Pyth-only launch profile", () => {
  const summary = validateLaunchMatrixConfigFile({
    config: "configs/launch/pyth-current-testnet.matrix.example.json",
    launchConfig: "configs/launch/pyth-current-testnet.json"
  });

  assert.deepEqual(summary, {
    routeCaseCount: 11,
    quoteCaseCount: 6,
    totalCaseCount: 17,
    providerIds: ["pyth"],
    routeCases: [
      {
        name: "pyth current testnet exact input route",
        kind: "exact-input",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output route",
        kind: "exact-output",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output results route",
        kind: "exact-output-results",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet add liquidity",
        kind: "add-liquidity",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet remove liquidity",
        kind: "remove-liquidity",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet zap in A",
        kind: "zap-in-a",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet zap in B",
        kind: "zap-in-b",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet zap out A",
        kind: "zap-out-a",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet zap out B",
        kind: "zap-out-b",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet flash borrow A",
        kind: "flash-borrow-a",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet flash borrow B",
        kind: "flash-borrow-b",
        providerId: "pyth"
      }
    ],
    quoteCases: [
      {
        name: "pyth current testnet exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output quote",
        kind: "exact-output-quote",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output round-trip quote",
        kind: "exact-output-round-trip-quote",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet max-bound quote",
        kind: "max-bound-quote",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact input raw quote",
        kind: "exact-input-without-cutoff-quote",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output raw quote",
        kind: "exact-output-without-cutoff-quote",
        providerId: "pyth"
      }
    ]
  });
});

test("pyth-current testnet live evidence matrix is verifier-ready", () => {
  const config = "configs/launch/pyth-current-testnet.live-evidence.matrix.json";
  const summary = validateLaunchMatrixConfigFile({
    config,
    launchConfig: "configs/launch/pyth-current-testnet.json",
    requireLiveValues: true
  });
  const matrix = JSON.parse(fs.readFileSync(config, "utf8"));

  assert.deepEqual(summary, {
    routeCaseCount: 11,
    quoteCaseCount: 5,
    totalCaseCount: 16,
    providerIds: ["pyth"],
    routeCases: [
      {
        name: "pyth current testnet exact input route",
        kind: "exact-input",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output route",
        kind: "exact-output",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output results route",
        kind: "exact-output-results",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet add liquidity",
        kind: "add-liquidity",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet remove liquidity",
        kind: "remove-liquidity",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet zap in A",
        kind: "zap-in-a",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet zap in B",
        kind: "zap-in-b",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet zap out A",
        kind: "zap-out-a",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet zap out B",
        kind: "zap-out-b",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet flash borrow A",
        kind: "flash-borrow-a",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet flash borrow B",
        kind: "flash-borrow-b",
        providerId: "pyth"
      }
    ],
    quoteCases: [
      {
        name: "pyth current testnet exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output quote",
        kind: "exact-output-quote",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output round-trip quote",
        kind: "exact-output-round-trip-quote",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact input raw quote",
        kind: "exact-input-without-cutoff-quote",
        providerId: "pyth"
      },
      {
        name: "pyth current testnet exact output raw quote",
        kind: "exact-output-without-cutoff-quote",
        providerId: "pyth"
      }
    ]
  });
  assert.deepEqual(
    matrix.txEvidence.map((entry) => entry.name),
    summary.routeCases.map((entry) => entry.name)
  );
});

test("pyth-current testnet SUI/USDT live evidence matrix is verifier-ready", () => {
  const config =
    "configs/launch/pyth-current-testnet.sui-usdt-live-evidence.matrix.json";
  const summary = validateLaunchMatrixConfigFile({
    config,
    launchConfig: "configs/launch/pyth-current-testnet.json",
    requireLiveValues: true
  });
  const matrix = JSON.parse(fs.readFileSync(config, "utf8"));

  assert.deepEqual(summary, {
    routeCaseCount: 11,
    quoteCaseCount: 5,
    totalCaseCount: 16,
    providerIds: ["pyth"],
    routeCases: [
      {
        name: "live SUI/USDT exact input SUI to USDT",
        kind: "exact-input",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT add liquidity",
        kind: "add-liquidity",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT remove liquidity",
        kind: "remove-liquidity",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT exact output SUI to USDT",
        kind: "exact-output",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT exact output results SUI to USDT",
        kind: "exact-output-results",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT zap in A",
        kind: "zap-in-a",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT zap in B",
        kind: "zap-in-b",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT zap out A",
        kind: "zap-out-a",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT zap out B",
        kind: "zap-out-b",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT flash borrow A",
        kind: "flash-borrow-a",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT flash borrow B",
        kind: "flash-borrow-b",
        providerId: "pyth"
      }
    ],
    quoteCases: [
      {
        name: "live SUI/USDT exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT exact output quote",
        kind: "exact-output-quote",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT exact output round-trip quote",
        kind: "exact-output-round-trip-quote",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT exact input raw quote",
        kind: "exact-input-without-cutoff-quote",
        providerId: "pyth"
      },
      {
        name: "live SUI/USDT exact output raw quote",
        kind: "exact-output-without-cutoff-quote",
        providerId: "pyth"
      }
    ]
  });
  assert.deepEqual(
    matrix.txEvidence.map((entry) => entry.name),
    summary.routeCases.map((entry) => entry.name)
  );
});
