import type { Task } from "@shift/core";
import { describe, expect, it } from "vitest";
import { taskView } from "./task-view";

function task(over: Partial<Task> = {}): Task {
  return {
    id: "task-1",
    userId: "user-1",
    type: "IMAGE_FROM_PROMPT",
    status: "FAILED",
    priority: 2,
    inputPath: "user-1/secret.bin",
    inputMeta: { bytes: 12 },
    prompt: "A simple flat icon",
    nightId: 1793959200n,
    complexity: null,
    chosenModel: "image-model",
    estCostUsdMicro: null,
    actualCostUsdMicro: 22300n,
    steps: [
      { step: "image", requestId: "req-image-1234", trace: { authorization: "mk-0123456789abcdef" } },
      { requestId: "sk-abcdefghijklmnopqrstuvwxyz" },
      { requestId: "short" },
    ],
    outputRoot: null,
    outputTx: null,
    error: "image failed saw mk-0123456789abcdef",
    createdAt: new Date("2026-11-06T22:35:12Z"),
    updatedAt: new Date("2026-11-06T22:36:00Z"),
    ...over,
  } as Task;
}

describe("taskView", () => {
  it("keeps the night, the reported cost, the error and safe request ids", () => {
    const view = taskView(task());
    expect(view.nightId).toBe("1793959200");
    expect(view.actualCostUsdMicro).toBe("22300");
    expect(view.error).toBe("image failed saw [redacted]");
    expect(view.requestIds).toEqual(["req-image-1234"]);
    expect(view.inputBytes).toBe(12);
    const body = JSON.stringify(view);
    expect(body).not.toContain("mk-0123456789abcdef");
    expect(body).not.toContain("sk-abcdefghijklmnopqrstuvwxyz");
    expect(body).not.toContain("secret.bin");
    expect(body).not.toContain("trace");
  });

  it("omits a night and a cost that were never stored", () => {
    const view = taskView(task({ nightId: null, actualCostUsdMicro: null, error: null, steps: null, status: "QUEUED" }));
    expect(view.nightId).toBeNull();
    expect(view.actualCostUsdMicro).toBeNull();
    expect(view.error).toBeNull();
    expect(view.requestIds).toEqual([]);
  });
});
