import type { ApiKeys, SourceResult } from "../types.js";
/**
 * CoinGecko market_chart/range, address-native. The datapoint nearest the
 * requested instant wins and its own timestamp is reported.
 */
export declare function fetchCoinGeckoPrice({ chainId, tokenAddress, timestamp, apiKeys, }: {
    chainId: number;
    tokenAddress: string;
    timestamp: number;
    apiKeys: ApiKeys;
}): Promise<SourceResult>;
//# sourceMappingURL=coingecko.d.ts.map