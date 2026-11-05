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
