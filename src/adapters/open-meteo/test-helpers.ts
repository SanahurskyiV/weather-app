import { vi, type MockInstance } from "vitest";

// Test-only helpers for the Open-Meteo adapter tests.

/** The URL of the first request the spy saw. */
export function requestedUrl(spy: MockInstance<typeof fetch>): URL {
  const input = spy.mock.calls[0]?.[0];
  if (input === undefined) throw new Error("fetch was not called");
  return new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
}

/** A fetch that never answers until its abort signal fires, like a source that hangs. */
export function hangingFetch(): MockInstance<typeof fetch> {
  return vi.spyOn(globalThis, "fetch").mockImplementation(
    (_input, init) =>
      new Promise((_resolve, reject) => {
        const signal = init?.signal;
        if (!signal) return; // no timeout: hangs forever, and the test times out
        signal.addEventListener("abort", () => {
          reject(signal.reason instanceof Error ? signal.reason : new Error("aborted"));
        });
      }),
  );
}
