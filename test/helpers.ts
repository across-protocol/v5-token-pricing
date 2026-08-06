/** Test-side only: production code never takes an injected fetch. */
export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export type FetchCall = { url: string; init: RequestInit | undefined };

/**
 * Replace global fetch with `handler`, recording every call.
 * The returned `restore` puts the real fetch back.
 */
export function stubFetch(
  handler: (call: FetchCall) => Response | Promise<Response>,
): { calls: FetchCall[]; restore: () => void } {
  const original = globalThis.fetch;
  const calls: FetchCall[] = [];
  globalThis.fetch = (async (input: unknown, init?: RequestInit) => {
    const call = { url: String(input), init };
    calls.push(call);
    return handler(call);
  }) as typeof globalThis.fetch;
  return {
    calls,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

/** DefiLlama's historical body for a single coin. */
export function llamaBody({
  coinKey,
  price,
  observedAtSeconds,
  symbol,
  confidence,
}: {
  coinKey: string;
  price: number;
  observedAtSeconds: number;
  symbol?: string;
  confidence?: number;
}): unknown {
  return {
    coins: {
      [coinKey]: {
        price,
        timestamp: observedAtSeconds,
        ...(symbol === undefined ? {} : { symbol }),
        ...(confidence === undefined ? {} : { confidence }),
        decimals: 6,
      },
    },
  };
}
