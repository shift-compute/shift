import { describe, expect, it } from "vitest";
import { DEFAULT_DONATE_LEFTOVER, buildSettingsPayload } from "./settings";

describe("buildSettingsPayload", () => {
  it("leaves donation off unless the person opts in", () => {
    expect(DEFAULT_DONATE_LEFTOVER).toBe(false);
  });

  it("sends iAI mode without a budget, ignoring whatever is typed", () => {
    expect(buildSettingsPayload({ mode: "IAI_CREDITS_ONLY", budgetText: "99", donateLeftover: true })).toEqual({ ok: true, payload: { mode: "IAI_CREDITS_ONLY", donateLeftover: true } });
  });

  it("parses a budget, accepting a decimal comma and surrounding spaces", () => {
    expect(buildSettingsPayload({ mode: "BUDGET", budgetText: " 2,5 ", donateLeftover: false })).toEqual({ ok: true, payload: { mode: "BUDGET", nightlyBudgetUsd: 2.5, donateLeftover: false } });
  });

  it("asks for a number when the budget is empty or not numeric", () => {
    for (const budgetText of ["", "  ", "abc", "1e999"]) {
      const r = buildSettingsPayload({ mode: "BUDGET", budgetText, donateLeftover: true });
      expect(r.ok).toBe(false);
    }
  });

  it("rejects budgets outside the allowed range with the limits in the message", () => {
    const low = buildSettingsPayload({ mode: "BUDGET", budgetText: "0.001", donateLeftover: true });
    const high = buildSettingsPayload({ mode: "BUDGET", budgetText: "500", donateLeftover: true });
    expect(low.ok === false && low.message).toContain("$0.01");
    expect(high.ok === false && high.message).toContain("$100");
  });
});
