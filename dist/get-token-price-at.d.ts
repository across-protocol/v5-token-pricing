import type { ApiKeys, TokenPriceResult } from "./types.js";
/**
 * What was this token worth at this instant?
 *
 * Sources are tried in order until one answers plausibly. A source that throws,
 * times out, has no datapoint, or returns an implausible value is a miss, not a
 * failure — the next source still gets its turn.
 *
 * `observedAt` is the upstream datapoint's own instant, reported verbatim. It
 * may sit minutes from `timestamp`; the caller decides whether that is close
 * enough. `priceUsd === null` means nothing could price the token — no
 * interpolation, no substitution, ever.
 *
 * `attempts` records what each tried source did, on both paths.
 */
export declare function getTokenPriceAt({ chainId, tokenAddress, timestamp, apiKeys, }: {
    chainId: number;
    tokenAddress: string;
    timestamp: number;
    apiKeys?: ApiKeys;
}): Promise<TokenPriceResult>;
//# sourceMappingURL=get-token-price-at.d.ts.map