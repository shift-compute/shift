import { describe, expect, it } from "vitest";
import { outputView, readTaskOutput, taskOutputSchema } from "./task-output";

const body = {
  taskId: "task-1",
  type: "DOC_ANALYSIS",
  result: { summary: "Done.", actionItems: ["Send it"], risks: [], truncated: false, chars: 12 },
  files: [],
  createdAt: "2026-11-06T23:10:00.000Z",
  sealed: true as const,
};

describe("task output view", () => {
  it("accepts a decrypted owner result and rejects a body that is not sealed", () => {
    expect(taskOutputSchema.safeParse(body).success).toBe(true);
    expect(taskOutputSchema.safeParse({ ...body, sealed: false }).success).toBe(false);
  });

  it("reads summary text, lists and the transcript", () => {
    expect(outputView(body.result)).toEqual({
      summary: "Done.",
      lists: [{ label: "Action items", items: ["Send it"] }],
      notes: [],
    });
    expect(outputView({ summary: "Morning.", keyPoints: ["Hello"], transcript: "good morning" })).toEqual({
      summary: "Morning.",
      lists: [{ label: "Key points", items: ["Hello"] }],
      notes: ["good morning"],
    });
  });

  it("maps a locked response and a bad body", async () => {
    expect(await readTaskOutput(new Response(JSON.stringify({ error: "not_signed_in" }), { status: 401 }))).toEqual({ phase: "locked" });
    expect(await readTaskOutput(new Response("nope", { status: 200 }))).toEqual({
      phase: "unavailable",
      detail: "The stored result could not be opened. Shift is not showing a made-up summary.",
    });
    expect(await readTaskOutput(new Response(JSON.stringify({ error: "download_timeout" }), { status: 504 }))).toEqual({
      phase: "unavailable",
      detail: "The ciphertext download did not finish in time. The result text is not shown.",
    });
    expect(await readTaskOutput(new Response(JSON.stringify(body), { status: 200 }))).toEqual({ phase: "ready", body });
  });
});
