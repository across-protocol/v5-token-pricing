import { LLAMA_SLUG_BY_CHAIN } from "../chain-slugs.js";
import { fetchErrorOutcome, fetchJson } from "../http.js";
import { asRecord } from "../json.js";
import { normalizeTokenAddress } from "../tokens.js";
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
export const DEFILLAMA_CHUNK_SIZE = 100;
const HISTORICAL_URL = "https://coins.llama.fi/prices/historical";
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
export async function fetchDefiLlamaPrices({ requests, }) {
    const results = new Array(requests.length);
    const work = new Map();
    for (const [i, request] of requests.entries()) {
        const slug = LLAMA_SLUG_BY_CHAIN[request.chainId];
        if (slug === undefined) {
            results[i] = { outcome: "skipped_unmapped_chain" };
            continue;
        }
        const coinKey = `${slug}:${normalizeTokenAddress(request.tokenAddress)}`;
        const unixSeconds = Math.floor(request.timestamp / 1000);
        const item = work.get(`${unixSeconds}|${coinKey}`);
        if (item === undefined) {
            work.set(`${unixSeconds}|${coinKey}`, { coinKey, unixSeconds, indices: [i] });
        }
        else {
            item.indices.push(i);
        }
    }
    // One timestamp per request, so group by instant first, chunk within each.
    const byInstant = new Map();
    for (const item of work.values()) {
        const group = byInstant.get(item.unixSeconds);
        if (group === undefined)
            byInstant.set(item.unixSeconds, [item]);
        else
            group.push(item);
    }
    for (const [unixSeconds, items] of byInstant) {
        for (let start = 0; start < items.length; start += DEFILLAMA_CHUNK_SIZE) {
            const chunk = items.slice(start, start + DEFILLAMA_CHUNK_SIZE);
            const url = `${HISTORICAL_URL}/${unixSeconds}/${chunk
                .map((item) => item.coinKey)
                .join(",")}`;
            let body;
            try {
                body = await fetchJson({ url });
            }
            catch (error) {
                const outcome = fetchErrorOutcome(error);
                for (const item of chunk) {
                    for (const i of item.indices)
                        results[i] = outcome;
                }
                continue;
            }
            // Coins with no datapoint are simply absent from the reply.
            const coins = asRecord(asRecord(body)?.["coins"]) ?? {};
            for (const item of chunk) {
                const outcome = observationForCoin(asRecord(coins[item.coinKey]));
                for (const i of item.indices)
                    results[i] = outcome;
            }
        }
    }
    return results;
}
/** The observation for one coin of a reply body, or no_data when absent/malformed. */
function observationForCoin(coin) {
    if (coin === undefined)
        return { outcome: "no_data" };
    const price = coin["price"];
    const observedAtSeconds = coin["timestamp"];
    if (typeof price !== "number" || typeof observedAtSeconds !== "number") {
        return { outcome: "no_data" };
    }
    const confidence = coin["confidence"];
    const symbol = coin["symbol"];
    // DefiLlama returns `decimals` in the same object as `price`; it used to be read
    // and thrown away. Passed through so a caller can describe the token it just
    // priced without re-deriving metadata it may not have.
    const decimals = coin["decimals"];
    return {
        outcome: "ok",
        observation: {
            priceUsd: price,
            observedAt: observedAtSeconds * 1000,
            ...(typeof confidence === "number" ? { confidence } : {}),
            ...(typeof symbol === "string" ? { symbol } : {}),
            ...(typeof decimals === "number" ? { decimals } : {}),
        },
    };
}
//# sourceMappingURL=defillama.js.map