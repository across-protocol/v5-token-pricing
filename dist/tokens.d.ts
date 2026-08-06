/**
 * Upstreams key EVM tokens by lowercase hex. Non-EVM addresses (Tron base58,
 * which DefiLlama takes natively as `tron:<base58>`) are case-sensitive and
 * must be passed through untouched.
 */
export declare function normalizeTokenAddress(address: string): string;
/** Across' canonical symbol for a token, when it knows the token. */
export declare function symbolForToken({ chainId, tokenAddress, }: {
    chainId: number;
    tokenAddress: string;
}): string | undefined;
/**
 * Whether a symbol marks the token a USD stablecoin, tolerating the bridged and
 * chain-prefixed spellings Across carries (USDC.e, USDbC, TATARA-USDC, USDT0).
 */
export declare function isUsdStablecoinSymbol(symbol: string): boolean;
//# sourceMappingURL=tokens.d.ts.map