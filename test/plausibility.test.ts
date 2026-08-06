import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { isPlausiblePrice } from "../src/plausibility.js";
import { isUsdStablecoinSymbol, normalizeTokenAddress } from "../src/tokens.js";

describe("isPlausiblePrice", () => {
  it("rejects non-finite, non-positive and absurd values", () => {
    for (const priceUsd of [
      Number.NaN,
      Number.POSITIVE_INFINITY,
      0,
      -0.01,
      10_000_000.01,
    ]) {
      expect(isPlausiblePrice({ priceUsd, symbol: "WETH" })).toBe(false);
    }
  });

  it("accepts anything positive up to the ceiling for a non-stablecoin", () => {
    fc.assert(
      fc.property(
        fc.double({ min: 1e-12, max: 10_000_000, noNaN: true }),
        (priceUsd) =>
          isPlausiblePrice({ priceUsd, symbol: "WETH" }) === true,
      ),
    );
  });

  it("holds USD stablecoins to [0.50, 2.00]", () => {
    expect(isPlausiblePrice({ priceUsd: 0.5, symbol: "USDC" })).toBe(true);
    expect(isPlausiblePrice({ priceUsd: 2, symbol: "USDC" })).toBe(true);
    expect(isPlausiblePrice({ priceUsd: 0.49, symbol: "USDC" })).toBe(false);
    expect(isPlausiblePrice({ priceUsd: 2.01, symbol: "USDC" })).toBe(false);
    expect(isPlausiblePrice({ priceUsd: 2.01, symbol: "WETH" })).toBe(true);
  });

  it("applies no band when the symbol is unknown", () => {
    expect(isPlausiblePrice({ priceUsd: 2.01, symbol: undefined })).toBe(true);
  });
});

describe("isUsdStablecoinSymbol", () => {
  it("recognises the bridged and chain-prefixed spellings", () => {
    for (const symbol of [
      "USDC",
      "USDC.e",
      "USDbC",
      "USDzC",
      "USDT",
      "USDT0",
      "USDB",
      "DAI",
      "TATARA-USDC",
    ]) {
      expect(isUsdStablecoinSymbol(symbol)).toBe(true);
    }
  });

  it("leaves non-USD assets alone", () => {
    for (const symbol of ["WETH", "ETH", "WBTC", "EURC", "ACX", "POOL"]) {
      expect(isUsdStablecoinSymbol(symbol)).toBe(false);
    }
  });
});

describe("normalizeTokenAddress", () => {
  it("lowercases EVM hex", () => {
    expect(
      normalizeTokenAddress(" 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913 "),
    ).toBe("0x833589fcd6edb6e08f4c7c32d4f71b54bda02913");
  });

  it("leaves case-sensitive non-EVM addresses untouched", () => {
    expect(normalizeTokenAddress("TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t")).toBe(
      "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t",
    );
  });
});
