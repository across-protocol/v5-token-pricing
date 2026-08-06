# v5-token-pricing

What was this token worth at this instant?

One function, three upstreams, no state. It answers with the datapoint an upstream
actually holds — and tells you when that datapoint is from.

## Install

```sh
pnpm add github:across-protocol/v5-token-pricing
# or, from a Bun app
bun add github:across-protocol/v5-token-pricing
```

The package builds itself on install (`prepare`) and ships compiled ESM plus
`.d.ts`. Verified to load under both Node >= 20 and Bun.

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
  bucketBy(result.observedAt).record(result.priceUsd);
}
```

## The contract

```ts
{
  priceUsd: number;          // USD per whole token
  observedAt: number;        // unix ms of the UPSTREAM datapoint
  source: "defillama" | "coingecko" | "alchemy";
  confidence?: number;       // passed through when the upstream supplies one
  attempts: PriceAttempt[];
}
// or, unpriced:
{ priceUsd: null; observedAt: null; source: null; attempts: PriceAttempt[] }
```

`attempts` is on both paths — that is why "unpriced" is `priceUsd === null`
rather than a bare `null` return: the reason a call went unpriced has to travel
out with it.

### observedAt is not the timestamp you asked for

**`observedAt` is the instant of the datapoint the upstream returned.** It is
never the requested `timestamp` and never the wall clock. Upstreams answer with
the observation they have, which is near your instant, not on it — and how near
depends on the token's liquidity.

Measured: for one requested instant, DefiLlama answered for USDC on Base and
WETH on Arbitrum with observations roughly **7 minutes apart from each other**.
Same request, two different observed instants.

So: file the price into whatever time bucket `observedAt` falls in, and decide
for yourself whether an observation that landed near-but-not-on your instant is
acceptable. This library will not pretend it hit your instant exactly.

### Never invented

`priceUsd: null` means no source could price this token at this instant. The
library does not interpolate between datapoints, extrapolate from the present,
or substitute a similar token.

### attempts

One entry per source that was tried, in the order tried. Sources after the one
that answered are not tried and so do not appear.

| outcome | meaning |
| --- | --- |
| `ok` | returned a plausible datapoint |
| `no_data` | answered, but had nothing for this token/instant |
| `implausible` | returned a value that failed the sanity rules below |
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

A source that throws, times out, or returns an implausible value is a **miss**,
not a failure: the next source still gets its turn.

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

`LLAMA_SLUG_BY_CHAIN`, `CG_PLATFORM_BY_CHAIN` and `ALCHEMY_NETWORK_BY_CHAIN` are
exported, keyed by numeric chain id. A chain missing from one map means that
source is skipped for the call — never an error.

## Development

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
