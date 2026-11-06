import { afterEach, describe, expect, it, vi } from "vitest";
import { createRunFlag, startNightLoop, withNightFlag } from "./run-flag";

describe("startNightLoop", () => {
  it("runs once on boot and registers the minute schedule", () => {
    const runs: string[] = [];
    let expression = "";
    startNightLoop(
      (cron, task) => {
        expression = cron;
        runs.push("scheduled");
        void task;
      },
      () => runs.push("run"),
    );
    expect(expression).toBe("* * * * *");
    expect(runs).toEqual(["scheduled", "run"]);
  });
});

describe("withNightFlag", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("releases the flag when the hard stop passes so a later tick is not blocked", async () => {
    vi.useFakeTimers();
    const flag = createRunFlag();
    const logs: string[] = [];
    let releaseHung: () => void = () => undefined;
    const hung = new Promise<void>((resolve) => {
      releaseHung = resolve;
    });
    const first = withNightFlag(flag, "23:50", new Date("2026-11-06T23:40:00Z"), (message) => logs.push(message), () => hung);
    expect(flag.held).toBe(true);
    const blocked = await withNightFlag(flag, "23:50", new Date("2026-11-06T23:41:00Z"), () => undefined, async () => undefined);
    expect(blocked).toBe(false);

    await vi.advanceTimersByTimeAsync(10 * 60_000);
    expect(flag.held).toBe(false);
    expect(logs.join("\n")).toContain("hard stop reached");

    let ran = false;
    const second = withNightFlag(flag, "23:50", new Date("2026-11-06T23:50:00Z"), () => undefined, async () => {
      ran = true;
    });
    await vi.advanceTimersByTimeAsync(0);
    await second;
    expect(ran).toBe(true);
    expect(flag.held).toBe(false);

    releaseHung();
    await first;
    expect(flag.held).toBe(false);
  });
});
