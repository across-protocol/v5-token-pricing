import { isPlausiblePrice } from "./plausibility.js";
import { fetchAlchemyPrice } from "./sources/alchemy.js";
import { fetchCoinGeckoIdPrice } from "./sources/coingecko-by-id.js";
import { fetchCoinGeckoPrice } from "./sources/coingecko.js";
import { fetchDefiLlamaPrices } from "./sources/defillama.js";
import { symbolForToken } from "./tokens.js";
/**
 * Wrap a per-token ask into the batch shape. Sources whose upstream has no
 * batch endpoint get this; they answer one request per token, as before.
 */
function oneAtATime(fetchPrice) {
    return async ({ requests, apiKeys }) => {
        const results = [];
        for (const request of requests) {
            results.push(await fetchPrice({ ...request, apiKeys }));
        }
        return results;
    };
}
/**
 * Fixed order: free and address-native first, keyed sources after, and the
 * asset-keyed CoinGecko lookup LAST.
 *
 * `coingecko-by-id` is last on purpose. A `coingeckoId` names an ASSET and many
 * deployments share one, so asking it before an address-native source would price
 * every bridged USDC at canonical USDC and hide a depeg. It exists for what the
 * address-native sources structurally cannot reach -- HyperCore account
 * sentinels, native gas assets -- not as a shortcut past them.
 *
 * DefiLlama is the one source that can batch: its historical endpoint takes
 * comma-separated coin keys at one timestamp. The rest answer per token.
 */
const SOURCES = [
    { name: "defillama", ask: fetchDefiLlamaPrices },
    { name: "coingecko", ask: oneAtATime(fetchCoinGeckoPrice) },
    { name: "alchemy", ask: oneAtATime(fetchAlchemyPrice) },
    { name: "coingecko-by-id", ask: oneAtATime(fetchCoinGeckoIdPrice) },
];
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
export async function getTokenPricesAt({ tokens, apiKeys = {}, }) {
    const knownSymbols = tokens.map((token) => symbolForToken(token));
    const attempts = tokens.map(() => []);
    const answers = tokens.map(() => undefined);
    for (const source of SOURCES) {
        const pending = [];
        for (const [i, answer] of answers.entries()) {
            if (answer === undefined)
                pending.push(i);
        }
        if (pending.length === 0)
            break;
        const results = await source.ask({
            requests: pending.map((i) => tokens[i]),
            apiKeys,
        });
        for (const [p, result] of results.entries()) {
            const index = pending[p];
            if (index === undefined)
                continue;
            if (result === undefined)
                continue;
            if (result.outcome !== "ok") {
                attempts[index].push({ source: source.name, outcome: result.outcome });
                continue;
            }
            // Across' own name for the token wins over the upstream's when it has one:
            // the plausibility rules read the symbol to recognise a stablecoin, and
            // `TOKEN_SYMBOLS_MAP` spells those consistently while the sources do not.
            const resolvedSymbol = knownSymbols[index] ?? result.observation.symbol;
            if (!isPlausiblePrice({ priceUsd: result.observation.priceUsd, symbol: resolvedSymbol })) {
                attempts[index].push({ source: source.name, outcome: "implausible" });
                continue;
            }
            attempts[index].push({ source: source.name, outcome: "ok" });
            answers[index] = {
                source: source.name,
                observation: result.observation,
                ...(resolvedSymbol === undefined ? {} : { symbol: resolvedSymbol }),
            };
        }
    }
    return tokens.map((_, i) => {
        const answer = answers[i];
        if (answer === undefined) {
            return { priceUsd: null, observedAt: null, source: null, attempts: attempts[i] };
        }
        const { priceUsd, observedAt, confidence, decimals } = answer.observation;
        return {
            priceUsd,
            observedAt,
            source: answer.source,
            ...(confidence === undefined ? {} : { confidence }),
            // Reported so a caller can describe what it priced without re-deriving
            // metadata it may not have. Absent when neither Across nor the source names
            // the token; `decimals` only ever comes from DefiLlama today.
            ...(answer.symbol === undefined ? {} : { symbol: answer.symbol }),
            ...(decimals === undefined ? {} : { decimals }),
            attempts: attempts[i],
        };
    });
}
//# sourceMappingURL=get-token-prices-at.js.map