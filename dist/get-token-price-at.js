import { isPlausiblePrice } from "./plausibility.js";
import { fetchAlchemyPrice } from "./sources/alchemy.js";
import { fetchCoinGeckoIdPrice } from "./sources/coingecko-by-id.js";
import { fetchCoinGeckoPrice } from "./sources/coingecko.js";
import { fetchDefiLlamaPrice } from "./sources/defillama.js";
import { symbolForToken } from "./tokens.js";
/**
 * Fixed order: free and address-native first, keyed sources after, and the
 * asset-keyed CoinGecko lookup LAST.
 *
 * `coingecko-by-id` is last on purpose. A `coingeckoId` names an ASSET and many
 * deployments share one, so asking it before an address-native source would price
 * every bridged USDC at canonical USDC and hide a depeg. It exists for what the
 * address-native sources structurally cannot reach -- HyperCore account
 * sentinels, native gas assets -- not as a shortcut past them.
 */
const SOURCES = [
    { name: "defillama", fetchPrice: fetchDefiLlamaPrice },
    { name: "coingecko", fetchPrice: fetchCoinGeckoPrice },
    { name: "alchemy", fetchPrice: fetchAlchemyPrice },
    { name: "coingecko-by-id", fetchPrice: fetchCoinGeckoIdPrice },
];
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
export async function getTokenPriceAt({ chainId, tokenAddress, timestamp, apiKeys = {}, }) {
    const knownSymbol = symbolForToken({ chainId, tokenAddress });
    const attempts = [];
    for (const source of SOURCES) {
        const result = await source.fetchPrice({
            chainId,
            tokenAddress,
            timestamp,
            apiKeys,
        });
        if (result.outcome !== "ok") {
            attempts.push({ source: source.name, outcome: result.outcome });
            continue;
        }
        const { priceUsd, observedAt, confidence, symbol, decimals } = result.observation;
        // Across' own name for the token wins over the upstream's when it has one:
        // the plausibility rules read the symbol to recognise a stablecoin, and
        // `TOKEN_SYMBOLS_MAP` spells those consistently while the sources do not.
        const resolvedSymbol = knownSymbol ?? symbol;
        if (!isPlausiblePrice({ priceUsd, symbol: resolvedSymbol })) {
            attempts.push({ source: source.name, outcome: "implausible" });
            continue;
        }
        attempts.push({ source: source.name, outcome: "ok" });
        return {
            priceUsd,
            observedAt,
            source: source.name,
            ...(confidence === undefined ? {} : { confidence }),
            // Reported so a caller can describe what it priced without re-deriving
            // metadata it may not have. Absent when neither Across nor the source names
            // the token; `decimals` only ever comes from DefiLlama today.
            ...(resolvedSymbol === undefined ? {} : { symbol: resolvedSymbol }),
            ...(decimals === undefined ? {} : { decimals }),
            attempts,
        };
    }
    return { priceUsd: null, observedAt: null, source: null, attempts };
}
//# sourceMappingURL=get-token-price-at.js.map