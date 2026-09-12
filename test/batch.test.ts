import { afterEach, describe, expect, it } from "vitest";
import { getTokenPriceAt, getTokenPricesAt } from "../src/index.js";
import { jsonResponse, stubFetch } from "./helpers.js";

const ARBITRUM_WETH = "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1";
const REQUESTED_AT = Date.UTC(2026, 6, 1, 12, 0, 0);
const OBSERVED_AT = REQUESTED_AT - 2 * 60 * 1000;

/** Distinct well-formed addresses, so a batch of N is N distinct coin keys.
 *  Off the zero address, which is the native-asset sentinel and would route to
 *  the asset-keyed source rather than the contract-keyed ones. */
function address(i: number): string {
  return `0x${(i + 1).toString(16).padStart(40, "0")}`;
}

/** The DefiLlama historical path of a request URL, split into (seconds, keys). */
function llamaPath(url: string): { unixSeconds: number; keys: string[] } {
  const path = url.split("/prices/historical/")[1];
  const [seconds, keys] = path?.split("/") ?? [];
  return {
    unixSeconds: Number(seconds),
    keys: (keys ?? "").split(",").filter((key) => key !== ""),
  };
}

/** A DefiLlama reply carrying one entry per requested key, unless omitted. */
function llamaBatchBody({
  unixSeconds,
  keys,
  without = [],
}: {
  unixSeconds: number;
  keys: string[];
  without?: string[];
}): unknown {
  const coins: Record<string, unknown> = {};
  for (const key of keys) {
    if (without.includes(key)) continue;
    coins[key] = { price: 1.5, timestamp: unixSeconds, symbol: "TOK", decimals: 6 };
  }
  return { coins };
}

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe("getTokenPricesAt batching", () => {
  it("costs one request per 100 coin keys, not one per token", async () => {
    const tokens = Array.from({ length: 150 }, (_, i) => ({
      chainId: 42161,
      tokenAddress: address(i),
      timestamp: REQUESTED_AT,
    }));
    const stub = stubFetch(({ url }) =>
      jsonResponse(llamaBatchBody(llamaPath(url))),
    );
    restore = stub.restore;

    const results = await getTokenPricesAt({ tokens });

    const llamaCalls = stub.calls.filter((call) => call.url.includes("coins.llama.fi"));
    expect(llamaCalls).toHaveLength(2);
    const [first, second] = llamaCalls.map((call) => llamaPath(call.url));
    expect(first?.keys).toHaveLength(100);
    expect(second?.keys).toHaveLength(50);
    expect(first?.unixSeconds).toBe(Math.floor(REQUESTED_AT / 1000));
    expect(second?.unixSeconds).toBe(Math.floor(REQUESTED_AT / 1000));

    expect(results).toHaveLength(150);
    for (const result of results) {
      expect(result.source).toBe("defillama");
      expect(result.priceUsd).toBe(1.5);
      expect(result.attempts).toEqual([{ source: "defillama", outcome: "ok" }]);
    }
  });

  it("groups by timestamp: one request cannot span instants", async () => {
    const tokens = [
      { chainId: 42161, tokenAddress: address(0), timestamp: REQUESTED_AT },
      { chainId: 42161, tokenAddress: address(1), timestamp: REQUESTED_AT },
      { chainId: 42161, tokenAddress: address(2), timestamp: REQUESTED_AT + 60_000 },
      { chainId: 42161, tokenAddress: address(3), timestamp: REQUESTED_AT + 60_000 },
    ];
    const stub = stubFetch(({ url }) => jsonResponse(llamaBatchBody(llamaPath(url))));
    restore = stub.restore;

    await getTokenPricesAt({ tokens });

    const llamaCalls = stub.calls.filter((call) => call.url.includes("coins.llama.fi"));
    expect(llamaCalls).toHaveLength(2);
    const seconds = llamaCalls.map((call) => llamaPath(call.url).unixSeconds);
    expect(seconds).toContain(Math.floor(REQUESTED_AT / 1000));
    expect(seconds).toContain(Math.floor((REQUESTED_AT + 60_000) / 1000));
  });

  it("de-duplicates a token asked for twice: one key on the wire, two answers back", async () => {
    const duplicate = { chainId: 42161, tokenAddress: address(7), timestamp: REQUESTED_AT };
    const tokens = [
      duplicate,
      { chainId: 42161, tokenAddress: address(8), timestamp: REQUESTED_AT },
      duplicate,
    ];
    const stub = stubFetch(({ url }) => jsonResponse(llamaBatchBody(llamaPath(url))));
    restore = stub.restore;

    const results = await getTokenPricesAt({ tokens });

    const llamaCalls = stub.calls.filter((call) => call.url.includes("coins.llama.fi"));
    expect(llamaCalls).toHaveLength(1);
    expect(llamaPath(llamaCalls[0]!.url).keys).toHaveLength(2);
    expect(results[0]).toEqual(results[2]);
    expect(results[0]?.priceUsd).toBe(1.5);
  });

  it("reports a token on an unmapped chain without making a request for it", async () => {
    const tokens = [
      { chainId: 42161, tokenAddress: address(0), timestamp: REQUESTED_AT },
      { chainId: 987654, tokenAddress: address(1), timestamp: REQUESTED_AT },
    ];
    const stub = stubFetch(({ url }) => jsonResponse(llamaBatchBody(llamaPath(url))));
    restore = stub.restore;

    const results = await getTokenPricesAt({ tokens });

    expect(stub.calls.filter((call) => call.url.includes("coins.llama.fi"))).toHaveLength(1);
    expect(results[0]?.source).toBe("defillama");
    expect(results[1]?.attempts[0]).toEqual({
      source: "defillama",
      outcome: "skipped_unmapped_chain",
    });
  });

  it("keeps results aligned when DefiLlama answers for only some tokens", async () => {
    const tokens = [
      { chainId: 42161, tokenAddress: ARBITRUM_WETH, timestamp: REQUESTED_AT },
      { chainId: 42161, tokenAddress: address(0), timestamp: REQUESTED_AT },
    ];
    const stub = stubFetch(({ url }) => {
      if (url.includes("coins.llama.fi")) {
        return jsonResponse(
          llamaBatchBody({
            ...llamaPath(url),
            // DefiLlama omits coins it has no datapoint for.
            without: [`arbitrum:${address(0)}`],
          }),
        );
      }
      return jsonResponse({ prices: [[OBSERVED_AT, 42]] });
    });
    restore = stub.restore;

    const results = await getTokenPricesAt({ tokens });

    expect(results[0]?.source).toBe("defillama");
    expect(results[0]?.priceUsd).toBe(1.5);
    expect(results[1]?.source).toBe("coingecko");
    expect(results[1]?.priceUsd).toBe(42);
    expect(results[1]?.attempts).toEqual([
      { source: "defillama", outcome: "no_data" },
      { source: "coingecko", outcome: "ok" },
    ]);
  });
});

describe("rate limits are surfaced, not swallowed", () => {
  it("marks the tokens of a throttled request `throttled` and still prices the rest", async () => {
    // 150 tokens, one instant, two chunks. The first chunk (tokens 0-99) is
    // rate-limited through the retry budget; the second (100-149) is fine.
    const tokens = Array.from({ length: 150 }, (_, i) => ({
      chainId: 42161,
      tokenAddress: address(i),
      timestamp: REQUESTED_AT,
    }));
    const firstChunkMarker = `arbitrum:${address(0)}`;
    const stub = stubFetch(({ url }) => {
      if (url.includes("coins.llama.fi")) {
        if (url.includes(firstChunkMarker)) return jsonResponse({}, 429);
        return jsonResponse(llamaBatchBody(llamaPath(url)));
      }
      return jsonResponse({ prices: [] });
    });
    restore = stub.restore;

    const results = await getTokenPricesAt({ tokens });

    // A token inside the throttled request: the rate limit is on its own record,
    // distinguishable from "no price anywhere", and the later sources ran.
    expect(results[0]?.attempts).toEqual([
      { source: "defillama", outcome: "throttled" },
      { source: "coingecko", outcome: "no_data" },
      { source: "alchemy", outcome: "skipped_no_key" },
      { source: "coingecko-by-id", outcome: "skipped_unmapped_chain" },
    ]);
    expect(results[99]?.attempts).toEqual(results[0]?.attempts);

    // A token in the chunk that was answered is priced, untouched by its
    // neighbour's rate limit.
    expect(results[100]?.attempts).toEqual([{ source: "defillama", outcome: "ok" }]);
    expect(results[100]?.priceUsd).toBe(1.5);

    // The throttled request consumed its retry budget.
    const throttledCalls = stub.calls.filter((call) => call.url.includes(firstChunkMarker));
    expect(throttledCalls).toHaveLength(2);
  });

  it("reports `throttled` where a single call used to report a bare `error`", async () => {
    const stub = stubFetch(({ url }) => {
      if (url.includes("coins.llama.fi")) return jsonResponse({}, 429);
      return jsonResponse({ prices: [[OBSERVED_AT, 3120.5]] });
    });
    restore = stub.restore;

    const result = await getTokenPriceAt({
      chainId: 42161,
      tokenAddress: ARBITRUM_WETH,
      timestamp: REQUESTED_AT,
    });

    expect(result.attempts[0]).toEqual({ source: "defillama", outcome: "throttled" });
    expect(result.source).toBe("coingecko");
  });

  it("returns no results for no tokens", async () => {
    expect(await getTokenPricesAt({ tokens: [] })).toEqual([]);
  });
});
