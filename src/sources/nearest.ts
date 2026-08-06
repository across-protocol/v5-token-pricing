/**
 * Pick the datapoint closest to the requested instant. Its own timestamp is
 * what gets reported as `observedAt` — never the requested one.
 */
export function pickNearest({
  points,
  timestamp,
}: {
  points: { priceUsd: number; observedAt: number }[];
  timestamp: number;
}): { priceUsd: number; observedAt: number } | undefined {
  let nearest: { priceUsd: number; observedAt: number } | undefined;
  for (const point of points) {
    if (
      nearest === undefined ||
      Math.abs(point.observedAt - timestamp) <
        Math.abs(nearest.observedAt - timestamp)
    ) {
      nearest = point;
    }
  }
  return nearest;
}
