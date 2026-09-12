import { fetchErrorOutcome, fetchJson } from "../http.js";
import { asRecord } from "../json.js";
import { coingeckoIdForToken } from "../tokens.js";
import { pickNearest } from "./nearest.js";
const FREE_HOST = "https://api.coingecko.com/api/v3";
const PRO_HOST = "https://pro-api.coingecko.com/api/v3";
/** Same window as the contract-keyed lookup: <= 1 day of range is served 5-minutely. */
const WINDOW_MS = 6 * 60 * 60 * 1000;
/**
 * CoinGecko market_chart/range keyed by COIN ID rather than contract address.
 *
 * THE ONLY SOURCE HERE THAT DOES NOT NEED THE TOKEN TO BE A CONTRACT, which is
 * the entire reason it exists. Every other source asks "what is the token at this
 * address on this chain worth", and that question has no answer for an asset that
 * is not an on-chain contract:
 *
 *   - HyperCore (1337) balances are ACCOUNT SENTINELS (`0x2000…0000` is
 *     USDC-SPOT, `0x2100…0000` is USDC-PERPS). No contract lives at either, so
 *     the contract lookup 404s however correct the platform id is.
 *   - Native gas assets arrive as the zero address, which resolves to nothing
 *     anywhere — while the asset itself is the most liquid thing on the chain.
 *
 * Both are priceable the moment you stop insisting on an address: `USDC-SPOT` IS
 * USD Coin, and Across' own constants already say so
 * (`TOKEN_SYMBOLS_MAP["USDC-SPOT"].coingeckoId === "usd-coin"`). All 61 entries
 * carry a `coingeckoId`, so this source needs no map of its own.
 *
 * PRIOR ART, DELIBERATELY MATCHED — both sibling services already do exactly
 * this, and this package was the outlier:
 *   - quote-api keeps a `CG_CONTRACTS_DEFERRED_TO_ID` set (which explicitly holds
 *     the HyperCore `USDT-SPOT` and `USDH-SPOT` addresses) and routes it to
 *     `getCurrentPriceById`.
 *   - integrator-api carries `coingeckoId` on its `PricingToken` and resolves it
 *     via `simple/price?ids=`, noting that such tokens are "never contract-priced,
 *     even when the id lookup fails (legacy CG_CONTRACTS_DEFERRED_TO_ID
 *     semantics)".
 *
 * WHERE THIS DIVERGES FROM BOTH, on purpose: they call `simple/price`, which
 * answers about NOW. This package's whole contract is point-in-time, so it uses
 * `market_chart/range` and picks the datapoint nearest the requested instant —
 * the same shape as the contract-keyed CoinGecko source next to it. A
 * timestamped question must not be answered with a current price.
 *
 * ORDERED AFTER the address-native sources rather than before them: a token that
 * IS a contract should be priced as itself, because a `coingeckoId` names the
 * ASSET and several distinct deployments share one (every bridged USDC maps to
 * `usd-coin`), which would flatten a depegged bridged token onto its canonical
 * peer's price. This source is the fallback for what the others structurally
 * cannot reach, never a shortcut past them.
 */
export async function fetchCoinGeckoIdPrice({ chainId, tokenAddress, timestamp, apiKeys, }) {
    const coingeckoId = coingeckoIdForToken({ chainId, tokenAddress });
    // Not an unmapped CHAIN — the chain may well be mapped. Across simply does not
    // know this token, so there is no id to ask about.
    if (coingeckoId === undefined)
        return { outcome: "skipped_unmapped_chain" };
    const key = apiKeys.coingecko;
    const host = key === undefined ? FREE_HOST : PRO_HOST;
    const from = Math.floor((timestamp - WINDOW_MS) / 1000);
    const to = Math.ceil((timestamp + WINDOW_MS) / 1000);
    const url = `${host}/coins/${encodeURIComponent(coingeckoId)}` +
        `/market_chart/range?vs_currency=usd&from=${from}&to=${to}`;
    let body;
    try {
        body = await fetchJson({
            url,
            // The key travels in a header, never in the query string.
            ...(key === undefined ? {} : { headers: { "x-cg-pro-api-key": key } }),
        });
    }
    catch (error) {
        return fetchErrorOutcome(error);
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
//# sourceMappingURL=coingecko-by-id.js.map