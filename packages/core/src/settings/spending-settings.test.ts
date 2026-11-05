import { describe, expect, it } from "vitest";
import { spendingSettingsSchema, toUserUpdate, usdToMicro } from "./spending-settings";

describe("usdToMicro", () => {
  it("converts exactly and absorbs float noise", () => {
    expect(usdToMicro(0.01)).toBe(10_000n);
    expect(usdToMicro(2.5)).toBe(2_500_000n);
    expect(usdToMicro(1.234567)).toBe(1_234_567n);
    expect(usdToMicro(0.1 + 0.2)).toBe(300_000n);
  });
});

describe("spendingSettingsSchema", () => {
  it("accepts iAI mode without a budget", () => {
    expect(spendingSettingsSchema.safeParse({ mode: "IAI_CREDITS_ONLY" }).success).toBe(true);
  });

  it("requires a budget in budget mode", () => {
    const r = spendingSettingsSchema.safeParse({ mode: "BUDGET" });
    expect(r.success).toBe(false);
    expect(JSON.stringify(r.error?.issues)).toContain("nightlyBudgetUsd");
  });

  it("bounds the budget and rejects non-numbers", () => {
    expect(spendingSettingsSchema.safeParse({ mode: "BUDGET", nightlyBudgetUsd: 0.001 }).success).toBe(false);
    expect(spendingSettingsSchema.safeParse({ mode: "BUDGET", nightlyBudgetUsd: 101 }).success).toBe(false);
    expect(spendingSettingsSchema.safeParse({ mode: "BUDGET", nightlyBudgetUsd: "5" }).success).toBe(false);
    expect(spendingSettingsSchema.safeParse({ mode: "BUDGET", nightlyBudgetUsd: Number.NaN }).success).toBe(false);
  });

  it("rejects unknown modes", () => {
    expect(spendingSettingsSchema.safeParse({ mode: "FREE_LUNCH" }).success).toBe(false);
  });
});

describe("toUserUpdate", () => {
  it("stores the budget in micro-USD for budget mode", () => {
    expect(toUserUpdate({ mode: "BUDGET", nightlyBudgetUsd: 2.5, donateLeftover: false })).toEqual({ mode: "BUDGET", nightlyBudgetUsdMicro: 2_500_000n, donateLeftover: false });
  });

  it("clears the budget when switching to iAI mode and leaves donate untouched if not given", () => {
    const u = toUserUpdate({ mode: "IAI_CREDITS_ONLY", nightlyBudgetUsd: 5 });
    expect(u).toEqual({ mode: "IAI_CREDITS_ONLY", nightlyBudgetUsdMicro: null });
    expect("donateLeftover" in u).toBe(false);
  });
});
