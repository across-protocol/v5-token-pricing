import { describe, expect, it } from "vitest";
import { getTokenPriceAt } from "../src/index.js";

/**
 * Live check against DefiLlama, which needs no credential.
 * Off by default; run with LIVE_PRICE_TESTS=1 pnpm test.
 */
const live = process.env["LIVE_PRICE_TESTS"] === "1" ? describe : describe.skip;

const BASE_USDC = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
// Arc's only token; also the chain's native asset behind an ERC-20 facade.
const ARC_USDC = "0x3600000000000000000000000000000000000000";

live("live DefiLlama", () => {
  const timestamp = Date.now() - 24 * 60 * 60 * 1000;
  // These check that DefiLlama is reachable, not the staleness policy: DefiLlama
  // serves Arbitrum WETH only every ~30 minutes, so under the default threshold
  // CoinGecko would answer instead.
  const maxStalenessMs = Number.POSITIVE_INFINITY;

  it("prices Base USDC near the requested instant", async () => {
    const result = await getTokenPriceAt({
      chainId: 8453,
      tokenAddress: BASE_USDC,
      timestamp,
      maxStalenessMs,
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
      maxStalenessMs,
    });

    expect(result.source).toBe("defillama");
    expect(result.priceUsd).toBeGreaterThan(0);
    expect(typeof result.observedAt).toBe("number");
  });

  it("prices Arc USDC, so the 5042 slug reaches a real DefiLlama coin", async () => {
    const result = await getTokenPriceAt({
      chainId: 5042,
      tokenAddress: ARC_USDC,
      timestamp,
      maxStalenessMs,
    });

    expect(result.source).toBe("defillama");
    expect(result.priceUsd).toBeGreaterThan(0.5);
    expect(result.priceUsd).toBeLessThan(2);
  });
});
