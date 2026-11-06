import { describe, expect, it } from "vitest";
import { readPreview } from "./preview-state";

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const preview = {
  qualityFloor: 1,
  complexity: "at_run_time",
  budgetMicro: "900000",
  spentEstimateMicro: "9",
  remainingMicro: "899991",
  assignments: [{ taskId: "t1", type: "DOC_ANALYSIS", model: "glm-5.3", transcribeModel: null, imageModel: null, quality: 3, costMicro: "9" }],
  deferred: [{ taskId: "t2", type: "AUDIO_SUMMARY", reason: "over_budget" }],
};

describe("readPreview", () => {
  it("reads a successful estimate", async () => {
    await expect(readPreview(jsonRes(200, preview))).resolves.toEqual({ phase: "ready", preview });
  });

  it("maps the empty queue, a dead key, a missing rate and a catalog outage", async () => {
    await expect(readPreview(jsonRes(409, { error: "empty_queue", message: "Nothing is waiting for tonight." }))).resolves.toEqual({
      phase: "empty",
      message: "Nothing is waiting for tonight.",
    });
    await expect(readPreview(jsonRes(401, { error: "connection_invalid" }))).resolves.toEqual({ phase: "reconnect" });
    await expect(readPreview(jsonRes(401, { error: "not_signed_in" }))).resolves.toEqual({ phase: "unavailable" });
    await expect(readPreview(jsonRes(409, { error: "no_rate", message: "No paired price." }))).resolves.toEqual({
      phase: "message",
      message: "No paired price.",
    });
    await expect(readPreview(jsonRes(502, { error: "router_unavailable", kind: "network" }))).resolves.toMatchObject({ phase: "message" });
    await expect(readPreview(null)).resolves.toEqual({ phase: "unavailable" });
  });

  it("rejects a body whose amounts are not integer micro-USD", async () => {
    const bad = await readPreview(jsonRes(200, { ...preview, budgetMicro: "1.5" }));
    expect(bad.phase).toBe("message");
  });
});
