import { describe, expect, it } from "vitest";
import { formatAmount } from "./format";

describe("formatAmount", () => {
  it("reads USD accounts as micro-USD", () => {
    expect(formatAmount("5000000", "usd")).toBe("5 USD");
    expect(formatAmount("1500000", "usd")).toBe("1.5 USD");
    expect(formatAmount("10000", "usd")).toBe("0.01 USD");
    expect(formatAmount("1", "usd")).toBe("0.000001 USD");
    expect(formatAmount("0", "usd")).toBe("0 USD");
    // Observed on the connect screen as the raw Router integer "4865042" with currency "usd".
    expect(formatAmount("4865042", "usd")).toBe("4.865042 USD");
    expect(formatAmount("22300", "usd")).toBe("0.0223 USD");
    expect(formatAmount("200000", "usd")).toBe("0.2 USD");
  });

  it("reads 0G accounts as wei and keeps 18-digit values exact", () => {
    expect(formatAmount("0", "0g")).toBe("0 0G");
    expect(formatAmount("1000000000000000000", "0g")).toBe("1 0G");
    expect(formatAmount("100000000000000000", "0g")).toBe("0.1 0G");
    expect(formatAmount("1123456789012345678", "0g")).toBe("1.123456 0G");
  });

  it("truncates instead of rounding", () => {
    expect(formatAmount("999999999999999999", "0g")).toBe("0.999999 0G");
    expect(formatAmount("3000000100000000000", "0g")).toBe("3 0G");
  });

  it("shows the raw text for anything that is not an integer, and upper-cases unknown currencies", () => {
    expect(formatAmount("1.5", "0g")).toBe("1.5 0G");
    expect(formatAmount("7", "eur")).toBe("7 EUR");
  });
});
