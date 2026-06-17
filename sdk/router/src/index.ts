export type U64Input = number | bigint | string;
export type U32Input = number | bigint | string;
export type U8Input = number | bigint | string;
export type U128Input = number | bigint | string;
export type SupraPairIdInput = number | bigint;
export type TransactionArgument = object;
export type TransactionResult = TransactionArgument & readonly TransactionArgument[];
export type SuiAmountInput = U64Input | TransactionArgument;
export type BytesInput = Uint8Array | readonly number[];
export type ObjectInput = string | TransactionArgument;

export interface MoveCall {
  target: string;
  typeArguments: string[];
  arguments: TransactionArgument[];
}

export interface MakeMoveVec {
  type?: string;
  elements: TransactionArgument[];
}

export interface TransactionLike {
  gas?: TransactionArgument;
  object(id: string): TransactionArgument;
  pure: {
    bool?(value: boolean): TransactionArgument;
    u8?(value: U8Input): TransactionArgument;
    u32?(value: U32Input): TransactionArgument;
    u64(value: U64Input): TransactionArgument;
    u128?(value: U128Input): TransactionArgument;
    id?(value: string): TransactionArgument;
    address?(value: string): TransactionArgument;
    vector?(type: string, values: readonly unknown[]): TransactionArgument;
  };
  moveCall(call: MoveCall): TransactionArgument;
  splitCoins?(coin: TransactionArgument, amounts: TransactionArgument[]): TransactionArgument[];
  mergeCoins?(coin: TransactionArgument, sources: TransactionArgument[]): void;
  transferObjects?(objects: TransactionArgument[], recipient: TransactionArgument): void;
  makeMoveVec(vector: MakeMoveVec): TransactionArgument;
}

export type TransactionThunk = (tx: TransactionLike) => TransactionArgument;
export type SuiTransactionBlockBytes = string | Uint8Array;

export interface SuiTransactionBuilderLike {
  build(options: { client: unknown }): Promise<SuiTransactionBlockBytes>;
}

export type SuiTransactionBlockBuilderLike = TransactionLike & SuiTransactionBuilderLike;
export interface SuiDryRunTransactionBlockClient<TDryRunResult = unknown> {
  dryRunTransactionBlock(input: {
    transactionBlock: SuiTransactionBlockBytes;
  }): Promise<TDryRunResult>;
}

export interface DryRunBuiltTransactionBlockOptions<TDryRunResult = unknown> {
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
  transactionBlock: SuiTransactionBlockBytes;
}

export interface BuildAndDryRunTransactionBlockOptions<TDryRunResult = unknown> {
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
  tx: SuiTransactionBuilderLike;
}

export interface SuiDryRunTransactionBlockStatus {
  status: string;
  error?: string;
}

export interface AssertDryRunTransactionBlockSucceededOptions {
  context?: string;
}

export interface PreflightBuiltTransactionBlockOptions<TDryRunResult = unknown>
  extends DryRunBuiltTransactionBlockOptions<TDryRunResult>,
    AssertDryRunTransactionBlockSucceededOptions {}

export interface BuildAndPreflightTransactionBlockOptions<TDryRunResult = unknown>
  extends BuildAndDryRunTransactionBlockOptions<TDryRunResult>,
    AssertDryRunTransactionBlockSucceededOptions {}

export interface PairTypesOptions {
  packageId: string;
  typeA: string;
  typeB: string;
}

const U32_MAX = 0xffff_ffffn;

export function encodeSupraPairIdConfig(pairId: SupraPairIdInput): Uint8Array {
  const value = typeof pairId === "bigint" ? pairId : numberToSupraPairId(pairId);
  if (value < 0n || value > U32_MAX) {
    throw new Error("Supra pair ID must be a u32");
  }

  const bytes = new Uint8Array(4);
  let remaining = value;
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number(remaining & 0xffn);
    remaining >>= 8n;
  }
  return bytes;
}

function numberToSupraPairId(pairId: number): bigint {
  if (!Number.isInteger(pairId)) {
    throw new Error("Supra pair ID must be an integer");
  }
  return BigInt(pairId);
}

export type PythSuiNetwork = "mainnet" | "testnet";
export type PythSuiContractSet = "upgraded" | "current";
export type StorkRestNetwork = "mainnet" | "devnet";
export type SupraPullRestNetwork = "mainnet" | "testnet";

export const PYTH_HERMES_UPGRADED_ENDPOINT = "https://pyth.dourolabs.app/hermes";
export const PYTH_HERMES_PUBLIC_ENDPOINT = "https://hermes.pyth.network";
export const PYTH_HERMES_BETA_ENDPOINT = "https://hermes-beta.pyth.network";

const SUPRA_PULL_REST_ENDPOINTS: Record<SupraPullRestNetwork, string> = {
  mainnet: "https://rpc-mainnet-dora-2.supra.com",
  testnet: "https://rpc-testnet-dora-2.supra.com"
};

const STORK_REST_ENDPOINTS: Record<StorkRestNetwork, string> = {
  mainnet: "https://rest.jp.stork-oracle.network",
  devnet: "https://rest.dev.stork-oracle.network"
};

export interface PythSuiContractConfig {
  network: PythSuiNetwork;
  contractSet: PythSuiContractSet;
  pythStateId: string;
  pythPackageId: string;
  wormholeStateId: string;
  wormholePackageId: string;
}

export interface PythHermesConnectionOptions {
  endpoint?: string;
  apiKey?: string;
  requireApiKey?: boolean;
}

export interface PythHermesConnectionConfig {
  endpoint: string;
  options: {
    accessToken?: string;
    priceFeedRequestConfig: {
      binary: true;
    };
  };
}

export type SuiPriceServiceConnectionConstructor<TConnection> = new (
  endpoint: string,
  options: PythHermesConnectionConfig["options"]
) => TConnection;

export type SuiPythClientConstructor<TPythClient, TSuiClient> = new (
  suiClient: TSuiClient,
  pythStateId: string,
  wormholeStateId: string
) => TPythClient;

export interface CreatePythSuiClientsOptions<TConnection, TPythClient, TSuiClient>
  extends PythHermesConnectionOptions {
  SuiPriceServiceConnection: SuiPriceServiceConnectionConstructor<TConnection>;
  SuiPythClient: SuiPythClientConstructor<TPythClient, TSuiClient>;
  suiClient: TSuiClient;
  network: PythSuiNetwork;
  contractSet?: PythSuiContractSet;
}

export interface PythSuiClients<TConnection, TPythClient> {
  priceFeedConnection: TConnection;
  pythClient: TPythClient;
  contractConfig: PythSuiContractConfig;
}

const PYTH_SUI_CONTRACT_CONFIGS: Record<
  PythSuiNetwork,
  Record<PythSuiContractSet, PythSuiContractConfig>
> = {
  mainnet: {
    current: {
      network: "mainnet",
      contractSet: "current",
      pythStateId: "0x1f9310238ee9298fb703c3419030b35b22bb1cc37113e3bb5007c99aec79e5b8",
      pythPackageId: "0x04e20ddf36af412a4096f9014f4a565af9e812db9a05cc40254846cf6ed0ad91",
      wormholeStateId: "0xaeab97f96cf9877fee2883315d459552b2b921edc16d7ceac6eab944dd88919c",
      wormholePackageId: "0x5306f64e312b581766351c07af79c72fcb1cd25147157fdc2f8ad76de9a3fb6a"
    },
    upgraded: {
      network: "mainnet",
      contractSet: "upgraded",
      pythStateId: "0x03719fae774ddab3cfcaa53bbc046f0cbe21410019b6280811bf3f9f4b05839d",
      pythPackageId: "0x55300367a2d40813727ccac4ecee977a39fb9cdb46f2e6b2c354b9798f5de2c0",
      wormholeStateId: "0xdbca52b9fb4f712e25f61f974586d93ac541bcf8389564f0323bb07215168b5c",
      wormholePackageId: "0x99de5c967d8206ef4b75c0afab3df2a59eb02b05c282821db803831008ac25b4"
    }
  },
  testnet: {
    current: {
      network: "testnet",
      contractSet: "current",
      pythStateId: "0x243759059f4c3111179da5878c12f68d612c21a8d54d85edc86164bb18be1c7c",
      pythPackageId: "0xabf837e98c26087cba0883c0a7a28326b1fa3c5e1e2c5abdb486f9e8f594c837",
      wormholeStateId: "0x31358d198147da50db32eda2562951d53973a0c0ad5ed738e9b17d88b213d790",
      wormholePackageId: "0xf47329f4344f3bf0f8e436e2f7b485466cff300f12a166563995d3888c296a94"
    },
    upgraded: {
      network: "testnet",
      contractSet: "upgraded",
      pythStateId: "0x3c48fe392912de6c18087a2b3f5fdbfbfdb4598e180947feff1f12f8e9ea073e",
      pythPackageId: "0xd1ac23e1582080e2e5d43dbad1cf463ea2337cdbbb1a9ca669e470cefb74d8fd",
      wormholeStateId: "0x750da8e6d16b6a363a39fe2eaa8295ac224a1e6fce4e47b58845e2e8746164f0",
      wormholePackageId: "0xe79f4e3e02ce132f40f39e73220493a802329d3cb6ad7f789e98a78910fc0053"
    }
  }
};

export interface PythPriceFeedUpdater {
  updatePriceFeeds(
    tx: unknown,
    priceFeedUpdates: unknown[],
    feedIds: string[]
  ): Promise<readonly string[]>;
}

export interface PythPriceFeedUpdateFetcher {
  getPriceFeedsUpdateData(feedIds: string[]): Promise<readonly unknown[]>;
}

export interface PythTotalUpdateFeeOptions {
  pythPackageId: string;
  pythState: ObjectInput;
  numUpdates: U64Input;
}

export interface RoutePriceHopOptions extends PairTypesOptions {
  pool: ObjectInput;
  oracleSourceCount?: number;
  updatePayloadByteLength?: number;
}

export interface RoutePriceHopWithFeedsOptions extends RoutePriceHopOptions {
  feedIds: readonly string[];
}

export interface RoutePriceHopWithAmmReadingsOptions extends RoutePriceHopOptions {
  ammReadings?: readonly ObjectInput[];
}

export interface BuildRoutePriceBundlesOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  clock: ObjectInput;
  hops: readonly THop[];
}

export interface RoutePriceProvider<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  id: string;
  buildPriceBundles(
    tx: TransactionLike,
    options: BuildRoutePriceBundlesOptions<THop>
  ): Promise<readonly TransactionArgument[]>;
}

export interface RoutePriceProviderRegistry<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providers: ReadonlyMap<string, RoutePriceProvider<THop>>;
}

export interface ReadPythPriceOptions extends PairTypesOptions {
  priceInfoObject: ObjectInput;
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface FetchAndBuildUpdatedPythPriceBundleFromFeedsOptions extends PairTypesOptions {
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
  feedIds: readonly string[];
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface FetchAndUpdatePythPriceInfoObjectsFromFeedsOptions {
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
  feedIds: readonly string[];
}

export interface FetchAndBuildUpdatedPythPriceBundleFromFeedsAndAmmReadingsOptions
  extends FetchAndBuildUpdatedPythPriceBundleFromFeedsOptions {
  ammReadings: readonly ObjectInput[];
}

export interface PythRouteHopSourceOptions {
  pool: ObjectInput;
  feedIds: readonly string[];
  ammReadings?: readonly ObjectInput[];
}

export interface PythRoutePriceHopOptions
  extends RoutePriceHopWithFeedsOptions,
    PythRouteHopSourceOptions {}

export interface BuildPythRoutePriceBundlesOptions
  extends BuildRoutePriceBundlesOptions<PythRoutePriceHopOptions> {
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
}

export interface CreatePythRoutePriceProviderOptions {
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
}

export type SwitchboardQuoteUpdateFetcher<
  TSwitchboardClient,
  TQuoteUpdateOptions = unknown
> = (
  switchboardClient: TSwitchboardClient,
  feedIds: string[],
  tx: TransactionLike,
  quoteUpdateOptions?: TQuoteUpdateOptions
) => Promise<TransactionArgument>;

export type SwitchboardSuiClientConstructor<TSwitchboardClient, TSuiClient> = new (
  suiClient: TSuiClient
) => TSwitchboardClient;

export interface CreateSwitchboardSuiClientOptions<TSwitchboardClient, TSuiClient> {
  SwitchboardClient: SwitchboardSuiClientConstructor<TSwitchboardClient, TSuiClient>;
  suiClient: TSuiClient;
}

export interface CreateSwitchboardSuiRoutePriceProviderOptions<
  TSwitchboardClient,
  TSuiClient,
  TQuoteUpdateOptions = unknown
> extends CreateSwitchboardSuiClientOptions<TSwitchboardClient, TSuiClient> {
  fetchQuoteUpdate: SwitchboardQuoteUpdateFetcher<
    TSwitchboardClient,
    TQuoteUpdateOptions
  >;
  quoteUpdateOptions?: TQuoteUpdateOptions;
}

export interface SwitchboardRouteHopSourceOptions {
  quoteVerifier: ObjectInput;
  pool: ObjectInput;
  feedIds: readonly string[];
  ammReadings?: readonly ObjectInput[];
}

export interface SwitchboardRoutePriceHopOptions
  extends RoutePriceHopWithFeedsOptions,
    SwitchboardRouteHopSourceOptions {}

export interface ReadSwitchboardPriceOptions extends PairTypesOptions {
  quoteVerifier: ObjectInput;
  quotes: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface BuildSwitchboardRoutePriceBundlesOptions<
  TSwitchboardClient,
  TQuoteUpdateOptions = unknown
>
  extends BuildRoutePriceBundlesOptions<SwitchboardRoutePriceHopOptions> {
  switchboardClient: TSwitchboardClient;
  fetchQuoteUpdate: SwitchboardQuoteUpdateFetcher<
    TSwitchboardClient,
    TQuoteUpdateOptions
  >;
  quoteUpdateOptions?: TQuoteUpdateOptions;
}

export interface CreateSwitchboardRoutePriceProviderOptions<
  TSwitchboardClient,
  TQuoteUpdateOptions = unknown
> {
  switchboardClient: TSwitchboardClient;
  fetchQuoteUpdate: SwitchboardQuoteUpdateFetcher<
    TSwitchboardClient,
    TQuoteUpdateOptions
  >;
  quoteUpdateOptions?: TQuoteUpdateOptions;
}

export type StorkPriceFeedUpdater<TStorkClient> = (
  storkClient: TStorkClient,
  feedIds: string[],
  tx: TransactionLike
) => Promise<void>;

export interface StorkRouteHopSourceOptions {
  storkState: ObjectInput;
  pool: ObjectInput;
  feedIds: readonly string[];
  ammReadings?: readonly ObjectInput[];
}

export interface StorkRoutePriceHopOptions
  extends RoutePriceHopWithFeedsOptions,
    StorkRouteHopSourceOptions {}

export interface SupraPushRouteHopSourceOptions {
  supraHolder: ObjectInput;
  pool: ObjectInput;
  ammReadings?: readonly ObjectInput[];
}

export interface SupraPushRoutePriceHopOptions
  extends RoutePriceHopOptions,
    SupraPushRouteHopSourceOptions {}

export interface SupraPullRouteHopSourceOptions {
  dkgState: ObjectInput;
  supraHolder: ObjectInput;
  merkleRootHash: ObjectInput;
  proofBytes: BytesInput;
  pool: ObjectInput;
  ammReadings?: readonly ObjectInput[];
}

export interface SupraPullRoutePriceHopOptions
  extends RoutePriceHopOptions,
    SupraPullRouteHopSourceOptions {}

export interface SupraPullProofPayload {
  pairIndexes: readonly number[];
  dkgState: ObjectInput;
  supraHolder: ObjectInput;
  merkleRootHash: ObjectInput;
  proofBytes: Uint8Array;
}

export interface SupraPullRestProofResponse {
  pair_indexes: readonly SupraPairIdInput[];
  dkg_object: string;
  oracle_holder_object: string;
  merkle_root_object: string;
  proof_bytes: string | BytesInput;
}

export type SupraPullProofFetcher = (
  pairIndexes: readonly SupraPairIdInput[]
) => Promise<SupraPullProofPayload>;

export interface SupraPullRestFetchResponse {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json(): Promise<unknown>;
}

export type SupraPullRestFetch = (
  url: string,
  init: {
    method: "POST";
    headers: Record<string, string>;
    body: string;
  }
) => Promise<SupraPullRestFetchResponse>;

export interface CreateSupraPullRestProofFetcherOptions {
  endpoint?: string;
  network?: SupraPullRestNetwork;
  fetch?: SupraPullRestFetch;
}

export interface SupraPullRestRouteHopSourceOptions {
  pool: ObjectInput;
  pairIndexes: readonly SupraPairIdInput[];
  ammReadings?: readonly ObjectInput[];
}

export interface SupraPullRestRoutePriceHopOptions
  extends RoutePriceHopOptions,
    SupraPullRestRouteHopSourceOptions {}

export interface FlowXDirectAmmRouteHopSourceOptions {
  flowxPool: ObjectInput;
  sourceMask: U64Input;
  twapWindowSeconds: U64Input;
  twalWindowSeconds: U64Input;
  validForMs: U64Input;
}

export interface FlowXDirectAmmRouteHopOptions {
  flowxDirectAmm?: readonly FlowXDirectAmmRouteHopSourceOptions[];
}

export type RoutePriceHopWithFlowXDirectAmmOptions<
  THop extends RoutePriceHopWithAmmReadingsOptions = RoutePriceHopWithAmmReadingsOptions
> = THop & FlowXDirectAmmRouteHopOptions;

export interface FlowXTwoHopAmmRouteHopSourceOptions {
  typeI: string;
  baseIntermediatePool: ObjectInput;
  intermediateQuotePool: ObjectInput;
  sourceMask: U64Input;
  intermediateDecimals: U8Input;
  twapWindowSeconds: U64Input;
  twalWindowSeconds: U64Input;
  validForMs: U64Input;
}

export interface FlowXTwoHopAmmRouteHopOptions {
  flowxTwoHopAmm?: readonly FlowXTwoHopAmmRouteHopSourceOptions[];
}

export type RoutePriceHopWithFlowXTwoHopAmmOptions<
  THop extends RoutePriceHopWithAmmReadingsOptions = RoutePriceHopWithAmmReadingsOptions
> = THop & FlowXTwoHopAmmRouteHopOptions;

export interface AmmReadingRouteBuildContext<
  THop extends RoutePriceHopWithAmmReadingsOptions
> {
  clock: ObjectInput;
  hop: THop;
  hopIndex: number;
}

export type AmmReadingRouteBuilder<
  THop extends RoutePriceHopWithAmmReadingsOptions
> = (
  tx: TransactionLike,
  context: AmmReadingRouteBuildContext<THop>
) => ObjectInput | readonly ObjectInput[] | Promise<ObjectInput | readonly ObjectInput[]>;

export interface ReadStorkPriceOptions extends PairTypesOptions {
  storkState: ObjectInput;
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface StorkUpdateFeeOptions {
  storkPackageId: string;
  storkState: ObjectInput;
}

export interface StorkTotalUpdateFeeOptions extends StorkUpdateFeeOptions {
  numUpdates: U64Input;
}

export interface UpdateStorkTemporalNumericValueEvmOptions extends StorkUpdateFeeOptions {
  updateData: ObjectInput;
  fee: ObjectInput;
}

export interface SplitSuiFromGasOptions {
  amount: SuiAmountInput;
}

export interface UpdateStorkTemporalNumericValueEvmWithGasFeeOptions
  extends StorkUpdateFeeOptions {
  updateData: ObjectInput;
  feeAmountInMist: SuiAmountInput;
}

export interface StorkTemporalNumericValueEvmInputFields {
  id: BytesInput;
  temporalNumericValueTimestampNs: U64Input;
  temporalNumericValueMagnitude: U128Input;
  temporalNumericValueNegative: boolean;
  publisherMerkleRoot: BytesInput;
  valueComputeAlgHash: BytesInput;
  r: BytesInput;
  s: BytesInput;
  v: U8Input;
}

export interface StorkRestSignedPricePayload {
  encoded_asset_id: string;
  price: U64Input;
  timestamped_signature: {
    timestamp: U64Input;
    signature: {
      r: string;
      s: string;
      v: U8Input;
    };
  };
  publisher_merkle_root: string;
  calculation_alg: {
    checksum: string;
  };
}

export interface BuildStorkTemporalNumericValueEvmInputOptions
  extends StorkTemporalNumericValueEvmInputFields {
  storkPackageId: string;
}

export interface BuildStorkTemporalNumericValueEvmInputVecOptions {
  storkPackageId: string;
  updates: readonly StorkTemporalNumericValueEvmInputFields[];
}

export interface UpdateStorkTemporalNumericValueEvmWithSignedPriceOptions
  extends StorkUpdateFeeOptions {
  signedPrice: StorkRestSignedPricePayload;
}

export interface UpdateStorkTemporalNumericValuesEvmWithSignedPricesOptions
  extends StorkUpdateFeeOptions {
  signedPrices: readonly StorkRestSignedPricePayload[];
}

export type StorkSignedPriceFetcher<TStorkClient> = (
  storkClient: TStorkClient,
  feedIds: string[],
  tx: TransactionLike
) => Promise<readonly StorkRestSignedPricePayload[]>;

export interface StorkRestFetchResponse {
  ok?: boolean;
  status?: number;
  statusText?: string;
  json(): Promise<unknown>;
}

export type StorkRestFetch = (
  url: string,
  init: {
    method: "GET";
    headers: Record<string, string>;
  }
) => Promise<StorkRestFetchResponse>;

export interface CreateStorkSignedPriceUpdaterOptions<TStorkClient>
  extends StorkUpdateFeeOptions {
  fetchSignedPrices: StorkSignedPriceFetcher<TStorkClient>;
}

export interface CreateStorkRestSignedPriceFetcherOptions {
  endpoint?: string;
  network?: StorkRestNetwork;
  apiKey: string;
  fetch?: StorkRestFetch;
}

export interface ReadSupraPushPriceOptions extends PairTypesOptions {
  supraHolder: ObjectInput;
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface ReadSupraPullPriceBundleOptions extends PairTypesOptions {
  dkgState: ObjectInput;
  supraHolder: ObjectInput;
  merkleRootHash: ObjectInput;
  clock: ObjectInput;
  proofBytes: BytesInput;
  pool: ObjectInput;
}

export interface ReadSupraPullPriceBundleWithAmmReadingsOptions
  extends ReadSupraPullPriceBundleOptions {
  ammReadings: readonly ObjectInput[];
}

export interface BuildStorkRoutePriceBundlesOptions<TStorkClient>
  extends BuildRoutePriceBundlesOptions<StorkRoutePriceHopOptions> {
  storkClient: TStorkClient;
  updatePriceFeeds: StorkPriceFeedUpdater<TStorkClient>;
}

export interface BuildSupraPushRoutePriceBundlesOptions
  extends BuildRoutePriceBundlesOptions<SupraPushRoutePriceHopOptions> {}

export interface BuildSupraPullRoutePriceBundlesOptions
  extends BuildRoutePriceBundlesOptions<SupraPullRoutePriceHopOptions> {}

export interface BuildSupraPullRestRoutePriceBundlesOptions
  extends BuildRoutePriceBundlesOptions<SupraPullRestRoutePriceHopOptions> {
  fetchProof: SupraPullProofFetcher;
}

export interface CreateStorkRoutePriceProviderOptions<TStorkClient> {
  storkClient: TStorkClient;
  updatePriceFeeds: StorkPriceFeedUpdater<TStorkClient>;
}

export interface CreateStorkRestRoutePriceProviderOptions
  extends StorkUpdateFeeOptions,
    CreateStorkRestSignedPriceFetcherOptions {}

export interface CreateFlowXDirectAmmRoutePriceProviderOptions<
  THop extends RoutePriceHopWithAmmReadingsOptions
> {
  id?: string;
  routePriceProvider: RoutePriceProvider<THop>;
}

export interface CreateFlowXTwoHopAmmRoutePriceProviderOptions<
  THop extends RoutePriceHopWithAmmReadingsOptions
> {
  id?: string;
  routePriceProvider: RoutePriceProvider<THop>;
}

export interface CreateAmmReadingRoutePriceProviderOptions<
  THop extends RoutePriceHopWithAmmReadingsOptions
> {
  id?: string;
  routePriceProvider: RoutePriceProvider<THop>;
  buildAmmReadings: AmmReadingRouteBuilder<THop>;
}

export interface CreateSupraPullRestRoutePriceProviderOptions {
  fetchProof: SupraPullProofFetcher;
}

export interface CreateStandardRoutePriceProviderRegistryOptions<
  TSwitchboardClient = unknown,
  TStorkClient = unknown
> {
  pyth?: CreatePythRoutePriceProviderOptions;
  switchboard?: CreateSwitchboardRoutePriceProviderOptions<TSwitchboardClient>;
  stork?: CreateStorkRoutePriceProviderOptions<TStorkClient>;
  storkRest?: CreateStorkRestRoutePriceProviderOptions;
  supraPush?: boolean;
  supraPull?: boolean;
  supraPullRest?: CreateSupraPullRestRoutePriceProviderOptions;
  buildAmmReadings?: AmmReadingRouteBuilder<RoutePriceHopWithAmmReadingsOptions>;
  flowxDirectAmm?: boolean;
  flowxTwoHopAmm?: boolean;
}

export interface SwapExactInputWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly THop[];
  input: ObjectInput;
  minOutputs: readonly U64Input[];
}

export interface SwapExactOutputWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly THop[];
  input: ObjectInput;
  amountOut: U64Input;
}

export interface AddLiquidityWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  pair: THop;
  inputA: ObjectInput;
  inputB: ObjectInput;
  minADeposit?: U64Input;
  minBDeposit?: U64Input;
  minLpOut: U64Input;
}

export interface QuoteExactInputWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly THop[];
  amountIn: SuiAmountInput;
}

export interface QuoteExactOutputWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly THop[];
  amountOut: SuiAmountInput;
}

export interface QuoteMaxBoundWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly THop[];
}

export interface RouteQuoteResults {
  quoteResults: readonly TransactionResult[];
  amounts: readonly TransactionArgument[];
}

export interface LaunchValidationCase<TBuildResult = unknown> {
  name: string;
  kind: LaunchValidationQuoteCaseKind;
  providerId: string;
  preflightContext: string;
  build(tx: TransactionLike): Promise<TBuildResult>;
}

export interface LaunchValidationPreflightResult<TDryRunResult = unknown> {
  name: string;
  kind: LaunchValidationQuoteCaseKind;
  providerId: string;
  dryRunResult: TDryRunResult;
}

export interface PreflightLaunchValidationCaseOptions<
  TBuildResult = unknown,
  TDryRunResult = unknown
> {
  validationCase: LaunchValidationCase<TBuildResult>;
  tx: SuiTransactionBlockBuilderLike;
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
}

export type LaunchValidationTransactionFactory = (
  validationCase: LaunchValidationCase,
  index: number
) => SuiTransactionBlockBuilderLike;

export interface PreflightLaunchValidationCasesOptions<TDryRunResult = unknown> {
  cases: readonly LaunchValidationCase[];
  createTransaction: LaunchValidationTransactionFactory;
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
}

export interface CreateExactInputRouteQuoteValidationCaseOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends QuoteExactInputWithRegisteredRouteOptions<THop> {
  name: string;
  preflightContext?: string;
}

export interface CreateExactOutputRouteQuoteValidationCaseOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends QuoteExactOutputWithRegisteredRouteOptions<THop> {
  name: string;
  preflightContext?: string;
}

export interface CreateExactOutputRoundTripRouteQuoteValidationCaseOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends QuoteExactOutputWithRegisteredRouteOptions<THop> {
  name: string;
  preflightContext?: string;
}

export interface CreateMaxBoundRouteQuoteValidationCaseOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends QuoteMaxBoundWithRegisteredRouteOptions<THop> {
  name: string;
  preflightContext?: string;
}

export type LaunchValidationQuoteCaseKind =
  | "exact-input-quote"
  | "exact-input-without-cutoff-quote"
  | "exact-output-quote"
  | "exact-output-round-trip-quote"
  | "exact-output-without-cutoff-quote"
  | "max-bound-quote";

export interface LaunchValidationQuoteBaseCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends AssertDryRunTransactionBlockSucceededOptions {
  name: string;
  kind: LaunchValidationQuoteCaseKind;
  providerId: string;
  preflightContext?: string;
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly THop[];
}

export interface LaunchValidationExactInputQuoteCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends LaunchValidationQuoteBaseCaseConfig<THop> {
  kind: "exact-input-quote" | "exact-input-without-cutoff-quote";
  amountIn: SuiAmountInput;
  amountOut?: never;
}

export interface LaunchValidationExactOutputQuoteCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends LaunchValidationQuoteBaseCaseConfig<THop> {
  kind:
    | "exact-output-quote"
    | "exact-output-round-trip-quote"
    | "exact-output-without-cutoff-quote";
  amountOut: SuiAmountInput;
  amountIn?: never;
}

export interface LaunchValidationMaxBoundQuoteCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends LaunchValidationQuoteBaseCaseConfig<THop> {
  kind: "max-bound-quote";
  amountIn?: never;
  amountOut?: never;
}

export type LaunchValidationQuoteCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> =
  | LaunchValidationExactInputQuoteCaseConfig<THop>
  | LaunchValidationExactOutputQuoteCaseConfig<THop>
  | LaunchValidationMaxBoundQuoteCaseConfig<THop>;

export interface BuildLaunchValidationQuoteCasesOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerRegistry: RoutePriceProviderRegistry<THop>;
  cases: readonly LaunchValidationQuoteCaseConfig<THop>[];
  routeLimits?: LaunchValidationRouteLimits;
}

export interface PreflightLaunchValidationQuoteCasesOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
> extends BuildLaunchValidationQuoteCasesOptions<THop> {
  createTransaction: LaunchValidationTransactionFactory;
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
}

export interface SwapExactOutputWithRegisteredRouteResults {
  quoteResults: readonly TransactionResult[];
  swapResults: readonly TransactionResult[];
  changeCoins: readonly TransactionArgument[];
  output: TransactionArgument;
}

export interface PreflightSwapRouteResult<TDryRunResult = unknown> {
  swapResult: TransactionArgument;
  dryRunResult: TDryRunResult;
}

export interface PreflightSwapExactOutputRouteResults<TDryRunResult = unknown>
  extends SwapExactOutputWithRegisteredRouteResults {
  dryRunResult: TDryRunResult;
}

export interface PreflightSwapExactInputWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
> extends SwapExactInputWithRegisteredRouteOptions<THop>,
    AssertDryRunTransactionBlockSucceededOptions {
  tx: SuiTransactionBlockBuilderLike;
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
}

export interface PreflightSwapExactOutputWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
> extends SwapExactOutputWithRegisteredRouteOptions<THop>,
    AssertDryRunTransactionBlockSucceededOptions {
  tx: SuiTransactionBlockBuilderLike;
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
}

export interface PreflightAddLiquidityWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
> extends AddLiquidityWithRegisteredRouteOptions<THop>,
    AssertDryRunTransactionBlockSucceededOptions {
  tx: SuiTransactionBlockBuilderLike;
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
}

export interface RemoveLiquidityWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  pair: THop;
  lpIn: ObjectInput;
  minAOut: U64Input;
  minBOut: U64Input;
}

export interface PreflightRemoveLiquidityWithRegisteredRouteOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
> extends RemoveLiquidityWithRegisteredRouteOptions<THop>,
    AssertDryRunTransactionBlockSucceededOptions {
  tx: SuiTransactionBlockBuilderLike;
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
}

export type RegisteredRoutePreflightCaseKind =
  | "exact-input"
  | "exact-output"
  | "exact-output-results"
  | "add-liquidity"
  | "remove-liquidity"
  | "zap-in-a"
  | "zap-in-b"
  | "zap-out-a"
  | "zap-out-b"
  | "flash-borrow-a"
  | "flash-borrow-b";

export interface RegisteredRoutePreflightBaseCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends AssertDryRunTransactionBlockSucceededOptions {
  name: string;
  kind: RegisteredRoutePreflightCaseKind;
  providerId: string;
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly THop[];
  recipient?: string;
}

export interface RegisteredRoutePreflightInputCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RegisteredRoutePreflightBaseCaseConfig<THop> {
  input: ObjectInput;
}

export interface RegisteredRoutePreflightExactInputCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RegisteredRoutePreflightInputCaseConfig<THop> {
  kind: "exact-input";
  minOutputs: readonly U64Input[];
  amountOut?: never;
}

export interface RegisteredRoutePreflightExactOutputCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RegisteredRoutePreflightInputCaseConfig<THop> {
  kind: "exact-output" | "exact-output-results";
  amountOut: U64Input;
  minOutputs?: never;
}

export interface RegisteredRoutePreflightAddLiquidityCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RegisteredRoutePreflightInputCaseConfig<THop> {
  kind: "add-liquidity";
  inputB: ObjectInput;
  minADeposit?: U64Input;
  minBDeposit?: U64Input;
  minLpOut: U64Input;
  amountOut?: never;
  minOutputs?: never;
}

export interface RegisteredRoutePreflightRemoveLiquidityCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RegisteredRoutePreflightInputCaseConfig<THop> {
  kind: "remove-liquidity";
  minAOut: U64Input;
  minBOut: U64Input;
  amountOut?: never;
  inputB?: never;
  minLpOut?: never;
  minOutputs?: never;
}

export interface RegisteredRoutePreflightZapInACaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RegisteredRoutePreflightInputCaseConfig<THop> {
  kind: "zap-in-a";
  minBFromSwap: U64Input;
  minLpOut: U64Input;
  amount?: never;
  amountOut?: never;
  feeCoin?: never;
  inputB?: never;
  minAFromSwap?: never;
  minAOut?: never;
  minBOut?: never;
  minOut?: never;
  minOutputs?: never;
}

export interface RegisteredRoutePreflightZapInBCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RegisteredRoutePreflightInputCaseConfig<THop> {
  kind: "zap-in-b";
  minAFromSwap: U64Input;
  minLpOut: U64Input;
  amount?: never;
  amountOut?: never;
  feeCoin?: never;
  inputB?: never;
  minAOut?: never;
  minBFromSwap?: never;
  minBOut?: never;
  minOut?: never;
  minOutputs?: never;
}

export interface RegisteredRoutePreflightZapOutCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RegisteredRoutePreflightInputCaseConfig<THop> {
  kind: "zap-out-a" | "zap-out-b";
  minOut: U64Input;
  amount?: never;
  amountOut?: never;
  feeCoin?: never;
  inputB?: never;
  minAFromSwap?: never;
  minAOut?: never;
  minBFromSwap?: never;
  minBOut?: never;
  minLpOut?: never;
  minOutputs?: never;
}

export interface RegisteredRoutePreflightFlashBorrowCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RegisteredRoutePreflightBaseCaseConfig<THop> {
  kind: "flash-borrow-a" | "flash-borrow-b";
  amount: U64Input;
  feeCoin: ObjectInput;
  amountOut?: never;
  input?: never;
  inputB?: never;
  minAOut?: never;
  minBOut?: never;
  minLpOut?: never;
  minOutputs?: never;
}

export type RegisteredRoutePreflightCaseConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> =
  | RegisteredRoutePreflightExactInputCaseConfig<THop>
  | RegisteredRoutePreflightExactOutputCaseConfig<THop>
  | RegisteredRoutePreflightAddLiquidityCaseConfig<THop>
  | RegisteredRoutePreflightRemoveLiquidityCaseConfig<THop>
  | RegisteredRoutePreflightZapInACaseConfig<THop>
  | RegisteredRoutePreflightZapInBCaseConfig<THop>
  | RegisteredRoutePreflightZapOutCaseConfig<THop>
  | RegisteredRoutePreflightFlashBorrowCaseConfig<THop>;

export type RegisteredRoutePreflightTransactionFactory<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> = (
  routeCase: RegisteredRoutePreflightCaseConfig<THop>,
  index: number
) => SuiTransactionBlockBuilderLike;

export interface BuildRegisteredRoutePreflightCasesOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerRegistry: RoutePriceProviderRegistry<THop>;
  txFactory: RegisteredRoutePreflightTransactionFactory<THop>;
  cases: readonly RegisteredRoutePreflightCaseConfig<THop>[];
  routeLimits?: LaunchValidationRouteLimits;
}

export interface PreflightRegisteredExactInputRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends SwapExactInputWithRegisteredRouteOptions<THop>,
    AssertDryRunTransactionBlockSucceededOptions {
  name: string;
  kind: "exact-input";
  tx: SuiTransactionBlockBuilderLike;
  recipient?: string;
}

export interface PreflightRegisteredExactOutputRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends SwapExactOutputWithRegisteredRouteOptions<THop>,
    AssertDryRunTransactionBlockSucceededOptions {
  name: string;
  kind: "exact-output";
  tx: SuiTransactionBlockBuilderLike;
  recipient?: string;
}

export interface PreflightRegisteredExactOutputRouteResultsCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends SwapExactOutputWithRegisteredRouteOptions<THop>,
    AssertDryRunTransactionBlockSucceededOptions {
  name: string;
  kind: "exact-output-results";
  tx: SuiTransactionBlockBuilderLike;
  recipient?: string;
}

export interface PreflightRegisteredAddLiquidityRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends AddLiquidityWithRegisteredRouteOptions<THop>,
    AssertDryRunTransactionBlockSucceededOptions {
  name: string;
  kind: "add-liquidity";
  tx: SuiTransactionBlockBuilderLike;
  recipient?: string;
}

export interface PreflightRegisteredRemoveLiquidityRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends RemoveLiquidityWithRegisteredRouteOptions<THop>,
    AssertDryRunTransactionBlockSucceededOptions {
  name: string;
  kind: "remove-liquidity";
  tx: SuiTransactionBlockBuilderLike;
  providerId: string;
  recipient?: string;
}

export interface RegisteredZapInARouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  name: string;
  kind: "zap-in-a";
  tx: TransactionLike;
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  pair: THop;
  inputA: ObjectInput;
  minBFromSwap: U64Input;
  minLpOut: U64Input;
}

export interface RegisteredZapInBRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  name: string;
  kind: "zap-in-b";
  tx: TransactionLike;
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  pair: THop;
  inputB: ObjectInput;
  minAFromSwap: U64Input;
  minLpOut: U64Input;
}

export interface RegisteredZapOutRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  name: string;
  kind: "zap-out-a" | "zap-out-b";
  tx: TransactionLike;
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  pair: THop;
  lpIn: ObjectInput;
  minOut: U64Input;
}

export type RegisteredZapRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> =
  | RegisteredZapInARouteCase<THop>
  | RegisteredZapInBRouteCase<THop>
  | RegisteredZapOutRouteCase<THop>;

export interface PreflightRegisteredZapInARouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends Omit<RegisteredZapInARouteCase<THop>, "tx">,
    AssertDryRunTransactionBlockSucceededOptions {
  tx: SuiTransactionBlockBuilderLike;
  recipient?: string;
}

export interface PreflightRegisteredZapInBRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends Omit<RegisteredZapInBRouteCase<THop>, "tx">,
    AssertDryRunTransactionBlockSucceededOptions {
  tx: SuiTransactionBlockBuilderLike;
  recipient?: string;
}

export interface PreflightRegisteredZapOutRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends Omit<RegisteredZapOutRouteCase<THop>, "tx">,
    AssertDryRunTransactionBlockSucceededOptions {
  tx: SuiTransactionBlockBuilderLike;
  recipient?: string;
}

export type PreflightRegisteredZapRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> =
  | PreflightRegisteredZapInARouteCase<THop>
  | PreflightRegisteredZapInBRouteCase<THop>
  | PreflightRegisteredZapOutRouteCase<THop>;

export interface RegisteredFlashBorrowRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  name: string;
  kind: "flash-borrow-a" | "flash-borrow-b";
  tx: TransactionLike;
  providerRegistry: RoutePriceProviderRegistry<THop>;
  providerId: string;
  clock: ObjectInput;
  pair: THop;
  amount: U64Input;
  feeCoin: ObjectInput;
}

export interface PreflightRegisteredFlashBorrowRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> extends Omit<RegisteredFlashBorrowRouteCase<THop>, "tx">,
    AssertDryRunTransactionBlockSucceededOptions {
  tx: SuiTransactionBlockBuilderLike;
  recipient?: string;
}

export type PreflightRegisteredRouteCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> =
  | PreflightRegisteredExactInputRouteCase<THop>
  | PreflightRegisteredExactOutputRouteCase<THop>
  | PreflightRegisteredExactOutputRouteResultsCase<THop>
  | PreflightRegisteredAddLiquidityRouteCase<THop>
  | PreflightRegisteredRemoveLiquidityRouteCase<THop>
  | PreflightRegisteredZapRouteCase<THop>
  | PreflightRegisteredFlashBorrowRouteCase<THop>;

export interface PreflightRegisteredRouteCasesOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
> {
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
  cases: readonly PreflightRegisteredRouteCase<THop>[];
  transferRecipient?: string;
}

export interface BuildRegisteredRouteCaseTransactionsOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  cases: readonly PreflightRegisteredRouteCase<THop>[];
}

export interface RegisteredRouteCaseSwapTransactionResult {
  name: string;
  kind: "exact-input" | "exact-output";
  providerId: string;
  swapResult: TransactionArgument;
}

export interface RegisteredRouteCaseLiquidityTransactionResult {
  name: string;
  kind: "add-liquidity" | "remove-liquidity";
  providerId: string;
  liquidityResult: TransactionArgument;
}

export interface RegisteredRouteCaseZapTransactionResult {
  name: string;
  kind: "zap-in-a" | "zap-in-b" | "zap-out-a" | "zap-out-b";
  providerId: string;
  zapResult: TransactionArgument;
}

export interface RegisteredRouteCaseFlashBorrowTransactionResult {
  name: string;
  kind: "flash-borrow-a" | "flash-borrow-b";
  providerId: string;
  flashResult: FlashBorrowWithCoinResults;
  repayResult: TransactionArgument;
}

export interface RegisteredRouteCaseExactOutputResultsTransactionResult
  extends SwapExactOutputWithRegisteredRouteResults {
  name: string;
  kind: "exact-output-results";
  providerId: string;
}

export type RegisteredRouteCaseTransactionResult =
  | RegisteredRouteCaseSwapTransactionResult
  | RegisteredRouteCaseLiquidityTransactionResult
  | RegisteredRouteCaseZapTransactionResult
  | RegisteredRouteCaseExactOutputResultsTransactionResult
  | RegisteredRouteCaseFlashBorrowTransactionResult;

export interface PreflightRegisteredRouteCaseSwapResult<TDryRunResult = unknown>
  extends PreflightSwapRouteResult<TDryRunResult> {
  name: string;
  kind: "exact-input" | "exact-output";
  providerId: string;
}

export interface PreflightLiquidityRouteResult<TDryRunResult = unknown> {
  liquidityResult: TransactionArgument;
  dryRunResult: TDryRunResult;
}

export interface PreflightRegisteredRouteCaseLiquidityResult<TDryRunResult = unknown>
  extends PreflightLiquidityRouteResult<TDryRunResult> {
  name: string;
  kind: "add-liquidity" | "remove-liquidity";
  providerId: string;
}

export interface PreflightZapRouteResult<TDryRunResult = unknown> {
  zapResult: TransactionArgument;
  dryRunResult: TDryRunResult;
}

export interface PreflightRegisteredRouteCaseZapResult<TDryRunResult = unknown>
  extends PreflightZapRouteResult<TDryRunResult> {
  name: string;
  kind: "zap-in-a" | "zap-in-b" | "zap-out-a" | "zap-out-b";
  providerId: string;
}

export interface PreflightFlashBorrowRouteResult<TDryRunResult = unknown> {
  flashResult: FlashBorrowWithCoinResults;
  repayResult: TransactionArgument;
  dryRunResult: TDryRunResult;
}

export interface PreflightRegisteredRouteCaseFlashBorrowResult<
  TDryRunResult = unknown
> extends PreflightFlashBorrowRouteResult<TDryRunResult> {
  name: string;
  kind: "flash-borrow-a" | "flash-borrow-b";
  providerId: string;
}

export interface PreflightRegisteredRouteCaseExactOutputResults<
  TDryRunResult = unknown
> extends PreflightSwapExactOutputRouteResults<TDryRunResult> {
  name: string;
  kind: "exact-output-results";
  providerId: string;
}

export type PreflightRegisteredRouteCaseResult<TDryRunResult = unknown> =
  | PreflightRegisteredRouteCaseSwapResult<TDryRunResult>
  | PreflightRegisteredRouteCaseExactOutputResults<TDryRunResult>
  | PreflightRegisteredRouteCaseLiquidityResult<TDryRunResult>
  | PreflightRegisteredRouteCaseZapResult<TDryRunResult>
  | PreflightRegisteredRouteCaseFlashBorrowResult<TDryRunResult>;

export interface BuildLaunchValidationMatrixOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerRegistry: RoutePriceProviderRegistry<THop>;
  routeTransactionFactory?: RegisteredRoutePreflightTransactionFactory<THop>;
  routeCases?: readonly RegisteredRoutePreflightCaseConfig<THop>[];
  quoteCases?: readonly LaunchValidationQuoteCaseConfig<THop>[];
  routeLimits?: LaunchValidationRouteLimits;
}

export interface LaunchValidationMatrix<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  routeCases: readonly PreflightRegisteredRouteCase<THop>[];
  quoteCases: readonly LaunchValidationCase<RouteQuoteResults>[];
}

export interface PreflightLaunchValidationMatrixOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
> extends BuildLaunchValidationMatrixOptions<THop> {
  quoteTransactionFactory?: LaunchValidationTransactionFactory;
  suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
  transferRecipient?: string;
}

export interface LaunchValidationMatrixPreflightResult<TDryRunResult = unknown> {
  routeResults: readonly PreflightRegisteredRouteCaseResult<TDryRunResult>[];
  quoteResults: readonly LaunchValidationPreflightResult<TDryRunResult>[];
}

export interface LaunchValidationRouteCaseSummary {
  name: string;
  kind: RegisteredRoutePreflightCaseKind;
  providerId: string;
}

export interface LaunchValidationQuoteCaseSummary {
  name: string;
  kind: LaunchValidationQuoteCaseKind;
  providerId: string;
}

export interface LaunchValidationMatrixPreflightSummary {
  routeCaseCount: number;
  quoteCaseCount: number;
  totalCaseCount: number;
  providerIds: readonly string[];
  routeCases: readonly LaunchValidationRouteCaseSummary[];
  quoteCases: readonly LaunchValidationQuoteCaseSummary[];
}

export interface LaunchValidationMatrixPreflightReport<
  TDryRunResult = unknown
> {
  preflightResult: LaunchValidationMatrixPreflightResult<TDryRunResult>;
  summary: LaunchValidationMatrixPreflightSummary;
}

export interface LaunchValidationRouteLimits {
  maxHops?: number;
  maxOracleSourcesPerHop?: number;
  maxAmmSourcesPerHop?: number;
  maxUpdatePayloadBytes?: number;
}

export interface ValidateLaunchValidationMatrixConfigOptions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
> {
  providerIds: readonly string[];
  ammProviderIds?: readonly string[];
  routeCases?: readonly RegisteredRoutePreflightCaseConfig<THop>[];
  quoteCases?: readonly LaunchValidationQuoteCaseConfig<THop>[];
  routeLimits?: LaunchValidationRouteLimits;
  requireProviderMetadata?: boolean;
}

export interface PythRouteProviderOptions {
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
}

export interface SwapExactInputWithPythRouteOptions extends PythRouteProviderOptions {
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly PythRoutePriceHopOptions[];
  input: ObjectInput;
  minOutputs: readonly U64Input[];
}

export interface SwapExactOutputWithPythRouteOptions extends PythRouteProviderOptions {
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly PythRoutePriceHopOptions[];
  input: ObjectInput;
  amountOut: U64Input;
}

export interface AddLiquidityWithPythRouteOptions
  extends Omit<
      AddLiquidityWithRegisteredRouteOptions<PythRoutePriceHopOptions>,
      "providerRegistry" | "providerId"
    >,
    PythRouteProviderOptions {}

export type RemoveLiquidityWithPythRouteOptions =
  RemoveLiquidityWithRegisteredRouteOptions<PythRoutePriceHopOptions>;

export interface QuoteExactInputWithPythRouteOptions extends PythRouteProviderOptions {
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly PythRoutePriceHopOptions[];
  amountIn: SuiAmountInput;
}

export interface QuoteExactOutputWithPythRouteOptions extends PythRouteProviderOptions {
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly PythRoutePriceHopOptions[];
  amountOut: SuiAmountInput;
}

export interface QuoteMaxBoundWithPythRouteOptions extends PythRouteProviderOptions {
  clock: ObjectInput;
  path: readonly string[];
  pairs: readonly PythRoutePriceHopOptions[];
}

export interface ZapWithPythRouteBaseOptions extends PythRouteProviderOptions {
  name?: string;
  clock: ObjectInput;
  pair: PythRoutePriceHopOptions;
}

export interface ZapInAWithPythRouteOptions extends ZapWithPythRouteBaseOptions {
  kind: "zap-in-a";
  inputA: ObjectInput;
  minBFromSwap: U64Input;
  minLpOut: U64Input;
}

export interface ZapInBWithPythRouteOptions extends ZapWithPythRouteBaseOptions {
  kind: "zap-in-b";
  inputB: ObjectInput;
  minAFromSwap: U64Input;
  minLpOut: U64Input;
}

export interface ZapOutWithPythRouteOptions extends ZapWithPythRouteBaseOptions {
  kind: "zap-out-a" | "zap-out-b";
  lpIn: ObjectInput;
  minOut: U64Input;
}

export type ZapWithPythRouteOptions =
  | ZapInAWithPythRouteOptions
  | ZapInBWithPythRouteOptions
  | ZapOutWithPythRouteOptions;

export interface FlashBorrowWithPythRouteOptions extends PythRouteProviderOptions {
  name?: string;
  kind: "flash-borrow-a" | "flash-borrow-b";
  clock: ObjectInput;
  pair: PythRoutePriceHopOptions;
  amount: U64Input;
  feeCoin: ObjectInput;
}

export interface SwapExactAForBWithPythRouteOptions
  extends PairTypesOptions,
    PythRouteHopSourceOptions {
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
  clock: ObjectInput;
  input: ObjectInput;
  minOut: U64Input;
}

export type SwapExactBForAWithPythRouteOptions = SwapExactAForBWithPythRouteOptions;

export interface SwapAForExactBWithPythRouteOptions
  extends PairTypesOptions,
    PythRouteHopSourceOptions {
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
  clock: ObjectInput;
  input: ObjectInput;
  amountOut: U64Input;
}

export type SwapBForExactAWithPythRouteOptions = SwapAForExactBWithPythRouteOptions;

export interface SwapExactAForCViaBWithPythRouteOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
  clock: ObjectInput;
  hopAB: PythRouteHopSourceOptions;
  hopBC: PythRouteHopSourceOptions;
  input: ObjectInput;
  minBOut: U64Input;
  minCOut: U64Input;
}

export interface SwapAForExactCViaBWithPythRouteOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
  clock: ObjectInput;
  hopAB: PythRouteHopSourceOptions;
  hopBC: PythRouteHopSourceOptions;
  input: ObjectInput;
  amountOut: U64Input;
}

export interface SwapExactCForAViaBWithPythRouteOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
  clock: ObjectInput;
  hopAB: PythRouteHopSourceOptions;
  hopBC: PythRouteHopSourceOptions;
  input: ObjectInput;
  minBOut: U64Input;
  minAOut: U64Input;
}

export interface SwapCForExactAViaBWithPythRouteOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceFeedConnection: PythPriceFeedUpdateFetcher;
  pythClient: PythPriceFeedUpdater;
  clock: ObjectInput;
  hopAB: PythRouteHopSourceOptions;
  hopBC: PythRouteHopSourceOptions;
  input: ObjectInput;
  amountOut: U64Input;
}

export interface DirectOraclePairOptions extends PairTypesOptions {
  oracle: ObjectInput;
  priceInfoObjectA: ObjectInput;
  priceInfoObjectB: ObjectInput;
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface CreatePoolWithCoinsOptions extends PairTypesOptions {
  factory: ObjectInput;
  poolCreatorCap: ObjectInput;
  oracle: ObjectInput;
  priceInfoObjectA: ObjectInput;
  priceInfoObjectB: ObjectInput;
  clock: ObjectInput;
  initA: ObjectInput;
  initB: ObjectInput;
  tokenADecimals: U8Input;
  tokenBDecimals: U8Input;
}

export interface SingleHopDirectExactInputOptions extends DirectOraclePairOptions {
  input: ObjectInput;
  minOut: U64Input;
}

export interface SingleHopDirectExactInputTransferOptions
  extends SingleHopDirectExactInputOptions {
  recipient: string;
}

export interface SingleHopDirectExactOutputOptions extends DirectOraclePairOptions {
  input: ObjectInput;
  amountOut: U64Input;
}

export interface SingleHopDirectExactOutputTransferOptions
  extends SingleHopDirectExactOutputOptions {
  recipient: string;
}

export interface AddLiquidityWithCoinsOptions extends DirectOraclePairOptions {
  inputA: ObjectInput;
  inputB: ObjectInput;
  minLpOut: U64Input;
}

export interface AddLiquidityWithCoinsWithMinDepositsOptions
  extends AddLiquidityWithCoinsOptions {
  minADeposit: U64Input;
  minBDeposit: U64Input;
}

export interface AddLiquidityWithCoinsTransferOptions extends AddLiquidityWithCoinsOptions {
  recipient: string;
}

export interface ZapInAOptions extends DirectOraclePairOptions {
  inputA: ObjectInput;
  minBFromSwap: U64Input;
  minLpOut: U64Input;
}

export interface ZapInATransferOptions extends ZapInAOptions {
  recipient: string;
}

export interface ZapInBOptions extends DirectOraclePairOptions {
  inputB: ObjectInput;
  minAFromSwap: U64Input;
  minLpOut: U64Input;
}

export interface ZapInBTransferOptions extends ZapInBOptions {
  recipient: string;
}

export interface ZapOutOptions extends DirectOraclePairOptions {
  lpIn: ObjectInput;
  minOut: U64Input;
}

export interface ZapOutTransferOptions extends ZapOutOptions {
  recipient: string;
}

export interface SingleHopDirectQuoteExactInputOptions extends DirectOraclePairOptions {
  amountIn: U64Input;
}

export interface SingleHopDirectQuoteExactOutputOptions extends DirectOraclePairOptions {
  amountOut: U64Input;
}

export interface SingleHopDirectQuoteMaxOptions extends DirectOraclePairOptions {}

export interface DirectOracleRouteOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  oracle: ObjectInput;
  priceInfoObjectA: ObjectInput;
  priceInfoObjectB: ObjectInput;
  priceInfoObjectC: ObjectInput;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolBC: ObjectInput;
  input: ObjectInput;
}

export interface SwapExactAForCViaBOptions extends DirectOracleRouteOptions {
  minBOut: U64Input;
  minCOut: U64Input;
}

export interface SwapExactAForCViaBTransferOptions extends SwapExactAForCViaBOptions {
  recipient: string;
}

export interface SwapExactCForAViaBOptions extends DirectOracleRouteOptions {
  minBOut: U64Input;
  minAOut: U64Input;
}

export interface SwapExactCForAViaBTransferOptions extends SwapExactCForAViaBOptions {
  recipient: string;
}

export interface SwapAForExactCViaBOptions extends DirectOracleRouteOptions {
  amountOut: U64Input;
}

export interface SwapAForExactCViaBTransferOptions extends SwapAForExactCViaBOptions {
  recipient: string;
}

export interface SwapCForExactAViaBOptions extends DirectOracleRouteOptions {
  amountOut: U64Input;
}

export interface SwapCForExactAViaBTransferOptions extends SwapCForExactAViaBOptions {
  recipient: string;
}

export interface BuildUpdatedPythPriceBundleFromFeedsOptions extends PairTypesOptions {
  pythClient: PythPriceFeedUpdater;
  priceFeedUpdates: readonly unknown[];
  feedIds: readonly string[];
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface BuildUpdatedPythPriceBundleFromFeedsAndAmmReadingsOptions
  extends BuildUpdatedPythPriceBundleFromFeedsOptions {
  ammReadings: readonly ObjectInput[];
}

export interface GetSwapPriceBundleFromReadingsOptions extends PairTypesOptions {
  readingA: TransactionArgument;
  readingB: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface GetSwapPriceBundleFromReadingPairsAndAmmReadingsOptions extends PairTypesOptions {
  readingsA: readonly ObjectInput[];
  readingsB: readonly ObjectInput[];
  ammReadings: readonly ObjectInput[];
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface GetSwapPriceBundleFromReadingPairsOptions extends PairTypesOptions {
  readingsA: readonly ObjectInput[];
  readingsB: readonly ObjectInput[];
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface ReadFlowXDirectPoolOptions extends PairTypesOptions {
  brownfiPool: ObjectInput;
  flowxPool: ObjectInput;
  clock: ObjectInput;
  sourceMask: U64Input;
  twapWindowSeconds: U64Input;
  twalWindowSeconds: U64Input;
  validForMs: U64Input;
}

export interface ReadFlowXTwoHopPathOptions extends PairTypesOptions {
  typeI: string;
  brownfiPool: ObjectInput;
  baseIntermediatePool: ObjectInput;
  intermediateQuotePool: ObjectInput;
  clock: ObjectInput;
  sourceMask: U64Input;
  intermediateDecimals: U8Input;
  twapWindowSeconds: U64Input;
  twalWindowSeconds: U64Input;
  validForMs: U64Input;
}

export interface SingleHopBundleExactInputOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  input: ObjectInput;
  minOut: U64Input;
}

export interface SingleHopBundleExactInputTransferOptions
  extends SingleHopBundleExactInputOptions {
  recipient: string;
}

export interface SingleHopBundleExactOutputOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  input: ObjectInput;
  amountOut: SuiAmountInput;
}

export interface SingleHopBundleExactOutputTransferOptions
  extends SingleHopBundleExactOutputOptions {
  recipient: string;
}

export interface AddLiquidityWithBundleOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  inputA: ObjectInput;
  inputB: ObjectInput;
  minLpOut: U64Input;
}

export interface AddLiquidityWithBundleWithMinDepositsOptions
  extends AddLiquidityWithBundleOptions {
  minADeposit: U64Input;
  minBDeposit: U64Input;
}

export interface AddLiquidityWithBundleTransferOptions extends AddLiquidityWithBundleOptions {
  recipient: string;
}

export interface AddLiquidityWithBundleTransferWithMinDepositsOptions
  extends AddLiquidityWithBundleWithMinDepositsOptions {
  recipient: string;
}

export interface ZapInAWithBundleOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  inputA: ObjectInput;
  minBFromSwap: U64Input;
  minLpOut: U64Input;
}

export interface ZapInAWithBundleTransferOptions extends ZapInAWithBundleOptions {
  recipient: string;
}

export interface ZapInBWithBundleOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  inputB: ObjectInput;
  minAFromSwap: U64Input;
  minLpOut: U64Input;
}

export interface ZapInBWithBundleTransferOptions extends ZapInBWithBundleOptions {
  recipient: string;
}

export interface ZapOutWithBundleOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  lpIn: ObjectInput;
  minOut: U64Input;
}

export interface ZapOutWithBundleTransferOptions extends ZapOutWithBundleOptions {
  recipient: string;
}

export interface RemoveLiquidityWithCoinsOptions extends PairTypesOptions {
  pool: ObjectInput;
  lpIn: ObjectInput;
  minAOut: U64Input;
  minBOut: U64Input;
}

export interface RemoveLiquidityWithCoinsTransferOptions extends RemoveLiquidityWithCoinsOptions {
  recipient: string;
}

export interface FlashBorrowWithCoinOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  amount: U64Input;
}

export interface FlashRepayWithCoinOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  repayment: ObjectInput;
  receipt: TransactionArgument;
}

export interface FlashRepayBorrowedWithFeeOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  borrowed: TransactionArgument;
  feeCoin: ObjectInput;
  receipt: TransactionArgument;
}

export interface SetPoolFlashEnabledOptions extends PairTypesOptions {
  pool: ObjectInput;
  pauseCap: ObjectInput;
  enabled: boolean;
}

export interface PoolRiskAdminOptions extends PairTypesOptions {
  pool: ObjectInput;
  riskCap: ObjectInput;
}

export interface SetPoolFeeOptions extends PoolRiskAdminOptions {
  newFee: U32Input;
}

export interface SetPoolKOptions extends PoolRiskAdminOptions {
  newK: U64Input;
}

export interface SetPoolLambdaOptions extends PoolRiskAdminOptions {
  newLambda: U64Input;
}

export type SetPoolKBOptions = SetPoolKOptions;
export type SetPoolKQOptions = SetPoolKOptions;

export interface SetPoolFeeSplitOptions extends PoolRiskAdminOptions {
  newFeeSplit: U32Input;
}

export interface SetPoolProtocolFeeOptions extends PoolRiskAdminOptions {
  newProtocolFee: U32Input;
}

export interface SetPoolGammaOptions extends PoolRiskAdminOptions {
  newGamma: U32Input;
}

export interface SetPoolSpreadsOptions extends PoolRiskAdminOptions {
  compress: U32Input;
  sSell: U32Input;
  sBuy: U32Input;
  fixS: U32Input;
  disThreshold: U32Input;
  sBound: U32Input;
}

export interface PoolFeeAdminOptions extends PairTypesOptions {
  pool: ObjectInput;
  feeCap: ObjectInput;
}

export interface SetPoolFeeToOptions extends PoolFeeAdminOptions {
  feeTo: string;
}

export type ClaimProtocolLpOptions = PoolFeeAdminOptions;

export interface PoolPauseAdminOptions extends PairTypesOptions {
  pool: ObjectInput;
  pauseCap: ObjectInput;
}

export interface SetPoolSwapsPausedOptions extends PoolPauseAdminOptions {
  paused: boolean;
}

export interface SetPoolAddLiquidityPausedOptions extends PoolPauseAdminOptions {
  paused: boolean;
}

export interface PoolRouterAdminOptions extends PairTypesOptions {
  pool: ObjectInput;
  routerCap: ObjectInput;
}

export interface SetPoolRouterEnabledOptions extends PoolRouterAdminOptions {
  enabled: boolean;
}

export interface PoolAmmAdminOptions extends PairTypesOptions {
  pool: ObjectInput;
  ammCap: ObjectInput;
}

export interface SetPoolAmmPolicyOptions extends PoolAmmAdminOptions {
  enabled: boolean;
  blendWeight: U32Input;
  minSources: U8Input;
  fallbackMode: U8Input;
}

export interface SetPoolAmmSourcePolicyOptions extends PoolAmmAdminOptions {
  maxOspread: U32Input;
  minLiquidityQuote: U128Input;
  minWindowSeconds: U64Input;
  maxWindowSeconds: U64Input;
  allowedSourceMask: U64Input;
  sourceCountLimit: U8Input;
}

export interface SetPoolAmmSourceIdsOptions extends PoolAmmAdminOptions {
  allowedSourceIds: readonly string[];
}

export interface FactoryAdminOptions {
  packageId: string;
  factory: ObjectInput;
  adminCap: ObjectInput;
}

export interface SetFactoryPausedOptions extends FactoryAdminOptions {
  paused: boolean;
}

export interface SetFactoryFeeToOptions extends FactoryAdminOptions {
  feeTo: string;
}

export interface SetFactoryOracleOptions extends FactoryAdminOptions {
  oracleId: string;
}

export interface SetFactoryMinPriceAgeOptions extends FactoryAdminOptions {
  age: U64Input;
}

export interface PoolOracleAdminOptions extends PairTypesOptions {
  pool: ObjectInput;
  oracleCap: ObjectInput;
}

export interface SetPoolPythWeightOptions extends PoolOracleAdminOptions {
  newWeight: U32Input;
}

export interface SetPoolOracleMaxPriceAgeOptions extends PoolOracleAdminOptions {
  newAge: U64Input;
}

export interface SetPoolOracleQuorumOptions extends PoolOracleAdminOptions {
  minSources: U8Input;
  requiredSourceMask: U64Input;
  allowedSourceMask: U64Input;
}

export interface SetPoolOracleAggregationPolicyOptions extends PoolOracleAdminOptions {
  primarySource: U8Input;
  maxPairTimeDeltaMs: U64Input;
  maxConfidence: U64Input;
  maxDeviation: U64Input;
  mode: U8Input;
}

export interface SetPoolOracleSourcesOptions extends PoolOracleAdminOptions {
  sourceTypeA: string | BytesInput;
  sourceTypeB: string | BytesInput;
  sourceIdA: string;
  sourceIdB: string;
  configDataA: string | BytesInput;
  configDataB: string | BytesInput;
}

export interface FlashBorrowWithCoinResults {
  result: TransactionResult;
  borrowed: TransactionArgument;
  receipt: TransactionArgument;
}

export type FlashBorrowWithCoinResultsThunk = (
  tx: TransactionLike
) => FlashBorrowWithCoinResults;

export interface SingleHopBundleQuoteExactInputOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  amountIn: SuiAmountInput;
}

export interface SingleHopBundleQuoteExactOutputOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
  amountOut: SuiAmountInput;
}

export interface SingleHopBundleQuoteMaxOptions extends PairTypesOptions {
  priceBundle: TransactionArgument;
  clock: ObjectInput;
  pool: ObjectInput;
}

export interface SwapExactAForCViaBWithBundlesOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleAB: TransactionArgument;
  priceBundleBC: TransactionArgument;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolBC: ObjectInput;
  input: ObjectInput;
  minBOut: U64Input;
  minCOut: U64Input;
}

export interface SwapExactAForCViaBWithBundlesAndTransferOptions
  extends SwapExactAForCViaBWithBundlesOptions {
  recipient: string;
}

export interface QuoteExactAForCViaBWithBundlesOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleAB: TransactionArgument;
  priceBundleBC: TransactionArgument;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolBC: ObjectInput;
  amountIn: U64Input;
}

export interface SwapExactCForAViaBWithBundlesOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleAB: TransactionArgument;
  priceBundleBC: TransactionArgument;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolBC: ObjectInput;
  input: ObjectInput;
  minBOut: U64Input;
  minAOut: U64Input;
}

export interface SwapExactCForAViaBWithBundlesAndTransferOptions
  extends SwapExactCForAViaBWithBundlesOptions {
  recipient: string;
}

export interface QuoteExactCForAViaBWithBundlesOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleAB: TransactionArgument;
  priceBundleBC: TransactionArgument;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolBC: ObjectInput;
  amountIn: U64Input;
}

export interface SwapAForExactCViaBWithBundlesOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleAB: TransactionArgument;
  priceBundleBC: TransactionArgument;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolBC: ObjectInput;
  input: ObjectInput;
  amountOut: U64Input;
}

export interface SwapAForExactCViaBWithBundlesAndTransferOptions
  extends SwapAForExactCViaBWithBundlesOptions {
  recipient: string;
}

export interface SwapAForExactCViaBWithReversedSecondBundleOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleAB: TransactionArgument;
  priceBundleCB: TransactionArgument;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolCB: ObjectInput;
  input: ObjectInput;
  amountOut: U64Input;
}

export interface SwapAForExactCViaBWithReversedFirstBundleOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleBA: TransactionArgument;
  priceBundleBC: TransactionArgument;
  clock: ObjectInput;
  poolBA: ObjectInput;
  poolBC: ObjectInput;
  input: ObjectInput;
  amountOut: U64Input;
}

export interface QuoteAForExactCViaBWithBundlesOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleAB: TransactionArgument;
  priceBundleBC: TransactionArgument;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolBC: ObjectInput;
  amountOut: U64Input;
}

export interface SwapCForExactAViaBWithBundlesOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleAB: TransactionArgument;
  priceBundleBC: TransactionArgument;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolBC: ObjectInput;
  input: ObjectInput;
  amountOut: U64Input;
}

export interface SwapCForExactAViaBWithBundlesAndTransferOptions
  extends SwapCForExactAViaBWithBundlesOptions {
  recipient: string;
}

export interface QuoteCForExactAViaBWithBundlesOptions {
  packageId: string;
  typeA: string;
  typeB: string;
  typeC: string;
  priceBundleAB: TransactionArgument;
  priceBundleBC: TransactionArgument;
  clock: ObjectInput;
  poolAB: ObjectInput;
  poolBC: ObjectInput;
  amountOut: U64Input;
}

function routerTarget(packageId: string, functionName: string): string {
  return `${packageId}::router::${functionName}`;
}

function moduleTarget(packageId: string, moduleName: string, functionName: string): string {
  return `${packageId}::${moduleName}::${functionName}`;
}

function brownFiType(packageId: string, moduleName: string, structName: string): string {
  return `${packageId}::${moduleName}::${structName}`;
}

function objectArg(tx: TransactionLike, value: ObjectInput): TransactionArgument {
  return typeof value === "string" ? tx.object(value) : value;
}

function amountArg(tx: TransactionLike, value: SuiAmountInput): TransactionArgument {
  return typeof value === "object" ? value : tx.pure.u64(value);
}

function pureBool(tx: TransactionLike, value: boolean): TransactionArgument {
  if (tx.pure.bool === undefined) {
    throw new Error("Transaction builder must support pure bool values");
  }
  return tx.pure.bool(value);
}

function pureU8(tx: TransactionLike, value: U8Input): TransactionArgument {
  if (tx.pure.u8 === undefined) {
    throw new Error("Transaction builder must support pure u8 values");
  }
  return tx.pure.u8(value);
}

function pureU32(tx: TransactionLike, value: U32Input): TransactionArgument {
  if (tx.pure.u32 === undefined) {
    throw new Error("Transaction builder must support pure u32 values");
  }
  return tx.pure.u32(value);
}

function pureU128(tx: TransactionLike, value: U128Input): TransactionArgument {
  if (tx.pure.u128 === undefined) {
    throw new Error("Transaction builder must support pure u128 values");
  }
  return tx.pure.u128(value);
}

function pureObjectId(tx: TransactionLike, value: string): TransactionArgument {
  if (tx.pure.id !== undefined) {
    return tx.pure.id(value);
  }
  if (tx.pure.address !== undefined) {
    return tx.pure.address(value);
  }
  throw new Error("Transaction builder must support pure object ID values");
}

function pureAddress(tx: TransactionLike, value: string): TransactionArgument {
  if (tx.pure.address !== undefined) {
    return tx.pure.address(value);
  }
  if (tx.pure.id !== undefined) {
    return tx.pure.id(value);
  }
  throw new Error("Transaction builder must support pure address values");
}

function pureVector(
  tx: TransactionLike,
  type: string,
  values: readonly unknown[]
): TransactionArgument {
  if (tx.pure.vector === undefined) {
    throw new Error("Transaction builder must support pure vector values");
  }
  return tx.pure.vector(type, values);
}

function splitGasCoin(tx: TransactionLike, amount: SuiAmountInput): TransactionArgument {
  if (tx.gas === undefined || tx.splitCoins === undefined) {
    throw new Error("Transaction builder must support gas coin splitting");
  }
  const [coin] = tx.splitCoins(tx.gas, [amountArg(tx, amount)]);
  if (coin === undefined) {
    throw new Error("Transaction builder did not return a split SUI coin");
  }
  return coin;
}

function bytesValue(value: BytesInput): number[] {
  return Array.from(value);
}

function asciiOrBytesValue(value: string | BytesInput, fieldName: string): number[] {
  if (typeof value !== "string") {
    return bytesValue(value);
  }
  const bytes: number[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const byte = value.charCodeAt(i);
    if (byte > 255) {
      throw new Error(`${fieldName} must contain only single-byte characters`);
    }
    bytes.push(byte);
  }
  return bytes;
}

function hexOrBytesValue(value: string | BytesInput, fieldName: string): number[] {
  if (typeof value !== "string") {
    return bytesValue(value);
  }

  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (hex.length % 2 !== 0) {
    throw new Error(`${fieldName} must be an even-length hex string`);
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error(`${fieldName} must be a hex string`);
  }

  const bytes: number[] = [];
  for (let i = 0; i < hex.length; i += 2) {
    bytes.push(Number.parseInt(hex.slice(i, i + 2), 16));
  }
  return bytes;
}

function byteArrayValue(value: BytesInput, fieldName: string): Uint8Array {
  if (value instanceof Uint8Array) {
    return new Uint8Array(value);
  }
  const bytes = Array.from(value);
  for (const byte of bytes) {
    if (!Number.isInteger(byte) || byte < 0 || byte > 255) {
      throw new Error(`${fieldName} must contain only u8 byte values`);
    }
  }
  return Uint8Array.from(bytes);
}

function hexBytesValue(value: string, fieldName: string): Uint8Array {
  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (hex.length % 2 !== 0) {
    throw new Error(`Stork ${fieldName} must be an even-length hex string`);
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error(`Stork ${fieldName} must be a hex string`);
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function supraPullProofBytesValue(value: string | BytesInput): Uint8Array {
  if (typeof value !== "string") {
    return byteArrayValue(value, "Supra pull proof bytes");
  }

  const hex = value.startsWith("0x") || value.startsWith("0X") ? value.slice(2) : value;
  if (hex.length % 2 !== 0) {
    throw new Error("Supra pull proof bytes must be an even-length hex string");
  }
  if (!/^[0-9a-fA-F]*$/.test(hex)) {
    throw new Error("Supra pull proof bytes must be a hex string");
  }

  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

function integerBigIntValue(value: U64Input, fieldName: string): bigint {
  if (typeof value === "number") {
    if (!Number.isInteger(value)) {
      throw new Error(`Stork ${fieldName} must be an integer`);
    }
    return BigInt(value);
  }
  return BigInt(value);
}

function storkSignedMagnitude(value: U64Input): {
  magnitude: bigint;
  negative: boolean;
} {
  const parsed = integerBigIntValue(value, "price");
  if (parsed < 0n) {
    return {
      magnitude: -parsed,
      negative: true
    };
  }
  return {
    magnitude: parsed,
    negative: false
  };
}

function storkU8Value(value: U8Input, fieldName: string): number {
  const parsed = integerBigIntValue(value, fieldName);
  if (parsed < 0n || parsed > 255n) {
    throw new Error(`Stork ${fieldName} must be a u8`);
  }
  return Number(parsed);
}

function supraPairIndexValue(value: SupraPairIdInput, fieldName: string): number {
  const parsed = typeof value === "number" ? numberToSupraPairId(value) : value;
  if (parsed < 0n || parsed > U32_MAX) {
    throw new Error(`${fieldName} must contain only u32 pair indexes`);
  }
  return Number(parsed);
}

function supraPairIndexesValue(
  values: readonly SupraPairIdInput[],
  fieldName: string
): number[] {
  if (values.length === 0) {
    throw new Error(`${fieldName} must not be empty`);
  }
  return values.map((value) => supraPairIndexValue(value, fieldName));
}

function sameSupraPairIndexes(
  left: readonly number[],
  right: readonly number[]
): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function requireSupraPullStringField(
  value: unknown,
  fieldName: string
): string {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`Supra pull REST response ${fieldName} must be a non-empty string`);
  }
  return value;
}

function requireRecord(value: unknown, fieldName: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${fieldName} must be an object`);
  }
  return value as Record<string, unknown>;
}

function storkRestEndpoint(options: CreateStorkRestSignedPriceFetcherOptions): string {
  const endpoint = options.endpoint ?? (
    options.network === undefined ? undefined : getStorkRestEndpoint(options.network)
  );
  if (endpoint === undefined || endpoint.length === 0) {
    throw new Error("Stork REST endpoint or network is required");
  }
  return endpoint.replace(/\/+$/, "");
}

function supraPullRestEndpoint(options: CreateSupraPullRestProofFetcherOptions): string {
  const endpoint = options.endpoint ?? (
    options.network === undefined ? undefined : getSupraPullRestEndpoint(options.network)
  );
  if (endpoint === undefined || endpoint.length === 0) {
    throw new Error("Supra pull REST endpoint or network is required");
  }
  return endpoint.replace(/\/+$/, "");
}

function pairTypeArguments(options: { typeA: string; typeB: string }): string[] {
  return [options.typeA, options.typeB];
}

function routeTypeArguments(options: { typeA: string; typeB: string; typeC: string }): string[] {
  return [options.typeA, options.typeB, options.typeC];
}

function objectArgs(tx: TransactionLike, values: readonly ObjectInput[]): TransactionArgument[] {
  return values.map((value) => objectArg(tx, value));
}

function priceReadingType(packageId: string): string {
  return brownFiType(packageId, "oracle_gateway", "PriceReading");
}

function ammReadingType(packageId: string): string {
  return brownFiType(packageId, "oracle_gateway", "AmmReading");
}

function priceReadingVector(
  tx: TransactionLike,
  packageId: string,
  readings: readonly ObjectInput[]
): TransactionArgument {
  return tx.makeMoveVec({
    type: priceReadingType(packageId),
    elements: objectArgs(tx, readings)
  });
}

function ammReadingVector(
  tx: TransactionLike,
  packageId: string,
  readings: readonly ObjectInput[]
): TransactionArgument {
  return tx.makeMoveVec({
    type: ammReadingType(packageId),
    elements: objectArgs(tx, readings)
  });
}

function twoHopBundleArgs(
  tx: TransactionLike,
  options: {
    priceBundleAB: TransactionArgument;
    priceBundleBC: TransactionArgument;
    clock: ObjectInput;
    poolAB: ObjectInput;
    poolBC: ObjectInput;
    input: ObjectInput;
  }
): TransactionArgument[] {
  return [
    options.priceBundleAB,
    options.priceBundleBC,
    objectArg(tx, options.clock),
    objectArg(tx, options.poolAB),
    objectArg(tx, options.poolBC),
    objectArg(tx, options.input)
  ];
}

function singleHopBundleArgs(
  tx: TransactionLike,
  options: {
    priceBundle: TransactionArgument;
    clock: ObjectInput;
    pool: ObjectInput;
  }
): TransactionArgument[] {
  return [options.priceBundle, objectArg(tx, options.clock), objectArg(tx, options.pool)];
}

function transactionResultAt(
  result: TransactionResult,
  index: number,
  fieldName: string
): TransactionArgument {
  const value = result[index];
  if (value === undefined) {
    throw new Error(`Transaction builder did not expose ${fieldName} result`);
  }
  return value;
}

function twoHopQuoteArgs(
  tx: TransactionLike,
  options: {
    priceBundleAB: TransactionArgument;
    priceBundleBC: TransactionArgument;
    clock: ObjectInput;
    poolAB: ObjectInput;
    poolBC: ObjectInput;
  }
): TransactionArgument[] {
  return [
    options.priceBundleAB,
    options.priceBundleBC,
    objectArg(tx, options.clock),
    objectArg(tx, options.poolAB),
    objectArg(tx, options.poolBC)
  ];
}

function directOraclePairArgs(
  tx: TransactionLike,
  options: DirectOraclePairOptions
): TransactionArgument[] {
  return [
    objectArg(tx, options.oracle),
    objectArg(tx, options.priceInfoObjectA),
    objectArg(tx, options.priceInfoObjectB),
    objectArg(tx, options.clock),
    objectArg(tx, options.pool)
  ];
}

function directOracleRouteArgs(
  tx: TransactionLike,
  options: DirectOracleRouteOptions
): TransactionArgument[] {
  return [
    objectArg(tx, options.oracle),
    objectArg(tx, options.priceInfoObjectA),
    objectArg(tx, options.priceInfoObjectB),
    objectArg(tx, options.priceInfoObjectC),
    objectArg(tx, options.clock),
    objectArg(tx, options.poolAB),
    objectArg(tx, options.poolBC),
    objectArg(tx, options.input)
  ];
}

async function updatePythPairAndRead(
  tx: TransactionLike,
  options: BuildUpdatedPythPriceBundleFromFeedsOptions
): Promise<[TransactionArgument, TransactionArgument]> {
  const priceInfoObjectIds = await options.pythClient.updatePriceFeeds(
    tx,
    Array.from(options.priceFeedUpdates),
    Array.from(options.feedIds)
  );
  const readingA = readPythPriceA({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    priceInfoObject: priceInfoObjectIds[0],
    clock: options.clock,
    pool: options.pool
  })(tx);
  const readingB = readPythPriceB({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    priceInfoObject: priceInfoObjectIds[1],
    clock: options.clock,
    pool: options.pool
  })(tx);

  return [readingA, readingB];
}

function pairFeedIds(feedIds: readonly string[]): [string, string] {
  if (feedIds.length !== 2) {
    throw new Error("BrownFi Pyth route hops require exactly two feed IDs");
  }
  return [feedIds[0], feedIds[1]];
}

function uniqueRouteFeedIds(hops: readonly RoutePriceHopWithFeedsOptions[]): string[] {
  const seen = new Set<string>();
  const uniqueFeedIds: string[] = [];
  for (const hop of hops) {
    for (const feedId of pairFeedIds(hop.feedIds)) {
      if (!seen.has(feedId)) {
        seen.add(feedId);
        uniqueFeedIds.push(feedId);
      }
    }
  }
  return uniqueFeedIds;
}

function routeBundleAt(
  priceBundles: readonly TransactionArgument[],
  index: number
): TransactionArgument {
  const priceBundle = priceBundles[index];
  if (priceBundle === undefined) {
    throw new Error("missing route price bundle");
  }
  return priceBundle;
}

type RouteDirection = "a_to_b" | "b_to_a";

interface ResolvedRouteHop<THop extends RoutePriceHopOptions> {
  pair: THop;
  direction: RouteDirection;
}

type ResolvedPythRouteHop = ResolvedRouteHop<PythRoutePriceHopOptions>;

function routeHopCount(path: readonly string[]): number {
  const hopCount = path.length - 1;
  if (hopCount < 1) {
    throw new Error("BrownFi Sui PTB route planner requires at least one hop");
  }
  return hopCount;
}

function resolveRouteHop<THop extends RoutePriceHopOptions>(
  pairs: readonly THop[],
  inputType: string,
  outputType: string
): ResolvedRouteHop<THop> {
  const matches: ResolvedRouteHop<THop>[] = [];
  for (const pair of pairs) {
    if (pair.typeA === inputType && pair.typeB === outputType) {
      matches.push({ pair, direction: "a_to_b" });
    } else if (pair.typeA === outputType && pair.typeB === inputType) {
      matches.push({ pair, direction: "b_to_a" });
    }
  }

  if (matches.length === 0) {
    throw new Error(`No BrownFi route pair found for ${inputType} -> ${outputType}`);
  }
  if (matches.length > 1) {
    throw new Error(`Ambiguous BrownFi route pair for ${inputType} -> ${outputType}`);
  }
  return matches[0];
}

function resolveRoute<THop extends RoutePriceHopOptions>(
  path: readonly string[],
  pairs: readonly THop[]
): ResolvedRouteHop<THop>[] {
  const hopCount = routeHopCount(path);
  const route: ResolvedRouteHop<THop>[] = [];
  for (let i = 0; i < hopCount; i += 1) {
    route.push(resolveRouteHop(pairs, path[i], path[i + 1]));
  }
  return route;
}

function routeHopAmmReadingCount(hop: ResolvedRouteHop<RoutePriceHopOptions>): number {
  const pair = hop.pair as RoutePriceHopWithAmmReadingsOptions &
    FlowXDirectAmmRouteHopOptions &
    FlowXTwoHopAmmRouteHopOptions;
  return (
    (pair.ammReadings ?? []).length +
    (pair.flowxDirectAmm ?? []).length +
    (pair.flowxTwoHopAmm ?? []).length
  );
}

function routeHopUsesFlowXAmm(hop: ResolvedRouteHop<RoutePriceHopOptions>): boolean {
  const pair = hop.pair as FlowXDirectAmmRouteHopOptions &
    FlowXTwoHopAmmRouteHopOptions;
  return (
    (pair.flowxDirectAmm ?? []).length > 0 ||
    (pair.flowxTwoHopAmm ?? []).length > 0
  );
}

function launchCaseUsesFlowXAmm<THop extends RoutePriceHopOptions>(
  launchCase: { path: readonly string[]; pairs: readonly THop[] }
): boolean {
  return resolveRoute(launchCase.path, launchCase.pairs).some((hop) =>
    routeHopUsesFlowXAmm(hop)
  );
}

function assertAmmProviderCoverage<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(options: ValidateLaunchValidationMatrixConfigOptions<THop>) {
  const ammProviderIds = options.ammProviderIds ?? [];
  if (ammProviderIds.length === 0) return;

  const routeCases = options.routeCases ?? [];
  const quoteCases = options.quoteCases ?? [];
  const seenAmmProviderIds = new Set<string>();
  for (const ammProviderId of ammProviderIds) {
    if (seenAmmProviderIds.has(ammProviderId)) continue;
    seenAmmProviderIds.add(ammProviderId);

    if (ammProviderId !== "flowx") {
      throw new Error(
        `BrownFi launch validation matrix declared unknown AMM provider ${ammProviderId}`
      );
    }

    const hasCoverage =
      routeCases.some((routeCase) => launchCaseUsesFlowXAmm(routeCase)) ||
      quoteCases.some((quoteCase) => launchCaseUsesFlowXAmm(quoteCase));
    if (!hasCoverage) {
      throw new Error(
        `BrownFi launch validation matrix declared AMM provider ${ammProviderId} has no route or quote coverage`
      );
    }
  }
}

function assertPythFeedId(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(value)) {
    throw new Error(`${label} must be a 32-byte hex feed ID`);
  }
  return value;
}

function assertPythCaseFeedIds<THop extends RoutePriceHopOptions>(
  launchCase: { name: string; path: readonly string[]; pairs: readonly THop[] }
) {
  const route = resolveRoute(launchCase.path, launchCase.pairs);
  for (let i = 0; i < route.length; i += 1) {
    const feedIds = (route[i].pair as unknown as RoutePriceHopWithFeedsOptions).feedIds;
    if (!Array.isArray(feedIds) || feedIds.length !== 2) {
      throw new Error(
        `BrownFi launch validation ${launchCase.name} hop ${i} feedIds must contain exactly two feed IDs`
      );
    }
    assertPythFeedId(
      feedIds[0],
      `BrownFi launch validation ${launchCase.name} hop ${i} feedIds[0]`
    );
    assertPythFeedId(
      feedIds[1],
      `BrownFi launch validation ${launchCase.name} hop ${i} feedIds[1]`
    );
  }
}

function assertProviderSpecificLaunchMetadata<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(options: ValidateLaunchValidationMatrixConfigOptions<THop>) {
  for (const routeCase of options.routeCases ?? []) {
    if (routeCase.providerId === "pyth") {
      assertPythCaseFeedIds(routeCase);
    }
  }
  for (const quoteCase of options.quoteCases ?? []) {
    if (quoteCase.providerId === "pyth") {
      assertPythCaseFeedIds(quoteCase);
    }
  }
}

function routeHopOracleSourceCount(
  hop: ResolvedRouteHop<RoutePriceHopOptions>
): number | undefined {
  return hop.pair.oracleSourceCount;
}

function routeHopUpdatePayloadByteLength(
  hop: ResolvedRouteHop<RoutePriceHopOptions>
): number | undefined {
  return hop.pair.updatePayloadByteLength;
}

function validateLaunchRouteLimits<THop extends RoutePriceHopOptions>(
  name: string,
  path: readonly string[],
  pairs: readonly THop[],
  limits?: LaunchValidationRouteLimits
): ResolvedRouteHop<THop>[] {
  const route = resolveRoute(path, pairs);
  if (limits?.maxHops !== undefined) {
    if (!Number.isInteger(limits.maxHops) || limits.maxHops < 1) {
      throw new Error("BrownFi launch validation maxHops must be a positive integer");
    }
    if (route.length > limits.maxHops) {
      throw new Error(
        `BrownFi launch validation ${name} exceeds maxHops ${limits.maxHops}: ${route.length}`
      );
    }
  }
  if (limits?.maxOracleSourcesPerHop !== undefined) {
    if (
      !Number.isInteger(limits.maxOracleSourcesPerHop) ||
      limits.maxOracleSourcesPerHop < 1
    ) {
      throw new Error(
        "BrownFi launch validation maxOracleSourcesPerHop must be a positive integer"
      );
    }
    for (let i = 0; i < route.length; i += 1) {
      const oracleSourceCount = routeHopOracleSourceCount(route[i]);
      if (oracleSourceCount === undefined) {
        throw new Error(
          `BrownFi launch validation ${name} hop ${i} requires oracleSourceCount when maxOracleSourcesPerHop is configured`
        );
      }
      if (!Number.isInteger(oracleSourceCount) || oracleSourceCount < 1) {
        throw new Error(
          `BrownFi launch validation ${name} hop ${i} oracleSourceCount must be a positive integer`
        );
      }
      if (oracleSourceCount > limits.maxOracleSourcesPerHop) {
        throw new Error(
          `BrownFi launch validation ${name} hop ${i} exceeds maxOracleSourcesPerHop ${limits.maxOracleSourcesPerHop}: ${oracleSourceCount}`
        );
      }
    }
  }
  if (limits?.maxUpdatePayloadBytes !== undefined) {
    if (
      !Number.isInteger(limits.maxUpdatePayloadBytes) ||
      limits.maxUpdatePayloadBytes < 0
    ) {
      throw new Error(
        "BrownFi launch validation maxUpdatePayloadBytes must be a non-negative integer"
      );
    }
    let updatePayloadByteLength = 0;
    for (let i = 0; i < route.length; i += 1) {
      const hopUpdatePayloadByteLength = routeHopUpdatePayloadByteLength(route[i]);
      if (hopUpdatePayloadByteLength === undefined) {
        throw new Error(
          `BrownFi launch validation ${name} hop ${i} requires updatePayloadByteLength when maxUpdatePayloadBytes is configured`
        );
      }
      if (
        !Number.isInteger(hopUpdatePayloadByteLength) ||
        hopUpdatePayloadByteLength < 0
      ) {
        throw new Error(
          `BrownFi launch validation ${name} hop ${i} updatePayloadByteLength must be a non-negative integer`
        );
      }
      updatePayloadByteLength += hopUpdatePayloadByteLength;
    }
    if (updatePayloadByteLength > limits.maxUpdatePayloadBytes) {
      throw new Error(
        `BrownFi launch validation ${name} exceeds maxUpdatePayloadBytes ${limits.maxUpdatePayloadBytes}: ${updatePayloadByteLength}`
      );
    }
  }
  if (limits?.maxAmmSourcesPerHop !== undefined) {
    if (
      !Number.isInteger(limits.maxAmmSourcesPerHop) ||
      limits.maxAmmSourcesPerHop < 0
    ) {
      throw new Error(
        "BrownFi launch validation maxAmmSourcesPerHop must be a non-negative integer"
      );
    }
    for (let i = 0; i < route.length; i += 1) {
      const ammReadingCount = routeHopAmmReadingCount(route[i]);
      if (ammReadingCount > limits.maxAmmSourcesPerHop) {
        throw new Error(
          `BrownFi launch validation ${name} hop ${i} exceeds maxAmmSourcesPerHop ${limits.maxAmmSourcesPerHop}: ${ammReadingCount}`
        );
      }
    }
  }
  return route;
}

function resolvePythRoute(
  path: readonly string[],
  pairs: readonly PythRoutePriceHopOptions[]
): ResolvedPythRouteHop[] {
  return resolveRoute(path, pairs);
}

function assertSameRoutePackage(
  first: RoutePriceHopOptions,
  second: RoutePriceHopOptions
) {
  if (first.packageId !== second.packageId) {
    throw new Error("BrownFi two-hop route pairs must use the same package ID");
  }
}

async function updatePythRouteFeeds(
  tx: TransactionLike,
  options: BuildPythRoutePriceBundlesOptions
): Promise<Map<string, string>> {
  const feedIds = uniqueRouteFeedIds(options.hops);
  const priceInfoObjectsByFeedId = new Map<string, string>();
  if (feedIds.length === 0) {
    return priceInfoObjectsByFeedId;
  }

  const priceFeedUpdates = await options.priceFeedConnection.getPriceFeedsUpdateData(
    Array.from(feedIds)
  );
  const priceInfoObjectIds = await options.pythClient.updatePriceFeeds(
    tx,
    Array.from(priceFeedUpdates),
    Array.from(feedIds)
  );
  if (priceInfoObjectIds.length !== feedIds.length) {
    throw new Error("Pyth update returned an unexpected number of price info objects");
  }

  for (let i = 0; i < feedIds.length; i += 1) {
    priceInfoObjectsByFeedId.set(feedIds[i], priceInfoObjectIds[i]);
  }
  return priceInfoObjectsByFeedId;
}

function routePriceInfoObject(
  priceInfoObjectsByFeedId: ReadonlyMap<string, string>,
  feedId: string
): string {
  const priceInfoObject = priceInfoObjectsByFeedId.get(feedId);
  if (priceInfoObject === undefined) {
    throw new Error("missing Pyth price info object for route feed");
  }
  return priceInfoObject;
}

export function createRoutePriceProviderRegistry<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  providers: readonly RoutePriceProvider<THop>[]
): RoutePriceProviderRegistry<THop> {
  const providerMap = new Map<string, RoutePriceProvider<THop>>();
  for (const provider of providers) {
    if (providerMap.has(provider.id)) {
      throw new Error(`Duplicate BrownFi route price provider: ${provider.id}`);
    }
    providerMap.set(provider.id, provider);
  }
  return { providers: providerMap };
}

export function getRoutePriceProvider<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  registry: RoutePriceProviderRegistry<THop>,
  providerId: string
): RoutePriceProvider<THop> {
  const provider = registry.providers.get(providerId);
  if (provider === undefined) {
    throw new Error(`No BrownFi route price provider registered for ${providerId}`);
  }
  return provider;
}

export function dryRunBuiltTransactionBlock<TDryRunResult = unknown>(
  options: DryRunBuiltTransactionBlockOptions<TDryRunResult>
): Promise<TDryRunResult> {
  return options.suiClient.dryRunTransactionBlock({
    transactionBlock: options.transactionBlock
  });
}

function recordField(value: unknown, key: string): unknown {
  if (typeof value !== "object" || value === null) {
    return undefined;
  }
  return (value as Record<string, unknown>)[key];
}

export function getDryRunTransactionBlockStatus(
  result: unknown
): SuiDryRunTransactionBlockStatus | undefined {
  const effects = recordField(result, "effects");
  const status = recordField(effects, "status");
  const statusValue = recordField(status, "status");
  if (typeof statusValue !== "string") {
    return undefined;
  }

  const error = recordField(status, "error");
  return {
    status: statusValue,
    ...(typeof error === "string" ? { error } : {})
  };
}

export function assertDryRunTransactionBlockSucceeded<TDryRunResult>(
  result: TDryRunResult,
  options: AssertDryRunTransactionBlockSucceededOptions = {}
): TDryRunResult {
  const context = options.context ?? "Sui dry-run";
  const status = getDryRunTransactionBlockStatus(result);
  if (status === undefined) {
    throw new Error(`${context} did not return effects.status.status`);
  }
  if (status.status !== "success") {
    throw new Error(
      `${context} failed with status ${status.status}${
        status.error === undefined ? "" : `: ${status.error}`
      }`
    );
  }
  return result;
}

export async function preflightBuiltTransactionBlock<TDryRunResult = unknown>(
  options: PreflightBuiltTransactionBlockOptions<TDryRunResult>
): Promise<TDryRunResult> {
  const result = await dryRunBuiltTransactionBlock(options);
  return assertDryRunTransactionBlockSucceeded(result, {
    context: options.context
  });
}

export async function buildAndDryRunTransactionBlock<TDryRunResult = unknown>(
  options: BuildAndDryRunTransactionBlockOptions<TDryRunResult>
): Promise<TDryRunResult> {
  const transactionBlock = await options.tx.build({
    client: options.suiClient
  });
  return dryRunBuiltTransactionBlock({
    suiClient: options.suiClient,
    transactionBlock
  });
}

export async function buildAndPreflightTransactionBlock<TDryRunResult = unknown>(
  options: BuildAndPreflightTransactionBlockOptions<TDryRunResult>
): Promise<TDryRunResult> {
  const transactionBlock = await options.tx.build({
    client: options.suiClient
  });
  return preflightBuiltTransactionBlock({
    suiClient: options.suiClient,
    transactionBlock,
    context: options.context
  });
}

function launchValidationPreflightContext(
  name: string,
  preflightContext?: string
): string {
  return preflightContext ?? `BrownFi launch validation ${name}`;
}

export function createExactInputRouteQuoteValidationCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: CreateExactInputRouteQuoteValidationCaseOptions<THop>
): LaunchValidationCase<RouteQuoteResults> {
  const quoteOptions: QuoteExactInputWithRegisteredRouteOptions<THop> = {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    amountIn: options.amountIn
  };

  return {
    name: options.name,
    kind: "exact-input-quote",
    providerId: options.providerId,
    preflightContext: launchValidationPreflightContext(
      options.name,
      options.preflightContext
    ),
    build(tx) {
      return quoteExactInputWithRegisteredRoute(tx, quoteOptions);
    }
  };
}

export function createExactInputWithoutCutoffRouteQuoteValidationCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: CreateExactInputRouteQuoteValidationCaseOptions<THop>
): LaunchValidationCase<RouteQuoteResults> {
  const quoteOptions: QuoteExactInputWithRegisteredRouteOptions<THop> = {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    amountIn: options.amountIn
  };

  return {
    name: options.name,
    kind: "exact-input-without-cutoff-quote",
    providerId: options.providerId,
    preflightContext: launchValidationPreflightContext(
      options.name,
      options.preflightContext
    ),
    build(tx) {
      return quoteExactInputWithoutCutoffWithRegisteredRoute(tx, quoteOptions);
    }
  };
}

export function createExactOutputRouteQuoteValidationCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: CreateExactOutputRouteQuoteValidationCaseOptions<THop>
): LaunchValidationCase<RouteQuoteResults> {
  const quoteOptions: QuoteExactOutputWithRegisteredRouteOptions<THop> = {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    amountOut: options.amountOut
  };

  return {
    name: options.name,
    kind: "exact-output-quote",
    providerId: options.providerId,
    preflightContext: launchValidationPreflightContext(
      options.name,
      options.preflightContext
    ),
    build(tx) {
      return quoteExactOutputWithRegisteredRoute(tx, quoteOptions);
    }
  };
}

export function createExactOutputRoundTripRouteQuoteValidationCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: CreateExactOutputRoundTripRouteQuoteValidationCaseOptions<THop>
): LaunchValidationCase<RouteQuoteResults> {
  const exactOutputOptions: QuoteExactOutputWithRegisteredRouteOptions<THop> = {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    amountOut: options.amountOut
  };

  return {
    name: options.name,
    kind: "exact-output-round-trip-quote",
    providerId: options.providerId,
    preflightContext: launchValidationPreflightContext(
      options.name,
      options.preflightContext
    ),
    async build(tx) {
      const exactOutputQuote = await quoteExactOutputWithRegisteredRoute(
        tx,
        exactOutputOptions
      );
      const exactInputQuote = await quoteExactInputWithRegisteredRoute(tx, {
        providerRegistry: options.providerRegistry,
        providerId: options.providerId,
        clock: options.clock,
        path: options.path,
        pairs: options.pairs,
        amountIn: exactOutputQuote.amounts[0]
      });

      return {
        quoteResults: [
          ...exactOutputQuote.quoteResults,
          ...exactInputQuote.quoteResults
        ],
        amounts: exactInputQuote.amounts
      };
    }
  };
}

export function createExactOutputWithoutCutoffRouteQuoteValidationCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: CreateExactOutputRouteQuoteValidationCaseOptions<THop>
): LaunchValidationCase<RouteQuoteResults> {
  const quoteOptions: QuoteExactOutputWithRegisteredRouteOptions<THop> = {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    amountOut: options.amountOut
  };

  return {
    name: options.name,
    kind: "exact-output-without-cutoff-quote",
    providerId: options.providerId,
    preflightContext: launchValidationPreflightContext(
      options.name,
      options.preflightContext
    ),
    build(tx) {
      return quoteExactOutputWithoutCutoffWithRegisteredRoute(tx, quoteOptions);
    }
  };
}

export function createMaxBoundRouteQuoteValidationCase<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: CreateMaxBoundRouteQuoteValidationCaseOptions<THop>
): LaunchValidationCase<RouteQuoteResults> {
  const quoteOptions: QuoteMaxBoundWithRegisteredRouteOptions<THop> = {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    path: options.path,
    pairs: options.pairs
  };

  return {
    name: options.name,
    kind: "max-bound-quote",
    providerId: options.providerId,
    preflightContext: launchValidationPreflightContext(
      options.name,
      options.preflightContext
    ),
    build(tx) {
      return quoteMaxBoundWithRegisteredRoute(tx, quoteOptions);
    }
  };
}

export function buildLaunchValidationQuoteCases<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: BuildLaunchValidationQuoteCasesOptions<THop>
): LaunchValidationCase<RouteQuoteResults>[] {
  return options.cases.map((quoteCase) => {
    if (quoteCase.kind === "exact-input-quote") {
      getRoutePriceProvider(options.providerRegistry, quoteCase.providerId);
      validateLaunchRouteLimits(
        quoteCase.name,
        quoteCase.path,
        quoteCase.pairs,
        options.routeLimits
      );
      return createExactInputRouteQuoteValidationCase({
        name: quoteCase.name,
        providerRegistry: options.providerRegistry,
        providerId: quoteCase.providerId,
        preflightContext: quoteCase.preflightContext ?? quoteCase.context,
        clock: quoteCase.clock,
        path: quoteCase.path,
        pairs: quoteCase.pairs,
        amountIn: quoteCase.amountIn
      });
    }

    if (quoteCase.kind === "exact-input-without-cutoff-quote") {
      getRoutePriceProvider(options.providerRegistry, quoteCase.providerId);
      validateLaunchRouteLimits(
        quoteCase.name,
        quoteCase.path,
        quoteCase.pairs,
        options.routeLimits
      );
      return createExactInputWithoutCutoffRouteQuoteValidationCase({
        name: quoteCase.name,
        providerRegistry: options.providerRegistry,
        providerId: quoteCase.providerId,
        preflightContext: quoteCase.preflightContext ?? quoteCase.context,
        clock: quoteCase.clock,
        path: quoteCase.path,
        pairs: quoteCase.pairs,
        amountIn: quoteCase.amountIn
      });
    }

    if (quoteCase.kind === "exact-output-quote") {
      getRoutePriceProvider(options.providerRegistry, quoteCase.providerId);
      validateLaunchRouteLimits(
        quoteCase.name,
        quoteCase.path,
        quoteCase.pairs,
        options.routeLimits
      );
      return createExactOutputRouteQuoteValidationCase({
        name: quoteCase.name,
        providerRegistry: options.providerRegistry,
        providerId: quoteCase.providerId,
        preflightContext: quoteCase.preflightContext ?? quoteCase.context,
        clock: quoteCase.clock,
        path: quoteCase.path,
        pairs: quoteCase.pairs,
        amountOut: quoteCase.amountOut
      });
    }

    if (quoteCase.kind === "exact-output-round-trip-quote") {
      getRoutePriceProvider(options.providerRegistry, quoteCase.providerId);
      validateLaunchRouteLimits(
        quoteCase.name,
        quoteCase.path,
        quoteCase.pairs,
        options.routeLimits
      );
      return createExactOutputRoundTripRouteQuoteValidationCase({
        name: quoteCase.name,
        providerRegistry: options.providerRegistry,
        providerId: quoteCase.providerId,
        preflightContext: quoteCase.preflightContext ?? quoteCase.context,
        clock: quoteCase.clock,
        path: quoteCase.path,
        pairs: quoteCase.pairs,
        amountOut: quoteCase.amountOut
      });
    }

    if (quoteCase.kind === "exact-output-without-cutoff-quote") {
      getRoutePriceProvider(options.providerRegistry, quoteCase.providerId);
      validateLaunchRouteLimits(
        quoteCase.name,
        quoteCase.path,
        quoteCase.pairs,
        options.routeLimits
      );
      return createExactOutputWithoutCutoffRouteQuoteValidationCase({
        name: quoteCase.name,
        providerRegistry: options.providerRegistry,
        providerId: quoteCase.providerId,
        preflightContext: quoteCase.preflightContext ?? quoteCase.context,
        clock: quoteCase.clock,
        path: quoteCase.path,
        pairs: quoteCase.pairs,
        amountOut: quoteCase.amountOut
      });
    }

    if (quoteCase.kind === "max-bound-quote") {
      getRoutePriceProvider(options.providerRegistry, quoteCase.providerId);
      const route = validateLaunchRouteLimits(
        quoteCase.name,
        quoteCase.path,
        quoteCase.pairs,
        options.routeLimits
      );
      if (route.length !== 1) {
        throw new Error(
          `BrownFi launch validation ${quoteCase.name} max-bound quote requires exactly one hop: ${route.length}`
        );
      }
      return createMaxBoundRouteQuoteValidationCase({
        name: quoteCase.name,
        providerRegistry: options.providerRegistry,
        providerId: quoteCase.providerId,
        preflightContext: quoteCase.preflightContext ?? quoteCase.context,
        clock: quoteCase.clock,
        path: quoteCase.path,
        pairs: quoteCase.pairs
      });
    }

    throw new Error(
      `Unknown BrownFi launch validation quote case kind: ${String(
        (quoteCase as { kind?: unknown }).kind
      )}`
    );
  });
}

export async function preflightLaunchValidationCase<
  TBuildResult = unknown,
  TDryRunResult = unknown
>(
  options: PreflightLaunchValidationCaseOptions<TBuildResult, TDryRunResult>
): Promise<LaunchValidationPreflightResult<TDryRunResult>> {
  await options.validationCase.build(options.tx);
  const dryRunResult = await buildAndPreflightTransactionBlock({
    tx: options.tx,
    suiClient: options.suiClient,
    context: options.validationCase.preflightContext
  });
  return {
    name: options.validationCase.name,
    kind: options.validationCase.kind,
    providerId: options.validationCase.providerId,
    dryRunResult
  };
}

export async function preflightLaunchValidationCases<TDryRunResult = unknown>(
  options: PreflightLaunchValidationCasesOptions<TDryRunResult>
): Promise<LaunchValidationPreflightResult<TDryRunResult>[]> {
  const results: LaunchValidationPreflightResult<TDryRunResult>[] = [];
  for (let i = 0; i < options.cases.length; i += 1) {
    const validationCase = options.cases[i];
    results.push(
      await preflightLaunchValidationCase({
        validationCase,
        tx: options.createTransaction(validationCase, i),
        suiClient: options.suiClient
      })
    );
  }
  return results;
}

export function preflightLaunchValidationQuoteCases<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightLaunchValidationQuoteCasesOptions<THop, TDryRunResult>
): Promise<LaunchValidationPreflightResult<TDryRunResult>[]> {
  return preflightLaunchValidationCases({
    cases: buildLaunchValidationQuoteCases({
      providerRegistry: options.providerRegistry,
      cases: options.cases,
      routeLimits: options.routeLimits
    }),
    createTransaction: options.createTransaction,
    suiClient: options.suiClient
  });
}

export function buildLaunchValidationMatrix<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: BuildLaunchValidationMatrixOptions<THop>
): LaunchValidationMatrix<THop> {
  const routeCases = options.routeCases ?? [];
  const quoteCases = options.quoteCases ?? [];
  if (routeCases.length === 0 && quoteCases.length === 0) {
    throw new Error(
      "BrownFi launch validation matrix requires at least one route or quote case"
    );
  }
  let hydratedRouteCases: PreflightRegisteredRouteCase<THop>[] = [];
  if (routeCases.length > 0) {
    const routeTransactionFactory = options.routeTransactionFactory;
    if (routeTransactionFactory === undefined) {
      throw new Error(
        "BrownFi launch validation matrix requires routeTransactionFactory when route cases are configured"
      );
    }
    hydratedRouteCases = buildRegisteredRoutePreflightCases({
      providerRegistry: options.providerRegistry,
      txFactory: routeTransactionFactory,
      cases: routeCases,
      routeLimits: options.routeLimits
    });
  }

  return {
    routeCases: hydratedRouteCases,
    quoteCases: buildLaunchValidationQuoteCases({
      providerRegistry: options.providerRegistry,
      cases: quoteCases,
      routeLimits: options.routeLimits
    })
  };
}

export async function preflightLaunchValidationMatrix<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightLaunchValidationMatrixOptions<THop, TDryRunResult>
): Promise<LaunchValidationMatrixPreflightResult<TDryRunResult>> {
  const quoteCases = options.quoteCases ?? [];
  if (quoteCases.length > 0 && options.quoteTransactionFactory === undefined) {
    throw new Error(
      "BrownFi launch validation matrix requires quoteTransactionFactory when quote cases are configured"
    );
  }

  const matrix = buildLaunchValidationMatrix(options);
  const routeResults = await preflightRegisteredRouteCases({
    suiClient: options.suiClient,
    cases: matrix.routeCases,
    transferRecipient: options.transferRecipient
  });
  let quoteResults: LaunchValidationPreflightResult<TDryRunResult>[] = [];
  if (matrix.quoteCases.length > 0) {
    const quoteTransactionFactory = options.quoteTransactionFactory;
    if (quoteTransactionFactory === undefined) {
      throw new Error(
        "BrownFi launch validation matrix requires quoteTransactionFactory when quote cases are configured"
      );
    }
    quoteResults = await preflightLaunchValidationCases({
      suiClient: options.suiClient,
      createTransaction: quoteTransactionFactory,
      cases: matrix.quoteCases
    });
  }
  return { routeResults, quoteResults };
}

export function summarizeLaunchValidationMatrixPreflightResult<
  TDryRunResult = unknown
>(
  result: LaunchValidationMatrixPreflightResult<TDryRunResult>
): LaunchValidationMatrixPreflightSummary {
  const providerIds: string[] = [];
  const seenProviderIds = new Set<string>();
  const addProviderId = (providerId: string) => {
    if (!seenProviderIds.has(providerId)) {
      seenProviderIds.add(providerId);
      providerIds.push(providerId);
    }
  };
  const routeCases = result.routeResults.map((routeResult) => {
    addProviderId(routeResult.providerId);
    return {
      name: routeResult.name,
      kind: routeResult.kind,
      providerId: routeResult.providerId
    };
  });
  const quoteCases = result.quoteResults.map((quoteResult) => {
    addProviderId(quoteResult.providerId);
    return {
      name: quoteResult.name,
      kind: quoteResult.kind,
      providerId: quoteResult.providerId
    };
  });

  return {
    routeCaseCount: routeCases.length,
    quoteCaseCount: quoteCases.length,
    totalCaseCount: routeCases.length + quoteCases.length,
    providerIds,
    routeCases,
    quoteCases
  };
}

export function summarizeLaunchValidationMatrix<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  matrix: LaunchValidationMatrix<THop>
): LaunchValidationMatrixPreflightSummary {
  const providerIds: string[] = [];
  const seenProviderIds = new Set<string>();
  const addProviderId = (providerId: string) => {
    if (!seenProviderIds.has(providerId)) {
      seenProviderIds.add(providerId);
      providerIds.push(providerId);
    }
  };
  const routeCases = matrix.routeCases.map((routeCase) => {
    addProviderId(routeCase.providerId);
    return {
      name: routeCase.name,
      kind: routeCase.kind,
      providerId: routeCase.providerId
    };
  });
  const quoteCases = matrix.quoteCases.map((quoteCase) => {
    addProviderId(quoteCase.providerId);
    return {
      name: quoteCase.name,
      kind: quoteCase.kind,
      providerId: quoteCase.providerId
    };
  });

  return {
    routeCaseCount: routeCases.length,
    quoteCaseCount: quoteCases.length,
    totalCaseCount: routeCases.length + quoteCases.length,
    providerIds,
    routeCases,
    quoteCases
  };
}

function offlineLaunchValidationTransaction(): SuiTransactionBlockBuilderLike {
  const unavailable = () => {
    throw new Error("BrownFi offline launch validation transaction should not execute");
  };
  return {
    object: unavailable,
    pure: {
      u64: unavailable
    },
    moveCall: unavailable,
    makeMoveVec: unavailable,
    async build() {
      throw new Error("BrownFi offline launch validation transaction should not build");
    }
  } as unknown as SuiTransactionBlockBuilderLike;
}

function offlineLaunchValidationProvider<THop extends RoutePriceHopOptions>(
  id: string
): RoutePriceProvider<THop> {
  return {
    id,
    async buildPriceBundles() {
      throw new Error("BrownFi offline launch validation provider should not execute");
    }
  };
}

export function validateLaunchValidationMatrixConfig<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: ValidateLaunchValidationMatrixConfigOptions<THop>
): LaunchValidationMatrixPreflightSummary {
  if (options.requireProviderMetadata) {
    assertProviderSpecificLaunchMetadata(options);
  }
  const providerRegistry = createRoutePriceProviderRegistry(
    options.providerIds.map((providerId) =>
      offlineLaunchValidationProvider<THop>(providerId)
    )
  );
  const routeCases = options.routeCases ?? [];
  const matrix = buildLaunchValidationMatrix({
    providerRegistry,
    routeCases,
    quoteCases: options.quoteCases,
    routeLimits: options.routeLimits,
    ...(routeCases.length === 0
      ? {}
      : {
          routeTransactionFactory() {
            return offlineLaunchValidationTransaction();
          }
        }
    )
  });
  const summary = summarizeLaunchValidationMatrix(matrix);
  const coveredProviderIds = new Set(summary.providerIds);
  for (const providerId of options.providerIds) {
    if (!coveredProviderIds.has(providerId)) {
      throw new Error(
        `BrownFi launch validation matrix declared provider ${providerId} has no route or quote coverage`
      );
    }
  }
  assertAmmProviderCoverage(options);
  return summary;
}

export async function runLaunchValidationMatrixPreflight<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightLaunchValidationMatrixOptions<THop, TDryRunResult>
): Promise<LaunchValidationMatrixPreflightReport<TDryRunResult>> {
  const preflightResult = await preflightLaunchValidationMatrix(options);
  return {
    preflightResult,
    summary: summarizeLaunchValidationMatrixPreflightResult(preflightResult)
  };
}

function wrapStandardRoutePriceProviderWithAmmReaders<
  THop extends RoutePriceHopOptions
>(
  provider: RoutePriceProvider<THop>,
  options: Pick<
    CreateStandardRoutePriceProviderRegistryOptions,
    "buildAmmReadings" | "flowxDirectAmm" | "flowxTwoHopAmm"
  >
): RoutePriceProvider<RoutePriceHopOptions> {
  let wrapped = provider as unknown as RoutePriceProvider<RoutePriceHopWithAmmReadingsOptions>;

  if (options.buildAmmReadings !== undefined) {
    wrapped = createAmmReadingRoutePriceProvider({
      routePriceProvider: wrapped,
      buildAmmReadings: options.buildAmmReadings
    }) as unknown as RoutePriceProvider<RoutePriceHopWithAmmReadingsOptions>;
  }

  if (options.flowxTwoHopAmm === true) {
    wrapped = createFlowXTwoHopAmmRoutePriceProvider({
      routePriceProvider: wrapped
    }) as unknown as RoutePriceProvider<RoutePriceHopWithAmmReadingsOptions>;
  }

  if (options.flowxDirectAmm === true) {
    wrapped = createFlowXDirectAmmRoutePriceProvider({
      routePriceProvider: wrapped
    }) as unknown as RoutePriceProvider<RoutePriceHopWithAmmReadingsOptions>;
  }

  return wrapped as unknown as RoutePriceProvider<RoutePriceHopOptions>;
}

export function createStandardRoutePriceProviderRegistry<
  TSwitchboardClient = unknown,
  TStorkClient = unknown
>(
  options: CreateStandardRoutePriceProviderRegistryOptions<TSwitchboardClient, TStorkClient>
): RoutePriceProviderRegistry<RoutePriceHopOptions> {
  const providers: RoutePriceProvider<RoutePriceHopOptions>[] = [];

  if (options.pyth !== undefined) {
    providers.push(
      wrapStandardRoutePriceProviderWithAmmReaders(
        createPythRoutePriceProvider(options.pyth),
        options
      )
    );
  }

  if (options.switchboard !== undefined) {
    providers.push(
      wrapStandardRoutePriceProviderWithAmmReaders(
        createSwitchboardRoutePriceProvider(options.switchboard),
        options
      )
    );
  }

  if (options.stork !== undefined) {
    providers.push(
      wrapStandardRoutePriceProviderWithAmmReaders(
        createStorkRoutePriceProvider(options.stork),
        options
      )
    );
  }

  if (options.storkRest !== undefined) {
    providers.push(
      wrapStandardRoutePriceProviderWithAmmReaders(
        createStorkRestRoutePriceProvider(options.storkRest),
        options
      )
    );
  }

  if (options.supraPush === true) {
    providers.push(
      wrapStandardRoutePriceProviderWithAmmReaders(
        createSupraPushRoutePriceProvider(),
        options
      )
    );
  }

  if (options.supraPull === true) {
    providers.push(
      wrapStandardRoutePriceProviderWithAmmReaders(
        createSupraPullRoutePriceProvider(),
        options
      )
    );
  }

  if (options.supraPullRest !== undefined) {
    providers.push(
      wrapStandardRoutePriceProviderWithAmmReaders(
        createSupraPullRestRoutePriceProvider(options.supraPullRest),
        options
      )
    );
  }

  if (providers.length === 0) {
    throw new Error("At least one BrownFi route price provider must be configured");
  }

  return createRoutePriceProviderRegistry(providers);
}

export function getPythSuiContractConfig(
  network: PythSuiNetwork,
  contractSet: PythSuiContractSet = "upgraded"
): PythSuiContractConfig {
  return { ...PYTH_SUI_CONTRACT_CONFIGS[network][contractSet] };
}

export function getStorkRestEndpoint(network: StorkRestNetwork): string {
  return STORK_REST_ENDPOINTS[network];
}

export function storkRestLatestPricesResponseToSignedPrices(
  response: unknown,
  feedIds: readonly string[]
): StorkRestSignedPricePayload[] {
  const root = requireRecord(response, "Stork REST response");
  const data = requireRecord(root.data, "Stork REST response data");
  const value = requireRecord(data.value, "Stork REST response data.value");

  return feedIds.map((feedId) => {
    const feed = requireRecord(
      value[feedId],
      `Stork REST response data.value.${feedId}`
    );
    const signedPrice = requireRecord(
      feed.stork_signed_price,
      `Stork REST response data.value.${feedId}.stork_signed_price`
    );
    return signedPrice as unknown as StorkRestSignedPricePayload;
  });
}

export function createStorkRestSignedPriceFetcher(
  options: CreateStorkRestSignedPriceFetcherOptions
): StorkSignedPriceFetcher<unknown> {
  const endpoint = storkRestEndpoint(options);
  if (options.apiKey.length === 0) {
    throw new Error("Stork REST API key is required");
  }
  const fetchSignedPrices = options.fetch ?? (globalThis as { fetch?: StorkRestFetch }).fetch;
  if (fetchSignedPrices === undefined) {
    throw new Error("Stork REST fetch implementation is required");
  }

  return async (_storkClient, feedIds) => {
    const requestedFeedIds = Array.from(feedIds);
    if (requestedFeedIds.length === 0) {
      throw new Error("Stork REST signed price fetch requires at least one asset");
    }

    const query = new URLSearchParams({
      assets: requestedFeedIds.join(",")
    });
    const response = await fetchSignedPrices(`${endpoint}/v1/prices/latest?${query}`, {
      method: "GET",
      headers: {
        authorization: `Basic ${options.apiKey}`,
        accept: "application/json"
      }
    });

    if (response.ok === false) {
      throw new Error(
        `Stork REST latest prices request failed: ${response.status ?? "unknown"} ${response.statusText ?? ""}`.trim()
      );
    }

    return storkRestLatestPricesResponseToSignedPrices(
      await response.json(),
      requestedFeedIds
    );
  };
}

export function getSupraPullRestEndpoint(network: SupraPullRestNetwork): string {
  return SUPRA_PULL_REST_ENDPOINTS[network];
}

export function supraPullRestProofResponseToPayload(
  response: unknown
): SupraPullProofPayload {
  if (typeof response !== "object" || response === null || Array.isArray(response)) {
    throw new Error("Supra pull REST response must be an object");
  }

  const fields = response as Record<string, unknown>;
  const rawPairIndexes = fields.pair_indexes;
  if (!Array.isArray(rawPairIndexes)) {
    throw new Error("Supra pull REST response pair_indexes must be an array");
  }
  const rawProofBytes = fields.proof_bytes;
  if (
    typeof rawProofBytes !== "string" &&
    !(rawProofBytes instanceof Uint8Array) &&
    !Array.isArray(rawProofBytes)
  ) {
    throw new Error("Supra pull REST response proof_bytes must be hex or bytes");
  }

  return {
    pairIndexes: supraPairIndexesValue(
      rawPairIndexes as SupraPairIdInput[],
      "Supra pull REST response pair_indexes"
    ),
    dkgState: requireSupraPullStringField(fields.dkg_object, "dkg_object"),
    supraHolder: requireSupraPullStringField(
      fields.oracle_holder_object,
      "oracle_holder_object"
    ),
    merkleRootHash: requireSupraPullStringField(
      fields.merkle_root_object,
      "merkle_root_object"
    ),
    proofBytes: supraPullProofBytesValue(rawProofBytes)
  };
}

export function createSupraPullRestProofFetcher(
  options: CreateSupraPullRestProofFetcherOptions
): SupraPullProofFetcher {
  const endpoint = supraPullRestEndpoint(options);
  const fetchProof = options.fetch ?? (globalThis as { fetch?: SupraPullRestFetch }).fetch;
  if (fetchProof === undefined) {
    throw new Error("Supra pull REST fetch implementation is required");
  }

  return async (pairIndexes) => {
    const requestedPairIndexes = supraPairIndexesValue(
      pairIndexes,
      "Supra pull proof pair indexes"
    );
    const response = await fetchProof(`${endpoint}/get_proof`, {
      method: "POST",
      headers: {
        "content-type": "application/json"
      },
      body: JSON.stringify({
        pair_indexes: requestedPairIndexes,
        chain_type: "sui"
      })
    });

    if (response.ok === false) {
      throw new Error(
        `Supra pull REST proof request failed: ${response.status ?? "unknown"} ${response.statusText ?? ""}`.trim()
      );
    }

    const payload = supraPullRestProofResponseToPayload(await response.json());
    if (!sameSupraPairIndexes(requestedPairIndexes, payload.pairIndexes)) {
      throw new Error("Supra pull proof pair indexes do not match the request");
    }
    return payload;
  };
}

export function buildPythHermesConnectionConfig(
  options: PythHermesConnectionOptions = {}
): PythHermesConnectionConfig {
  if (options.requireApiKey === true && options.apiKey === undefined) {
    throw new Error("Pyth Hermes API key is required");
  }

  return {
    endpoint: options.endpoint ?? PYTH_HERMES_UPGRADED_ENDPOINT,
    options: {
      ...(options.apiKey === undefined ? {} : { accessToken: options.apiKey }),
      priceFeedRequestConfig: {
        binary: true
      }
    }
  };
}

export function createPythSuiClients<TConnection, TPythClient, TSuiClient>(
  options: CreatePythSuiClientsOptions<TConnection, TPythClient, TSuiClient>
): PythSuiClients<TConnection, TPythClient> {
  const hermesConfig = buildPythHermesConnectionConfig(options);
  const contractConfig = getPythSuiContractConfig(
    options.network,
    options.contractSet ?? "upgraded"
  );

  return {
    priceFeedConnection: new options.SuiPriceServiceConnection(
      hermesConfig.endpoint,
      hermesConfig.options
    ),
    pythClient: new options.SuiPythClient(
      options.suiClient,
      contractConfig.pythStateId,
      contractConfig.wormholeStateId
    ),
    contractConfig
  };
}

export function createSwitchboardSuiClient<TSwitchboardClient, TSuiClient>(
  options: CreateSwitchboardSuiClientOptions<TSwitchboardClient, TSuiClient>
): TSwitchboardClient {
  return new options.SwitchboardClient(options.suiClient);
}

export function createSwitchboardQuoteUpdateFetcher<
  TSwitchboardClient,
  TQuoteUpdateOptions = unknown
>(
  fetchQuoteUpdate: SwitchboardQuoteUpdateFetcher<
    TSwitchboardClient,
    TQuoteUpdateOptions
  >
): SwitchboardQuoteUpdateFetcher<TSwitchboardClient, TQuoteUpdateOptions> {
  return (switchboardClient, feedIds, tx, quoteUpdateOptions) =>
    fetchQuoteUpdate(
      switchboardClient,
      Array.from(feedIds),
      tx,
      quoteUpdateOptions
    );
}

export function readPythPriceA(options: ReadPythPriceOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "pyth_source", "read_price_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.priceInfoObject),
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function readPythPriceB(options: ReadPythPriceOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "pyth_source", "read_price_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.priceInfoObject),
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function readSwitchboardPriceA(
  options: ReadSwitchboardPriceOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "switchboard_source", "read_price_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.quoteVerifier),
        options.quotes,
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function readSwitchboardPriceB(
  options: ReadSwitchboardPriceOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "switchboard_source", "read_price_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.quoteVerifier),
        options.quotes,
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function readStorkPriceA(options: ReadStorkPriceOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "stork_source", "read_price_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.storkState),
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function readStorkPriceB(options: ReadStorkPriceOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "stork_source", "read_price_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.storkState),
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function readStorkSingleUpdateFeeInMist(
  options: StorkUpdateFeeOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.storkPackageId, "state", "get_single_update_fee_in_mist"),
      typeArguments: [],
      arguments: [objectArg(tx, options.storkState)]
    });
}

export function readPythTotalUpdateFeeInMist(
  options: PythTotalUpdateFeeOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.pythPackageId, "pyth", "get_total_update_fee"),
      typeArguments: [],
      arguments: [objectArg(tx, options.pythState), tx.pure.u64(options.numUpdates)]
    });
}

export function readStorkTotalUpdateFeeInMist(
  options: StorkTotalUpdateFeeOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.storkPackageId, "state", "get_total_fees_in_mist"),
      typeArguments: [],
      arguments: [objectArg(tx, options.storkState), tx.pure.u64(options.numUpdates)]
    });
}

export function storkSignedPriceToTemporalNumericValueEvmInputFields(
  payload: StorkRestSignedPricePayload
): StorkTemporalNumericValueEvmInputFields {
  const signedValue = storkSignedMagnitude(payload.price);
  return {
    id: hexBytesValue(payload.encoded_asset_id, "encoded_asset_id"),
    temporalNumericValueTimestampNs: integerBigIntValue(
      payload.timestamped_signature.timestamp,
      "timestamped_signature.timestamp"
    ),
    temporalNumericValueMagnitude: signedValue.magnitude,
    temporalNumericValueNegative: signedValue.negative,
    publisherMerkleRoot: hexBytesValue(
      payload.publisher_merkle_root,
      "publisher_merkle_root"
    ),
    valueComputeAlgHash: hexBytesValue(
      payload.calculation_alg.checksum,
      "calculation_alg.checksum"
    ),
    r: hexBytesValue(payload.timestamped_signature.signature.r, "signature.r"),
    s: hexBytesValue(payload.timestamped_signature.signature.s, "signature.s"),
    v: storkU8Value(payload.timestamped_signature.signature.v, "signature.v")
  };
}

export function buildStorkTemporalNumericValueEvmInput(
  options: BuildStorkTemporalNumericValueEvmInputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.storkPackageId,
        "update_temporal_numeric_value_evm_input",
        "new"
      ),
      typeArguments: [],
      arguments: [
        pureVector(tx, "u8", bytesValue(options.id)),
        tx.pure.u64(options.temporalNumericValueTimestampNs),
        pureU128(tx, options.temporalNumericValueMagnitude),
        pureBool(tx, options.temporalNumericValueNegative),
        pureVector(tx, "u8", bytesValue(options.publisherMerkleRoot)),
        pureVector(tx, "u8", bytesValue(options.valueComputeAlgHash)),
        pureVector(tx, "u8", bytesValue(options.r)),
        pureVector(tx, "u8", bytesValue(options.s)),
        pureU8(tx, options.v)
      ]
    });
}

export function buildStorkTemporalNumericValueEvmInputVec(
  options: BuildStorkTemporalNumericValueEvmInputVecOptions
): TransactionThunk {
  return (tx) => {
    if (options.updates.length === 0) {
      throw new Error("Stork batch update-data construction requires at least one update");
    }

    return tx.moveCall({
      target: moduleTarget(
        options.storkPackageId,
        "update_temporal_numeric_value_evm_input_vec",
        "new"
      ),
      typeArguments: [],
      arguments: [
        pureVector(tx, "vector<u8>", options.updates.map((update) => bytesValue(update.id))),
        pureVector(
          tx,
          "u64",
          options.updates.map((update) => update.temporalNumericValueTimestampNs)
        ),
        pureVector(
          tx,
          "u128",
          options.updates.map((update) => update.temporalNumericValueMagnitude)
        ),
        pureVector(
          tx,
          "bool",
          options.updates.map((update) => update.temporalNumericValueNegative)
        ),
        pureVector(
          tx,
          "vector<u8>",
          options.updates.map((update) => bytesValue(update.publisherMerkleRoot))
        ),
        pureVector(
          tx,
          "vector<u8>",
          options.updates.map((update) => bytesValue(update.valueComputeAlgHash))
        ),
        pureVector(tx, "vector<u8>", options.updates.map((update) => bytesValue(update.r))),
        pureVector(tx, "vector<u8>", options.updates.map((update) => bytesValue(update.s))),
        pureVector(tx, "u8", options.updates.map((update) => update.v))
      ]
    });
  };
}

export function updateSingleStorkTemporalNumericValueEvm(
  options: UpdateStorkTemporalNumericValueEvmOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.storkPackageId,
        "stork",
        "update_single_temporal_numeric_value_evm"
      ),
      typeArguments: [],
      arguments: [
        objectArg(tx, options.storkState),
        objectArg(tx, options.updateData),
        objectArg(tx, options.fee)
      ]
    });
}

export function updateMultipleStorkTemporalNumericValuesEvm(
  options: UpdateStorkTemporalNumericValueEvmOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.storkPackageId,
        "stork",
        "update_multiple_temporal_numeric_values_evm"
      ),
      typeArguments: [],
      arguments: [
        objectArg(tx, options.storkState),
        objectArg(tx, options.updateData),
        objectArg(tx, options.fee)
      ]
    });
}

export function splitSuiFromGas(options: SplitSuiFromGasOptions): TransactionThunk {
  return (tx) => splitGasCoin(tx, options.amount);
}

export function updateSingleStorkTemporalNumericValueEvmWithGasFee(
  options: UpdateStorkTemporalNumericValueEvmWithGasFeeOptions
): TransactionThunk {
  return (tx) => {
    const fee = splitGasCoin(tx, options.feeAmountInMist);
    return updateSingleStorkTemporalNumericValueEvm({
      storkPackageId: options.storkPackageId,
      storkState: options.storkState,
      updateData: options.updateData,
      fee
    })(tx);
  };
}

export function updateMultipleStorkTemporalNumericValuesEvmWithGasFee(
  options: UpdateStorkTemporalNumericValueEvmWithGasFeeOptions
): TransactionThunk {
  return (tx) => {
    const fee = splitGasCoin(tx, options.feeAmountInMist);
    return updateMultipleStorkTemporalNumericValuesEvm({
      storkPackageId: options.storkPackageId,
      storkState: options.storkState,
      updateData: options.updateData,
      fee
    })(tx);
  };
}

export function updateSingleStorkTemporalNumericValueEvmWithSignedPrice(
  options: UpdateStorkTemporalNumericValueEvmWithSignedPriceOptions
): TransactionThunk {
  return (tx) => {
    const updateData = buildStorkTemporalNumericValueEvmInput({
      storkPackageId: options.storkPackageId,
      ...storkSignedPriceToTemporalNumericValueEvmInputFields(options.signedPrice)
    })(tx);
    const feeAmountInMist = readStorkSingleUpdateFeeInMist({
      storkPackageId: options.storkPackageId,
      storkState: options.storkState
    })(tx);
    return updateSingleStorkTemporalNumericValueEvmWithGasFee({
      storkPackageId: options.storkPackageId,
      storkState: options.storkState,
      updateData,
      feeAmountInMist
    })(tx);
  };
}

export function updateMultipleStorkTemporalNumericValuesEvmWithSignedPrices(
  options: UpdateStorkTemporalNumericValuesEvmWithSignedPricesOptions
): TransactionThunk {
  return (tx) => {
    const updateData = buildStorkTemporalNumericValueEvmInputVec({
      storkPackageId: options.storkPackageId,
      updates: options.signedPrices.map((signedPrice) =>
        storkSignedPriceToTemporalNumericValueEvmInputFields(signedPrice)
      )
    })(tx);
    const feeAmountInMist = readStorkTotalUpdateFeeInMist({
      storkPackageId: options.storkPackageId,
      storkState: options.storkState,
      numUpdates: options.signedPrices.length
    })(tx);
    return updateMultipleStorkTemporalNumericValuesEvmWithGasFee({
      storkPackageId: options.storkPackageId,
      storkState: options.storkState,
      updateData,
      feeAmountInMist
    })(tx);
  };
}

export function createStorkSignedPriceUpdater<TStorkClient>(
  options: CreateStorkSignedPriceUpdaterOptions<TStorkClient>
): StorkPriceFeedUpdater<TStorkClient> {
  return async (storkClient, feedIds, tx) => {
    const signedPrices = await options.fetchSignedPrices(
      storkClient,
      Array.from(feedIds),
      tx
    );
    updateMultipleStorkTemporalNumericValuesEvmWithSignedPrices({
      storkPackageId: options.storkPackageId,
      storkState: options.storkState,
      signedPrices
    })(tx);
  };
}

export function readSupraPushPriceA(
  options: ReadSupraPushPriceOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "supra_source", "read_push_price_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.supraHolder),
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function readSupraPushPriceB(
  options: ReadSupraPushPriceOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "supra_source", "read_push_price_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.supraHolder),
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function readSupraPullPriceBundle(
  options: ReadSupraPullPriceBundleOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "supra_pull_source", "read_price_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.dkgState),
        objectArg(tx, options.supraHolder),
        objectArg(tx, options.merkleRootHash),
        objectArg(tx, options.clock),
        pureVector(tx, "u8", bytesValue(options.proofBytes)),
        objectArg(tx, options.pool)
      ]
    });
}

export function readSupraPullPriceBundleWithAmmReadings(
  options: ReadSupraPullPriceBundleWithAmmReadingsOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.packageId,
        "supra_pull_source",
        "read_price_bundle_with_amm_readings"
      ),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.dkgState),
        objectArg(tx, options.supraHolder),
        objectArg(tx, options.merkleRootHash),
        objectArg(tx, options.clock),
        pureVector(tx, "u8", bytesValue(options.proofBytes)),
        objectArg(tx, options.pool),
        ammReadingVector(tx, options.packageId, options.ammReadings)
      ]
    });
}

export function getSwapPriceBundleFromReadings(
  options: GetSwapPriceBundleFromReadingsOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.packageId,
        "oracle_gateway",
        "get_swap_price_bundle_from_readings"
      ),
      typeArguments: pairTypeArguments(options),
      arguments: [
        options.readingA,
        options.readingB,
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function readFlowXDirectPool(options: ReadFlowXDirectPoolOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "amm_flowx", "read_direct_pool"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.brownfiPool),
        objectArg(tx, options.flowxPool),
        objectArg(tx, options.clock),
        tx.pure.u64(options.sourceMask),
        tx.pure.u64(options.twapWindowSeconds),
        tx.pure.u64(options.twalWindowSeconds),
        tx.pure.u64(options.validForMs)
      ]
    });
}

export function readFlowXTwoHopPath(options: ReadFlowXTwoHopPathOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "amm_flowx", "read_two_hop_path"),
      typeArguments: [options.typeA, options.typeB, options.typeI],
      arguments: [
        objectArg(tx, options.brownfiPool),
        objectArg(tx, options.baseIntermediatePool),
        objectArg(tx, options.intermediateQuotePool),
        objectArg(tx, options.clock),
        tx.pure.u64(options.sourceMask),
        pureU8(tx, options.intermediateDecimals),
        tx.pure.u64(options.twapWindowSeconds),
        tx.pure.u64(options.twalWindowSeconds),
        tx.pure.u64(options.validForMs)
      ]
    });
}

export function getSwapPriceBundleFromReadingPairs(
  options: GetSwapPriceBundleFromReadingPairsOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.packageId,
        "oracle_gateway",
        "get_swap_price_bundle_from_reading_pairs"
      ),
      typeArguments: pairTypeArguments(options),
      arguments: [
        priceReadingVector(tx, options.packageId, options.readingsA),
        priceReadingVector(tx, options.packageId, options.readingsB),
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export function getSwapPriceBundleFromReadingPairsAndAmmReadings(
  options: GetSwapPriceBundleFromReadingPairsAndAmmReadingsOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.packageId,
        "oracle_gateway",
        "get_swap_price_bundle_from_reading_pairs_and_amm_readings"
      ),
      typeArguments: pairTypeArguments(options),
      arguments: [
        priceReadingVector(tx, options.packageId, options.readingsA),
        priceReadingVector(tx, options.packageId, options.readingsB),
        ammReadingVector(tx, options.packageId, options.ammReadings),
        objectArg(tx, options.clock),
        objectArg(tx, options.pool)
      ]
    });
}

export async function buildUpdatedPythPriceBundleFromFeeds(
  tx: TransactionLike,
  options: BuildUpdatedPythPriceBundleFromFeedsOptions
): Promise<TransactionArgument> {
  const [readingA, readingB] = await updatePythPairAndRead(tx, options);
  return getSwapPriceBundleFromReadings({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    readingA,
    readingB,
    clock: options.clock,
    pool: options.pool
  })(tx);
}

export async function buildUpdatedPythPriceBundleFromFeedsAndAmmReadings(
  tx: TransactionLike,
  options: BuildUpdatedPythPriceBundleFromFeedsAndAmmReadingsOptions
): Promise<TransactionArgument> {
  const [readingA, readingB] = await updatePythPairAndRead(tx, options);
  return getSwapPriceBundleFromReadingPairsAndAmmReadings({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    readingsA: [readingA],
    readingsB: [readingB],
    ammReadings: options.ammReadings,
    clock: options.clock,
    pool: options.pool
  })(tx);
}

export async function fetchAndBuildUpdatedPythPriceBundleFromFeeds(
  tx: TransactionLike,
  options: FetchAndBuildUpdatedPythPriceBundleFromFeedsOptions
): Promise<TransactionArgument> {
  const feedIds = Array.from(options.feedIds);
  const priceFeedUpdates = await options.priceFeedConnection.getPriceFeedsUpdateData(
    feedIds
  );
  return buildUpdatedPythPriceBundleFromFeeds(tx, {
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    pythClient: options.pythClient,
    priceFeedUpdates,
    feedIds,
    clock: options.clock,
    pool: options.pool
  });
}

export async function fetchAndUpdatePythPriceInfoObjectsFromFeeds(
  tx: TransactionLike,
  options: FetchAndUpdatePythPriceInfoObjectsFromFeedsOptions
): Promise<readonly string[]> {
  const feedIds = Array.from(options.feedIds);
  const priceFeedUpdates = await options.priceFeedConnection.getPriceFeedsUpdateData(
    feedIds
  );
  return options.pythClient.updatePriceFeeds(tx, Array.from(priceFeedUpdates), feedIds);
}

export async function fetchAndBuildUpdatedPythPriceBundleFromFeedsAndAmmReadings(
  tx: TransactionLike,
  options: FetchAndBuildUpdatedPythPriceBundleFromFeedsAndAmmReadingsOptions
): Promise<TransactionArgument> {
  const feedIds = Array.from(options.feedIds);
  const priceFeedUpdates = await options.priceFeedConnection.getPriceFeedsUpdateData(
    feedIds
  );
  return buildUpdatedPythPriceBundleFromFeedsAndAmmReadings(tx, {
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    pythClient: options.pythClient,
    priceFeedUpdates,
    feedIds,
    clock: options.clock,
    pool: options.pool,
    ammReadings: options.ammReadings
  });
}

export async function buildPythRoutePriceBundles(
  tx: TransactionLike,
  options: BuildPythRoutePriceBundlesOptions
): Promise<TransactionArgument[]> {
  const priceInfoObjectsByFeedId = await updatePythRouteFeeds(tx, options);
  const priceBundles: TransactionArgument[] = [];
  for (const hop of options.hops) {
    const [feedIdA, feedIdB] = pairFeedIds(hop.feedIds);
    const readingA = readPythPriceA({
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      priceInfoObject: routePriceInfoObject(priceInfoObjectsByFeedId, feedIdA),
      clock: options.clock,
      pool: hop.pool
    })(tx);
    const readingB = readPythPriceB({
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      priceInfoObject: routePriceInfoObject(priceInfoObjectsByFeedId, feedIdB),
      clock: options.clock,
      pool: hop.pool
    })(tx);

    if (hop.ammReadings !== undefined && hop.ammReadings.length > 0) {
      priceBundles.push(
        getSwapPriceBundleFromReadingPairsAndAmmReadings({
          packageId: hop.packageId,
          typeA: hop.typeA,
          typeB: hop.typeB,
          readingsA: [readingA],
          readingsB: [readingB],
          ammReadings: hop.ammReadings,
          clock: options.clock,
          pool: hop.pool
        })(tx)
      );
    } else {
      priceBundles.push(
        getSwapPriceBundleFromReadings({
          packageId: hop.packageId,
          typeA: hop.typeA,
          typeB: hop.typeB,
          readingA,
          readingB,
          clock: options.clock,
          pool: hop.pool
        })(tx)
      );
    }
  }
  return priceBundles;
}

export async function buildSwitchboardRoutePriceBundles<
  TSwitchboardClient,
  TQuoteUpdateOptions = unknown
>(
  tx: TransactionLike,
  options: BuildSwitchboardRoutePriceBundlesOptions<
    TSwitchboardClient,
    TQuoteUpdateOptions
  >
): Promise<TransactionArgument[]> {
  const feedIds = uniqueRouteFeedIds(options.hops);
  const quotes = await options.fetchQuoteUpdate(
    options.switchboardClient,
    feedIds,
    tx,
    options.quoteUpdateOptions
  );
  const priceBundles: TransactionArgument[] = [];

  for (const hop of options.hops) {
    pairFeedIds(hop.feedIds);
    const readingA = readSwitchboardPriceA({
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      quoteVerifier: hop.quoteVerifier,
      quotes,
      clock: options.clock,
      pool: hop.pool
    })(tx);
    const readingB = readSwitchboardPriceB({
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      quoteVerifier: hop.quoteVerifier,
      quotes,
      clock: options.clock,
      pool: hop.pool
    })(tx);

    if (hop.ammReadings !== undefined && hop.ammReadings.length > 0) {
      priceBundles.push(
        getSwapPriceBundleFromReadingPairsAndAmmReadings({
          packageId: hop.packageId,
          typeA: hop.typeA,
          typeB: hop.typeB,
          readingsA: [readingA],
          readingsB: [readingB],
          ammReadings: hop.ammReadings,
          clock: options.clock,
          pool: hop.pool
        })(tx)
      );
    } else {
      priceBundles.push(
        getSwapPriceBundleFromReadings({
          packageId: hop.packageId,
          typeA: hop.typeA,
          typeB: hop.typeB,
          readingA,
          readingB,
          clock: options.clock,
          pool: hop.pool
        })(tx)
      );
    }
  }

  return priceBundles;
}

export async function buildStorkRoutePriceBundles<TStorkClient>(
  tx: TransactionLike,
  options: BuildStorkRoutePriceBundlesOptions<TStorkClient>
): Promise<TransactionArgument[]> {
  const feedIds = uniqueRouteFeedIds(options.hops);
  await options.updatePriceFeeds(options.storkClient, feedIds, tx);
  const priceBundles: TransactionArgument[] = [];

  for (const hop of options.hops) {
    pairFeedIds(hop.feedIds);
    const readingA = readStorkPriceA({
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      storkState: hop.storkState,
      clock: options.clock,
      pool: hop.pool
    })(tx);
    const readingB = readStorkPriceB({
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      storkState: hop.storkState,
      clock: options.clock,
      pool: hop.pool
    })(tx);

    if (hop.ammReadings !== undefined && hop.ammReadings.length > 0) {
      priceBundles.push(
        getSwapPriceBundleFromReadingPairsAndAmmReadings({
          packageId: hop.packageId,
          typeA: hop.typeA,
          typeB: hop.typeB,
          readingsA: [readingA],
          readingsB: [readingB],
          ammReadings: hop.ammReadings,
          clock: options.clock,
          pool: hop.pool
        })(tx)
      );
    } else {
      priceBundles.push(
        getSwapPriceBundleFromReadings({
          packageId: hop.packageId,
          typeA: hop.typeA,
          typeB: hop.typeB,
          readingA,
          readingB,
          clock: options.clock,
          pool: hop.pool
        })(tx)
      );
    }
  }

  return priceBundles;
}

export async function buildSupraPushRoutePriceBundles(
  tx: TransactionLike,
  options: BuildSupraPushRoutePriceBundlesOptions
): Promise<TransactionArgument[]> {
  const priceBundles: TransactionArgument[] = [];

  for (const hop of options.hops) {
    const readingA = readSupraPushPriceA({
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      supraHolder: hop.supraHolder,
      clock: options.clock,
      pool: hop.pool
    })(tx);
    const readingB = readSupraPushPriceB({
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      supraHolder: hop.supraHolder,
      clock: options.clock,
      pool: hop.pool
    })(tx);

    if (hop.ammReadings !== undefined && hop.ammReadings.length > 0) {
      priceBundles.push(
        getSwapPriceBundleFromReadingPairsAndAmmReadings({
          packageId: hop.packageId,
          typeA: hop.typeA,
          typeB: hop.typeB,
          readingsA: [readingA],
          readingsB: [readingB],
          ammReadings: hop.ammReadings,
          clock: options.clock,
          pool: hop.pool
        })(tx)
      );
    } else {
      priceBundles.push(
        getSwapPriceBundleFromReadings({
          packageId: hop.packageId,
          typeA: hop.typeA,
          typeB: hop.typeB,
          readingA,
          readingB,
          clock: options.clock,
          pool: hop.pool
        })(tx)
      );
    }
  }

  return priceBundles;
}

export async function buildSupraPullRoutePriceBundles(
  tx: TransactionLike,
  options: BuildSupraPullRoutePriceBundlesOptions
): Promise<TransactionArgument[]> {
  const priceBundles: TransactionArgument[] = [];

  for (const hop of options.hops) {
    const baseOptions = {
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      dkgState: hop.dkgState,
      supraHolder: hop.supraHolder,
      merkleRootHash: hop.merkleRootHash,
      clock: options.clock,
      proofBytes: hop.proofBytes,
      pool: hop.pool
    };

    if (hop.ammReadings !== undefined && hop.ammReadings.length > 0) {
      priceBundles.push(
        readSupraPullPriceBundleWithAmmReadings({
          ...baseOptions,
          ammReadings: hop.ammReadings
        })(tx)
      );
    } else {
      priceBundles.push(readSupraPullPriceBundle(baseOptions)(tx));
    }
  }

  return priceBundles;
}

export async function buildSupraPullRestRoutePriceBundles(
  tx: TransactionLike,
  options: BuildSupraPullRestRoutePriceBundlesOptions
): Promise<TransactionArgument[]> {
  const hops: SupraPullRoutePriceHopOptions[] = [];

  for (const hop of options.hops) {
    const requestedPairIndexes = supraPairIndexesValue(
      hop.pairIndexes,
      "Supra pull route pair indexes"
    );
    const proof = await options.fetchProof(requestedPairIndexes);
    if (!sameSupraPairIndexes(requestedPairIndexes, proof.pairIndexes)) {
      throw new Error("Supra pull proof pair indexes do not match the route hop");
    }

    hops.push({
      packageId: hop.packageId,
      typeA: hop.typeA,
      typeB: hop.typeB,
      dkgState: proof.dkgState,
      supraHolder: proof.supraHolder,
      merkleRootHash: proof.merkleRootHash,
      proofBytes: proof.proofBytes,
      pool: hop.pool,
      ...(hop.ammReadings === undefined ? {} : { ammReadings: hop.ammReadings })
    });
  }

  return buildSupraPullRoutePriceBundles(tx, {
    clock: options.clock,
    hops
  });
}

export function createPythRoutePriceProvider(
  options: CreatePythRoutePriceProviderOptions
): RoutePriceProvider<PythRoutePriceHopOptions> {
  return {
    id: "pyth",
    buildPriceBundles(tx, bundleOptions) {
      return buildPythRoutePriceBundles(tx, {
        priceFeedConnection: options.priceFeedConnection,
        pythClient: options.pythClient,
        clock: bundleOptions.clock,
        hops: bundleOptions.hops
      });
    }
  };
}

export function createSwitchboardRoutePriceProvider<
  TSwitchboardClient,
  TQuoteUpdateOptions = unknown
>(
  options: CreateSwitchboardRoutePriceProviderOptions<
    TSwitchboardClient,
    TQuoteUpdateOptions
  >
): RoutePriceProvider<SwitchboardRoutePriceHopOptions> {
  return {
    id: "switchboard",
    buildPriceBundles(tx, bundleOptions) {
      return buildSwitchboardRoutePriceBundles(tx, {
        switchboardClient: options.switchboardClient,
        fetchQuoteUpdate: options.fetchQuoteUpdate,
        quoteUpdateOptions: options.quoteUpdateOptions,
        clock: bundleOptions.clock,
        hops: bundleOptions.hops
      });
    }
  };
}

export function createSwitchboardSuiRoutePriceProvider<
  TSwitchboardClient,
  TSuiClient,
  TQuoteUpdateOptions = unknown
>(
  options: CreateSwitchboardSuiRoutePriceProviderOptions<
    TSwitchboardClient,
    TSuiClient,
    TQuoteUpdateOptions
  >
): RoutePriceProvider<SwitchboardRoutePriceHopOptions> {
  return createSwitchboardRoutePriceProvider({
    switchboardClient: createSwitchboardSuiClient(options),
    fetchQuoteUpdate: createSwitchboardQuoteUpdateFetcher(options.fetchQuoteUpdate),
    quoteUpdateOptions: options.quoteUpdateOptions
  });
}

export function createStorkRoutePriceProvider<TStorkClient>(
  options: CreateStorkRoutePriceProviderOptions<TStorkClient>
): RoutePriceProvider<StorkRoutePriceHopOptions> {
  return {
    id: "stork",
    buildPriceBundles(tx, bundleOptions) {
      return buildStorkRoutePriceBundles(tx, {
        storkClient: options.storkClient,
        updatePriceFeeds: options.updatePriceFeeds,
        clock: bundleOptions.clock,
        hops: bundleOptions.hops
      });
    }
  };
}

export function createStorkRestRoutePriceProvider(
  options: CreateStorkRestRoutePriceProviderOptions
): RoutePriceProvider<StorkRoutePriceHopOptions> {
  const updatePriceFeeds = createStorkSignedPriceUpdater({
    storkPackageId: options.storkPackageId,
    storkState: options.storkState,
    fetchSignedPrices: createStorkRestSignedPriceFetcher(options)
  });

  return {
    id: "stork-rest",
    buildPriceBundles(tx, bundleOptions) {
      return buildStorkRoutePriceBundles(tx, {
        storkClient: {},
        updatePriceFeeds,
        clock: bundleOptions.clock,
        hops: bundleOptions.hops
      });
    }
  };
}

export function createFlowXDirectAmmRoutePriceProvider<
  THop extends RoutePriceHopWithAmmReadingsOptions
>(
  options: CreateFlowXDirectAmmRoutePriceProviderOptions<THop>
): RoutePriceProvider<RoutePriceHopWithFlowXDirectAmmOptions<THop>> {
  return {
    id: options.id ?? options.routePriceProvider.id,
    buildPriceBundles(tx, bundleOptions) {
      const hops = bundleOptions.hops.map((hop) => {
        const flowxDirectAmm = hop.flowxDirectAmm ?? [];
        if (flowxDirectAmm.length === 0) {
          return hop;
        }
        const generatedAmmReadings = flowxDirectAmm.map((source) =>
          readFlowXDirectPool({
            packageId: hop.packageId,
            typeA: hop.typeA,
            typeB: hop.typeB,
            brownfiPool: hop.pool,
            flowxPool: source.flowxPool,
            clock: bundleOptions.clock,
            sourceMask: source.sourceMask,
            twapWindowSeconds: source.twapWindowSeconds,
            twalWindowSeconds: source.twalWindowSeconds,
            validForMs: source.validForMs
          })(tx)
        );
        return {
          ...hop,
          ammReadings: [
            ...((hop.ammReadings ?? []) as readonly ObjectInput[]),
            ...generatedAmmReadings
          ]
        };
      }) as THop[];

      return options.routePriceProvider.buildPriceBundles(tx, {
        clock: bundleOptions.clock,
        hops
      });
    }
  };
}

export function createFlowXTwoHopAmmRoutePriceProvider<
  THop extends RoutePriceHopWithAmmReadingsOptions
>(
  options: CreateFlowXTwoHopAmmRoutePriceProviderOptions<THop>
): RoutePriceProvider<RoutePriceHopWithFlowXTwoHopAmmOptions<THop>> {
  return {
    id: options.id ?? options.routePriceProvider.id,
    buildPriceBundles(tx, bundleOptions) {
      const hops = bundleOptions.hops.map((hop) => {
        const flowxTwoHopAmm = hop.flowxTwoHopAmm ?? [];
        if (flowxTwoHopAmm.length === 0) {
          return hop;
        }
        const generatedAmmReadings = flowxTwoHopAmm.map((source) =>
          readFlowXTwoHopPath({
            packageId: hop.packageId,
            typeA: hop.typeA,
            typeB: hop.typeB,
            typeI: source.typeI,
            brownfiPool: hop.pool,
            baseIntermediatePool: source.baseIntermediatePool,
            intermediateQuotePool: source.intermediateQuotePool,
            clock: bundleOptions.clock,
            sourceMask: source.sourceMask,
            intermediateDecimals: source.intermediateDecimals,
            twapWindowSeconds: source.twapWindowSeconds,
            twalWindowSeconds: source.twalWindowSeconds,
            validForMs: source.validForMs
          })(tx)
        );
        return {
          ...hop,
          ammReadings: [
            ...((hop.ammReadings ?? []) as readonly ObjectInput[]),
            ...generatedAmmReadings
          ]
        };
      }) as THop[];

      return options.routePriceProvider.buildPriceBundles(tx, {
        clock: bundleOptions.clock,
        hops
      });
    }
  };
}

function normalizeAmmReadingBuilderResult(
  readings: ObjectInput | readonly ObjectInput[]
): readonly ObjectInput[] {
  return Array.isArray(readings) ? readings : [readings];
}

export function createAmmReadingRoutePriceProvider<
  THop extends RoutePriceHopWithAmmReadingsOptions
>(
  options: CreateAmmReadingRoutePriceProviderOptions<THop>
): RoutePriceProvider<THop> {
  return {
    id: options.id ?? options.routePriceProvider.id,
    async buildPriceBundles(tx, bundleOptions) {
      const hops: THop[] = [];

      for (let hopIndex = 0; hopIndex < bundleOptions.hops.length; hopIndex += 1) {
        const hop = bundleOptions.hops[hopIndex];
        const generatedAmmReadings = normalizeAmmReadingBuilderResult(
          await options.buildAmmReadings(tx, {
            clock: bundleOptions.clock,
            hop,
            hopIndex
          })
        );
        if (generatedAmmReadings.length === 0) {
          hops.push(hop);
        } else {
          hops.push({
            ...hop,
            ammReadings: [
              ...((hop.ammReadings ?? []) as readonly ObjectInput[]),
              ...generatedAmmReadings
            ]
          });
        }
      }

      return options.routePriceProvider.buildPriceBundles(tx, {
        clock: bundleOptions.clock,
        hops
      });
    }
  };
}

export function createSupraPushRoutePriceProvider(): RoutePriceProvider<SupraPushRoutePriceHopOptions> {
  return {
    id: "supra-push",
    buildPriceBundles(tx, bundleOptions) {
      return buildSupraPushRoutePriceBundles(tx, {
        clock: bundleOptions.clock,
        hops: bundleOptions.hops
      });
    }
  };
}

export function createSupraPullRoutePriceProvider(): RoutePriceProvider<SupraPullRoutePriceHopOptions> {
  return {
    id: "supra-pull",
    buildPriceBundles(tx, bundleOptions) {
      return buildSupraPullRoutePriceBundles(tx, {
        clock: bundleOptions.clock,
        hops: bundleOptions.hops
      });
    }
  };
}

export function createSupraPullRestRoutePriceProvider(
  options: CreateSupraPullRestRoutePriceProviderOptions
): RoutePriceProvider<SupraPullRestRoutePriceHopOptions> {
  return {
    id: "supra-pull-rest",
    buildPriceBundles(tx, bundleOptions) {
      return buildSupraPullRestRoutePriceBundles(tx, {
        fetchProof: options.fetchProof,
        clock: bundleOptions.clock,
        hops: bundleOptions.hops
      });
    }
  };
}

function quoteExactInputForResolvedRouteHop<THop extends RoutePriceHopOptions>(
  tx: TransactionLike,
  hop: ResolvedRouteHop<THop>,
  priceBundle: TransactionArgument,
  clock: ObjectInput,
  amountIn: SuiAmountInput
): TransactionResult {
  const commonOptions = {
    packageId: hop.pair.packageId,
    typeA: hop.pair.typeA,
    typeB: hop.pair.typeB,
    priceBundle,
    clock,
    pool: hop.pair.pool,
    amountIn
  };
  const result =
    hop.direction === "a_to_b"
      ? quoteAForBWithBundle(commonOptions)(tx)
      : quoteBForAWithBundle(commonOptions)(tx);
  return result as TransactionResult;
}

export async function quoteExactInputWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: QuoteExactInputWithRegisteredRouteOptions<THop>
): Promise<RouteQuoteResults> {
  const route = resolveRoute(options.path, options.pairs);
  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: route.map((hop) => hop.pair)
  });

  let currentAmount = amountArg(tx, options.amountIn);
  const amounts: TransactionArgument[] = [currentAmount];
  const quoteResults: TransactionResult[] = [];
  for (let i = 0; i < route.length; i += 1) {
    const quoteResult = quoteExactInputForResolvedRouteHop(
      tx,
      route[i],
      routeBundleAt(priceBundles, i),
      options.clock,
      currentAmount
    );
    quoteResults.push(quoteResult);
    currentAmount = transactionResultAt(quoteResult, 0, "route output amount");
    amounts.push(currentAmount);
  }

  return { quoteResults, amounts };
}

export async function quoteExactInputWithoutCutoffWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: QuoteExactInputWithRegisteredRouteOptions<THop>
): Promise<RouteQuoteResults> {
  const route = resolveRoute(options.path, options.pairs);
  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: route.map((hop) => hop.pair)
  });

  let currentAmount = amountArg(tx, options.amountIn);
  const amounts: TransactionArgument[] = [currentAmount];
  const quoteResults: TransactionResult[] = [];
  for (let i = 0; i < route.length; i += 1) {
    const quoteResult = quoteExactInputForResolvedRouteHop(
      tx,
      route[i],
      routeBundleAt(priceBundles, i),
      options.clock,
      currentAmount
    );
    quoteResults.push(quoteResult);
    currentAmount = transactionResultAt(
      quoteResult,
      1,
      "raw route output amount"
    );
    amounts.push(currentAmount);
  }

  return { quoteResults, amounts };
}

export async function swapExactInputWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: SwapExactInputWithRegisteredRouteOptions<THop>
): Promise<TransactionArgument> {
  const route = resolveRoute(options.path, options.pairs);
  if (options.minOutputs.length !== route.length) {
    throw new Error("BrownFi exact-input route requires one min output per hop");
  }

  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: route.map((hop) => hop.pair)
  });

  let currentInput: ObjectInput = options.input;
  let result: TransactionArgument | undefined;
  for (let i = 0; i < route.length; i += 1) {
    const hop = route[i];
    const commonOptions = {
      packageId: hop.pair.packageId,
      typeA: hop.pair.typeA,
      typeB: hop.pair.typeB,
      priceBundle: routeBundleAt(priceBundles, i),
      clock: options.clock,
      pool: hop.pair.pool,
      input: currentInput,
      minOut: options.minOutputs[i]
    };
    result =
      hop.direction === "a_to_b"
        ? swapExactAForBWithBundle(commonOptions)(tx)
        : swapExactBForAWithBundle(commonOptions)(tx);
    currentInput = result;
  }

  if (result === undefined) {
    throw new Error("BrownFi route has no executable hops");
  }
  return result;
}

export async function addLiquidityWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: AddLiquidityWithRegisteredRouteOptions<THop>
): Promise<TransactionArgument> {
  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: [options.pair]
  });

  const commonOptions = {
    packageId: options.pair.packageId,
    typeA: options.pair.typeA,
    typeB: options.pair.typeB,
    priceBundle: routeBundleAt(priceBundles, 0),
    clock: options.clock,
    pool: options.pair.pool,
    inputA: options.inputA,
    inputB: options.inputB
  };
  const minADeposit = options.minADeposit;
  const minBDeposit = options.minBDeposit;
  const hasMinADeposit = minADeposit !== undefined;
  const hasMinBDeposit = minBDeposit !== undefined;
  if (hasMinADeposit !== hasMinBDeposit) {
    throw new Error(
      "BrownFi add-liquidity route requires minADeposit and minBDeposit together"
    );
  }

  if (hasMinADeposit && hasMinBDeposit) {
    return addLiquidityWithBundleWithMinDeposits({
      ...commonOptions,
      minADeposit,
      minBDeposit,
      minLpOut: options.minLpOut
    })(tx);
  }

  return addLiquidityWithBundle({
    ...commonOptions,
    minLpOut: options.minLpOut
  })(tx);
}

function quoteExactOutputForResolvedRouteHop<THop extends RoutePriceHopOptions>(
  tx: TransactionLike,
  hop: ResolvedRouteHop<THop>,
  priceBundle: TransactionArgument,
  clock: ObjectInput,
  amountOut: SuiAmountInput
): TransactionResult {
  const commonOptions = {
    packageId: hop.pair.packageId,
    typeA: hop.pair.typeA,
    typeB: hop.pair.typeB,
    priceBundle,
    clock,
    pool: hop.pair.pool,
    amountOut
  };
  const result =
    hop.direction === "a_to_b"
      ? quoteAForExactBWithBundle(commonOptions)(tx)
      : quoteBForExactAWithBundle(commonOptions)(tx);
  return result as TransactionResult;
}

export async function quoteExactOutputWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: QuoteExactOutputWithRegisteredRouteOptions<THop>
): Promise<RouteQuoteResults> {
  const route = resolveRoute(options.path, options.pairs);
  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: route.map((hop) => hop.pair)
  });

  const quoteResults = new Array<TransactionResult>(route.length);
  const amounts = new Array<TransactionArgument>(route.length + 1);
  amounts[route.length] = amountArg(tx, options.amountOut);
  for (let i = route.length - 1; i >= 0; i -= 1) {
    const quoteResult = quoteExactOutputForResolvedRouteHop(
      tx,
      route[i],
      routeBundleAt(priceBundles, i),
      options.clock,
      amounts[i + 1]
    );
    quoteResults[i] = quoteResult;
    amounts[i] = transactionResultAt(quoteResult, 0, "required route input");
    amounts[i + 1] = transactionResultAt(quoteResult, 1, "effective route output");
  }

  return { quoteResults, amounts };
}

function quoteExactOutputWithoutCutoffForResolvedRouteHop<
  THop extends RoutePriceHopOptions
>(
  tx: TransactionLike,
  hop: ResolvedRouteHop<THop>,
  priceBundle: TransactionArgument,
  clock: ObjectInput,
  amountOut: SuiAmountInput
): TransactionResult {
  const commonOptions = {
    packageId: hop.pair.packageId,
    typeA: hop.pair.typeA,
    typeB: hop.pair.typeB,
    priceBundle,
    clock,
    pool: hop.pair.pool,
    amountOut
  };
  const result =
    hop.direction === "a_to_b"
      ? quoteAForExactBWithoutCutoffWithBundle(commonOptions)(tx)
      : quoteBForExactAWithoutCutoffWithBundle(commonOptions)(tx);
  return result as TransactionResult;
}

export async function quoteExactOutputWithoutCutoffWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: QuoteExactOutputWithRegisteredRouteOptions<THop>
): Promise<RouteQuoteResults> {
  const route = resolveRoute(options.path, options.pairs);
  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: route.map((hop) => hop.pair)
  });

  const quoteResults = new Array<TransactionResult>(route.length);
  const amounts = new Array<TransactionArgument>(route.length + 1);
  amounts[route.length] = amountArg(tx, options.amountOut);
  for (let i = route.length - 1; i >= 0; i -= 1) {
    const quoteResult = quoteExactOutputWithoutCutoffForResolvedRouteHop(
      tx,
      route[i],
      routeBundleAt(priceBundles, i),
      options.clock,
      amounts[i + 1]
    );
    quoteResults[i] = quoteResult;
    amounts[i] = transactionResultAt(quoteResult, 0, "raw required route input");
  }

  return { quoteResults, amounts };
}

function quoteMaxBoundForResolvedRouteHop<THop extends RoutePriceHopOptions>(
  tx: TransactionLike,
  hop: ResolvedRouteHop<THop>,
  priceBundle: TransactionArgument,
  clock: ObjectInput
): TransactionResult {
  const commonOptions = {
    packageId: hop.pair.packageId,
    typeA: hop.pair.typeA,
    typeB: hop.pair.typeB,
    priceBundle,
    clock,
    pool: hop.pair.pool
  };
  const result =
    hop.direction === "a_to_b"
      ? quoteMaxAForBWithBundle(commonOptions)(tx)
      : quoteMaxBForAWithBundle(commonOptions)(tx);
  return result as TransactionResult;
}

export async function quoteMaxBoundWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: QuoteMaxBoundWithRegisteredRouteOptions<THop>
): Promise<RouteQuoteResults> {
  const route = resolveRoute(options.path, options.pairs);
  if (route.length !== 1) {
    throw new Error("BrownFi max-bound route quote requires exactly one hop");
  }
  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: route.map((hop) => hop.pair)
  });

  const quoteResult = quoteMaxBoundForResolvedRouteHop(
    tx,
    route[0],
    routeBundleAt(priceBundles, 0),
    options.clock
  );

  return {
    quoteResults: [quoteResult],
    amounts: [
      transactionResultAt(quoteResult, 0, "max route input"),
      transactionResultAt(quoteResult, 1, "max route output")
    ]
  };
}

function swapExactOutputForResolvedRouteHop<THop extends RoutePriceHopOptions>(
  tx: TransactionLike,
  hop: ResolvedRouteHop<THop>,
  priceBundle: TransactionArgument,
  clock: ObjectInput,
  input: ObjectInput,
  amountOut: SuiAmountInput
): TransactionResult {
  const commonOptions = {
    packageId: hop.pair.packageId,
    typeA: hop.pair.typeA,
    typeB: hop.pair.typeB,
    priceBundle,
    clock,
    pool: hop.pair.pool,
    input,
    amountOut
  };
  const result =
    hop.direction === "a_to_b"
      ? swapAForExactBWithBundle(commonOptions)(tx)
      : swapBForExactAWithBundle(commonOptions)(tx);
  return result as TransactionResult;
}

export async function swapExactOutputWithRegisteredRouteResults<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: SwapExactOutputWithRegisteredRouteOptions<THop>
): Promise<SwapExactOutputWithRegisteredRouteResults> {
  const route = resolveRoute(options.path, options.pairs);
  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: route.map((hop) => hop.pair)
  });

  const hopOutputs: SuiAmountInput[] = new Array(route.length);
  hopOutputs[route.length - 1] = options.amountOut;
  const quoteResults: TransactionResult[] = [];
  for (let i = route.length - 1; i > 0; i -= 1) {
    const quoteResult = quoteExactOutputForResolvedRouteHop(
      tx,
      route[i],
      routeBundleAt(priceBundles, i),
      options.clock,
      hopOutputs[i]
    );
    quoteResults.push(quoteResult);
    hopOutputs[i - 1] = transactionResultAt(
      quoteResult,
      0,
      "required route output"
    );
  }

  const swapResults: TransactionResult[] = [];
  const changeCoins: TransactionArgument[] = [];
  let currentInput: ObjectInput = options.input;
  let output: TransactionArgument | undefined;
  for (let i = 0; i < route.length; i += 1) {
    const swapResult = swapExactOutputForResolvedRouteHop(
      tx,
      route[i],
      routeBundleAt(priceBundles, i),
      options.clock,
      currentInput,
      hopOutputs[i]
    );
    swapResults.push(swapResult);
    changeCoins.push(transactionResultAt(swapResult, 0, "route change coin"));
    output = transactionResultAt(swapResult, 1, "route output coin");
    currentInput = output;
  }

  if (output === undefined) {
    throw new Error("BrownFi route has no executable hops");
  }
  return { quoteResults, swapResults, changeCoins, output };
}

export async function swapExactOutputWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: SwapExactOutputWithRegisteredRouteOptions<THop>
): Promise<TransactionArgument> {
  if (options.path.length - 1 > 2) {
    throw new Error("BrownFi Sui PTB route planner supports one or two hops for exact-output");
  }

  const route = resolveRoute(options.path, options.pairs);

  if (route.length === 2) {
    assertSameRoutePackage(route[0].pair, route[1].pair);
  }

  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: route.map((hop) => hop.pair)
  });

  if (route.length === 1) {
    const hop = route[0];
    const commonOptions = {
      packageId: hop.pair.packageId,
      typeA: hop.pair.typeA,
      typeB: hop.pair.typeB,
      priceBundle: routeBundleAt(priceBundles, 0),
      clock: options.clock,
      pool: hop.pair.pool,
      input: options.input,
      amountOut: options.amountOut
    };
    return hop.direction === "a_to_b"
      ? swapAForExactBWithBundle(commonOptions)(tx)
      : swapBForExactAWithBundle(commonOptions)(tx);
  }

  const isForward = route[0].direction === "a_to_b" && route[1].direction === "a_to_b";
  if (isForward) {
    const hopAB = route[0].pair;
    const hopBC = route[1].pair;
    return swapAForExactCViaBWithBundles({
      packageId: hopAB.packageId,
      typeA: hopAB.typeA,
      typeB: hopAB.typeB,
      typeC: hopBC.typeB,
      priceBundleAB: routeBundleAt(priceBundles, 0),
      priceBundleBC: routeBundleAt(priceBundles, 1),
      clock: options.clock,
      poolAB: hopAB.pool,
      poolBC: hopBC.pool,
      input: options.input,
      amountOut: options.amountOut
    })(tx);
  }

  const isReverse = route[0].direction === "b_to_a" && route[1].direction === "b_to_a";
  if (isReverse) {
    const hopBC = route[0].pair;
    const hopAB = route[1].pair;
    return swapCForExactAViaBWithBundles({
      packageId: hopAB.packageId,
      typeA: hopAB.typeA,
      typeB: hopAB.typeB,
      typeC: hopBC.typeB,
      priceBundleAB: routeBundleAt(priceBundles, 1),
      priceBundleBC: routeBundleAt(priceBundles, 0),
      clock: options.clock,
      poolAB: hopAB.pool,
      poolBC: hopBC.pool,
      input: options.input,
      amountOut: options.amountOut
    })(tx);
  }

  const hasReversedSecond = route[0].direction === "a_to_b";
  if (hasReversedSecond) {
    const hopAB = route[0].pair;
    const hopCB = route[1].pair;
    return swapAForExactCViaBWithReversedSecondBundle({
      packageId: hopAB.packageId,
      typeA: hopAB.typeA,
      typeB: hopAB.typeB,
      typeC: hopCB.typeA,
      priceBundleAB: routeBundleAt(priceBundles, 0),
      priceBundleCB: routeBundleAt(priceBundles, 1),
      clock: options.clock,
      poolAB: hopAB.pool,
      poolCB: hopCB.pool,
      input: options.input,
      amountOut: options.amountOut
    })(tx);
  }

  const hopBA = route[0].pair;
  const hopBC = route[1].pair;
  return swapAForExactCViaBWithReversedFirstBundle({
    packageId: hopBA.packageId,
    typeA: hopBA.typeB,
    typeB: hopBA.typeA,
    typeC: hopBC.typeB,
    priceBundleBA: routeBundleAt(priceBundles, 0),
    priceBundleBC: routeBundleAt(priceBundles, 1),
    clock: options.clock,
    poolBA: hopBA.pool,
    poolBC: hopBC.pool,
    input: options.input,
    amountOut: options.amountOut
  })(tx);
}

export async function preflightSwapExactInputWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightSwapExactInputWithRegisteredRouteOptions<THop, TDryRunResult>
): Promise<PreflightSwapRouteResult<TDryRunResult>> {
  const swapResult = await swapExactInputWithRegisteredRoute(options.tx, {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    input: options.input,
    minOutputs: options.minOutputs
  });
  const dryRunResult = await buildAndPreflightTransactionBlock({
    tx: options.tx,
    suiClient: options.suiClient,
    context: options.context ?? `BrownFi ${options.providerId} exact-input route preflight`
  });
  return { swapResult, dryRunResult };
}

export async function preflightSwapExactOutputWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightSwapExactOutputWithRegisteredRouteOptions<THop, TDryRunResult>
): Promise<PreflightSwapRouteResult<TDryRunResult>> {
  const swapResult = await swapExactOutputWithRegisteredRoute(options.tx, {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    input: options.input,
    amountOut: options.amountOut
  });
  const dryRunResult = await buildAndPreflightTransactionBlock({
    tx: options.tx,
    suiClient: options.suiClient,
    context: options.context ?? `BrownFi ${options.providerId} exact-output route preflight`
  });
  return { swapResult, dryRunResult };
}

export async function preflightSwapExactOutputWithRegisteredRouteResults<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightSwapExactOutputWithRegisteredRouteOptions<THop, TDryRunResult>
): Promise<PreflightSwapExactOutputRouteResults<TDryRunResult>> {
  const routeResults = await swapExactOutputWithRegisteredRouteResults(options.tx, {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    input: options.input,
    amountOut: options.amountOut
  });
  const dryRunResult = await buildAndPreflightTransactionBlock({
    tx: options.tx,
    suiClient: options.suiClient,
    context:
      options.context ?? `BrownFi ${options.providerId} exact-output route-results preflight`
  });
  return { ...routeResults, dryRunResult };
}

export async function preflightAddLiquidityWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightAddLiquidityWithRegisteredRouteOptions<THop, TDryRunResult>
): Promise<PreflightLiquidityRouteResult<TDryRunResult>> {
  const liquidityResult = await addLiquidityWithRegisteredRoute(options.tx, {
    providerRegistry: options.providerRegistry,
    providerId: options.providerId,
    clock: options.clock,
    pair: options.pair,
    inputA: options.inputA,
    inputB: options.inputB,
    minADeposit: options.minADeposit,
    minBDeposit: options.minBDeposit,
    minLpOut: options.minLpOut
  });
  const dryRunResult = await buildAndPreflightTransactionBlock({
    tx: options.tx,
    suiClient: options.suiClient,
    context: options.context ?? `BrownFi ${options.providerId} add-liquidity preflight`
  });
  return { liquidityResult, dryRunResult };
}

export function removeLiquidityWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: RemoveLiquidityWithRegisteredRouteOptions<THop>
): TransactionArgument {
  return removeLiquidityWithCoins({
    packageId: options.pair.packageId,
    typeA: options.pair.typeA,
    typeB: options.pair.typeB,
    pool: options.pair.pool,
    lpIn: options.lpIn,
    minAOut: options.minAOut,
    minBOut: options.minBOut
  })(tx);
}

export async function preflightRemoveLiquidityWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightRemoveLiquidityWithRegisteredRouteOptions<THop, TDryRunResult>
): Promise<PreflightLiquidityRouteResult<TDryRunResult>> {
  const liquidityResult = removeLiquidityWithRegisteredRoute(options.tx, {
    pair: options.pair,
    lpIn: options.lpIn,
    minAOut: options.minAOut,
    minBOut: options.minBOut
  });
  const dryRunResult = await buildAndPreflightTransactionBlock({
    tx: options.tx,
    suiClient: options.suiClient,
    context: options.context ?? "BrownFi remove-liquidity preflight"
  });
  return { liquidityResult, dryRunResult };
}

export async function zapWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: RegisteredZapRouteCase<THop>
): Promise<RegisteredRouteCaseZapTransactionResult> {
  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: [options.pair]
  });
  const commonOptions = {
    packageId: options.pair.packageId,
    typeA: options.pair.typeA,
    typeB: options.pair.typeB,
    priceBundle: routeBundleAt(priceBundles, 0),
    clock: options.clock,
    pool: options.pair.pool
  };
  const zapResult =
    options.kind === "zap-in-a"
      ? zapInAWithBundle({
          ...commonOptions,
          inputA: options.inputA,
          minBFromSwap: options.minBFromSwap,
          minLpOut: options.minLpOut
        })(tx)
      : options.kind === "zap-in-b"
        ? zapInBWithBundle({
            ...commonOptions,
            inputB: options.inputB,
            minAFromSwap: options.minAFromSwap,
            minLpOut: options.minLpOut
          })(tx)
        : options.kind === "zap-out-a"
          ? zapOutAWithBundle({
              ...commonOptions,
              lpIn: options.lpIn,
              minOut: options.minOut
            })(tx)
          : zapOutBWithBundle({
              ...commonOptions,
              lpIn: options.lpIn,
              minOut: options.minOut
            })(tx);

  return {
    name: options.name,
    kind: options.kind,
    providerId: options.providerId,
    zapResult
  };
}

export async function preflightZapWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightRegisteredZapRouteCase<THop> & {
    suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
  }
): Promise<PreflightZapRouteResult<TDryRunResult>> {
  const zapRouteResult = await zapWithRegisteredRoute(options.tx, options);
  const dryRunResult = await buildAndPreflightTransactionBlock({
    tx: options.tx,
    suiClient: options.suiClient,
    context: options.context ?? `BrownFi ${options.name} zap preflight`
  });
  return { zapResult: zapRouteResult.zapResult, dryRunResult };
}

export async function flashBorrowWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  tx: TransactionLike,
  options: RegisteredFlashBorrowRouteCase<THop>
): Promise<RegisteredRouteCaseFlashBorrowTransactionResult> {
  const provider = getRoutePriceProvider(options.providerRegistry, options.providerId);
  const priceBundles = await provider.buildPriceBundles(tx, {
    clock: options.clock,
    hops: [options.pair]
  });
  const priceBundle = routeBundleAt(priceBundles, 0);
  const commonOptions = {
    packageId: options.pair.packageId,
    typeA: options.pair.typeA,
    typeB: options.pair.typeB,
    priceBundle,
    clock: options.clock,
    pool: options.pair.pool
  };
  const flashResult =
    options.kind === "flash-borrow-a"
      ? borrowAWithCoinResults({ ...commonOptions, amount: options.amount })(tx)
      : borrowBWithCoinResults({ ...commonOptions, amount: options.amount })(tx);
  const repayResult =
    options.kind === "flash-borrow-a"
      ? repayAWithBorrowedCoinAndFee({
          ...commonOptions,
          borrowed: flashResult.borrowed,
          feeCoin: options.feeCoin,
          receipt: flashResult.receipt
        })(tx)
      : repayBWithBorrowedCoinAndFee({
          ...commonOptions,
          borrowed: flashResult.borrowed,
          feeCoin: options.feeCoin,
          receipt: flashResult.receipt
        })(tx);

  return {
    name: options.name,
    kind: options.kind,
    providerId: options.providerId,
    flashResult,
    repayResult
  };
}

export async function preflightFlashBorrowWithRegisteredRoute<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightRegisteredFlashBorrowRouteCase<THop> & {
    suiClient: SuiDryRunTransactionBlockClient<TDryRunResult>;
  }
): Promise<PreflightFlashBorrowRouteResult<TDryRunResult>> {
  const flashRouteResult = await flashBorrowWithRegisteredRoute(options.tx, options);
  const dryRunResult = await buildAndPreflightTransactionBlock({
    tx: options.tx,
    suiClient: options.suiClient,
    context: options.context ?? `BrownFi ${options.name} flash preflight`
  });
  return { ...flashRouteResult, dryRunResult };
}

export async function buildRegisteredRouteCaseTransaction<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  routeCase: PreflightRegisteredRouteCase<THop>
): Promise<RegisteredRouteCaseTransactionResult> {
  if (routeCase.kind === "exact-input") {
    const swapResult = await swapExactInputWithRegisteredRoute(routeCase.tx, {
      providerRegistry: routeCase.providerRegistry,
      providerId: routeCase.providerId,
      clock: routeCase.clock,
      path: routeCase.path,
      pairs: routeCase.pairs,
      input: routeCase.input,
      minOutputs: routeCase.minOutputs
    });
    return {
      name: routeCase.name,
      kind: routeCase.kind,
      providerId: routeCase.providerId,
      swapResult
    };
  }

  if (routeCase.kind === "exact-output-results") {
    const routeResults = await swapExactOutputWithRegisteredRouteResults(routeCase.tx, {
      providerRegistry: routeCase.providerRegistry,
      providerId: routeCase.providerId,
      clock: routeCase.clock,
      path: routeCase.path,
      pairs: routeCase.pairs,
      input: routeCase.input,
      amountOut: routeCase.amountOut
    });
    return {
      name: routeCase.name,
      kind: routeCase.kind,
      providerId: routeCase.providerId,
      ...routeResults
    };
  }

  if (routeCase.kind === "add-liquidity") {
    const liquidityResult = await addLiquidityWithRegisteredRoute(routeCase.tx, {
      providerRegistry: routeCase.providerRegistry,
      providerId: routeCase.providerId,
      clock: routeCase.clock,
      pair: routeCase.pair,
      inputA: routeCase.inputA,
      inputB: routeCase.inputB,
      minADeposit: routeCase.minADeposit,
      minBDeposit: routeCase.minBDeposit,
      minLpOut: routeCase.minLpOut
    });
    return {
      name: routeCase.name,
      kind: routeCase.kind,
      providerId: routeCase.providerId,
      liquidityResult
    };
  }

  if (routeCase.kind === "remove-liquidity") {
    const liquidityResult = removeLiquidityWithRegisteredRoute(routeCase.tx, {
      pair: routeCase.pair,
      lpIn: routeCase.lpIn,
      minAOut: routeCase.minAOut,
      minBOut: routeCase.minBOut
    });
    return {
      name: routeCase.name,
      kind: routeCase.kind,
      providerId: routeCase.providerId,
      liquidityResult
    };
  }

  if (
    routeCase.kind === "zap-in-a" ||
    routeCase.kind === "zap-in-b" ||
    routeCase.kind === "zap-out-a" ||
    routeCase.kind === "zap-out-b"
  ) {
    return zapWithRegisteredRoute(routeCase.tx, routeCase);
  }

  if (routeCase.kind === "flash-borrow-a" || routeCase.kind === "flash-borrow-b") {
    return flashBorrowWithRegisteredRoute(routeCase.tx, routeCase);
  }

  if (routeCase.kind === "exact-output") {
    const swapResult = await swapExactOutputWithRegisteredRoute(routeCase.tx, {
      providerRegistry: routeCase.providerRegistry,
      providerId: routeCase.providerId,
      clock: routeCase.clock,
      path: routeCase.path,
      pairs: routeCase.pairs,
      input: routeCase.input,
      amountOut: routeCase.amountOut
    });
    return {
      name: routeCase.name,
      kind: routeCase.kind,
      providerId: routeCase.providerId,
      swapResult
    };
  }

  throw new Error(
    `Unsupported BrownFi registered route case kind: ${String(
      (routeCase as { kind?: unknown }).kind
    )}`
  );
}

export async function buildRegisteredRouteCaseTransactions<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: BuildRegisteredRouteCaseTransactionsOptions<THop>
): Promise<RegisteredRouteCaseTransactionResult[]> {
  const results: RegisteredRouteCaseTransactionResult[] = [];
  for (const routeCase of options.cases) {
    results.push(await buildRegisteredRouteCaseTransaction(routeCase));
  }
  return results;
}

export function buildRegisteredRoutePreflightCases<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(
  options: BuildRegisteredRoutePreflightCasesOptions<THop>
): PreflightRegisteredRouteCase<THop>[] {
  return options.cases.map((routeCase, index) => {
    const buildCommonOptions = () => {
      const tx = options.txFactory(routeCase, index);
      return {
        name: routeCase.name,
        tx,
        providerRegistry: options.providerRegistry,
        providerId: routeCase.providerId,
        clock: routeCase.clock,
        path: routeCase.path,
        pairs: routeCase.pairs,
        recipient: routeCase.recipient,
        context: routeCase.context
      };
    };
    const validateCommonOptions = () => {
      getRoutePriceProvider(options.providerRegistry, routeCase.providerId);
      validateLaunchRouteLimits(
        routeCase.name,
        routeCase.path,
        routeCase.pairs,
        options.routeLimits
      );
    };

    if (routeCase.kind === "exact-input") {
      if (routeCase.minOutputs === undefined) {
        throw new Error("BrownFi exact-input preflight config requires minOutputs");
      }
      if (routeCase.amountOut !== undefined) {
        throw new Error("BrownFi exact-input preflight config must not set amountOut");
      }
      validateCommonOptions();
      return {
        ...buildCommonOptions(),
        kind: "exact-input",
        input: routeCase.input,
        minOutputs: routeCase.minOutputs
      };
    }

    if (routeCase.kind === "exact-output") {
      if (routeCase.amountOut === undefined) {
        throw new Error("BrownFi exact-output preflight config requires amountOut");
      }
      if (routeCase.minOutputs !== undefined) {
        throw new Error("BrownFi exact-output preflight config must not set minOutputs");
      }
      validateCommonOptions();
      return {
        ...buildCommonOptions(),
        kind: "exact-output",
        input: routeCase.input,
        amountOut: routeCase.amountOut
      };
    }

    if (routeCase.kind === "exact-output-results") {
      if (routeCase.amountOut === undefined) {
        throw new Error("BrownFi exact-output preflight config requires amountOut");
      }
      if (routeCase.minOutputs !== undefined) {
        throw new Error("BrownFi exact-output preflight config must not set minOutputs");
      }
      validateCommonOptions();
      return {
        ...buildCommonOptions(),
        kind: "exact-output-results",
        input: routeCase.input,
        amountOut: routeCase.amountOut
      };
    }

    if (routeCase.kind === "add-liquidity") {
      if (routeCase.inputB === undefined) {
        throw new Error("BrownFi add-liquidity preflight config requires inputB");
      }
      if (routeCase.minLpOut === undefined) {
        throw new Error("BrownFi add-liquidity preflight config requires minLpOut");
      }
      if (routeCase.amountOut !== undefined) {
        throw new Error("BrownFi add-liquidity preflight config must not set amountOut");
      }
      if (routeCase.minOutputs !== undefined) {
        throw new Error("BrownFi add-liquidity preflight config must not set minOutputs");
      }
      if (
        (routeCase.minADeposit === undefined) !==
        (routeCase.minBDeposit === undefined)
      ) {
        throw new Error(
          "BrownFi add-liquidity preflight config requires minADeposit and minBDeposit together"
        );
      }
      validateCommonOptions();
      const route = resolveRoute(routeCase.path, routeCase.pairs);
      if (route.length !== 1) {
        throw new Error("BrownFi add-liquidity preflight config requires exactly one pair");
      }
      if (route[0].direction !== "a_to_b") {
        throw new Error("BrownFi add-liquidity preflight config path must match pair type order");
      }
      const commonOptions = buildCommonOptions();
      return {
        name: commonOptions.name,
        kind: "add-liquidity",
        tx: commonOptions.tx,
        providerRegistry: commonOptions.providerRegistry,
        providerId: commonOptions.providerId,
        clock: commonOptions.clock,
        pair: route[0].pair,
        inputA: routeCase.input,
        inputB: routeCase.inputB,
        minADeposit: routeCase.minADeposit,
        minBDeposit: routeCase.minBDeposit,
        minLpOut: routeCase.minLpOut,
        recipient: commonOptions.recipient,
        context: commonOptions.context
      };
    }

    if (routeCase.kind === "remove-liquidity") {
      if (routeCase.minAOut === undefined) {
        throw new Error("BrownFi remove-liquidity preflight config requires minAOut");
      }
      if (routeCase.minBOut === undefined) {
        throw new Error("BrownFi remove-liquidity preflight config requires minBOut");
      }
      if (routeCase.amountOut !== undefined) {
        throw new Error("BrownFi remove-liquidity preflight config must not set amountOut");
      }
      if (routeCase.inputB !== undefined) {
        throw new Error("BrownFi remove-liquidity preflight config must not set inputB");
      }
      if (routeCase.minLpOut !== undefined) {
        throw new Error("BrownFi remove-liquidity preflight config must not set minLpOut");
      }
      if (routeCase.minOutputs !== undefined) {
        throw new Error("BrownFi remove-liquidity preflight config must not set minOutputs");
      }
      validateCommonOptions();
      const route = resolveRoute(routeCase.path, routeCase.pairs);
      if (route.length !== 1) {
        throw new Error("BrownFi remove-liquidity preflight config requires exactly one pair");
      }
      if (route[0].direction !== "a_to_b") {
        throw new Error(
          "BrownFi remove-liquidity preflight config path must match pair type order"
        );
      }
      const commonOptions = buildCommonOptions();
      return {
        name: commonOptions.name,
        kind: "remove-liquidity",
        tx: commonOptions.tx,
        providerId: commonOptions.providerId,
        pair: route[0].pair,
        lpIn: routeCase.input,
        minAOut: routeCase.minAOut,
        minBOut: routeCase.minBOut,
        recipient: commonOptions.recipient,
        context: commonOptions.context
      };
    }

    if (routeCase.kind === "zap-in-a") {
      if (routeCase.minBFromSwap === undefined) {
        throw new Error("BrownFi zap-in-a preflight config requires minBFromSwap");
      }
      if (routeCase.minLpOut === undefined) {
        throw new Error("BrownFi zap-in-a preflight config requires minLpOut");
      }
      if (routeCase.amount !== undefined) {
        throw new Error("BrownFi zap-in-a preflight config must not set amount");
      }
      if (routeCase.amountOut !== undefined) {
        throw new Error("BrownFi zap-in-a preflight config must not set amountOut");
      }
      if (routeCase.feeCoin !== undefined) {
        throw new Error("BrownFi zap-in-a preflight config must not set feeCoin");
      }
      if (routeCase.inputB !== undefined) {
        throw new Error("BrownFi zap-in-a preflight config must not set inputB");
      }
      if (routeCase.minAFromSwap !== undefined) {
        throw new Error("BrownFi zap-in-a preflight config must not set minAFromSwap");
      }
      if (routeCase.minAOut !== undefined) {
        throw new Error("BrownFi zap-in-a preflight config must not set minAOut");
      }
      if (routeCase.minBOut !== undefined) {
        throw new Error("BrownFi zap-in-a preflight config must not set minBOut");
      }
      if (routeCase.minOut !== undefined) {
        throw new Error("BrownFi zap-in-a preflight config must not set minOut");
      }
      if (routeCase.minOutputs !== undefined) {
        throw new Error("BrownFi zap-in-a preflight config must not set minOutputs");
      }
      validateCommonOptions();
      const route = resolveRoute(routeCase.path, routeCase.pairs);
      if (route.length !== 1) {
        throw new Error("BrownFi zap-in-a preflight config requires exactly one pair");
      }
      if (route[0].direction !== "a_to_b") {
        throw new Error("BrownFi zap-in-a preflight config path must match pair type order");
      }
      const commonOptions = buildCommonOptions();
      return {
        name: commonOptions.name,
        kind: "zap-in-a",
        tx: commonOptions.tx,
        providerRegistry: commonOptions.providerRegistry,
        providerId: commonOptions.providerId,
        clock: commonOptions.clock,
        pair: route[0].pair,
        inputA: routeCase.input,
        minBFromSwap: routeCase.minBFromSwap,
        minLpOut: routeCase.minLpOut,
        recipient: commonOptions.recipient,
        context: commonOptions.context
      };
    }

    if (routeCase.kind === "zap-in-b") {
      if (routeCase.minAFromSwap === undefined) {
        throw new Error("BrownFi zap-in-b preflight config requires minAFromSwap");
      }
      if (routeCase.minLpOut === undefined) {
        throw new Error("BrownFi zap-in-b preflight config requires minLpOut");
      }
      if (routeCase.amount !== undefined) {
        throw new Error("BrownFi zap-in-b preflight config must not set amount");
      }
      if (routeCase.amountOut !== undefined) {
        throw new Error("BrownFi zap-in-b preflight config must not set amountOut");
      }
      if (routeCase.feeCoin !== undefined) {
        throw new Error("BrownFi zap-in-b preflight config must not set feeCoin");
      }
      if (routeCase.inputB !== undefined) {
        throw new Error("BrownFi zap-in-b preflight config must not set inputB");
      }
      if (routeCase.minAOut !== undefined) {
        throw new Error("BrownFi zap-in-b preflight config must not set minAOut");
      }
      if (routeCase.minBFromSwap !== undefined) {
        throw new Error("BrownFi zap-in-b preflight config must not set minBFromSwap");
      }
      if (routeCase.minBOut !== undefined) {
        throw new Error("BrownFi zap-in-b preflight config must not set minBOut");
      }
      if (routeCase.minOut !== undefined) {
        throw new Error("BrownFi zap-in-b preflight config must not set minOut");
      }
      if (routeCase.minOutputs !== undefined) {
        throw new Error("BrownFi zap-in-b preflight config must not set minOutputs");
      }
      validateCommonOptions();
      const route = resolveRoute(routeCase.path, routeCase.pairs);
      if (route.length !== 1) {
        throw new Error("BrownFi zap-in-b preflight config requires exactly one pair");
      }
      if (route[0].direction !== "a_to_b") {
        throw new Error("BrownFi zap-in-b preflight config path must match pair type order");
      }
      const commonOptions = buildCommonOptions();
      return {
        name: commonOptions.name,
        kind: "zap-in-b",
        tx: commonOptions.tx,
        providerRegistry: commonOptions.providerRegistry,
        providerId: commonOptions.providerId,
        clock: commonOptions.clock,
        pair: route[0].pair,
        inputB: routeCase.input,
        minAFromSwap: routeCase.minAFromSwap,
        minLpOut: routeCase.minLpOut,
        recipient: commonOptions.recipient,
        context: commonOptions.context
      };
    }

    if (routeCase.kind === "zap-out-a" || routeCase.kind === "zap-out-b") {
      if (routeCase.minOut === undefined) {
        throw new Error("BrownFi zap-out preflight config requires minOut");
      }
      if (routeCase.amount !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set amount");
      }
      if (routeCase.amountOut !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set amountOut");
      }
      if (routeCase.feeCoin !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set feeCoin");
      }
      if (routeCase.inputB !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set inputB");
      }
      if (routeCase.minAFromSwap !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set minAFromSwap");
      }
      if (routeCase.minAOut !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set minAOut");
      }
      if (routeCase.minBFromSwap !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set minBFromSwap");
      }
      if (routeCase.minBOut !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set minBOut");
      }
      if (routeCase.minLpOut !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set minLpOut");
      }
      if (routeCase.minOutputs !== undefined) {
        throw new Error("BrownFi zap-out preflight config must not set minOutputs");
      }
      validateCommonOptions();
      const route = resolveRoute(routeCase.path, routeCase.pairs);
      if (route.length !== 1) {
        throw new Error("BrownFi zap-out preflight config requires exactly one pair");
      }
      if (route[0].direction !== "a_to_b") {
        throw new Error("BrownFi zap-out preflight config path must match pair type order");
      }
      const commonOptions = buildCommonOptions();
      return {
        name: commonOptions.name,
        kind: routeCase.kind,
        tx: commonOptions.tx,
        providerRegistry: commonOptions.providerRegistry,
        providerId: commonOptions.providerId,
        clock: commonOptions.clock,
        pair: route[0].pair,
        lpIn: routeCase.input,
        minOut: routeCase.minOut,
        recipient: commonOptions.recipient,
        context: commonOptions.context
      };
    }

    if (routeCase.kind === "flash-borrow-a" || routeCase.kind === "flash-borrow-b") {
      if (routeCase.amount === undefined) {
        throw new Error("BrownFi flash preflight config requires amount");
      }
      if (routeCase.feeCoin === undefined) {
        throw new Error("BrownFi flash preflight config requires feeCoin");
      }
      if (routeCase.input !== undefined) {
        throw new Error("BrownFi flash preflight config must not set input");
      }
      if (routeCase.amountOut !== undefined) {
        throw new Error("BrownFi flash preflight config must not set amountOut");
      }
      if (routeCase.inputB !== undefined) {
        throw new Error("BrownFi flash preflight config must not set inputB");
      }
      if (routeCase.minAOut !== undefined) {
        throw new Error("BrownFi flash preflight config must not set minAOut");
      }
      if (routeCase.minBOut !== undefined) {
        throw new Error("BrownFi flash preflight config must not set minBOut");
      }
      if (routeCase.minLpOut !== undefined) {
        throw new Error("BrownFi flash preflight config must not set minLpOut");
      }
      if (routeCase.minOutputs !== undefined) {
        throw new Error("BrownFi flash preflight config must not set minOutputs");
      }
      validateCommonOptions();
      const route = resolveRoute(routeCase.path, routeCase.pairs);
      if (route.length !== 1) {
        throw new Error("BrownFi flash preflight config requires exactly one pair");
      }
      if (route[0].direction !== "a_to_b") {
        throw new Error("BrownFi flash preflight config path must match pair type order");
      }
      const commonOptions = buildCommonOptions();
      return {
        name: commonOptions.name,
        kind: routeCase.kind,
        tx: commonOptions.tx,
        providerRegistry: commonOptions.providerRegistry,
        providerId: commonOptions.providerId,
        clock: commonOptions.clock,
        pair: route[0].pair,
        amount: routeCase.amount,
        feeCoin: routeCase.feeCoin,
        recipient: commonOptions.recipient,
        context: commonOptions.context
      };
    }

    throw new Error(
      `Unsupported BrownFi registered route preflight case kind: ${String(
        (routeCase as { kind?: unknown }).kind
      )}`
    );
  });
}

interface RegisteredRouteCaseOutputTransferGroup {
  recipient: string;
  outputs: readonly (TransactionArgument | undefined)[];
}

function transactionArgumentResultAt(
  result: TransactionArgument,
  index: number,
  fieldName: string
): TransactionArgument {
  return transactionResultAt(result as TransactionResult, index, fieldName);
}

function registeredRouteCaseResultOutputs(
  routeResult: RegisteredRouteCaseTransactionResult
): TransactionArgument[] {
  if (routeResult.kind === "exact-input") {
    return [routeResult.swapResult];
  }
  if (routeResult.kind === "exact-output-results") {
    return [...routeResult.changeCoins, routeResult.output];
  }
  if (routeResult.kind === "add-liquidity") {
    return [
      transactionArgumentResultAt(
        routeResult.liquidityResult,
        0,
        "add-liquidity remaining coin A"
      ),
      transactionArgumentResultAt(
        routeResult.liquidityResult,
        1,
        "add-liquidity remaining coin B"
      ),
      transactionArgumentResultAt(routeResult.liquidityResult, 2, "add-liquidity LP coin")
    ];
  }
  if (routeResult.kind === "remove-liquidity") {
    return [
      transactionArgumentResultAt(routeResult.liquidityResult, 0, "remove-liquidity coin A"),
      transactionArgumentResultAt(routeResult.liquidityResult, 1, "remove-liquidity coin B")
    ];
  }
  if (routeResult.kind === "zap-in-a" || routeResult.kind === "zap-in-b") {
    return [
      transactionArgumentResultAt(routeResult.zapResult, 0, "zap-in remaining input-side coin"),
      transactionArgumentResultAt(routeResult.zapResult, 1, "zap-in remaining paired coin"),
      transactionArgumentResultAt(routeResult.zapResult, 2, "zap-in LP coin")
    ];
  }
  if (routeResult.kind === "zap-out-a" || routeResult.kind === "zap-out-b") {
    return [routeResult.zapResult];
  }
  if (routeResult.kind === "flash-borrow-a" || routeResult.kind === "flash-borrow-b") {
    return [];
  }
  if (routeResult.kind === "exact-output") {
    const swapResult = routeResult.swapResult as Partial<Record<number, TransactionArgument>>;
    if (swapResult[2] !== undefined) {
      return [
        transactionArgumentResultAt(routeResult.swapResult, 0, "exact-output input change coin"),
        transactionArgumentResultAt(
          routeResult.swapResult,
          1,
          "exact-output intermediate change coin"
        ),
        transactionArgumentResultAt(routeResult.swapResult, 2, "exact-output output coin")
      ];
    }
    if (swapResult[0] !== undefined && swapResult[1] !== undefined) {
      return [
        transactionArgumentResultAt(routeResult.swapResult, 0, "exact-output change coin"),
        transactionArgumentResultAt(routeResult.swapResult, 1, "exact-output output coin")
      ];
    }
    return [routeResult.swapResult];
  }
  throw new Error(
    `Unsupported BrownFi registered route case kind: ${String(
      (routeResult as { kind?: unknown }).kind
    )}`
  );
}

function registeredRouteCaseResultTransferGroups(
  routeResult: RegisteredRouteCaseTransactionResult,
  senderAddress: string,
  recipientAddress?: string
): RegisteredRouteCaseOutputTransferGroup[] {
  const defaultRecipient = recipientAddress ?? senderAddress;
  if (recipientAddress === undefined || recipientAddress === senderAddress) {
    return [{ recipient: senderAddress, outputs: registeredRouteCaseResultOutputs(routeResult) }];
  }
  if (routeResult.kind === "exact-input") {
    return [{ recipient: recipientAddress, outputs: [routeResult.swapResult] }];
  }
  if (routeResult.kind === "exact-output-results") {
    return [
      { recipient: senderAddress, outputs: routeResult.changeCoins },
      { recipient: recipientAddress, outputs: [routeResult.output] }
    ];
  }
  if (routeResult.kind === "add-liquidity") {
    return [
      {
        recipient: senderAddress,
        outputs: [
          transactionArgumentResultAt(
            routeResult.liquidityResult,
            0,
            "add-liquidity remaining coin A"
          ),
          transactionArgumentResultAt(
            routeResult.liquidityResult,
            1,
            "add-liquidity remaining coin B"
          )
        ]
      },
      {
        recipient: recipientAddress,
        outputs: [
          transactionArgumentResultAt(routeResult.liquidityResult, 2, "add-liquidity LP coin")
        ]
      }
    ];
  }
  if (routeResult.kind === "remove-liquidity") {
    return [{ recipient: recipientAddress, outputs: registeredRouteCaseResultOutputs(routeResult) }];
  }
  if (routeResult.kind === "zap-in-a" || routeResult.kind === "zap-in-b") {
    return [
      {
        recipient: senderAddress,
        outputs: [
          transactionArgumentResultAt(routeResult.zapResult, 0, "zap-in remaining input-side coin"),
          transactionArgumentResultAt(routeResult.zapResult, 1, "zap-in remaining paired coin")
        ]
      },
      {
        recipient: recipientAddress,
        outputs: [transactionArgumentResultAt(routeResult.zapResult, 2, "zap-in LP coin")]
      }
    ];
  }
  if (routeResult.kind === "zap-out-a" || routeResult.kind === "zap-out-b") {
    return [{ recipient: recipientAddress, outputs: [routeResult.zapResult] }];
  }
  if (routeResult.kind === "flash-borrow-a" || routeResult.kind === "flash-borrow-b") {
    return [];
  }
  if (routeResult.kind === "exact-output") {
    const swapResult = routeResult.swapResult as Partial<Record<number, TransactionArgument>>;
    if (swapResult[2] !== undefined) {
      return [
        {
          recipient: senderAddress,
          outputs: [
            transactionArgumentResultAt(
              routeResult.swapResult,
              0,
              "exact-output input change coin"
            ),
            transactionArgumentResultAt(
              routeResult.swapResult,
              1,
              "exact-output intermediate change coin"
            )
          ]
        },
        {
          recipient: recipientAddress,
          outputs: [
            transactionArgumentResultAt(routeResult.swapResult, 2, "exact-output output coin")
          ]
        }
      ];
    }
    if (swapResult[0] !== undefined && swapResult[1] !== undefined) {
      return [
        {
          recipient: senderAddress,
          outputs: [
            transactionArgumentResultAt(routeResult.swapResult, 0, "exact-output change coin")
          ]
        },
        {
          recipient: recipientAddress,
          outputs: [
            transactionArgumentResultAt(routeResult.swapResult, 1, "exact-output output coin")
          ]
        }
      ];
    }
    return [{ recipient: defaultRecipient, outputs: [routeResult.swapResult] }];
  }
  throw new Error(
    `Unsupported BrownFi registered route case kind: ${String(
      (routeResult as { kind?: unknown }).kind
    )}`
  );
}

function optionalRegisteredRoutePreflightRecipient(routeCase: {
  recipient?: string;
}): string | undefined {
  if (routeCase.recipient === undefined) return undefined;
  if (typeof routeCase.recipient !== "string" || routeCase.recipient.length === 0) {
    throw new Error("BrownFi route preflight recipient must be a non-empty address when present");
  }
  return routeCase.recipient;
}

function transferRegisteredRouteCaseResultOutputs(
  tx: TransactionLike,
  routeResult: RegisteredRouteCaseTransactionResult,
  options: { transferRecipient?: string; recipient?: string }
): void {
  const senderAddress = options.transferRecipient;
  if (senderAddress === undefined) return;
  if (typeof senderAddress !== "string" || senderAddress.length === 0) {
    throw new Error("BrownFi route preflight transferRecipient must be a non-empty address");
  }
  const recipientAddress = optionalRegisteredRoutePreflightRecipient(options);
  const groups = registeredRouteCaseResultTransferGroups(
    routeResult,
    senderAddress,
    recipientAddress
  );
  const nonEmptyGroups = groups
    .map((group) => ({
      recipient: group.recipient,
      outputs: group.outputs.filter(
        (output): output is TransactionArgument => output !== undefined
      )
    }))
    .filter((group) => group.outputs.length > 0);
  if (nonEmptyGroups.length === 0) return;
  if (typeof tx.transferObjects !== "function") {
    throw new Error("BrownFi route preflight transaction builder must support transferObjects");
  }
  if (typeof tx.pure.address !== "function") {
    throw new Error("BrownFi route preflight transaction builder must support pure address values");
  }

  for (const group of nonEmptyGroups) {
    tx.transferObjects(group.outputs, tx.pure.address(group.recipient));
  }
}

function registeredRouteCasePreflightContext<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions
>(routeCase: PreflightRegisteredRouteCase<THop>): string {
  if (routeCase.context !== undefined) return routeCase.context;
  if (routeCase.kind === "exact-input") {
    return `BrownFi ${routeCase.name} exact-input route preflight`;
  }
  if (routeCase.kind === "exact-output-results") {
    return `BrownFi ${routeCase.name} exact-output route-results preflight`;
  }
  if (routeCase.kind === "add-liquidity") {
    return `BrownFi ${routeCase.name} add-liquidity preflight`;
  }
  if (routeCase.kind === "remove-liquidity") {
    return `BrownFi ${routeCase.name} remove-liquidity preflight`;
  }
  if (
    routeCase.kind === "zap-in-a" ||
    routeCase.kind === "zap-in-b" ||
    routeCase.kind === "zap-out-a" ||
    routeCase.kind === "zap-out-b"
  ) {
    return `BrownFi ${routeCase.name} zap preflight`;
  }
  if (routeCase.kind === "flash-borrow-a" || routeCase.kind === "flash-borrow-b") {
    return `BrownFi ${routeCase.name} flash preflight`;
  }
  return `BrownFi ${routeCase.name} exact-output route preflight`;
}

export async function preflightRegisteredRouteCases<
  THop extends RoutePriceHopOptions = RoutePriceHopOptions,
  TDryRunResult = unknown
>(
  options: PreflightRegisteredRouteCasesOptions<THop, TDryRunResult>
): Promise<PreflightRegisteredRouteCaseResult<TDryRunResult>[]> {
  const results: PreflightRegisteredRouteCaseResult<TDryRunResult>[] = [];
  for (const routeCase of options.cases) {
    const routeResult = await buildRegisteredRouteCaseTransaction(routeCase);
    transferRegisteredRouteCaseResultOutputs(routeCase.tx, routeResult, {
      transferRecipient: options.transferRecipient,
      recipient: routeCase.recipient
    });
    const dryRunResult = await buildAndPreflightTransactionBlock({
      tx: routeCase.tx,
      suiClient: options.suiClient,
      context: registeredRouteCasePreflightContext(routeCase)
    });
    results.push(
      {
        ...routeResult,
        dryRunResult
      } as PreflightRegisteredRouteCaseResult<TDryRunResult>
    );
  }
  return results;
}

function createPythOnlyRoutePriceProviderRegistry(
  options: PythRouteProviderOptions
): RoutePriceProviderRegistry<PythRoutePriceHopOptions> {
  return createRoutePriceProviderRegistry([
    createPythRoutePriceProvider({
      priceFeedConnection: options.priceFeedConnection,
      pythClient: options.pythClient
    })
  ]);
}

export async function swapExactInputWithPythRoute(
  tx: TransactionLike,
  options: SwapExactInputWithPythRouteOptions
): Promise<TransactionArgument> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return swapExactInputWithRegisteredRoute(tx, {
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    input: options.input,
    minOutputs: options.minOutputs
  });
}

export async function swapExactOutputWithPythRoute(
  tx: TransactionLike,
  options: SwapExactOutputWithPythRouteOptions
): Promise<TransactionArgument> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return swapExactOutputWithRegisteredRoute(tx, {
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    input: options.input,
    amountOut: options.amountOut
  });
}

export async function swapExactOutputWithPythRouteResults(
  tx: TransactionLike,
  options: SwapExactOutputWithPythRouteOptions
): Promise<SwapExactOutputWithRegisteredRouteResults> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return swapExactOutputWithRegisteredRouteResults(tx, {
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    input: options.input,
    amountOut: options.amountOut
  });
}

export async function quoteExactInputWithPythRoute(
  tx: TransactionLike,
  options: QuoteExactInputWithPythRouteOptions
): Promise<RouteQuoteResults> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return quoteExactInputWithRegisteredRoute(tx, {
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    amountIn: options.amountIn
  });
}

export async function quoteExactInputWithoutCutoffWithPythRoute(
  tx: TransactionLike,
  options: QuoteExactInputWithPythRouteOptions
): Promise<RouteQuoteResults> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return quoteExactInputWithoutCutoffWithRegisteredRoute(tx, {
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    amountIn: options.amountIn
  });
}

export async function quoteMaxBoundWithPythRoute(
  tx: TransactionLike,
  options: QuoteMaxBoundWithPythRouteOptions
): Promise<RouteQuoteResults> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return quoteMaxBoundWithRegisteredRoute(tx, {
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    path: options.path,
    pairs: options.pairs
  });
}

export async function quoteExactOutputWithPythRoute(
  tx: TransactionLike,
  options: QuoteExactOutputWithPythRouteOptions
): Promise<RouteQuoteResults> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return quoteExactOutputWithRegisteredRoute(tx, {
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    amountOut: options.amountOut
  });
}

export async function quoteExactOutputWithoutCutoffWithPythRoute(
  tx: TransactionLike,
  options: QuoteExactOutputWithPythRouteOptions
): Promise<RouteQuoteResults> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return quoteExactOutputWithoutCutoffWithRegisteredRoute(tx, {
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    path: options.path,
    pairs: options.pairs,
    amountOut: options.amountOut
  });
}

export async function addLiquidityWithPythRoute(
  tx: TransactionLike,
  options: AddLiquidityWithPythRouteOptions
): Promise<TransactionArgument> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return addLiquidityWithRegisteredRoute(tx, {
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    pair: options.pair,
    inputA: options.inputA,
    inputB: options.inputB,
    minADeposit: options.minADeposit,
    minBDeposit: options.minBDeposit,
    minLpOut: options.minLpOut
  });
}

export function removeLiquidityWithPythRoute(
  tx: TransactionLike,
  options: RemoveLiquidityWithPythRouteOptions
): TransactionArgument {
  return removeLiquidityWithRegisteredRoute(tx, options);
}

export async function zapWithPythRoute(
  tx: TransactionLike,
  options: ZapWithPythRouteOptions
): Promise<RegisteredRouteCaseZapTransactionResult> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  const commonOptions = {
    name: options.name ?? `pyth ${options.kind} route`,
    tx,
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    pair: options.pair
  };
  if (options.kind === "zap-in-a") {
    return zapWithRegisteredRoute(tx, {
      ...commonOptions,
      kind: options.kind,
      inputA: options.inputA,
      minBFromSwap: options.minBFromSwap,
      minLpOut: options.minLpOut
    });
  }
  if (options.kind === "zap-in-b") {
    return zapWithRegisteredRoute(tx, {
      ...commonOptions,
      kind: options.kind,
      inputB: options.inputB,
      minAFromSwap: options.minAFromSwap,
      minLpOut: options.minLpOut
    });
  }
  return zapWithRegisteredRoute(tx, {
    ...commonOptions,
    kind: options.kind,
    lpIn: options.lpIn,
    minOut: options.minOut
  });
}

export async function flashBorrowWithPythRoute(
  tx: TransactionLike,
  options: FlashBorrowWithPythRouteOptions
): Promise<RegisteredRouteCaseFlashBorrowTransactionResult> {
  const providerRegistry = createPythOnlyRoutePriceProviderRegistry(options);
  return flashBorrowWithRegisteredRoute(tx, {
    name: options.name ?? `pyth ${options.kind} route`,
    kind: options.kind,
    tx,
    providerRegistry,
    providerId: "pyth",
    clock: options.clock,
    pair: options.pair,
    amount: options.amount,
    feeCoin: options.feeCoin
  });
}

export async function swapExactAForBWithPythRoute(
  tx: TransactionLike,
  options: SwapExactAForBWithPythRouteOptions
): Promise<TransactionArgument> {
  const priceBundles = await buildPythRoutePriceBundles(tx, {
    priceFeedConnection: options.priceFeedConnection,
    pythClient: options.pythClient,
    clock: options.clock,
    hops: [
      {
        packageId: options.packageId,
        typeA: options.typeA,
        typeB: options.typeB,
        pool: options.pool,
        feedIds: options.feedIds,
        ammReadings: options.ammReadings
      }
    ]
  });

  return swapExactAForBWithBundle({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    priceBundle: routeBundleAt(priceBundles, 0),
    clock: options.clock,
    pool: options.pool,
    input: options.input,
    minOut: options.minOut
  })(tx);
}

export async function swapExactBForAWithPythRoute(
  tx: TransactionLike,
  options: SwapExactBForAWithPythRouteOptions
): Promise<TransactionArgument> {
  const priceBundles = await buildPythRoutePriceBundles(tx, {
    priceFeedConnection: options.priceFeedConnection,
    pythClient: options.pythClient,
    clock: options.clock,
    hops: [
      {
        packageId: options.packageId,
        typeA: options.typeA,
        typeB: options.typeB,
        pool: options.pool,
        feedIds: options.feedIds,
        ammReadings: options.ammReadings
      }
    ]
  });

  return swapExactBForAWithBundle({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    priceBundle: routeBundleAt(priceBundles, 0),
    clock: options.clock,
    pool: options.pool,
    input: options.input,
    minOut: options.minOut
  })(tx);
}

export async function swapAForExactBWithPythRoute(
  tx: TransactionLike,
  options: SwapAForExactBWithPythRouteOptions
): Promise<TransactionArgument> {
  const priceBundles = await buildPythRoutePriceBundles(tx, {
    priceFeedConnection: options.priceFeedConnection,
    pythClient: options.pythClient,
    clock: options.clock,
    hops: [
      {
        packageId: options.packageId,
        typeA: options.typeA,
        typeB: options.typeB,
        pool: options.pool,
        feedIds: options.feedIds,
        ammReadings: options.ammReadings
      }
    ]
  });

  return swapAForExactBWithBundle({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    priceBundle: routeBundleAt(priceBundles, 0),
    clock: options.clock,
    pool: options.pool,
    input: options.input,
    amountOut: options.amountOut
  })(tx);
}

export async function swapBForExactAWithPythRoute(
  tx: TransactionLike,
  options: SwapBForExactAWithPythRouteOptions
): Promise<TransactionArgument> {
  const priceBundles = await buildPythRoutePriceBundles(tx, {
    priceFeedConnection: options.priceFeedConnection,
    pythClient: options.pythClient,
    clock: options.clock,
    hops: [
      {
        packageId: options.packageId,
        typeA: options.typeA,
        typeB: options.typeB,
        pool: options.pool,
        feedIds: options.feedIds,
        ammReadings: options.ammReadings
      }
    ]
  });

  return swapBForExactAWithBundle({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    priceBundle: routeBundleAt(priceBundles, 0),
    clock: options.clock,
    pool: options.pool,
    input: options.input,
    amountOut: options.amountOut
  })(tx);
}

export async function swapExactAForCViaBWithPythRoute(
  tx: TransactionLike,
  options: SwapExactAForCViaBWithPythRouteOptions
): Promise<TransactionArgument> {
  const priceBundles = await buildPythRoutePriceBundles(tx, {
    priceFeedConnection: options.priceFeedConnection,
    pythClient: options.pythClient,
    clock: options.clock,
    hops: [
      {
        packageId: options.packageId,
        typeA: options.typeA,
        typeB: options.typeB,
        pool: options.hopAB.pool,
        feedIds: options.hopAB.feedIds,
        ammReadings: options.hopAB.ammReadings
      },
      {
        packageId: options.packageId,
        typeA: options.typeB,
        typeB: options.typeC,
        pool: options.hopBC.pool,
        feedIds: options.hopBC.feedIds,
        ammReadings: options.hopBC.ammReadings
      }
    ]
  });

  return swapExactAForCViaBWithBundles({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    typeC: options.typeC,
    priceBundleAB: routeBundleAt(priceBundles, 0),
    priceBundleBC: routeBundleAt(priceBundles, 1),
    clock: options.clock,
    poolAB: options.hopAB.pool,
    poolBC: options.hopBC.pool,
    input: options.input,
    minBOut: options.minBOut,
    minCOut: options.minCOut
  })(tx);
}

export async function swapAForExactCViaBWithPythRoute(
  tx: TransactionLike,
  options: SwapAForExactCViaBWithPythRouteOptions
): Promise<TransactionArgument> {
  const priceBundles = await buildPythRoutePriceBundles(tx, {
    priceFeedConnection: options.priceFeedConnection,
    pythClient: options.pythClient,
    clock: options.clock,
    hops: [
      {
        packageId: options.packageId,
        typeA: options.typeA,
        typeB: options.typeB,
        pool: options.hopAB.pool,
        feedIds: options.hopAB.feedIds,
        ammReadings: options.hopAB.ammReadings
      },
      {
        packageId: options.packageId,
        typeA: options.typeB,
        typeB: options.typeC,
        pool: options.hopBC.pool,
        feedIds: options.hopBC.feedIds,
        ammReadings: options.hopBC.ammReadings
      }
    ]
  });

  return swapAForExactCViaBWithBundles({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    typeC: options.typeC,
    priceBundleAB: routeBundleAt(priceBundles, 0),
    priceBundleBC: routeBundleAt(priceBundles, 1),
    clock: options.clock,
    poolAB: options.hopAB.pool,
    poolBC: options.hopBC.pool,
    input: options.input,
    amountOut: options.amountOut
  })(tx);
}

export async function swapExactCForAViaBWithPythRoute(
  tx: TransactionLike,
  options: SwapExactCForAViaBWithPythRouteOptions
): Promise<TransactionArgument> {
  const priceBundles = await buildPythRoutePriceBundles(tx, {
    priceFeedConnection: options.priceFeedConnection,
    pythClient: options.pythClient,
    clock: options.clock,
    hops: [
      {
        packageId: options.packageId,
        typeA: options.typeA,
        typeB: options.typeB,
        pool: options.hopAB.pool,
        feedIds: options.hopAB.feedIds,
        ammReadings: options.hopAB.ammReadings
      },
      {
        packageId: options.packageId,
        typeA: options.typeB,
        typeB: options.typeC,
        pool: options.hopBC.pool,
        feedIds: options.hopBC.feedIds,
        ammReadings: options.hopBC.ammReadings
      }
    ]
  });

  return swapExactCForAViaBWithBundles({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    typeC: options.typeC,
    priceBundleAB: routeBundleAt(priceBundles, 0),
    priceBundleBC: routeBundleAt(priceBundles, 1),
    clock: options.clock,
    poolAB: options.hopAB.pool,
    poolBC: options.hopBC.pool,
    input: options.input,
    minBOut: options.minBOut,
    minAOut: options.minAOut
  })(tx);
}

export async function swapCForExactAViaBWithPythRoute(
  tx: TransactionLike,
  options: SwapCForExactAViaBWithPythRouteOptions
): Promise<TransactionArgument> {
  const priceBundles = await buildPythRoutePriceBundles(tx, {
    priceFeedConnection: options.priceFeedConnection,
    pythClient: options.pythClient,
    clock: options.clock,
    hops: [
      {
        packageId: options.packageId,
        typeA: options.typeA,
        typeB: options.typeB,
        pool: options.hopAB.pool,
        feedIds: options.hopAB.feedIds,
        ammReadings: options.hopAB.ammReadings
      },
      {
        packageId: options.packageId,
        typeA: options.typeB,
        typeB: options.typeC,
        pool: options.hopBC.pool,
        feedIds: options.hopBC.feedIds,
        ammReadings: options.hopBC.ammReadings
      }
    ]
  });

  return swapCForExactAViaBWithBundles({
    packageId: options.packageId,
    typeA: options.typeA,
    typeB: options.typeB,
    typeC: options.typeC,
    priceBundleAB: routeBundleAt(priceBundles, 0),
    priceBundleBC: routeBundleAt(priceBundles, 1),
    clock: options.clock,
    poolAB: options.hopAB.pool,
    poolBC: options.hopBC.pool,
    input: options.input,
    amountOut: options.amountOut
  })(tx);
}

export function swapExactAForB(options: SingleHopDirectExactInputOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_a_for_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.minOut)
      ]
    });
}

export function swapExactAForBAndTransfer(
  options: SingleHopDirectExactInputTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "swap_a_for_b_with_coin_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.minOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapExactBForA(options: SingleHopDirectExactInputOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_b_for_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.minOut)
      ]
    });
}

export function swapExactBForAAndTransfer(
  options: SingleHopDirectExactInputTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "swap_b_for_a_with_coin_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.minOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapAForExactB(options: SingleHopDirectExactOutputOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_a_for_exact_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.amountOut)
      ]
    });
}

export function swapAForExactBAndTransfer(
  options: SingleHopDirectExactOutputTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_a_for_exact_b_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.amountOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapBForExactA(options: SingleHopDirectExactOutputOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_b_for_exact_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.amountOut)
      ]
    });
}

export function swapBForExactAAndTransfer(
  options: SingleHopDirectExactOutputTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_b_for_exact_a_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.amountOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

function createPoolArgs(
  tx: TransactionLike,
  options: CreatePoolWithCoinsOptions
): TransactionArgument[] {
  return [
    objectArg(tx, options.factory),
    objectArg(tx, options.poolCreatorCap),
    objectArg(tx, options.oracle),
    objectArg(tx, options.priceInfoObjectA),
    objectArg(tx, options.priceInfoObjectB),
    objectArg(tx, options.clock),
    objectArg(tx, options.initA),
    objectArg(tx, options.initB),
    pureU8(tx, options.tokenADecimals),
    pureU8(tx, options.tokenBDecimals)
  ];
}

export function createPoolWithCoins(options: CreatePoolWithCoinsOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "create_pool_with_coins"),
      typeArguments: pairTypeArguments(options),
      arguments: createPoolArgs(tx, options)
    });
}

export function createPoolWithCoinsAndTransferLpToSender(
  options: CreatePoolWithCoinsOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.packageId,
        "swap",
        "create_pool_with_coins_and_transfer_lp_to_sender"
      ),
      typeArguments: pairTypeArguments(options),
      arguments: createPoolArgs(tx, options)
    });
}

export function addLiquidityWithCoins(options: AddLiquidityWithCoinsOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "add_liquidity_with_coins"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.inputA),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minLpOut)
      ]
    });
}

export function addLiquidityWithCoinsWithMinDeposits(
  options: AddLiquidityWithCoinsWithMinDepositsOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "add_liquidity_with_coins_with_min_deposits"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.inputA),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minADeposit),
        tx.pure.u64(options.minBDeposit),
        tx.pure.u64(options.minLpOut)
      ]
    });
}

export function addLiquidityWithCoinsAndTransfer(
  options: AddLiquidityWithCoinsTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "add_liquidity_with_coins_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.inputA),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minLpOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function zapInA(options: ZapInAOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_in_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.inputA),
        tx.pure.u64(options.minBFromSwap),
        tx.pure.u64(options.minLpOut)
      ]
    });
}

export function zapInAAndTransfer(options: ZapInATransferOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_in_a_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.inputA),
        tx.pure.u64(options.minBFromSwap),
        tx.pure.u64(options.minLpOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function zapInB(options: ZapInBOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_in_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minAFromSwap),
        tx.pure.u64(options.minLpOut)
      ]
    });
}

export function zapInBAndTransfer(options: ZapInBTransferOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_in_b_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minAFromSwap),
        tx.pure.u64(options.minLpOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function zapOutA(options: ZapOutOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_out_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minOut)
      ]
    });
}

export function zapOutAAndTransfer(options: ZapOutTransferOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_out_a_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function zapOutB(options: ZapOutOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_out_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minOut)
      ]
    });
}

export function zapOutBAndTransfer(options: ZapOutTransferOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_out_b_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...directOraclePairArgs(tx, options),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function quoteAForB(options: SingleHopDirectQuoteExactInputOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_a_for_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [...directOraclePairArgs(tx, options), tx.pure.u64(options.amountIn)]
    });
}

export function quoteBForA(options: SingleHopDirectQuoteExactInputOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_b_for_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [...directOraclePairArgs(tx, options), tx.pure.u64(options.amountIn)]
    });
}

export function quoteMaxAForB(options: SingleHopDirectQuoteMaxOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_max_a_for_b"),
      typeArguments: pairTypeArguments(options),
      arguments: directOraclePairArgs(tx, options)
    });
}

export function quoteMaxBForA(options: SingleHopDirectQuoteMaxOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_max_b_for_a"),
      typeArguments: pairTypeArguments(options),
      arguments: directOraclePairArgs(tx, options)
    });
}

export function quoteAForExactB(
  options: SingleHopDirectQuoteExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_a_for_exact_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [...directOraclePairArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function quoteAForExactBWithoutCutoff(
  options: SingleHopDirectQuoteExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_a_for_exact_b_without_cutoff"),
      typeArguments: pairTypeArguments(options),
      arguments: [...directOraclePairArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function quoteBForExactA(
  options: SingleHopDirectQuoteExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_b_for_exact_a"),
      typeArguments: pairTypeArguments(options),
      arguments: [...directOraclePairArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function quoteBForExactAWithoutCutoff(
  options: SingleHopDirectQuoteExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_b_for_exact_a_without_cutoff"),
      typeArguments: pairTypeArguments(options),
      arguments: [...directOraclePairArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function swapExactAForCViaB(options: SwapExactAForCViaBOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_a_for_c_via_b"),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...directOracleRouteArgs(tx, options),
        tx.pure.u64(options.minBOut),
        tx.pure.u64(options.minCOut)
      ]
    });
}

export function swapExactAForCViaBAndTransfer(
  options: SwapExactAForCViaBTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_a_for_c_via_b_and_transfer"),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...directOracleRouteArgs(tx, options),
        tx.pure.u64(options.minBOut),
        tx.pure.u64(options.minCOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapExactCForAViaB(options: SwapExactCForAViaBOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_c_for_a_via_b"),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...directOracleRouteArgs(tx, options),
        tx.pure.u64(options.minBOut),
        tx.pure.u64(options.minAOut)
      ]
    });
}

export function swapExactCForAViaBAndTransfer(
  options: SwapExactCForAViaBTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_c_for_a_via_b_and_transfer"),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...directOracleRouteArgs(tx, options),
        tx.pure.u64(options.minBOut),
        tx.pure.u64(options.minAOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapAForExactCViaB(options: SwapAForExactCViaBOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_a_for_exact_c_via_b"),
      typeArguments: routeTypeArguments(options),
      arguments: [...directOracleRouteArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function swapAForExactCViaBAndTransfer(
  options: SwapAForExactCViaBTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_a_for_exact_c_via_b_and_transfer"),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...directOracleRouteArgs(tx, options),
        tx.pure.u64(options.amountOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapCForExactAViaB(options: SwapCForExactAViaBOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_c_for_exact_a_via_b"),
      typeArguments: routeTypeArguments(options),
      arguments: [...directOracleRouteArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function swapCForExactAViaBAndTransfer(
  options: SwapCForExactAViaBTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_c_for_exact_a_via_b_and_transfer"),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...directOracleRouteArgs(tx, options),
        tx.pure.u64(options.amountOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapExactAForBWithBundle(
  options: SingleHopBundleExactInputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_a_for_b_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.minOut)
      ]
    });
}

export function swapExactBForAWithBundle(
  options: SingleHopBundleExactInputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_b_for_a_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.minOut)
      ]
    });
}

export function swapExactAForBWithBundleAndTransfer(
  options: SingleHopBundleExactInputTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_a_for_b_with_bundle_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.minOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapExactBForAWithBundleAndTransfer(
  options: SingleHopBundleExactInputTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_b_for_a_with_bundle_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.input),
        tx.pure.u64(options.minOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapAForExactBWithBundle(
  options: SingleHopBundleExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_a_for_exact_b_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.input),
        amountArg(tx, options.amountOut)
      ]
    });
}

export function swapBForExactAWithBundle(
  options: SingleHopBundleExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_b_for_exact_a_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.input),
        amountArg(tx, options.amountOut)
      ]
    });
}

export function swapAForExactBWithBundleAndTransfer(
  options: SingleHopBundleExactOutputTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_a_for_exact_b_with_bundle_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.input),
        amountArg(tx, options.amountOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapBForExactAWithBundleAndTransfer(
  options: SingleHopBundleExactOutputTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_b_for_exact_a_with_bundle_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.input),
        amountArg(tx, options.amountOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function addLiquidityWithBundle(options: AddLiquidityWithBundleOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "add_liquidity_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.inputA),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minLpOut)
      ]
    });
}

export function addLiquidityWithBundleWithMinDeposits(
  options: AddLiquidityWithBundleWithMinDepositsOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "add_liquidity_with_bundle_with_min_deposits"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.inputA),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minADeposit),
        tx.pure.u64(options.minBDeposit),
        tx.pure.u64(options.minLpOut)
      ]
    });
}

export function addLiquidityWithBundleAndTransfer(
  options: AddLiquidityWithBundleTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "add_liquidity_with_bundle_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.inputA),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minLpOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function addLiquidityWithBundleAndTransferWithMinDeposits(
  options: AddLiquidityWithBundleTransferWithMinDepositsOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "add_liquidity_with_bundle_and_transfer_with_min_deposits"
      ),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.inputA),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minADeposit),
        tx.pure.u64(options.minBDeposit),
        tx.pure.u64(options.minLpOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function zapInAWithBundle(options: ZapInAWithBundleOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_in_a_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.inputA),
        tx.pure.u64(options.minBFromSwap),
        tx.pure.u64(options.minLpOut)
      ]
    });
}

export function zapInAWithBundleAndTransfer(
  options: ZapInAWithBundleTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_in_a_with_bundle_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.inputA),
        tx.pure.u64(options.minBFromSwap),
        tx.pure.u64(options.minLpOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function zapInBWithBundle(options: ZapInBWithBundleOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_in_b_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minAFromSwap),
        tx.pure.u64(options.minLpOut)
      ]
    });
}

export function zapInBWithBundleAndTransfer(
  options: ZapInBWithBundleTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_in_b_with_bundle_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.inputB),
        tx.pure.u64(options.minAFromSwap),
        tx.pure.u64(options.minLpOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function zapOutAWithBundle(options: ZapOutWithBundleOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_out_a_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minOut)
      ]
    });
}

export function zapOutAWithBundleAndTransfer(
  options: ZapOutWithBundleTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_out_a_with_bundle_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function zapOutBWithBundle(options: ZapOutWithBundleOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_out_b_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minOut)
      ]
    });
}

export function zapOutBWithBundleAndTransfer(
  options: ZapOutWithBundleTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "zap_out_b_with_bundle_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        ...singleHopBundleArgs(tx, options),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function removeLiquidityWithCoins(
  options: RemoveLiquidityWithCoinsOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "remove_liquidity_with_coins"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minAOut),
        tx.pure.u64(options.minBOut)
      ]
    });
}

export function removeLiquidityWithCoinsAndTransfer(
  options: RemoveLiquidityWithCoinsTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "remove_liquidity_with_coins_and_transfer"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.lpIn),
        tx.pure.u64(options.minAOut),
        tx.pure.u64(options.minBOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function setPoolFee(options: SetPoolFeeOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_fee"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.riskCap),
        pureU32(tx, options.newFee)
      ]
    });
}

export function setPoolK(options: SetPoolKOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_k"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.riskCap),
        amountArg(tx, options.newK)
      ]
    });
}

export function setPoolLambda(options: SetPoolLambdaOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_lambda"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.riskCap),
        amountArg(tx, options.newLambda)
      ]
    });
}

export function setPoolKB(options: SetPoolKBOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_k_b"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.riskCap),
        amountArg(tx, options.newK)
      ]
    });
}

export function setPoolKQ(options: SetPoolKQOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_k_q"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.riskCap),
        amountArg(tx, options.newK)
      ]
    });
}

export function setPoolFeeSplit(options: SetPoolFeeSplitOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_fee_split"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.riskCap),
        pureU32(tx, options.newFeeSplit)
      ]
    });
}

export function setPoolFeeTo(options: SetPoolFeeToOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_fee_to"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.feeCap),
        pureAddress(tx, options.feeTo)
      ]
    });
}

export function setPoolSwapsPaused(options: SetPoolSwapsPausedOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_swaps_paused"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.pauseCap),
        pureBool(tx, options.paused)
      ]
    });
}

export function setPoolAddLiquidityPaused(
  options: SetPoolAddLiquidityPausedOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_add_liquidity_paused"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.pauseCap),
        pureBool(tx, options.paused)
      ]
    });
}

export function setPoolGamma(options: SetPoolGammaOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_gamma"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.riskCap),
        pureU32(tx, options.newGamma)
      ]
    });
}

export function setPoolSpreads(options: SetPoolSpreadsOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_spreads"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.riskCap),
        pureU32(tx, options.compress),
        pureU32(tx, options.sSell),
        pureU32(tx, options.sBuy),
        pureU32(tx, options.fixS),
        pureU32(tx, options.disThreshold),
        pureU32(tx, options.sBound)
      ]
    });
}

export function setPoolFlashEnabled(options: SetPoolFlashEnabledOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_flash_enabled"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.pauseCap),
        pureBool(tx, options.enabled)
      ]
    });
}

export function setPoolPythWeight(options: SetPoolPythWeightOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_pyth_weight"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.oracleCap),
        pureU32(tx, options.newWeight)
      ]
    });
}

export function setPoolOracleMaxPriceAge(
  options: SetPoolOracleMaxPriceAgeOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_oracle_max_price_age"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.oracleCap),
        amountArg(tx, options.newAge)
      ]
    });
}

export function setPoolOracleQuorum(options: SetPoolOracleQuorumOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_oracle_quorum"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.oracleCap),
        pureU8(tx, options.minSources),
        amountArg(tx, options.requiredSourceMask),
        amountArg(tx, options.allowedSourceMask)
      ]
    });
}

export function setPoolOracleAggregationPolicy(
  options: SetPoolOracleAggregationPolicyOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_oracle_aggregation_policy"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.oracleCap),
        pureU8(tx, options.primarySource),
        amountArg(tx, options.maxPairTimeDeltaMs),
        amountArg(tx, options.maxConfidence),
        amountArg(tx, options.maxDeviation),
        pureU8(tx, options.mode)
      ]
    });
}

export function setPoolOracleSources(options: SetPoolOracleSourcesOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_oracle_sources"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.oracleCap),
        pureVector(tx, "u8", asciiOrBytesValue(options.sourceTypeA, "oracle source type A")),
        pureVector(tx, "u8", asciiOrBytesValue(options.sourceTypeB, "oracle source type B")),
        pureObjectId(tx, options.sourceIdA),
        pureObjectId(tx, options.sourceIdB),
        pureVector(tx, "u8", hexOrBytesValue(options.configDataA, "oracle config data A")),
        pureVector(tx, "u8", hexOrBytesValue(options.configDataB, "oracle config data B"))
      ]
    });
}

export function setPoolAmmPolicy(options: SetPoolAmmPolicyOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_amm_policy"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.ammCap),
        pureBool(tx, options.enabled),
        pureU32(tx, options.blendWeight),
        pureU8(tx, options.minSources),
        pureU8(tx, options.fallbackMode)
      ]
    });
}

export function setPoolAmmSourcePolicy(
  options: SetPoolAmmSourcePolicyOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_amm_source_policy"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.ammCap),
        pureU32(tx, options.maxOspread),
        pureU128(tx, options.minLiquidityQuote),
        amountArg(tx, options.minWindowSeconds),
        amountArg(tx, options.maxWindowSeconds),
        amountArg(tx, options.allowedSourceMask),
        pureU8(tx, options.sourceCountLimit)
      ]
    });
}

export function setPoolAmmSourceIds(options: SetPoolAmmSourceIdsOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_amm_source_ids"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.ammCap),
        pureVector(tx, "id", options.allowedSourceIds)
      ]
    });
}

export function setPoolRouterEnabled(options: SetPoolRouterEnabledOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_router_enabled"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.routerCap),
        pureBool(tx, options.enabled)
      ]
    });
}

export function setPoolProtocolFee(options: SetPoolProtocolFeeOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_pool_protocol_fee"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.riskCap),
        pureU32(tx, options.newProtocolFee)
      ]
    });
}

export function setFactoryPaused(options: SetFactoryPausedOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_factory_paused"),
      typeArguments: [],
      arguments: [
        objectArg(tx, options.factory),
        objectArg(tx, options.adminCap),
        pureBool(tx, options.paused)
      ]
    });
}

export function setFactoryFeeTo(options: SetFactoryFeeToOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_factory_fee_to"),
      typeArguments: [],
      arguments: [
        objectArg(tx, options.factory),
        objectArg(tx, options.adminCap),
        pureAddress(tx, options.feeTo)
      ]
    });
}

export function setFactoryOracle(options: SetFactoryOracleOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_factory_oracle"),
      typeArguments: [],
      arguments: [
        objectArg(tx, options.factory),
        objectArg(tx, options.adminCap),
        pureObjectId(tx, options.oracleId)
      ]
    });
}

export function setFactoryMinPriceAge(
  options: SetFactoryMinPriceAgeOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "set_factory_min_price_age"),
      typeArguments: [],
      arguments: [
        objectArg(tx, options.factory),
        objectArg(tx, options.adminCap),
        amountArg(tx, options.age)
      ]
    });
}

export function claimProtocolLp(options: ClaimProtocolLpOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "admin", "claim_protocol_lp"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        objectArg(tx, options.feeCap)
      ]
    });
}

export function borrowAWithCoin(options: FlashBorrowWithCoinOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "flash", "borrow_a_with_coin"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        options.priceBundle,
        objectArg(tx, options.clock),
        tx.pure.u64(options.amount)
      ]
    });
}

export function borrowAWithCoinResults(
  options: FlashBorrowWithCoinOptions
): FlashBorrowWithCoinResultsThunk {
  return (tx) => {
    const result = borrowAWithCoin(options)(tx) as TransactionResult;
    return {
      result,
      borrowed: transactionResultAt(result, 0, "borrowed coin"),
      receipt: transactionResultAt(result, 1, "flash receipt")
    };
  };
}

export function borrowBWithCoin(options: FlashBorrowWithCoinOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "flash", "borrow_b_with_coin"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        options.priceBundle,
        objectArg(tx, options.clock),
        tx.pure.u64(options.amount)
      ]
    });
}

export function borrowBWithCoinResults(
  options: FlashBorrowWithCoinOptions
): FlashBorrowWithCoinResultsThunk {
  return (tx) => {
    const result = borrowBWithCoin(options)(tx) as TransactionResult;
    return {
      result,
      borrowed: transactionResultAt(result, 0, "borrowed coin"),
      receipt: transactionResultAt(result, 1, "flash receipt")
    };
  };
}

export function repayAWithCoin(options: FlashRepayWithCoinOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "flash", "repay_a_with_coin"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        options.priceBundle,
        objectArg(tx, options.clock),
        objectArg(tx, options.repayment),
        options.receipt
      ]
    });
}

export function repayBWithCoin(options: FlashRepayWithCoinOptions): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "flash", "repay_b_with_coin"),
      typeArguments: pairTypeArguments(options),
      arguments: [
        objectArg(tx, options.pool),
        options.priceBundle,
        objectArg(tx, options.clock),
        objectArg(tx, options.repayment),
        options.receipt
      ]
    });
}

function mergeFeeCoinIntoBorrowed(tx: TransactionLike, borrowed: TransactionArgument, feeCoin: ObjectInput) {
  if (tx.mergeCoins === undefined) {
    throw new Error("Transaction builder must support coin merging");
  }
  tx.mergeCoins(borrowed, [objectArg(tx, feeCoin)]);
}

export function repayAWithBorrowedCoinAndFee(
  options: FlashRepayBorrowedWithFeeOptions
): TransactionThunk {
  return (tx) => {
    mergeFeeCoinIntoBorrowed(tx, options.borrowed, options.feeCoin);
    return repayAWithCoin({
      packageId: options.packageId,
      typeA: options.typeA,
      typeB: options.typeB,
      priceBundle: options.priceBundle,
      clock: options.clock,
      pool: options.pool,
      repayment: options.borrowed,
      receipt: options.receipt
    })(tx);
  };
}

export function repayBWithBorrowedCoinAndFee(
  options: FlashRepayBorrowedWithFeeOptions
): TransactionThunk {
  return (tx) => {
    mergeFeeCoinIntoBorrowed(tx, options.borrowed, options.feeCoin);
    return repayBWithCoin({
      packageId: options.packageId,
      typeA: options.typeA,
      typeB: options.typeB,
      priceBundle: options.priceBundle,
      clock: options.clock,
      pool: options.pool,
      repayment: options.borrowed,
      receipt: options.receipt
    })(tx);
  };
}

export function quoteAForBWithBundle(
  options: SingleHopBundleQuoteExactInputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_a_for_b_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [...singleHopBundleArgs(tx, options), amountArg(tx, options.amountIn)]
    });
}

export function quoteBForAWithBundle(
  options: SingleHopBundleQuoteExactInputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_b_for_a_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [...singleHopBundleArgs(tx, options), amountArg(tx, options.amountIn)]
    });
}

export function quoteMaxAForBWithBundle(
  options: SingleHopBundleQuoteMaxOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_max_a_for_b_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: singleHopBundleArgs(tx, options)
    });
}

export function quoteMaxBForAWithBundle(
  options: SingleHopBundleQuoteMaxOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_max_b_for_a_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: singleHopBundleArgs(tx, options)
    });
}

export function quoteAForExactBWithBundle(
  options: SingleHopBundleQuoteExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_a_for_exact_b_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [...singleHopBundleArgs(tx, options), amountArg(tx, options.amountOut)]
    });
}

export function quoteAForExactBWithoutCutoffWithBundle(
  options: SingleHopBundleQuoteExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.packageId,
        "swap",
        "quote_a_for_exact_b_without_cutoff_with_bundle"
      ),
      typeArguments: pairTypeArguments(options),
      arguments: [...singleHopBundleArgs(tx, options), amountArg(tx, options.amountOut)]
    });
}

export function quoteBForExactAWithBundle(
  options: SingleHopBundleQuoteExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(options.packageId, "swap", "quote_b_for_exact_a_with_bundle"),
      typeArguments: pairTypeArguments(options),
      arguments: [...singleHopBundleArgs(tx, options), amountArg(tx, options.amountOut)]
    });
}

export function quoteBForExactAWithoutCutoffWithBundle(
  options: SingleHopBundleQuoteExactOutputOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: moduleTarget(
        options.packageId,
        "swap",
        "quote_b_for_exact_a_without_cutoff_with_bundle"
      ),
      typeArguments: pairTypeArguments(options),
      arguments: [...singleHopBundleArgs(tx, options), amountArg(tx, options.amountOut)]
    });
}

export function quoteExactAForCViaBWithBundles(
  options: QuoteExactAForCViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "quote_exact_a_for_c_via_b_with_bundles"),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopQuoteArgs(tx, options), tx.pure.u64(options.amountIn)]
    });
}

export function quoteExactAForCViaBWithoutCutoffWithBundles(
  options: QuoteExactAForCViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "quote_exact_a_for_c_via_b_without_cutoff_with_bundles"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopQuoteArgs(tx, options), tx.pure.u64(options.amountIn)]
    });
}

export function quoteExactCForAViaBWithBundles(
  options: QuoteExactCForAViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "quote_exact_c_for_a_via_b_with_bundles"),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopQuoteArgs(tx, options), tx.pure.u64(options.amountIn)]
    });
}

export function quoteExactCForAViaBWithoutCutoffWithBundles(
  options: QuoteExactCForAViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "quote_exact_c_for_a_via_b_without_cutoff_with_bundles"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopQuoteArgs(tx, options), tx.pure.u64(options.amountIn)]
    });
}

export function quoteAForExactCViaBWithBundles(
  options: QuoteAForExactCViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "quote_a_for_exact_c_via_b_with_bundles"),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopQuoteArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function quoteAForExactCViaBWithoutCutoffWithBundles(
  options: QuoteAForExactCViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "quote_a_for_exact_c_via_b_without_cutoff_with_bundles"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopQuoteArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function quoteCForExactAViaBWithBundles(
  options: QuoteCForExactAViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "quote_c_for_exact_a_via_b_with_bundles"),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopQuoteArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function quoteCForExactAViaBWithoutCutoffWithBundles(
  options: QuoteCForExactAViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "quote_c_for_exact_a_via_b_without_cutoff_with_bundles"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopQuoteArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function swapExactAForCViaBWithBundles(
  options: SwapExactAForCViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_a_for_c_via_b_with_bundles"),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...twoHopBundleArgs(tx, options),
        tx.pure.u64(options.minBOut),
        tx.pure.u64(options.minCOut)
      ]
    });
}

export function swapExactAForCViaBWithBundlesAndTransfer(
  options: SwapExactAForCViaBWithBundlesAndTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "swap_exact_a_for_c_via_b_with_bundles_and_transfer"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...twoHopBundleArgs(tx, options),
        tx.pure.u64(options.minBOut),
        tx.pure.u64(options.minCOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapExactCForAViaBWithBundles(
  options: SwapExactCForAViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_exact_c_for_a_via_b_with_bundles"),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...twoHopBundleArgs(tx, options),
        tx.pure.u64(options.minBOut),
        tx.pure.u64(options.minAOut)
      ]
    });
}

export function swapExactCForAViaBWithBundlesAndTransfer(
  options: SwapExactCForAViaBWithBundlesAndTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "swap_exact_c_for_a_via_b_with_bundles_and_transfer"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...twoHopBundleArgs(tx, options),
        tx.pure.u64(options.minBOut),
        tx.pure.u64(options.minAOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapAForExactCViaBWithBundles(
  options: SwapAForExactCViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_a_for_exact_c_via_b_with_bundles"),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopBundleArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function swapAForExactCViaBWithBundlesAndTransfer(
  options: SwapAForExactCViaBWithBundlesAndTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "swap_a_for_exact_c_via_b_with_bundles_and_transfer"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...twoHopBundleArgs(tx, options),
        tx.pure.u64(options.amountOut),
        pureAddress(tx, options.recipient)
      ]
    });
}

export function swapAForExactCViaBWithReversedSecondBundle(
  options: SwapAForExactCViaBWithReversedSecondBundleOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "swap_a_for_exact_c_via_b_with_reversed_second_bundle"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [
        options.priceBundleAB,
        options.priceBundleCB,
        objectArg(tx, options.clock),
        objectArg(tx, options.poolAB),
        objectArg(tx, options.poolCB),
        objectArg(tx, options.input),
        tx.pure.u64(options.amountOut)
      ]
    });
}

export function swapAForExactCViaBWithReversedFirstBundle(
  options: SwapAForExactCViaBWithReversedFirstBundleOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "swap_a_for_exact_c_via_b_with_reversed_first_bundle"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [
        options.priceBundleBA,
        options.priceBundleBC,
        objectArg(tx, options.clock),
        objectArg(tx, options.poolBA),
        objectArg(tx, options.poolBC),
        objectArg(tx, options.input),
        tx.pure.u64(options.amountOut)
      ]
    });
}

export function swapCForExactAViaBWithBundles(
  options: SwapCForExactAViaBWithBundlesOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(options.packageId, "swap_c_for_exact_a_via_b_with_bundles"),
      typeArguments: routeTypeArguments(options),
      arguments: [...twoHopBundleArgs(tx, options), tx.pure.u64(options.amountOut)]
    });
}

export function swapCForExactAViaBWithBundlesAndTransfer(
  options: SwapCForExactAViaBWithBundlesAndTransferOptions
): TransactionThunk {
  return (tx) =>
    tx.moveCall({
      target: routerTarget(
        options.packageId,
        "swap_c_for_exact_a_via_b_with_bundles_and_transfer"
      ),
      typeArguments: routeTypeArguments(options),
      arguments: [
        ...twoHopBundleArgs(tx, options),
        tx.pure.u64(options.amountOut),
        pureAddress(tx, options.recipient)
      ]
    });
}
