import { isPlausiblePrice } from "./plausibility.js";
import { fetchAlchemyPrice } from "./sources/alchemy.js";
import { fetchCoinGeckoPrice } from "./sources/coingecko.js";
import { fetchDefiLlamaPrice } from "./sources/defillama.js";
import { symbolForToken } from "./tokens.js";
/** Fixed order: free and address-native first, keyed sources after. */
const SOURCES = [
    { name: "defillama", fetchPrice: fetchDefiLlamaPrice },
    { name: "coingecko", fetchPrice: fetchCoinGeckoPrice },
    { name: "alchemy", fetchPrice: fetchAlchemyPrice },
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
        const { priceUsd, observedAt, confidence, symbol } = result.observation;
        if (!isPlausiblePrice({ priceUsd, symbol: knownSymbol ?? symbol })) {
            attempts.push({ source: source.name, outcome: "implausible" });
            continue;
        }
        attempts.push({ source: source.name, outcome: "ok" });
        return {
            priceUsd,
            observedAt,
            source: source.name,
            ...(confidence === undefined ? {} : { confidence }),
            attempts,
        };
    }
    return { priceUsd: null, observedAt: null, source: null, attempts };
}
//# sourceMappingURL=get-token-price-at.js.map