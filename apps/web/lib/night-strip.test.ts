import { describe, expect, it } from "vitest";
import {
  emptyNightStrip,
  signedOutNightStrip,
  stripFromNight,
  stripFromPreview,
  stripFromSource,
  stripStateLabel,
  type StripAssignment,
  type StripTask,
} from "./night-strip";

function assignment(taskId: string, costMicro: string, type = "DOC_ANALYSIS"): StripAssignment {
  return { taskId, type, costMicro };
}

function task(id: string, status: string, prompt: string | null = null, type = "DOC_ANALYSIS"): StripTask {
  return { id, status, type, prompt };
}

function bpsSum(shares: number[], remainder: number): number {
  return shares.reduce((sum, share) => sum + share, 0) + remainder;
}

describe("stripFromPreview", () => {
  it("sizes blocks by estimated cost and leaves the unspent budget as the tail", () => {
    const model = stripFromPreview(
      { budgetMicro: "8", assignments: [assignment("a", "1"), assignment("b", "2", "AUDIO_SUMMARY"), assignment("c", "1", "IMAGE_FROM_PROMPT")] },
      [task("a", "QUEUED"), task("b", "QUEUED", null, "AUDIO_SUMMARY"), task("c", "QUEUED", null, "IMAGE_FROM_PROMPT")],
    );
    expect(model.segments.map((segment) => segment.shareBps)).toEqual([1250, 2500, 1250]);
    expect(model.remainderBps).toBe(5000);
    expect(bpsSum(model.segments.map((segment) => segment.shareBps), model.remainderBps)).toBe(10_000);
    expect(model.tone).toBe("planned");
    expect(model.consumedBps).toBe(0);
    expect(model.startLabel).toBe("Now");
    expect(model.endLabel).toBe("00:00 UTC");
    expect(model.segments.map((segment) => segment.label)).toEqual(["Analyze a document", "Summarize audio", "Generate an image"]);
  });

  it("keeps proportions exact for costs above the safe integer range", () => {
    const ether = "1000000000000000000";
    const model = stripFromPreview(
      { budgetMicro: "8000000000000000000", assignments: [assignment("a", ether), assignment("b", "2000000000000000000"), assignment("c", ether)] },
      [],
    );
    expect(model.segments.map((segment) => segment.shareBps)).toEqual([1250, 2500, 1250]);
    expect(model.remainderBps).toBe(5000);
  });

  it("fills the strip when the estimates exceed the budget", () => {
    const model = stripFromPreview({ budgetMicro: "5", assignments: [assignment("a", "4"), assignment("b", "4")] }, []);
    expect(model.segments.map((segment) => segment.shareBps)).toEqual([5000, 5000]);
    expect(model.remainderBps).toBe(0);
  });

  it("shares a zero budget equally when every estimate is zero", () => {
    const model = stripFromPreview({ budgetMicro: "0", assignments: [assignment("a", "0"), assignment("b", "0"), assignment("c", "0")] }, []);
    expect(model.segments.map((segment) => segment.shareBps)).toEqual([3334, 3333, 3333]);
    expect(model.remainderBps).toBe(0);
  });

  it("consumes finished tasks from the left and holds the running task at the edge", () => {
    const model = stripFromPreview(
      { budgetMicro: "8", assignments: [assignment("a", "2"), assignment("b", "2"), assignment("c", "4")] },
      [task("a", "DONE"), task("b", "RUNNING"), task("c", "QUEUED")],
    );
    expect(model.tone).toBe("running");
    expect(model.consumedBps).toBe(2500);
    expect(model.segments.map((segment) => segment.state)).toEqual(["done", "running", "planned"]);
    expect(model.caption).toBe("The budget is being spent from left to right.");
  });

  it("turns the whole strip to first light only when every assigned task is done", () => {
    const model = stripFromPreview(
      { budgetMicro: "4", assignments: [assignment("a", "1"), assignment("b", "1")] },
      [task("a", "DONE"), task("b", "DONE")],
    );
    expect(model.tone).toBe("finished");
    expect(model.consumedBps).toBe(10_000);
    expect(model.remainderBps).toBe(5000);
  });

  it("does not count a failed task as spent", () => {
    const model = stripFromPreview(
      { budgetMicro: "8", assignments: [assignment("a", "2"), assignment("b", "2")] },
      [task("a", "FAILED"), task("b", "DONE")],
    );
    expect(model.consumedBps).toBe(2500);
    expect(model.segments[0]?.state).toBe("failed");
  });

  it("keeps assignment order and clips a prompt into the label", () => {
    const prompt = "a night market painted in sodium light";
    const model = stripFromPreview({ budgetMicro: "2", assignments: [assignment("b", "1"), assignment("a", "1", "IMAGE_FROM_PROMPT")] }, [
      task("a", "PLANNED", prompt, "IMAGE_FROM_PROMPT"),
    ]);
    expect(model.segments.map((segment) => segment.id)).toEqual(["b:0", "a:1"]);
    expect(model.segments[1]?.label).toBe("Generate an image: “a night market painted in sodium…”");
  });

  it("treats a non-numeric cost as unreported and does not throw", () => {
    const model = stripFromPreview({ budgetMicro: "4", assignments: [assignment("a", "nope"), assignment("b", "4")] }, []);
    expect(model.segments[0]).toMatchObject({ shareBps: 0, costMicro: null, costLabel: "Cost not reported" });
    expect(model.segments[1]).toMatchObject({ shareBps: 10_000, costLabel: "0.000004 USD" });
  });
});

describe("stripFromSource", () => {
  it("maps loading, a dead key and an empty queue to an empty strip", () => {
    expect(stripFromSource({ phase: "loading" }, []).caption).toBe("Reading tonight's plan.");
    expect(stripFromSource({ phase: "reconnect" }, []).caption).toContain("Connect your 0G account again");
    expect(stripFromSource({ phase: "empty", message: "Nothing is waiting for tonight." }, []).remainderBps).toBe(10_000);
    expect(emptyNightStrip("Waiting.").tone).toBe("planned");
    expect(signedOutNightStrip().caption).toContain("Connect your 0G account");
  });
});

describe("stripFromNight", () => {
  const tasks = [
    { id: "a", type: "DOC_ANALYSIS" as const, status: "DONE", prompt: null, actualCostUsdMicro: "1" },
    { id: "b", type: "AUDIO_SUMMARY" as const, status: "RUNNING", prompt: null, actualCostUsdMicro: "3" },
  ];

  it("uses reported costs and reaches first light only when the night is done", () => {
    const done = stripFromNight("DONE", tasks.map((task) => ({ ...task, status: "DONE" })));
    expect(done.tone).toBe("finished");
    expect(done.consumedBps).toBe(10_000);
    expect(done.endLabel).toBe("First light");
    expect(done.segments.map((segment) => segment.shareBps)).toEqual([2500, 7500]);
    expect(done.caption).toBe("This night is finished.");
  });

  it("spends from the left while the night is running", () => {
    const running = stripFromNight("RUNNING", tasks);
    expect(running.tone).toBe("running");
    expect(running.consumedBps).toBe(2500);
    expect(running.endLabel).toBe("00:00 UTC");
  });

  it("gives equal shares when no cost has been reported", () => {
    const running = stripFromNight("RUNNING", [
      { id: "a", type: "DOC_ANALYSIS", status: "RUNNING", prompt: null, actualCostUsdMicro: null },
      { id: "b", type: "DOC_ANALYSIS", status: "QUEUED", prompt: null, actualCostUsdMicro: null },
    ]);
    expect(running.segments.map((segment) => segment.shareBps)).toEqual([5000, 5000]);
    expect(running.segments[0]?.costLabel).toBe("Cost not reported");
    expect(running.caption).toContain("equal share");
    expect(running.consumedBps).toBe(0);
  });

  it("keeps a failed night off first light and does not call anchoring finished", () => {
    const failed = stripFromNight("FAILED", [{ id: "a", type: "DOC_ANALYSIS", status: "FAILED", prompt: null, actualCostUsdMicro: "2" }]);
    expect(failed.tone).not.toBe("finished");
    expect(failed.endLabel).toBe("Stopped");
    expect(failed.consumedBps).toBe(0);

    const anchoring = stripFromNight("ANCHORING", tasks.map((task) => ({ ...task, status: "DONE" })));
    expect(anchoring.tone).toBe("running");
    expect(anchoring.caption).toContain("anchored");
    expect(anchoring.endLabel).not.toBe("First light");
  });

  it("names each block state for the legend", () => {
    expect(stripStateLabel("planned")).toBe("Planned");
    expect(stripStateLabel("running")).toBe("Running");
    expect(stripStateLabel("done")).toBe("Done");
    expect(stripStateLabel("failed")).toBe("Not completed");
  });
});
