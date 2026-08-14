import { PUBLIC_NETWORKS, TOKEN_SYMBOLS_MAP } from "@across-protocol/constants";
/**
 * Upstreams key EVM tokens by lowercase hex. Non-EVM addresses (Tron base58,
 * which DefiLlama takes natively as `tron:<base58>`) are case-sensitive and
 * must be passed through untouched.
 */
export function normalizeTokenAddress(address) {
    const trimmed = address.trim();
    return trimmed.startsWith("0x") || trimmed.startsWith("0X")
        ? trimmed.toLowerCase()
        : trimmed;
}
/**
 * The `TOKEN_SYMBOLS_MAP` entry for a `(chainId, address)`, or undefined when
 * Across does not carry that deployment.
 *
 * FIRST MATCH WINS, and that ordering is load-bearing: several entries share one
 * mainnet address (USDC, USDC.e, USDbC and USDC-BNB all list `0xA0b8…eB48`), so a
 * last-wins scan would name mainnet USDC "USDC-BNB" and hand it that entry's
 * 18 decimals. Insertion order puts the canonical entry first.
 */
function entryForToken({ chainId, tokenAddress, }) {
    const wanted = normalizeTokenAddress(tokenAddress).toLowerCase();
    for (const token of Object.values(TOKEN_SYMBOLS_MAP)) {
        const addresses = token.addresses;
        const address = addresses[chainId];
        if (address !== undefined && address.toLowerCase() === wanted) {
            return token;
        }
    }
    return undefined;
}
/** Across' canonical symbol for a token, when it knows the token. */
export function symbolForToken(params) {
    return entryForToken(params)?.symbol;
}
/**
 * Address sentinels that mean "this chain's NATIVE asset" rather than a contract.
 *
 * EVM: the zero address plus the `0xEeee…EEeE` convention (1inch/Across); matched
 * lowercased. SVM: the system program id and the wrapped-SOL mint. TVM: Tron's
 * zero sentinel. The non-EVM ones are base58 and CASE-SENSITIVE, so they are
 * compared exactly — lowercasing them would both miss and risk a false match.
 */
const EVM_NATIVE_SENTINELS = new Set([
    "0x0000000000000000000000000000000000000000",
    "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee",
]);
const EXACT_NATIVE_SENTINELS = new Set([
    "11111111111111111111111111111111",
    "So11111111111111111111111111111111111111112",
    "T9yD14Nj9j7xAB4dbGeiX9h8unkKHxuWwb",
]);
/** Whether an address denotes the chain's native asset rather than a contract. */
function isNativeSentinel(address) {
    const trimmed = address.trim();
    return (EVM_NATIVE_SENTINELS.has(trimmed.toLowerCase()) || EXACT_NATIVE_SENTINELS.has(trimmed));
}
/**
 * The coin id of a chain's native asset, derived from data the constants package
 * already carries: `PUBLIC_NETWORKS[chainId].nativeToken` names the symbol, and
 * that symbol's `TOKEN_SYMBOLS_MAP` entry carries the id.
 *
 * DERIVED RATHER THAN TABULATED so it cannot rot: a chain added upstream gets its
 * native asset priced with no edit here. Covers 20 of the 21 chains in the V5
 * launch route matrix; Lighter's `LIT` has no constants entry, so it returns
 * undefined and the caller reports an unpriced token rather than a wrong one.
 */
function nativeCoingeckoIdFor(chainId) {
    const symbol = PUBLIC_NETWORKS[chainId]?.nativeToken;
    if (symbol === undefined)
        return undefined;
    const entry = TOKEN_SYMBOLS_MAP[symbol];
    return entry?.coingeckoId;
}
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
export function coingeckoIdForToken(params) {
    // The token's OWN entry first — the more specific answer. NO CHAIN CURRENTLY
    // EXERCISES THE OVERLAP (a sentinel address that is also a constants entry), so
    // this ordering is defensive rather than load-bearing today; it is written this
    // way so that a chain which later records a token AT its native sentinel gets
    // that token's id rather than the chain's gas asset.
    const own = entryForToken(params)?.coingeckoId;
    if (own !== undefined)
        return own;
    // A native sentinel is not a contract, so no address lookup will ever resolve
    // it. Native ETH is the case that matters: it arrives as the zero address while
    // TOKEN_SYMBOLS_MAP.ETH records each chain's WRAPPED address, so the most
    // bridged asset on the protocol resolves no entry at all.
    return isNativeSentinel(params.tokenAddress)
        ? nativeCoingeckoIdFor(params.chainId)
        : undefined;
}
/**
 * Whether a symbol marks the token a USD stablecoin, tolerating the bridged and
 * chain-prefixed spellings Across carries (USDC.e, USDbC, TATARA-USDC, USDT0).
 */
export function isUsdStablecoinSymbol(symbol) {
    const parts = symbol.toUpperCase().split("-");
    const base = (parts[parts.length - 1] ?? "").split(".")[0] ?? "";
    return base === "DAI" || base.startsWith("USD");
}
//# sourceMappingURL=tokens.js.map