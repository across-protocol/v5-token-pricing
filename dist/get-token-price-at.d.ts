import type { ApiKeys, TokenPriceResult } from "./types.js";
/**
 * How far a datapoint may sit from the requested instant before the next source
 * is asked for a closer one.
 *
 * Five minutes because that is the granularity CoinGecko and Alchemy serve for
 * the windows asked here: a source with data around the instant answers within
 * it. DefiLlama serves some tokens only every ~30 minutes -- measured on
 * 2026-09-30, its Ink WETH and Arbitrum WETH answers sat 7 to 12 minutes from
 * the requested 5-minute marks, while Base and Ethereum USDC landed within a
 * minute.
 */
export declare const DEFAULT_MAX_STALENESS_MS: number;
/**
 * What was this token worth at this instant?
 *
 * Sources are tried in order until one answers plausibly AND within
 * `maxStalenessMs` of `timestamp`. A source that throws, times out, has no
 * datapoint, or returns an implausible value is a miss, not a failure — the next
 * source still gets its turn. A plausible answer that is too far from
 * `timestamp` is `stale`: it is kept, and the next source is asked for a closer
 * one. If no source answers within the threshold, the least stale answer wins.
 *
 * `observedAt` is the upstream datapoint's own instant, reported verbatim — even
 * when a stale answer wins, so the caller can still see how far it landed.
 * `priceUsd === null` means nothing could price the token — no interpolation, no
 * substitution, ever.
 *
 * `attempts` records what each tried source did, on both paths.
 */
export declare function getTokenPriceAt({ chainId, tokenAddress, timestamp, apiKeys, maxStalenessMs, }: {
    chainId: number;
    tokenAddress: string;
    timestamp: number;
    apiKeys?: ApiKeys;
    maxStalenessMs?: number;
}): Promise<TokenPriceResult>;
//# sourceMappingURL=get-token-price-at.d.ts.map