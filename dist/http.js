/** The caller is on a write path, not a UI: short timeout, one retry. */
const DEFAULT_TIMEOUT_MS = 5_000;
const DEFAULT_RETRIES = 1;
const RETRY_DELAY_MS = 150;
/**
 * An upstream that answered with a non-2xx status, or kept failing through the
 * retry budget. Carries the HTTP status when the upstream answered one, so a
 * rate limit can be told apart from every other failure.
 */
export class HttpError extends Error {
    status;
    constructor(message, status) {
        super(message);
        this.name = "HttpError";
        this.status = status;
    }
}
/**
 * The source outcome a thrown fetch describes. A 429 is called out on its own
 * because a throttled upstream is not a broken one: the caller wants to back
 * off and re-ask, not conclude the token is unreachable.
 */
export function fetchErrorOutcome(error) {
    return error instanceof HttpError && error.status === 429
        ? { outcome: "throttled" }
        : { outcome: "error" };
}
/**
 * One JSON request with a timeout and a bounded retry budget.
 * Throws on exhausted retries or a non-retryable status; callers turn that into
 * an `error` outcome.
 */
export async function fetchJson({ url, method = "GET", headers, body, timeoutMs = DEFAULT_TIMEOUT_MS, retries = DEFAULT_RETRIES, }) {
    let lastError = new Error(`${method} ${url} failed`);
    for (let attempt = 0; attempt <= retries; attempt += 1) {
        const outcome = await requestOnce({ url, method, headers, body, timeoutMs });
        if ("json" in outcome)
            return outcome.json;
        if (!outcome.retryable)
            throw outcome.error;
        lastError = outcome.error;
        if (attempt < retries) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
        }
    }
    throw lastError;
}
async function requestOnce({ url, method, headers, body, timeoutMs, }) {
    const init = { method, signal: AbortSignal.timeout(timeoutMs) };
    if (body === undefined) {
        if (headers !== undefined)
            init.headers = headers;
    }
    else {
        init.headers = { "content-type": "application/json", ...headers };
        init.body = JSON.stringify(body);
    }
    try {
        const response = await fetch(url, init);
        if (response.ok)
            return { json: await response.json() };
        return {
            retryable: response.status === 429 || response.status >= 500,
            error: new HttpError(`${method} ${url} -> ${response.status}`, response.status),
        };
    }
    catch (cause) {
        // Network failure or timeout: worth one more try.
        return {
            retryable: true,
            error: cause instanceof Error ? cause : new Error(String(cause)),
        };
    }
}
//# sourceMappingURL=http.js.map