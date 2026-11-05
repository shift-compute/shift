import { describe, expect, it } from "vitest";
import { cutoffInIst, formatCountdown, msUntilCutoff, nextCutoff, nightPhase } from "./countdown";

const at = (iso: string) => new Date(iso);

describe("nextCutoff", () => {
  it("is the coming midnight UTC", () => {
    expect(nextCutoff(at("2026-11-05T12:00:00Z")).toISOString()).toBe("2026-11-06T00:00:00.000Z");
  });

  it("moves to the next day exactly at midnight and just before it", () => {
    expect(nextCutoff(at("2026-11-06T00:00:00.000Z")).toISOString()).toBe("2026-11-07T00:00:00.000Z");
    expect(msUntilCutoff(at("2026-11-05T23:59:59.999Z"))).toBe(1);
  });

  it("handles month and year boundaries", () => {
    expect(nextCutoff(at("2026-12-31T18:00:00Z")).toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });
});

describe("formatCountdown", () => {
  it("formats hours, minutes and seconds", () => {
    expect(formatCountdown(5 * 3600_000 + 12 * 60_000 + 9_000)).toBe("05:12:09");
    expect(formatCountdown(24 * 3600_000)).toBe("24:00:00");
  });

  it("rounds up so the reset is never shown early, and never goes negative", () => {
    expect(formatCountdown(1)).toBe("00:00:01");
    expect(formatCountdown(1500)).toBe("00:00:02");
    expect(formatCountdown(0)).toBe("00:00:00");
    expect(formatCountdown(-5000)).toBe("00:00:00");
  });
});

describe("cutoffInIst", () => {
  it("shows the reset as 05:30 India time", () => {
    expect(cutoffInIst(at("2026-11-07T00:00:00Z"))).toBe("05:30");
  });
});

describe("nightPhase", () => {
  it("is day before the window opens", () => {
    expect(nightPhase(at("2026-11-06T22:59:59Z"))).toBe("day");
    expect(nightPhase(at("2026-11-06T04:00:00Z"))).toBe("day");
  });

  it("is window from the start until the hard stop", () => {
    expect(nightPhase(at("2026-11-06T23:00:00Z"))).toBe("window");
    expect(nightPhase(at("2026-11-06T23:49:59Z"))).toBe("window");
  });

  it("is after the hard stop from 23:50 until the reset", () => {
    expect(nightPhase(at("2026-11-06T23:50:00Z"))).toBe("after_hard_stop");
    expect(nightPhase(at("2026-11-06T23:59:59Z"))).toBe("after_hard_stop");
  });

  it("respects a custom window", () => {
    expect(nightPhase(at("2026-11-06T20:30:00Z"), "20:00", "21:00")).toBe("window");
  });
});
