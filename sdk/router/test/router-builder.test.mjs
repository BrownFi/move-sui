import assert from "node:assert/strict";
import test from "node:test";

import {
  addLiquidityWithCoins,
  addLiquidityWithCoinsWithMinDeposits,
  addLiquidityWithCoinsAndTransfer,
  addLiquidityWithRegisteredRoute,
  addLiquidityWithBundleAndTransferWithMinDeposits,
  addLiquidityWithBundleAndTransfer,
  addLiquidityWithBundleWithMinDeposits,
  assertDryRunTransactionBlockSucceeded,
  buildPythHermesConnectionConfig,
  buildAndDryRunTransactionBlock,
  buildAndPreflightTransactionBlock,
  buildRegisteredRouteCaseTransactions,
  buildRegisteredRoutePreflightCases,
  addLiquidityWithBundle,
  buildUpdatedPythPriceBundleFromFeeds,
  buildUpdatedPythPriceBundleFromFeedsAndAmmReadings,
  buildPythRoutePriceBundles,
  buildLaunchValidationMatrix,
  buildLaunchValidationQuoteCases,
  buildStorkTemporalNumericValueEvmInput,
  buildStorkTemporalNumericValueEvmInputVec,
  buildSupraPullRoutePriceBundles,
  buildSupraPullRestRoutePriceBundles,
  buildSupraPushRoutePriceBundles,
  buildStorkRoutePriceBundles,
  buildSwitchboardRoutePriceBundles,
  borrowAWithCoin,
  borrowAWithCoinResults,
  borrowBWithCoin,
  borrowBWithCoinResults,
  createAmmReadingRoutePriceProvider,
  createRoutePriceProviderRegistry,
  createStandardRoutePriceProviderRegistry,
  createFlowXDirectAmmRoutePriceProvider,
  createFlowXTwoHopAmmRoutePriceProvider,
  createExactInputRouteQuoteValidationCase,
  createExactOutputRouteQuoteValidationCase,
  createSupraPullRestProofFetcher,
  createSupraPullRestRoutePriceProvider,
  createSupraPullRoutePriceProvider,
  createSupraPushRoutePriceProvider,
  createStorkRestRoutePriceProvider,
  createStorkRoutePriceProvider,
  createSwitchboardQuoteUpdateFetcher,
  createSwitchboardRoutePriceProvider,
  createSwitchboardSuiClient,
  createSwitchboardSuiRoutePriceProvider,
  createPoolWithCoins,
  createPoolWithCoinsAndTransferLpToSender,
  createStorkRestSignedPriceFetcher,
  createStorkSignedPriceUpdater,
  createPythRoutePriceProvider,
  createPythSuiClients,
  dryRunBuiltTransactionBlock,
  encodeSupraPairIdConfig,
  fetchAndBuildUpdatedPythPriceBundleFromFeeds,
  fetchAndBuildUpdatedPythPriceBundleFromFeedsAndAmmReadings,
  fetchAndUpdatePythPriceInfoObjectsFromFeeds,
  getDryRunTransactionBlockStatus,
  getRoutePriceProvider,
  getPythSuiContractConfig,
  getStorkRestEndpoint,
  getSupraPullRestEndpoint,
  getSwapPriceBundleFromReadingPairsAndAmmReadings,
  getSwapPriceBundleFromReadingPairs,
  getSwapPriceBundleFromReadings,
  quoteExactInputWithPythRoute,
  quoteExactInputWithoutCutoffWithPythRoute,
  quoteExactInputWithoutCutoffWithRegisteredRoute,
  quoteExactInputWithRegisteredRoute,
  quoteExactOutputWithPythRoute,
  quoteExactOutputWithoutCutoffWithPythRoute,
  quoteExactOutputWithoutCutoffWithRegisteredRoute,
  quoteExactOutputWithRegisteredRoute,
  quoteAForBWithBundle,
  quoteAForB,
  quoteAForExactBWithoutCutoffWithBundle,
  quoteAForExactBWithoutCutoff,
  quoteAForExactBWithBundle,
  quoteAForExactB,
  quoteAForExactCViaBWithBundles,
  quoteAForExactCViaBWithoutCutoffWithBundles,
  quoteBForAWithBundle,
  quoteBForA,
  quoteBForExactAWithoutCutoffWithBundle,
  quoteBForExactAWithoutCutoff,
  quoteBForExactAWithBundle,
  quoteBForExactA,
  quoteCForExactAViaBWithBundles,
  quoteCForExactAViaBWithoutCutoffWithBundles,
  quoteExactAForCViaBWithBundles,
  quoteExactAForCViaBWithoutCutoffWithBundles,
  quoteExactCForAViaBWithBundles,
  quoteExactCForAViaBWithoutCutoffWithBundles,
  preflightBuiltTransactionBlock,
  preflightLaunchValidationMatrix,
  preflightLaunchValidationCase,
  preflightLaunchValidationCases,
  preflightLaunchValidationQuoteCases,
  preflightRegisteredRouteCases,
  preflightSwapExactInputWithRegisteredRoute,
  preflightSwapExactOutputWithRegisteredRoute,
  preflightSwapExactOutputWithRegisteredRouteResults,
  readFlowXDirectPool,
  readFlowXTwoHopPath,
  readPythTotalUpdateFeeInMist,
  readSupraPullPriceBundle,
  readSupraPullPriceBundleWithAmmReadings,
  readSupraPushPriceA,
  readSupraPushPriceB,
  readStorkPriceA,
  readStorkPriceB,
  readStorkSingleUpdateFeeInMist,
  readStorkTotalUpdateFeeInMist,
  storkSignedPriceToTemporalNumericValueEvmInputFields,
  readSwitchboardPriceA,
  readSwitchboardPriceB,
  readPythPriceA,
  readPythPriceB,
  removeLiquidityWithCoins,
  removeLiquidityWithCoinsAndTransfer,
  repayAWithBorrowedCoinAndFee,
  repayAWithCoin,
  repayBWithBorrowedCoinAndFee,
  repayBWithCoin,
  runLaunchValidationMatrixPreflight,
  claimProtocolLp,
  setFactoryFeeTo,
  setFactoryMinPriceAge,
  setFactoryOracle,
  setFactoryPaused,
  setPoolAddLiquidityPaused,
  setPoolAmmPolicy,
  setPoolAmmSourceIds,
  setPoolAmmSourcePolicy,
  setPoolFee,
  setPoolFeeSplit,
  setPoolFeeTo,
  setPoolGamma,
  setPoolK,
  setPoolKB,
  setPoolKQ,
  setPoolLambda,
  setPoolOracleAggregationPolicy,
  setPoolOracleMaxPriceAge,
  setPoolOracleQuorum,
  setPoolOracleSources,
  setPoolProtocolFee,
  setPoolFlashEnabled,
  setPoolPythWeight,
  setPoolRouterEnabled,
  setPoolSpreads,
  setPoolSwapsPaused,
  splitSuiFromGas,
  summarizeLaunchValidationMatrixPreflightResult,
  storkRestLatestPricesResponseToSignedPrices,
  supraPullRestProofResponseToPayload,
  swapAForExactB,
  swapAForExactBAndTransfer,
  swapAForExactBWithBundle,
  swapAForExactBWithBundleAndTransfer,
  swapAForExactBWithPythRoute,
  swapAForExactCViaB,
  swapAForExactCViaBWithBundles,
  swapAForExactCViaBWithBundlesAndTransfer,
  swapAForExactCViaBWithPythRoute,
  swapExactAForB,
  swapExactAForBAndTransfer,
  swapExactAForBWithPythRoute,
  swapBForExactA,
  swapBForExactAAndTransfer,
  swapBForExactAWithBundle,
  swapBForExactAWithBundleAndTransfer,
  swapBForExactAWithPythRoute,
  swapCForExactAViaB,
  swapCForExactAViaBWithBundles,
  swapCForExactAViaBWithBundlesAndTransfer,
  swapCForExactAViaBWithPythRoute,
  swapExactInputWithRegisteredRoute,
  swapExactInputWithPythRoute,
  swapExactAForBWithBundle,
  swapExactAForBWithBundleAndTransfer,
  swapExactAForCViaB,
  swapExactAForCViaBWithBundles,
  swapExactAForCViaBWithBundlesAndTransfer,
  swapExactAForCViaBWithPythRoute,
  swapExactBForA,
  swapExactBForAAndTransfer,
  swapExactBForAWithBundle,
  swapExactBForAWithBundleAndTransfer,
  swapExactBForAWithPythRoute,
  swapExactCForAViaB,
  swapExactCForAViaBWithBundles,
  swapExactCForAViaBWithBundlesAndTransfer,
  swapExactCForAViaBWithPythRoute,
  swapExactOutputWithRegisteredRoute,
  swapExactOutputWithRegisteredRouteResults,
  swapExactOutputWithPythRoute,
  swapExactOutputWithPythRouteResults,
  updateMultipleStorkTemporalNumericValuesEvmWithGasFee,
  updateMultipleStorkTemporalNumericValuesEvmWithSignedPrices,
  updateMultipleStorkTemporalNumericValuesEvm,
  updateSingleStorkTemporalNumericValueEvmWithGasFee,
  updateSingleStorkTemporalNumericValueEvmWithSignedPrice,
  updateSingleStorkTemporalNumericValueEvm,
  validateLaunchValidationMatrixConfig,
  zapInA,
  zapInAAndTransfer,
  zapInB,
  zapInBAndTransfer,
  zapInAWithBundle,
  zapInAWithBundleAndTransfer,
  zapInBWithBundle,
  zapInBWithBundleAndTransfer,
  zapOutA,
  zapOutAAndTransfer,
  zapOutB,
  zapOutBAndTransfer,
  zapOutAWithBundle,
  zapOutAWithBundleAndTransfer,
  zapOutBWithBundleAndTransfer,
  zapOutBWithBundle
} from "../dist/index.js";

const PYTH_FEED_A = `0x${"01".repeat(32)}`;
const PYTH_FEED_B = `0x${"02".repeat(32)}`;

function createTransactionRecorder() {
  return {
    calls: [],
    transfers: [],
    gas: { kind: "gas" },
    splits: [],
    merges: [],
    vectors: [],
    object(id) {
      return { kind: "object", id };
    },
    pure: {
      bool(value) {
        return { kind: "bool", value };
      },
      u8(value) {
        return { kind: "u8", value: String(value) };
      },
      u32(value) {
        return { kind: "u32", value: String(value) };
      },
      u64(value) {
        return { kind: "u64", value: String(value) };
      },
      u128(value) {
        return { kind: "u128", value: String(value) };
      },
      id(value) {
        return { kind: "id", value };
      },
      address(value) {
        return { kind: "address", value };
      },
      vector(type, values) {
        return { kind: "pure-vector", type, values: Array.from(values) };
      }
    },
    moveCall(call) {
      this.calls.push(call);
      const result = { kind: "result", index: this.calls.length - 1 };
      const nested = (resultIndex) => ({
        kind: "nested-result",
        index: result.index,
        resultIndex
      });
      Object.defineProperties(result, {
        0: {
          value: nested(0),
          enumerable: false
        },
        1: {
          value: nested(1),
          enumerable: false
        },
        [Symbol.iterator]: {
          value: function* iterator() {
            yield this[0];
            yield this[1];
          },
          enumerable: false
        }
      });
      return result;
    },
    splitCoins(coin, amounts) {
      this.splits.push({ coin, amounts });
      return amounts.map((_, index) => ({
        kind: "split",
        splitIndex: this.splits.length - 1,
        resultIndex: index
      }));
    },
    mergeCoins(coin, sources) {
      this.merges.push({ coin, sources });
    },
    transferObjects(objects, recipient) {
      this.transfers.push({ objects, recipient });
    },
    makeMoveVec(vector) {
      this.vectors.push(vector);
      return { kind: "vector", index: this.vectors.length - 1 };
    }
  };
}

test("buildAndDryRunTransactionBlock builds with the Sui client before dry-run", async () => {
  const builtBytes = Uint8Array.from([1, 2, 3]);
  const calls = [];
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return { effects: { status: { status: "success" } } };
    }
  };
  const tx = {
    async build(input) {
      calls.push({ kind: "build", input });
      return builtBytes;
    }
  };

  const result = await buildAndDryRunTransactionBlock({ tx, suiClient });

  assert.deepEqual(result, { effects: { status: { status: "success" } } });
  assert.deepEqual(calls, [
    { kind: "build", input: { client: suiClient } },
    { kind: "dryRun", input: { transactionBlock: builtBytes } }
  ]);
});

test("dryRunBuiltTransactionBlock forwards prebuilt Sui transaction bytes", async () => {
  const transactionBlock = "AQID";
  const calls = [];
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push(input);
      return { status: "success" };
    }
  };

  const result = await dryRunBuiltTransactionBlock({ suiClient, transactionBlock });

  assert.deepEqual(result, { status: "success" });
  assert.deepEqual(calls, [{ transactionBlock }]);
});

test("getDryRunTransactionBlockStatus extracts Sui effects status", () => {
  assert.deepEqual(
    getDryRunTransactionBlockStatus({
      effects: {
        status: {
          status: "success"
        }
      }
    }),
    { status: "success" }
  );
  assert.equal(getDryRunTransactionBlockStatus({ effects: {} }), undefined);
});

test("assertDryRunTransactionBlockSucceeded rejects failed dry-runs with Sui error text", () => {
  assert.throws(
    () =>
      assertDryRunTransactionBlockSucceeded(
        {
          effects: {
            status: {
              status: "failure",
              error: "MoveAbort in 0xBROWN::router"
            }
          }
        },
        { context: "BrownFi route preflight" }
      ),
    /BrownFi route preflight failed with status failure: MoveAbort in 0xBROWN::router/
  );
});

test("preflightBuiltTransactionBlock requires a successful Sui dry-run status", async () => {
  const transactionBlock = Uint8Array.from([4, 5, 6]);
  const suiClient = {
    async dryRunTransactionBlock() {
      return { effects: { status: { status: "success" } } };
    }
  };

  const result = await preflightBuiltTransactionBlock({
    suiClient,
    transactionBlock,
    context: "BrownFi oracle route preflight"
  });

  assert.deepEqual(result, { effects: { status: { status: "success" } } });
});

test("buildAndPreflightTransactionBlock fails closed when dry-run status is missing", async () => {
  const tx = {
    async build() {
      return "AQID";
    }
  };
  const suiClient = {
    async dryRunTransactionBlock() {
      return { effects: {} };
    }
  };

  await assert.rejects(
    () =>
      buildAndPreflightTransactionBlock({
        tx,
        suiClient,
        context: "BrownFi route preflight"
      }),
    /BrownFi route preflight did not return effects\.status\.status/
  );
});

test("createExactInputRouteQuoteValidationCase builds a named provider quote case and preflights it", async () => {
  const tx = createTransactionRecorder();
  const buildCalls = [];
  tx.build = async (input) => {
    buildCalls.push(input);
    return "AQID";
  };
  const dryRunCalls = [];
  const suiClient = {
    async dryRunTransactionBlock(input) {
      dryRunCalls.push(input);
      return { effects: { status: { status: "success" } } };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAB"]
        );
        return [{ kind: "bundle", id: "ab" }];
      }
    }
  ]);

  const validationCase = createExactInputRouteQuoteValidationCase({
    name: "pyth SUI/USDC quote",
    providerRegistry: registry,
    providerId: "custom",
    path: ["0x1::a::A", "0x1::b::B"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB"
      }
    ],
    amountIn: 100n
  });

  const result = await preflightLaunchValidationCase({
    validationCase,
    tx,
    suiClient
  });

  assert.equal(validationCase.name, "pyth SUI/USDC quote");
  assert.equal(validationCase.kind, "exact-input-quote");
  assert.equal(validationCase.providerId, "custom");
  assert.equal(
    validationCase.preflightContext,
    "BrownFi launch validation pyth SUI/USDC quote"
  );
  assert.equal(result.name, "pyth SUI/USDC quote");
  assert.equal(result.kind, "exact-input-quote");
  assert.equal(result.providerId, "custom");
  assert.deepEqual(result.dryRunResult, {
    effects: { status: { status: "success" } }
  });
  assert.deepEqual(buildCalls, [{ client: suiClient }]);
  assert.deepEqual(dryRunCalls, [{ transactionBlock: "AQID" }]);
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::swap::quote_a_for_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "bundle", id: "ab" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "u64", value: "100" }
    ]
  });
});

test("preflightLaunchValidationCases creates a fresh transaction per route quote case", async () => {
  const txs = [];
  const dryRunCalls = [];
  const suiClient = {
    async dryRunTransactionBlock(input) {
      dryRunCalls.push(input);
      return { effects: { status: { status: "success" } } };
    }
  };
  const createTransaction = () => {
    const tx = createTransactionRecorder();
    const index = txs.length;
    tx.build = async () => `tx-${index}`;
    txs.push(tx);
    return tx;
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(_tx, optionsArg) {
        return optionsArg.hops.map((hop) => ({
          kind: "bundle",
          id: hop.pool
        }));
      }
    }
  ]);

  const results = await preflightLaunchValidationCases({
    cases: [
      createExactInputRouteQuoteValidationCase({
        name: "stork-rest exact input quote",
        providerRegistry: registry,
        providerId: "custom",
        path: ["A", "B"],
        clock: "0x6",
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountIn: 10n
      }),
      createExactOutputRouteQuoteValidationCase({
        name: "supra-pull-rest exact output quote",
        providerRegistry: registry,
        providerId: "custom",
        path: ["A", "B"],
        clock: "0x6",
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountOut: 7n
      })
    ],
    createTransaction,
    suiClient
  });

  assert.deepEqual(
    results.map((result) => [result.name, result.providerId]),
    [
      ["stork-rest exact input quote", "custom"],
      ["supra-pull-rest exact output quote", "custom"]
    ]
  );
  assert.equal(txs.length, 2);
  assert.deepEqual(dryRunCalls, [
    { transactionBlock: "tx-0" },
    { transactionBlock: "tx-1" }
  ]);
  assert.deepEqual(
    txs.map((tx) => tx.calls.map((call) => call.target)),
    [
      ["0xBROWN::swap::quote_a_for_b_with_bundle"],
      ["0xBROWN::swap::quote_a_for_exact_b_with_bundle"]
    ]
  );
});

test("buildLaunchValidationQuoteCases hydrates serializable provider quote configs", async () => {
  const tx = createTransactionRecorder();
  tx.build = async () => "AQID";
  const providerCalls = [];
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        providerCalls.push(optionsArg);
        return optionsArg.hops.map((hop) => ({
          kind: "bundle",
          id: hop.pool
        }));
      }
    }
  ]);
  const suiClient = {
    async dryRunTransactionBlock() {
      return { effects: { status: { status: "success" } } };
    }
  };

  const cases = buildLaunchValidationQuoteCases({
    providerRegistry: registry,
    cases: [
      {
        name: "pyth exact input live quote",
        kind: "exact-input-quote",
        providerId: "custom",
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
        amountIn: "100"
      },
      {
        name: "supra pull exact output live quote",
        kind: "exact-output-quote",
        providerId: "custom",
        preflightContext: "BrownFi custom quote validation",
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
        amountOut: 7n
      }
    ]
  });

  assert.deepEqual(
    cases.map((quoteCase) => ({
      name: quoteCase.name,
      kind: quoteCase.kind,
      providerId: quoteCase.providerId,
      preflightContext: quoteCase.preflightContext
    })),
    [
      {
        name: "pyth exact input live quote",
        kind: "exact-input-quote",
        providerId: "custom",
        preflightContext: "BrownFi launch validation pyth exact input live quote"
      },
      {
        name: "supra pull exact output live quote",
        kind: "exact-output-quote",
        providerId: "custom",
        preflightContext: "BrownFi custom quote validation"
      }
    ]
  );

  const result = await preflightLaunchValidationCase({
    validationCase: cases[1],
    tx,
    suiClient
  });

  assert.equal(result.name, "supra pull exact output live quote");
  assert.equal(result.kind, "exact-output-quote");
  assert.deepEqual(providerCalls, [
    {
      clock: "0x6",
      hops: [
        {
          packageId: "0xBROWN",
          typeA: "A",
          typeB: "B",
          pool: "0xPOOLAB"
        }
      ]
    }
  ]);
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
    typeArguments: ["A", "B"],
    arguments: [
      { kind: "bundle", id: "0xPOOLAB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "u64", value: "7" }
    ]
  });
});

test("buildLaunchValidationQuoteCases rejects unregistered providers before PTB construction", () => {
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        return [];
      }
    }
  ]);

  assert.throws(
    () =>
      buildLaunchValidationQuoteCases({
        providerRegistry: registry,
        cases: [
          {
            name: "missing provider quote",
            kind: "exact-input-quote",
            providerId: "missing",
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
            amountIn: 1n
          }
        ]
      }),
    /No BrownFi route price provider registered for missing/
  );
});

test("buildLaunchValidationQuoteCases rejects unresolved routes before PTB construction", () => {
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider build should not run");
      }
    }
  ]);

  assert.throws(
    () =>
      buildLaunchValidationQuoteCases({
        providerRegistry: registry,
        cases: [
          {
            name: "unresolved quote route",
            kind: "exact-input-quote",
            providerId: "custom",
            clock: "0x6",
            path: ["A", "C"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOLAB"
              }
            ],
            amountIn: 1n
          }
        ]
      }),
    /No BrownFi route pair found for A -> C/
  );
});

test("preflightLaunchValidationQuoteCases hydrates quote configs and dry-runs each case", async () => {
  const txs = [];
  const dryRunCalls = [];
  const createTransaction = () => {
    const tx = createTransactionRecorder();
    const index = txs.length;
    tx.build = async (input) => {
      assert.equal(input.client, suiClient);
      return `built-${index}`;
    };
    txs.push(tx);
    return tx;
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      dryRunCalls.push(input);
      return { effects: { status: { status: "success" } } };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(_tx, optionsArg) {
        return optionsArg.hops.map((hop) => ({
          kind: "bundle",
          id: hop.pool
        }));
      }
    }
  ]);

  const results = await preflightLaunchValidationQuoteCases({
    providerRegistry: registry,
    createTransaction,
    suiClient,
    cases: [
      {
        name: "pyth config exact input",
        kind: "exact-input-quote",
        providerId: "custom",
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
        amountIn: 100n
      },
      {
        name: "switchboard config exact output",
        kind: "exact-output-quote",
        providerId: "custom",
        clock: "0x6",
        path: ["B", "A"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountOut: "9"
      }
    ]
  });

  assert.deepEqual(
    results.map((result) => [result.name, result.providerId]),
    [
      ["pyth config exact input", "custom"],
      ["switchboard config exact output", "custom"]
    ]
  );
  assert.deepEqual(dryRunCalls, [
    { transactionBlock: "built-0" },
    { transactionBlock: "built-1" }
  ]);
  assert.deepEqual(
    txs.map((tx) => tx.calls.map((call) => call.target)),
    [
      ["0xBROWN::swap::quote_a_for_b_with_bundle"],
      ["0xBROWN::swap::quote_b_for_exact_a_with_bundle"]
    ]
  );
});

test("preflightLaunchValidationQuoteCases builds and dry-runs Pyth quote cases", async () => {
  const txs = [];
  const calls = [];
  const createTransaction = (validationCase, index) => {
    calls.push({ kind: "createTransaction", index, name: validationCase.name });
    const tx = createTransactionRecorder();
    tx.build = async (input) => {
      calls.push({
        kind: "build",
        index,
        input,
        moveCallTargets: tx.calls.map((call) => call.target)
      });
      return `${validationCase.name}-bytes`;
    };
    txs[index] = tx;
    return tx;
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    createPythRoutePriceProvider({
      priceFeedConnection: {
        async getPriceFeedsUpdateData(feedIdsArg) {
          calls.push({ kind: "fetchPythUpdates", feedIds: feedIdsArg });
          return feedIdsArg.map((feedId) => ({ update: feedId }));
        }
      },
      pythClient: {
        async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
          const txIndex = txs.indexOf(txArg);
          assert.notEqual(txIndex, -1);
          assert.equal(txArg.calls.length, 0);
          calls.push({
            kind: "updatePyth",
            txIndex,
            updates: updatesArg,
            feedIds: feedIdsArg
          });
          return ["0xPRICEA", "0xPRICEB"];
        }
      }
    })
  ]);

  const results = await preflightLaunchValidationQuoteCases({
    providerRegistry: registry,
    createTransaction,
    suiClient,
    cases: [
      {
        name: "pyth current exact input quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        clock: "0x6",
        path: ["0x1::a::A", "0x1::b::B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "0x1::a::A",
            typeB: "0x1::b::B",
            pool: "0xPOOLAB",
            feedIds: ["feed-a", "feed-b"]
          }
        ],
        amountIn: 100n
      },
      {
        name: "pyth current exact output quote",
        kind: "exact-output-quote",
        providerId: "pyth",
        clock: "0x6",
        path: ["0x1::a::A", "0x1::b::B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "0x1::a::A",
            typeB: "0x1::b::B",
            pool: "0xPOOLAB",
            feedIds: ["feed-a", "feed-b"]
          }
        ],
        amountOut: 7n
      }
    ]
  });

  assert.deepEqual(
    results.map((result) => ({
      name: result.name,
      providerId: result.providerId,
      dryRunResult: result.dryRunResult
    })),
    [
      {
        name: "pyth current exact input quote",
        providerId: "pyth",
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "pyth current exact input quote-bytes"
        }
      },
      {
        name: "pyth current exact output quote",
        providerId: "pyth",
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "pyth current exact output quote-bytes"
        }
      }
    ]
  );
  assert.deepEqual(
    txs.map((tx) => tx.calls.map((call) => call.target)),
    [
      [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::swap::quote_a_for_b_with_bundle"
      ],
      [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::swap::quote_a_for_exact_b_with_bundle"
      ]
    ]
  );
  assert.deepEqual(calls, [
    { kind: "createTransaction", index: 0, name: "pyth current exact input quote" },
    { kind: "fetchPythUpdates", feedIds: ["feed-a", "feed-b"] },
    {
      kind: "updatePyth",
      txIndex: 0,
      updates: [{ update: "feed-a" }, { update: "feed-b" }],
      feedIds: ["feed-a", "feed-b"]
    },
    {
      kind: "build",
      index: 0,
      input: { client: suiClient },
      moveCallTargets: [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::swap::quote_a_for_b_with_bundle"
      ]
    },
    {
      kind: "dryRun",
      input: { transactionBlock: "pyth current exact input quote-bytes" }
    },
    { kind: "createTransaction", index: 1, name: "pyth current exact output quote" },
    { kind: "fetchPythUpdates", feedIds: ["feed-a", "feed-b"] },
    {
      kind: "updatePyth",
      txIndex: 1,
      updates: [{ update: "feed-a" }, { update: "feed-b" }],
      feedIds: ["feed-a", "feed-b"]
    },
    {
      kind: "build",
      index: 1,
      input: { client: suiClient },
      moveCallTargets: [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::swap::quote_a_for_exact_b_with_bundle"
      ]
    },
    {
      kind: "dryRun",
      input: { transactionBlock: "pyth current exact output quote-bytes" }
    }
  ]);
});

test("preflightLaunchValidationQuoteCases builds and dry-runs Pyth exact-output round-trip quote cases", async () => {
  const txs = [];
  const calls = [];
  const createTransaction = (validationCase, index) => {
    calls.push({ kind: "createTransaction", index, name: validationCase.name });
    const tx = createTransactionRecorder();
    tx.build = async (input) => {
      calls.push({
        kind: "build",
        index,
        input,
        moveCallTargets: tx.calls.map((call) => call.target)
      });
      return `${validationCase.name}-bytes`;
    };
    txs[index] = tx;
    return tx;
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    createPythRoutePriceProvider({
      priceFeedConnection: {
        async getPriceFeedsUpdateData(feedIdsArg) {
          calls.push({ kind: "fetchPythUpdates", feedIds: feedIdsArg });
          return feedIdsArg.map((feedId) => ({ update: feedId }));
        }
      },
      pythClient: {
        async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
          const txIndex = txs.indexOf(txArg);
          assert.notEqual(txIndex, -1);
          calls.push({
            kind: "updatePyth",
            txIndex,
            callsBeforeUpdate: txArg.calls.length,
            updates: updatesArg,
            feedIds: feedIdsArg
          });
          return txArg.calls.length === 0
            ? ["0xOUT_PRICEA", "0xOUT_PRICEB"]
            : ["0xIN_PRICEA", "0xIN_PRICEB"];
        }
      }
    })
  ]);

  const results = await preflightLaunchValidationQuoteCases({
    providerRegistry: registry,
    createTransaction,
    suiClient,
    cases: [
      {
        name: "pyth current exact output round-trip quote",
        kind: "exact-output-round-trip-quote",
        providerId: "pyth",
        clock: "0x6",
        path: ["0x1::a::A", "0x1::b::B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "0x1::a::A",
            typeB: "0x1::b::B",
            pool: "0xPOOLAB",
            feedIds: ["feed-a", "feed-b"]
          }
        ],
        amountOut: 7n
      }
    ]
  });

  assert.deepEqual(
    results.map((result) => ({
      name: result.name,
      kind: result.kind,
      providerId: result.providerId,
      dryRunResult: result.dryRunResult
    })),
    [
      {
        name: "pyth current exact output round-trip quote",
        kind: "exact-output-round-trip-quote",
        providerId: "pyth",
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "pyth current exact output round-trip quote-bytes"
        }
      }
    ]
  );
  assert.deepEqual(txs[0].calls[7].arguments[3], {
    kind: "nested-result",
    index: 3,
    resultIndex: 0
  });
  assert.deepEqual(
    txs[0].calls.map((call) => call.target),
    [
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::swap::quote_a_for_b_with_bundle"
    ]
  );
  assert.deepEqual(calls, [
    {
      kind: "createTransaction",
      index: 0,
      name: "pyth current exact output round-trip quote"
    },
    { kind: "fetchPythUpdates", feedIds: ["feed-a", "feed-b"] },
    {
      kind: "updatePyth",
      txIndex: 0,
      callsBeforeUpdate: 0,
      updates: [{ update: "feed-a" }, { update: "feed-b" }],
      feedIds: ["feed-a", "feed-b"]
    },
    { kind: "fetchPythUpdates", feedIds: ["feed-a", "feed-b"] },
    {
      kind: "updatePyth",
      txIndex: 0,
      callsBeforeUpdate: 4,
      updates: [{ update: "feed-a" }, { update: "feed-b" }],
      feedIds: ["feed-a", "feed-b"]
    },
    {
      kind: "build",
      index: 0,
      input: { client: suiClient },
      moveCallTargets: [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::swap::quote_a_for_b_with_bundle"
      ]
    },
    {
      kind: "dryRun",
      input: { transactionBlock: "pyth current exact output round-trip quote-bytes" }
    }
  ]);
});

test("preflightLaunchValidationQuoteCases builds raw no-cutoff Pyth quote cases", async () => {
  const txs = [];
  const createTransaction = (validationCase, index) => {
    const tx = createTransactionRecorder();
    tx.build = async () => `${validationCase.name}-bytes`;
    txs[index] = tx;
    return tx;
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    createPythRoutePriceProvider({
      priceFeedConnection: {
        async getPriceFeedsUpdateData(feedIdsArg) {
          return feedIdsArg.map((feedId) => ({ update: feedId }));
        }
      },
      pythClient: {
        async updatePriceFeeds(_txArg, _updatesArg, _feedIdsArg) {
          return ["0xPRICEA", "0xPRICEB"];
        }
      }
    })
  ]);
  const rawExactInputQuoteCase = {
    name: "pyth current raw exact input quote",
    kind: "exact-input-without-cutoff-quote",
    providerId: "pyth",
    clock: "0x6",
    path: ["0x1::a::A", "0x1::b::B"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      }
    ],
    amountIn: 100n
  };
  const rawExactOutputQuoteCase = {
    name: "pyth current raw exact output quote",
    kind: "exact-output-without-cutoff-quote",
    providerId: "pyth",
    clock: "0x6",
    path: ["0x1::a::A", "0x1::b::B"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      }
    ],
    amountOut: 7n
  };
  const rawExactInputBuildTx = createTransactionRecorder();
  const [rawExactInputValidationCase] = buildLaunchValidationQuoteCases({
    providerRegistry: registry,
    cases: [rawExactInputQuoteCase]
  });
  const rawExactInputBuild = await rawExactInputValidationCase.build(rawExactInputBuildTx);

  const results = await preflightLaunchValidationQuoteCases({
    providerRegistry: registry,
    createTransaction,
    suiClient,
    cases: [rawExactInputQuoteCase, rawExactOutputQuoteCase]
  });

  assert.deepEqual(
    results.map((result) => [result.name, result.providerId, result.dryRunResult.transactionBlock]),
    [
      ["pyth current raw exact input quote", "pyth", "pyth current raw exact input quote-bytes"],
      ["pyth current raw exact output quote", "pyth", "pyth current raw exact output quote-bytes"]
    ]
  );
  assert.deepEqual(
    txs.map((tx) => tx.calls.map((call) => call.target)),
    [
      [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::swap::quote_a_for_b_with_bundle"
      ],
      [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::swap::quote_a_for_exact_b_without_cutoff_with_bundle"
      ]
    ]
  );
  assert.deepEqual(rawExactInputBuild.amounts[1], {
    kind: "nested-result",
    index: 3,
    resultIndex: 1
  });
});

test("buildLaunchValidationMatrix hydrates route and quote launch sections", () => {
  const routeFactoryCalls = [];
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        return [];
      }
    }
  ]);

  const matrix = buildLaunchValidationMatrix({
    providerRegistry,
    routeTransactionFactory(routeCase, index) {
      routeFactoryCalls.push({ name: routeCase.name, index });
      return createTransactionRecorder();
    },
    routeCases: [
      {
        name: "route launch exact input",
        kind: "exact-input",
        providerId: "custom",
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
        input: "0xCOINA",
        minOutputs: [9n]
      }
    ],
    quoteCases: [
      {
        name: "quote launch exact output",
        kind: "exact-output-quote",
        providerId: "custom",
        clock: "0x6",
        path: ["B", "A"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountOut: 7n
      }
    ]
  });

  assert.deepEqual(routeFactoryCalls, [
    { name: "route launch exact input", index: 0 }
  ]);
  assert.deepEqual(
    matrix.routeCases.map((routeCase) => [routeCase.name, routeCase.kind, routeCase.providerId]),
    [["route launch exact input", "exact-input", "custom"]]
  );
  assert.deepEqual(
    matrix.quoteCases.map((quoteCase) => [
      quoteCase.name,
      quoteCase.kind,
      quoteCase.providerId,
      quoteCase.preflightContext
    ]),
    [
      [
        "quote launch exact output",
        "exact-output-quote",
        "custom",
        "BrownFi launch validation quote launch exact output"
      ]
    ]
  );
});

test("buildLaunchValidationMatrix rejects empty launch matrices", () => {
  const providerRegistry = createRoutePriceProviderRegistry([]);

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeTransactionFactory() {
          return createTransactionRecorder();
        }
      }),
    /BrownFi launch validation matrix requires at least one route or quote case/
  );
  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeTransactionFactory() {
          return createTransactionRecorder();
        },
        routeCases: [],
        quoteCases: []
      }),
    /BrownFi launch validation matrix requires at least one route or quote case/
  );
});

test("buildLaunchValidationMatrix rejects route cases without a route transaction factory", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        return [];
      }
    }
  ]);

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeCases: [
          {
            name: "route launch exact input",
            kind: "exact-input",
            providerId: "custom",
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
            input: "0xCOINA",
            minOutputs: [9n]
          }
        ]
      }),
    /BrownFi launch validation matrix requires routeTransactionFactory when route cases are configured/
  );
});

test("validateLaunchValidationMatrixConfig hydrates launch coverage without provider execution", () => {
  const summary = validateLaunchValidationMatrixConfig({
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
            feedIds: [PYTH_FEED_A, PYTH_FEED_B],
            oracleSourceCount: 1,
            updatePayloadByteLength: 450
          }
        ],
        input: "0xCOINA",
        minOutputs: [9n]
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
        amountOut: 5n
      }
    ]
  });

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

test("validateLaunchValidationMatrixConfig rejects providers outside the declared launch set", () => {
  assert.throws(
    () =>
      validateLaunchValidationMatrixConfig({
        providerIds: ["pyth"],
        quoteCases: [
          {
            name: "undeclared provider quote",
            kind: "exact-input-quote",
            providerId: "stork-rest",
            clock: "0x6",
            path: ["A", "B"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOLAB",
                feedIds: [PYTH_FEED_A, PYTH_FEED_B]
              }
            ],
            amountIn: 10n
          }
        ]
      }),
    /No BrownFi route price provider registered for stork-rest/
  );
});

test("validateLaunchValidationMatrixConfig rejects declared providers without coverage", () => {
  assert.throws(
    () =>
      validateLaunchValidationMatrixConfig({
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
                pool: "0xPOOLAB",
                feedIds: [PYTH_FEED_A, PYTH_FEED_B]
              }
            ],
            amountIn: 10n
          }
        ]
      }),
    /BrownFi launch validation matrix declared provider stork-rest has no route or quote coverage/
  );
});

test("validateLaunchValidationMatrixConfig rejects malformed Pyth feed IDs", () => {
  assert.throws(
    () =>
      validateLaunchValidationMatrixConfig({
        providerIds: ["pyth"],
        requireProviderMetadata: true,
        quoteCases: [
          {
            name: "pyth malformed feed quote",
            kind: "exact-input-quote",
            providerId: "pyth",
            clock: "0x6",
            path: ["A", "B"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOLAB",
                feedIds: ["feed-a", "feed-b"]
              }
            ],
            amountIn: 10n
          }
        ]
      }),
    /BrownFi launch validation pyth malformed feed quote hop 0 feedIds\[0\] must be a 32-byte hex feed ID/
  );
});

test("validateLaunchValidationMatrixConfig rejects declared AMM providers without coverage", () => {
  assert.throws(
    () =>
      validateLaunchValidationMatrixConfig({
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
            amountIn: 10n
          }
        ]
      }),
    /BrownFi launch validation matrix declared AMM provider flowx has no route or quote coverage/
  );
});

test("validateLaunchValidationMatrixConfig accepts FlowX AMM coverage", () => {
  const summary = validateLaunchValidationMatrixConfig({
    providerIds: ["pyth"],
    ammProviderIds: ["flowx"],
    routeLimits: { maxAmmSourcesPerHop: 1 },
    routeCases: [
      {
        name: "pyth flowx exact input route",
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
            feedIds: [PYTH_FEED_A, PYTH_FEED_B],
            flowxDirectAmm: [
              {
                flowxPool: "0xFLOWXPOOL",
                sourceMask: 16,
                twapWindowSeconds: 60,
                twalWindowSeconds: 300,
                validForMs: 5000
              }
            ]
          }
        ],
        input: "0xCOINA",
        minOutputs: [9n]
      }
    ]
  });

  assert.deepEqual(summary.providerIds, ["pyth"]);
  assert.deepEqual(summary.routeCases, [
    {
      name: "pyth flowx exact input route",
      kind: "exact-input",
      providerId: "pyth"
    }
  ]);
});

test("buildLaunchValidationMatrix enforces configured max route hops", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider should not run during launch matrix hydration");
      }
    }
  ]);
  const threeHopRoute = {
    name: "oversized route",
    kind: "exact-input",
    providerId: "custom",
    clock: "0x6",
    path: ["A", "B", "C", "D"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "B",
        pool: "0xPOOLAB"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "C",
        pool: "0xPOOLBC"
      },
      {
        packageId: "0xBROWN",
        typeA: "C",
        typeB: "D",
        pool: "0xPOOLCD"
      }
    ],
    input: "0xCOINA",
    minOutputs: [9n]
  };

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxHops: 2 },
        routeTransactionFactory() {
          throw new Error("tx factory should not run for an oversized route");
        },
        routeCases: [threeHopRoute]
      }),
    /BrownFi launch validation oversized route exceeds maxHops 2: 3/
  );
  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxHops: 2 },
        quoteCases: [
          {
            ...threeHopRoute,
            kind: "exact-input-quote",
            amountIn: 10n,
            input: undefined,
            minOutputs: undefined
          }
        ]
      }),
    /BrownFi launch validation oversized route exceeds maxHops 2: 3/
  );
});

test("buildLaunchValidationMatrix enforces configured max AMM sources per hop", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider should not run during launch matrix hydration");
      }
    }
  ]);
  const routeWithTooManyAmmReadings = {
    name: "too many amm readings",
    kind: "exact-input",
    providerId: "custom",
    clock: "0x6",
    path: ["A", "B"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "B",
        pool: "0xPOOLAB",
        ammReadings: ["0xAMM1", "0xAMM2"]
      }
    ],
    input: "0xCOINA",
    minOutputs: [9n]
  };
  const routeWithFlowXAmm = {
    name: "flowx amm source",
    kind: "exact-input",
    providerId: "custom",
    clock: "0x6",
    path: ["A", "B"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "B",
        pool: "0xPOOLAB",
        flowxDirectAmm: [
          {
            flowxPool: "0xFLOWXPOOL",
            sourceMask: 16,
            twapWindowSeconds: 60,
            twalWindowSeconds: 300,
            validForMs: 5000
          }
        ]
      }
    ],
    input: "0xCOINA",
    minOutputs: [9n]
  };

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxAmmSourcesPerHop: 1 },
        routeTransactionFactory() {
          throw new Error("tx factory should not run for too many AMM readings");
        },
        routeCases: [routeWithTooManyAmmReadings]
      }),
    /BrownFi launch validation too many amm readings hop 0 exceeds maxAmmSourcesPerHop 1: 2/
  );
  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxAmmSourcesPerHop: 0 },
        routeTransactionFactory() {
          throw new Error("tx factory should not run for disallowed FlowX AMM readings");
        },
        routeCases: [routeWithFlowXAmm]
      }),
    /BrownFi launch validation flowx amm source hop 0 exceeds maxAmmSourcesPerHop 0: 1/
  );
  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxAmmSourcesPerHop: 1 },
        quoteCases: [
          {
            ...routeWithTooManyAmmReadings,
            kind: "exact-input-quote",
            amountIn: 10n,
            input: undefined,
            minOutputs: undefined
          }
        ]
      }),
    /BrownFi launch validation too many amm readings hop 0 exceeds maxAmmSourcesPerHop 1: 2/
  );
});

test("buildLaunchValidationMatrix enforces configured max oracle sources per hop", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider should not run during launch matrix hydration");
      }
    }
  ]);
  const routeWithTooManyOracleSources = {
    name: "too many oracle sources",
    kind: "exact-input",
    providerId: "custom",
    clock: "0x6",
    path: ["A", "B"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "B",
        pool: "0xPOOLAB",
        oracleSourceCount: 2
      }
    ],
    input: "0xCOINA",
    minOutputs: [9n]
  };

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxOracleSourcesPerHop: 1 },
        routeTransactionFactory() {
          throw new Error("tx factory should not run for too many oracle sources");
        },
        routeCases: [routeWithTooManyOracleSources]
      }),
    /BrownFi launch validation too many oracle sources hop 0 exceeds maxOracleSourcesPerHop 1: 2/
  );
  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxOracleSourcesPerHop: 1 },
        quoteCases: [
          {
            ...routeWithTooManyOracleSources,
            kind: "exact-input-quote",
            amountIn: 10n,
            input: undefined,
            minOutputs: undefined
          }
        ]
      }),
    /BrownFi launch validation too many oracle sources hop 0 exceeds maxOracleSourcesPerHop 1: 2/
  );
});

test("buildLaunchValidationMatrix requires oracle source counts when the cap is configured", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider should not run during launch matrix hydration");
      }
    }
  ]);
  const routeWithoutOracleSourceCount = {
    name: "missing oracle source count",
    kind: "exact-input",
    providerId: "custom",
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
    input: "0xCOINA",
    minOutputs: [9n]
  };

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxOracleSourcesPerHop: 1 },
        routeTransactionFactory() {
          throw new Error("tx factory should not run without oracle source count");
        },
        routeCases: [routeWithoutOracleSourceCount]
      }),
    /BrownFi launch validation missing oracle source count hop 0 requires oracleSourceCount when maxOracleSourcesPerHop is configured/
  );
});

test("buildLaunchValidationMatrix rejects invalid oracle source counts", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider should not run during launch matrix hydration");
      }
    }
  ]);

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxOracleSourcesPerHop: 2 },
        routeTransactionFactory() {
          throw new Error("tx factory should not run with invalid oracle source count");
        },
        routeCases: [
          {
            name: "invalid oracle source count",
            kind: "exact-input",
            providerId: "custom",
            clock: "0x6",
            path: ["A", "B"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOLAB",
                oracleSourceCount: 0
              }
            ],
            input: "0xCOINA",
            minOutputs: [9n]
          }
        ]
      }),
    /BrownFi launch validation invalid oracle source count hop 0 oracleSourceCount must be a positive integer/
  );
});

test("buildLaunchValidationMatrix enforces configured max update payload bytes", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider should not run during launch matrix hydration");
      }
    }
  ]);
  const routeWithLargeUpdatePayload = {
    name: "large update payload",
    kind: "exact-input",
    providerId: "custom",
    clock: "0x6",
    path: ["A", "B", "C"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "B",
        pool: "0xPOOLAB",
        updatePayloadByteLength: 700
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "C",
        pool: "0xPOOLBC",
        updatePayloadByteLength: 400
      }
    ],
    input: "0xCOINA",
    minOutputs: [9n, 8n]
  };

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxUpdatePayloadBytes: 1000 },
        routeTransactionFactory() {
          throw new Error("tx factory should not run for too large update payload");
        },
        routeCases: [routeWithLargeUpdatePayload]
      }),
    /BrownFi launch validation large update payload exceeds maxUpdatePayloadBytes 1000: 1100/
  );
  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxUpdatePayloadBytes: 1000 },
        quoteCases: [
          {
            ...routeWithLargeUpdatePayload,
            kind: "exact-input-quote",
            amountIn: 10n,
            input: undefined,
            minOutputs: undefined
          }
        ]
      }),
    /BrownFi launch validation large update payload exceeds maxUpdatePayloadBytes 1000: 1100/
  );
});

test("buildLaunchValidationMatrix requires update payload byte lengths when the cap is configured", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider should not run during launch matrix hydration");
      }
    }
  ]);
  const routeWithoutUpdatePayloadLength = {
    name: "missing update payload length",
    kind: "exact-input",
    providerId: "custom",
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
    input: "0xCOINA",
    minOutputs: [9n]
  };

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxUpdatePayloadBytes: 1000 },
        routeTransactionFactory() {
          throw new Error("tx factory should not run without update payload length");
        },
        routeCases: [routeWithoutUpdatePayloadLength]
      }),
    /BrownFi launch validation missing update payload length hop 0 requires updatePayloadByteLength when maxUpdatePayloadBytes is configured/
  );
});

test("buildLaunchValidationMatrix rejects invalid update payload byte lengths", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider should not run during launch matrix hydration");
      }
    }
  ]);

  assert.throws(
    () =>
      buildLaunchValidationMatrix({
        providerRegistry,
        routeLimits: { maxUpdatePayloadBytes: 1000 },
        routeTransactionFactory() {
          throw new Error("tx factory should not run with invalid update payload length");
        },
        routeCases: [
          {
            name: "invalid update payload length",
            kind: "exact-input",
            providerId: "custom",
            clock: "0x6",
            path: ["A", "B"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOLAB",
                updatePayloadByteLength: -1
              }
            ],
            input: "0xCOINA",
            minOutputs: [9n]
          }
        ]
      }),
    /BrownFi launch validation invalid update payload length hop 0 updatePayloadByteLength must be a non-negative integer/
  );
});

test("preflightLaunchValidationMatrix rejects quote cases without a quote transaction factory", async () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider build should not run without a quote transaction factory");
      }
    }
  ]);
  const suiClient = {
    async dryRunTransactionBlock() {
      throw new Error("dry-run should not run without a quote transaction factory");
    }
  };

  await assert.rejects(
    () =>
      preflightLaunchValidationMatrix({
        providerRegistry,
        suiClient,
        quoteCases: [
          {
            name: "quote launch exact output",
            kind: "exact-output-quote",
            providerId: "custom",
            clock: "0x6",
            path: ["B", "A"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOLAB"
              }
            ],
            amountOut: 7n
          }
        ]
      }),
    /BrownFi launch validation matrix requires quoteTransactionFactory when quote cases are configured/
  );
});

test("preflightLaunchValidationMatrix dry-runs route cases before quote cases", async () => {
  const routeTxs = [];
  const quoteTxs = [];
  const dryRunCalls = [];
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(_tx, options) {
        return options.hops.map((hop) => ({
          kind: "bundle",
          id: hop.pool
        }));
      }
    }
  ]);
  const suiClient = {
    async dryRunTransactionBlock(input) {
      dryRunCalls.push(input);
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };

  const result = await preflightLaunchValidationMatrix({
    providerRegistry,
    suiClient,
    routeTransactionFactory(_routeCase, index) {
      const tx = createTransactionRecorder();
      tx.build = async (input) => {
        assert.equal(input.client, suiClient);
        return `route-${index}`;
      };
      routeTxs.push(tx);
      return tx;
    },
    quoteTransactionFactory(_quoteCase, index) {
      const tx = createTransactionRecorder();
      tx.build = async (input) => {
        assert.equal(input.client, suiClient);
        return `quote-${index}`;
      };
      quoteTxs.push(tx);
      return tx;
    },
    routeCases: [
      {
        name: "route launch exact input",
        kind: "exact-input",
        providerId: "custom",
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
        input: "0xCOINA",
        minOutputs: [9n]
      }
    ],
    quoteCases: [
      {
        name: "quote launch exact output",
        kind: "exact-output-quote",
        providerId: "custom",
        clock: "0x6",
        path: ["B", "A"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountOut: 7n
      }
    ]
  });

  assert.deepEqual(
    result.routeResults.map((routeResult) => [
      routeResult.name,
      routeResult.kind,
      routeResult.providerId,
      routeResult.dryRunResult.transactionBlock
    ]),
    [["route launch exact input", "exact-input", "custom", "route-0"]]
  );
  assert.deepEqual(
    result.quoteResults.map((quoteResult) => [
      quoteResult.name,
      quoteResult.kind,
      quoteResult.providerId,
      quoteResult.dryRunResult.transactionBlock
    ]),
    [["quote launch exact output", "exact-output-quote", "custom", "quote-0"]]
  );
  assert.deepEqual(dryRunCalls, [
    { transactionBlock: "route-0" },
    { transactionBlock: "quote-0" }
  ]);
  assert.deepEqual(
    routeTxs.map((tx) => tx.calls.map((call) => call.target)),
    [["0xBROWN::router::swap_exact_a_for_b_with_bundle"]]
  );
  assert.deepEqual(
    quoteTxs.map((tx) => tx.calls.map((call) => call.target)),
    [["0xBROWN::swap::quote_b_for_exact_a_with_bundle"]]
  );
});

test("runLaunchValidationMatrixPreflight returns dry-run sections and coverage summary", async () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(_tx, options) {
        return options.hops.map((hop) => ({
          kind: "bundle",
          id: hop.pool
        }));
      }
    }
  ]);
  const suiClient = {
    async dryRunTransactionBlock(input) {
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };

  const report = await runLaunchValidationMatrixPreflight({
    providerRegistry,
    suiClient,
    routeTransactionFactory(_routeCase, index) {
      const tx = createTransactionRecorder();
      tx.build = async () => `route-${index}`;
      return tx;
    },
    quoteTransactionFactory(_quoteCase, index) {
      const tx = createTransactionRecorder();
      tx.build = async () => `quote-${index}`;
      return tx;
    },
    routeCases: [
      {
        name: "route launch exact input",
        kind: "exact-input",
        providerId: "custom",
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
        input: "0xCOINA",
        minOutputs: [9n]
      }
    ],
    quoteCases: [
      {
        name: "quote launch exact output",
        kind: "exact-output-quote",
        providerId: "custom",
        clock: "0x6",
        path: ["B", "A"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amountOut: 7n
      }
    ]
  });

  assert.deepEqual(
    report.preflightResult.routeResults.map((routeResult) => [
      routeResult.name,
      routeResult.kind,
      routeResult.providerId,
      routeResult.dryRunResult.transactionBlock
    ]),
    [["route launch exact input", "exact-input", "custom", "route-0"]]
  );
  assert.deepEqual(
    report.preflightResult.quoteResults.map((quoteResult) => [
      quoteResult.name,
      quoteResult.providerId,
      quoteResult.dryRunResult.transactionBlock
    ]),
    [["quote launch exact output", "custom", "quote-0"]]
  );
  assert.deepEqual(report.summary, {
    routeCaseCount: 1,
    quoteCaseCount: 1,
    totalCaseCount: 2,
    providerIds: ["custom"],
    routeCases: [
      {
        name: "route launch exact input",
        kind: "exact-input",
        providerId: "custom"
      }
    ],
    quoteCases: [
      {
        name: "quote launch exact output",
        kind: "exact-output-quote",
        providerId: "custom"
      }
    ]
  });
});

test("summarizeLaunchValidationMatrixPreflightResult returns deterministic launch coverage", () => {
  const summary = summarizeLaunchValidationMatrixPreflightResult({
    routeResults: [
      {
        name: "pyth launch exact input",
        kind: "exact-input",
        providerId: "pyth",
        swapResult: { kind: "result", index: 0 },
        dryRunResult: { effects: { status: { status: "success" } } }
      },
      {
        name: "stork-rest launch exact output",
        kind: "exact-output-results",
        providerId: "stork-rest",
        quoteResults: [],
        swapResults: [],
        changeCoins: [],
        output: { kind: "result", index: 3 },
        dryRunResult: { effects: { status: { status: "success" } } }
      }
    ],
    quoteResults: [
      {
        name: "pyth launch quote",
        kind: "exact-input-quote",
        providerId: "pyth",
        dryRunResult: { effects: { status: { status: "success" } } }
      }
    ]
  });

  assert.deepEqual(summary, {
    routeCaseCount: 2,
    quoteCaseCount: 1,
    totalCaseCount: 3,
    providerIds: ["pyth", "stork-rest"],
    routeCases: [
      {
        name: "pyth launch exact input",
        kind: "exact-input",
        providerId: "pyth"
      },
      {
        name: "stork-rest launch exact output",
        kind: "exact-output-results",
        providerId: "stork-rest"
      }
    ],
    quoteCases: [
      {
        name: "pyth launch quote",
        kind: "exact-input-quote",
        providerId: "pyth"
      }
    ]
  });
});

test("buildPythHermesConnectionConfig uses upgraded Hermes endpoint and binary signed updates", () => {
  assert.deepEqual(
    buildPythHermesConnectionConfig({ apiKey: "pyth-key" }),
    {
      endpoint: "https://pyth.dourolabs.app/hermes",
      options: {
        accessToken: "pyth-key",
        priceFeedRequestConfig: {
          binary: true
        }
      }
    }
  );
});

test("buildPythHermesConnectionConfig enforces API key when required", () => {
  assert.throws(
    () => buildPythHermesConnectionConfig({ requireApiKey: true }),
    /Pyth Hermes API key is required/
  );
});

test("getPythSuiContractConfig returns upgraded Sui state IDs by default", () => {
  assert.deepEqual(getPythSuiContractConfig("mainnet"), {
    network: "mainnet",
    contractSet: "upgraded",
    pythStateId: "0x03719fae774ddab3cfcaa53bbc046f0cbe21410019b6280811bf3f9f4b05839d",
    pythPackageId: "0x55300367a2d40813727ccac4ecee977a39fb9cdb46f2e6b2c354b9798f5de2c0",
    wormholeStateId: "0xdbca52b9fb4f712e25f61f974586d93ac541bcf8389564f0323bb07215168b5c",
    wormholePackageId: "0x99de5c967d8206ef4b75c0afab3df2a59eb02b05c282821db803831008ac25b4"
  });
  assert.deepEqual(getPythSuiContractConfig("testnet"), {
    network: "testnet",
    contractSet: "upgraded",
    pythStateId: "0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e",
    pythPackageId: "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd",
    wormholeStateId: "0x750da8e6d16b6a363a39fe2eaa8295ac224a1e6fce4e47b58845e2e8746164f0",
    wormholePackageId: "0xe79f4e3e02ce132f40f39e73220493a802329d3cb6ad7f789e98a78910fc0053"
  });
});

test("getPythSuiContractConfig can return current pre-upgrade Sui state IDs", () => {
  assert.deepEqual(getPythSuiContractConfig("testnet", "current"), {
    network: "testnet",
    contractSet: "current",
    pythStateId: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
    pythPackageId: "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837",
    wormholeStateId: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
    wormholePackageId: "0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94"
  });
});

test("createPythSuiClients wires documented Hermes and Sui Pyth constructor arguments", () => {
  const constructedConnections = [];
  const constructedClients = [];
  class FakeSuiPriceServiceConnection {
    constructor(endpoint, options) {
      this.endpoint = endpoint;
      this.options = options;
      constructedConnections.push({ endpoint, options });
    }
  }
  class FakeSuiPythClient {
    constructor(suiClient, pythStateId, wormholeStateId) {
      this.suiClient = suiClient;
      this.pythStateId = pythStateId;
      this.wormholeStateId = wormholeStateId;
      constructedClients.push({ suiClient, pythStateId, wormholeStateId });
    }
  }
  const suiClient = { rpc: "testnet" };

  const result = createPythSuiClients({
    SuiPriceServiceConnection: FakeSuiPriceServiceConnection,
    SuiPythClient: FakeSuiPythClient,
    suiClient,
    network: "testnet",
    apiKey: "pyth-key"
  });

  assert.deepEqual(constructedConnections, [
    {
      endpoint: "https://pyth.dourolabs.app/hermes",
      options: {
        accessToken: "pyth-key",
        priceFeedRequestConfig: {
          binary: true
        }
      }
    }
  ]);
  assert.deepEqual(constructedClients, [
    {
      suiClient,
      pythStateId: "0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e",
      wormholeStateId: "0x750da8e6d16b6a363a39fe2eaa8295ac224a1e6fce4e47b58845e2e8746164f0"
    }
  ]);
  assert.equal(result.priceFeedConnection.endpoint, "https://pyth.dourolabs.app/hermes");
  assert.equal(result.pythClient.suiClient, suiClient);
  assert.equal(
    result.pythClient.pythStateId,
    "0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e"
  );
  assert.deepEqual(result.contractConfig, getPythSuiContractConfig("testnet"));
});

test("readPythPriceA builds the BrownFi-owned Pyth price reading PTB call", () => {
  const tx = createTransactionRecorder();
  readPythPriceA({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceInfoObject: "0xPRICEA",
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::pyth_source::read_price_a",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPRICEA" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readPythPriceB builds the BrownFi-owned Pyth quote reading PTB call", () => {
  const tx = createTransactionRecorder();
  readPythPriceB({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceInfoObject: "0xPRICEB",
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::pyth_source::read_price_b",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPRICEB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readSwitchboardPriceA builds the BrownFi-owned Switchboard price reading PTB call", () => {
  const tx = createTransactionRecorder();
  readSwitchboardPriceA({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    quoteVerifier: "0xVERIFIER",
    quotes: { kind: "result", index: 0 },
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::switchboard_source::read_price_a",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xVERIFIER" },
      { kind: "result", index: 0 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readSwitchboardPriceB builds the BrownFi-owned Switchboard quote reading PTB call", () => {
  const tx = createTransactionRecorder();
  readSwitchboardPriceB({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    quoteVerifier: "0xVERIFIER",
    quotes: { kind: "result", index: 0 },
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::switchboard_source::read_price_b",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xVERIFIER" },
      { kind: "result", index: 0 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readStorkPriceA builds the BrownFi-owned Stork price reading PTB call", () => {
  const tx = createTransactionRecorder();
  readStorkPriceA({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    storkState: "0xSTORKSTATE",
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::stork_source::read_price_a",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xSTORKSTATE" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readStorkPriceB builds the BrownFi-owned Stork quote reading PTB call", () => {
  const tx = createTransactionRecorder();
  readStorkPriceB({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    storkState: "0xSTORKSTATE",
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::stork_source::read_price_b",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xSTORKSTATE" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readStorkSingleUpdateFeeInMist builds the Stork state fee read PTB call", () => {
  const tx = createTransactionRecorder();
  readStorkSingleUpdateFeeInMist({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xSTORK::state::get_single_update_fee_in_mist",
    typeArguments: [],
    arguments: [{ kind: "object", id: "0xSTORKSTATE" }]
  });
});

test("readStorkTotalUpdateFeeInMist builds the Stork total fee read PTB call", () => {
  const tx = createTransactionRecorder();
  readStorkTotalUpdateFeeInMist({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    numUpdates: 3n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xSTORK::state::get_total_fees_in_mist",
    typeArguments: [],
    arguments: [{ kind: "object", id: "0xSTORKSTATE" }, { kind: "u64", value: "3" }]
  });
});

test("buildStorkTemporalNumericValueEvmInput builds the Stork single update-data PTB call", () => {
  const tx = createTransactionRecorder();
  const result = buildStorkTemporalNumericValueEvmInput({
    storkPackageId: "0xSTORK",
    id: Uint8Array.from([1, 2]),
    temporalNumericValueTimestampNs: 123n,
    temporalNumericValueMagnitude: 456n,
    temporalNumericValueNegative: true,
    publisherMerkleRoot: [3, 4],
    valueComputeAlgHash: Uint8Array.from([5]),
    r: [6, 7],
    s: Uint8Array.from([8]),
    v: 27
  })(tx);

  assert.deepEqual(result, { kind: "result", index: 0 });
  assert.deepEqual(tx.calls[0], {
    target: "0xSTORK::update_temporal_numeric_value_evm_input::new",
    typeArguments: [],
    arguments: [
      { kind: "pure-vector", type: "u8", values: [1, 2] },
      { kind: "u64", value: "123" },
      { kind: "u128", value: "456" },
      { kind: "bool", value: true },
      { kind: "pure-vector", type: "u8", values: [3, 4] },
      { kind: "pure-vector", type: "u8", values: [5] },
      { kind: "pure-vector", type: "u8", values: [6, 7] },
      { kind: "pure-vector", type: "u8", values: [8] },
      { kind: "u8", value: "27" }
    ]
  });
});

test("storkSignedPriceToTemporalNumericValueEvmInputFields maps REST signed price fields", () => {
  const update = storkSignedPriceToTemporalNumericValueEvmInputFields({
    encoded_asset_id: "0x7404e3d104ea7841c3d9e6fd20adfe99b4ad586bc08d8f3bd3afef894cf184de",
    price: "93034248063749982000000",
    timestamped_signature: {
      timestamp: 1745436557678933200n,
      signature: {
        r: "0xb8e46bc91712ee9a1d5f163c4a25d6cbbf6660dc8e2dcdfafb19d89cdc87f3b3",
        s: "0x69b91a8412e19f90f4cd34e800e34b3702cd93169994bf9d75b20029458bce93",
        v: "0x1c"
      }
    },
    publisher_merkle_root: "0xb85ded8bf6d17f5040fba3f92e4ea0cd4dd94ff96f88389ac997f2f869cfc7de",
    calculation_alg: {
      checksum: "9be7e9f9ed459417d96112a7467bd0b27575a2c7847195c68f805b70ce1795ba"
    }
  });

  assert.deepEqual(
    Array.from(update.id),
    [
      116, 4, 227, 209, 4, 234, 120, 65, 195, 217, 230, 253, 32, 173, 254, 153,
      180, 173, 88, 107, 192, 141, 143, 59, 211, 175, 239, 137, 76, 241, 132, 222
    ]
  );
  assert.equal(update.temporalNumericValueTimestampNs, 1745436557678933200n);
  assert.equal(update.temporalNumericValueMagnitude, 93034248063749982000000n);
  assert.equal(update.temporalNumericValueNegative, false);
  assert.deepEqual(
    Array.from(update.valueComputeAlgHash),
    [
      155, 231, 233, 249, 237, 69, 148, 23, 217, 97, 18, 167, 70, 123, 208, 178,
      117, 117, 162, 199, 132, 113, 149, 198, 143, 128, 91, 112, 206, 23, 149, 186
    ]
  );
  assert.equal(update.v, 28);
});

test("storkSignedPriceToTemporalNumericValueEvmInputFields handles negative signed values", () => {
  const update = storkSignedPriceToTemporalNumericValueEvmInputFields({
    encoded_asset_id: "0x281a649a11eb25eca04f0025c15e99264a056229e722735c7d6c55fef649dfbf",
    price: "-3020199000000",
    timestamped_signature: {
      timestamp: "1750794968021348308",
      signature: {
        r: "0x14c36cf7272689cec0335efdc5f82dc2d4b1aceb8d2320d3245e4593df32e696",
        s: "0x79ab437ecd56dc9fcf850f192328840f7f47d5df57cb939d99146b33014c39f0",
        v: 27
      }
    },
    publisher_merkle_root: "0x5ea4136e8064520a3311961f3f7030dfbc0b96652f46a473e79f2a019b3cd878",
    calculation_alg: {
      checksum: "0x9be7e9f9ed459417d96112a7467bd0b27575a2c7847195c68f805b70ce1795ba"
    }
  });

  assert.equal(update.temporalNumericValueTimestampNs, 1750794968021348308n);
  assert.equal(update.temporalNumericValueMagnitude, 3020199000000n);
  assert.equal(update.temporalNumericValueNegative, true);
  assert.equal(update.v, 27);
});

test("Stork REST signed price fields can feed Move update-data construction", () => {
  const tx = createTransactionRecorder();
  const update = storkSignedPriceToTemporalNumericValueEvmInputFields({
    encoded_asset_id: "0x01",
    price: "456",
    timestamped_signature: {
      timestamp: 123,
      signature: {
        r: "0x0203",
        s: "0x04",
        v: "0x1b"
      }
    },
    publisher_merkle_root: "0x05",
    calculation_alg: {
      checksum: "06"
    }
  });

  buildStorkTemporalNumericValueEvmInput({
    storkPackageId: "0xSTORK",
    ...update
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xSTORK::update_temporal_numeric_value_evm_input::new",
    typeArguments: [],
    arguments: [
      { kind: "pure-vector", type: "u8", values: [1] },
      { kind: "u64", value: "123" },
      { kind: "u128", value: "456" },
      { kind: "bool", value: false },
      { kind: "pure-vector", type: "u8", values: [5] },
      { kind: "pure-vector", type: "u8", values: [6] },
      { kind: "pure-vector", type: "u8", values: [2, 3] },
      { kind: "pure-vector", type: "u8", values: [4] },
      { kind: "u8", value: "27" }
    ]
  });
});

test("storkSignedPriceToTemporalNumericValueEvmInputFields rejects malformed hex fields", () => {
  assert.throws(
    () =>
      storkSignedPriceToTemporalNumericValueEvmInputFields({
        encoded_asset_id: "0x0",
        price: "1",
        timestamped_signature: {
          timestamp: 1,
          signature: {
            r: "0x01",
            s: "0x02",
            v: 27
          }
        },
        publisher_merkle_root: "0x03",
        calculation_alg: {
          checksum: "0x04"
        }
      }),
    /Stork encoded_asset_id must be an even-length hex string/
  );
});

test("buildStorkTemporalNumericValueEvmInputVec builds the Stork batch update-data PTB call", () => {
  const tx = createTransactionRecorder();
  buildStorkTemporalNumericValueEvmInputVec({
    storkPackageId: "0xSTORK",
    updates: [
      {
        id: [1],
        temporalNumericValueTimestampNs: 10,
        temporalNumericValueMagnitude: 1000n,
        temporalNumericValueNegative: false,
        publisherMerkleRoot: [2],
        valueComputeAlgHash: [3],
        r: [4],
        s: [5],
        v: 27
      },
      {
        id: Uint8Array.from([6, 7]),
        temporalNumericValueTimestampNs: 11,
        temporalNumericValueMagnitude: 2000n,
        temporalNumericValueNegative: true,
        publisherMerkleRoot: Uint8Array.from([8]),
        valueComputeAlgHash: Uint8Array.from([9]),
        r: Uint8Array.from([10]),
        s: Uint8Array.from([11]),
        v: 28
      }
    ]
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xSTORK::update_temporal_numeric_value_evm_input_vec::new",
    typeArguments: [],
    arguments: [
      { kind: "pure-vector", type: "vector<u8>", values: [[1], [6, 7]] },
      { kind: "pure-vector", type: "u64", values: [10, 11] },
      { kind: "pure-vector", type: "u128", values: [1000n, 2000n] },
      { kind: "pure-vector", type: "bool", values: [false, true] },
      { kind: "pure-vector", type: "vector<u8>", values: [[2], [8]] },
      { kind: "pure-vector", type: "vector<u8>", values: [[3], [9]] },
      { kind: "pure-vector", type: "vector<u8>", values: [[4], [10]] },
      { kind: "pure-vector", type: "vector<u8>", values: [[5], [11]] },
      { kind: "pure-vector", type: "u8", values: [27, 28] }
    ]
  });
});

test("buildStorkTemporalNumericValueEvmInputVec rejects empty update lists", () => {
  const tx = createTransactionRecorder();
  assert.throws(
    () =>
      buildStorkTemporalNumericValueEvmInputVec({
        storkPackageId: "0xSTORK",
        updates: []
      })(tx),
    /Stork batch update-data construction requires at least one update/
  );
});

test("constructed Stork update data can feed a single update with gas fee", () => {
  const tx = createTransactionRecorder();
  const updateData = buildStorkTemporalNumericValueEvmInput({
    storkPackageId: "0xSTORK",
    id: [1],
    temporalNumericValueTimestampNs: 123,
    temporalNumericValueMagnitude: 456,
    temporalNumericValueNegative: false,
    publisherMerkleRoot: [],
    valueComputeAlgHash: [],
    r: [],
    s: [],
    v: 27
  })(tx);

  const result = updateSingleStorkTemporalNumericValueEvmWithGasFee({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    updateData,
    feeAmountInMist: 5000
  })(tx);

  assert.deepEqual(result, { kind: "result", index: 1 });
  assert.equal(tx.calls[0].target, "0xSTORK::update_temporal_numeric_value_evm_input::new");
  assert.deepEqual(tx.calls[1], {
    target: "0xSTORK::stork::update_single_temporal_numeric_value_evm",
    typeArguments: [],
    arguments: [
      { kind: "object", id: "0xSTORKSTATE" },
      updateData,
      { kind: "split", splitIndex: 0, resultIndex: 0 }
    ]
  });
});

test("updateSingleStorkTemporalNumericValueEvm builds the Stork single update PTB call", () => {
  const tx = createTransactionRecorder();
  const updateData = { kind: "result", index: 0 };
  const fee = { kind: "result", index: 1 };

  updateSingleStorkTemporalNumericValueEvm({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    updateData,
    fee
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xSTORK::stork::update_single_temporal_numeric_value_evm",
    typeArguments: [],
    arguments: [{ kind: "object", id: "0xSTORKSTATE" }, updateData, fee]
  });
});

test("updateMultipleStorkTemporalNumericValuesEvm builds the Stork batch update PTB call", () => {
  const tx = createTransactionRecorder();
  const updateData = { kind: "result", index: 0 };
  const fee = { kind: "object", id: "0xFEE" };

  updateMultipleStorkTemporalNumericValuesEvm({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    updateData,
    fee
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xSTORK::stork::update_multiple_temporal_numeric_values_evm",
    typeArguments: [],
    arguments: [{ kind: "object", id: "0xSTORKSTATE" }, updateData, fee]
  });
});

test("splitSuiFromGas builds a Sui gas coin split PTB command", () => {
  const tx = createTransactionRecorder();
  const fee = splitSuiFromGas({ amount: 1234n })(tx);

  assert.deepEqual(fee, { kind: "split", splitIndex: 0, resultIndex: 0 });
  assert.deepEqual(tx.splits, [
    {
      coin: { kind: "gas" },
      amounts: [{ kind: "u64", value: "1234" }]
    }
  ]);
});

test("splitSuiFromGas accepts a prior u64 transaction result as the split amount", () => {
  const tx = createTransactionRecorder();
  const amount = readStorkSingleUpdateFeeInMist({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE"
  })(tx);

  const fee = splitSuiFromGas({ amount })(tx);

  assert.deepEqual(fee, { kind: "split", splitIndex: 0, resultIndex: 0 });
  assert.deepEqual(tx.splits[0], {
    coin: { kind: "gas" },
    amounts: [amount]
  });
});

test("splitSuiFromGas rejects builders without gas coin splitting support", () => {
  const tx = {
    object(id) {
      return { kind: "object", id };
    },
    pure: {
      u64(value) {
        return { kind: "u64", value: String(value) };
      }
    },
    moveCall() {
      return { kind: "result", index: 0 };
    },
    makeMoveVec() {
      return { kind: "vector", index: 0 };
    }
  };

  assert.throws(
    () => splitSuiFromGas({ amount: 1 })(tx),
    /Transaction builder must support gas coin splitting/
  );
});

test("updateSingleStorkTemporalNumericValueEvmWithGasFee splits gas before Stork update", () => {
  const tx = createTransactionRecorder();
  const updateData = { kind: "result", index: 0 };

  const result = updateSingleStorkTemporalNumericValueEvmWithGasFee({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    updateData,
    feeAmountInMist: 5000
  })(tx);

  assert.deepEqual(result, { kind: "result", index: 0 });
  assert.deepEqual(tx.splits, [
    {
      coin: { kind: "gas" },
      amounts: [{ kind: "u64", value: "5000" }]
    }
  ]);
  assert.deepEqual(tx.calls[0], {
    target: "0xSTORK::stork::update_single_temporal_numeric_value_evm",
    typeArguments: [],
    arguments: [
      { kind: "object", id: "0xSTORKSTATE" },
      updateData,
      { kind: "split", splitIndex: 0, resultIndex: 0 }
    ]
  });
});

test("updateMultipleStorkTemporalNumericValuesEvmWithGasFee can use a fee read result", () => {
  const tx = createTransactionRecorder();
  const updateData = { kind: "result", index: 9 };
  const feeAmount = readStorkTotalUpdateFeeInMist({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    numUpdates: 2
  })(tx);

  const result = updateMultipleStorkTemporalNumericValuesEvmWithGasFee({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    updateData,
    feeAmountInMist: feeAmount
  })(tx);

  assert.deepEqual(result, { kind: "result", index: 1 });
  assert.deepEqual(tx.splits[0], {
    coin: { kind: "gas" },
    amounts: [feeAmount]
  });
  assert.deepEqual(tx.calls[1], {
    target: "0xSTORK::stork::update_multiple_temporal_numeric_values_evm",
    typeArguments: [],
    arguments: [
      { kind: "object", id: "0xSTORKSTATE" },
      updateData,
      { kind: "split", splitIndex: 0, resultIndex: 0 }
    ]
  });
});

test("updateSingleStorkTemporalNumericValueEvmWithSignedPrice builds update data, reads fee, and updates", () => {
  const tx = createTransactionRecorder();
  const result = updateSingleStorkTemporalNumericValueEvmWithSignedPrice({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    signedPrice: {
      encoded_asset_id: "0x01",
      price: "456",
      timestamped_signature: {
        timestamp: 123,
        signature: {
          r: "0x02",
          s: "0x03",
          v: 27
        }
      },
      publisher_merkle_root: "0x04",
      calculation_alg: {
        checksum: "0x05"
      }
    }
  })(tx);

  assert.deepEqual(result, { kind: "result", index: 2 });
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xSTORK::update_temporal_numeric_value_evm_input::new",
      "0xSTORK::state::get_single_update_fee_in_mist",
      "0xSTORK::stork::update_single_temporal_numeric_value_evm"
    ]
  );
  assert.deepEqual(tx.splits[0], {
    coin: { kind: "gas" },
    amounts: [{ kind: "result", index: 1 }]
  });
  assert.deepEqual(tx.calls[2].arguments, [
    { kind: "object", id: "0xSTORKSTATE" },
    { kind: "result", index: 0 },
    { kind: "split", splitIndex: 0, resultIndex: 0 }
  ]);
});

test("updateMultipleStorkTemporalNumericValuesEvmWithSignedPrices uses the total fee read", () => {
  const tx = createTransactionRecorder();
  const result = updateMultipleStorkTemporalNumericValuesEvmWithSignedPrices({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    signedPrices: [
      {
        encoded_asset_id: "0x01",
        price: "100",
        timestamped_signature: {
          timestamp: 10,
          signature: {
            r: "0x02",
            s: "0x03",
            v: 27
          }
        },
        publisher_merkle_root: "0x04",
        calculation_alg: {
          checksum: "0x05"
        }
      },
      {
        encoded_asset_id: "0x06",
        price: "-200",
        timestamped_signature: {
          timestamp: 11,
          signature: {
            r: "0x07",
            s: "0x08",
            v: 28
          }
        },
        publisher_merkle_root: "0x09",
        calculation_alg: {
          checksum: "0x0a"
        }
      }
    ]
  })(tx);

  assert.deepEqual(result, { kind: "result", index: 2 });
  assert.deepEqual(tx.calls[0], {
    target: "0xSTORK::update_temporal_numeric_value_evm_input_vec::new",
    typeArguments: [],
    arguments: [
      { kind: "pure-vector", type: "vector<u8>", values: [[1], [6]] },
      { kind: "pure-vector", type: "u64", values: [10n, 11n] },
      { kind: "pure-vector", type: "u128", values: [100n, 200n] },
      { kind: "pure-vector", type: "bool", values: [false, true] },
      { kind: "pure-vector", type: "vector<u8>", values: [[4], [9]] },
      { kind: "pure-vector", type: "vector<u8>", values: [[5], [10]] },
      { kind: "pure-vector", type: "vector<u8>", values: [[2], [7]] },
      { kind: "pure-vector", type: "vector<u8>", values: [[3], [8]] },
      { kind: "pure-vector", type: "u8", values: [27, 28] }
    ]
  });
  assert.deepEqual(tx.calls[1], {
    target: "0xSTORK::state::get_total_fees_in_mist",
    typeArguments: [],
    arguments: [{ kind: "object", id: "0xSTORKSTATE" }, { kind: "u64", value: "2" }]
  });
  assert.deepEqual(tx.splits[0], {
    coin: { kind: "gas" },
    amounts: [{ kind: "result", index: 1 }]
  });
  assert.deepEqual(tx.calls[2], {
    target: "0xSTORK::stork::update_multiple_temporal_numeric_values_evm",
    typeArguments: [],
    arguments: [
      { kind: "object", id: "0xSTORKSTATE" },
      { kind: "result", index: 0 },
      { kind: "split", splitIndex: 0, resultIndex: 0 }
    ]
  });
});

test("readSupraPushPriceA builds the BrownFi-owned Supra push price reading PTB call", () => {
  const tx = createTransactionRecorder();
  readSupraPushPriceA({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    supraHolder: "0xSUPRAHOLDER",
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::supra_source::read_push_price_a",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xSUPRAHOLDER" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readSupraPushPriceB builds the BrownFi-owned Supra push quote reading PTB call", () => {
  const tx = createTransactionRecorder();
  readSupraPushPriceB({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    supraHolder: "0xSUPRAHOLDER",
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::supra_source::read_push_price_b",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xSUPRAHOLDER" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readSupraPullPriceBundle builds one proof-verified BrownFi bundle PTB call", () => {
  const tx = createTransactionRecorder();
  readSupraPullPriceBundle({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    dkgState: "0xDKG",
    supraHolder: "0xSUPRAHOLDER",
    merkleRootHash: "0xMERKLEROOT",
    clock: "0x6",
    proofBytes: [1, 2, 3],
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::supra_pull_source::read_price_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xDKG" },
      { kind: "object", id: "0xSUPRAHOLDER" },
      { kind: "object", id: "0xMERKLEROOT" },
      { kind: "object", id: "0x6" },
      { kind: "pure-vector", type: "u8", values: [1, 2, 3] },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readSupraPullPriceBundleWithAmmReadings preserves AMM readings in the bundle PTB call", () => {
  const tx = createTransactionRecorder();
  readSupraPullPriceBundleWithAmmReadings({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    dkgState: "0xDKG",
    supraHolder: "0xSUPRAHOLDER",
    merkleRootHash: "0xMERKLEROOT",
    clock: "0x6",
    proofBytes: Uint8Array.from([4, 5, 6]),
    pool: "0xPOOLAB",
    ammReadings: ["0xAMMREADING"]
  })(tx);

  assert.deepEqual(tx.vectors[0], {
    type: "0xBROWN::oracle_gateway::AmmReading",
    elements: [{ kind: "object", id: "0xAMMREADING" }]
  });
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::supra_pull_source::read_price_bundle_with_amm_readings",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xDKG" },
      { kind: "object", id: "0xSUPRAHOLDER" },
      { kind: "object", id: "0xMERKLEROOT" },
      { kind: "object", id: "0x6" },
      { kind: "pure-vector", type: "u8", values: [4, 5, 6] },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "vector", index: 0 }
    ]
  });
});

test("encodeSupraPairIdConfig matches BrownFi Move BCS u32 config bytes", () => {
  const encoded = encodeSupraPairIdConfig(0x01020304);

  assert.ok(encoded instanceof Uint8Array);
  assert.deepEqual(Array.from(encoded), [4, 3, 2, 1]);
  assert.deepEqual(Array.from(encodeSupraPairIdConfig(0xffffffffn)), [255, 255, 255, 255]);
});

test("encodeSupraPairIdConfig rejects values outside u32 range", () => {
  assert.throws(() => encodeSupraPairIdConfig(-1), /Supra pair ID must be a u32/);
  assert.throws(() => encodeSupraPairIdConfig(0x1_0000_0000), /Supra pair ID must be a u32/);
  assert.throws(() => encodeSupraPairIdConfig(1.5), /Supra pair ID must be an integer/);
});

test("readPythTotalUpdateFeeInMist builds the Pyth total update fee PTB call", () => {
  const tx = createTransactionRecorder();

  const fee = readPythTotalUpdateFeeInMist({
    pythPackageId: "0xPYTH",
    pythState: "0xPYTHSTATE",
    numUpdates: 3
  })(tx);

  assert.deepEqual(fee, { kind: "result", index: 0 });
  assert.deepEqual(tx.calls, [
    {
      target: "0xPYTH::pyth::get_total_update_fee",
      typeArguments: [],
      arguments: [{ kind: "object", id: "0xPYTHSTATE" }, { kind: "u64", value: "3" }]
    }
  ]);
});

test("buildUpdatedPythPriceBundleFromFeeds updates Pyth before BrownFi reading and bundle calls", async () => {
  const tx = createTransactionRecorder();
  const priceFeedUpdates = [{ update: "vaa" }];
  const feedIds = ["feed-a", "feed-b"];
  const pythClient = {
    async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
      assert.equal(txArg, tx);
      assert.deepEqual(updatesArg, priceFeedUpdates);
      assert.notEqual(updatesArg, priceFeedUpdates);
      assert.deepEqual(feedIdsArg, feedIds);
      assert.notEqual(feedIdsArg, feedIds);
      assert.equal(tx.calls.length, 0);
      return ["0xPRICEA", "0xPRICEB"];
    }
  };

  const result = await buildUpdatedPythPriceBundleFromFeeds(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pythClient,
    priceFeedUpdates,
    feedIds,
    clock: "0x6",
    pool: "0xPOOLAB"
  });

  assert.deepEqual(result, { kind: "result", index: 2 });
  assert.deepEqual(tx.calls, [
    {
      target: "0xBROWN::pyth_source::read_price_a",
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "object", id: "0xPRICEA" },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" }
      ]
    },
    {
      target: "0xBROWN::pyth_source::read_price_b",
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "object", id: "0xPRICEB" },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" }
      ]
    },
    {
      target: "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "result", index: 0 },
        { kind: "result", index: 1 },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" }
      ]
    }
  ]);
});

test("buildUpdatedPythPriceBundleFromFeedsAndAmmReadings adds AMM readings after the Pyth update", async () => {
  const tx = createTransactionRecorder();
  const pythClient = {
    async updatePriceFeeds() {
      assert.equal(tx.calls.length, 0);
      return ["0xPRICEA", "0xPRICEB"];
    }
  };

  const result = await buildUpdatedPythPriceBundleFromFeedsAndAmmReadings(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pythClient,
    priceFeedUpdates: [{ update: "vaa" }],
    feedIds: ["feed-a", "feed-b"],
    clock: "0x6",
    pool: "0xPOOLAB",
    ammReadings: [{ kind: "result", index: 9 }]
  });

  assert.deepEqual(result, { kind: "result", index: 2 });
  assert.deepEqual(tx.vectors, [
    {
      type: "0xBROWN::oracle_gateway::PriceReading",
      elements: [{ kind: "result", index: 0 }]
    },
    {
      type: "0xBROWN::oracle_gateway::PriceReading",
      elements: [{ kind: "result", index: 1 }]
    },
    {
      type: "0xBROWN::oracle_gateway::AmmReading",
      elements: [{ kind: "result", index: 9 }]
    }
  ]);
  assert.deepEqual(tx.calls[2], {
    target: "0xBROWN::oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "vector", index: 0 },
      { kind: "vector", index: 1 },
      { kind: "vector", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("fetchAndBuildUpdatedPythPriceBundleFromFeeds fetches Hermes updates before Pyth update", async () => {
  const tx = createTransactionRecorder();
  const calls = [];
  const feedIds = ["feed-a", "feed-b"];
  const priceFeedConnection = {
    async getPriceFeedsUpdateData(feedIdsArg) {
      calls.push(["fetch", feedIdsArg]);
      return [{ update: "a-b" }];
    }
  };
  const pythClient = {
    async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
      calls.push(["update", txArg, updatesArg, feedIdsArg]);
      return ["0xPRICEA", "0xPRICEB"];
    }
  };

  const result = await fetchAndBuildUpdatedPythPriceBundleFromFeeds(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceFeedConnection,
    pythClient,
    feedIds,
    clock: "0x6",
    pool: "0xPOOLAB"
  });

  assert.deepEqual(result, { kind: "result", index: 2 });
  assert.deepEqual(calls, [
    ["fetch", feedIds],
    ["update", tx, [{ update: "a-b" }], feedIds]
  ]);
  assert.equal(tx.calls[2].target, "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings");
});

test("fetchAndUpdatePythPriceInfoObjectsFromFeeds fetches Hermes updates for pool creation", async () => {
  const tx = createTransactionRecorder();
  const calls = [];
  const feedIds = ["feed-a", "feed-b"];
  const priceFeedConnection = {
    async getPriceFeedsUpdateData(feedIdsArg) {
      calls.push(["fetch", feedIdsArg]);
      return [{ update: "a-b" }];
    }
  };
  const pythClient = {
    async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
      calls.push(["update", txArg, updatesArg, feedIdsArg]);
      return ["0xPRICEA", "0xPRICEB"];
    }
  };

  const result = await fetchAndUpdatePythPriceInfoObjectsFromFeeds(tx, {
    priceFeedConnection,
    pythClient,
    feedIds
  });

  assert.deepEqual(result, ["0xPRICEA", "0xPRICEB"]);
  assert.deepEqual(calls, [
    ["fetch", feedIds],
    ["update", tx, [{ update: "a-b" }], feedIds]
  ]);
  assert.equal(tx.calls.length, 0);
});

test("fetchAndBuildUpdatedPythPriceBundleFromFeedsAndAmmReadings composes fetched Pyth updates with AMM readings", async () => {
  const tx = createTransactionRecorder();
  const feedIds = ["feed-a", "feed-b"];
  const priceFeedConnection = {
    async getPriceFeedsUpdateData(feedIdsArg) {
      assert.deepEqual(feedIdsArg, feedIds);
      assert.notEqual(feedIdsArg, feedIds);
      return [{ update: "a-b" }];
    }
  };
  const pythClient = {
    async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
      assert.equal(txArg, tx);
      assert.deepEqual(updatesArg, [{ update: "a-b" }]);
      assert.deepEqual(feedIdsArg, feedIds);
      assert.notEqual(feedIdsArg, feedIds);
      return ["0xPRICEA", "0xPRICEB"];
    }
  };

  const result = await fetchAndBuildUpdatedPythPriceBundleFromFeedsAndAmmReadings(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceFeedConnection,
    pythClient,
    feedIds,
    clock: "0x6",
    pool: "0xPOOLAB",
    ammReadings: [{ kind: "result", index: 9 }]
  });

  assert.deepEqual(result, { kind: "result", index: 2 });
  assert.deepEqual(tx.vectors[2], {
    type: "0xBROWN::oracle_gateway::AmmReading",
    elements: [{ kind: "result", index: 9 }]
  });
  assert.equal(
    tx.calls[2].target,
    "0xBROWN::oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings"
  );
});

test("buildPythRoutePriceBundles deduplicates Pyth updates across route hops", async () => {
  const tx = createTransactionRecorder();
  const feedCalls = [];
  const updateCalls = [];
  const priceFeedConnection = {
    async getPriceFeedsUpdateData(feedIdsArg) {
      feedCalls.push(feedIdsArg);
      return feedIdsArg.map((feedId) => ({ update: feedId }));
    }
  };
  const pythClient = {
    async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 0);
      updateCalls.push({ updatesArg, feedIdsArg });
      return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
    }
  };

  const bundles = await buildPythRoutePriceBundles(tx, {
    priceFeedConnection,
    pythClient,
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ]
  });

  assert.deepEqual(feedCalls, [["feed-a", "feed-b", "feed-c"]]);
  assert.deepEqual(updateCalls, [
    {
      updatesArg: [{ update: "feed-a" }, { update: "feed-b" }, { update: "feed-c" }],
      feedIdsArg: ["feed-a", "feed-b", "feed-c"]
    }
  ]);
  assert.deepEqual(bundles, [
    { kind: "result", index: 2 },
    { kind: "result", index: 5 }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings"
    ]
  );
  assert.deepEqual(tx.calls[3].arguments[0], { kind: "object", id: "0xPRICEB" });
});

test("buildSwitchboardRoutePriceBundles fetches one quote update and builds route bundles", async () => {
  const tx = createTransactionRecorder();
  const fetchCalls = [];
  const switchboardClient = { network: "mainnet" };
  const quotes = { kind: "quotes", id: "switchboard-quotes" };

  const bundles = await buildSwitchboardRoutePriceBundles(tx, {
    switchboardClient,
    async fetchQuoteUpdate(clientArg, feedIdsArg, txArg) {
      assert.equal(clientArg, switchboardClient);
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 0);
      fetchCalls.push(feedIdsArg);
      return quotes;
    },
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        quoteVerifier: "0xVERIFIERAB",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        quoteVerifier: "0xVERIFIERBC",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ]
  });

  assert.deepEqual(fetchCalls, [["feed-a", "feed-b", "feed-c"]]);
  assert.deepEqual(bundles, [
    { kind: "result", index: 2 },
    { kind: "result", index: 5 }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::switchboard_source::read_price_a",
      "0xBROWN::switchboard_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::switchboard_source::read_price_a",
      "0xBROWN::switchboard_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings"
    ]
  );
  assert.deepEqual(tx.calls[0].arguments[1], quotes);
  assert.deepEqual(tx.calls[3].arguments[1], quotes);
});

test("createSwitchboardSuiClient wires the official Switchboard constructor", () => {
  const constructedWith = [];
  class FakeSwitchboardClient {
    constructor(suiClient) {
      this.suiClient = suiClient;
      constructedWith.push(suiClient);
    }
  }
  const suiClient = { rpc: "mainnet" };

  const switchboardClient = createSwitchboardSuiClient({
    SwitchboardClient: FakeSwitchboardClient,
    suiClient
  });

  assert.equal(switchboardClient.suiClient, suiClient);
  assert.deepEqual(constructedWith, [suiClient]);
});

test("createSwitchboardQuoteUpdateFetcher copies feed IDs before calling the official fetcher", async () => {
  const tx = createTransactionRecorder();
  const switchboardClient = { network: "mainnet" };
  const feedIds = ["feed-a", "feed-b"];
  const quotes = { kind: "quotes", id: "switchboard-quotes" };

  const fetchQuoteUpdate = createSwitchboardQuoteUpdateFetcher(
    async (clientArg, feedIdsArg, txArg) => {
      assert.equal(clientArg, switchboardClient);
      assert.equal(txArg, tx);
      assert.deepEqual(feedIdsArg, feedIds);
      assert.notEqual(feedIdsArg, feedIds);
      feedIdsArg.push("mutated-by-fetcher");
      return quotes;
    }
  );

  assert.equal(await fetchQuoteUpdate(switchboardClient, feedIds, tx), quotes);
  assert.deepEqual(feedIds, ["feed-a", "feed-b"]);
});

test("createSwitchboardQuoteUpdateFetcher forwards official quote update options", async () => {
  const tx = createTransactionRecorder();
  const switchboardClient = { network: "mainnet" };
  const quoteUpdateOptions = {
    crossbarUrl: "https://crossbar.switchboard.xyz",
    numOracles: 3,
    switchboardAddress: "0xSWITCHBOARD"
  };
  const quotes = { kind: "quotes", id: "switchboard-quotes" };

  const fetchQuoteUpdate = createSwitchboardQuoteUpdateFetcher(
    async (clientArg, feedIdsArg, txArg, quoteUpdateOptionsArg) => {
      assert.equal(clientArg, switchboardClient);
      assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
      assert.equal(txArg, tx);
      assert.equal(quoteUpdateOptionsArg, quoteUpdateOptions);
      return quotes;
    }
  );

  assert.equal(
    await fetchQuoteUpdate(switchboardClient, ["feed-a", "feed-b"], tx, quoteUpdateOptions),
    quotes
  );
});

test("createSwitchboardSuiRoutePriceProvider plugs official client and quote fetcher into routes", async () => {
  const tx = createTransactionRecorder();
  const constructedWith = [];
  const suiClient = { rpc: "testnet" };
  const quotes = { kind: "quotes", id: "route-quotes" };
  const fetchCalls = [];
  class FakeSwitchboardClient {
    constructor(suiClientArg) {
      this.suiClient = suiClientArg;
      constructedWith.push(suiClientArg);
    }
  }

  const provider = createSwitchboardSuiRoutePriceProvider({
    SwitchboardClient: FakeSwitchboardClient,
    suiClient,
    async fetchQuoteUpdate(clientArg, feedIdsArg, txArg) {
      assert.equal(clientArg.suiClient, suiClient);
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 0);
      fetchCalls.push(feedIdsArg);
      return quotes;
    }
  });

  assert.equal(provider.id, "switchboard");
  const bundles = await provider.buildPriceBundles(tx, {
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        quoteVerifier: "0xVERIFIERAB",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      }
    ]
  });

  assert.deepEqual(constructedWith, [suiClient]);
  assert.deepEqual(fetchCalls, [["feed-a", "feed-b"]]);
  assert.deepEqual(bundles, [{ kind: "result", index: 2 }]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::switchboard_source::read_price_a",
      "0xBROWN::switchboard_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings"
    ]
  );
  assert.deepEqual(tx.calls[0].arguments[1], quotes);
});

test("createSwitchboardSuiRoutePriceProvider forwards official quote update options into routes", async () => {
  const tx = createTransactionRecorder();
  const suiClient = { rpc: "testnet" };
  const quoteUpdateOptions = {
    crossbarUrl: "https://crossbar.switchboard.xyz",
    feeCoin: { kind: "object", id: "0xFEECOIN" },
    feeType: "0x2::sui::SUI",
    numOracles: 2
  };
  const quotes = { kind: "quotes", id: "route-quotes" };
  class FakeSwitchboardClient {
    constructor(suiClientArg) {
      this.suiClient = suiClientArg;
    }
  }

  const provider = createSwitchboardSuiRoutePriceProvider({
    SwitchboardClient: FakeSwitchboardClient,
    suiClient,
    quoteUpdateOptions,
    async fetchQuoteUpdate(clientArg, feedIdsArg, txArg, quoteUpdateOptionsArg) {
      assert.equal(clientArg.suiClient, suiClient);
      assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
      assert.equal(txArg, tx);
      assert.equal(quoteUpdateOptionsArg, quoteUpdateOptions);
      return quotes;
    }
  });

  const bundles = await provider.buildPriceBundles(tx, {
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        quoteVerifier: "0xVERIFIERAB",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      }
    ]
  });

  assert.deepEqual(bundles, [{ kind: "result", index: 2 }]);
  assert.deepEqual(tx.calls[0].arguments[1], quotes);
});

test("buildSwitchboardRoutePriceBundles forwards official quote update options", async () => {
  const tx = createTransactionRecorder();
  const switchboardClient = { network: "mainnet" };
  const quoteUpdateOptions = {
    crossbarUrl: "https://crossbar.switchboard.xyz",
    numOracles: 4
  };
  const quotes = { kind: "quotes", id: "switchboard-quotes" };

  const bundles = await buildSwitchboardRoutePriceBundles(tx, {
    switchboardClient,
    quoteUpdateOptions,
    async fetchQuoteUpdate(clientArg, feedIdsArg, txArg, quoteUpdateOptionsArg) {
      assert.equal(clientArg, switchboardClient);
      assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
      assert.equal(txArg, tx);
      assert.equal(quoteUpdateOptionsArg, quoteUpdateOptions);
      return quotes;
    },
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        quoteVerifier: "0xVERIFIERAB",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      }
    ]
  });

  assert.deepEqual(bundles, [{ kind: "result", index: 2 }]);
  assert.deepEqual(tx.calls[0].arguments[1], quotes);
});

test("buildStorkRoutePriceBundles updates feeds once and builds route bundles", async () => {
  const tx = createTransactionRecorder();
  const updateCalls = [];
  const storkClient = { network: "mainnet" };

  const bundles = await buildStorkRoutePriceBundles(tx, {
    storkClient,
    async updatePriceFeeds(clientArg, feedIdsArg, txArg) {
      assert.equal(clientArg, storkClient);
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 0);
      updateCalls.push(feedIdsArg);
    },
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        storkState: "0xSTORKSTATE",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        storkState: "0xSTORKSTATE",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ]
  });

  assert.deepEqual(updateCalls, [["feed-a", "feed-b", "feed-c"]]);
  assert.deepEqual(bundles, [
    { kind: "result", index: 2 },
    { kind: "result", index: 5 }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::stork_source::read_price_a",
      "0xBROWN::stork_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::stork_source::read_price_a",
      "0xBROWN::stork_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings"
    ]
  );
  assert.deepEqual(tx.calls[0].arguments[0], { kind: "object", id: "0xSTORKSTATE" });
  assert.deepEqual(tx.calls[3].arguments[0], { kind: "object", id: "0xSTORKSTATE" });
});

test("createStorkSignedPriceUpdater fetches signed prices before Stork route bundles", async () => {
  const tx = createTransactionRecorder();
  const storkClient = { network: "mainnet" };
  const feedIds = ["feed-a", "feed-b"];
  const signedPrices = [
    {
      encoded_asset_id: "0x01",
      price: "100",
      timestamped_signature: {
        timestamp: 10,
        signature: {
          r: "0x02",
          s: "0x03",
          v: 27
        }
      },
      publisher_merkle_root: "0x04",
      calculation_alg: {
        checksum: "0x05"
      }
    },
    {
      encoded_asset_id: "0x06",
      price: "200",
      timestamped_signature: {
        timestamp: 11,
        signature: {
          r: "0x07",
          s: "0x08",
          v: 28
        }
      },
      publisher_merkle_root: "0x09",
      calculation_alg: {
        checksum: "0x0a"
      }
    }
  ];
  const updatePriceFeeds = createStorkSignedPriceUpdater({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    async fetchSignedPrices(clientArg, feedIdsArg, txArg) {
      assert.equal(clientArg, storkClient);
      assert.deepEqual(feedIdsArg, feedIds);
      assert.notEqual(feedIdsArg, feedIds);
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 0);
      feedIdsArg.push("mutated-by-fetcher");
      return signedPrices;
    }
  });

  const bundles = await buildStorkRoutePriceBundles(tx, {
    storkClient,
    updatePriceFeeds,
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        storkState: "0xSTORKSTATE",
        pool: "0xPOOLAB",
        feedIds
      }
    ]
  });

  assert.deepEqual(feedIds, ["feed-a", "feed-b"]);
  assert.deepEqual(bundles, [{ kind: "result", index: 5 }]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xSTORK::update_temporal_numeric_value_evm_input_vec::new",
      "0xSTORK::state::get_total_fees_in_mist",
      "0xSTORK::stork::update_multiple_temporal_numeric_values_evm",
      "0xBROWN::stork_source::read_price_a",
      "0xBROWN::stork_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings"
    ]
  );
});

test("getStorkRestEndpoint returns documented Stork REST endpoints", () => {
  assert.equal(
    getStorkRestEndpoint("mainnet"),
    "https://rest.jp.stork-oracle.network"
  );
  assert.equal(
    getStorkRestEndpoint("devnet"),
    "https://rest.dev.stork-oracle.network"
  );
});

test("storkRestLatestPricesResponseToSignedPrices extracts signed prices in feed order", () => {
  const btcSignedPrice = {
    encoded_asset_id: "0x01",
    price: "100",
    timestamped_signature: {
      timestamp: "10",
      signature: {
        r: "0x02",
        s: "0x03",
        v: "0x1b"
      }
    },
    publisher_merkle_root: "0x04",
    calculation_alg: {
      checksum: "0x05"
    }
  };
  const ethSignedPrice = {
    encoded_asset_id: "0x06",
    price: "200",
    timestamped_signature: {
      timestamp: "11",
      signature: {
        r: "0x07",
        s: "0x08",
        v: "0x1c"
      }
    },
    publisher_merkle_root: "0x09",
    calculation_alg: {
      checksum: "0x0a"
    }
  };

  const signedPrices = storkRestLatestPricesResponseToSignedPrices(
    {
      data: {
        value: {
          ETHUSD: {
            stork_signed_price: ethSignedPrice
          },
          BTCUSD: {
            stork_signed_price: btcSignedPrice
          }
        }
      }
    },
    ["BTCUSD", "ETHUSD"]
  );

  assert.deepEqual(signedPrices, [btcSignedPrice, ethSignedPrice]);
});

test("createStorkRestSignedPriceFetcher requests latest signed prices with Basic auth", async () => {
  const requests = [];
  const fetchSignedPrices = createStorkRestSignedPriceFetcher({
    endpoint: "https://rest.jp.stork-oracle.network/",
    apiKey: "stork-token",
    async fetch(url, init) {
      requests.push({ url, init });
      return {
        ok: true,
        async json() {
          return {
            data: {
              value: {
                BTCUSD: {
                  stork_signed_price: {
                    encoded_asset_id: "0x01",
                    price: "100",
                    timestamped_signature: {
                      timestamp: "10",
                      signature: {
                        r: "0x02",
                        s: "0x03",
                        v: "0x1b"
                      }
                    },
                    publisher_merkle_root: "0x04",
                    calculation_alg: {
                      checksum: "0x05"
                    }
                  }
                },
                ETHUSD: {
                  stork_signed_price: {
                    encoded_asset_id: "0x06",
                    price: "200",
                    timestamped_signature: {
                      timestamp: "11",
                      signature: {
                        r: "0x07",
                        s: "0x08",
                        v: "0x1c"
                      }
                    },
                    publisher_merkle_root: "0x09",
                    calculation_alg: {
                      checksum: "0x0a"
                    }
                  }
                }
              }
            }
          };
        }
      };
    }
  });

  const feedIds = ["BTCUSD", "ETHUSD"];
  const signedPrices = await fetchSignedPrices({ network: "mainnet" }, feedIds, createTransactionRecorder());

  assert.deepEqual(
    signedPrices.map((price) => price.encoded_asset_id),
    ["0x01", "0x06"]
  );
  assert.deepEqual(feedIds, ["BTCUSD", "ETHUSD"]);
  assert.deepEqual(requests, [
    {
      url: "https://rest.jp.stork-oracle.network/v1/prices/latest?assets=BTCUSD%2CETHUSD",
      init: {
        method: "GET",
        headers: {
          authorization: "Basic stork-token",
          accept: "application/json"
        }
      }
    }
  ]);
});

test("createStorkRestRoutePriceProvider fetches REST signed prices before Stork route bundles", async () => {
  const tx = createTransactionRecorder();
  const requests = [];
  const provider = createStorkRestRoutePriceProvider({
    storkPackageId: "0xSTORK",
    storkState: "0xSTORKSTATE",
    endpoint: "https://rest.jp.stork-oracle.network/",
    apiKey: "stork-token",
    async fetch(url, init) {
      requests.push({ url, init });
      return {
        ok: true,
        async json() {
          return {
            data: {
              value: {
                BTCUSD: {
                  stork_signed_price: {
                    encoded_asset_id: "0x01",
                    price: "100",
                    timestamped_signature: {
                      timestamp: "10",
                      signature: {
                        r: "0x02",
                        s: "0x03",
                        v: "0x1b"
                      }
                    },
                    publisher_merkle_root: "0x04",
                    calculation_alg: {
                      checksum: "0x05"
                    }
                  }
                },
                ETHUSD: {
                  stork_signed_price: {
                    encoded_asset_id: "0x06",
                    price: "200",
                    timestamped_signature: {
                      timestamp: "11",
                      signature: {
                        r: "0x07",
                        s: "0x08",
                        v: "0x1c"
                      }
                    },
                    publisher_merkle_root: "0x09",
                    calculation_alg: {
                      checksum: "0x0a"
                    }
                  }
                }
              }
            }
          };
        }
      };
    }
  });

  assert.equal(provider.id, "stork-rest");

  const bundles = await provider.buildPriceBundles(tx, {
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        storkState: "0xSTORKSTATE",
        pool: "0xPOOLAB",
        feedIds: ["BTCUSD", "ETHUSD"]
      }
    ]
  });

  assert.deepEqual(requests, [
    {
      url: "https://rest.jp.stork-oracle.network/v1/prices/latest?assets=BTCUSD%2CETHUSD",
      init: {
        method: "GET",
        headers: {
          authorization: "Basic stork-token",
          accept: "application/json"
        }
      }
    }
  ]);
  assert.deepEqual(bundles, [{ kind: "result", index: 5 }]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xSTORK::update_temporal_numeric_value_evm_input_vec::new",
      "0xSTORK::state::get_total_fees_in_mist",
      "0xSTORK::stork::update_multiple_temporal_numeric_values_evm",
      "0xBROWN::stork_source::read_price_a",
      "0xBROWN::stork_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings"
    ]
  );
});

test("buildSupraPushRoutePriceBundles builds route bundles without update hooks", async () => {
  const tx = createTransactionRecorder();

  const bundles = await buildSupraPushRoutePriceBundles(tx, {
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        supraHolder: "0xSUPRAHOLDER",
        pool: "0xPOOLAB"
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        supraHolder: "0xSUPRAHOLDER",
        pool: "0xPOOLBC"
      }
    ]
  });

  assert.deepEqual(bundles, [
    { kind: "result", index: 2 },
    { kind: "result", index: 5 }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::supra_source::read_push_price_a",
      "0xBROWN::supra_source::read_push_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::supra_source::read_push_price_a",
      "0xBROWN::supra_source::read_push_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings"
    ]
  );
});

test("buildSupraPullRoutePriceBundles verifies one proof per hop and preserves AMM readings", async () => {
  const tx = createTransactionRecorder();

  const bundles = await buildSupraPullRoutePriceBundles(tx, {
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        dkgState: "0xDKG",
        supraHolder: "0xSUPRAHOLDER",
        merkleRootHash: "0xMERKLEROOT",
        proofBytes: [1, 2, 3],
        pool: "0xPOOLAB"
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        dkgState: "0xDKG",
        supraHolder: "0xSUPRAHOLDER",
        merkleRootHash: "0xMERKLEROOT",
        proofBytes: [4, 5, 6],
        pool: "0xPOOLBC",
        ammReadings: ["0xAMMREADINGBC"]
      }
    ]
  });

  assert.deepEqual(bundles, [
    { kind: "result", index: 0 },
    { kind: "result", index: 1 }
  ]);
  assert.deepEqual(tx.vectors, [
    {
      type: "0xBROWN::oracle_gateway::AmmReading",
      elements: [{ kind: "object", id: "0xAMMREADINGBC" }]
    }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::supra_pull_source::read_price_bundle",
      "0xBROWN::supra_pull_source::read_price_bundle_with_amm_readings"
    ]
  );
});

test("getSupraPullRestEndpoint returns documented Dora REST endpoints", () => {
  assert.equal(
    getSupraPullRestEndpoint("mainnet"),
    "https://rpc-mainnet-dora-2.supra.com"
  );
  assert.equal(
    getSupraPullRestEndpoint("testnet"),
    "https://rpc-testnet-dora-2.supra.com"
  );
});

test("supraPullRestProofResponseToPayload decodes REST Sui proof response", () => {
  const payload = supraPullRestProofResponseToPayload({
    pair_indexes: [0, 21],
    dkg_object: "0xDKG",
    oracle_holder_object: "0xSUPRAHOLDER",
    merkle_root_object: "0xMERKLEROOT",
    proof_bytes: "0x0a0B"
  });

  assert.deepEqual(payload, {
    pairIndexes: [0, 21],
    dkgState: "0xDKG",
    supraHolder: "0xSUPRAHOLDER",
    merkleRootHash: "0xMERKLEROOT",
    proofBytes: Uint8Array.from([10, 11])
  });
});

test("createSupraPullRestProofFetcher posts Sui proof request and validates returned pair indexes", async () => {
  const requests = [];
  const fetchProof = createSupraPullRestProofFetcher({
    endpoint: "https://rpc-testnet-dora-2.supra.com",
    async fetch(url, init) {
      requests.push({ url, init });
      return {
        ok: true,
        async json() {
          return {
            pair_indexes: [0, 21],
            dkg_object: "0xDKG",
            oracle_holder_object: "0xSUPRAHOLDER",
            merkle_root_object: "0xMERKLEROOT",
            proof_bytes: "0a0b"
          };
        }
      };
    }
  });

  const payload = await fetchProof([0, 21]);

  assert.deepEqual(payload.proofBytes, Uint8Array.from([10, 11]));
  assert.deepEqual(requests, [
    {
      url: "https://rpc-testnet-dora-2.supra.com/get_proof",
      init: {
        method: "POST",
        headers: {
          "content-type": "application/json"
        },
        body: JSON.stringify({
          pair_indexes: [0, 21],
          chain_type: "sui"
        })
      }
    }
  ]);
});

test("createSupraPullRestProofFetcher rejects proof responses for different pair indexes", async () => {
  const fetchProof = createSupraPullRestProofFetcher({
    endpoint: "https://rpc-testnet-dora-2.supra.com/",
    async fetch() {
      return {
        ok: true,
        async json() {
          return {
            pair_indexes: [0, 22],
            dkg_object: "0xDKG",
            oracle_holder_object: "0xSUPRAHOLDER",
            merkle_root_object: "0xMERKLEROOT",
            proof_bytes: "0a0b"
          };
        }
      };
    }
  });

  await assert.rejects(
    () => fetchProof([0, 21]),
    /Supra pull proof pair indexes do not match the request/
  );
});

test("buildSupraPullRestRoutePriceBundles fetches one REST proof per hop", async () => {
  const tx = createTransactionRecorder();
  const proofRequests = [];

  const bundles = await buildSupraPullRestRoutePriceBundles(tx, {
    clock: "0x6",
    async fetchProof(pairIndexes) {
      proofRequests.push(pairIndexes);
      const suffix = proofRequests.length;
      return {
        pairIndexes,
        dkgState: `0xDKG${suffix}`,
        supraHolder: `0xSUPRAHOLDER${suffix}`,
        merkleRootHash: `0xMERKLEROOT${suffix}`,
        proofBytes: Uint8Array.from([suffix])
      };
    },
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        pairIndexes: [0, 21]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        pairIndexes: [21, 61],
        ammReadings: ["0xAMMREADINGBC"]
      }
    ]
  });

  assert.deepEqual(proofRequests, [
    [0, 21],
    [21, 61]
  ]);
  assert.deepEqual(bundles, [
    { kind: "result", index: 0 },
    { kind: "result", index: 1 }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::supra_pull_source::read_price_bundle",
      "0xBROWN::supra_pull_source::read_price_bundle_with_amm_readings"
    ]
  );
});

test("createSupraPullRestRoutePriceProvider plugs REST proofs into registered routes", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([
    createSupraPullRestRoutePriceProvider({
      async fetchProof(pairIndexes) {
        return {
          pairIndexes,
          dkgState: "0xDKG",
          supraHolder: "0xSUPRAHOLDER",
          merkleRootHash: "0xMERKLEROOT",
          proofBytes: Uint8Array.from([1, 2, 3])
        };
      }
    })
  ]);

  await swapExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "supra-pull-rest",
    clock: "0x6",
    path: ["0x1::a::A", "0x1::b::B"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        pairIndexes: [0, 21]
      }
    ],
    input: "0xCOINA",
    minOutputs: [1000]
  });

  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::supra_pull_source::read_price_bundle",
      "0xBROWN::router::swap_exact_a_for_b_with_bundle"
    ]
  );
});

test("createRoutePriceProviderRegistry rejects duplicate provider IDs", () => {
  assert.throws(
    () =>
      createRoutePriceProviderRegistry([
        {
          id: "custom",
          async buildPriceBundles() {
            return [];
          }
        },
        {
          id: "custom",
          async buildPriceBundles() {
            return [];
          }
        }
      ]),
    /Duplicate BrownFi route price provider: custom/
  );
});

test("createFlowXDirectAmmRoutePriceProvider builds FlowX AMM readings before delegating", async () => {
  const tx = createTransactionRecorder();
  const receivedHops = [];
  const baseProvider = {
    id: "custom",
    async buildPriceBundles(txArg, bundleOptions) {
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 1);
      receivedHops.push(...bundleOptions.hops);
      return [
        tx.moveCall({
          target: "0xCUSTOM::provider::bundle",
          typeArguments: [],
          arguments: [bundleOptions.hops[0].ammReadings[0]]
        })
      ];
    }
  };
  const provider = createFlowXDirectAmmRoutePriceProvider({
    routePriceProvider: baseProvider
  });
  const hop = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pool: "0xBROWNPOOL",
    flowxDirectAmm: [
      {
        flowxPool: "0xFLOWXPOOL",
        sourceMask: 16,
        twapWindowSeconds: 60,
        twalWindowSeconds: 300,
        validForMs: 5000
      }
    ]
  };

  const bundles = await provider.buildPriceBundles(tx, {
    clock: "0x6",
    hops: [hop]
  });

  assert.equal(provider.id, "custom");
  assert.deepEqual(bundles, [{ kind: "result", index: 1 }]);
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::amm_flowx::read_direct_pool",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xBROWNPOOL" },
      { kind: "object", id: "0xFLOWXPOOL" },
      { kind: "object", id: "0x6" },
      { kind: "u64", value: "16" },
      { kind: "u64", value: "60" },
      { kind: "u64", value: "300" },
      { kind: "u64", value: "5000" }
    ]
  });
  assert.deepEqual(receivedHops[0].ammReadings, [{ kind: "result", index: 0 }]);
  assert.equal(hop.ammReadings, undefined);
});

test("createFlowXDirectAmmRoutePriceProvider appends generated FlowX readings to existing AMM readings", async () => {
  const tx = createTransactionRecorder();
  const baseProvider = {
    id: "custom",
    async buildPriceBundles(txArg, bundleOptions) {
      assert.equal(txArg, tx);
      assert.deepEqual(bundleOptions.hops[0].ammReadings, [
        "0xEXISTINGAMM",
        { kind: "result", index: 0 },
        { kind: "result", index: 1 }
      ]);
      return [{ kind: "result", index: 99 }];
    }
  };
  const provider = createFlowXDirectAmmRoutePriceProvider({
    id: "custom-with-flowx",
    routePriceProvider: baseProvider
  });

  const bundles = await provider.buildPriceBundles(tx, {
    clock: "0x6",
    hops: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xBROWNPOOL",
        ammReadings: ["0xEXISTINGAMM"],
        flowxDirectAmm: [
          {
            flowxPool: "0xFLOWXPOOL1",
            sourceMask: 16,
            twapWindowSeconds: 0,
            twalWindowSeconds: 0,
            validForMs: 5000
          },
          {
            flowxPool: "0xFLOWXPOOL2",
            sourceMask: 32,
            twapWindowSeconds: 60,
            twalWindowSeconds: 300,
            validForMs: 5000
          }
        ]
      }
    ]
  });

  assert.equal(provider.id, "custom-with-flowx");
  assert.deepEqual(bundles, [{ kind: "result", index: 99 }]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::amm_flowx::read_direct_pool",
      "0xBROWN::amm_flowx::read_direct_pool"
    ]
  );
});

test("createFlowXTwoHopAmmRoutePriceProvider builds FlowX path readings before delegating", async () => {
  const tx = createTransactionRecorder();
  const receivedHops = [];
  const baseProvider = {
    id: "custom",
    async buildPriceBundles(txArg, bundleOptions) {
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 1);
      receivedHops.push(...bundleOptions.hops);
      return [
        tx.moveCall({
          target: "0xCUSTOM::provider::bundle",
          typeArguments: [],
          arguments: [bundleOptions.hops[0].ammReadings[1]]
        })
      ];
    }
  };
  const provider = createFlowXTwoHopAmmRoutePriceProvider({
    routePriceProvider: baseProvider
  });
  const hop = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pool: "0xBROWNPOOL",
    ammReadings: ["0xEXISTINGAMM"],
    flowxTwoHopAmm: [
      {
        typeI: "0x1::i::I",
        baseIntermediatePool: "0xFLOWXBI",
        intermediateQuotePool: "0xFLOWXIA",
        sourceMask: 64,
        intermediateDecimals: 9,
        twapWindowSeconds: 60,
        twalWindowSeconds: 300,
        validForMs: 5000
      }
    ]
  };

  const bundles = await provider.buildPriceBundles(tx, {
    clock: "0x6",
    hops: [hop]
  });

  assert.equal(provider.id, "custom");
  assert.deepEqual(bundles, [{ kind: "result", index: 1 }]);
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::amm_flowx::read_two_hop_path",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::i::I"],
    arguments: [
      { kind: "object", id: "0xBROWNPOOL" },
      { kind: "object", id: "0xFLOWXBI" },
      { kind: "object", id: "0xFLOWXIA" },
      { kind: "object", id: "0x6" },
      { kind: "u64", value: "64" },
      { kind: "u8", value: "9" },
      { kind: "u64", value: "60" },
      { kind: "u64", value: "300" },
      { kind: "u64", value: "5000" }
    ]
  });
  assert.deepEqual(receivedHops[0].ammReadings, [
    "0xEXISTINGAMM",
    { kind: "result", index: 0 }
  ]);
  assert.deepEqual(hop.ammReadings, ["0xEXISTINGAMM"]);
});

test("createAmmReadingRoutePriceProvider appends caller-built AMM readings before delegating", async () => {
  const tx = createTransactionRecorder();
  const contexts = [];
  const baseProvider = {
    id: "custom",
    async buildPriceBundles(txArg, bundleOptions) {
      assert.equal(txArg, tx);
      assert.deepEqual(bundleOptions.hops[0].ammReadings, [
        "0xEXISTINGAMM",
        { kind: "result", index: 0 }
      ]);
      return [
        tx.moveCall({
          target: "0xCUSTOM::provider::bundle",
          typeArguments: [],
          arguments: [bundleOptions.hops[0].ammReadings[1]]
        })
      ];
    }
  };
  const provider = createAmmReadingRoutePriceProvider({
    routePriceProvider: baseProvider,
    buildAmmReadings(txArg, context) {
      assert.equal(txArg, tx);
      contexts.push(context);
      return txArg.moveCall({
        target: "0xCUSTOM_AMM::reader::read",
        typeArguments: [context.hop.typeA, context.hop.typeB],
        arguments: [
          txArg.object(context.hop.pool),
          txArg.object(context.clock),
          txArg.pure.u64(context.hopIndex)
        ]
      });
    }
  });
  const hop = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pool: "0xBROWNPOOL",
    ammReadings: ["0xEXISTINGAMM"]
  };

  const bundles = await provider.buildPriceBundles(tx, {
    clock: "0x6",
    hops: [hop]
  });

  assert.equal(provider.id, "custom");
  assert.deepEqual(bundles, [{ kind: "result", index: 1 }]);
  assert.deepEqual(tx.calls[0], {
    target: "0xCUSTOM_AMM::reader::read",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xBROWNPOOL" },
      { kind: "object", id: "0x6" },
      { kind: "u64", value: "0" }
    ]
  });
  assert.deepEqual(contexts, [
    {
      clock: "0x6",
      hop,
      hopIndex: 0
    }
  ]);
  assert.deepEqual(hop.ammReadings, ["0xEXISTINGAMM"]);
});

test("createStandardRoutePriceProviderRegistry registers configured production providers", () => {
  const priceFeedConnection = {
    async getPriceFeedsUpdateData() {
      return [];
    }
  };
  const pythClient = {
    async updatePriceFeeds() {
      return [];
    }
  };
  const switchboardClient = { network: "mainnet" };
  const storkClient = { network: "mainnet" };

  const registry = createStandardRoutePriceProviderRegistry({
    pyth: { priceFeedConnection, pythClient },
    switchboard: {
      switchboardClient,
      async fetchQuoteUpdate() {
        return { kind: "quotes", id: "switchboard-quotes" };
      }
    },
    stork: {
      storkClient,
      async updatePriceFeeds() {}
    },
    storkRest: {
      storkPackageId: "0xSTORK",
      storkState: "0xSTORKSTATE",
      network: "mainnet",
      apiKey: "stork-token",
      async fetch() {
        return {
          ok: true,
          async json() {
            return { data: { value: {} } };
          }
        };
      }
    },
    supraPush: true,
    supraPull: true,
    supraPullRest: {
      async fetchProof(pairIndexes) {
        return {
          pairIndexes,
          dkgState: "0xDKG",
          supraHolder: "0xSUPRAHOLDER",
          merkleRootHash: "0xMERKLEROOT",
          proofBytes: Uint8Array.from([1])
        };
      }
    }
  });

  assert.deepEqual([...registry.providers.keys()], [
    "pyth",
    "switchboard",
    "stork",
    "stork-rest",
    "supra-push",
    "supra-pull",
    "supra-pull-rest"
  ]);
  assert.equal(getRoutePriceProvider(registry, "pyth").id, "pyth");
  assert.equal(getRoutePriceProvider(registry, "switchboard").id, "switchboard");
  assert.equal(getRoutePriceProvider(registry, "stork").id, "stork");
  assert.equal(getRoutePriceProvider(registry, "stork-rest").id, "stork-rest");
  assert.equal(getRoutePriceProvider(registry, "supra-push").id, "supra-push");
  assert.equal(getRoutePriceProvider(registry, "supra-pull").id, "supra-pull");
  assert.equal(getRoutePriceProvider(registry, "supra-pull-rest").id, "supra-pull-rest");
});

test("createStandardRoutePriceProviderRegistry registers only configured providers", () => {
  const registry = createStandardRoutePriceProviderRegistry({
    pyth: {
      priceFeedConnection: {
        async getPriceFeedsUpdateData() {
          return [];
        }
      },
      pythClient: {
        async updatePriceFeeds() {
          return [];
        }
      }
    }
  });

  assert.deepEqual([...registry.providers.keys()], ["pyth"]);
  assert.equal(getRoutePriceProvider(registry, "pyth").id, "pyth");
  assert.throws(
    () => getRoutePriceProvider(registry, "stork-rest"),
    /No BrownFi route price provider registered for stork-rest/
  );
});

test("createStandardRoutePriceProviderRegistry rejects empty provider config", () => {
  assert.throws(
    () => createStandardRoutePriceProviderRegistry({}),
    /At least one BrownFi route price provider must be configured/
  );
});

test("createStandardRoutePriceProviderRegistry can wrap providers with FlowX AMM readings", async () => {
  const tx = createTransactionRecorder();
  const feedCalls = [];
  const updateCalls = [];
  const registry = createStandardRoutePriceProviderRegistry({
    pyth: {
      priceFeedConnection: {
        async getPriceFeedsUpdateData(feedIdsArg) {
          feedCalls.push(feedIdsArg);
          return feedIdsArg.map((feedId) => ({ update: feedId }));
        }
      },
      pythClient: {
        async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
          assert.equal(txArg, tx);
          assert.equal(tx.calls.length, 2);
          updateCalls.push({ updatesArg, feedIdsArg });
          return ["0xPRICEA", "0xPRICEB"];
        }
      }
    },
    flowxDirectAmm: true,
    flowxTwoHopAmm: true
  });

  const result = await swapExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "pyth",
    path: ["0x1::a::A", "0x1::b::B"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"],
        flowxDirectAmm: [
          {
            flowxPool: "0xFLOWXAB",
            sourceMask: 16,
            twapWindowSeconds: 60,
            twalWindowSeconds: 300,
            validForMs: 5000
          }
        ],
        flowxTwoHopAmm: [
          {
            typeI: "0x1::i::I",
            baseIntermediatePool: "0xFLOWXBI",
            intermediateQuotePool: "0xFLOWXIA",
            sourceMask: 64,
            intermediateDecimals: 9,
            twapWindowSeconds: 120,
            twalWindowSeconds: 600,
            validForMs: 5000
          }
        ]
      }
    ],
    input: "0xCOINA",
    minOutputs: [99]
  });

  assert.deepEqual(feedCalls, [["feed-a", "feed-b"]]);
  assert.deepEqual(updateCalls, [
    {
      updatesArg: [{ update: "feed-a" }, { update: "feed-b" }],
      feedIdsArg: ["feed-a", "feed-b"]
    }
  ]);
  assert.deepEqual(result, { kind: "result", index: 5 });
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::amm_flowx::read_direct_pool",
      "0xBROWN::amm_flowx::read_two_hop_path",
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings",
      "0xBROWN::router::swap_exact_a_for_b_with_bundle"
    ]
  );
  assert.deepEqual(tx.vectors[2], {
    type: "0xBROWN::oracle_gateway::AmmReading",
    elements: [
      { kind: "result", index: 0 },
      { kind: "result", index: 1 }
    ]
  });
});

test("createStandardRoutePriceProviderRegistry can wrap providers with caller-built AMM readings", async () => {
  const tx = createTransactionRecorder();
  const registry = createStandardRoutePriceProviderRegistry({
    pyth: {
      priceFeedConnection: {
        async getPriceFeedsUpdateData(feedIdsArg) {
          return feedIdsArg.map((feedId) => ({ update: feedId }));
        }
      },
      pythClient: {
        async updatePriceFeeds() {
          return ["0xPRICEA", "0xPRICEB"];
        }
      }
    },
    buildAmmReadings(txArg, context) {
      return txArg.moveCall({
        target: "0xCUSTOM_AMM::reader::read",
        typeArguments: [context.hop.typeA, context.hop.typeB],
        arguments: [
          txArg.object(context.hop.pool),
          txArg.object(context.clock),
          txArg.pure.u64(context.hopIndex)
        ]
      });
    }
  });

  await swapExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "pyth",
    path: ["0x1::a::A", "0x1::b::B"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      }
    ],
    input: "0xCOINA",
    minOutputs: [99]
  });

  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xCUSTOM_AMM::reader::read",
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings",
      "0xBROWN::router::swap_exact_a_for_b_with_bundle"
    ]
  );
  assert.deepEqual(
    tx.vectors.find((vector) => vector.type === "0xBROWN::oracle_gateway::AmmReading"),
    {
      type: "0xBROWN::oracle_gateway::AmmReading",
      elements: [{ kind: "result", index: 0 }]
    }
  );
});

test("swapExactInputWithRegisteredRoute builds bundles through the selected provider", async () => {
  const tx = createTransactionRecorder();
  const providerCalls = [];
  const customProvider = {
    id: "custom",
    async buildPriceBundles(txArg, optionsArg) {
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 0);
      providerCalls.push(optionsArg);
      return [
        { kind: "bundle", id: "ab" },
        { kind: "bundle", id: "bc" }
      ];
    }
  };
  const registry = createRoutePriceProviderRegistry([customProvider]);

  assert.equal(getRoutePriceProvider(registry, "custom"), customProvider);

  const result = await swapExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "custom",
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        customSource: "oracle-a-b"
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        customSource: "oracle-b-c"
      }
    ],
    input: "0xCOINA",
    minOutputs: [50n, 40n]
  });

  assert.deepEqual(providerCalls, [
    {
      clock: "0x6",
      hops: [
        {
          packageId: "0xBROWN",
          typeA: "0x1::a::A",
          typeB: "0x1::b::B",
          pool: "0xPOOLAB",
          customSource: "oracle-a-b"
        },
        {
          packageId: "0xBROWN",
          typeA: "0x1::b::B",
          typeB: "0x1::c::C",
          pool: "0xPOOLBC",
          customSource: "oracle-b-c"
        }
      ]
    }
  ]);
  assert.deepEqual(result, { kind: "result", index: 1 });
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::swap_exact_a_for_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "bundle", id: "ab" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "50" }
    ]
  });
  assert.deepEqual(tx.calls[1], {
    target: "0xBROWN::router::swap_exact_a_for_b_with_bundle",
    typeArguments: ["0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "bundle", id: "bc" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "result", index: 0 },
      { kind: "u64", value: "40" }
    ]
  });
});

test("addLiquidityWithRegisteredRoute builds a provider bundle for one pool", async () => {
  const tx = createTransactionRecorder();
  const providerCalls = [];
  const customProvider = {
    id: "custom",
    async buildPriceBundles(txArg, optionsArg) {
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 0);
      providerCalls.push(optionsArg);
      return [{ kind: "bundle", id: "ab" }];
    }
  };
  const registry = createRoutePriceProviderRegistry([customProvider]);

  const result = await addLiquidityWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "custom",
    clock: "0x6",
    pair: {
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      pool: "0xPOOLAB",
      customSource: "oracle-a-b"
    },
    inputA: "0xCOINA",
    inputB: { kind: "result", index: 7 },
    minLpOut: 505n
  });

  assert.deepEqual(providerCalls, [
    {
      clock: "0x6",
      hops: [
        {
          packageId: "0xBROWN",
          typeA: "0x1::a::A",
          typeB: "0x1::b::B",
          pool: "0xPOOLAB",
          customSource: "oracle-a-b"
        }
      ]
    }
  ]);
  assert.deepEqual(result, { kind: "result", index: 0 });
  assert.deepEqual(tx.calls, [
    {
      target: "0xBROWN::router::add_liquidity_with_bundle",
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "bundle", id: "ab" },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xCOINA" },
        { kind: "result", index: 7 },
        { kind: "u64", value: "505" }
      ]
    }
  ]);
});

test("quoteExactInputWithRegisteredRoute builds bundles and chains cutoff-aware quote amounts", async () => {
  const tx = createTransactionRecorder();
  const providerCalls = [];
  const customProvider = {
    id: "custom",
    async buildPriceBundles(txArg, optionsArg) {
      assert.equal(txArg, tx);
      assert.equal(tx.calls.length, 0);
      providerCalls.push(optionsArg);
      return [
        { kind: "bundle", id: "ab" },
        { kind: "bundle", id: "bc" }
      ];
    }
  };
  const registry = createRoutePriceProviderRegistry([customProvider]);

  const result = await quoteExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "custom",
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        customSource: "oracle-a-b"
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        customSource: "oracle-b-c"
      }
    ],
    amountIn: 123n
  });

  assert.deepEqual(providerCalls, [
    {
      clock: "0x6",
      hops: [
        {
          packageId: "0xBROWN",
          typeA: "0x1::a::A",
          typeB: "0x1::b::B",
          pool: "0xPOOLAB",
          customSource: "oracle-a-b"
        },
        {
          packageId: "0xBROWN",
          typeA: "0x1::b::B",
          typeB: "0x1::c::C",
          pool: "0xPOOLBC",
          customSource: "oracle-b-c"
        }
      ]
    }
  ]);
  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 0 },
    { kind: "result", index: 1 }
  ]);
  assert.deepEqual(result.amounts, [
    { kind: "u64", value: "123" },
    { kind: "nested-result", index: 0, resultIndex: 0 },
    { kind: "nested-result", index: 1, resultIndex: 0 }
  ]);
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::swap::quote_a_for_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "bundle", id: "ab" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "u64", value: "123" }
    ]
  });
  assert.deepEqual(tx.calls[1], {
    target: "0xBROWN::swap::quote_a_for_b_with_bundle",
    typeArguments: ["0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "bundle", id: "bc" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "nested-result", index: 0, resultIndex: 0 }
    ]
  });
});

test("quoteExactInputWithoutCutoffWithRegisteredRoute chains raw pre-cutoff quote amounts", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAB", "0xPOOLBC"]
        );
        return [
          { kind: "bundle", id: "ab" },
          { kind: "bundle", id: "bc" }
        ];
      }
    }
  ]);

  const result = await quoteExactInputWithoutCutoffWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "custom",
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB"
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC"
      }
    ],
    amountIn: 123n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 0 },
    { kind: "result", index: 1 }
  ]);
  assert.deepEqual(result.amounts, [
    { kind: "u64", value: "123" },
    { kind: "nested-result", index: 0, resultIndex: 1 },
    { kind: "nested-result", index: 1, resultIndex: 1 }
  ]);
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::swap::quote_a_for_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "bundle", id: "ab" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "u64", value: "123" }
    ]
  });
  assert.deepEqual(tx.calls[1], {
    target: "0xBROWN::swap::quote_a_for_b_with_bundle",
    typeArguments: ["0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "bundle", id: "bc" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "nested-result", index: 0, resultIndex: 1 }
    ]
  });
});

test("swapExactInputWithRegisteredRoute plans a three-hop provider route", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAB", "0xPOOLCB", "0xPOOLCD"]
        );
        return [
          { kind: "bundle", id: "ab" },
          { kind: "bundle", id: "cb" },
          { kind: "bundle", id: "cd" }
        ];
      }
    }
  ]);

  const result = await swapExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "custom",
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C", "0x1::d::D"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB"
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::c::C",
        typeB: "0x1::b::B",
        pool: "0xPOOLCB"
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::c::C",
        typeB: "0x1::d::D",
        pool: "0xPOOLCD"
      }
    ],
    input: "0xCOINA",
    minOutputs: [90, 80, 70]
  });

  assert.deepEqual(result, { kind: "result", index: 2 });
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::router::swap_exact_a_for_b_with_bundle",
      "0xBROWN::router::swap_exact_b_for_a_with_bundle",
      "0xBROWN::router::swap_exact_a_for_b_with_bundle"
    ]
  );
  assert.deepEqual(tx.calls[1].typeArguments, ["0x1::c::C", "0x1::b::B"]);
  assert.deepEqual(tx.calls[1].arguments[3], { kind: "result", index: 0 });
  assert.deepEqual(tx.calls[2].typeArguments, ["0x1::c::C", "0x1::d::D"]);
  assert.deepEqual(tx.calls[2].arguments[3], { kind: "result", index: 1 });
});

test("preflightSwapExactInputWithRegisteredRoute builds route PTB before dry-run", async () => {
  const tx = createTransactionRecorder();
  const calls = [];
  tx.build = async (input) => {
    calls.push({ kind: "build", input, moveCallCount: tx.calls.length });
    return "AQID";
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return { effects: { status: { status: "success" } } };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(routeTx, options) {
        calls.push({ kind: "bundles", options, sameTx: routeTx === tx });
        return [{ kind: "bundle", index: 0 }];
      }
    }
  ]);

  const result = await preflightSwapExactInputWithRegisteredRoute({
    tx,
    suiClient,
    providerRegistry: registry,
    providerId: "custom",
    clock: "0xCLOCK",
    path: ["A", "B"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "B",
        pool: "0xPOOL"
      }
    ],
    input: "0xCOIN",
    minOutputs: [9n]
  });

  assert.deepEqual(result.swapResult, { kind: "result", index: 0 });
  assert.deepEqual(result.dryRunResult, { effects: { status: { status: "success" } } });
  assert.deepEqual(calls, [
    {
      kind: "bundles",
      options: {
        clock: "0xCLOCK",
        hops: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOL"
          }
        ]
      },
      sameTx: true
    },
    { kind: "build", input: { client: suiClient }, moveCallCount: 1 },
    { kind: "dryRun", input: { transactionBlock: "AQID" } }
  ]);
});

test("preflightSwapExactOutputWithRegisteredRoute reports failed route dry-run", async () => {
  const tx = createTransactionRecorder();
  tx.build = async () => "AQID";
  const suiClient = {
    async dryRunTransactionBlock() {
      return {
        effects: {
          status: {
            status: "failure",
            error: "MoveAbort in 0xBROWN::router"
          }
        }
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        return [{ kind: "bundle", index: 0 }];
      }
    }
  ]);

  await assert.rejects(
    () =>
      preflightSwapExactOutputWithRegisteredRoute({
        tx,
        suiClient,
        providerRegistry: registry,
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOL"
          }
        ],
        input: "0xCOIN",
        amountOut: 7n
      }),
    /BrownFi custom exact-output route preflight failed with status failure: MoveAbort in 0xBROWN::router/
  );
});

test("preflightSwapExactOutputWithRegisteredRouteResults preflights a quote-chained route", async () => {
  const tx = createTransactionRecorder();
  const calls = [];
  tx.build = async (input) => {
    calls.push({ kind: "build", input, moveCallCount: tx.calls.length });
    return "quote-chain-bytes";
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAC", "0xPOOLBC", "0xPOOLBD"]
        );
        return [
          { kind: "bundle", id: "ac" },
          { kind: "bundle", id: "bc" },
          { kind: "bundle", id: "bd" }
        ];
      }
    }
  ]);

  const result = await preflightSwapExactOutputWithRegisteredRouteResults({
    tx,
    suiClient,
    providerRegistry: registry,
    providerId: "custom",
    path: ["A", "C", "B", "D"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "C",
        pool: "0xPOOLAC"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "C",
        pool: "0xPOOLBC"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "D",
        pool: "0xPOOLBD"
      }
    ],
    input: "0xCOINA",
    amountOut: 55n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 0 },
    { kind: "result", index: 1 }
  ]);
  assert.deepEqual(result.swapResults, [
    { kind: "result", index: 2 },
    { kind: "result", index: 3 },
    { kind: "result", index: 4 }
  ]);
  assert.deepEqual(result.output, { kind: "nested-result", index: 4, resultIndex: 1 });
  assert.deepEqual(result.dryRunResult, {
    effects: { status: { status: "success" } },
    transactionBlock: "quote-chain-bytes"
  });
  assert.deepEqual(calls, [
    { kind: "build", input: { client: suiClient }, moveCallCount: 5 },
    { kind: "dryRun", input: { transactionBlock: "quote-chain-bytes" } }
  ]);
});

test("preflightRegisteredRouteCases runs exact-input and exact-output cases in order", async () => {
  const exactInputTx = createTransactionRecorder();
  const exactOutputTx = createTransactionRecorder();
  const calls = [];
  const attachBuild = (tx, label) => {
    tx.build = async (input) => {
      calls.push({ kind: "build", label, input, moveCallCount: tx.calls.length });
      return `${label}-bytes`;
    };
  };
  attachBuild(exactInputTx, "exact-input");
  attachBuild(exactOutputTx, "exact-output");
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(tx, options) {
        const label =
          tx === exactInputTx ? "exact-input" : tx === exactOutputTx ? "exact-output" : "unknown";
        calls.push({
          kind: "bundles",
          label,
          pools: options.hops.map((hop) => hop.pool)
        });
        return options.hops.map((_, index) => ({ kind: "bundle", label, index }));
      }
    }
  ]);

  const results = await preflightRegisteredRouteCases({
    suiClient,
    cases: [
      {
        name: "custom exact-input A/B",
        kind: "exact-input",
        tx: exactInputTx,
        providerRegistry: registry,
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xCOINA",
        minOutputs: [9n]
      },
      {
        name: "custom exact-output A/B",
        kind: "exact-output",
        tx: exactOutputTx,
        providerRegistry: registry,
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xCOINA",
        amountOut: 7n
      }
    ]
  });

  assert.deepEqual(results, [
    {
      name: "custom exact-input A/B",
      kind: "exact-input",
      providerId: "custom",
      swapResult: { kind: "result", index: 0 },
      dryRunResult: {
        effects: { status: { status: "success" } },
        transactionBlock: "exact-input-bytes"
      }
    },
    {
      name: "custom exact-output A/B",
      kind: "exact-output",
      providerId: "custom",
      swapResult: { kind: "result", index: 0 },
      dryRunResult: {
        effects: { status: { status: "success" } },
        transactionBlock: "exact-output-bytes"
      }
    }
  ]);
  assert.deepEqual(calls, [
    { kind: "bundles", label: "exact-input", pools: ["0xPOOLAB"] },
    {
      kind: "build",
      label: "exact-input",
      input: { client: suiClient },
      moveCallCount: 1
    },
    { kind: "dryRun", input: { transactionBlock: "exact-input-bytes" } },
    { kind: "bundles", label: "exact-output", pools: ["0xPOOLAB"] },
    {
      kind: "build",
      label: "exact-output",
      input: { client: suiClient },
      moveCallCount: 1
    },
    { kind: "dryRun", input: { transactionBlock: "exact-output-bytes" } }
  ]);
});

test("preflightRegisteredRouteCases supports provider-backed add-liquidity cases", async () => {
  const tx = createTransactionRecorder();
  const calls = [];
  tx.build = async (input) => {
    calls.push({ kind: "build", input, moveCallCount: tx.calls.length });
    return "add-liquidity-bytes";
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        calls.push({
          kind: "bundles",
          pools: optionsArg.hops.map((hop) => hop.pool)
        });
        return [{ kind: "bundle", id: "ab" }];
      }
    }
  ]);

  const cases = buildRegisteredRoutePreflightCases({
    providerRegistry: registry,
    txFactory(routeCase, index) {
      calls.push({ kind: "factory", index, caseKind: routeCase.kind });
      return tx;
    },
    cases: [
      {
        name: "custom add-liquidity A/B",
        kind: "add-liquidity",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xCOINA",
        inputB: "0xCOINB",
        minLpOut: 123n
      }
    ]
  });

  const results = await preflightRegisteredRouteCases({ suiClient, cases });

  assert.deepEqual(results, [
    {
      name: "custom add-liquidity A/B",
      kind: "add-liquidity",
      providerId: "custom",
      liquidityResult: { kind: "result", index: 0 },
      dryRunResult: {
        effects: { status: { status: "success" } },
        transactionBlock: "add-liquidity-bytes"
      }
    }
  ]);
  assert.deepEqual(tx.calls, [
    {
      target: "0xBROWN::router::add_liquidity_with_bundle",
      typeArguments: ["A", "B"],
      arguments: [
        { kind: "bundle", id: "ab" },
        { kind: "object", id: "0xCLOCK" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xCOINA" },
        { kind: "object", id: "0xCOINB" },
        { kind: "u64", value: "123" }
      ]
    }
  ]);
  assert.deepEqual(calls, [
    { kind: "factory", index: 0, caseKind: "add-liquidity" },
    { kind: "bundles", pools: ["0xPOOLAB"] },
    {
      kind: "build",
      input: { client: suiClient },
      moveCallCount: 1
    },
    { kind: "dryRun", input: { transactionBlock: "add-liquidity-bytes" } }
  ]);
});

test("preflightRegisteredRouteCases supports provider-backed zap cases", async () => {
  const calls = [];
  const txs = [];
  const txFactory = (routeCase, index) => {
    calls.push({ kind: "factory", index, caseKind: routeCase.kind });
    const tx = createTransactionRecorder();
    tx.build = async (input) => {
      calls.push({
        kind: "build",
        caseKind: routeCase.kind,
        input,
        moveCallCount: tx.calls.length
      });
      return `${routeCase.kind}-bytes`;
    };
    txs.push(tx);
    return tx;
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        calls.push({
          kind: "bundles",
          txIndex: txs.indexOf(txArg),
          pools: optionsArg.hops.map((hop) => hop.pool)
        });
        return [{ kind: "bundle", txIndex: txs.indexOf(txArg) }];
      }
    }
  ]);
  const pair = {
    packageId: "0xBROWN",
    typeA: "A",
    typeB: "B",
    pool: "0xPOOLAB"
  };

  const cases = buildRegisteredRoutePreflightCases({
    providerRegistry: registry,
    txFactory,
    cases: [
      {
        name: "custom zap-in-a A/B",
        kind: "zap-in-a",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [pair],
        input: "0xCOINA",
        minBFromSwap: 12n,
        minLpOut: 123n
      },
      {
        name: "custom zap-in-b A/B",
        kind: "zap-in-b",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [pair],
        input: "0xCOINB",
        minAFromSwap: 21n,
        minLpOut: 456n
      },
      {
        name: "custom zap-out-a A/B",
        kind: "zap-out-a",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [pair],
        input: "0xLPA",
        minOut: 789n
      },
      {
        name: "custom zap-out-b A/B",
        kind: "zap-out-b",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [pair],
        input: "0xLPB",
        minOut: 987n
      }
    ]
  });

  const results = await preflightRegisteredRouteCases({ suiClient, cases });

  assert.deepEqual(
    results.map((result) => ({
      name: result.name,
      kind: result.kind,
      providerId: result.providerId,
      zapResult: result.zapResult,
      dryRunResult: result.dryRunResult
    })),
    [
      {
        name: "custom zap-in-a A/B",
        kind: "zap-in-a",
        providerId: "custom",
        zapResult: { kind: "result", index: 0 },
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "zap-in-a-bytes"
        }
      },
      {
        name: "custom zap-in-b A/B",
        kind: "zap-in-b",
        providerId: "custom",
        zapResult: { kind: "result", index: 0 },
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "zap-in-b-bytes"
        }
      },
      {
        name: "custom zap-out-a A/B",
        kind: "zap-out-a",
        providerId: "custom",
        zapResult: { kind: "result", index: 0 },
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "zap-out-a-bytes"
        }
      },
      {
        name: "custom zap-out-b A/B",
        kind: "zap-out-b",
        providerId: "custom",
        zapResult: { kind: "result", index: 0 },
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "zap-out-b-bytes"
        }
      }
    ]
  );
  assert.deepEqual(
    txs.map((tx) => tx.calls[0]),
    [
      {
        target: "0xBROWN::router::zap_in_a_with_bundle",
        typeArguments: ["A", "B"],
        arguments: [
          { kind: "bundle", txIndex: 0 },
          { kind: "object", id: "0xCLOCK" },
          { kind: "object", id: "0xPOOLAB" },
          { kind: "object", id: "0xCOINA" },
          { kind: "u64", value: "12" },
          { kind: "u64", value: "123" }
        ]
      },
      {
        target: "0xBROWN::router::zap_in_b_with_bundle",
        typeArguments: ["A", "B"],
        arguments: [
          { kind: "bundle", txIndex: 1 },
          { kind: "object", id: "0xCLOCK" },
          { kind: "object", id: "0xPOOLAB" },
          { kind: "object", id: "0xCOINB" },
          { kind: "u64", value: "21" },
          { kind: "u64", value: "456" }
        ]
      },
      {
        target: "0xBROWN::router::zap_out_a_with_bundle",
        typeArguments: ["A", "B"],
        arguments: [
          { kind: "bundle", txIndex: 2 },
          { kind: "object", id: "0xCLOCK" },
          { kind: "object", id: "0xPOOLAB" },
          { kind: "object", id: "0xLPA" },
          { kind: "u64", value: "789" }
        ]
      },
      {
        target: "0xBROWN::router::zap_out_b_with_bundle",
        typeArguments: ["A", "B"],
        arguments: [
          { kind: "bundle", txIndex: 3 },
          { kind: "object", id: "0xCLOCK" },
          { kind: "object", id: "0xPOOLAB" },
          { kind: "object", id: "0xLPB" },
          { kind: "u64", value: "987" }
        ]
      }
    ]
  );
  assert.deepEqual(calls, [
    { kind: "factory", index: 0, caseKind: "zap-in-a" },
    { kind: "factory", index: 1, caseKind: "zap-in-b" },
    { kind: "factory", index: 2, caseKind: "zap-out-a" },
    { kind: "factory", index: 3, caseKind: "zap-out-b" },
    { kind: "bundles", txIndex: 0, pools: ["0xPOOLAB"] },
    {
      kind: "build",
      caseKind: "zap-in-a",
      input: { client: suiClient },
      moveCallCount: 1
    },
    { kind: "dryRun", input: { transactionBlock: "zap-in-a-bytes" } },
    { kind: "bundles", txIndex: 1, pools: ["0xPOOLAB"] },
    {
      kind: "build",
      caseKind: "zap-in-b",
      input: { client: suiClient },
      moveCallCount: 1
    },
    { kind: "dryRun", input: { transactionBlock: "zap-in-b-bytes" } },
    { kind: "bundles", txIndex: 2, pools: ["0xPOOLAB"] },
    {
      kind: "build",
      caseKind: "zap-out-a",
      input: { client: suiClient },
      moveCallCount: 1
    },
    { kind: "dryRun", input: { transactionBlock: "zap-out-a-bytes" } },
    { kind: "bundles", txIndex: 3, pools: ["0xPOOLAB"] },
    {
      kind: "build",
      caseKind: "zap-out-b",
      input: { client: suiClient },
      moveCallCount: 1
    },
    { kind: "dryRun", input: { transactionBlock: "zap-out-b-bytes" } }
  ]);
});

test("preflightRegisteredRouteCases supports remove-liquidity cases", async () => {
  const tx = createTransactionRecorder();
  const calls = [];
  tx.build = async (input) => {
    calls.push({ kind: "build", input, moveCallCount: tx.calls.length });
    return "remove-liquidity-bytes";
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("remove-liquidity should not build oracle bundles");
      }
    }
  ]);

  const cases = buildRegisteredRoutePreflightCases({
    providerRegistry: registry,
    txFactory(routeCase, index) {
      calls.push({ kind: "factory", index, caseKind: routeCase.kind });
      return tx;
    },
    cases: [
      {
        name: "custom remove-liquidity A/B",
        kind: "remove-liquidity",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xLP",
        minAOut: 456n,
        minBOut: 789n
      }
    ]
  });

  const results = await preflightRegisteredRouteCases({ suiClient, cases });

  assert.deepEqual(results, [
    {
      name: "custom remove-liquidity A/B",
      kind: "remove-liquidity",
      providerId: "custom",
      liquidityResult: { kind: "result", index: 0 },
      dryRunResult: {
        effects: { status: { status: "success" } },
        transactionBlock: "remove-liquidity-bytes"
      }
    }
  ]);
  assert.deepEqual(tx.calls, [
    {
      target: "0xBROWN::router::remove_liquidity_with_coins",
      typeArguments: ["A", "B"],
      arguments: [
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xLP" },
        { kind: "u64", value: "456" },
        { kind: "u64", value: "789" }
      ]
    }
  ]);
  assert.deepEqual(calls, [
    { kind: "factory", index: 0, caseKind: "remove-liquidity" },
    {
      kind: "build",
      input: { client: suiClient },
      moveCallCount: 1
    },
    { kind: "dryRun", input: { transactionBlock: "remove-liquidity-bytes" } }
  ]);
});

test("preflightRegisteredRouteCases builds and dry-runs a Pyth exact-input route case", async () => {
  const tx = createTransactionRecorder();
  const calls = [];
  tx.build = async (input) => {
    calls.push({
      kind: "build",
      input,
      moveCallTargets: tx.calls.map((call) => call.target)
    });
    return "pyth-exact-input-bytes";
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    createPythRoutePriceProvider({
      priceFeedConnection: {
        async getPriceFeedsUpdateData(feedIdsArg) {
          calls.push({ kind: "fetchPythUpdates", feedIds: feedIdsArg });
          return feedIdsArg.map((feedId) => ({ update: feedId }));
        }
      },
      pythClient: {
        async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
          assert.equal(txArg, tx);
          assert.equal(tx.calls.length, 0);
          calls.push({ kind: "updatePyth", updates: updatesArg, feedIds: feedIdsArg });
          return ["0xPRICEA", "0xPRICEB"];
        }
      }
    })
  ]);

  const cases = buildRegisteredRoutePreflightCases({
    providerRegistry: registry,
    txFactory(routeCase, index) {
      calls.push({ kind: "factory", index, caseKind: routeCase.kind });
      return tx;
    },
    cases: [
      {
        name: "pyth exact-input A/B",
        kind: "exact-input",
        providerId: "pyth",
        clock: "0x6",
        path: ["0x1::a::A", "0x1::b::B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "0x1::a::A",
            typeB: "0x1::b::B",
            pool: "0xPOOLAB",
            feedIds: ["feed-a", "feed-b"]
          }
        ],
        input: "0xCOINA",
        minOutputs: [99n]
      }
    ]
  });

  const results = await preflightRegisteredRouteCases({ suiClient, cases });

  assert.deepEqual(results, [
    {
      name: "pyth exact-input A/B",
      kind: "exact-input",
      providerId: "pyth",
      swapResult: { kind: "result", index: 3 },
      dryRunResult: {
        effects: { status: { status: "success" } },
        transactionBlock: "pyth-exact-input-bytes"
      }
    }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::router::swap_exact_a_for_b_with_bundle"
    ]
  );
  assert.deepEqual(calls, [
    { kind: "factory", index: 0, caseKind: "exact-input" },
    { kind: "fetchPythUpdates", feedIds: ["feed-a", "feed-b"] },
    {
      kind: "updatePyth",
      updates: [{ update: "feed-a" }, { update: "feed-b" }],
      feedIds: ["feed-a", "feed-b"]
    },
    {
      kind: "build",
      input: { client: suiClient },
      moveCallTargets: [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::router::swap_exact_a_for_b_with_bundle"
      ]
    },
    { kind: "dryRun", input: { transactionBlock: "pyth-exact-input-bytes" } }
  ]);
});

test("preflightRegisteredRouteCases builds and dry-runs Pyth exact-output and liquidity route cases", async () => {
  const txs = [];
  const calls = [];
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    createPythRoutePriceProvider({
      priceFeedConnection: {
        async getPriceFeedsUpdateData(feedIdsArg) {
          calls.push({ kind: "fetchPythUpdates", feedIds: feedIdsArg });
          return feedIdsArg.map((feedId) => ({ update: feedId }));
        }
      },
      pythClient: {
        async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
          const txIndex = txs.indexOf(txArg);
          assert.notEqual(txIndex, -1);
          assert.equal(txArg.calls.length, 0);
          calls.push({
            kind: "updatePyth",
            txIndex,
            updates: updatesArg,
            feedIds: feedIdsArg
          });
          return ["0xPRICEA", "0xPRICEB"];
        }
      }
    })
  ]);

  const cases = buildRegisteredRoutePreflightCases({
    providerRegistry: registry,
    txFactory(routeCase, index) {
      calls.push({ kind: "factory", index, caseKind: routeCase.kind });
      const tx = createTransactionRecorder();
      tx.build = async (input) => {
        calls.push({
          kind: "build",
          index,
          input,
          moveCallTargets: tx.calls.map((call) => call.target)
        });
        return `${routeCase.name}-bytes`;
      };
      txs[index] = tx;
      return tx;
    },
    cases: [
      {
        name: "pyth exact-output A/B",
        kind: "exact-output",
        providerId: "pyth",
        clock: "0x6",
        path: ["0x1::a::A", "0x1::b::B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "0x1::a::A",
            typeB: "0x1::b::B",
            pool: "0xPOOLAB",
            feedIds: ["feed-a", "feed-b"]
          }
        ],
        input: "0xCOINA",
        amountOut: 88n
      },
      {
        name: "pyth add-liquidity A/B",
        kind: "add-liquidity",
        providerId: "pyth",
        clock: "0x6",
        path: ["0x1::a::A", "0x1::b::B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "0x1::a::A",
            typeB: "0x1::b::B",
            pool: "0xPOOLAB",
            feedIds: ["feed-a", "feed-b"]
          }
        ],
        input: "0xCOINA",
        inputB: "0xCOINB",
        minADeposit: 11n,
        minBDeposit: 22n,
        minLpOut: 123n
      },
      {
        name: "pyth remove-liquidity A/B",
        kind: "remove-liquidity",
        providerId: "pyth",
        clock: "0x6",
        path: ["0x1::a::A", "0x1::b::B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "0x1::a::A",
            typeB: "0x1::b::B",
            pool: "0xPOOLAB",
            feedIds: ["feed-a", "feed-b"]
          }
        ],
        input: "0xLP",
        minAOut: 45n,
        minBOut: 67n
      }
    ]
  });

  const results = await preflightRegisteredRouteCases({ suiClient, cases });

  assert.deepEqual(
    results.map((result) => ({
      name: result.name,
      kind: result.kind,
      providerId: result.providerId,
      transactionBlock: result.dryRunResult.transactionBlock,
      swapResult: result.swapResult,
      liquidityResult: result.liquidityResult
    })),
    [
      {
        name: "pyth exact-output A/B",
        kind: "exact-output",
        providerId: "pyth",
        transactionBlock: "pyth exact-output A/B-bytes",
        swapResult: { kind: "result", index: 3 },
        liquidityResult: undefined
      },
      {
        name: "pyth add-liquidity A/B",
        kind: "add-liquidity",
        providerId: "pyth",
        transactionBlock: "pyth add-liquidity A/B-bytes",
        swapResult: undefined,
        liquidityResult: { kind: "result", index: 3 }
      },
      {
        name: "pyth remove-liquidity A/B",
        kind: "remove-liquidity",
        providerId: "pyth",
        transactionBlock: "pyth remove-liquidity A/B-bytes",
        swapResult: undefined,
        liquidityResult: { kind: "result", index: 0 }
      }
    ]
  );
  assert.deepEqual(
    txs.map((tx) => tx.calls.map((call) => call.target)),
    [
      [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::router::swap_a_for_exact_b_with_bundle"
      ],
      [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::router::add_liquidity_with_bundle_with_min_deposits"
      ],
      ["0xBROWN::router::remove_liquidity_with_coins"]
    ]
  );
  assert.deepEqual(calls, [
    { kind: "factory", index: 0, caseKind: "exact-output" },
    { kind: "factory", index: 1, caseKind: "add-liquidity" },
    { kind: "factory", index: 2, caseKind: "remove-liquidity" },
    { kind: "fetchPythUpdates", feedIds: ["feed-a", "feed-b"] },
    {
      kind: "updatePyth",
      txIndex: 0,
      updates: [{ update: "feed-a" }, { update: "feed-b" }],
      feedIds: ["feed-a", "feed-b"]
    },
    {
      kind: "build",
      index: 0,
      input: { client: suiClient },
      moveCallTargets: [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::router::swap_a_for_exact_b_with_bundle"
      ]
    },
    {
      kind: "dryRun",
      input: { transactionBlock: "pyth exact-output A/B-bytes" }
    },
    { kind: "fetchPythUpdates", feedIds: ["feed-a", "feed-b"] },
    {
      kind: "updatePyth",
      txIndex: 1,
      updates: [{ update: "feed-a" }, { update: "feed-b" }],
      feedIds: ["feed-a", "feed-b"]
    },
    {
      kind: "build",
      index: 1,
      input: { client: suiClient },
      moveCallTargets: [
        "0xBROWN::pyth_source::read_price_a",
        "0xBROWN::pyth_source::read_price_b",
        "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
        "0xBROWN::router::add_liquidity_with_bundle_with_min_deposits"
      ]
    },
    {
      kind: "dryRun",
      input: { transactionBlock: "pyth add-liquidity A/B-bytes" }
    },
    {
      kind: "build",
      index: 2,
      input: { client: suiClient },
      moveCallTargets: ["0xBROWN::router::remove_liquidity_with_coins"]
    },
    {
      kind: "dryRun",
      input: { transactionBlock: "pyth remove-liquidity A/B-bytes" }
    }
  ]);
});

test("buildRegisteredRouteCaseTransactions composes launch route cases without dry-run", async () => {
  const exactInputTx = createTransactionRecorder();
  const addLiquidityTx = createTransactionRecorder();
  const removeLiquidityTx = createTransactionRecorder();
  const txs = [exactInputTx, addLiquidityTx, removeLiquidityTx];
  const calls = [];
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        calls.push({
          kind: "bundles",
          txIndex: txs.indexOf(txArg),
          pools: optionsArg.hops.map((hop) => hop.pool)
        });
        return optionsArg.hops.map((hop) => ({ kind: "bundle", pool: hop.pool }));
      }
    }
  ]);

  const cases = buildRegisteredRoutePreflightCases({
    providerRegistry: registry,
    txFactory(routeCase, index) {
      calls.push({ kind: "factory", index, caseKind: routeCase.kind });
      return txs[index];
    },
    cases: [
      {
        name: "custom exact-input A/B",
        kind: "exact-input",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xCOINA",
        minOutputs: [11n]
      },
      {
        name: "custom add-liquidity A/B",
        kind: "add-liquidity",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xCOINA2",
        inputB: "0xCOINB2",
        minLpOut: 22n
      },
      {
        name: "custom remove-liquidity A/B",
        kind: "remove-liquidity",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xLP",
        minAOut: 33n,
        minBOut: 44n
      }
    ]
  });

  const results = await buildRegisteredRouteCaseTransactions({ cases });

  assert.deepEqual(results, [
    {
      name: "custom exact-input A/B",
      kind: "exact-input",
      providerId: "custom",
      swapResult: { kind: "result", index: 0 }
    },
    {
      name: "custom add-liquidity A/B",
      kind: "add-liquidity",
      providerId: "custom",
      liquidityResult: { kind: "result", index: 0 }
    },
    {
      name: "custom remove-liquidity A/B",
      kind: "remove-liquidity",
      providerId: "custom",
      liquidityResult: { kind: "result", index: 0 }
    }
  ]);
  assert.deepEqual(exactInputTx.calls, [
    {
      target: "0xBROWN::router::swap_exact_a_for_b_with_bundle",
      typeArguments: ["A", "B"],
      arguments: [
        { kind: "bundle", pool: "0xPOOLAB" },
        { kind: "object", id: "0xCLOCK" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xCOINA" },
        { kind: "u64", value: "11" }
      ]
    }
  ]);
  assert.deepEqual(addLiquidityTx.calls, [
    {
      target: "0xBROWN::router::add_liquidity_with_bundle",
      typeArguments: ["A", "B"],
      arguments: [
        { kind: "bundle", pool: "0xPOOLAB" },
        { kind: "object", id: "0xCLOCK" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xCOINA2" },
        { kind: "object", id: "0xCOINB2" },
        { kind: "u64", value: "22" }
      ]
    }
  ]);
  assert.deepEqual(removeLiquidityTx.calls, [
    {
      target: "0xBROWN::router::remove_liquidity_with_coins",
      typeArguments: ["A", "B"],
      arguments: [
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xLP" },
        { kind: "u64", value: "33" },
        { kind: "u64", value: "44" }
      ]
    }
  ]);
  assert.deepEqual(calls, [
    { kind: "factory", index: 0, caseKind: "exact-input" },
    { kind: "factory", index: 1, caseKind: "add-liquidity" },
    { kind: "factory", index: 2, caseKind: "remove-liquidity" },
    { kind: "bundles", txIndex: 0, pools: ["0xPOOLAB"] },
    { kind: "bundles", txIndex: 1, pools: ["0xPOOLAB"] }
  ]);
});

test("preflightRegisteredRouteCases supports result-aware exact-output route cases", async () => {
  const tx = createTransactionRecorder();
  const calls = [];
  tx.build = async (input) => {
    calls.push({ kind: "build", input, moveCallCount: tx.calls.length });
    return "matrix-quote-chain-bytes";
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAC", "0xPOOLBC", "0xPOOLBD"]
        );
        return [
          { kind: "bundle", id: "ac" },
          { kind: "bundle", id: "bc" },
          { kind: "bundle", id: "bd" }
        ];
      }
    }
  ]);

  const results = await preflightRegisteredRouteCases({
    suiClient,
    cases: [
      {
        name: "custom exact-output A/C/B/D",
        kind: "exact-output-results",
        tx,
        providerRegistry: registry,
        providerId: "custom",
        path: ["A", "C", "B", "D"],
        clock: "0x6",
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "C",
            pool: "0xPOOLAC"
          },
          {
            packageId: "0xBROWN",
            typeA: "B",
            typeB: "C",
            pool: "0xPOOLBC"
          },
          {
            packageId: "0xBROWN",
            typeA: "B",
            typeB: "D",
            pool: "0xPOOLBD"
          }
        ],
        input: "0xCOINA",
        amountOut: 55n
      }
    ]
  });

  assert.equal(results.length, 1);
  assert.deepEqual(results[0], {
    name: "custom exact-output A/C/B/D",
    kind: "exact-output-results",
    providerId: "custom",
    quoteResults: [
      { kind: "result", index: 0 },
      { kind: "result", index: 1 }
    ],
    swapResults: [
      { kind: "result", index: 2 },
      { kind: "result", index: 3 },
      { kind: "result", index: 4 }
    ],
    changeCoins: [
      { kind: "nested-result", index: 2, resultIndex: 0 },
      { kind: "nested-result", index: 3, resultIndex: 0 },
      { kind: "nested-result", index: 4, resultIndex: 0 }
    ],
    output: { kind: "nested-result", index: 4, resultIndex: 1 },
    dryRunResult: {
      effects: { status: { status: "success" } },
      transactionBlock: "matrix-quote-chain-bytes"
    }
  });
  assert.deepEqual(calls, [
    { kind: "build", input: { client: suiClient }, moveCallCount: 5 },
    { kind: "dryRun", input: { transactionBlock: "matrix-quote-chain-bytes" } }
  ]);
});

test("preflightRegisteredRouteCases can transfer route outputs before dry-run", async () => {
  const tx = createTransactionRecorder();
  const calls = [];
  tx.build = async (input) => {
    calls.push({
      kind: "build",
      input,
      moveCallCount: tx.calls.length,
      transfers: tx.transfers.slice()
    });
    return "matrix-exact-output-bytes";
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        return [{ kind: "bundle", id: "ab" }];
      }
    }
  ]);

  const results = await preflightRegisteredRouteCases({
    suiClient,
    transferRecipient: "0xSENDER",
    cases: [
      {
        name: "custom exact-output A/B",
        kind: "exact-output",
        tx,
        providerRegistry: registry,
        providerId: "custom",
        path: ["A", "B"],
        clock: "0x6",
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xCOINA",
        amountOut: 55n,
        recipient: "0xRECIPIENT"
      }
    ]
  });

  assert.equal(results.length, 1);
  assert.deepEqual(tx.transfers, [
    {
      objects: [{ kind: "nested-result", index: 0, resultIndex: 0 }],
      recipient: { kind: "address", value: "0xSENDER" }
    },
    {
      objects: [{ kind: "nested-result", index: 0, resultIndex: 1 }],
      recipient: { kind: "address", value: "0xRECIPIENT" }
    }
  ]);
  assert.deepEqual(calls, [
    {
      kind: "build",
      input: { client: suiClient },
      moveCallCount: 1,
      transfers: tx.transfers
    },
    { kind: "dryRun", input: { transactionBlock: "matrix-exact-output-bytes" } }
  ]);
});

test("preflightRegisteredRouteCases labels failed case dry-runs", async () => {
  const tx = createTransactionRecorder();
  tx.build = async () => "AQID";
  const suiClient = {
    async dryRunTransactionBlock() {
      return {
        effects: {
          status: {
            status: "failure",
            error: "MoveAbort in 0xBROWN::router"
          }
        }
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        return [{ kind: "bundle", index: 0 }];
      }
    }
  ]);

  await assert.rejects(
    () =>
      preflightRegisteredRouteCases({
        suiClient,
        cases: [
          {
            name: "custom launch route",
            kind: "exact-input",
            tx,
            providerRegistry: registry,
            providerId: "custom",
            clock: "0xCLOCK",
            path: ["A", "B"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOL"
              }
            ],
            input: "0xCOIN",
            minOutputs: [9n]
          }
        ]
      }),
    /BrownFi custom launch route exact-input route preflight failed with status failure: MoveAbort in 0xBROWN::router/
  );
});

test("buildRegisteredRoutePreflightCases hydrates serializable configs for preflight", async () => {
  const calls = [];
  const txFactory = (routeCase, index) => {
    calls.push({ kind: "txFactory", name: routeCase.name, index });
    const tx = createTransactionRecorder();
    tx.build = async (input) => {
      calls.push({
        kind: "build",
        name: routeCase.name,
        input,
        moveCallCount: tx.calls.length
      });
      return `${routeCase.name}-bytes`;
    };
    return tx;
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(_tx, options) {
        calls.push({
          kind: "bundles",
          pools: options.hops.map((hop) => hop.pool)
        });
        return options.hops.map((_, index) => ({ kind: "bundle", index }));
      }
    }
  ]);

  const cases = buildRegisteredRoutePreflightCases({
    providerRegistry,
    txFactory,
    cases: [
      {
        name: "launch-exact-input",
        kind: "exact-input",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xCOINA",
        minOutputs: [9n],
        context: "BrownFi launch exact-input"
      },
      {
        name: "launch-exact-output-results",
        kind: "exact-output-results",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        input: "0xCOINA",
        amountOut: 7n
      }
    ]
  });

  assert.equal(cases.length, 2);
  assert.equal(cases[0].providerRegistry, providerRegistry);
  assert.equal(cases[0].context, "BrownFi launch exact-input");
  assert.deepEqual(cases[0].minOutputs, [9n]);
  assert.equal(cases[1].providerRegistry, providerRegistry);
  assert.equal(cases[1].amountOut, 7n);

  const results = await preflightRegisteredRouteCases({ suiClient, cases });

  assert.deepEqual(
    results.map((result) => ({
      name: result.name,
      kind: result.kind,
      providerId: result.providerId,
      dryRunResult: result.dryRunResult
    })),
    [
      {
        name: "launch-exact-input",
        kind: "exact-input",
        providerId: "custom",
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "launch-exact-input-bytes"
        }
      },
      {
        name: "launch-exact-output-results",
        kind: "exact-output-results",
        providerId: "custom",
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "launch-exact-output-results-bytes"
        }
      }
    ]
  );
  assert.deepEqual(calls, [
    { kind: "txFactory", name: "launch-exact-input", index: 0 },
    { kind: "txFactory", name: "launch-exact-output-results", index: 1 },
    { kind: "bundles", pools: ["0xPOOLAB"] },
    {
      kind: "build",
      name: "launch-exact-input",
      input: { client: suiClient },
      moveCallCount: 1
    },
    { kind: "dryRun", input: { transactionBlock: "launch-exact-input-bytes" } },
    { kind: "bundles", pools: ["0xPOOLAB"] },
    {
      kind: "build",
      name: "launch-exact-output-results",
      input: { client: suiClient },
      moveCallCount: 1
    },
    {
      kind: "dryRun",
      input: { transactionBlock: "launch-exact-output-results-bytes" }
    }
  ]);
});

test("buildRegisteredRoutePreflightCases hydrates flash borrow configs for preflight", async () => {
  const calls = [];
  const txs = [];
  const txFactory = (routeCase, index) => {
    calls.push({ kind: "txFactory", name: routeCase.name, index });
    const tx = createTransactionRecorder();
    tx.build = async (input) => {
      calls.push({
        kind: "build",
        name: routeCase.name,
        input,
        moveCallCount: tx.calls.length
      });
      return `${routeCase.name}-bytes`;
    };
    txs.push(tx);
    return tx;
  };
  const suiClient = {
    async dryRunTransactionBlock(input) {
      calls.push({ kind: "dryRun", input });
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(_tx, options) {
        calls.push({
          kind: "bundles",
          pools: options.hops.map((hop) => hop.pool)
        });
        return options.hops.map((_, index) => ({ kind: "bundle", index }));
      }
    }
  ]);

  const cases = buildRegisteredRoutePreflightCases({
    providerRegistry,
    txFactory,
    cases: [
      {
        name: "launch-flash-a",
        kind: "flash-borrow-a",
        providerId: "custom",
        clock: "0xCLOCK",
        path: ["A", "B"],
        pairs: [
          {
            packageId: "0xBROWN",
            typeA: "A",
            typeB: "B",
            pool: "0xPOOLAB"
          }
        ],
        amount: 1_000n,
        feeCoin: "0xFEEA",
        context: "BrownFi launch flash borrow A"
      }
    ]
  });

  assert.equal(cases.length, 1);
  assert.equal(cases[0].providerRegistry, providerRegistry);
  assert.equal(cases[0].kind, "flash-borrow-a");
  assert.equal(cases[0].amount, 1_000n);
  assert.equal(cases[0].feeCoin, "0xFEEA");

  const results = await preflightRegisteredRouteCases({ suiClient, cases });

  assert.deepEqual(
    results.map((result) => ({
      name: result.name,
      kind: result.kind,
      providerId: result.providerId,
      dryRunResult: result.dryRunResult
    })),
    [
      {
        name: "launch-flash-a",
        kind: "flash-borrow-a",
        providerId: "custom",
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "launch-flash-a-bytes"
        }
      }
    ]
  );
  assert.deepEqual(calls, [
    { kind: "txFactory", name: "launch-flash-a", index: 0 },
    { kind: "bundles", pools: ["0xPOOLAB"] },
    {
      kind: "build",
      name: "launch-flash-a",
      input: { client: suiClient },
      moveCallCount: 2
    },
    { kind: "dryRun", input: { transactionBlock: "launch-flash-a-bytes" } }
  ]);
  assert.deepEqual(txs[0].calls.map((call) => call.target), [
    "0xBROWN::flash::borrow_a_with_coin",
    "0xBROWN::flash::repay_a_with_coin"
  ]);
  assert.deepEqual(txs[0].merges, [
    {
      coin: { kind: "nested-result", index: 0, resultIndex: 0 },
      sources: [{ kind: "object", id: "0xFEEA" }]
    }
  ]);
});

test("preflightRegisteredRouteCases skips output transfers for flash cases", async () => {
  const tx = createTransactionRecorder();
  delete tx.transferObjects;
  tx.build = async () => "flash-no-outputs-bytes";
  const suiClient = {
    async dryRunTransactionBlock(input) {
      return {
        effects: { status: { status: "success" } },
        transactionBlock: input.transactionBlock
      };
    }
  };
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        return [{ kind: "bundle", id: "ab" }];
      }
    }
  ]);

  const results = await preflightRegisteredRouteCases({
    suiClient,
    transferRecipient: "0xSENDER",
    cases: [
      {
        name: "custom flash A",
        kind: "flash-borrow-a",
        tx,
        providerRegistry: registry,
        providerId: "custom",
        clock: "0xCLOCK",
        pair: {
          packageId: "0xBROWN",
          typeA: "A",
          typeB: "B",
          pool: "0xPOOLAB"
        },
        amount: 1_000n,
        feeCoin: "0xFEEA",
        recipient: "0xRECIPIENT"
      }
    ]
  });

  assert.deepEqual(
    results.map((result) => ({
      name: result.name,
      kind: result.kind,
      providerId: result.providerId,
      dryRunResult: result.dryRunResult
    })),
    [
      {
        name: "custom flash A",
        kind: "flash-borrow-a",
        providerId: "custom",
        dryRunResult: {
          effects: { status: { status: "success" } },
          transactionBlock: "flash-no-outputs-bytes"
        }
      }
    ]
  );
  assert.deepEqual(tx.calls.map((call) => call.target), [
    "0xBROWN::flash::borrow_a_with_coin",
    "0xBROWN::flash::repay_a_with_coin"
  ]);
  assert.deepEqual(tx.transfers, []);
});

test("buildRegisteredRoutePreflightCases rejects mismatched route config fields", () => {
  const providerRegistry = createRoutePriceProviderRegistry([]);
  const txFactory = () => createTransactionRecorder();
  const baseCase = {
    name: "bad-route",
    providerId: "missing",
    clock: "0xCLOCK",
    path: ["A", "B"],
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "B",
        pool: "0xPOOLAB"
      }
    ],
    input: "0xCOINA"
  };

  assert.throws(
    () =>
      buildRegisteredRoutePreflightCases({
        providerRegistry,
        txFactory,
        cases: [{ ...baseCase, kind: "exact-input" }]
      }),
    /BrownFi exact-input preflight config requires minOutputs/
  );
  assert.throws(
    () =>
      buildRegisteredRoutePreflightCases({
        providerRegistry,
        txFactory,
        cases: [{ ...baseCase, kind: "exact-output", minOutputs: [1n] }]
      }),
    /BrownFi exact-output preflight config requires amountOut/
  );
  assert.throws(
    () =>
      buildRegisteredRoutePreflightCases({
        providerRegistry,
        txFactory,
        cases: [
          {
            ...baseCase,
            kind: "exact-output-results",
            amountOut: 1n,
            minOutputs: [1n]
          }
        ]
      }),
    /BrownFi exact-output preflight config must not set minOutputs/
  );
  assert.throws(
    () =>
      buildRegisteredRoutePreflightCases({
        providerRegistry,
        txFactory,
        cases: [{ ...baseCase, kind: "remove-liquidity", minBOut: 2n }]
      }),
    /BrownFi remove-liquidity preflight config requires minAOut/
  );
  assert.throws(
    () =>
      buildRegisteredRoutePreflightCases({
        providerRegistry,
        txFactory,
        cases: [
          {
            ...baseCase,
            kind: "add-liquidity",
            inputB: "0xCOINB",
            minADeposit: 1n,
            minLpOut: 2n
          }
        ]
      }),
    /BrownFi add-liquidity preflight config requires minADeposit and minBDeposit together/
  );
  assert.throws(
    () =>
      buildRegisteredRoutePreflightCases({
        providerRegistry,
        txFactory,
        cases: [
          {
            ...baseCase,
            kind: "remove-liquidity",
            minAOut: 1n,
            minBOut: 2n,
            minLpOut: 3n
          }
        ]
      }),
    /BrownFi remove-liquidity preflight config must not set minLpOut/
  );
});

test("buildRegisteredRoutePreflightCases validates config before creating transactions", () => {
  const providerRegistry = createRoutePriceProviderRegistry([]);
  let txFactoryCalls = 0;

  assert.throws(
    () =>
      buildRegisteredRoutePreflightCases({
        providerRegistry,
        txFactory() {
          txFactoryCalls += 1;
          return createTransactionRecorder();
        },
        cases: [
          {
            name: "bad-route",
            kind: "exact-input",
            providerId: "missing",
            clock: "0xCLOCK",
            path: ["A", "B"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOLAB"
              }
            ],
            input: "0xCOINA"
          }
        ]
      }),
    /BrownFi exact-input preflight config requires minOutputs/
  );
  assert.equal(txFactoryCalls, 0);
});

test("buildRegisteredRoutePreflightCases rejects unregistered providers before creating transactions", () => {
  const providerRegistry = createRoutePriceProviderRegistry([]);
  let txFactoryCalls = 0;

  assert.throws(
    () =>
      buildRegisteredRoutePreflightCases({
        providerRegistry,
        txFactory() {
          txFactoryCalls += 1;
          return createTransactionRecorder();
        },
        cases: [
          {
            name: "missing-provider-route",
            kind: "exact-input",
            providerId: "missing",
            clock: "0xCLOCK",
            path: ["A", "B"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOLAB"
              }
            ],
            input: "0xCOINA",
            minOutputs: [1n]
          }
        ]
      }),
    /No BrownFi route price provider registered for missing/
  );
  assert.equal(txFactoryCalls, 0);
});

test("buildRegisteredRoutePreflightCases rejects unresolved routes before creating transactions", () => {
  const providerRegistry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles() {
        throw new Error("provider build should not run");
      }
    }
  ]);
  let txFactoryCalls = 0;

  assert.throws(
    () =>
      buildRegisteredRoutePreflightCases({
        providerRegistry,
        txFactory() {
          txFactoryCalls += 1;
          return createTransactionRecorder();
        },
        cases: [
          {
            name: "unresolved-route",
            kind: "exact-output-results",
            providerId: "custom",
            clock: "0xCLOCK",
            path: ["A", "C"],
            pairs: [
              {
                packageId: "0xBROWN",
                typeA: "A",
                typeB: "B",
                pool: "0xPOOLAB"
              }
            ],
            input: "0xCOINA",
            amountOut: 1n
          }
        ]
      }),
    /No BrownFi route pair found for A -> C/
  );
  assert.equal(txFactoryCalls, 0);
});

test("swapExactOutputWithRegisteredRoute plans a custom-provider mixed-orientation route", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAC", "0xPOOLBC"]
        );
        return [
          { kind: "bundle", id: "ac" },
          { kind: "bundle", id: "bc" }
        ];
      }
    }
  ]);

  const result = await swapExactOutputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "custom",
    path: ["0x1::a::A", "0x1::c::C", "0x1::b::B"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::c::C",
        pool: "0xPOOLAC"
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC"
      }
    ],
    input: "0xCOINA",
    amountOut: 44n
  });

  assert.deepEqual(result, { kind: "result", index: 0 });
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::swap_a_for_exact_c_via_b_with_reversed_second_bundle",
    typeArguments: ["0x1::a::A", "0x1::c::C", "0x1::b::B"],
    arguments: [
      { kind: "bundle", id: "ac" },
      { kind: "bundle", id: "bc" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAC" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "44" }
    ]
  });
});

test("swapExactOutputWithRegisteredRouteResults quote-chains a three-hop mixed route", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAC", "0xPOOLBC", "0xPOOLBD"]
        );
        return [
          { kind: "bundle", id: "ac" },
          { kind: "bundle", id: "bc" },
          { kind: "bundle", id: "bd" }
        ];
      }
    }
  ]);

  const result = await swapExactOutputWithRegisteredRouteResults(tx, {
    providerRegistry: registry,
    providerId: "custom",
    path: ["A", "C", "B", "D"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "C",
        pool: "0xPOOLAC"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "C",
        pool: "0xPOOLBC"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "D",
        pool: "0xPOOLBD"
      }
    ],
    input: "0xCOINA",
    amountOut: 55n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 0 },
    { kind: "result", index: 1 }
  ]);
  assert.deepEqual(result.swapResults, [
    { kind: "result", index: 2 },
    { kind: "result", index: 3 },
    { kind: "result", index: 4 }
  ]);
  assert.deepEqual(result.changeCoins, [
    { kind: "nested-result", index: 2, resultIndex: 0 },
    { kind: "nested-result", index: 3, resultIndex: 0 },
    { kind: "nested-result", index: 4, resultIndex: 0 }
  ]);
  assert.deepEqual(result.output, { kind: "nested-result", index: 4, resultIndex: 1 });
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
      "0xBROWN::swap::quote_b_for_exact_a_with_bundle",
      "0xBROWN::router::swap_a_for_exact_b_with_bundle",
      "0xBROWN::router::swap_b_for_exact_a_with_bundle",
      "0xBROWN::router::swap_a_for_exact_b_with_bundle"
    ]
  );
  assert.deepEqual(tx.calls[0].typeArguments, ["B", "D"]);
  assert.deepEqual(tx.calls[0].arguments[3], { kind: "u64", value: "55" });
  assert.deepEqual(tx.calls[1].typeArguments, ["B", "C"]);
  assert.deepEqual(tx.calls[1].arguments[3], {
    kind: "nested-result",
    index: 0,
    resultIndex: 0
  });
  assert.deepEqual(tx.calls[2].typeArguments, ["A", "C"]);
  assert.deepEqual(tx.calls[2].arguments[3], { kind: "object", id: "0xCOINA" });
  assert.deepEqual(tx.calls[2].arguments[4], {
    kind: "nested-result",
    index: 1,
    resultIndex: 0
  });
  assert.deepEqual(tx.calls[3].typeArguments, ["B", "C"]);
  assert.deepEqual(tx.calls[3].arguments[3], {
    kind: "nested-result",
    index: 2,
    resultIndex: 1
  });
  assert.deepEqual(tx.calls[3].arguments[4], {
    kind: "nested-result",
    index: 0,
    resultIndex: 0
  });
  assert.deepEqual(tx.calls[4].typeArguments, ["B", "D"]);
  assert.deepEqual(tx.calls[4].arguments[3], {
    kind: "nested-result",
    index: 3,
    resultIndex: 1
  });
  assert.deepEqual(tx.calls[4].arguments[4], { kind: "u64", value: "55" });
});

test("quoteExactOutputWithRegisteredRoute builds bundles and chains required inputs backward", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAC", "0xPOOLBC", "0xPOOLBD"]
        );
        return [
          { kind: "bundle", id: "ac" },
          { kind: "bundle", id: "bc" },
          { kind: "bundle", id: "bd" }
        ];
      }
    }
  ]);

  const result = await quoteExactOutputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "custom",
    path: ["A", "C", "B", "D"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "C",
        pool: "0xPOOLAC"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "C",
        pool: "0xPOOLBC"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "D",
        pool: "0xPOOLBD"
      }
    ],
    amountOut: 55n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 2 },
    { kind: "result", index: 1 },
    { kind: "result", index: 0 }
  ]);
  assert.deepEqual(result.amounts, [
    { kind: "nested-result", index: 2, resultIndex: 0 },
    { kind: "nested-result", index: 2, resultIndex: 1 },
    { kind: "nested-result", index: 1, resultIndex: 1 },
    { kind: "nested-result", index: 0, resultIndex: 1 }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
      "0xBROWN::swap::quote_b_for_exact_a_with_bundle",
      "0xBROWN::swap::quote_a_for_exact_b_with_bundle"
    ]
  );
  assert.deepEqual(tx.calls[0].typeArguments, ["B", "D"]);
  assert.deepEqual(tx.calls[0].arguments[3], { kind: "u64", value: "55" });
  assert.deepEqual(tx.calls[1].typeArguments, ["B", "C"]);
  assert.deepEqual(tx.calls[1].arguments[3], {
    kind: "nested-result",
    index: 0,
    resultIndex: 0
  });
  assert.deepEqual(tx.calls[2].typeArguments, ["A", "C"]);
  assert.deepEqual(tx.calls[2].arguments[3], {
    kind: "nested-result",
    index: 1,
    resultIndex: 0
  });
});

test("quoteExactOutputWithRegisteredRoute surfaces cutoff-effective route outputs", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAB", "0xPOOLBC"]
        );
        return [
          { kind: "bundle", id: "ab" },
          { kind: "bundle", id: "bc" }
        ];
      }
    }
  ]);

  const result = await quoteExactOutputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "custom",
    path: ["A", "B", "C"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "B",
        pool: "0xPOOLAB"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "C",
        pool: "0xPOOLBC"
      }
    ],
    amountOut: 55n
  });

  assert.deepEqual(result.amounts, [
    { kind: "nested-result", index: 1, resultIndex: 0 },
    { kind: "nested-result", index: 1, resultIndex: 1 },
    { kind: "nested-result", index: 0, resultIndex: 1 }
  ]);
});

test("registered route quote builders compose exact-output required input into exact-input quote chain", async () => {
  const tx = createTransactionRecorder();
  const providerCalls = [];
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        const callIndex = providerCalls.length;
        providerCalls.push(optionsArg);
        return callIndex === 0
          ? [
              { kind: "bundle", id: "out-ab" },
              { kind: "bundle", id: "out-bc" }
            ]
          : [
              { kind: "bundle", id: "in-ab" },
              { kind: "bundle", id: "in-bc" }
            ];
      }
    }
  ]);
  const routeOptions = {
    providerRegistry: registry,
    providerId: "custom",
    path: ["A", "B", "C"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "B",
        pool: "0xPOOLAB"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "C",
        pool: "0xPOOLBC"
      }
    ]
  };

  const exactOutputQuote = await quoteExactOutputWithRegisteredRoute(tx, {
    ...routeOptions,
    amountOut: 55n
  });
  const exactInputQuote = await quoteExactInputWithRegisteredRoute(tx, {
    ...routeOptions,
    amountIn: exactOutputQuote.amounts[0]
  });

  assert.deepEqual(providerCalls.map((call) => call.hops.map((hop) => hop.pool)), [
    ["0xPOOLAB", "0xPOOLBC"],
    ["0xPOOLAB", "0xPOOLBC"]
  ]);
  assert.deepEqual(exactOutputQuote.amounts, [
    { kind: "nested-result", index: 1, resultIndex: 0 },
    { kind: "nested-result", index: 1, resultIndex: 1 },
    { kind: "nested-result", index: 0, resultIndex: 1 }
  ]);
  assert.deepEqual(exactInputQuote.amounts, [
    exactOutputQuote.amounts[0],
    { kind: "nested-result", index: 2, resultIndex: 0 },
    { kind: "nested-result", index: 3, resultIndex: 0 }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
      "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
      "0xBROWN::swap::quote_a_for_b_with_bundle",
      "0xBROWN::swap::quote_a_for_b_with_bundle"
    ]
  );
  assert.deepEqual(tx.calls[0].arguments[0], { kind: "bundle", id: "out-bc" });
  assert.deepEqual(tx.calls[0].arguments[3], { kind: "u64", value: "55" });
  assert.deepEqual(tx.calls[1].arguments[0], { kind: "bundle", id: "out-ab" });
  assert.deepEqual(tx.calls[1].arguments[3], {
    kind: "nested-result",
    index: 0,
    resultIndex: 0
  });
  assert.deepEqual(tx.calls[2].arguments[0], { kind: "bundle", id: "in-ab" });
  assert.deepEqual(tx.calls[2].arguments[3], exactOutputQuote.amounts[0]);
  assert.deepEqual(tx.calls[3].arguments[0], { kind: "bundle", id: "in-bc" });
  assert.deepEqual(tx.calls[3].arguments[3], {
    kind: "nested-result",
    index: 2,
    resultIndex: 0
  });
});

test("quoteExactOutputWithoutCutoffWithRegisteredRoute chains raw required inputs backward", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([
    {
      id: "custom",
      async buildPriceBundles(txArg, optionsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(
          optionsArg.hops.map((hop) => hop.pool),
          ["0xPOOLAC", "0xPOOLBC", "0xPOOLBD"]
        );
        return [
          { kind: "bundle", id: "ac" },
          { kind: "bundle", id: "bc" },
          { kind: "bundle", id: "bd" }
        ];
      }
    }
  ]);

  const result = await quoteExactOutputWithoutCutoffWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "custom",
    path: ["A", "C", "B", "D"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "C",
        pool: "0xPOOLAC"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "C",
        pool: "0xPOOLBC"
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "D",
        pool: "0xPOOLBD"
      }
    ],
    amountOut: 55n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 2 },
    { kind: "result", index: 1 },
    { kind: "result", index: 0 }
  ]);
  assert.deepEqual(result.amounts, [
    { kind: "nested-result", index: 2, resultIndex: 0 },
    { kind: "nested-result", index: 1, resultIndex: 0 },
    { kind: "nested-result", index: 0, resultIndex: 0 },
    { kind: "u64", value: "55" }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::swap::quote_a_for_exact_b_without_cutoff_with_bundle",
      "0xBROWN::swap::quote_b_for_exact_a_without_cutoff_with_bundle",
      "0xBROWN::swap::quote_a_for_exact_b_without_cutoff_with_bundle"
    ]
  );
  assert.deepEqual(tx.calls[0].typeArguments, ["B", "D"]);
  assert.deepEqual(tx.calls[0].arguments[3], { kind: "u64", value: "55" });
  assert.deepEqual(tx.calls[1].typeArguments, ["B", "C"]);
  assert.deepEqual(tx.calls[1].arguments[3], {
    kind: "nested-result",
    index: 0,
    resultIndex: 0
  });
  assert.deepEqual(tx.calls[2].typeArguments, ["A", "C"]);
  assert.deepEqual(tx.calls[2].arguments[3], {
    kind: "nested-result",
    index: 1,
    resultIndex: 0
  });
});

test("createSwitchboardRoutePriceProvider plugs Switchboard quotes into registered routes", async () => {
  const tx = createTransactionRecorder();
  const switchboardClient = { network: "testnet" };
  const quotes = { kind: "quotes", id: "route-quotes" };
  const registry = createRoutePriceProviderRegistry([
    createSwitchboardRoutePriceProvider({
      switchboardClient,
      async fetchQuoteUpdate(clientArg, feedIdsArg, txArg) {
        assert.equal(clientArg, switchboardClient);
        assert.equal(txArg, tx);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
        return quotes;
      }
    })
  ]);

  const result = await swapExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "switchboard",
    path: ["0x1::a::A", "0x1::b::B"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        quoteVerifier: "0xVERIFIERAB",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      }
    ],
    input: "0xCOINA",
    minOutputs: [99n]
  });

  assert.deepEqual(result, { kind: "result", index: 3 });
  assert.deepEqual(tx.calls[3], {
    target: "0xBROWN::router::swap_exact_a_for_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "99" }
    ]
  });
});

test("createStorkRoutePriceProvider plugs Stork updates into registered routes", async () => {
  const tx = createTransactionRecorder();
  const storkClient = { network: "testnet" };
  const registry = createRoutePriceProviderRegistry([
    createStorkRoutePriceProvider({
      storkClient,
      async updatePriceFeeds(clientArg, feedIdsArg, txArg) {
        assert.equal(clientArg, storkClient);
        assert.equal(txArg, tx);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
      }
    })
  ]);

  const result = await swapExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "stork",
    path: ["0x1::a::A", "0x1::b::B"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        storkState: "0xSTORKSTATE",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      }
    ],
    input: "0xCOINA",
    minOutputs: [44]
  });

  assert.deepEqual(result, { kind: "result", index: 3 });
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::stork_source::read_price_a",
      "0xBROWN::stork_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::router::swap_exact_a_for_b_with_bundle"
    ]
  );
  assert.deepEqual(tx.calls[0].arguments[0], { kind: "object", id: "0xSTORKSTATE" });
  assert.deepEqual(tx.calls[3].arguments[4], { kind: "u64", value: "44" });
});

test("swapExactAForBWithPythRoute builds the Pyth bundle before the single-hop swap", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactAForBWithPythRoute(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
        return [{ update: "a" }, { update: "b" }];
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(updatesArg, [{ update: "a" }, { update: "b" }]);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    clock: "0x6",
    pool: "0xPOOLAB",
    feedIds: ["feed-a", "feed-b"],
    input: "0xCOINA",
    minOut: 99n
  });

  assert.deepEqual(result, { kind: "result", index: 3 });
  assert.deepEqual(tx.calls[3], {
    target: "0xBROWN::router::swap_exact_a_for_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "99" }
    ]
  });
});

test("swapExactAForCViaBWithPythRoute builds deduped Pyth bundles before the typed two-hop swap", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactAForCViaBWithPythRoute(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
        assert.equal(txArg, tx);
        assert.deepEqual(updatesArg, [
          { update: "feed-a" },
          { update: "feed-b" },
          { update: "feed-c" }
        ]);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    hopAB: {
      pool: "0xPOOLAB",
      feedIds: ["feed-a", "feed-b"]
    },
    hopBC: {
      pool: "0xPOOLBC",
      feedIds: ["feed-b", "feed-c"]
    },
    input: "0xCOINA",
    minBOut: 50n,
    minCOut: 40n
  });

  assert.deepEqual(result, { kind: "result", index: 6 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_exact_a_for_c_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "50" },
      { kind: "u64", value: "40" }
    ]
  });
});

test("swapExactBForAWithPythRoute builds the Pyth bundle before the reverse single-hop swap", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactBForAWithPythRoute(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
        return [{ update: "a" }, { update: "b" }];
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    clock: "0x6",
    pool: "0xPOOLAB",
    feedIds: ["feed-a", "feed-b"],
    input: "0xCOINB",
    minOut: 101n
  });

  assert.deepEqual(result, { kind: "result", index: 3 });
  assert.deepEqual(tx.calls[3], {
    target: "0xBROWN::router::swap_exact_b_for_a_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u64", value: "101" }
    ]
  });
});

test("swapExactCForAViaBWithPythRoute builds deduped Pyth bundles before the reverse typed two-hop swap", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactCForAViaBWithPythRoute(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    hopAB: {
      pool: "0xPOOLAB",
      feedIds: ["feed-a", "feed-b"]
    },
    hopBC: {
      pool: "0xPOOLBC",
      feedIds: ["feed-b", "feed-c"]
    },
    input: "0xCOINC",
    minBOut: 60n,
    minAOut: 55n
  });

  assert.deepEqual(result, { kind: "result", index: 6 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_exact_c_for_a_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINC" },
      { kind: "u64", value: "60" },
      { kind: "u64", value: "55" }
    ]
  });
});

test("swapExactInputWithPythRoute plans a forward two-hop PTB route from token path", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactInputWithPythRoute(tx, {
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
        assert.equal(txArg, tx);
        assert.equal(tx.calls.length, 0);
        assert.deepEqual(updatesArg, [
          { update: "feed-a" },
          { update: "feed-b" },
          { update: "feed-c" }
        ]);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ],
    input: "0xCOINA",
    minOutputs: [50n, 40n]
  });

  assert.deepEqual(result, { kind: "result", index: 7 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_exact_a_for_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "50" }
    ]
  });
  assert.deepEqual(tx.calls[7], {
    target: "0xBROWN::router::swap_exact_a_for_b_with_bundle",
    typeArguments: ["0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "result", index: 6 },
      { kind: "u64", value: "40" }
    ]
  });
});

test("quoteExactInputWithPythRoute updates Pyth before route quote calls", async () => {
  const tx = createTransactionRecorder();
  const result = await quoteExactInputWithPythRoute(tx, {
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
        assert.equal(txArg, tx);
        assert.equal(tx.calls.length, 0);
        assert.deepEqual(updatesArg, [
          { update: "feed-a" },
          { update: "feed-b" },
          { update: "feed-c" }
        ]);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ],
    amountIn: 777n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 6 },
    { kind: "result", index: 7 }
  ]);
  assert.deepEqual(result.amounts, [
    { kind: "u64", value: "777" },
    { kind: "nested-result", index: 6, resultIndex: 0 },
    { kind: "nested-result", index: 7, resultIndex: 0 }
  ]);
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::swap::quote_a_for_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "u64", value: "777" }
    ]
  });
  assert.deepEqual(tx.calls[7], {
    target: "0xBROWN::swap::quote_a_for_b_with_bundle",
    typeArguments: ["0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "nested-result", index: 6, resultIndex: 0 }
    ]
  });
});

test("quoteExactInputWithoutCutoffWithPythRoute chains raw Pyth route quote amounts", async () => {
  const tx = createTransactionRecorder();
  const result = await quoteExactInputWithoutCutoffWithPythRoute(tx, {
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
        assert.equal(txArg, tx);
        assert.equal(tx.calls.length, 0);
        assert.deepEqual(updatesArg, [
          { update: "feed-a" },
          { update: "feed-b" },
          { update: "feed-c" }
        ]);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ],
    amountIn: 777n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 6 },
    { kind: "result", index: 7 }
  ]);
  assert.deepEqual(result.amounts, [
    { kind: "u64", value: "777" },
    { kind: "nested-result", index: 6, resultIndex: 1 },
    { kind: "nested-result", index: 7, resultIndex: 1 }
  ]);
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::swap::quote_a_for_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "u64", value: "777" }
    ]
  });
  assert.deepEqual(tx.calls[7], {
    target: "0xBROWN::swap::quote_a_for_b_with_bundle",
    typeArguments: ["0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "nested-result", index: 6, resultIndex: 1 }
    ]
  });
});

test("swapExactInputWithPythRoute plans a reverse two-hop PTB route from token path", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactInputWithPythRoute(tx, {
    path: ["0x1::c::C", "0x1::b::B", "0x1::a::A"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-b", "feed-c", "feed-a"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEB", "0xPRICEC", "0xPRICEA"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ],
    input: "0xCOINC",
    minOutputs: [60n, 55n]
  });

  assert.deepEqual(result, { kind: "result", index: 7 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_exact_b_for_a_with_bundle",
    typeArguments: ["0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINC" },
      { kind: "u64", value: "60" }
    ]
  });
  assert.deepEqual(tx.calls[7], {
    target: "0xBROWN::router::swap_exact_b_for_a_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 6 },
      { kind: "u64", value: "55" }
    ]
  });
});

test("swapExactOutputWithPythRoute rejects paths outside the day-one exact-output hop limit", async () => {
  const tx = createTransactionRecorder();
  await assert.rejects(
    () =>
      swapExactOutputWithPythRoute(tx, {
        path: ["0x1::a::A", "0x1::b::B", "0x1::c::C", "0x1::d::D"],
        priceFeedConnection: {
          async getPriceFeedsUpdateData() {
            throw new Error("must not fetch");
          }
        },
        pythClient: {
          async updatePriceFeeds() {
            throw new Error("must not update");
          }
        },
        clock: "0x6",
        pairs: [],
        input: "0xCOINA",
        amountOut: 1n
      }),
    /BrownFi Sui PTB route planner supports one or two hops/
  );
});

test("swapExactOutputWithPythRouteResults quote-chains a three-hop Pyth route", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactOutputWithPythRouteResults(tx, {
    path: ["A", "C", "B", "D"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-c", "feed-b", "feed-d"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
        assert.equal(txArg, tx);
        assert.equal(tx.calls.length, 0);
        assert.deepEqual(updatesArg, [
          { update: "feed-a" },
          { update: "feed-c" },
          { update: "feed-b" },
          { update: "feed-d" }
        ]);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-c", "feed-b", "feed-d"]);
        return ["0xPRICEA", "0xPRICEC", "0xPRICEB", "0xPRICED"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "A",
        typeB: "C",
        pool: "0xPOOLAC",
        feedIds: ["feed-a", "feed-c"]
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      },
      {
        packageId: "0xBROWN",
        typeA: "B",
        typeB: "D",
        pool: "0xPOOLBD",
        feedIds: ["feed-b", "feed-d"]
      }
    ],
    input: "0xCOINA",
    amountOut: 55n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 9 },
    { kind: "result", index: 10 }
  ]);
  assert.deepEqual(result.swapResults, [
    { kind: "result", index: 11 },
    { kind: "result", index: 12 },
    { kind: "result", index: 13 }
  ]);
  assert.deepEqual(result.changeCoins, [
    { kind: "nested-result", index: 11, resultIndex: 0 },
    { kind: "nested-result", index: 12, resultIndex: 0 },
    { kind: "nested-result", index: 13, resultIndex: 0 }
  ]);
  assert.deepEqual(result.output, { kind: "nested-result", index: 13, resultIndex: 1 });
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
      "0xBROWN::swap::quote_b_for_exact_a_with_bundle",
      "0xBROWN::router::swap_a_for_exact_b_with_bundle",
      "0xBROWN::router::swap_b_for_exact_a_with_bundle",
      "0xBROWN::router::swap_a_for_exact_b_with_bundle"
    ]
  );
  assert.deepEqual(tx.calls[9].typeArguments, ["B", "D"]);
  assert.deepEqual(tx.calls[9].arguments[3], { kind: "u64", value: "55" });
  assert.deepEqual(tx.calls[10].typeArguments, ["B", "C"]);
  assert.deepEqual(tx.calls[10].arguments[3], {
    kind: "nested-result",
    index: 9,
    resultIndex: 0
  });
  assert.deepEqual(tx.calls[11].typeArguments, ["A", "C"]);
  assert.deepEqual(tx.calls[11].arguments[3], { kind: "object", id: "0xCOINA" });
  assert.deepEqual(tx.calls[11].arguments[4], {
    kind: "nested-result",
    index: 10,
    resultIndex: 0
  });
  assert.deepEqual(tx.calls[12].typeArguments, ["B", "C"]);
  assert.deepEqual(tx.calls[12].arguments[3], {
    kind: "nested-result",
    index: 11,
    resultIndex: 1
  });
  assert.deepEqual(tx.calls[12].arguments[4], {
    kind: "nested-result",
    index: 9,
    resultIndex: 0
  });
  assert.deepEqual(tx.calls[13].typeArguments, ["B", "D"]);
  assert.deepEqual(tx.calls[13].arguments[3], {
    kind: "nested-result",
    index: 12,
    resultIndex: 1
  });
  assert.deepEqual(tx.calls[13].arguments[4], { kind: "u64", value: "55" });
});

test("createSupraPushRoutePriceProvider plugs Supra push readings into registered routes", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([createSupraPushRoutePriceProvider()]);

  const result = await swapExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "supra-push",
    path: ["0x1::a::A", "0x1::b::B"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        supraHolder: "0xSUPRAHOLDER",
        pool: "0xPOOLAB"
      }
    ],
    input: "0xCOINA",
    minOutputs: [55]
  });

  assert.deepEqual(result, { kind: "result", index: 3 });
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::supra_source::read_push_price_a",
      "0xBROWN::supra_source::read_push_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::router::swap_exact_a_for_b_with_bundle"
    ]
  );
});

test("createSupraPullRoutePriceProvider plugs Supra pull proof bundles into registered routes", async () => {
  const tx = createTransactionRecorder();
  const registry = createRoutePriceProviderRegistry([createSupraPullRoutePriceProvider()]);

  const result = await swapExactInputWithRegisteredRoute(tx, {
    providerRegistry: registry,
    providerId: "supra-pull",
    path: ["0x1::a::A", "0x1::b::B"],
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        dkgState: "0xDKG",
        supraHolder: "0xSUPRAHOLDER",
        merkleRootHash: "0xMERKLEROOT",
        proofBytes: [1, 2, 3],
        pool: "0xPOOLAB"
      }
    ],
    input: "0xCOINA",
    minOutputs: [55]
  });

  assert.deepEqual(result, { kind: "result", index: 1 });
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::supra_pull_source::read_price_bundle",
      "0xBROWN::router::swap_exact_a_for_b_with_bundle"
    ]
  );
});

test("swapAForExactBWithPythRoute builds the Pyth bundle before the single-hop exact-output swap", async () => {
  const tx = createTransactionRecorder();
  const result = await swapAForExactBWithPythRoute(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
        return [{ update: "a" }, { update: "b" }];
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    clock: "0x6",
    pool: "0xPOOLAB",
    feedIds: ["feed-a", "feed-b"],
    input: "0xCOINA",
    amountOut: 77n
  });

  assert.deepEqual(result, { kind: "result", index: 3 });
  assert.deepEqual(tx.calls[3], {
    target: "0xBROWN::router::swap_a_for_exact_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "77" }
    ]
  });
});

test("swapBForExactAWithPythRoute builds the Pyth bundle before the reverse single-hop exact-output swap", async () => {
  const tx = createTransactionRecorder();
  const result = await swapBForExactAWithPythRoute(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b"]);
        return [{ update: "a" }, { update: "b" }];
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEB"];
      }
    },
    clock: "0x6",
    pool: "0xPOOLAB",
    feedIds: ["feed-a", "feed-b"],
    input: "0xCOINB",
    amountOut: 88n
  });

  assert.deepEqual(result, { kind: "result", index: 3 });
  assert.deepEqual(tx.calls[3], {
    target: "0xBROWN::router::swap_b_for_exact_a_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u64", value: "88" }
    ]
  });
});

test("swapAForExactCViaBWithPythRoute builds deduped Pyth bundles before the typed exact-output swap", async () => {
  const tx = createTransactionRecorder();
  const result = await swapAForExactCViaBWithPythRoute(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    hopAB: {
      pool: "0xPOOLAB",
      feedIds: ["feed-a", "feed-b"]
    },
    hopBC: {
      pool: "0xPOOLBC",
      feedIds: ["feed-b", "feed-c"]
    },
    input: "0xCOINA",
    amountOut: 44n
  });

  assert.deepEqual(result, { kind: "result", index: 6 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_a_for_exact_c_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "44" }
    ]
  });
});

test("swapCForExactAViaBWithPythRoute builds deduped Pyth bundles before the reverse typed exact-output swap", async () => {
  const tx = createTransactionRecorder();
  const result = await swapCForExactAViaBWithPythRoute(tx, {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    hopAB: {
      pool: "0xPOOLAB",
      feedIds: ["feed-a", "feed-b"]
    },
    hopBC: {
      pool: "0xPOOLBC",
      feedIds: ["feed-b", "feed-c"]
    },
    input: "0xCOINC",
    amountOut: 33n
  });

  assert.deepEqual(result, { kind: "result", index: 6 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_c_for_exact_a_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINC" },
      { kind: "u64", value: "33" }
    ]
  });
});

test("swapExactOutputWithPythRoute plans a forward two-hop exact-output PTB route", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactOutputWithPythRoute(tx, {
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ],
    input: "0xCOINA",
    amountOut: 44n
  });

  assert.deepEqual(result, { kind: "result", index: 6 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_a_for_exact_c_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "44" }
    ]
  });
});

test("quoteExactOutputWithPythRoute updates Pyth before required-input quote calls", async () => {
  const tx = createTransactionRecorder();
  const result = await quoteExactOutputWithPythRoute(tx, {
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
        assert.equal(txArg, tx);
        assert.equal(tx.calls.length, 0);
        assert.deepEqual(updatesArg, [
          { update: "feed-a" },
          { update: "feed-b" },
          { update: "feed-c" }
        ]);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ],
    amountOut: 44n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 7 },
    { kind: "result", index: 6 }
  ]);
  assert.deepEqual(result.amounts, [
    { kind: "nested-result", index: 7, resultIndex: 0 },
    { kind: "nested-result", index: 7, resultIndex: 1 },
    { kind: "nested-result", index: 6, resultIndex: 1 }
  ]);
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
    typeArguments: ["0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "u64", value: "44" }
    ]
  });
  assert.deepEqual(tx.calls[7], {
    target: "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "nested-result", index: 6, resultIndex: 0 }
    ]
  });
});

test("Pyth route exact-output quote handles feed the matching exact-input quote chain", async () => {
  const tx = createTransactionRecorder();
  const updateCalls = [];
  const routeOptions = {
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
        assert.equal(txArg, tx);
        updateCalls.push({ txCallCount: tx.calls.length, feedIds: [...feedIdsArg] });
        assert.deepEqual(updatesArg, [
          { update: "feed-a" },
          { update: "feed-b" },
          { update: "feed-c" }
        ]);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ]
  };

  const exactOutputQuote = await quoteExactOutputWithPythRoute(tx, {
    ...routeOptions,
    amountOut: 44n
  });
  const exactInputQuote = await quoteExactInputWithPythRoute(tx, {
    ...routeOptions,
    amountIn: exactOutputQuote.amounts[0]
  });

  assert.deepEqual(updateCalls, [
    { txCallCount: 0, feedIds: ["feed-a", "feed-b", "feed-c"] },
    { txCallCount: 8, feedIds: ["feed-a", "feed-b", "feed-c"] }
  ]);
  assert.deepEqual(exactOutputQuote.amounts, [
    { kind: "nested-result", index: 7, resultIndex: 0 },
    { kind: "nested-result", index: 7, resultIndex: 1 },
    { kind: "nested-result", index: 6, resultIndex: 1 }
  ]);
  assert.deepEqual(exactInputQuote.amounts, [
    exactOutputQuote.amounts[0],
    { kind: "nested-result", index: 14, resultIndex: 0 },
    { kind: "nested-result", index: 15, resultIndex: 0 }
  ]);
  assert.deepEqual(
    tx.calls.map((call) => call.target),
    [
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
      "0xBROWN::swap::quote_a_for_exact_b_with_bundle",
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::pyth_source::read_price_a",
      "0xBROWN::pyth_source::read_price_b",
      "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
      "0xBROWN::swap::quote_a_for_b_with_bundle",
      "0xBROWN::swap::quote_a_for_b_with_bundle"
    ]
  );
  assert.deepEqual(tx.calls[14].arguments[3], exactOutputQuote.amounts[0]);
});

test("quoteExactOutputWithoutCutoffWithPythRoute chains raw required inputs backward", async () => {
  const tx = createTransactionRecorder();
  const result = await quoteExactOutputWithoutCutoffWithPythRoute(tx, {
    path: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds(txArg, updatesArg, feedIdsArg) {
        assert.equal(txArg, tx);
        assert.equal(tx.calls.length, 0);
        assert.deepEqual(updatesArg, [
          { update: "feed-a" },
          { update: "feed-b" },
          { update: "feed-c" }
        ]);
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-b", "feed-c"]);
        return ["0xPRICEA", "0xPRICEB", "0xPRICEC"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ],
    amountOut: 44n
  });

  assert.deepEqual(result.quoteResults, [
    { kind: "result", index: 7 },
    { kind: "result", index: 6 }
  ]);
  assert.deepEqual(result.amounts, [
    { kind: "nested-result", index: 7, resultIndex: 0 },
    { kind: "nested-result", index: 6, resultIndex: 0 },
    { kind: "u64", value: "44" }
  ]);
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::swap::quote_a_for_exact_b_without_cutoff_with_bundle",
    typeArguments: ["0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "u64", value: "44" }
    ]
  });
  assert.deepEqual(tx.calls[7], {
    target: "0xBROWN::swap::quote_a_for_exact_b_without_cutoff_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "nested-result", index: 6, resultIndex: 0 }
    ]
  });
});

test("swapExactOutputWithPythRoute plans a reverse two-hop exact-output PTB route", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactOutputWithPythRoute(tx, {
    path: ["0x1::c::C", "0x1::b::B", "0x1::a::A"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-b", "feed-c", "feed-a"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEB", "0xPRICEC", "0xPRICEA"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ],
    input: "0xCOINC",
    amountOut: 33n
  });

  assert.deepEqual(result, { kind: "result", index: 6 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_c_for_exact_a_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 5 },
      { kind: "result", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINC" },
      { kind: "u64", value: "33" }
    ]
  });
});

test("swapExactOutputWithPythRoute plans an exact-output route with reversed second hop", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactOutputWithPythRoute(tx, {
    path: ["0x1::a::A", "0x1::c::C", "0x1::b::B"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-c", "feed-b"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEC", "0xPRICEB"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::c::C",
        pool: "0xPOOLAC",
        feedIds: ["feed-a", "feed-c"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::b::B",
        typeB: "0x1::c::C",
        pool: "0xPOOLBC",
        feedIds: ["feed-b", "feed-c"]
      }
    ],
    input: "0xCOINA",
    amountOut: 44n
  });

  assert.deepEqual(result, { kind: "result", index: 6 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_a_for_exact_c_via_b_with_reversed_second_bundle",
    typeArguments: ["0x1::a::A", "0x1::c::C", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAC" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "44" }
    ]
  });
});

test("swapExactOutputWithPythRoute plans an exact-output route with reversed first hop", async () => {
  const tx = createTransactionRecorder();
  const result = await swapExactOutputWithPythRoute(tx, {
    path: ["0x1::c::C", "0x1::a::A", "0x1::b::B"],
    priceFeedConnection: {
      async getPriceFeedsUpdateData(feedIdsArg) {
        assert.deepEqual(feedIdsArg, ["feed-a", "feed-c", "feed-b"]);
        return feedIdsArg.map((feedId) => ({ update: feedId }));
      }
    },
    pythClient: {
      async updatePriceFeeds() {
        return ["0xPRICEA", "0xPRICEC", "0xPRICEB"];
      }
    },
    clock: "0x6",
    pairs: [
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::c::C",
        pool: "0xPOOLAC",
        feedIds: ["feed-a", "feed-c"]
      },
      {
        packageId: "0xBROWN",
        typeA: "0x1::a::A",
        typeB: "0x1::b::B",
        pool: "0xPOOLAB",
        feedIds: ["feed-a", "feed-b"]
      }
    ],
    input: "0xCOINC",
    amountOut: 33n
  });

  assert.deepEqual(result, { kind: "result", index: 6 });
  assert.deepEqual(tx.calls[6], {
    target: "0xBROWN::router::swap_a_for_exact_c_via_b_with_reversed_first_bundle",
    typeArguments: ["0x1::c::C", "0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 2 },
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAC" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINC" },
      { kind: "u64", value: "33" }
    ]
  });
});

test("direct single-hop OracleAdapter compatibility builders target router functions", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPRICEA",
    priceInfoObjectB: "0xPRICEB",
    clock: "0x6",
    pool: "0xPOOLAB",
    input: "0xCOIN",
    minOut: 123n,
    amountOut: 456n
  };

  const cases = [
    {
      builder: swapExactAForB,
      options: base,
      target: "swap_exact_a_for_b",
      trailing: [{ kind: "object", id: "0xCOIN" }, { kind: "u64", value: "123" }]
    },
    {
      builder: swapExactBForA,
      options: base,
      target: "swap_exact_b_for_a",
      trailing: [{ kind: "object", id: "0xCOIN" }, { kind: "u64", value: "123" }]
    },
    {
      builder: swapAForExactB,
      options: base,
      target: "swap_a_for_exact_b",
      trailing: [{ kind: "object", id: "0xCOIN" }, { kind: "u64", value: "456" }]
    },
    {
      builder: swapBForExactA,
      options: base,
      target: "swap_b_for_exact_a",
      trailing: [{ kind: "object", id: "0xCOIN" }, { kind: "u64", value: "456" }]
    }
  ];

  for (const testCase of cases) {
    const tx = createTransactionRecorder();
    testCase.builder(testCase.options)(tx);

    assert.deepEqual(tx.calls[0], {
      target: `0xBROWN::router::${testCase.target}`,
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "object", id: "0xORACLE" },
        { kind: "object", id: "0xPRICEA" },
        { kind: "object", id: "0xPRICEB" },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        ...testCase.trailing
      ]
    });
  }
});

test("direct add-liquidity OracleAdapter builder targets router add_liquidity_with_coins", () => {
  const tx = createTransactionRecorder();
  addLiquidityWithCoins({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPRICEA",
    priceInfoObjectB: "0xPRICEB",
    clock: "0x6",
    pool: "0xPOOLAB",
    inputA: "0xCOINA",
    inputB: "0xCOINB",
    minLpOut: 999n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::add_liquidity_with_coins",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPRICEA" },
      { kind: "object", id: "0xPRICEB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u64", value: "999" }
    ]
  });

  const checkedTx = createTransactionRecorder();
  addLiquidityWithCoinsWithMinDeposits({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPRICEA",
    priceInfoObjectB: "0xPRICEB",
    clock: "0x6",
    pool: "0xPOOLAB",
    inputA: "0xCOINA",
    inputB: "0xCOINB",
    minADeposit: 111n,
    minBDeposit: 222n,
    minLpOut: 333n
  })(checkedTx);

  assert.deepEqual(checkedTx.calls[0], {
    target: "0xBROWN::router::add_liquidity_with_coins_with_min_deposits",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPRICEA" },
      { kind: "object", id: "0xPRICEB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u64", value: "111" },
      { kind: "u64", value: "222" },
      { kind: "u64", value: "333" }
    ]
  });
});

test("direct coin transfer builders target recipient-aware swap entrypoints", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPRICEA",
    priceInfoObjectB: "0xPRICEB",
    clock: "0x6",
    pool: "0xPOOLAB",
    recipient: "0xRECIPIENT"
  };

  const exactATx = createTransactionRecorder();
  swapExactAForBAndTransfer({
    ...base,
    input: "0xCOINA",
    minOut: 111n
  })(exactATx);
  assert.deepEqual(exactATx.calls[0], {
    target: "0xBROWN::swap::swap_a_for_b_with_coin_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPRICEA" },
      { kind: "object", id: "0xPRICEB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "111" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const exactBTx = createTransactionRecorder();
  swapExactBForAAndTransfer({
    ...base,
    input: "0xCOINB",
    minOut: 222n
  })(exactBTx);
  assert.deepEqual(exactBTx.calls[0], {
    target: "0xBROWN::swap::swap_b_for_a_with_coin_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPRICEA" },
      { kind: "object", id: "0xPRICEB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u64", value: "222" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const exactOutATx = createTransactionRecorder();
  swapAForExactBAndTransfer({
    ...base,
    input: "0xCOINA",
    amountOut: 123n
  })(exactOutATx);
  assert.deepEqual(exactOutATx.calls[0], {
    target: "0xBROWN::router::swap_a_for_exact_b_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPRICEA" },
      { kind: "object", id: "0xPRICEB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "123" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const exactOutBTx = createTransactionRecorder();
  swapBForExactAAndTransfer({
    ...base,
    input: "0xCOINB",
    amountOut: 456n
  })(exactOutBTx);
  assert.deepEqual(exactOutBTx.calls[0], {
    target: "0xBROWN::router::swap_b_for_exact_a_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPRICEA" },
      { kind: "object", id: "0xPRICEB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u64", value: "456" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const addTx = createTransactionRecorder();
  addLiquidityWithCoinsAndTransfer({
    ...base,
    inputA: "0xCOINA",
    inputB: "0xCOINB",
    minLpOut: 333n
  })(addTx);
  assert.deepEqual(addTx.calls[0], {
    target: "0xBROWN::swap::add_liquidity_with_coins_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPRICEA" },
      { kind: "object", id: "0xPRICEB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u64", value: "333" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const removeTx = createTransactionRecorder();
  removeLiquidityWithCoinsAndTransfer({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pool: "0xPOOLAB",
    lpIn: "0xLP",
    minAOut: 444n,
    minBOut: 555n,
    recipient: "0xRECIPIENT"
  })(removeTx);
  assert.deepEqual(removeTx.calls[0], {
    target: "0xBROWN::swap::remove_liquidity_with_coins_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xLP" },
      { kind: "u64", value: "444" },
      { kind: "u64", value: "555" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });
});

test("create-pool builders target swap pool creation entrypoints", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    factory: "0xFACTORY",
    poolCreatorCap: "0xPOOL_CREATOR_CAP",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPRICEA",
    priceInfoObjectB: "0xPRICEB",
    clock: "0x6",
    initA: "0xCOINA",
    initB: "0xCOINB",
    tokenADecimals: 9,
    tokenBDecimals: 6
  };

  const tx = createTransactionRecorder();
  createPoolWithCoins(base)(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::swap::create_pool_with_coins",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xFACTORY" },
      { kind: "object", id: "0xPOOL_CREATOR_CAP" },
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPRICEA" },
      { kind: "object", id: "0xPRICEB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xCOINA" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u8", value: "9" },
      { kind: "u8", value: "6" }
    ]
  });

  const tx2 = createTransactionRecorder();
  createPoolWithCoinsAndTransferLpToSender(base)(tx2);

  assert.deepEqual(tx2.calls[0], {
    target: "0xBROWN::swap::create_pool_with_coins_and_transfer_lp_to_sender",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: tx.calls[0].arguments
  });
});

test("direct OracleAdapter quote builders target swap quote functions", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPRICEA",
    priceInfoObjectB: "0xPRICEB",
    clock: "0x6",
    pool: "0xPOOLAB",
    amountIn: 111n,
    amountOut: 222n
  };

  const cases = [
    { builder: quoteAForB, options: base, target: "quote_a_for_b", value: "111" },
    { builder: quoteBForA, options: base, target: "quote_b_for_a", value: "111" },
    { builder: quoteAForExactB, options: base, target: "quote_a_for_exact_b", value: "222" },
    {
      builder: quoteAForExactBWithoutCutoff,
      options: base,
      target: "quote_a_for_exact_b_without_cutoff",
      value: "222"
    },
    { builder: quoteBForExactA, options: base, target: "quote_b_for_exact_a", value: "222" },
    {
      builder: quoteBForExactAWithoutCutoff,
      options: base,
      target: "quote_b_for_exact_a_without_cutoff",
      value: "222"
    }
  ];

  for (const testCase of cases) {
    const tx = createTransactionRecorder();
    testCase.builder(testCase.options)(tx);

    assert.deepEqual(tx.calls[0], {
      target: `0xBROWN::swap::${testCase.target}`,
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "object", id: "0xORACLE" },
        { kind: "object", id: "0xPRICEA" },
        { kind: "object", id: "0xPRICEB" },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "u64", value: testCase.value }
      ]
    });
  }
});

test("direct typed two-hop OracleAdapter compatibility builders target router functions", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPRICEA",
    priceInfoObjectB: "0xPRICEB",
    priceInfoObjectC: "0xPRICEC",
    clock: "0x6",
    poolAB: "0xPOOLAB",
    poolBC: "0xPOOLBC",
    input: "0xCOIN",
    minBOut: 10n,
    minCOut: 20n,
    minAOut: 30n,
    amountOut: 40n
  };

  const cases = [
    {
      builder: swapExactAForCViaB,
      options: base,
      target: "swap_exact_a_for_c_via_b",
      trailing: [{ kind: "u64", value: "10" }, { kind: "u64", value: "20" }]
    },
    {
      builder: swapExactCForAViaB,
      options: base,
      target: "swap_exact_c_for_a_via_b",
      trailing: [{ kind: "u64", value: "10" }, { kind: "u64", value: "30" }]
    },
    {
      builder: swapAForExactCViaB,
      options: base,
      target: "swap_a_for_exact_c_via_b",
      trailing: [{ kind: "u64", value: "40" }]
    },
    {
      builder: swapCForExactAViaB,
      options: base,
      target: "swap_c_for_exact_a_via_b",
      trailing: [{ kind: "u64", value: "40" }]
    }
  ];

  for (const testCase of cases) {
    const tx = createTransactionRecorder();
    testCase.builder(testCase.options)(tx);

    assert.deepEqual(tx.calls[0], {
      target: `0xBROWN::router::${testCase.target}`,
      typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
      arguments: [
        { kind: "object", id: "0xORACLE" },
        { kind: "object", id: "0xPRICEA" },
        { kind: "object", id: "0xPRICEB" },
        { kind: "object", id: "0xPRICEC" },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xPOOLBC" },
        { kind: "object", id: "0xCOIN" },
        ...testCase.trailing
      ]
    });
  }
});

test("getSwapPriceBundleFromReadings builds the single Pyth reading-pair bundle PTB call", () => {
  const tx = createTransactionRecorder();
  getSwapPriceBundleFromReadings({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    readingA: { kind: "result", index: 0 },
    readingB: { kind: "result", index: 1 },
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::oracle_gateway::get_swap_price_bundle_from_readings",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("readFlowXDirectPool builds the reviewed FlowX AMM reading PTB call", () => {
  const tx = createTransactionRecorder();
  readFlowXDirectPool({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    brownfiPool: "0xPOOLAB",
    flowxPool: "0xFLOWX",
    clock: "0x6",
    sourceMask: 4n,
    twapWindowSeconds: 300n,
    twalWindowSeconds: 600n,
    validForMs: 1_000n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::amm_flowx::read_direct_pool",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xFLOWX" },
      { kind: "object", id: "0x6" },
      { kind: "u64", value: "4" },
      { kind: "u64", value: "300" },
      { kind: "u64", value: "600" },
      { kind: "u64", value: "1000" }
    ]
  });
});

test("readFlowXTwoHopPath builds the reviewed FlowX two-hop AMM reading PTB call", () => {
  const tx = createTransactionRecorder();
  readFlowXTwoHopPath({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeI: "0x1::i::I",
    brownfiPool: "0xPOOLAB",
    baseIntermediatePool: "0xFLOWXBI",
    intermediateQuotePool: "0xFLOWXIA",
    clock: "0x6",
    sourceMask: 8n,
    intermediateDecimals: 9,
    twapWindowSeconds: 300n,
    twalWindowSeconds: 600n,
    validForMs: 1_000n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::amm_flowx::read_two_hop_path",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::i::I"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xFLOWXBI" },
      { kind: "object", id: "0xFLOWXIA" },
      { kind: "object", id: "0x6" },
      { kind: "u64", value: "8" },
      { kind: "u8", value: "9" },
      { kind: "u64", value: "300" },
      { kind: "u64", value: "600" },
      { kind: "u64", value: "1000" }
    ]
  });
});

test("getSwapPriceBundleFromReadingPairsAndAmmReadings builds vectors before the AMM bundle PTB call", () => {
  const tx = createTransactionRecorder();
  getSwapPriceBundleFromReadingPairsAndAmmReadings({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    readingsA: [{ kind: "result", index: 0 }],
    readingsB: [{ kind: "result", index: 1 }],
    ammReadings: [{ kind: "result", index: 2 }],
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.vectors, [
    {
      type: "0xBROWN::oracle_gateway::PriceReading",
      elements: [{ kind: "result", index: 0 }]
    },
    {
      type: "0xBROWN::oracle_gateway::PriceReading",
      elements: [{ kind: "result", index: 1 }]
    },
    {
      type: "0xBROWN::oracle_gateway::AmmReading",
      elements: [{ kind: "result", index: 2 }]
    }
  ]);
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::oracle_gateway::get_swap_price_bundle_from_reading_pairs_and_amm_readings",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "vector", index: 0 },
      { kind: "vector", index: 1 },
      { kind: "vector", index: 2 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("getSwapPriceBundleFromReadingPairs builds vectors before the multi-source oracle bundle PTB call", () => {
  const tx = createTransactionRecorder();
  getSwapPriceBundleFromReadingPairs({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    readingsA: [{ kind: "result", index: 0 }],
    readingsB: [{ kind: "result", index: 1 }],
    clock: "0x6",
    pool: "0xPOOLAB"
  })(tx);

  assert.deepEqual(tx.vectors, [
    {
      type: "0xBROWN::oracle_gateway::PriceReading",
      elements: [{ kind: "result", index: 0 }]
    },
    {
      type: "0xBROWN::oracle_gateway::PriceReading",
      elements: [{ kind: "result", index: 1 }]
    }
  ]);
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::oracle_gateway::get_swap_price_bundle_from_reading_pairs",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "vector", index: 0 },
      { kind: "vector", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" }
    ]
  });
});

test("single-hop bundle swap builders target router functions with Move argument order", () => {
  const cases = [
    [
      "swap_exact_a_for_b_with_bundle",
      swapExactAForBWithBundle,
      { input: { kind: "result", index: 2 }, minOut: 101n },
      [{ kind: "result", index: 2 }, { kind: "u64", value: "101" }]
    ],
    [
      "swap_exact_b_for_a_with_bundle",
      swapExactBForAWithBundle,
      { input: "0xCOINB", minOut: 202n },
      [{ kind: "object", id: "0xCOINB" }, { kind: "u64", value: "202" }]
    ],
    [
      "swap_a_for_exact_b_with_bundle",
      swapAForExactBWithBundle,
      { input: { kind: "result", index: 3 }, amountOut: 303n },
      [{ kind: "result", index: 3 }, { kind: "u64", value: "303" }]
    ],
    [
      "swap_b_for_exact_a_with_bundle",
      swapBForExactAWithBundle,
      { input: "0xCOINB", amountOut: 404n },
      [{ kind: "object", id: "0xCOINB" }, { kind: "u64", value: "404" }]
    ]
  ];

  for (const [functionName, build, amounts, tailArgs] of cases) {
    const tx = createTransactionRecorder();
    build({
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      priceBundle: { kind: "result", index: 0 },
      clock: "0x6",
      pool: "0xPOOLAB",
      ...amounts
    })(tx);

    assert.deepEqual(tx.calls[0], {
      target: `0xBROWN::router::${functionName}`,
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "result", index: 0 },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        ...tailArgs
      ]
    });
  }
});

test("bundle exact-input transfer builders target recipient-aware router entrypoints", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 0 },
    clock: "0x6",
    pool: "0xPOOLAB",
    recipient: "0xRECIPIENT"
  };

  const aForBTx = createTransactionRecorder();
  swapExactAForBWithBundleAndTransfer({
    ...base,
    input: { kind: "result", index: 2 },
    minOut: 101n
  })(aForBTx);
  assert.deepEqual(aForBTx.calls[0], {
    target: "0xBROWN::router::swap_exact_a_for_b_with_bundle_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "101" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const bForATx = createTransactionRecorder();
  swapExactBForAWithBundleAndTransfer({
    ...base,
    priceBundle: { kind: "result", index: 1 },
    input: "0xCOINB",
    minOut: 202n
  })(bForATx);
  assert.deepEqual(bForATx.calls[0], {
    target: "0xBROWN::router::swap_exact_b_for_a_with_bundle_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u64", value: "202" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });
});

test("bundle exact-output transfer builders target recipient-aware router entrypoints", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 0 },
    clock: "0x6",
    pool: "0xPOOLAB",
    recipient: "0xRECIPIENT"
  };

  const aForBTx = createTransactionRecorder();
  swapAForExactBWithBundleAndTransfer({
    ...base,
    input: { kind: "result", index: 3 },
    amountOut: 303n
  })(aForBTx);
  assert.deepEqual(aForBTx.calls[0], {
    target: "0xBROWN::router::swap_a_for_exact_b_with_bundle_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 3 },
      { kind: "u64", value: "303" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const bForATx = createTransactionRecorder();
  swapBForExactAWithBundleAndTransfer({
    ...base,
    priceBundle: { kind: "result", index: 1 },
    input: "0xCOINB",
    amountOut: 404n
  })(bForATx);
  assert.deepEqual(bForATx.calls[0], {
    target: "0xBROWN::router::swap_b_for_exact_a_with_bundle_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINB" },
      { kind: "u64", value: "404" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });
});

test("liquidity builders target router functions with Move argument order", () => {
  const tx = createTransactionRecorder();
  addLiquidityWithBundle({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 0 },
    clock: "0x6",
    pool: "0xPOOLAB",
    inputA: "0xCOINA",
    inputB: { kind: "result", index: 1 },
    minLpOut: 505n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::add_liquidity_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "result", index: 1 },
      { kind: "u64", value: "505" }
    ]
  });

  const transferTx = createTransactionRecorder();
  addLiquidityWithBundleAndTransfer({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 3 },
    clock: "0x6",
    pool: "0xPOOLAB",
    inputA: "0xCOINA",
    inputB: { kind: "result", index: 4 },
    minLpOut: 808n,
    recipient: "0xRECIPIENT"
  })(transferTx);

  assert.deepEqual(transferTx.calls[0], {
    target: "0xBROWN::router::add_liquidity_with_bundle_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 3 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "result", index: 4 },
      { kind: "u64", value: "808" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const checkedTx = createTransactionRecorder();
  addLiquidityWithBundleWithMinDeposits({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 5 },
    clock: "0x6",
    pool: "0xPOOLAB",
    inputA: "0xCOINA",
    inputB: { kind: "result", index: 6 },
    minADeposit: 707n,
    minBDeposit: 808n,
    minLpOut: 909n
  })(checkedTx);

  assert.deepEqual(checkedTx.calls[0], {
    target: "0xBROWN::router::add_liquidity_with_bundle_with_min_deposits",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 5 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "result", index: 6 },
      { kind: "u64", value: "707" },
      { kind: "u64", value: "808" },
      { kind: "u64", value: "909" }
    ]
  });

  const checkedTransferTx = createTransactionRecorder();
  addLiquidityWithBundleAndTransferWithMinDeposits({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 7 },
    clock: "0x6",
    pool: "0xPOOLAB",
    inputA: "0xCOINA",
    inputB: { kind: "result", index: 8 },
    minADeposit: 111n,
    minBDeposit: 222n,
    minLpOut: 333n,
    recipient: "0xRECIPIENT"
  })(checkedTransferTx);

  assert.deepEqual(checkedTransferTx.calls[0], {
    target: "0xBROWN::router::add_liquidity_with_bundle_and_transfer_with_min_deposits",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 7 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "result", index: 8 },
      { kind: "u64", value: "111" },
      { kind: "u64", value: "222" },
      { kind: "u64", value: "333" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const tx2 = createTransactionRecorder();
  removeLiquidityWithCoins({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pool: "0xPOOLAB",
    lpIn: { kind: "result", index: 2 },
    minAOut: 606n,
    minBOut: 707n
  })(tx2);

  assert.deepEqual(tx2.calls[0], {
    target: "0xBROWN::router::remove_liquidity_with_coins",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "606" },
      { kind: "u64", value: "707" }
    ]
  });
});

test("zap-in bundle builders target router functions with Move argument order", () => {
  const tx = createTransactionRecorder();
  zapInAWithBundle({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 0 },
    clock: "0x6",
    pool: "0xPOOLAB",
    inputA: "0xCOINA",
    minBFromSwap: 808n,
    minLpOut: 909n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::zap_in_a_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "808" },
      { kind: "u64", value: "909" }
    ]
  });

  const tx2 = createTransactionRecorder();
  zapInBWithBundle({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 1 },
    clock: "0x6",
    pool: "0xPOOLAB",
    inputB: { kind: "result", index: 2 },
    minAFromSwap: 1_010n,
    minLpOut: 1_111n
  })(tx2);

  assert.deepEqual(tx2.calls[0], {
    target: "0xBROWN::router::zap_in_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "1010" },
      { kind: "u64", value: "1111" }
    ]
  });
});

test("direct zap-in builders target router functions with Move argument order", () => {
  const tx = createTransactionRecorder();
  zapInA({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPIOA",
    priceInfoObjectB: "0xPIOB",
    clock: "0x6",
    pool: "0xPOOLAB",
    inputA: "0xCOINA",
    minBFromSwap: 808n,
    minLpOut: 909n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::zap_in_a",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPIOA" },
      { kind: "object", id: "0xPIOB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "808" },
      { kind: "u64", value: "909" }
    ]
  });

  const tx2 = createTransactionRecorder();
  zapInB({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPIOA",
    priceInfoObjectB: "0xPIOB",
    clock: "0x6",
    pool: "0xPOOLAB",
    inputB: { kind: "result", index: 2 },
    minAFromSwap: 1_010n,
    minLpOut: 1_111n
  })(tx2);

  assert.deepEqual(tx2.calls[0], {
    target: "0xBROWN::router::zap_in_b",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPIOA" },
      { kind: "object", id: "0xPIOB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "1010" },
      { kind: "u64", value: "1111" }
    ]
  });
});

test("zap-out bundle builders target router functions with Move argument order", () => {
  const tx = createTransactionRecorder();
  zapOutAWithBundle({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 0 },
    clock: "0x6",
    pool: "0xPOOLAB",
    lpIn: "0xLP",
    minOut: 1_212n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::zap_out_a_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xLP" },
      { kind: "u64", value: "1212" }
    ]
  });

  const tx2 = createTransactionRecorder();
  zapOutBWithBundle({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 1 },
    clock: "0x6",
    pool: "0xPOOLAB",
    lpIn: { kind: "result", index: 2 },
    minOut: 1_313n
  })(tx2);

  assert.deepEqual(tx2.calls[0], {
    target: "0xBROWN::router::zap_out_b_with_bundle",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "1313" }
    ]
  });
});

test("bundle zap transfer builders target recipient-aware router entrypoints", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    priceBundle: { kind: "result", index: 0 },
    clock: "0x6",
    pool: "0xPOOLAB",
    recipient: "0xRECIPIENT"
  };

  const zapInATx = createTransactionRecorder();
  zapInAWithBundleAndTransfer({
    ...base,
    inputA: "0xCOINA",
    minBFromSwap: 808n,
    minLpOut: 909n
  })(zapInATx);
  assert.deepEqual(zapInATx.calls[0], {
    target: "0xBROWN::router::zap_in_a_with_bundle_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "808" },
      { kind: "u64", value: "909" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const zapInBTx = createTransactionRecorder();
  zapInBWithBundleAndTransfer({
    ...base,
    priceBundle: { kind: "result", index: 1 },
    inputB: { kind: "result", index: 2 },
    minAFromSwap: 1_010n,
    minLpOut: 1_111n
  })(zapInBTx);
  assert.deepEqual(zapInBTx.calls[0], {
    target: "0xBROWN::router::zap_in_b_with_bundle_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "1010" },
      { kind: "u64", value: "1111" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const zapOutATx = createTransactionRecorder();
  zapOutAWithBundleAndTransfer({
    ...base,
    lpIn: "0xLP",
    minOut: 1_212n
  })(zapOutATx);
  assert.deepEqual(zapOutATx.calls[0], {
    target: "0xBROWN::router::zap_out_a_with_bundle_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xLP" },
      { kind: "u64", value: "1212" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const zapOutBTx = createTransactionRecorder();
  zapOutBWithBundleAndTransfer({
    ...base,
    priceBundle: { kind: "result", index: 1 },
    lpIn: { kind: "result", index: 2 },
    minOut: 1_313n
  })(zapOutBTx);
  assert.deepEqual(zapOutBTx.calls[0], {
    target: "0xBROWN::router::zap_out_b_with_bundle_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "1313" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });
});

test("direct zap-out builders target router functions with Move argument order", () => {
  const tx = createTransactionRecorder();
  zapOutA({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPIOA",
    priceInfoObjectB: "0xPIOB",
    clock: "0x6",
    pool: "0xPOOLAB",
    lpIn: "0xLP",
    minOut: 1_212n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::zap_out_a",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPIOA" },
      { kind: "object", id: "0xPIOB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xLP" },
      { kind: "u64", value: "1212" }
    ]
  });

  const tx2 = createTransactionRecorder();
  zapOutB({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPIOA",
    priceInfoObjectB: "0xPIOB",
    clock: "0x6",
    pool: "0xPOOLAB",
    lpIn: { kind: "result", index: 2 },
    minOut: 1_313n
  })(tx2);

  assert.deepEqual(tx2.calls[0], {
    target: "0xBROWN::router::zap_out_b",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPIOA" },
      { kind: "object", id: "0xPIOB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "1313" }
    ]
  });
});

test("direct zap transfer builders target recipient-aware router entrypoints", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    oracle: "0xORACLE",
    priceInfoObjectA: "0xPIOA",
    priceInfoObjectB: "0xPIOB",
    clock: "0x6",
    pool: "0xPOOLAB",
    recipient: "0xRECIPIENT"
  };

  const zapInATx = createTransactionRecorder();
  zapInAAndTransfer({
    ...base,
    inputA: "0xCOINA",
    minBFromSwap: 808n,
    minLpOut: 909n
  })(zapInATx);
  assert.deepEqual(zapInATx.calls[0], {
    target: "0xBROWN::router::zap_in_a_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPIOA" },
      { kind: "object", id: "0xPIOB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xCOINA" },
      { kind: "u64", value: "808" },
      { kind: "u64", value: "909" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const zapInBTx = createTransactionRecorder();
  zapInBAndTransfer({
    ...base,
    inputB: { kind: "result", index: 2 },
    minAFromSwap: 1_010n,
    minLpOut: 1_111n
  })(zapInBTx);
  assert.deepEqual(zapInBTx.calls[0], {
    target: "0xBROWN::router::zap_in_b_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPIOA" },
      { kind: "object", id: "0xPIOB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "1010" },
      { kind: "u64", value: "1111" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const zapOutATx = createTransactionRecorder();
  zapOutAAndTransfer({
    ...base,
    lpIn: "0xLP",
    minOut: 1_212n
  })(zapOutATx);
  assert.deepEqual(zapOutATx.calls[0], {
    target: "0xBROWN::router::zap_out_a_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPIOA" },
      { kind: "object", id: "0xPIOB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xLP" },
      { kind: "u64", value: "1212" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });

  const zapOutBTx = createTransactionRecorder();
  zapOutBAndTransfer({
    ...base,
    lpIn: { kind: "result", index: 3 },
    minOut: 1_313n
  })(zapOutBTx);
  assert.deepEqual(zapOutBTx.calls[0], {
    target: "0xBROWN::router::zap_out_b_and_transfer",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xORACLE" },
      { kind: "object", id: "0xPIOA" },
      { kind: "object", id: "0xPIOB" },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 3 },
      { kind: "u64", value: "1313" },
      { kind: "address", value: "0xRECIPIENT" }
    ]
  });
});

test("flash coin borrow builders target flash functions with Move argument order", () => {
  const cases = [
    ["borrow_a_with_coin", borrowAWithCoin, 1000n],
    ["borrow_b_with_coin", borrowBWithCoin, 2000n]
  ];

  for (const [functionName, build, amount] of cases) {
    const tx = createTransactionRecorder();
    const result = build({
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      priceBundle: { kind: "result", index: 0 },
      clock: "0x6",
      pool: "0xPOOLAB",
      amount
    })(tx);

    assert.deepEqual(result, { kind: "result", index: 0 });
    assert.deepEqual(tx.calls[0], {
      target: `0xBROWN::flash::${functionName}`,
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "object", id: "0xPOOLAB" },
        { kind: "result", index: 0 },
        { kind: "object", id: "0x6" },
        { kind: "u64", value: String(amount) }
      ]
    });
  }
});

test("flash borrow result helpers expose borrowed coin and receipt for same-PTB repay", () => {
  const cases = [
    ["borrow_a_with_coin", borrowAWithCoinResults, "repay_a_with_coin", repayAWithCoin],
    ["borrow_b_with_coin", borrowBWithCoinResults, "repay_b_with_coin", repayBWithCoin]
  ];

  for (const [borrowFunction, borrow, repayFunction, repay] of cases) {
    const tx = createTransactionRecorder();
    const flash = borrow({
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      priceBundle: { kind: "result", index: 7 },
      clock: "0x6",
      pool: "0xPOOLAB",
      amount: 1000n
    })(tx);

    repay({
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      priceBundle: { kind: "result", index: 8 },
      clock: "0x6",
      pool: "0xPOOLAB",
      repayment: flash.borrowed,
      receipt: flash.receipt
    })(tx);

    assert.deepEqual(flash.result, { kind: "result", index: 0 });
    assert.deepEqual(flash.borrowed, { kind: "nested-result", index: 0, resultIndex: 0 });
    assert.deepEqual(flash.receipt, { kind: "nested-result", index: 0, resultIndex: 1 });
    assert.deepEqual(tx.calls.map((call) => call.target), [
      `0xBROWN::flash::${borrowFunction}`,
      `0xBROWN::flash::${repayFunction}`
    ]);
    assert.deepEqual(tx.calls[1].arguments, [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 8 },
      { kind: "object", id: "0x6" },
      { kind: "nested-result", index: 0, resultIndex: 0 },
      { kind: "nested-result", index: 0, resultIndex: 1 }
    ]);
  }
});

test("flash fee helpers merge a caller-supplied fee coin before same-PTB repay", () => {
  const cases = [
    ["borrow_a_with_coin", borrowAWithCoinResults, "repay_a_with_coin", repayAWithBorrowedCoinAndFee],
    ["borrow_b_with_coin", borrowBWithCoinResults, "repay_b_with_coin", repayBWithBorrowedCoinAndFee]
  ];

  for (const [borrowFunction, borrow, repayFunction, repay] of cases) {
    const tx = createTransactionRecorder();
    const flash = borrow({
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      priceBundle: { kind: "result", index: 7 },
      clock: "0x6",
      pool: "0xPOOLAB",
      amount: 1000n
    })(tx);
    const feeCoin = { kind: "object", id: "0xFEE" };

    repay({
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      priceBundle: { kind: "result", index: 8 },
      clock: "0x6",
      pool: "0xPOOLAB",
      borrowed: flash.borrowed,
      feeCoin,
      receipt: flash.receipt
    })(tx);

    assert.deepEqual(tx.merges, [
      {
        coin: { kind: "nested-result", index: 0, resultIndex: 0 },
        sources: [feeCoin]
      }
    ]);
    assert.deepEqual(tx.calls.map((call) => call.target), [
      `0xBROWN::flash::${borrowFunction}`,
      `0xBROWN::flash::${repayFunction}`
    ]);
    assert.deepEqual(tx.calls[1].arguments, [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "result", index: 8 },
      { kind: "object", id: "0x6" },
      { kind: "nested-result", index: 0, resultIndex: 0 },
      { kind: "nested-result", index: 0, resultIndex: 1 }
    ]);
  }
});

test("flash coin repay builders target flash functions with Move argument order", () => {
  const cases = [
    ["repay_a_with_coin", repayAWithCoin, "0xCOINA"],
    ["repay_b_with_coin", repayBWithCoin, { kind: "result", index: 2 }]
  ];

  for (const [functionName, build, repayment] of cases) {
    const tx = createTransactionRecorder();
    const receipt = { kind: "result", index: 1 };
    const result = build({
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      priceBundle: { kind: "result", index: 0 },
      clock: "0x6",
      pool: "0xPOOLAB",
      repayment,
      receipt
    })(tx);

    assert.deepEqual(result, { kind: "result", index: 0 });
    assert.deepEqual(tx.calls[0], {
      target: `0xBROWN::flash::${functionName}`,
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "object", id: "0xPOOLAB" },
        { kind: "result", index: 0 },
        { kind: "object", id: "0x6" },
        typeof repayment === "string" ? { kind: "object", id: repayment } : repayment,
        receipt
      ]
    });
  }
});

test("setPoolFlashEnabled targets the admin pool gate with Move argument order", () => {
  const tx = createTransactionRecorder();
  setPoolFlashEnabled({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pool: "0xPOOLAB",
    pauseCap: "0xPAUSE",
    enabled: true
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::admin::set_pool_flash_enabled",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPAUSE" },
      { kind: "bool", value: true }
    ]
  });
});

test("Pyth oracle admin builders target admin functions with Move argument order", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pool: "0xPOOLAB",
    oracleCap: "0xORACLECAP"
  };

  const pythWeightTx = createTransactionRecorder();
  setPoolPythWeight({ ...base, newWeight: 100_000_000 })(pythWeightTx);
  assert.deepEqual(pythWeightTx.calls[0], {
    target: "0xBROWN::admin::set_pool_pyth_weight",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xORACLECAP" },
      { kind: "u32", value: "100000000" }
    ]
  });

  const maxAgeTx = createTransactionRecorder();
  setPoolOracleMaxPriceAge({ ...base, newAge: 15n })(maxAgeTx);
  assert.deepEqual(maxAgeTx.calls[0], {
    target: "0xBROWN::admin::set_pool_oracle_max_price_age",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xORACLECAP" },
      { kind: "u64", value: "15" }
    ]
  });

  const quorumTx = createTransactionRecorder();
  setPoolOracleQuorum({
    ...base,
    minSources: 1,
    requiredSourceMask: 1n,
    allowedSourceMask: 1n
  })(quorumTx);
  assert.deepEqual(quorumTx.calls[0], {
    target: "0xBROWN::admin::set_pool_oracle_quorum",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xORACLECAP" },
      { kind: "u8", value: "1" },
      { kind: "u64", value: "1" },
      { kind: "u64", value: "1" }
    ]
  });

  const aggregationTx = createTransactionRecorder();
  setPoolOracleAggregationPolicy({
    ...base,
    primarySource: 0,
    maxPairTimeDeltaMs: 1000n,
    maxConfidence: 0n,
    maxDeviation: 0n,
    mode: 0
  })(aggregationTx);
  assert.deepEqual(aggregationTx.calls[0], {
    target: "0xBROWN::admin::set_pool_oracle_aggregation_policy",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xORACLECAP" },
      { kind: "u8", value: "0" },
      { kind: "u64", value: "1000" },
      { kind: "u64", value: "0" },
      { kind: "u64", value: "0" },
      { kind: "u8", value: "0" }
    ]
  });

  const sourcesTx = createTransactionRecorder();
  setPoolOracleSources({
    ...base,
    sourceTypeA: "pyth",
    sourceTypeB: "pyth",
    sourceIdA: "0xAAAA",
    sourceIdB: "0xBBBB",
    configDataA: PYTH_FEED_A,
    configDataB: PYTH_FEED_B
  })(sourcesTx);
  assert.deepEqual(sourcesTx.calls[0], {
    target: "0xBROWN::admin::set_pool_oracle_sources",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xORACLECAP" },
      { kind: "pure-vector", type: "u8", values: [112, 121, 116, 104] },
      { kind: "pure-vector", type: "u8", values: [112, 121, 116, 104] },
      { kind: "id", value: "0xAAAA" },
      { kind: "id", value: "0xBBBB" },
      { kind: "pure-vector", type: "u8", values: Array(32).fill(1) },
      { kind: "pure-vector", type: "u8", values: Array(32).fill(2) }
    ]
  });
});

test("pool risk and gate admin builders target admin functions with Move argument order", () => {
  const base = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pool: "0xPOOLAB"
  };
  const riskBase = { ...base, riskCap: "0xRISK" };

  const feeTx = createTransactionRecorder();
  setPoolFee({ ...riskBase, newFee: 10_000 })(feeTx);
  assert.deepEqual(feeTx.calls[0], {
    target: "0xBROWN::admin::set_pool_fee",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xRISK" },
      { kind: "u32", value: "10000" }
    ]
  });

  const kTx = createTransactionRecorder();
  setPoolK({ ...riskBase, newK: 4_294_967n })(kTx);
  assert.deepEqual(kTx.calls[0], {
    target: "0xBROWN::admin::set_pool_k",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xRISK" },
      { kind: "u64", value: "4294967" }
    ]
  });

  const lambdaTx = createTransactionRecorder();
  setPoolLambda({ ...riskBase, newLambda: 123n })(lambdaTx);
  assert.deepEqual(lambdaTx.calls[0], {
    target: "0xBROWN::admin::set_pool_lambda",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xRISK" },
      { kind: "u64", value: "123" }
    ]
  });

  const kBTx = createTransactionRecorder();
  setPoolKB({ ...riskBase, newK: 456n })(kBTx);
  assert.deepEqual(kBTx.calls[0], {
    target: "0xBROWN::admin::set_pool_k_b",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xRISK" },
      { kind: "u64", value: "456" }
    ]
  });

  const kQTx = createTransactionRecorder();
  setPoolKQ({ ...riskBase, newK: 789n })(kQTx);
  assert.deepEqual(kQTx.calls[0], {
    target: "0xBROWN::admin::set_pool_k_q",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xRISK" },
      { kind: "u64", value: "789" }
    ]
  });

  const feeSplitTx = createTransactionRecorder();
  setPoolFeeSplit({ ...riskBase, newFeeSplit: 7_500_000 })(feeSplitTx);
  assert.deepEqual(feeSplitTx.calls[0], {
    target: "0xBROWN::admin::set_pool_fee_split",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xRISK" },
      { kind: "u32", value: "7500000" }
    ]
  });

  const protocolFeeTx = createTransactionRecorder();
  setPoolProtocolFee({ ...riskBase, newProtocolFee: 8_000_000 })(protocolFeeTx);
  assert.deepEqual(protocolFeeTx.calls[0], {
    target: "0xBROWN::admin::set_pool_protocol_fee",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xRISK" },
      { kind: "u32", value: "8000000" }
    ]
  });

  const gammaTx = createTransactionRecorder();
  setPoolGamma({ ...riskBase, newGamma: 100_000_000 })(gammaTx);
  assert.deepEqual(gammaTx.calls[0], {
    target: "0xBROWN::admin::set_pool_gamma",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xRISK" },
      { kind: "u32", value: "100000000" }
    ]
  });

  const spreadsTx = createTransactionRecorder();
  setPoolSpreads({
    ...riskBase,
    compress: 100,
    sSell: 200,
    sBuy: 300,
    fixS: 400,
    disThreshold: 500,
    sBound: 600
  })(spreadsTx);
  assert.deepEqual(spreadsTx.calls[0], {
    target: "0xBROWN::admin::set_pool_spreads",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xRISK" },
      { kind: "u32", value: "100" },
      { kind: "u32", value: "200" },
      { kind: "u32", value: "300" },
      { kind: "u32", value: "400" },
      { kind: "u32", value: "500" },
      { kind: "u32", value: "600" }
    ]
  });

  const feeToTx = createTransactionRecorder();
  setPoolFeeTo({ ...base, feeCap: "0xFEE", feeTo: "0xFEETO" })(feeToTx);
  assert.deepEqual(feeToTx.calls[0], {
    target: "0xBROWN::admin::set_pool_fee_to",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xFEE" },
      { kind: "address", value: "0xFEETO" }
    ]
  });

  const swapsPausedTx = createTransactionRecorder();
  setPoolSwapsPaused({ ...base, pauseCap: "0xPAUSE", paused: true })(swapsPausedTx);
  assert.deepEqual(swapsPausedTx.calls[0], {
    target: "0xBROWN::admin::set_pool_swaps_paused",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPAUSE" },
      { kind: "bool", value: true }
    ]
  });

  const addLiquidityPausedTx = createTransactionRecorder();
  setPoolAddLiquidityPaused({
    ...base,
    pauseCap: "0xPAUSE",
    paused: false
  })(addLiquidityPausedTx);
  assert.deepEqual(addLiquidityPausedTx.calls[0], {
    target: "0xBROWN::admin::set_pool_add_liquidity_paused",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPAUSE" },
      { kind: "bool", value: false }
    ]
  });

  const routerEnabledTx = createTransactionRecorder();
  setPoolRouterEnabled({
    ...base,
    routerCap: "0xROUTERCAP",
    enabled: true
  })(routerEnabledTx);
  assert.deepEqual(routerEnabledTx.calls[0], {
    target: "0xBROWN::admin::set_pool_router_enabled",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xROUTERCAP" },
      { kind: "bool", value: true }
    ]
  });

  const claimTx = createTransactionRecorder();
  const claimed = claimProtocolLp({
    ...base,
    feeCap: "0xFEE"
  })(claimTx);
  assert.deepEqual(claimed, { kind: "result", index: 0 });
  assert.deepEqual(claimTx.calls[0], {
    target: "0xBROWN::admin::claim_protocol_lp",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xFEE" }
    ]
  });
});

test("AMM and factory admin builders target admin functions with Move argument order", () => {
  const poolBase = {
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    pool: "0xPOOLAB",
    ammCap: "0xAMM"
  };

  const ammPolicyTx = createTransactionRecorder();
  setPoolAmmPolicy({
    ...poolBase,
    enabled: true,
    blendWeight: 50_000_000,
    minSources: 1,
    fallbackMode: 1
  })(ammPolicyTx);
  assert.deepEqual(ammPolicyTx.calls[0], {
    target: "0xBROWN::admin::set_pool_amm_policy",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xAMM" },
      { kind: "bool", value: true },
      { kind: "u32", value: "50000000" },
      { kind: "u8", value: "1" },
      { kind: "u8", value: "1" }
    ]
  });

  const sourcePolicyTx = createTransactionRecorder();
  setPoolAmmSourcePolicy({
    ...poolBase,
    maxOspread: 1_000_000,
    minLiquidityQuote: 1_000_000_000n,
    minWindowSeconds: 60n,
    maxWindowSeconds: 600n,
    allowedSourceMask: 1n,
    sourceCountLimit: 2
  })(sourcePolicyTx);
  assert.deepEqual(sourcePolicyTx.calls[0], {
    target: "0xBROWN::admin::set_pool_amm_source_policy",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xAMM" },
      { kind: "u32", value: "1000000" },
      { kind: "u128", value: "1000000000" },
      { kind: "u64", value: "60" },
      { kind: "u64", value: "600" },
      { kind: "u64", value: "1" },
      { kind: "u8", value: "2" }
    ]
  });

  const sourceIdsTx = createTransactionRecorder();
  setPoolAmmSourceIds({
    ...poolBase,
    allowedSourceIds: ["0xFLOWX1", "0xFLOWX2"]
  })(sourceIdsTx);
  assert.deepEqual(sourceIdsTx.calls[0], {
    target: "0xBROWN::admin::set_pool_amm_source_ids",
    typeArguments: ["0x1::a::A", "0x1::b::B"],
    arguments: [
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xAMM" },
      { kind: "pure-vector", type: "id", values: ["0xFLOWX1", "0xFLOWX2"] }
    ]
  });

  const factoryBase = {
    packageId: "0xBROWN",
    factory: "0xFACTORY",
    adminCap: "0xADMIN"
  };

  const factoryPausedTx = createTransactionRecorder();
  setFactoryPaused({ ...factoryBase, paused: true })(factoryPausedTx);
  assert.deepEqual(factoryPausedTx.calls[0], {
    target: "0xBROWN::admin::set_factory_paused",
    typeArguments: [],
    arguments: [
      { kind: "object", id: "0xFACTORY" },
      { kind: "object", id: "0xADMIN" },
      { kind: "bool", value: true }
    ]
  });

  const factoryFeeToTx = createTransactionRecorder();
  setFactoryFeeTo({ ...factoryBase, feeTo: "0xFEETO" })(factoryFeeToTx);
  assert.deepEqual(factoryFeeToTx.calls[0], {
    target: "0xBROWN::admin::set_factory_fee_to",
    typeArguments: [],
    arguments: [
      { kind: "object", id: "0xFACTORY" },
      { kind: "object", id: "0xADMIN" },
      { kind: "address", value: "0xFEETO" }
    ]
  });

  const factoryOracleTx = createTransactionRecorder();
  setFactoryOracle({ ...factoryBase, oracleId: "0xORACLE" })(factoryOracleTx);
  assert.deepEqual(factoryOracleTx.calls[0], {
    target: "0xBROWN::admin::set_factory_oracle",
    typeArguments: [],
    arguments: [
      { kind: "object", id: "0xFACTORY" },
      { kind: "object", id: "0xADMIN" },
      { kind: "id", value: "0xORACLE" }
    ]
  });

  const factoryMinAgeTx = createTransactionRecorder();
  setFactoryMinPriceAge({ ...factoryBase, age: 15n })(factoryMinAgeTx);
  assert.deepEqual(factoryMinAgeTx.calls[0], {
    target: "0xBROWN::admin::set_factory_min_price_age",
    typeArguments: [],
    arguments: [
      { kind: "object", id: "0xFACTORY" },
      { kind: "object", id: "0xADMIN" },
      { kind: "u64", value: "15" }
    ]
  });
});

test("single-hop bundle quote builders target swap functions with Move argument order", () => {
  const cases = [
    ["quote_a_for_b_with_bundle", quoteAForBWithBundle, "amountIn", 808n],
    ["quote_b_for_a_with_bundle", quoteBForAWithBundle, "amountIn", 909n],
    ["quote_a_for_exact_b_with_bundle", quoteAForExactBWithBundle, "amountOut", 1001n],
    [
      "quote_a_for_exact_b_without_cutoff_with_bundle",
      quoteAForExactBWithoutCutoffWithBundle,
      "amountOut",
      1002n
    ],
    ["quote_b_for_exact_a_with_bundle", quoteBForExactAWithBundle, "amountOut", 1003n],
    [
      "quote_b_for_exact_a_without_cutoff_with_bundle",
      quoteBForExactAWithoutCutoffWithBundle,
      "amountOut",
      1004n
    ]
  ];

  for (const [functionName, build, amountKey, amountValue] of cases) {
    const tx = createTransactionRecorder();
    build({
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      priceBundle: { kind: "result", index: 0 },
      clock: "0x6",
      pool: "0xPOOLAB",
      [amountKey]: amountValue
    })(tx);

    assert.deepEqual(tx.calls[0], {
      target: `0xBROWN::swap::${functionName}`,
      typeArguments: ["0x1::a::A", "0x1::b::B"],
      arguments: [
        { kind: "result", index: 0 },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "u64", value: String(amountValue) }
      ]
    });
  }
});

test("two-hop bundle quote builders target router functions with Move argument order", () => {
  const cases = [
    ["quote_exact_a_for_c_via_b_with_bundles", quoteExactAForCViaBWithBundles, "amountIn", 1101n],
    [
      "quote_exact_a_for_c_via_b_without_cutoff_with_bundles",
      quoteExactAForCViaBWithoutCutoffWithBundles,
      "amountIn",
      1102n
    ],
    ["quote_exact_c_for_a_via_b_with_bundles", quoteExactCForAViaBWithBundles, "amountIn", 1103n],
    [
      "quote_exact_c_for_a_via_b_without_cutoff_with_bundles",
      quoteExactCForAViaBWithoutCutoffWithBundles,
      "amountIn",
      1104n
    ],
    ["quote_a_for_exact_c_via_b_with_bundles", quoteAForExactCViaBWithBundles, "amountOut", 1105n],
    [
      "quote_a_for_exact_c_via_b_without_cutoff_with_bundles",
      quoteAForExactCViaBWithoutCutoffWithBundles,
      "amountOut",
      1106n
    ],
    ["quote_c_for_exact_a_via_b_with_bundles", quoteCForExactAViaBWithBundles, "amountOut", 1107n],
    [
      "quote_c_for_exact_a_via_b_without_cutoff_with_bundles",
      quoteCForExactAViaBWithoutCutoffWithBundles,
      "amountOut",
      1108n
    ]
  ];

  for (const [functionName, build, amountKey, amountValue] of cases) {
    const tx = createTransactionRecorder();
    build({
      packageId: "0xBROWN",
      typeA: "0x1::a::A",
      typeB: "0x1::b::B",
      typeC: "0x1::c::C",
      priceBundleAB: { kind: "result", index: 0 },
      priceBundleBC: { kind: "result", index: 1 },
      clock: "0x6",
      poolAB: "0xPOOLAB",
      poolBC: "0xPOOLBC",
      [amountKey]: amountValue
    })(tx);

    assert.deepEqual(tx.calls[0], {
      target: `0xBROWN::router::${functionName}`,
      typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
      arguments: [
        { kind: "result", index: 0 },
        { kind: "result", index: 1 },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xPOOLBC" },
        { kind: "u64", value: String(amountValue) }
      ]
    });
  }
});

test("swapExactAForCViaBWithBundles builds the typed two-hop exact-input PTB call", () => {
  const tx = createTransactionRecorder();
  const result = swapExactAForCViaBWithBundles({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceBundleAB: { kind: "result", index: 0 },
    priceBundleBC: { kind: "result", index: 1 },
    clock: "0x6",
    poolAB: "0xPOOLAB",
    poolBC: "0xPOOLBC",
    input: { kind: "result", index: 2 },
    minBOut: 111n,
    minCOut: 222n
  })(tx);

  assert.deepEqual(result, { kind: "result", index: 0 });
  assert.equal(tx.calls.length, 1);
  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::swap_exact_a_for_c_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "111" },
      { kind: "u64", value: "222" }
    ]
  });
});

test("swapExactCForAViaBWithBundles builds the reverse typed two-hop exact-input PTB call", () => {
  const tx = createTransactionRecorder();
  swapExactCForAViaBWithBundles({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceBundleAB: { kind: "result", index: 0 },
    priceBundleBC: { kind: "result", index: 1 },
    clock: "0x6",
    poolAB: "0xPOOLAB",
    poolBC: "0xPOOLBC",
    input: "0xCOINC",
    minBOut: 333n,
    minAOut: 444n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::swap_exact_c_for_a_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINC" },
      { kind: "u64", value: "333" },
      { kind: "u64", value: "444" }
    ]
  });
});

test("typed two-hop bundle exact-input transfer builders target recipient-aware router functions", () => {
  const tx = createTransactionRecorder();
  swapExactAForCViaBWithBundlesAndTransfer({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceBundleAB: { kind: "result", index: 0 },
    priceBundleBC: { kind: "result", index: 1 },
    clock: "0x6",
    poolAB: "0xPOOLAB",
    poolBC: "0xPOOLBC",
    input: { kind: "result", index: 2 },
    minBOut: 111n,
    minCOut: 222n,
    recipient: "0xRECIPIENT"
  })(tx);

  swapExactCForAViaBWithBundlesAndTransfer({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceBundleAB: { kind: "result", index: 3 },
    priceBundleBC: { kind: "result", index: 4 },
    clock: "0x6",
    poolAB: "0xPOOLAB",
    poolBC: "0xPOOLBC",
    input: "0xCOINC",
    minBOut: 333n,
    minAOut: 444n,
    recipient: "0xRECIPIENT"
  })(tx);

  assert.deepEqual(tx.calls, [
    {
      target: "0xBROWN::router::swap_exact_a_for_c_via_b_with_bundles_and_transfer",
      typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
      arguments: [
        { kind: "result", index: 0 },
        { kind: "result", index: 1 },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xPOOLBC" },
        { kind: "result", index: 2 },
        { kind: "u64", value: "111" },
        { kind: "u64", value: "222" },
        { kind: "address", value: "0xRECIPIENT" }
      ]
    },
    {
      target: "0xBROWN::router::swap_exact_c_for_a_via_b_with_bundles_and_transfer",
      typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
      arguments: [
        { kind: "result", index: 3 },
        { kind: "result", index: 4 },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xPOOLBC" },
        { kind: "object", id: "0xCOINC" },
        { kind: "u64", value: "333" },
        { kind: "u64", value: "444" },
        { kind: "address", value: "0xRECIPIENT" }
      ]
    }
  ]);
});

test("swapAForExactCViaBWithBundles builds the typed two-hop exact-output PTB call", () => {
  const tx = createTransactionRecorder();
  swapAForExactCViaBWithBundles({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceBundleAB: { kind: "result", index: 0 },
    priceBundleBC: { kind: "result", index: 1 },
    clock: "0x6",
    poolAB: "0xPOOLAB",
    poolBC: "0xPOOLBC",
    input: { kind: "result", index: 2 },
    amountOut: 555n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::swap_a_for_exact_c_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "result", index: 2 },
      { kind: "u64", value: "555" }
    ]
  });
});

test("swapCForExactAViaBWithBundles builds the reverse typed two-hop exact-output PTB call", () => {
  const tx = createTransactionRecorder();
  swapCForExactAViaBWithBundles({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceBundleAB: { kind: "result", index: 0 },
    priceBundleBC: { kind: "result", index: 1 },
    clock: "0x6",
    poolAB: "0xPOOLAB",
    poolBC: "0xPOOLBC",
    input: "0xCOINC",
    amountOut: 666n
  })(tx);

  assert.deepEqual(tx.calls[0], {
    target: "0xBROWN::router::swap_c_for_exact_a_via_b_with_bundles",
    typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
    arguments: [
      { kind: "result", index: 0 },
      { kind: "result", index: 1 },
      { kind: "object", id: "0x6" },
      { kind: "object", id: "0xPOOLAB" },
      { kind: "object", id: "0xPOOLBC" },
      { kind: "object", id: "0xCOINC" },
      { kind: "u64", value: "666" }
    ]
  });
});

test("typed two-hop bundle exact-output transfer builders target recipient-aware router functions", () => {
  const tx = createTransactionRecorder();
  swapAForExactCViaBWithBundlesAndTransfer({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceBundleAB: { kind: "result", index: 0 },
    priceBundleBC: { kind: "result", index: 1 },
    clock: "0x6",
    poolAB: "0xPOOLAB",
    poolBC: "0xPOOLBC",
    input: { kind: "result", index: 2 },
    amountOut: 555n,
    recipient: "0xRECIPIENT"
  })(tx);

  swapCForExactAViaBWithBundlesAndTransfer({
    packageId: "0xBROWN",
    typeA: "0x1::a::A",
    typeB: "0x1::b::B",
    typeC: "0x1::c::C",
    priceBundleAB: { kind: "result", index: 3 },
    priceBundleBC: { kind: "result", index: 4 },
    clock: "0x6",
    poolAB: "0xPOOLAB",
    poolBC: "0xPOOLBC",
    input: "0xCOINC",
    amountOut: 666n,
    recipient: "0xRECIPIENT"
  })(tx);

  assert.deepEqual(tx.calls, [
    {
      target: "0xBROWN::router::swap_a_for_exact_c_via_b_with_bundles_and_transfer",
      typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
      arguments: [
        { kind: "result", index: 0 },
        { kind: "result", index: 1 },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xPOOLBC" },
        { kind: "result", index: 2 },
        { kind: "u64", value: "555" },
        { kind: "address", value: "0xRECIPIENT" }
      ]
    },
    {
      target: "0xBROWN::router::swap_c_for_exact_a_via_b_with_bundles_and_transfer",
      typeArguments: ["0x1::a::A", "0x1::b::B", "0x1::c::C"],
      arguments: [
        { kind: "result", index: 3 },
        { kind: "result", index: 4 },
        { kind: "object", id: "0x6" },
        { kind: "object", id: "0xPOOLAB" },
        { kind: "object", id: "0xPOOLBC" },
        { kind: "object", id: "0xCOINC" },
        { kind: "u64", value: "666" },
        { kind: "address", value: "0xRECIPIENT" }
      ]
    }
  ]);
});
