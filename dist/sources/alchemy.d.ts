import type { ApiKeys, SourceResult } from "../types.js";
export declare function fetchAlchemyPrice({ chainId, tokenAddress, timestamp, apiKeys, }: {
    chainId: number;
    tokenAddress: string;
    timestamp: number;
    apiKeys: ApiKeys;
}): Promise<SourceResult>;
//# sourceMappingURL=alchemy.d.ts.map