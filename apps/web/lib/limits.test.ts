import { describe, expect, it } from "vitest";
import { CONNECT_LIMIT, connectLimiter, runNowLimiter } from "./limits";

describe("rate limiters", () => {
  it("keeps the connect window on globalThis so a second lookup sees the same hits", () => {
    const key = "203.0.113.50";
    const first = connectLimiter();
    for (let i = 0; i < CONNECT_LIMIT; i++) expect(first.check(key).allowed).toBe(true);
    expect(first.check(key).allowed).toBe(false);
    const again = connectLimiter();
    expect(again).toBe(first);
    expect(again.check(key).allowed).toBe(false);
    const stored = (globalThis as typeof globalThis & { __shiftLimiters?: { connect?: unknown } }).__shiftLimiters?.connect;
    expect(stored).toBe(first);
  });

  it("keeps the run-now window on the same global object", () => {
    const key = "user-limits";
    const first = runNowLimiter();
    expect(first.check(key).allowed).toBe(true);
    expect(runNowLimiter().check(key).allowed).toBe(false);
    expect(runNowLimiter()).toBe(first);
  });
});
