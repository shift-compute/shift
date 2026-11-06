import { describe, expect, it } from "vitest";
import { STALE_RUNNING_MS } from "../night/night-lock";
import {
  INTERRUPTED_RUN_ERROR,
  nightRunIsStuck,
  recoverInterruptedRuns,
  recoverInterruptedTasks,
  recoverStuckRuns,
  type RecoverRun,
  type RecoverTask,
} from "./recover";

const NOW = new Date("2026-11-06T23:10:00Z");

function run(over: Partial<RecoverRun> = {}): RecoverRun {
  return {
    id: "run-1",
    status: "RUNNING",
    nightId: 20261106n,
    keyRevokedAt: null,
    keyCreatedAt: NOW,
    nightStartedAt: new Date(NOW.getTime() - 60_000),
    ...over,
  };
}

describe("nightRunIsStuck", () => {
  it("leaves a heartbeated run and closes a stale, revoked, or clockless one", () => {
    expect(nightRunIsStuck(run(), NOW)).toBe(false);
    expect(nightRunIsStuck(run({ nightStartedAt: new Date(NOW.getTime() - STALE_RUNNING_MS) }), NOW)).toBe(true);
    expect(nightRunIsStuck(run({ keyRevokedAt: NOW, nightStartedAt: NOW }), NOW)).toBe(true);
    expect(nightRunIsStuck(run({ nightStartedAt: null }), NOW)).toBe(true);
    expect(nightRunIsStuck(run({ status: "DONE", nightStartedAt: null }), NOW)).toBe(false);
  });
});

describe("recoverInterruptedTasks", () => {
  it("requeues a running task only when no request id was stored", async () => {
    const tasks: Array<RecoverTask & { status: string }> = [
      { id: "bare", status: "RUNNING", steps: null },
      { id: "paid", status: "RUNNING", steps: [{ requestId: "req-1" }] },
    ];
    const requeued = await recoverInterruptedTasks({
      runningTasks: async () => tasks,
      requeueTasks: async (ids) => {
        for (const task of tasks) if (ids.includes(task.id)) task.status = "QUEUED";
      },
    });
    expect(requeued).toEqual(["bare"]);
    expect(tasks.map((task) => task.status)).toEqual(["QUEUED", "RUNNING"]);
  });
});

describe("recoverInterruptedRuns", () => {
  it("fails every running night run and leaves the others", async () => {
    const runs = [run({ id: "live" }), run({ id: "done", status: "DONE" })];
    const failed = await recoverInterruptedRuns({
      runningRuns: async () => runs,
      failRuns: async (ids, error) => {
        expect(error).toBe(INTERRUPTED_RUN_ERROR);
        for (const row of runs) if (ids.includes(row.id)) row.status = "FAILED";
      },
    });
    expect(failed).toEqual(["live"]);
    expect(runs.map((row) => row.status)).toEqual(["FAILED", "DONE"]);
  });
});

describe("recoverStuckRuns", () => {
  it("closes a stale run and requeues its unpaid task, and leaves a live night alone", async () => {
    const runs = [
      run({ id: "stale", nightId: 11n, nightStartedAt: new Date(NOW.getTime() - STALE_RUNNING_MS - 1) }),
      run({ id: "live", nightId: 22n, nightStartedAt: new Date(NOW.getTime() - 1_000) }),
    ];
    const tasks: Array<RecoverTask & { status: string }> = [
      { id: "stale-task", status: "RUNNING", nightId: 11n, steps: [] },
      { id: "stale-paid", status: "RUNNING", nightId: 11n, steps: [{ requestId: "req-9" }] },
      { id: "live-task", status: "RUNNING", nightId: 22n, steps: [] },
      { id: "orphan", status: "RUNNING", nightId: null, steps: null },
    ];
    const report = await recoverStuckRuns(
      {
        runningRuns: async () => runs,
        failRuns: async (ids) => {
          for (const row of runs) if (ids.includes(row.id)) row.status = "FAILED";
        },
        runningTasks: async () => tasks,
        requeueTasks: async (ids) => {
          for (const task of tasks) if (ids.includes(task.id)) task.status = "QUEUED";
        },
      },
      NOW,
    );
    expect(report.runs).toEqual(["stale"]);
    expect(report.tasks.sort()).toEqual(["orphan", "stale-task"]);
    expect(runs.find((row) => row.id === "live")?.status).toBe("RUNNING");
    expect(tasks.find((task) => task.id === "live-task")?.status).toBe("RUNNING");
    expect(tasks.find((task) => task.id === "stale-paid")?.status).toBe("RUNNING");
  });
});
