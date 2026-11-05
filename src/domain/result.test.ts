import { describe, expect, it } from "vitest";
import { err, ok, type Result } from "./result";

const parsePositive = (n: number): Result<number, "not_positive"> => (n > 0 ? ok(n) : err("not_positive"));

describe("Result", () => {
  it("carries the value on success", () => {
    expect(parsePositive(3)).toEqual({ ok: true, value: 3 });
  });

  it("carries the error on failure", () => {
    expect(parsePositive(-1)).toEqual({ ok: false, error: "not_positive" });
  });
});
