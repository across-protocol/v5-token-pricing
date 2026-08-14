import { afterEach, describe, expect, it } from "vitest";
import { getTokenPriceAt } from "../src/index.js";
import type { TokenPriceResult } from "../src/index.js";
import { jsonResponse, llamaBody, stubFetch } from "./helpers.js";

/**
 * The asset-keyed CoinGecko lookup: pricing things that have no contract.
 *
 * Every other source asks "what is the token at this address on this chain
 * worth". These are the cases where that question has no answer even though the
 * asset is perfectly liquid, and they are why this rung exists.
 */

// HyperCore (1337) USDC-SPOT. Not a contract — an ACCOUNT SENTINEL. Across'
// constants record it with coingeckoId "usd-coin", because it IS USD Coin.
const HYPERCORE_USDC_SPOT = "0x2000000000000000000000000000000000000000";
// Base USDC: a real contract, deliberately chosen for the ordering test.
const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

const REQUESTED_AT = Date.UTC(2026, 6, 1, 12, 0, 0);
const OBSERVED_AT = REQUESTED_AT - 90 * 1000;

/**
 * Narrow a result to the PRICED variant. `symbol` and `decimals` exist only on
 * that arm, so reading them off the bare union does not compile — which is the
 * type doing its job: an unpriced result has no token metadata to report.
 */
const priced = (r: TokenPriceResult): Extract<TokenPriceResult, { priceUsd: number }> => {
  if (r.priceUsd === null) throw new Error("expected a priced result, got null");
  return r;
};

/** A by-id lookup: `/coins/{id}/market_chart/…` with no `/contract/` segment. */
const isByIdCall = (url: string): boolean =>
  url.includes("/market_chart/") && !url.includes("/contract/");

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe("pricing an asset with no contract", () => {
  it("prices a HyperCore account sentinel by its recorded coin id", async () => {
    // THE CASE THIS RUNG WAS ADDED FOR. Nothing is deployed at 0x2000…0000, so
    // every address-native source correctly finds nothing; the asset is still USDC.
    const stub = stubFetch(({ url }) =>
      url.includes("/coins/usd-coin/market_chart/range")
        ? jsonResponse({ prices: [[OBSERVED_AT, 0.9997]] })
        : jsonResponse({ coins: {} }),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 1337,
      tokenAddress: HYPERCORE_USDC_SPOT,
      timestamp: REQUESTED_AT,
    });

    expect(result.priceUsd).toBe(0.9997);
    expect(result.source).toBe("coingecko-by-id");
    expect(result.observedAt).toBe(OBSERVED_AT);
    // Across' own symbol, not an upstream label — the asset-keyed reply carries none.
    expect(priced(result).symbol).toBe("USDC-SPOT");
  });

  it("asks about the REQUESTED instant, never for a current price", async () => {
    // The divergence from quote-api and integrator-api, which both use
    // `simple/price` (current-only) for their id lookups. A timestamped question
    // answered with a spot price is silently wrong, so this rung uses
    // market_chart/range like the contract-keyed CoinGecko source beside it.
    const stub = stubFetch(({ url }) =>
      url.includes("/coins/usd-coin/market_chart/range")
        ? jsonResponse({ prices: [[OBSERVED_AT, 0.9997]] })
        : jsonResponse({ coins: {} }),
    );
    restore = stub.restore;

    await getTokenPriceAt({
      chainId: 1337,
      tokenAddress: HYPERCORE_USDC_SPOT,
      timestamp: REQUESTED_AT,
    });

    const byId = stub.calls.find((c) => c.url.includes("/coins/usd-coin/"));
    expect(byId?.url).toContain("market_chart/range");
    expect(byId?.url).not.toContain("simple/price");
    // The window brackets the requested instant on both sides.
    const from = Number(new URL(byId?.url ?? "").searchParams.get("from"));
    const to = Number(new URL(byId?.url ?? "").searchParams.get("to"));
    expect(from).toBeLessThan(REQUESTED_AT / 1000);
    expect(to).toBeGreaterThan(REQUESTED_AT / 1000);
  });

  it("is NOT consulted when an address-native source already answered", async () => {
    // ORDERING IS A CORRECTNESS PROPERTY, not a preference. A coingeckoId names
    // the ASSET and many deployments share one (every bridged USDC maps to
    // usd-coin), so reaching for it while the deployment itself is priceable would
    // report canonical USDC's price for a depegged bridged token and hide the
    // depeg. Base USDC is a real contract, so the ladder must stop before here.
    const stub = stubFetch(({ url }) =>
      url.includes("coins.llama.fi")
        ? jsonResponse(
            llamaBody({
              coinKey: `base:${BASE_USDC.toLowerCase()}`,
              price: 0.9998,
              observedAtSeconds: Math.floor(OBSERVED_AT / 1000),
              symbol: "USDC",
            }),
          )
        : jsonResponse({ prices: [[OBSERVED_AT, 1.0]] }),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 8453,
      tokenAddress: BASE_USDC,
      timestamp: REQUESTED_AT,
    });

    expect(result.source).toBe("defillama");
    expect(result.attempts).toEqual([{ source: "defillama", outcome: "ok" }]);
    expect(stub.calls.some((c) => isByIdCall(c.url))).toBe(false);
  });

  it("skips itself for a token Across does not carry, without a request", async () => {
    // An address the constants map has never heard of has no coin id to ask about.
    // That must cost nothing rather than produce a wrong guess.
    const unknown = "0x00000000000000000000000000000000000000ff";
    const stub = stubFetch(() => jsonResponse({ coins: {} }));
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 8453,
      tokenAddress: unknown,
      timestamp: REQUESTED_AT,
    });

    expect(result.priceUsd).toBeNull();
    expect(result.attempts.at(-1)).toEqual({
      source: "coingecko-by-id",
      outcome: "skipped_unmapped_chain",
    });
    // Matched on the BY-ID url shape, not on `market_chart/range`: the
    // contract-keyed CoinGecko source uses that same path segment
    // (`/coins/{platform}/contract/{addr}/market_chart/range`) and legitimately
    // does run here. The by-id shape is the one with no `/contract/` in it.
    expect(stub.calls.some((c) => isByIdCall(c.url))).toBe(false);
  });
});

describe("reported token metadata", () => {
  it("prefers Across' symbol over the upstream's, and passes DefiLlama's decimals", async () => {
    // The sources disagree on spelling for one token (DefiLlama calls Avalanche's
    // USDC "AvalancheUSDC"), and the plausibility rules read the symbol to
    // recognise a stablecoin — so Across' consistent spelling has to win. Decimals
    // have no such second opinion and come through verbatim.
    const stub = stubFetch(() =>
      jsonResponse(
        llamaBody({
          coinKey: `base:${BASE_USDC.toLowerCase()}`,
          price: 0.9998,
          observedAtSeconds: Math.floor(OBSERVED_AT / 1000),
          symbol: "SomeUpstreamSpelling",
        }),
      ),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 8453,
      tokenAddress: BASE_USDC,
      timestamp: REQUESTED_AT,
    });

    expect(priced(result).symbol).toBe("USDC");
    expect(priced(result).decimals).toBe(6);
  });

  it("omits both fields when neither Across nor the source names the token", async () => {
    // Absent, never invented: a caller that needs a symbol must be able to tell
    // that nobody supplied one.
    const unknown = "0x00000000000000000000000000000000000000ff";
    const stub = stubFetch(({ url }) =>
      url.includes("coins.llama.fi")
        ? jsonResponse({
            coins: {
              [`base:${unknown}`]: { price: 12.5, timestamp: Math.floor(OBSERVED_AT / 1000) },
            },
          })
        : jsonResponse({ prices: [] }),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 8453,
      tokenAddress: unknown,
      timestamp: REQUESTED_AT,
    });

    expect(result.priceUsd).toBe(12.5);
    expect(priced(result).symbol).toBeUndefined();
    expect(priced(result).decimals).toBeUndefined();
  });
});
