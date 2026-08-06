/** Upstream that answered (or was asked). */
export type PriceSource = "defillama" | "coingecko" | "alchemy";
/**
 * What happened at one source.
 * - ok: the source returned a plausible datapoint.
 * - no_data: the source answered but had no datapoint for this token/instant.
 * - implausible: the source returned a value that failed the sanity rules.
 * - error: the source threw, timed out, or returned a non-2xx / unparseable body.
 * - skipped_no_key: the source needs a credential that was not supplied on this call.
 * - skipped_unmapped_chain: the source has no identifier for this chain id.
 */
export type AttemptOutcome = "ok" | "no_data" | "implausible" | "error" | "skipped_no_key" | "skipped_unmapped_chain";
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
 * verbatim — NOT the requested timestamp and NOT the wall clock. It can be
 * minutes away from what was asked for; how far depends on the token's
 * liquidity. The caller decides whether that distance is acceptable.
 */
export type TokenPriceResult = {
    priceUsd: number;
    observedAt: number;
    source: PriceSource;
    confidence?: number;
    attempts: PriceAttempt[];
} | {
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
};
export type SourceResult = {
    outcome: "ok";
    observation: SourceObservation;
} | {
    outcome: Exclude<AttemptOutcome, "ok" | "implausible">;
};
//# sourceMappingURL=types.d.ts.map