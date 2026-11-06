import { describe, expect, it } from "vitest";
import { parseNightId } from "./night-id";

describe("parseNightId", () => {
  it("accepts a UTC date and a manual unix-second id", () => {
    expect(parseNightId("20261106")).toBe(20261106n);
    expect(parseNightId("1762394400")).toBe(1762394400n);
  });

  it("rejects anything that is not a positive int64", () => {
    expect(parseNightId("")).toBeNull();
    expect(parseNightId("nope")).toBeNull();
    expect(parseNightId("0")).toBeNull();
    expect(parseNightId("01")).toBeNull();
    expect(parseNightId("-20261106")).toBeNull();
    expect(parseNightId("20261106.0")).toBeNull();
    expect(parseNightId("9223372036854775808")).toBeNull();
    expect(parseNightId("1".repeat(80))).toBeNull();
  });
});
