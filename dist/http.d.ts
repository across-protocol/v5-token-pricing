import type { SourceResult } from "./types.js";
/**
 * An upstream that answered with a non-2xx status, or kept failing through the
 * retry budget. Carries the HTTP status when the upstream answered one, so a
 * rate limit can be told apart from every other failure.
 */
export declare class HttpError extends Error {
    readonly status: number | undefined;
    constructor(message: string, status?: number);
}
/**
 * The source outcome a thrown fetch describes. A 429 is called out on its own
 * because a throttled upstream is not a broken one: the caller wants to back
 * off and re-ask, not conclude the token is unreachable.
 */
export declare function fetchErrorOutcome(error: unknown): SourceResult;
/**
 * One JSON request with a timeout and a bounded retry budget.
 * Throws on exhausted retries or a non-retryable status; callers turn that into
 * an `error` outcome.
 */
export declare function fetchJson({ url, method, headers, body, timeoutMs, retries, }: {
    url: string;
    method?: "GET" | "POST";
    headers?: Record<string, string>;
    body?: unknown;
    timeoutMs?: number;
    retries?: number;
}): Promise<unknown>;
//# sourceMappingURL=http.d.ts.map