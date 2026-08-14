/**
 * Upstreams key EVM tokens by lowercase hex. Non-EVM addresses (Tron base58,
 * which DefiLlama takes natively as `tron:<base58>`) are case-sensitive and
 * must be passed through untouched.
 */
export declare function normalizeTokenAddress(address: string): string;
/** Across' canonical symbol for a token, when it knows the token. */
export declare function symbolForToken(params: {
    chainId: number;
    tokenAddress: string;
}): string | undefined;
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
export declare function coingeckoIdForToken(params: {
    chainId: number;
    tokenAddress: string;
}): string | undefined;
/**
 * Whether a symbol marks the token a USD stablecoin, tolerating the bridged and
 * chain-prefixed spellings Across carries (USDC.e, USDbC, TATARA-USDC, USDT0).
 */
export declare function isUsdStablecoinSymbol(symbol: string): boolean;
//# sourceMappingURL=tokens.d.ts.map