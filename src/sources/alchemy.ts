import { ALCHEMY_NETWORK_BY_CHAIN } from "../chain-slugs.js";
import { fetchErrorOutcome, fetchJson } from "../http.js";
import { asRecord } from "../json.js";
import { normalizeTokenAddress } from "../tokens.js";
import type { ApiKeys, SourceResult } from "../types.js";
import { pickNearest } from "./nearest.js";

/**
 * POST https://api.g.alchemy.com/prices/v1/{apiKey}/tokens/historical
 * body:  { network, address, startTime, endTime, interval }
 * reply: { currency, network, address, data: [{ value: string, timestamp: ISO }] }
 *
 * The key sits in the path by Alchemy's design; that is the upstream contract,
 * not a choice this package makes.
 */
const INTERVAL = "5m";
const WINDOW_MS = 60 * 60 * 1000;

export async function fetchAlchemyPrice({
  chainId,
  tokenAddress,
  timestamp,
  apiKeys,
}: {
  chainId: number;
  tokenAddress: string;
  timestamp: number;
  apiKeys: ApiKeys;
}): Promise<SourceResult> {
  const key = apiKeys.alchemy;
  if (key === undefined) return { outcome: "skipped_no_key" };

  const network = ALCHEMY_NETWORK_BY_CHAIN[chainId];
  if (network === undefined) return { outcome: "skipped_unmapped_chain" };

  let body: unknown;
  try {
    body = await fetchJson({
      url: `https://api.g.alchemy.com/prices/v1/${key}/tokens/historical`,
      method: "POST",
      body: {
        network,
        address: normalizeTokenAddress(tokenAddress),
        startTime: Math.floor((timestamp - WINDOW_MS) / 1000),
        endTime: Math.ceil((timestamp + WINDOW_MS) / 1000),
        interval: INTERVAL,
      },
    });
  } catch (error) {
    return fetchErrorOutcome(error);
  }

  const data = asRecord(body)?.["data"];
  if (!Array.isArray(data)) return { outcome: "no_data" };

  const points: { priceUsd: number; observedAt: number }[] = [];
  for (const entry of data) {
    const point = asRecord(entry);
    if (point === undefined) continue;
    const priceUsd = Number(point["value"]);
    const observedAt = Date.parse(String(point["timestamp"]));
    if (Number.isFinite(priceUsd) && Number.isFinite(observedAt)) {
      points.push({ priceUsd, observedAt });
    }
  }

  const nearest = pickNearest({ points, timestamp });
  if (nearest === undefined) return { outcome: "no_data" };
  return { outcome: "ok", observation: nearest };
}
