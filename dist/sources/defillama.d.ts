import type { SourceResult } from "../types.js";
/**
 * DefiLlama: free, no key, address-native.
 *
 * The returned `timestamp` is the instant of the trade/observation DefiLlama
 * actually has, which can sit minutes from the requested instant depending on
 * the token's liquidity. It is passed through verbatim.
 */
export declare function fetchDefiLlamaPrice({ chainId, tokenAddress, timestamp, }: {
    chainId: number;
    tokenAddress: string;
    timestamp: number;
}): Promise<SourceResult>;
//# sourceMappingURL=defillama.d.ts.map