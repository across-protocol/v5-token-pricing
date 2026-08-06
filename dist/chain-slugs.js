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
export const CG_PLATFORM_BY_CHAIN = {
    1: "ethereum",
    10: "optimistic-ethereum",
    56: "binance-smart-chain",
    130: "unichain",
    137: "polygon-pos",
    146: "sonic",
    232: "lens",
    288: "boba",
    324: "zksync",
    480: "world-chain",
    690: "redstone",
    999: "hyperevm",
    1135: "lisk",
    1868: "soneium",
    1996: "sanko",
    8453: "base",
    33139: "apechain",
    34443: "mode",
    42161: "arbitrum-one",
    42220: "celo",
    57073: "ink",
    59144: "linea",
    80094: "berachain",
    81457: "blast",
    534352: "scroll",
    747474: "katana",
    7777777: "zora-network",
};
/** DefiLlama coin-key chain slugs (`{chain}:{address}`). */
export const LLAMA_SLUG_BY_CHAIN = {
    1: "ethereum",
    10: "optimism",
    56: "bsc",
    130: "unichain",
    137: "polygon",
    146: "sonic",
    232: "lens",
    288: "boba",
    324: "era",
    480: "wc",
    690: "redstone",
    999: "hyperliquid",
    1135: "lisk",
    1868: "soneium",
    1996: "sanko",
    8453: "base",
    33139: "apechain",
    34443: "mode",
    41455: "aleph_zero",
    42161: "arbitrum",
    42220: "celo",
    57073: "ink",
    59144: "linea",
    60808: "bob",
    80094: "berachain",
    81457: "blast",
    534352: "scroll",
    747474: "katana",
    7777777: "zora",
    728126428: "tron",
};
/** Alchemy network slugs (the `network` field of the Prices API). */
export const ALCHEMY_NETWORK_BY_CHAIN = {
    1: "eth-mainnet",
    10: "opt-mainnet",
    56: "bnb-mainnet",
    130: "unichain-mainnet",
    137: "polygon-mainnet",
    146: "sonic-mainnet",
    232: "lens-mainnet",
    324: "zksync-mainnet",
    480: "worldchain-mainnet",
    999: "hyperliquid-mainnet",
    1868: "soneium-mainnet",
    8453: "base-mainnet",
    33139: "apechain-mainnet",
    42161: "arb-mainnet",
    42220: "celo-mainnet",
    57073: "ink-mainnet",
    59144: "linea-mainnet",
    80094: "berachain-mainnet",
    81457: "blast-mainnet",
    534352: "scroll-mainnet",
    7777777: "zora-mainnet",
};
//# sourceMappingURL=chain-slugs.js.map