/**
 * Numeric chain id -> per-upstream chain identifier.
 *
 * Export names deliberately match
 * integrator-api's src/services/discovery/adapters/outbound/price-sources/chain-slugs.ts
 * so migrating that repo onto this package is a delete-and-import, not a rename.
 *
 * A chain missing from a map means that source is skipped for the call
 * (outcome `skipped_unmapped_chain`), never an error. THAT SILENCE IS THE FAILURE
 * MODE THESE MAPS CAUSE, so an absent entry is a real gap and not a neutral
 * default: the caller sees an unpriced token with no indication that no request
 * was ever made.
 *
 * Every entry added on 2026-08-14 was VERIFIED LIVE rather than guessed, because
 * a wrong slug is indistinguishable from an uncovered token:
 *   - CoinGecko ids against `/api/v3/asset_platforms` (matched on
 *     `chain_identifier` where the platform declares one, else on `id`/`name` —
 *     Hyperliquid, Tron, Solana and Tempo declare none).
 *   - DefiLlama slugs by fetching a known token on each chain and requiring a
 *     price back, e.g. `monad:0x7547…b603`, `robinhood:0x5fc5…d168`.
 *
 * They were found missing by auditing this map against the 21 chains in the V5
 * launch route matrix: 300 of the matrix's 1,696 in-scope token instances were
 * unreachable for want of seven DefiLlama slugs, including all 204 on Robinhood
 * and 45 on Avalanche. integrator-api already carried most of them, so this map
 * had silently drifted into a stale subset of the one it says it matches.
 *
 * ALCHEMY IS DELIBERATELY UNTOUCHED: its network slugs were not verified against
 * a live Alchemy Prices response, and guessing one buys a `no_data` that looks
 * like an uncovered token. Extend it the same way — by probing, not by analogy.
 *
 * Arc (5042) has CoinGecko and DefiLlama rows, both probed 2026-09-15: platform
 * `arc` declares `chain_identifier` 5042 and `market_chart/range` returns points
 * for its USDC at `0x3600…0000`; DefiLlama prices `arc:0x3600…0000`. It has NO
 * Alchemy row: `tokens/historical`, the endpoint this package calls, rejects
 * `arc-mainnet` with "Unsupported network" while `tokens/by-address` accepts it,
 * so a row here would turn every Arc lookup into an `error` attempt that reads as
 * no coverage. Add it once `tokens/historical` answers for arc-mainnet.
 */
/** CoinGecko asset platform ids (`/coins/{platform}/contract/{address}`). */
export const CG_PLATFORM_BY_CHAIN = {
    1: "ethereum",
    10: "optimistic-ethereum",
    56: "binance-smart-chain",
    130: "unichain",
    137: "polygon-pos",
    143: "monad",
    146: "sonic",
    232: "lens",
    288: "boba",
    324: "zksync",
    480: "world-chain",
    690: "redstone",
    999: "hyperevm",
    1135: "lisk",
    1337: "hyperliquid",
    1868: "soneium",
    1996: "sanko",
    4217: "tempo",
    4326: "megaeth",
    4663: "robinhood",
    5042: "arc",
    8453: "base",
    9745: "plasma",
    33139: "apechain",
    34443: "mode",
    42161: "arbitrum-one",
    42220: "celo",
    43114: "avalanche",
    57073: "ink",
    59144: "linea",
    80094: "berachain",
    81457: "blast",
    534352: "scroll",
    747474: "katana",
    7777777: "zora-network",
    728126428: "tron",
    34268394551451: "solana",
};
/** DefiLlama coin-key chain slugs (`{chain}:{address}`). */
export const LLAMA_SLUG_BY_CHAIN = {
    1: "ethereum",
    10: "optimism",
    56: "bsc",
    130: "unichain",
    137: "polygon",
    143: "monad",
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
    4217: "tempo",
    4326: "megaeth",
    4663: "robinhood",
    5042: "arc",
    8453: "base",
    9745: "plasma",
    33139: "apechain",
    34443: "mode",
    41455: "aleph_zero",
    42161: "arbitrum",
    42220: "celo",
    43114: "avax",
    57073: "ink",
    59144: "linea",
    60808: "bob",
    80094: "berachain",
    81457: "blast",
    534352: "scroll",
    747474: "katana",
    7777777: "zora",
    728126428: "tron",
    34268394551451: "solana",
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