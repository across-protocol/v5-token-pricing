import { afterEach, describe, expect, it } from "vitest";
import { DEFAULT_MAX_STALENESS_MS, getTokenPriceAt } from "../src/index.js";
import { jsonResponse, llamaBody, stubFetch } from "./helpers.js";

/**
 * A plausible answer too far from the requested instant is `stale`: kept, while
 * the next source is asked for a closer one. The least stale answer wins only
 * once every address-native source has had its turn.
 *
 * The motivating case: DefiLlama serves Ink WETH on a ~30-minute cadence, so
 * every lookup landed 5 to 25 minutes off and was filed as if it were exact,
 * while CoinGecko's contract-keyed series had a datapoint every 5 minutes.
 */

const INK_WETH = "0x4200000000000000000000000000000000000006";
const INK_WETH_LLAMA_KEY = `ink:${INK_WETH}`;
const REQUESTED_AT = Date.UTC(2026, 8, 30, 7, 5, 0);
const MINUTE = 60 * 1000;

/** Which upstream a stubbed request is for. */
const sourceOf = (url: string): "defillama" | "coingecko" | "alchemy" | "coingecko-by-id" => {
  if (url.includes("coins.llama.fi")) return "defillama";
  if (url.includes("alchemy.com")) return "alchemy";
  if (url.includes("/contract/")) return "coingecko";
  return "coingecko-by-id";
};

/** DefiLlama answering with one datapoint `offsetMs` from the requested instant. */
const llamaAt = (offsetMs: number, price: number): Response =>
  jsonResponse(
    llamaBody({
      coinKey: INK_WETH_LLAMA_KEY,
      price,
      observedAtSeconds: (REQUESTED_AT + offsetMs) / 1000,
    }),
  );

/** CoinGecko (either lookup) answering with one datapoint `offsetMs` from the requested instant. */
const coingeckoAt = (offsetMs: number, price: number): Response =>
  jsonResponse({ prices: [[REQUESTED_AT + offsetMs, price]] });

/** Alchemy answering with one datapoint `offsetMs` from the requested instant. */
const alchemyAt = (offsetMs: number, price: number): Response =>
  jsonResponse({
    data: [
      { value: String(price), timestamp: new Date(REQUESTED_AT + offsetMs).toISOString() },
    ],
  });

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe("stale answers fall through to the next source", () => {
  it("takes CoinGecko's fresh datapoint over DefiLlama's stale one", async () => {
    const stub = stubFetch(({ url }) =>
      sourceOf(url) === "defillama"
        ? llamaAt(-13 * MINUTE, 2657.6)
        : coingeckoAt(0, 2663.6),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.priceUsd).toBe(2663.6);
    expect(result.source).toBe("coingecko");
    expect(result.observedAt).toBe(REQUESTED_AT);
    expect(result.attempts).toEqual([
      { source: "defillama", outcome: "stale" },
      { source: "coingecko", outcome: "ok" },
    ]);
    expect(stub.calls).toHaveLength(2);
  });

  it("moves on to Alchemy when CoinGecko is stale too", async () => {
    const stub = stubFetch(({ url }) => {
      const source = sourceOf(url);
      if (source === "defillama") return llamaAt(-13 * MINUTE, 2657.6);
      if (source === "coingecko") return coingeckoAt(-20 * MINUTE, 2650);
      return alchemyAt(2 * MINUTE, 2663.1);
    });
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
      apiKeys: { alchemy: "alchemy-key" },
    });

    expect(result.priceUsd).toBe(2663.1);
    expect(result.source).toBe("alchemy");
    expect(result.attempts).toEqual([
      { source: "defillama", outcome: "stale" },
      { source: "coingecko", outcome: "stale" },
      { source: "alchemy", outcome: "ok" },
    ]);
  });

  it("takes a datapoint exactly at the threshold as fresh", async () => {
    const stub = stubFetch(() => llamaAt(DEFAULT_MAX_STALENESS_MS, 2660));
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.source).toBe("defillama");
    expect(result.attempts).toEqual([{ source: "defillama", outcome: "ok" }]);
    expect(stub.calls).toHaveLength(1);
  });

  it("measures staleness in both directions", async () => {
    const stub = stubFetch(({ url }) =>
      sourceOf(url) === "defillama"
        ? llamaAt(DEFAULT_MAX_STALENESS_MS + 1000, 2670)
        : coingeckoAt(-MINUTE, 2663.6),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.source).toBe("coingecko");
    expect(result.attempts[0]).toEqual({ source: "defillama", outcome: "stale" });
  });

  it("still lets a miss after a stale answer fall through", async () => {
    const stub = stubFetch(({ url }) => {
      const source = sourceOf(url);
      if (source === "defillama") return llamaAt(-13 * MINUTE, 2657.6);
      if (source === "coingecko") return jsonResponse({}, 404);
      return alchemyAt(MINUTE, 2663.1);
    });
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
      apiKeys: { alchemy: "alchemy-key" },
    });

    expect(result.source).toBe("alchemy");
    expect(result.attempts).toEqual([
      { source: "defillama", outcome: "stale" },
      { source: "coingecko", outcome: "error" },
      { source: "alchemy", outcome: "ok" },
    ]);
  });
});

describe("when every answer is stale", () => {
  it("returns the least stale one, with its own observedAt and metadata", async () => {
    const stub = stubFetch(({ url }) => {
      const source = sourceOf(url);
      if (source === "defillama") return llamaAt(-13 * MINUTE, 2657.6);
      if (source === "coingecko") return coingeckoAt(8 * MINUTE, 2661);
      return alchemyAt(-20 * MINUTE, 2650);
    });
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
      apiKeys: { alchemy: "alchemy-key" },
    });

    expect(result).toEqual({
      priceUsd: 2661,
      observedAt: REQUESTED_AT + 8 * MINUTE,
      source: "coingecko",
      // Across' own symbol for the address (its constants file 0x4200…0006 under
      // ETH). DefiLlama's decimals are NOT carried over: its answer lost.
      symbol: "ETH",
      attempts: [
        { source: "defillama", outcome: "stale" },
        { source: "coingecko", outcome: "stale" },
        { source: "alchemy", outcome: "stale" },
      ],
    });
  });

  it("keeps the earlier source on a tie", async () => {
    const stub = stubFetch(({ url }) =>
      sourceOf(url) === "defillama"
        ? llamaAt(-10 * MINUTE, 2657.6)
        : coingeckoAt(10 * MINUTE, 2661),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.source).toBe("defillama");
    expect(result.priceUsd).toBe(2657.6);
  });

  it("returns a stale answer rather than nothing when no other source prices", async () => {
    const stub = stubFetch(({ url }) =>
      sourceOf(url) === "defillama"
        ? llamaAt(-13 * MINUTE, 2657.6)
        : jsonResponse({ prices: [] }),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.source).toBe("defillama");
    expect(result.priceUsd).toBe(2657.6);
    expect(result.observedAt).toBe(REQUESTED_AT - 13 * MINUTE);
    expect(result.attempts).toEqual([
      { source: "defillama", outcome: "stale" },
      { source: "coingecko", outcome: "no_data" },
      { source: "alchemy", outcome: "skipped_no_key" },
    ]);
  });
});

describe("the asset-keyed lookup stays a last resort", () => {
  it("is not asked once an address-native source answered, even with a stale datapoint", async () => {
    const stub = stubFetch(({ url }) => {
      const source = sourceOf(url);
      if (source === "defillama") return llamaAt(-13 * MINUTE, 2657.6);
      if (source === "coingecko") return jsonResponse({ prices: [] });
      return coingeckoAt(0, 2663.6);
    });
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.source).toBe("defillama");
    expect(stub.calls.map(({ url }) => sourceOf(url))).toEqual(["defillama", "coingecko"]);
  });

  it("answers when nothing address-native did, stale or not", async () => {
    const stub = stubFetch(({ url }) =>
      sourceOf(url) === "coingecko-by-id"
        ? coingeckoAt(-13 * MINUTE, 2657.6)
        : jsonResponse({ coins: {} }),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.source).toBe("coingecko-by-id");
    expect(result.priceUsd).toBe(2657.6);
    expect(result.attempts).toEqual([
      { source: "defillama", outcome: "no_data" },
      { source: "coingecko", outcome: "no_data" },
      { source: "alchemy", outcome: "skipped_no_key" },
      { source: "coingecko-by-id", outcome: "stale" },
    ]);
  });
});

describe("maxStalenessMs", () => {
  it("is overridable per call; Infinity restores take-the-first-answer", async () => {
    const stub = stubFetch(() => llamaAt(-25 * MINUTE, 2657.6));
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
      maxStalenessMs: Number.POSITIVE_INFINITY,
    });

    expect(result.source).toBe("defillama");
    expect(result.attempts).toEqual([{ source: "defillama", outcome: "ok" }]);
    expect(stub.calls).toHaveLength(1);
  });

  it("tightens the threshold when set below the default", async () => {
    const stub = stubFetch(({ url }) =>
      sourceOf(url) === "defillama"
        ? llamaAt(-2 * MINUTE, 2660)
        : coingeckoAt(0, 2663.6),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 57073,
      tokenAddress: INK_WETH,
      timestamp: REQUESTED_AT,
      maxStalenessMs: MINUTE,
    });

    expect(result.source).toBe("coingecko");
    expect(result.attempts).toEqual([
      { source: "defillama", outcome: "stale" },
      { source: "coingecko", outcome: "ok" },
    ]);
  });
});
