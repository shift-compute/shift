import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { decideBudget, formatUnits, impliedMicroUsdPerOg, MIN_OG_WEI, MIN_USD_MICRO } from "./budget";

const pair = (wei: string, usd: string) => ({ pricing: { prompt: wei }, pricing_usd: { prompt: usd } });

describe("impliedMicroUsdPerOg", () => {
  it("converts a wei price and a USD price into micro-USD per 0G", () => {
    // 1 0G of native price priced at $1 → 1_000_000 micro-USD per 0G.
    expect(impliedMicroUsdPerOg([pair("1000000000000000000", "1")])).toBe(1_000_000n);
  });

  it("uses the lower middle of an even set so the rate is never rounded up", () => {
    const models = [pair("1000000000000000000", "1"), pair("1000000000000000000", "3")];
    expect(impliedMicroUsdPerOg(models)).toBe(1_000_000n);
  });

  it("is undefined when the catalog publishes no comparable pair", () => {
    expect(impliedMicroUsdPerOg([{ pricing_usd: { prompt: "0.01" } }])).toBeUndefined();
    expect(impliedMicroUsdPerOg([])).toBeUndefined();
  });

  it("reads a usable rate from the Phase 0 catalog snapshot", () => {
    const models = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../docs/spike/models.json"), "utf8")) as Parameters<typeof impliedMicroUsdPerOg>[0];
    const rate = impliedMicroUsdPerOg(models);
    // The snapshot's 0GM prompt pair is 145985 micro-USD per 0G. A unit mistake would miss this range entirely.
    expect(rate).toBeGreaterThan(1_000n);
    expect(rate).toBeLessThan(10_000_000n);
  });
});

describe("formatUnits", () => {
  it("renders decimal 0G and USD without floating point", () => {
    expect(formatUnits(MIN_OG_WEI, 18)).toBe("0.0001");
    expect(formatUnits(1_500_000n, 6)).toBe("1.5");
    expect(formatUnits(MIN_USD_MICRO, 6)).toBe("0.01");
    expect(formatUnits(2n * 10n ** 18n, 18)).toBe("2");
  });
});

describe("decideBudget", () => {
  const base = { mode: "IAI_CREDITS_ONLY" as const, nightlyBudgetUsdMicro: null, marginPct: 10, depositBalance: "0" };

  it("spends only the credit balance and keeps the safety margin", () => {
    const decision = decideBudget({ ...base, currency: "usd", creditBalance: "100000000", depositBalance: "900000000000" });
    expect(decision).toMatchObject({ ok: true, budgetMicro: 90_000_000n, creditLimit: "90" });
  });

  it("floors the margin", () => {
    const decision = decideBudget({ ...base, currency: "usd", creditBalance: "199", marginPct: 10 });
    expect(decision.ok).toBe(false);
    if (!decision.ok) expect(decision.reason).toBe("below_minimum");
  });

  it("skips a 0G balance below 0.0001 0G", () => {
    const decision = decideBudget({ ...base, currency: "0g", creditBalance: "1000", marginPct: 0, microUsdPerOg: 1_000_000n });
    expect(decision).toMatchObject({ ok: false, reason: "below_minimum" });
  });

  it("converts a 0G balance with the catalog rate and never invents one", () => {
    const withRate = decideBudget({ ...base, currency: "0g", creditBalance: "1000000000000000000", marginPct: 0, microUsdPerOg: 1_000_000n });
    expect(withRate).toMatchObject({ ok: true, budgetMicro: 1_000_000n, creditLimit: "1", nativeAmount: 10n ** 18n });
    const noRate = decideBudget({ ...base, currency: "0g", creditBalance: "1000000000000000000", marginPct: 0 });
    expect(noRate).toMatchObject({ ok: false, reason: "no_rate" });
  });

  it("refuses a balance that is not an integer", () => {
    expect(decideBudget({ ...base, currency: "usd", creditBalance: "1.50" })).toMatchObject({ ok: false, reason: "unreadable_balance" });
    expect(decideBudget({ ...base, currency: "eur", creditBalance: "1" })).toMatchObject({ ok: false, reason: "unsupported_currency" });
  });

  it("caps budget mode by the nightly limit and may spend the deposit", () => {
    const decision = decideBudget({
      mode: "BUDGET",
      currency: "usd",
      creditBalance: "1000000",
      depositBalance: "2000000",
      nightlyBudgetUsdMicro: 5_000_000n,
      marginPct: 10,
    });
    // The cap is $5 and the account holds $3. The iAI margin is not applied on top of an explicit cap.
    expect(decision).toMatchObject({ ok: true, budgetMicro: 3_000_000n, creditLimit: "3" });
  });

  it("converts a USD cap into a 0G key limit", () => {
    const decision = decideBudget({
      mode: "BUDGET",
      currency: "0g",
      creditBalance: (10n ** 18n).toString(),
      depositBalance: "0",
      nightlyBudgetUsdMicro: 500_000n,
      marginPct: 10,
      microUsdPerOg: 1_000_000n,
    });
    // $0.50 at $1/0G is half a 0G, which is less than the 1 0G of credit.
    expect(decision).toMatchObject({ ok: true, creditLimit: "0.5", budgetMicro: 500_000n });
  });

  it("fails budget mode when the cap or the rate is missing", () => {
    expect(decideBudget({ mode: "BUDGET", currency: "usd", creditBalance: "1000000", depositBalance: "0", nightlyBudgetUsdMicro: null, marginPct: 0 })).toMatchObject({ ok: false, reason: "missing_cap" });
    expect(decideBudget({ mode: "BUDGET", currency: "0g", creditBalance: (10n ** 18n).toString(), depositBalance: "0", nightlyBudgetUsdMicro: 1_000_000n, marginPct: 0 })).toMatchObject({ ok: false, reason: "no_rate" });
  });
});
