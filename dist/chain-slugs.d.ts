/**
 * Numeric chain id -> per-upstream chain identifier.
 *
 * Export names deliberately match
 * integrator-api's src/services/discovery/adapters/outbound/price-sources/chain-slugs.ts
 * so migrating that repo onto this package is a delete-and-import, not a rename.
 *
 * A chain missing from a map means that source is skipped for the call
 * (outcome `skipped_unmapped_chain`), never an error.
 */
/** CoinGecko asset platform ids (`/coins/{platform}/contract/{address}`). */
export declare const CG_PLATFORM_BY_CHAIN: Readonly<Record<number, string>>;
/** DefiLlama coin-key chain slugs (`{chain}:{address}`). */
export declare const LLAMA_SLUG_BY_CHAIN: Readonly<Record<number, string>>;
/** Alchemy network slugs (the `network` field of the Prices API). */
export declare const ALCHEMY_NETWORK_BY_CHAIN: Readonly<Record<number, string>>;
//# sourceMappingURL=chain-slugs.d.ts.map