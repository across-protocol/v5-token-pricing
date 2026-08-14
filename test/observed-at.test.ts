import fc from "fast-check";
import { afterEach, describe, expect, it } from "vitest";
import { getTokenPriceAt } from "../src/index.js";
import { jsonResponse, llamaBody, stubFetch } from "./helpers.js";

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const REQUESTED_AT = Date.UTC(2026, 6, 1, 12, 0, 0);

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

/**
 * THE invariant. `observedAt` is the instant of the datapoint the upstream
 * returned — never the requested instant, never the wall clock. The consumer
 * buckets on it, so a substitution here silently corrupts their history.
 */
describe("observedAt is the upstream instant", () => {
  it("reports DefiLlama's timestamp, not the requested one", async () => {
    const observedAtSeconds = Math.floor(REQUESTED_AT / 1000) - 7 * 60;
    const stub = stubFetch(() =>
      jsonResponse(
        llamaBody({
          coinKey: `base:${BASE_USDC.toLowerCase()}`,
          price: 0.9998,
          observedAtSeconds,
          symbol: "USDC",
          confidence: 0.99,
        }),
      ),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 8453,
      tokenAddress: BASE_USDC,
      timestamp: REQUESTED_AT,
    });

    expect(result).toEqual({
      priceUsd: 0.9998,
      observedAt: observedAtSeconds * 1000,
      source: "defillama",
      confidence: 0.99,
      // Both reported by DefiLlama in the same object as the price, and both
      // passed through so a caller can describe what it priced.
      symbol: "USDC",
      decimals: 6,
      attempts: [{ source: "defillama", outcome: "ok" }],
    });
    expect(result.observedAt).not.toBe(REQUESTED_AT);
    expect(REQUESTED_AT - (result.observedAt ?? 0)).toBe(7 * 60 * 1000);
  });

  it("never returns the requested instant, whatever the upstream offset", async () => {
    await fc.assert(
      fc.asyncProperty(
        // Upstream answers anywhere from 30 minutes early to 30 minutes late.
        fc.integer({ min: -1800, max: 1800 }).filter((offset) => offset !== 0),
        async (offsetSeconds) => {
          const observedAtSeconds =
            Math.floor(REQUESTED_AT / 1000) + offsetSeconds;
          const stub = stubFetch(() =>
            jsonResponse(
              llamaBody({
                coinKey: `arbitrum:${ARBITRUM_WETH.toLowerCase()}`,
                price: 3120.5,
                observedAtSeconds,
              }),
            ),
          );
          try {
            const result = await getTokenPriceAt({
              chainId: 42161,
              tokenAddress: ARBITRUM_WETH,
              timestamp: REQUESTED_AT,
            });
            expect(result.observedAt).toBe(observedAtSeconds * 1000);
            expect(result.observedAt).not.toBe(REQUESTED_AT);
          } finally {
            stub.restore();
          }
        },
      ),
      { numRuns: 50 },
    );
  });

  it("reports CoinGecko's nearest datapoint timestamp", async () => {
    const nearestAt = REQUESTED_AT + 4 * 60 * 1000;
    const stub = stubFetch(({ url }) =>
      url.includes("coins.llama.fi")
        ? jsonResponse({ coins: {} })
        : jsonResponse({
            prices: [
              [REQUESTED_AT - 25 * 60 * 1000, 3100],
              [nearestAt, 3120.5],
              [REQUESTED_AT + 40 * 60 * 1000, 3140],
            ],
          }),
    );
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.source).toBe("coingecko");
    expect(result.priceUsd).toBe(3120.5);
    expect(result.observedAt).toBe(nearestAt);
  });

  it("reports Alchemy's nearest datapoint timestamp", async () => {
    const nearestIso = new Date(REQUESTED_AT - 3 * 60 * 1000).toISOString();
    const stub = stubFetch(({ url }) => {
      if (url.includes("coins.llama.fi")) return jsonResponse({ coins: {} });
      if (url.includes("coingecko")) return jsonResponse({ prices: [] });
      return jsonResponse({
        currency: "usd",
        data: [
          {
            value: "3120.5",
            timestamp: nearestIso,
          },
          {
            value: "3200",
            timestamp: new Date(REQUESTED_AT + 55 * 60 * 1000).toISOString(),
          },
        ],
      });
    });
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
      apiKeys: { alchemy: "test-alchemy-key" },
    });

    expect(result.source).toBe("alchemy");
    expect(result.priceUsd).toBe(3120.5);
    expect(result.observedAt).toBe(Date.parse(nearestIso));
    expect(result.observedAt).not.toBe(REQUESTED_AT);
  });
});
