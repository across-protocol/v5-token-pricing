import { LLAMA_SLUG_BY_CHAIN } from "../chain-slugs.js";
import { fetchJson } from "../http.js";
import { asRecord } from "../json.js";
import { normalizeTokenAddress } from "../tokens.js";
/**
 * DefiLlama: free, no key, address-native.
 *
 * The returned `timestamp` is the instant of the trade/observation DefiLlama
 * actually has, which can sit minutes from the requested instant depending on
 * the token's liquidity. It is passed through verbatim.
 */
export async function fetchDefiLlamaPrice({ chainId, tokenAddress, timestamp, }) {
    const slug = LLAMA_SLUG_BY_CHAIN[chainId];
    if (slug === undefined)
        return { outcome: "skipped_unmapped_chain" };
    const unixSeconds = Math.floor(timestamp / 1000);
    const coinKey = `${slug}:${normalizeTokenAddress(tokenAddress)}`;
    const url = `https://coins.llama.fi/prices/historical/${unixSeconds}/${coinKey}`;
    let body;
    try {
        body = await fetchJson({ url });
    }
    catch {
        return { outcome: "error" };
    }
    const coins = asRecord(asRecord(body)?.["coins"]);
    const coin = asRecord(coins === undefined ? undefined : Object.values(coins)[0]);
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