import { describe, expect, it, vi } from "vitest";
import { acquireNight, STALE_RUNNING_MS, type NightStore } from "./night-lock";
import { inNightWindow, manualNightId, msUntilHardStop, nightIdFor } from "./schedule";

const at = (iso: string) => new Date(iso);

describe("inNightWindow", () => {
  it("is open from the start minute to just before the hard stop", () => {
    expect(inNightWindow(at("2026-11-06T22:59:59Z"), "23:00", "23:50")).toBe(false);
    expect(inNightWindow(at("2026-11-06T23:00:00Z"), "23:00", "23:50")).toBe(true);
    expect(inNightWindow(at("2026-11-06T23:49:59Z"), "23:00", "23:50")).toBe(true);
    expect(inNightWindow(at("2026-11-06T23:50:00Z"), "23:00", "23:50")).toBe(false);
  });
});

describe("night ids", () => {
  it("uses the UTC date of the day that ends at the cutoff", () => {
    expect(nightIdFor(at("2026-11-06T23:10:00Z"))).toBe(20261106n);
    expect(nightIdFor(at("2027-01-01T00:00:00Z"))).toBe(20270101n);
  });

  it("gives manual runs unix seconds that cannot collide with a date id", () => {
    const id = manualNightId(at("2026-11-06T10:00:00.900Z"));
    expect(id).toBe(1793959200n);
    expect(id > 99_999_999n).toBe(true);
  });
});

describe("msUntilHardStop", () => {
  it("counts down to the hard stop and never goes negative", () => {
    expect(msUntilHardStop(at("2026-11-06T23:40:00Z"), "23:50")).toBe(10 * 60_000);
    expect(msUntilHardStop(at("2026-11-06T23:55:00Z"), "23:50")).toBe(0);
  });
});

describe("acquireNight", () => {
  function store(count: number) {
    const updateMany = vi.fn().mockResolvedValue({ count });
    const upsert = vi.fn().mockResolvedValue({});
    return { db: { night: { upsert, updateMany } } as unknown as NightStore, updateMany, upsert };
  }

  it("takes the night when exactly one row flips to RUNNING", async () => {
    const { db, upsert } = store(1);
    expect(await acquireNight(db, 20261106n, at("2026-11-06T23:00:30Z"))).toBe(true);
    expect(upsert).toHaveBeenCalledWith({ where: { id: 20261106n }, create: { id: 20261106n }, update: {} });
  });

  it("loses the race when another instance already flipped it", async () => {
    expect(await acquireNight(store(0).db, 20261106n)).toBe(false);
  });

  it("may only take over a RUNNING night that is stale, and never a DONE or FAILED one", async () => {
    const { db, updateMany } = store(1);
    const now = at("2026-11-06T23:00:00Z");
    await acquireNight(db, 20261106n, now);
    const where = updateMany.mock.calls[0]![0].where;
    expect(where.OR).toEqual([{ status: "PENDING" }, { status: "RUNNING", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } }]);
  });
});
