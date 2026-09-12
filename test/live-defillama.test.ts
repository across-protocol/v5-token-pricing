import { describe, expect, it } from "vitest";
import { getTokenPriceAt, getTokenPricesAt } from "../src/index.js";

/**
 * Live check against DefiLlama, which needs no credential.
 * Off by default; run with LIVE_PRICE_TESTS=1 pnpm test.
 */
const live = process.env["LIVE_PRICE_TESTS"] === "1" ? describe : describe.skip;

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const OPTIMISM_USDC = "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85";

live("live DefiLlama", () => {
  const timestamp = Date.now() - 24 * 60 * 60 * 1000;

  it("prices Base USDC near the requested instant", async () => {
    const result = await getTokenPriceAt({
      chainId: 8453,
      tokenAddress: BASE_USDC,
      timestamp,
    });

    expect(result.source).toBe("defillama");
    expect(result.priceUsd).toBeGreaterThan(0.5);
    expect(result.priceUsd).toBeLessThan(2);
    // Near, but there is no promise of exact: report what came back.
    expect(Math.abs((result.observedAt ?? 0) - timestamp)).toBeLessThan(
      6 * 60 * 60 * 1000,
    );
  });

  it("prices Arbitrum WETH and can land at a different offset than USDC", async () => {
    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp,
    });

    expect(result.source).toBe("defillama");
    expect(result.priceUsd).toBeGreaterThan(0);
    expect(typeof result.observedAt).toBe("number");
  });

  it("prices several tokens on one batched request", async () => {
    const tokens = [
      { chainId: 8453, tokenAddress: BASE_USDC, timestamp },
      { chainId: 42161, tokenAddress: ARBITRUM_WETH, timestamp },
      { chainId: 10, tokenAddress: OPTIMISM_USDC, timestamp },
    ];

    const results = await getTokenPricesAt({ tokens });

    // One comma-separated request must answer all three; if DefiLlama only
    // echoed the first key back, the later entries would fall through to the
    // keyed sources (and be skipped here, where no keys are injected).
    for (const result of results) {
      expect(result.source).toBe("defillama");
      expect(result.priceUsd).toBeGreaterThan(0);
    }
  });
});
