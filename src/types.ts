/**
 * Upstream that answered (or was asked).
 *
 * `coingecko` and `coingecko-by-id` are the SAME vendor asked two different
 * questions -- by contract address, and by Across' recorded coin id -- and are
 * reported separately because the distinction is diagnostic: a price that came
 * back only `coingecko-by-id` was matched on the ASSET, so it is the canonical
 * asset's price rather than that specific deployment's.
 */
export type PriceSource = "defillama" | "coingecko" | "alchemy" | "coingecko-by-id";

/**
 * What happened at one source.
 * - ok: the source returned a plausible datapoint.
 * - no_data: the source answered but had no datapoint for this token/instant.
 * - implausible: the source returned a value that failed the sanity rules.
 * - stale: the source returned a plausible datapoint, but further than
 *   `maxStalenessMs` from the requested instant. The next source is asked; if
 *   none answers within the threshold, the least stale datapoint is returned.
 * - error: the source threw, timed out, or returned a non-2xx / unparseable body.
 * - skipped_no_key: the source needs a credential that was not supplied on this call.
 * - skipped_unmapped_chain: the source has no identifier for this chain id.
 */
export type AttemptOutcome =
  | "ok"
  | "no_data"
  | "implausible"
  | "stale"
  | "error"
  | "skipped_no_key"
  | "skipped_unmapped_chain";

/** Per-source outcome, returned on both the priced and the unpriced path. */
export type PriceAttempt = {
  source: PriceSource;
  outcome: AttemptOutcome;
};

/** Credentials, injected per call. Never stored, never read from the environment. */
export type ApiKeys = {
  coingecko?: string;
  alchemy?: string;
};

/**
 * The answer.
 *
 * `observedAt` is the instant of the datapoint the upstream actually returned,
 * verbatim — NOT the requested timestamp and NOT the wall clock. It is within
 * `maxStalenessMs` of what was asked for whenever a source answered that close;
 * otherwise it is the closest answer any source gave, which can be further off.
 */
export type TokenPriceResult =
  | {
      priceUsd: number;
      observedAt: number;
      source: PriceSource;
      confidence?: number;
      /**
       * The token's symbol, when it can be established: Across' own name for it
       * (`TOKEN_SYMBOLS_MAP`) if it knows the token, else whatever the answering
       * source called it. Absent when neither knows.
       *
       * REPORTED BECAUSE THE CALLER OTHERWISE HAS TO RE-DERIVE IT and cannot: a
       * consumer storing a self-describing price row had to look the token up in
       * `TOKEN_SYMBOLS_MAP` itself, which fails for exactly the tokens whose price
       * came back anyway -- the sources are address-native, the constants package
       * is not exhaustive, and pricing a token has never required naming it.
       * indexer-v5 was dropping otherwise-priceable tokens for want of this field.
       *
       * NOT A CANONICAL IDENTIFIER. It is a label from whichever upstream answered,
       * so spellings vary across sources for one token (DefiLlama returns
       * "AvalancheUSDC" for Avalanche's USDC). Never key on it.
       */
      symbol?: string;
      /**
       * The token's decimals as the answering source reported them. Only DefiLlama
       * reports decimals today, so this is absent on a CoinGecko or Alchemy answer.
       *
       * NEVER USE THIS TO SCALE AN AMOUNT. `priceUsd` is a WHOLE-token price, so it
       * needs no decimals at all; this is descriptive metadata for a stored row.
       * The decimals that convert base units belong to the token as the caller's
       * own domain knows it, and taking them from a price source instead couples
       * money arithmetic to whichever upstream happened to answer.
       */
      decimals?: number;
      attempts: PriceAttempt[];
    }
  | {
      priceUsd: null;
      observedAt: null;
      source: null;
      attempts: PriceAttempt[];
    };

/** What a single source hands back to the resolver. */
export type SourceObservation = {
  priceUsd: number;
  observedAt: number;
  confidence?: number;
  /** Symbol as reported by the upstream, when it reports one. */
  symbol?: string;
  /** Decimals as reported by the upstream, when it reports them (DefiLlama does). */
  decimals?: number;
};

export type SourceResult =
  | { outcome: "ok"; observation: SourceObservation }
  | { outcome: Exclude<AttemptOutcome, "ok" | "implausible" | "stale"> };
