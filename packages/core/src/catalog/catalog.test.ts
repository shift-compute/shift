import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import type { Model } from "../zg/schemas";
import { attoToMicroCeil, buildCatalog, candidates, trustOf, usdStringToAtto } from "./catalog";

describe("usdStringToAtto", () => {
  it("is exact for tiny per-token prices", () => {
    expect(usdStringToAtto("0.00000008")).toBe(80_000_000_000n);
    expect(usdStringToAtto("0.027")).toBe(27_000_000_000_000_000n);
    expect(usdStringToAtto("2")).toBe(2_000_000_000_000_000_000n);
  });

  it("treats missing or malformed prices as free instead of throwing", () => {
    expect(usdStringToAtto(undefined)).toBe(0n);
    expect(usdStringToAtto("abc")).toBe(0n);
    expect(usdStringToAtto("-1")).toBe(0n);
    expect(usdStringToAtto("")).toBe(0n);
    // A JS number this small stringifies in scientific notation, which is not a catalog price.
    expect(usdStringToAtto(0.00000008)).toBe(0n);
  });

  it("trims whitespace and keeps the first 18 fractional digits", () => {
    expect(usdStringToAtto(" 0.027 ")).toBe(27_000_000_000_000_000n);
    expect(usdStringToAtto("1.2345678901234567899")).toBe(1_234_567_890_123_456_789n);
  });
});

describe("attoToMicroCeil", () => {
  it("always rounds up", () => {
    expect(attoToMicroCeil(0n)).toBe(0n);
    expect(attoToMicroCeil(1n)).toBe(1n);
    expect(attoToMicroCeil(1_000_000_000_000n)).toBe(1n);
    expect(attoToMicroCeil(1_000_000_000_001n)).toBe(2n);
  });
});

describe("trustOf", () => {
  it("maps the Router's verifiability labels", () => {
    expect(trustOf("TeeML")).toBe("private");
    expect(trustOf("TeeTLS")).toBe("verified");
    expect(trustOf(undefined)).toBe("standard");
    expect(trustOf(null)).toBe("standard");
    expect(trustOf("TDX")).toBe("standard");
  });
});

const m = (over: Partial<Model> & Record<string, unknown>): Model => ({ id: "x", type: "chatbot", ...over }) as Model;

describe("buildCatalog", () => {
  it("normalizes chat, transcription, image and decision models and drops other types", () => {
    const catalog = buildCatalog([
      m({ id: "chat", verifiability: "TeeML", context_length: 1000, pricing_usd: { prompt: "0.000001", completion: "0.000002" } }),
      m({ id: "stt", type: "speech-to-text", verifiability: "TeeML", pricing_usd: { prompt: "0.00013", completion: "0" } }),
      m({ id: "img", type: "text-to-image", pricing_usd: { image: "0.0088" }, image_capabilities: { max_n: 2 } }),
      m({ id: "dec", type: "decisions", verifiability: "TeeML", pricing_usd: { prompt: "0", completion: "0" } }),
      m({ id: "vid", type: "video-generation" }),
      m({ id: "tts", type: "text-to-speech" }),
    ]);
    expect(catalog.map((e) => [e.id, e.kind, e.trust])).toEqual([
      ["chat", "chat", "private"],
      ["stt", "transcribe", "private"],
      ["img", "image", "standard"],
      ["dec", "decision", "private"],
    ]);
    expect(catalog[0]).toMatchObject({ contextLength: 1000, promptAtto: 1_000_000_000_000n, completionAtto: 2_000_000_000_000n });
    expect(catalog[2]).toMatchObject({ maxImages: 2, imageAtto: 8_800_000_000_000_000n });
  });

  it("filters candidates by trust mode, stricter models always qualify", () => {
    const catalog = buildCatalog([
      m({ id: "a", verifiability: "TeeML" }),
      m({ id: "b", verifiability: "TeeTLS" }),
      m({ id: "c" }),
    ]);
    expect(candidates(catalog, "chat", "private").map((e) => e.id)).toEqual(["a"]);
    expect(candidates(catalog, "chat", "verified").map((e) => e.id)).toEqual(["a", "b"]);
    expect(candidates(catalog, "chat", "standard").map((e) => e.id)).toEqual(["a", "b", "c"]);
  });

  it("accepts a catalog with no verifiability and no TeeML models", () => {
    const catalog = buildCatalog([
      m({ id: "plain-chat", pricing_usd: null, verifiability: null }),
      m({ id: "priced", pricing_usd: { prompt: "0.00000008", completion: "0.00000048" } }),
      m({ id: "embed", type: "embeddings" }),
    ]);
    expect(catalog.map((entry) => [entry.id, entry.trust, entry.promptAtto])).toEqual([
      ["plain-chat", "standard", 0n],
      ["priced", "standard", 80_000_000_000n],
    ]);
    expect(candidates(catalog, "chat", "private")).toEqual([]);
    expect(candidates(catalog, "decision", "private")).toEqual([]);
    expect(candidates(catalog, "transcribe", "private")).toEqual([]);
  });

  it("returns an empty catalog for an empty list", () => {
    expect(buildCatalog([])).toEqual([]);
  });

  it("handles the real catalog snapshot saved in Phase 0", () => {
    const file = path.resolve(__dirname, "../../../../docs/spike/models.json");
    const models = JSON.parse(readFileSync(file, "utf8")) as Model[];
    const catalog = buildCatalog(models);
    expect(catalog.length).toBeGreaterThan(50);
    expect(catalog.find((e) => e.id === "whisper-large-v3")).toMatchObject({ kind: "transcribe", trust: "private" });
    expect(catalog.find((e) => e.id === "z-image-turbo")).toMatchObject({ kind: "image", trust: "private" });
    expect(catalog.find((e) => e.id === "0gm-1.0-35b-a3b")?.completionAtto).toBe(480_000_000_000n);
  });
});
