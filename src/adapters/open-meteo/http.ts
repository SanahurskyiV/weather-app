import { err, ok, type Result } from "../../domain/result";

/** Every outbound call gives up after this long (SAD §8 Outbound HTTP, AC-04b, AC-10). */
export const TIMEOUT_MS = 1500;

/** GET a JSON body. A timeout, network error, non-OK status or unreadable body is `unavailable`, never a throw. */
export async function fetchJson(url: URL): Promise<Result<unknown, "unavailable">> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(TIMEOUT_MS) });
    if (!response.ok) return err("unavailable");
    return ok(await response.json());
  } catch {
    return err("unavailable");
  }
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}
