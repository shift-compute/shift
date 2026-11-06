import { describe, expect, it, vi } from "vitest";
import { DISCONNECT_RUN_ERROR, closeRunsOnDisconnect } from "./disconnect-run";

describe("closeRunsOnDisconnect", () => {
  it("fails RUNNING night runs for that user and leaves the error explicit", async () => {
    const updateMany = vi.fn(async () => ({ count: 1 }));
    const count = await closeRunsOnDisconnect({ nightRun: { updateMany } }, "user-1");
    expect(count).toBe(1);
    expect(updateMany).toHaveBeenCalledWith({
      where: { userId: "user-1", status: "RUNNING" },
      data: { status: "FAILED", error: DISCONNECT_RUN_ERROR },
    });
  });
});
