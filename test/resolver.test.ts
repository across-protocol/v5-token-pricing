import { afterEach, describe, expect, it } from "vitest";
import { getTokenPriceAt } from "../src/index.js";
import { jsonResponse, llamaBody, stubFetch } from "./helpers.js";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const REQUESTED_AT = Date.UTC(2026, 6, 1, 12, 0, 0);
const OBSERVED_AT = REQUESTED_AT - 2 * 60 * 1000;

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe("ordered fallback", () => {
  it("falls through to CoinGecko when DefiLlama has no data", async () => {
    const stub = stubFetch(({ url }) =>
      url.includes("coins.llama.fi")
        ? jsonResponse({ coins: {} })
        : jsonResponse({ prices: [[OBSERVED_AT, 3120.5]] }),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.priceUsd).toBe(3120.5);
    expect(result.source).toBe("coingecko");
    expect(result.attempts).toEqual([
      { source: "defillama", outcome: "no_data" },
      { source: "coingecko", outcome: "ok" },
    ]);
  });

  it("treats an upstream error as a miss, not a failure", async () => {
    const stub = stubFetch(({ url }) => {
      if (url.includes("coins.llama.fi")) throw new Error("socket hang up");
      return jsonResponse({ prices: [[OBSERVED_AT, 3120.5]] });
    });
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.source).toBe("coingecko");
    expect(result.attempts[0]).toEqual({
      source: "defillama",
      outcome: "error",
    });
  });

  it("stops at the first source that answers", async () => {
    const stub = stubFetch(() =>
      jsonResponse(
        llamaBody({
          coinKey: `arbitrum:${ARBITRUM_WETH.toLowerCase()}`,
          price: 3120.5,
          observedAtSeconds: Math.floor(OBSERVED_AT / 1000),
        }),
      ),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
      apiKeys: { coingecko: "cg-key", alchemy: "alchemy-key" },
    });

    expect(result.source).toBe("defillama");
    expect(stub.calls).toHaveLength(1);
    expect(result.attempts).toEqual([{ source: "defillama", outcome: "ok" }]);
  });
});

describe("implausible values are misses", () => {
  const cases: { label: string; price: number }[] = [
    { label: "zero", price: 0 },
    { label: "negative", price: -1 },
    { label: "above the $10m ceiling", price: 10_000_001 },
  ];

  for (const { label, price } of cases) {
    it(`rejects a ${label} price and lets the next source answer`, async () => {
      const stub = stubFetch(({ url }) =>
        url.includes("coins.llama.fi")
          ? jsonResponse(
              llamaBody({
                coinKey: `arbitrum:${ARBITRUM_WETH.toLowerCase()}`,
                price,
                observedAtSeconds: Math.floor(OBSERVED_AT / 1000),
              }),
            )
          : jsonResponse({ prices: [[OBSERVED_AT, 3120.5]] }),
      );
      restore = stub.restore;

      const result = await getTokenPriceAt({
        chainId: 42161,
        tokenAddress: ARBITRUM_WETH,
        timestamp: REQUESTED_AT,
      });

      expect(result.attempts).toEqual([
        { source: "defillama", outcome: "implausible" },
        { source: "coingecko", outcome: "ok" },
      ]);
      expect(result.priceUsd).toBe(3120.5);
    });
  }

  it("rejects a USD stablecoin outside the [0.50, 2.00] band", async () => {
    const stub = stubFetch(({ url }) =>
      url.includes("coins.llama.fi")
        ? jsonResponse(
            llamaBody({
              coinKey: `base:${BASE_USDC.toLowerCase()}`,
              price: 4.2,
              observedAtSeconds: Math.floor(OBSERVED_AT / 1000),
              symbol: "USDC",
            }),
          )
        : jsonResponse({ prices: [[OBSERVED_AT, 1.0001]] }),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 8453,
      tokenAddress: BASE_USDC,
      timestamp: REQUESTED_AT,
    });

    expect(result.attempts).toEqual([
      { source: "defillama", outcome: "implausible" },
      { source: "coingecko", outcome: "ok" },
    ]);
    expect(result.priceUsd).toBe(1.0001);
  });

  it("keeps a non-stablecoin price that would fail the stablecoin band", async () => {
    const stub = stubFetch(() =>
      jsonResponse(
        llamaBody({
          coinKey: `arbitrum:${ARBITRUM_WETH.toLowerCase()}`,
          price: 3120.5,
          observedAtSeconds: Math.floor(OBSERVED_AT / 1000),
          symbol: "WETH",
        }),
      ),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.priceUsd).toBe(3120.5);
  });
});

describe("skips", () => {
  it("skips sources that have no identifier for the chain", async () => {
    const stub = stubFetch(() => jsonResponse({}));
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 987654,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
      apiKeys: { alchemy: "alchemy-key" },
    });

    expect(stub.calls).toHaveLength(0);
    expect(result).toEqual({
      priceUsd: null,
      observedAt: null,
      source: null,
      attempts: [
        { source: "defillama", outcome: "skipped_unmapped_chain" },
        { source: "coingecko", outcome: "skipped_unmapped_chain" },
        { source: "alchemy", outcome: "skipped_unmapped_chain" },
      ],
    });
  });

  it("skips Alchemy when no key was injected for the call", async () => {
    const stub = stubFetch(({ url }) =>
      url.includes("coins.llama.fi")
        ? jsonResponse({ coins: {} })
        : jsonResponse({ prices: [] }),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.priceUsd).toBeNull();
    expect(result.attempts).toEqual([
      { source: "defillama", outcome: "no_data" },
      { source: "coingecko", outcome: "no_data" },
      { source: "alchemy", outcome: "skipped_no_key" },
    ]);
  });

  it("uses the pro host and header only when a CoinGecko key is injected", async () => {
    const stub = stubFetch(({ url }) =>
      url.includes("coins.llama.fi")
        ? jsonResponse({ coins: {} })
        : jsonResponse({ prices: [[OBSERVED_AT, 3120.5]] }),
    );
    restore = stub.restore;

    await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
      apiKeys: { coingecko: "cg-key" },
    });

    const coingeckoCall = stub.calls[1];
    expect(coingeckoCall?.url).toContain("https://pro-api.coingecko.com");
    expect(coingeckoCall?.url).not.toContain("cg-key");
    expect(coingeckoCall?.init?.headers).toEqual({
      "x-cg-pro-api-key": "cg-key",
    });
  });
});

describe("unpriced", () => {
  it("returns null with the full attempt list when every source misses", async () => {
    const stub = stubFetch(({ url }) => {
      if (url.includes("coins.llama.fi")) return jsonResponse({ coins: {} });
      if (url.includes("coingecko")) return jsonResponse({}, 404);
      return jsonResponse({ data: [] });
    });
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
      apiKeys: { alchemy: "alchemy-key" },
    });

    expect(result).toEqual({
      priceUsd: null,
      observedAt: null,
      source: null,
      attempts: [
        { source: "defillama", outcome: "no_data" },
        { source: "coingecko", outcome: "error" },
        { source: "alchemy", outcome: "no_data" },
      ],
    });
  });
});
