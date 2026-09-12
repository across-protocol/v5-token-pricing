import type { ApiKeys, TokenPriceResult, TokenToPrice } from "./types.js";
/**
 * What were these tokens worth at these instants?
 *
 * Results are aligned with `tokens` by index. Each element is exactly what
 * `getTokenPriceAt` returns for that token -- same per-source attempt record,
 * same ordered fallback -- so a batch call and 1,696 single calls walk the same
 * decision tree. The difference is the traffic: DefiLlama is asked once per
 * (timestamp, chunk of 100 coin keys) rather than once per token, which is the
 * difference between ~17 requests for the V5 route matrix and 1,696, and
 * between finishing in seconds and throttling oneself into a 429 partway
 * through.
 *
 * A failed request is attributable to the tokens inside it, not to the call:
 * tokens outside the dead request still get priced, and the tokens inside it
 * record `throttled` (rate limited) or `error` at that source rather than
 * something indistinguishable from "this token has no price anywhere".
 *
 * Each entry's `attempts` records what each tried source did, on both paths.
 */
export declare function getTokenPricesAt({ tokens, apiKeys, }: {
    tokens: TokenToPrice[];
    apiKeys?: ApiKeys;
}): Promise<TokenPriceResult[]>;
//# sourceMappingURL=get-token-prices-at.d.ts.map