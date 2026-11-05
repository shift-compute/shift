import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "./catalog";
import { estimateAudioSeconds, estimateCostMicro, estimateDocChars } from "./estimator";

const entry = (over: Partial<CatalogEntry>): CatalogEntry => ({ id: "m", kind: "chat", trust: "private", promptAtto: 0n, completionAtto: 0n, imageAtto: 0n, ...over });
// 1 micro-USD per 1000 tokens in, 2 per 1000 out: easy to check by hand.
const chat = entry({ promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n });

describe("size heuristics", () => {
  it("uses the real duration when known, bytes otherwise, and at least one second", () => {
    expect(estimateAudioSeconds({ bytes: 1, durationSec: 12.2 })).toBe(13);
    expect(estimateAudioSeconds({ bytes: 160_000, mime: "audio/mpeg" })).toBe(10);
    expect(estimateAudioSeconds({ bytes: 320_000, mime: "audio/wav" })).toBe(10);
    expect(estimateAudioSeconds({ bytes: 5 })).toBe(1);
  });

  it("counts a fraction of a pdf as text and caps long documents", () => {
    expect(estimateDocChars({ bytes: 1000, mime: "application/pdf" })).toBe(300);
    expect(estimateDocChars({ bytes: 1000, mime: "text/plain" })).toBe(1000);
    expect(estimateDocChars({ bytes: 5_000_000, chars: 90_000 })).toBe(24_000);
  });
});

describe("estimateCostMicro", () => {
  it("prices a document from its tokens in and the fixed output, with the 15% margin", () => {
    // 4000 chars = 1000 tokens + 150 overhead in; 700 out. atto = 1150*1e9 + 700*2e9 = 2.55e12. x1.15 = 2.9325e12 -> 3 micro.
    expect(estimateCostMicro("DOC_ANALYSIS", { bytes: 4000, mime: "text/plain" }, { chat })).toBe(3n);
  });

  it("adds transcription per second for audio", () => {
    const stt = entry({ kind: "transcribe", promptAtto: 130_000_000_000_000n }); // 0.00013 USD per second
    // 10 s: stt = 1.3e15 atto. chat: 150 chars -> 38 tokens + 150 in, 400 out = 188e9 + 800e9 ~ 1e12. Total ~1.301e15 x1.15 ~ 1.4962e15 -> 1497 micro.
    expect(estimateCostMicro("AUDIO_SUMMARY", { bytes: 160_000, mime: "audio/mpeg" }, { chat, transcribe: stt })).toBe(1497n);
  });

  it("adds one image for image tasks", () => {
    const image = entry({ kind: "image", imageAtto: 8_800_000_000_000_000n }); // 0.0088 USD
    const micro = estimateCostMicro("IMAGE_FROM_PROMPT", { bytes: 0, prompt: "a lighthouse" }, { chat, image });
    expect(micro).toBeGreaterThanOrEqual(10_120n); // 0.0088 x 1.15 = 10,120 micro-USD
    expect(micro).toBeLessThan(10_130n);
  });

  it("refuses to guess without the model the task needs", () => {
    expect(() => estimateCostMicro("AUDIO_SUMMARY", { bytes: 1 }, { chat })).toThrow(/transcription model/);
    expect(() => estimateCostMicro("IMAGE_FROM_PROMPT", { bytes: 0, prompt: "x" }, { chat })).toThrow(/image model/);
  });

  it("costs nothing extra on free models", () => {
    expect(estimateCostMicro("DOC_ANALYSIS", { bytes: 100 }, { chat: entry({}) })).toBe(0n);
  });
});
