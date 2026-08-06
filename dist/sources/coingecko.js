import { CG_PLATFORM_BY_CHAIN } from "../chain-slugs.js";
import { fetchJson } from "../http.js";
import { asRecord } from "../json.js";
import { normalizeTokenAddress } from "../tokens.js";
import { pickNearest } from "./nearest.js";
const FREE_HOST = "https://api.coingecko.com/api/v3";
const PRO_HOST = "https://pro-api.coingecko.com/api/v3";
/**
 * Granularity follows the range width: a range of at most one day is served
 * 5-minutely, so the window stays well inside that.
 */
const WINDOW_MS = 6 * 60 * 60 * 1000;
/**
 * CoinGecko market_chart/range, address-native. The datapoint nearest the
 * requested instant wins and its own timestamp is reported.
 */
export async function fetchCoinGeckoPrice({ chainId, tokenAddress, timestamp, apiKeys, }) {
    const platform = CG_PLATFORM_BY_CHAIN[chainId];
    if (platform === undefined)
        return { outcome: "skipped_unmapped_chain" };
    const key = apiKeys.coingecko;
    const host = key === undefined ? FREE_HOST : PRO_HOST;
    const from = Math.floor((timestamp - WINDOW_MS) / 1000);
    const to = Math.ceil((timestamp + WINDOW_MS) / 1000);
    const url = `${host}/coins/${platform}/contract/${normalizeTokenAddress(tokenAddress)}` +
        `/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
    let body;
    try {
        body = await fetchJson({
            url,
            // The key travels in a header, never in the query string.
            ...(key === undefined ? {} : { headers: { "x-cg-pro-api-key": key } }),
        });
    }
    catch {
        return { outcome: "error" };
    }
    const prices = asRecord(body)?.["prices"];
    if (!Array.isArray(prices))
        return { outcome: "no_data" };
    const points = [];
    for (const entry of prices) {
        if (!Array.isArray(entry))
            continue;
        const [observedAt, priceUsd] = entry;
        if (typeof observedAt === "number" && typeof priceUsd === "number") {
            points.push({ priceUsd, observedAt });
        }
    }
    const nearest = pickNearest({ points, timestamp });
    if (nearest === undefined)
        return { outcome: "no_data" };
    return { outcome: "ok", observation: nearest };
}
//# sourceMappingURL=coingecko.js.map