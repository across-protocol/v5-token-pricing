import { isPlausiblePrice } from "./plausibility.js";
import { fetchAlchemyPrice } from "./sources/alchemy.js";
import { fetchCoinGeckoIdPrice } from "./sources/coingecko-by-id.js";
import { fetchCoinGeckoPrice } from "./sources/coingecko.js";
import { fetchDefiLlamaPrice } from "./sources/defillama.js";
import { symbolForToken } from "./tokens.js";
/**
 * How far a datapoint may sit from the requested instant before the next source
 * is asked for a closer one.
 *
 * Five minutes because that is the granularity CoinGecko and Alchemy serve for
 * the windows asked here: a source with data around the instant answers within
 * it. DefiLlama serves some tokens only every ~30 minutes -- measured on
 * 2026-09-30, its Ink WETH and Arbitrum WETH answers sat 7 to 12 minutes from
 * the requested 5-minute marks, while Base and Ethereum USDC landed within a
 * minute.
 */
export const DEFAULT_MAX_STALENESS_MS = 5 * 60 * 1000;
/**
 * Fixed order: free and address-native first, keyed sources after, and the
 * asset-keyed CoinGecko lookup LAST.
 *
 * `coingecko-by-id` is last on purpose. A `coingeckoId` names an ASSET and many
 * deployments share one, so asking it before an address-native source would price
 * every bridged USDC at canonical USDC and hide a depeg. It exists for what the
 * address-native sources structurally cannot reach -- HyperCore account
 * sentinels, native gas assets -- not as a shortcut past them. For the same
 * reason it is not asked at all once an address-native source has answered, even
 * with a stale datapoint: a stale price for the token itself beats a fresh one
 * for its asset.
 */
const SOURCES = [
    { name: "defillama", fetchPrice: fetchDefiLlamaPrice },
    { name: "coingecko", fetchPrice: fetchCoinGeckoPrice },
    { name: "alchemy", fetchPrice: fetchAlchemyPrice },
    { name: "coingecko-by-id", assetKeyed: true, fetchPrice: fetchCoinGeckoIdPrice },
];
/**
 * What was this token worth at this instant?
 *
 * Sources are tried in order until one answers plausibly AND within
 * `maxStalenessMs` of `timestamp`. A source that throws, times out, has no
 * datapoint, or returns an implausible value is a miss, not a failure — the next
 * source still gets its turn. A plausible answer that is too far from
 * `timestamp` is `stale`: it is kept, and the next source is asked for a closer
 * one. If no source answers within the threshold, the least stale answer wins.
 *
 * `observedAt` is the upstream datapoint's own instant, reported verbatim — even
 * when a stale answer wins, so the caller can still see how far it landed.
 * `priceUsd === null` means nothing could price the token — no interpolation, no
 * substitution, ever.
 *
 * `attempts` records what each tried source did, on both paths.
 */
export async function getTokenPriceAt({ chainId, tokenAddress, timestamp, apiKeys = {}, maxStalenessMs = DEFAULT_MAX_STALENESS_MS, }) {
    const knownSymbol = symbolForToken({ chainId, tokenAddress });
    const attempts = [];
    let leastStale;
    for (const source of SOURCES) {
        if (source.assetKeyed && leastStale !== undefined)
            continue;
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
        const { priceUsd, observedAt, symbol } = result.observation;
        // Across' own name for the token wins over the upstream's when it has one:
        // the plausibility rules read the symbol to recognise a stablecoin, and
        // `TOKEN_SYMBOLS_MAP` spells those consistently while the sources do not.
        const resolvedSymbol = knownSymbol ?? symbol;
        if (!isPlausiblePrice({ priceUsd, symbol: resolvedSymbol })) {
            attempts.push({ source: source.name, outcome: "implausible" });
            continue;
        }
        const candidate = {
            source: source.name,
            observation: result.observation,
            symbol: resolvedSymbol,
            stalenessMs: Math.abs(observedAt - timestamp),
        };
        if (candidate.stalenessMs <= maxStalenessMs) {
            attempts.push({ source: source.name, outcome: "ok" });
            return pricedResult({ candidate, attempts });
        }
        // Too far from the instant to take while a later source may do better. Ties
        // keep the earlier source, so the fixed order still decides between equals.
        attempts.push({ source: source.name, outcome: "stale" });
        if (leastStale === undefined || candidate.stalenessMs < leastStale.stalenessMs) {
            leastStale = candidate;
        }
    }
    if (leastStale !== undefined)
        return pricedResult({ candidate: leastStale, attempts });
    return { priceUsd: null, observedAt: null, source: null, attempts };
}
function pricedResult({ candidate, attempts, }) {
    const { priceUsd, observedAt, confidence, decimals } = candidate.observation;
    return {
        priceUsd,
        observedAt,
        source: candidate.source,
        ...(confidence === undefined ? {} : { confidence }),
        // Reported so a caller can describe what it priced without re-deriving
        // metadata it may not have. Absent when neither Across nor the source names
        // the token; `decimals` only ever comes from DefiLlama today.
        ...(candidate.symbol === undefined ? {} : { symbol: candidate.symbol }),
        ...(decimals === undefined ? {} : { decimals }),
        attempts,
    };
}
//# sourceMappingURL=get-token-price-at.js.map