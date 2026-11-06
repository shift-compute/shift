import { describe, expect, it } from "vitest";
import { COST_DRIFT_PERCENT, costDrifted } from "./replan";

describe("costDrifted", () => {
  const estimate = 1_000n;

  it("names the 1.2× line as 120 percent", () => {
    expect(COST_DRIFT_PERCENT).toBe(120n);
  });

  it("does not replan at or under 1.2× the estimate", () => {
    expect(costDrifted(estimate, 0n)).toBe(false);
    expect(costDrifted(estimate, estimate)).toBe(false);
    expect(costDrifted(estimate, estimate + 1n)).toBe(false);
    const boundary = (estimate * COST_DRIFT_PERCENT) / 100n;
    expect(boundary).toBe(1_200n);
    expect(costDrifted(estimate, boundary)).toBe(false);
  });

  it("replans when the reported cost is strictly above 1.2×", () => {
    const boundary = (estimate * COST_DRIFT_PERCENT) / 100n;
    expect(costDrifted(estimate, boundary + 1n)).toBe(true);
    expect(costDrifted(estimate, estimate * 2n)).toBe(true);
  });

  it("replans a zero estimate on any positive report, and not on zero", () => {
    expect(costDrifted(0n, 0n)).toBe(false);
    expect(costDrifted(0n, 1n)).toBe(true);
  });

  it("does not replan when the Router reported no cost", () => {
    expect(costDrifted(estimate, undefined)).toBe(false);
    expect(costDrifted(0n, undefined)).toBe(false);
  });

  it("keeps the comparison exact for large micro-USD amounts", () => {
    const big = 10n ** 18n;
    const boundary = (big * COST_DRIFT_PERCENT) / 100n;
    expect(costDrifted(big, boundary)).toBe(false);
    expect(costDrifted(big, boundary + 1n)).toBe(true);
  });
});
