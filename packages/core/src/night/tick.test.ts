import { describe, expect, it, vi } from "vitest";
import type { NightStore } from "./night-lock";
import { tick } from "./tick";

const store = (count: number): NightStore => ({ night: { upsert: vi.fn().mockResolvedValue({}), updateMany: vi.fn().mockResolvedValue({ count }) } }) as unknown as NightStore;
const base = { startUtc: "23:00", hardStopUtc: "23:50" };

describe("tick", () => {
  it("does nothing outside the window and does not touch the database", async () => {
    const db = store(1);
    const runNight = vi.fn();
    expect(await tick({ ...base, db, runNight, now: () => new Date("2026-11-06T12:00:00Z") })).toBe("outside_window");
    expect(runNight).not.toHaveBeenCalled();
    expect(db.night.upsert).not.toHaveBeenCalled();
  });

  it("runs the night for the UTC date when it wins the lock", async () => {
    const runNight = vi.fn().mockResolvedValue(undefined);
    expect(await tick({ ...base, db: store(1), runNight, now: () => new Date("2026-11-06T23:05:00Z") })).toBe("ran");
    expect(runNight).toHaveBeenCalledWith(20261106n);
  });

  it("stays out of the way when another instance holds the night", async () => {
    const runNight = vi.fn();
    expect(await tick({ ...base, db: store(0), runNight, now: () => new Date("2026-11-06T23:05:00Z") })).toBe("busy");
    expect(runNight).not.toHaveBeenCalled();
  });

  it("reports a failed night instead of throwing into the cron loop", async () => {
    const log = vi.fn();
    const runNight = vi.fn().mockRejectedValue(new Error("router down"));
    expect(await tick({ ...base, db: store(1), runNight, log, now: () => new Date("2026-11-06T23:05:00Z") })).toBe("failed");
    expect(log).toHaveBeenCalledWith(expect.stringContaining("router down"));
  });
});
