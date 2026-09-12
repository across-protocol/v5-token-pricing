import { getTokenPricesAt } from "./get-token-prices-at.js";
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
 *
 * This is the 1-element case of `getTokenPricesAt`, which exists because
 * callers pricing a large matrix through this function one token at a time
 * throttle themselves invisibly: DefiLlama's historical endpoint takes many
 * coin keys per request, and its rate limit is per request, not per key. Use
 * this when you have one token; use the batch when you have many.
 */
export async function getTokenPriceAt({ chainId, tokenAddress, timestamp, apiKeys = {}, }) {
    const [result] = await getTokenPricesAt({
        tokens: [{ chainId, tokenAddress, timestamp }],
        apiKeys,
    });
    return result;
}
//# sourceMappingURL=get-token-price-at.js.map