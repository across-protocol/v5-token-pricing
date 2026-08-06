import { isUsdStablecoinSymbol } from "./tokens.js";
/** No whole token is worth more than this; above it the upstream is wrong. */
const MAX_PRICE_USD = 10_000_000;
/** A USD stablecoin outside this band is bad upstream data, not a depeg. */
const STABLECOIN_MIN_USD = 0.5;
const STABLECOIN_MAX_USD = 2;
/**
 * An implausible value is treated as a miss so a later source can still answer.
 */
export function isPlausiblePrice({ priceUsd, symbol, }) {
    if (!Number.isFinite(priceUsd))
        return false;
    if (priceUsd <= 0)
        return false;
    if (priceUsd > MAX_PRICE_USD)
        return false;
    if (symbol !== undefined && isUsdStablecoinSymbol(symbol)) {
        return priceUsd >= STABLECOIN_MIN_USD && priceUsd <= STABLECOIN_MAX_USD;
    }
    return true;
}
//# sourceMappingURL=plausibility.js.map