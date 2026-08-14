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
 */
/** CoinGecko asset platform ids (`/coins/{platform}/contract/{address}`). */
export declare const CG_PLATFORM_BY_CHAIN: Readonly<Record<number, string>>;
/** DefiLlama coin-key chain slugs (`{chain}:{address}`). */
export declare const LLAMA_SLUG_BY_CHAIN: Readonly<Record<number, string>>;
/** Alchemy network slugs (the `network` field of the Prices API). */
export declare const ALCHEMY_NETWORK_BY_CHAIN: Readonly<Record<number, string>>;
//# sourceMappingURL=chain-slugs.d.ts.map