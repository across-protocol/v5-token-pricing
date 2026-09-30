# v5-token-pricing

What was this token worth at this instant?

One function, three upstreams, no state. It answers with the datapoint an upstream
actually holds — and tells you when that datapoint is from.

## Install

```sh
pnpm add github:across-protocol/v5-token-pricing
```

The package builds itself on install (`prepare`) and ships compiled ESM plus
`.d.ts`.

This repo is developed and built with **Node and pnpm only** — there is no Bun
in its toolchain. Bun appears here for exactly one reason: the first consumer is
a Bun service, so `dist/` is checked to load under **both Node >= 20 and Bun**
before release. That check is not ceremony — a sibling package is unusable from
Bun because a transitive dependency crashes its loader, which is why this package
keeps its dependency surface to one.

## Use

```ts
import { getTokenPriceAt } from "@across-protocol/v5-token-pricing";

const result = await getTokenPriceAt({
  chainId: 8453,
  tokenAddress: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // USDC on Base
  timestamp: Date.now() - 86_400_000,
  apiKeys: { coingecko: cgKey, alchemy: alchemyKey }, // both optional
});

if (result.priceUsd === null) {
  // nothing could price it — result.attempts says why
} else {
  store(result.priceUsd, { observedAt: result.observedAt, source: result.source });
}
```

## Types

Everything below is exported from the package root.

### Input

```ts
getTokenPriceAt(input: {
  chainId: number;        // numeric chain id, e.g. 8453
  tokenAddress: string;   // contract address; 0x-hex on EVM, base58 on Tron
  timestamp: number;      // the instant you want a price for, UNIX MILLISECONDS
  apiKeys?: ApiKeys;      // omitted entirely => DefiLlama only
  maxStalenessMs?: number; // default DEFAULT_MAX_STALENESS_MS (5 min); see below
}): Promise<TokenPriceResult>

type ApiKeys = {
  coingecko?: string;     // absent => CoinGecko's free host is used
  alchemy?: string;       // absent => Alchemy is skipped (skipped_no_key)
};
```

### Return

`TokenPriceResult` is a discriminated union. Narrow on `priceUsd`:

```ts
type TokenPriceResult =
  | {
      priceUsd: number;        // USD per WHOLE token (not per base unit)
      observedAt: number;      // UNIX MILLISECONDS of the upstream's datapoint
      source: PriceSource;     // which upstream answered
      confidence?: number;     // 0..1, only when the upstream supplies one
      attempts: PriceAttempt[];
    }
  | {
      priceUsd: null;          // nothing could price it
      observedAt: null;
      source: null;
      attempts: PriceAttempt[];
    };

type PriceSource = "defillama" | "coingecko" | "alchemy";

type PriceAttempt = { source: PriceSource; outcome: AttemptOutcome };

type AttemptOutcome =
  | "ok"
  | "no_data"
  | "implausible"
  | "stale"
  | "error"
  | "skipped_no_key"
  | "skipped_unmapped_chain";
```

`attempts` is present on **both** members — which is why unpriced is
`priceUsd === null` rather than a bare `null` return. A `null` on its own cannot
say whether the token is unknown everywhere, the chain was unmapped, a key was
missing, or every upstream was down, and those want different responses.

The function does not reject on upstream failure: a source that throws becomes an
`error` attempt, not an exception. It can still throw on programmer error
(a malformed argument).

### Also exported

`LLAMA_SLUG_BY_CHAIN`, `CG_PLATFORM_BY_CHAIN`, `ALCHEMY_NETWORK_BY_CHAIN` —
`Record<number, string>`, keyed by numeric chain id.

`DEFAULT_MAX_STALENESS_MS` — the default for `maxStalenessMs`, 5 minutes.

### observedAt is not the timestamp you asked for

**`observedAt` is the instant of the datapoint the upstream returned.** It is
never the requested `timestamp` and never the wall clock. Upstreams answer with
the observation they have, which is near your instant, not on it — and how near
depends on the token's liquidity.

Measured: for one requested instant, DefiLlama answered for USDC on Base and
WETH on Arbitrum with observations roughly **7 minutes apart from each other**.
Same request, two different observed instants.

This library will not pretend it hit your instant exactly. It does prefer a
close answer to a far one: a datapoint more than `maxStalenessMs` from your
instant is `stale`, and the next source is asked for a closer one (see
[Stale answers](#stale-answers)). Even so, `observedAt` can sit up to
`maxStalenessMs` away, or further when no source had anything closer. What you
file it under is your call, and both policies are legitimate:

- **File under the instant you asked for** and treat the answer as good enough.
  Reasonable, because the upstream was *asked about* that instant — unlike a spot
  price, which knows nothing about the past. Keep `observedAt` anyway so the
  distance stays auditable later.
- **File under `observedAt`'s own bucket** and decide per lookup whether an
  observation that landed nearby is close enough.

What you must not do is discard `observedAt`. It is the only evidence of how far
the answer sat from the question.

### Never invented

`priceUsd: null` means no source could price this token at this instant. The
library does not interpolate between datapoints, extrapolate from the present,
or substitute a similar token.

### attempts

One entry per source that was tried, in the order tried. Sources after the one
that answered within `maxStalenessMs` are not tried and so do not appear.

| outcome | meaning |
| --- | --- |
| `ok` | returned a plausible datapoint |
| `no_data` | answered, but had nothing for this token/instant |
| `implausible` | returned a value that failed the sanity rules below |
| `stale` | returned a plausible datapoint more than `maxStalenessMs` from the requested instant |
| `error` | threw, timed out, or returned a bad status / body |
| `skipped_no_key` | needs a credential that this call did not supply |
| `skipped_unmapped_chain` | has no identifier for this chain id |

This is the package's only concession to observability. It emits nothing — no
logs, no spans, no metrics, not even on error paths. You decide what to record.

## Resolution order

1. **DefiLlama** — free, no key, address-native. Always tried when the chain maps.
2. **CoinGecko** — `market_chart/range`, nearest datapoint wins. Uses the pro
   host and the `x-cg-pro-api-key` header when `apiKeys.coingecko` is present,
   the free host otherwise.
3. **Alchemy** — historical prices, nearest datapoint wins. Skipped entirely
   without `apiKeys.alchemy`.
4. **CoinGecko by coin id** — for what has no contract to look up (HyperCore
   account sentinels, native gas assets). Asked only when none of the three
   above produced a plausible answer, stale or not.

A source that throws, times out, or returns an implausible value is a **miss**,
not a failure: the next source still gets its turn.

### Stale answers

A plausible datapoint more than `maxStalenessMs` (default 5 minutes) from the
requested instant, in either direction, is **stale**. It is kept, and the next
source is asked:

- the first source to answer within the threshold wins;
- if none does, the **least stale** answer wins (the earlier source on a tie),
  with its own `observedAt`;
- a stale answer from an address-native source still beats asking CoinGecko by
  coin id, which prices the asset rather than the token.

Why: DefiLlama serves some tokens only about every 30 minutes. Measured on
2026-09-30, its Ink WETH and Arbitrum WETH answers sat 7 to 12 minutes from the
requested 5-minute marks, while CoinGecko and Alchemy serve 5-minute data.
Taking DefiLlama's first answer froze one price across consecutive 5-minute
buckets.

Pass `maxStalenessMs: Infinity` to take the first plausible answer whatever its
distance, as this package did before.

### Implausible means

- non-finite, `<= 0`, or `> $10,000,000` per whole token; or
- the token's symbol marks it a USD stablecoin and the price is outside
  `[0.50, 2.00]`.

The stablecoin band exists because it caught real bad upstream data.

## Deliberate non-features

- **No cache.** Not an LRU, not a memo, not a module-level Map. Callers already
  have their own tiers in front of this, and per-call key injection makes
  cross-call reuse wrong.
- **No credentials held anywhere.** The library never reads `process.env`, has no
  config singleton, and keeps no key between calls. Keys arrive on the call and
  are used only for that call's requests.
- **No telemetry, no logging, no callbacks.** See `attempts`.

## Chains

Each source has its own chain identifier map. A chain missing from one map means
that source is skipped for the call (`skipped_unmapped_chain`) — never an error,
and the other sources still get their turn.

## Development

Node >= 20 and pnpm. No Bun, no other runtime.

```sh
pnpm install
pnpm typecheck
pnpm test
pnpm build
```

The live DefiLlama test is skipped unless `LIVE_PRICE_TESTS=1` is set. It needs
no credential. No test in this repo requires a key to run.

Runtime dependencies: `@across-protocol/constants` (token symbols) and global
`fetch`. That is all.
