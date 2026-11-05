import { describe, expect, it, vi } from "vitest";
import { runAudioSummary, transcriptFrom } from "./audio-summary";
import type { ExecutorContext } from "./types";

function ctxWith(router: Partial<ExecutorContext["router"]>, models: ExecutorContext["models"] = { chat: "chat-m", transcribe: "stt-m" }): ExecutorContext {
  return { router: router as ExecutorContext["router"], sk: "sk-test", models, trustMode: "private", taskId: "t1", attempt: 2 };
}

const chatReply = (content: string) => ({ data: { choices: [{ message: { content } }] }, status: 200, requestId: "req-chat" });

describe("transcriptFrom", () => {
  it("trims the text and rejects empty ones", () => {
    expect(transcriptFrom({ text: "  hello  " })).toBe("hello");
    expect(() => transcriptFrom({ text: "  " })).toThrow(/empty/);
    expect(() => transcriptFrom({})).toThrow(/empty/);
    expect(() => transcriptFrom(null)).toThrow(/empty/);
  });
});

describe("runAudioSummary", () => {
  const input = { bytes: new Uint8Array([1, 2, 3]), fileName: "a.mp3", mime: "audio/mpeg" };

  it("transcribes, summarizes and records both steps", async () => {
    const transcribe = vi.fn().mockResolvedValue({ data: { text: "we met on Monday" }, status: 200, requestId: "req-stt", trace: { tee_verified: true } });
    const chat = vi.fn().mockResolvedValue(chatReply('```json\n{"summary":"A Monday meeting.","keyPoints":["Monday"]}\n```'));
    const out = await runAudioSummary(ctxWith({ transcribe, chat }), input);

    expect(out.result).toEqual({ transcript: "we met on Monday", summary: "A Monday meeting.", keyPoints: ["Monday"] });
    expect(out.steps.map((s) => [s.step, s.model, s.requestId])).toEqual([
      ["transcribe", "stt-m", "req-stt"],
      ["summarize", "chat-m", "req-chat"],
    ]);
    expect(transcribe.mock.calls[0]![2]).toEqual({ trustMode: "private", clientRequestId: "t1-2-transcribe" });
    const form = transcribe.mock.calls[0]![1] as FormData;
    expect(form.get("model")).toBe("stt-m");
    expect(form.get("response_format")).toBe("verbose_json");
    expect(chat.mock.calls[0]![1].messages[1].content).toBe("we met on Monday");
  });

  it("does not call the chat model when the transcript is empty", async () => {
    const transcribe = vi.fn().mockResolvedValue({ data: { text: "" }, status: 200 });
    const chat = vi.fn();
    await expect(runAudioSummary(ctxWith({ transcribe, chat }), input)).rejects.toThrow(/empty/);
    expect(chat).not.toHaveBeenCalled();
  });

  it("needs a transcription model", async () => {
    await expect(runAudioSummary(ctxWith({}, { chat: "c" }), input)).rejects.toThrow(/transcription model/);
  });
});
