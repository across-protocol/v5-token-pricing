/**
 * Pick the datapoint closest to the requested instant. Its own timestamp is
 * what gets reported as `observedAt` — never the requested one.
 */
export declare function pickNearest({ points, timestamp, }: {
    points: {
        priceUsd: number;
        observedAt: number;
    }[];
    timestamp: number;
}): {
    priceUsd: number;
    observedAt: number;
} | undefined;
//# sourceMappingURL=nearest.d.ts.map