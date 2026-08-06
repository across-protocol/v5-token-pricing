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