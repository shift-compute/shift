import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MissingCatalogRateError,
  impliedMicroUsdPerOg,
  microUsdToOgWei,
  microUsdToWei,
  ogWeiToMicroUsd,
  weiToMicroUsd,
  type PricePair,
} from "./rate";

const pair = (wei: string, usd: string): PricePair => ({ pricing: { prompt: wei }, pricing_usd: { prompt: usd } });

describe("impliedMicroUsdPerOg", () => {
  it("converts a wei price and a USD price into micro-USD per 0G", () => {
    // 1 0G of native price priced at $1 → 1_000_000 micro-USD per 0G.
    expect(impliedMicroUsdPerOg([pair("1000000000000000000", "1")])).toBe(1_000_000n);
  });

  it("uses the lower middle of an even set so the rate is never rounded up", () => {
    const models = [pair("1000000000000000000", "1"), pair("1000000000000000000", "3")];
    expect(impliedMicroUsdPerOg(models)).toBe(1_000_000n);
  });

  it("uses the middle value of an odd set and reads image pairs", () => {
    const models = [pair("1000000000000000000", "1"), pair("1000000000000000000", "2"), pair("1000000000000000000", "9")];
    expect(impliedMicroUsdPerOg(models)).toBe(2_000_000n);
    expect(impliedMicroUsdPerOg([{ pricing: { image: "1000000000000000000" }, pricing_usd: { image: "2" } }])).toBe(2_000_000n);
  });

  it("ignores a price that is not paired on the same unit", () => {
    expect(impliedMicroUsdPerOg([{ pricing: { prompt: "1000000000000000000" }, pricing_usd: { completion: "1" } }])).toBeUndefined();
    expect(impliedMicroUsdPerOg([{ pricing: { prompt: "0" }, pricing_usd: { prompt: "1" } }])).toBeUndefined();
    expect(impliedMicroUsdPerOg([{ pricing: { prompt: "1.5" }, pricing_usd: { prompt: "1" } }])).toBeUndefined();
    expect(impliedMicroUsdPerOg([{ pricing_usd: { prompt: "0.01" } }])).toBeUndefined();
    expect(impliedMicroUsdPerOg([])).toBeUndefined();
  });

  it("reads a usable rate from the Phase 0 catalog snapshot", () => {
    const models = JSON.parse(readFileSync(path.resolve(__dirname, "../../../../docs/spike/models.json"), "utf8")) as PricePair[];
    const rate = impliedMicroUsdPerOg(models);
    // The snapshot's 0GM prompt pair is 145985 micro-USD per 0G. A unit mistake would miss this range entirely.
    expect(rate).toBeGreaterThan(1_000n);
    expect(rate).toBeLessThan(10_000_000n);
  });
});

describe("wei and micro-USD conversion", () => {
  const models = [pair("1000000000000000000", "1")];

  it("converts a 0G balance and a USD cap at the catalog rate", () => {
    expect(ogWeiToMicroUsd(10n ** 18n, models)).toBe(1_000_000n);
    expect(weiToMicroUsd(10n ** 18n, 1_000_000n)).toBe(1_000_000n);
    // $0.50 at $1/0G is half a 0G.
    expect(microUsdToOgWei(500_000n, models)).toBe(5n * 10n ** 17n);
    expect(microUsdToWei(500_000n, 1_000_000n)).toBe(5n * 10n ** 17n);
    // Truncate. One wei is not rounded up into a micro-USD of budget.
    expect(weiToMicroUsd(1n, 1_000_000n)).toBe(0n);
  });

  it("fails clearly when the catalog has no pair", () => {
    expect(() => ogWeiToMicroUsd(10n ** 18n, [])).toThrow(MissingCatalogRateError);
    expect(() => microUsdToOgWei(1n, [{ pricing_usd: { prompt: "0.01" } }])).toThrow(/without inventing a rate/);
    expect(() => microUsdToWei(1n, 0n)).toThrow(MissingCatalogRateError);
  });
});
