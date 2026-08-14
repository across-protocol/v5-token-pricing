import { TOKEN_SYMBOLS_MAP } from "@across-protocol/constants";
/**
 * Upstreams key EVM tokens by lowercase hex. Non-EVM addresses (Tron base58,
 * which DefiLlama takes natively as `tron:<base58>`) are case-sensitive and
 * must be passed through untouched.
 */
export function normalizeTokenAddress(address) {
    const trimmed = address.trim();
    return trimmed.startsWith("0x") || trimmed.startsWith("0X")
        ? trimmed.toLowerCase()
        : trimmed;
}
/**
 * The `TOKEN_SYMBOLS_MAP` entry for a `(chainId, address)`, or undefined when
 * Across does not carry that deployment.
 *
 * FIRST MATCH WINS, and that ordering is load-bearing: several entries share one
 * mainnet address (USDC, USDC.e, USDbC and USDC-BNB all list `0xA0b8…eB48`), so a
 * last-wins scan would name mainnet USDC "USDC-BNB" and hand it that entry's
 * 18 decimals. Insertion order puts the canonical entry first.
 */
function entryForToken({ chainId, tokenAddress, }) {
    const wanted = normalizeTokenAddress(tokenAddress).toLowerCase();
    for (const token of Object.values(TOKEN_SYMBOLS_MAP)) {
        const addresses = token.addresses;
        const address = addresses[chainId];
        if (address !== undefined && address.toLowerCase() === wanted) {
            return token;
        }
    }
    return undefined;
}
/** Across' canonical symbol for a token, when it knows the token. */
export function symbolForToken(params) {
    return entryForToken(params)?.symbol;
}
/**
 * The CoinGecko COIN ID Across records for a token, when it knows the token.
 *
 * Names the ASSET, not the deployment, which is exactly what makes it useful for
 * things that have no contract to price (HyperCore's account sentinels, native
 * gas assets) and exactly what makes it unsafe as a first choice: every bridged
 * USDC maps to `usd-coin`, so preferring the id over the address would price a
 * depegged bridged token at its canonical peer's value. See
 * `sources/coingecko-by-id.ts` for why it is ordered last.
 */
export function coingeckoIdForToken(params) {
    return entryForToken(params)?.coingeckoId;
}
/**
 * Whether a symbol marks the token a USD stablecoin, tolerating the bridged and
 * chain-prefixed spellings Across carries (USDC.e, USDbC, TATARA-USDC, USDT0).
 */
export function isUsdStablecoinSymbol(symbol) {
    const parts = symbol.toUpperCase().split("-");
    const base = (parts[parts.length - 1] ?? "").split(".")[0] ?? "";
    return base === "DAI" || base.startsWith("USD");
}
//# sourceMappingURL=tokens.js.map