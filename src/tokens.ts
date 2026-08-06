import { TOKEN_SYMBOLS_MAP } from "@across-protocol/constants";

/**
 * Upstreams key EVM tokens by lowercase hex. Non-EVM addresses (Tron base58,
 * which DefiLlama takes natively as `tron:<base58>`) are case-sensitive and
 * must be passed through untouched.
 */
export function normalizeTokenAddress(address: string): string {
  const trimmed = address.trim();
  return trimmed.startsWith("0x") || trimmed.startsWith("0X")
    ? trimmed.toLowerCase()
    : trimmed;
}

/** Across' canonical symbol for a token, when it knows the token. */
export function symbolForToken({
  chainId,
  tokenAddress,
}: {
  chainId: number;
  tokenAddress: string;
}): string | undefined {
  const wanted = normalizeTokenAddress(tokenAddress).toLowerCase();
  for (const token of Object.values(TOKEN_SYMBOLS_MAP)) {
    const addresses: Record<number, string> = token.addresses;
    const address = addresses[chainId];
    if (address !== undefined && address.toLowerCase() === wanted) {
      return token.symbol;
    }
  }
  return undefined;
}

/**
 * Whether a symbol marks the token a USD stablecoin, tolerating the bridged and
 * chain-prefixed spellings Across carries (USDC.e, USDbC, TATARA-USDC, USDT0).
 */
export function isUsdStablecoinSymbol(symbol: string): boolean {
  const parts = symbol.toUpperCase().split("-");
  const base = (parts[parts.length - 1] ?? "").split(".")[0] ?? "";
  return base === "DAI" || base.startsWith("USD");
}
