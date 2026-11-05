import { describe, expect, it } from "vitest";
import { formatAmount } from "./format";

describe("formatAmount", () => {
  it("formats zero and whole amounts without trailing decimals", () => {
    expect(formatAmount("0", "0g")).toBe("0 0G");
    expect(formatAmount("12", "0g")).toBe("12 0G");
    expect(formatAmount("1.500000", "usd")).toBe("1.5 USD");
  });

  it("truncates instead of rounding, and keeps 18-decimal values exact", () => {
    expect(formatAmount("0.9999999", "0g")).toBe("0.999999 0G");
    expect(formatAmount("1.123456789012345678", "0g")).toBe("1.123456 0G");
  });

  it("drops a fraction that truncates to nothing", () => {
    expect(formatAmount("3.0000001", "0g")).toBe("3 0G");
  });

  it("falls back to the upper-cased currency code", () => {
    expect(formatAmount("1", "eur")).toBe("1 EUR");
  });
});
