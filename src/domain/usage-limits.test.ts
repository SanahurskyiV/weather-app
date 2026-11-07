import { describe, expect, it } from "vitest";
import { checkLimits, DAILY_LOOKUP_BUDGET, USER_LOOKUPS_PER_HOUR, utcDayKey, windowStart } from "./usage-limits";

describe("usage limits", () => {
  it("fixes the two budgets from the spec (AC-16, AC-17)", () => {
    expect(DAILY_LOOKUP_BUDGET).toBe(5000);
    expect(USER_LOOKUPS_PER_HOUR).toBe(30);
  });

  it.each([
    [0, 0, "ok"],
    [4999, 0, "ok"],
    [4999, 29, "ok"],
    [5000, 0, "daily_limit"],
    [5001, 0, "daily_limit"],
    [0, 29, "ok"],
    [0, 30, "user_limit"],
    [0, 31, "user_limit"],
    [5000, 30, "daily_limit"],
  ] as const)("daily %i, chat %i → %s", (daily, chat, expected) => {
    expect(checkLimits(daily, chat)).toBe(expected);
  });
});

describe("utcDayKey", () => {
  it("switches at UTC midnight", () => {
    expect(utcDayKey(new Date("2026-11-06T23:59:59.999Z"))).toBe("2026-11-06");
    expect(utcDayKey(new Date("2026-11-07T00:00:00.000Z"))).toBe("2026-11-07");
  });

  it("ignores any local timezone offset", () => {
    expect(utcDayKey(new Date("2026-11-07T01:30:00+02:00"))).toBe("2026-11-06");
  });
});

describe("windowStart", () => {
  it("is exactly 60 minutes before now, as UTC ISO-8601", () => {
    expect(windowStart(new Date("2026-11-06T10:00:00.000Z"))).toBe("2026-11-06T09:00:00.000Z");
  });

  it("puts a row exactly 60 minutes old outside the window (strict >)", () => {
    const now = new Date("2026-11-06T10:00:00.000Z");
    const exactlyAnHourOld = "2026-11-06T09:00:00.000Z";
    const justInside = "2026-11-06T09:00:00.001Z";
    expect(exactlyAnHourOld > windowStart(now)).toBe(false);
    expect(justInside > windowStart(now)).toBe(true);
  });
});
