import { describe, expect, it } from "vitest";
import { ASSUMPTIONS as exportedAssumptions, estimateCostMicro as exportedEstimate, estimateDecisionMicro as exportedDecision } from "@shift/core";
import { ATTO_PER_MICRO, type CatalogEntry } from "./catalog";
import { ASSUMPTIONS, estimateAudioSeconds, estimateCostMicro, estimateDecisionMicro, estimateDocChars } from "./estimator";

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

  it("treats a missing, zero or non-finite duration as at least one second from the bytes", () => {
    expect(estimateAudioSeconds({ bytes: 0, durationSec: 0 })).toBe(1);
    expect(estimateAudioSeconds({ bytes: 0, durationSec: 0.2 })).toBe(1);
    expect(estimateAudioSeconds({ bytes: 16_001, mime: "audio/mp4" })).toBe(2);
    expect(estimateAudioSeconds({ bytes: 160_000, mime: "audio/mpeg", durationSec: Number.NaN })).toBe(10);
    expect(estimateAudioSeconds({ bytes: Number.NaN })).toBe(1);
    expect(estimateAudioSeconds({ bytes: -50 })).toBe(1);
  });

  it("counts a fraction of a pdf as text and caps long documents", () => {
    expect(estimateDocChars({ bytes: 1000, mime: "application/pdf" })).toBe(300);
    expect(estimateDocChars({ bytes: 1000, mime: "text/plain" })).toBe(1000);
    expect(estimateDocChars({ bytes: 5_000_000, chars: 90_000 })).toBe(24_000);
  });

  it("keeps empty, negative and markdown sizes inside the cap", () => {
    expect(estimateDocChars({ bytes: 0, mime: "application/pdf" })).toBe(0);
    expect(estimateDocChars({ bytes: 1, mime: "application/pdf" })).toBe(1);
    expect(estimateDocChars({ bytes: 1000, mime: "application/pdf", chars: 10 })).toBe(10);
    expect(estimateDocChars({ bytes: 20, mime: "text/markdown" })).toBe(20);
    expect(estimateDocChars({ bytes: 100, chars: -10 })).toBe(0);
    expect(estimateDocChars({ bytes: Number.NaN, chars: Number.NaN })).toBe(0);
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
    expect(() => estimateCostMicro("AUDIO_SUMMARY", { bytes: 1 }, { chat, transcribe: chat })).toThrow(/transcription model/);
    expect(() => estimateCostMicro("IMAGE_FROM_PROMPT", { bytes: 0, prompt: "x" }, { chat })).toThrow(/image model/);
    expect(() => estimateCostMicro("IMAGE_FROM_PROMPT", { bytes: 0, prompt: "x" }, { chat, image: chat })).toThrow(/image model/);
    expect(() => estimateCostMicro("DOC_ANALYSIS", { bytes: 4 }, { chat: entry({ kind: "decision" }) })).toThrow(/chat model/);
  });

  it("costs nothing on free models, including audio and image", () => {
    const free = entry({});
    expect(estimateCostMicro("DOC_ANALYSIS", { bytes: 100 }, { chat: free })).toBe(0n);
    expect(estimateCostMicro("AUDIO_SUMMARY", { bytes: 160_000, durationSec: 30 }, { chat: free, transcribe: entry({ kind: "transcribe" }) })).toBe(0n);
    expect(estimateCostMicro("IMAGE_FROM_PROMPT", { bytes: 0, prompt: "a lighthouse" }, { chat: free, image: entry({ kind: "image" }) })).toBe(0n);
  });

  it("pads by 15% and rounds a fractional micro-USD up", () => {
    // 150 overhead tokens × 1 micro, completion free. 150 × 1.15 = 172.5 → 173.
    const priced = entry({ promptAtto: ATTO_PER_MICRO, completionAtto: 0n });
    expect(estimateCostMicro("DOC_ANALYSIS", { bytes: 0, chars: 0 }, { chat: priced })).toBe(173n);
  });

  it("reports 1 micro-USD when the padded estimate is only a few atto-USD", () => {
    const dust = entry({ promptAtto: 1n, completionAtto: 0n });
    expect(estimateCostMicro("DOC_ANALYSIS", { bytes: 0, chars: 0 }, { chat: dust })).toBe(1n);
  });

  it("charges one more input token when the text crosses a 4-character boundary", () => {
    const priced = entry({ promptAtto: ATTO_PER_MICRO, completionAtto: 0n });
    // 4 chars = 1 token + 150 overhead = 151 × 1.15 = 173.65 → 174. 5 chars = 152 × 1.15 = 174.8 → 175.
    expect(estimateCostMicro("DOC_ANALYSIS", { bytes: 0, chars: 4 }, { chat: priced })).toBe(174n);
    expect(estimateCostMicro("DOC_ANALYSIS", { bytes: 0, chars: 5 }, { chat: priced })).toBe(175n);
  });

  it("prices an empty image idea as the per-image price plus the refine chat", () => {
    const image = entry({ kind: "image", imageAtto: 8_800_000_000_000_000n });
    // Chat prices are 0, so this is exactly 0.0088 × 1.15 = 10,120 micro-USD.
    expect(estimateCostMicro("IMAGE_FROM_PROMPT", { bytes: 0, prompt: "" }, { chat: entry({}), image })).toBe(10_120n);
  });

  it("adds input tokens when an image model charges per token instead of per image", () => {
    const image = entry({ kind: "image", promptAtto: ATTO_PER_MICRO, imageAtto: 0n });
    // Revised prompt is planned at 120 tokens × 1.15 = 138. The chat model is free.
    expect(estimateCostMicro("IMAGE_FROM_PROMPT", { bytes: 0, prompt: "x" }, { chat: entry({}), image })).toBe(138n);
  });

  it("does not return a negative cost for a negative character count", () => {
    const priced = entry({ promptAtto: ATTO_PER_MICRO, completionAtto: 0n });
    expect(estimateCostMicro("DOC_ANALYSIS", { bytes: 0, chars: -20 }, { chat: priced })).toBe(173n);
  });
});

describe("@shift/core export", () => {
  it("exposes the planner the optimizer imports", () => {
    expect(exportedEstimate).toBe(estimateCostMicro);
    expect(exportedDecision).toBe(estimateDecisionMicro);
    expect(exportedAssumptions.safetyPercent).toBe(ASSUMPTIONS.safetyPercent);
  });
});

describe("estimateDecisionMicro", () => {
  it("prices input tokens from the catalog and pads them", () => {
    // Vela's published rate is 0.00000004 USD/token = 4e10 atto. 1500 chars = 375 tokens.
    // 375 × 4e10 × 1.15 = 1.725e13 atto → 18 micro-USD.
    const vela = entry({ kind: "decision", promptAtto: 40_000_000_000n, completionAtto: 0n });
    expect(estimateDecisionMicro(vela, 1500)).toBe(18n);
    expect(estimateDecisionMicro(vela, 4)).toBe(1n);
    expect(estimateDecisionMicro(vela, 0)).toBe(0n);
  });

  it("costs nothing on a free decision model", () => {
    expect(estimateDecisionMicro(entry({ kind: "decision" }), 1500)).toBe(0n);
  });

  it("refuses a model that is not a decision model and a bad length", () => {
    expect(() => estimateDecisionMicro(entry({ kind: "chat", promptAtto: 1n }), 10)).toThrow(/decision model/);
    expect(() => estimateDecisionMicro(entry({ kind: "decision" }), Number.NaN)).toThrow(/non-negative/);
    expect(() => estimateDecisionMicro(entry({ kind: "decision" }), -1)).toThrow(/non-negative/);
  });
});
