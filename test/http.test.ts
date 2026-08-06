import { afterEach, describe, expect, it } from "vitest";
import { fetchJson } from "../src/http.js";
import { jsonResponse, stubFetch } from "./helpers.js";

let restore: (() => void) | undefined;

afterEach(() => {
  restore?.();
  restore = undefined;
});

describe("fetchJson", () => {
  it("retries once on a retryable status, then succeeds", async () => {
    let seen = 0;
    const stub = stubFetch(() => {
      seen += 1;
      return seen === 1 ? jsonResponse({}, 429) : jsonResponse({ ok: true });
    });
    restore = stub.restore;

    await expect(fetchJson({ url: "https://example.test/x" })).resolves.toEqual(
      { ok: true },
    );
    expect(seen).toBe(2);
  });

  it("does not retry a non-retryable status", async () => {
    const stub = stubFetch(() => jsonResponse({}, 404));
    restore = stub.restore;

    await expect(fetchJson({ url: "https://example.test/x" })).rejects.toThrow(
      "404",
    );
    expect(stub.calls).toHaveLength(1);
  });

  it("gives up after the retry budget", async () => {
    const stub = stubFetch(() => {
      throw new Error("ECONNRESET");
    });
    restore = stub.restore;

    await expect(fetchJson({ url: "https://example.test/x" })).rejects.toThrow(
      "ECONNRESET",
    );
    expect(stub.calls).toHaveLength(2);
  });

  it("passes an abort signal so a hung upstream cannot stall the caller", async () => {
    const stub = stubFetch(() => jsonResponse({ ok: true }));
    restore = stub.restore;

    await fetchJson({ url: "https://example.test/x" });

    expect(stub.calls[0]?.init?.signal).toBeInstanceOf(AbortSignal);
  });
});
