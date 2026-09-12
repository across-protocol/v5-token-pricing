import type { SourceResult, TokenToPrice } from "../types.js";
/**
 * DefiLlama: free, no key, address-native.
 *
 * The returned `timestamp` is the instant of the trade/observation DefiLlama
 * actually has, which can sit minutes from the requested instant depending on
 * the token's liquidity. It is passed through verbatim.
 *
 * The historical endpoint takes COMMA-SEPARATED coin keys at ONE timestamp, and
 * DefiLlama's rate limit is per request rather than per key. Asking token by
 * token therefore throttles the caller long before DefiLlama is out of patience:
 * the V5 route matrix's 1,696 in-scope token instances cost 1,696 requests one
 * at a time and earned a 429 partway through, where the same set batched costs
 * ~17 requests and completes in seconds. Coin keys are chunked at 100 per
 * request -- the figure integrator-api's CoinGecko source uses comfortably --
 * and requests are issued sequentially: politeness is the point of batching.
 */
/** Coin keys per request on the historical endpoint. */
export declare const DEFILLAMA_CHUNK_SIZE = 100;
/**
 * Price many tokens at many instants in as few requests as DefiLlama allows.
 *
 * Work is grouped by timestamp (one request cannot span instants), chunked
 * within each group, and de-duplicated, so a caller that passes overlapping
 * tokens pays for each distinct (token, instant) once. Results are aligned with
 * `requests` by index.
 *
 * Failure is attributable per request, not per call: a chunk that fails marks
 * only the tokens inside it, so a rate limit mid-batch still prices everything
 * outside the throttled requests instead of degrading the run silently.
 */
export declare function fetchDefiLlamaPrices({ requests, }: {
    requests: TokenToPrice[];
}): Promise<SourceResult[]>;
//# sourceMappingURL=defillama.d.ts.map