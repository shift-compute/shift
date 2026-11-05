import { describe, expect, it, vi } from "vitest";
import { buildComplexityRequest, classifyComplexity, MIN_QUALITY, readComplexity, STATE_CHARS } from "./complexity";

const answers = (probabilities: Record<string, number> | undefined) => ({ answers: { complexity: { type: "choice", ...(probabilities ? { probabilities } : {}) } } });

describe("buildComplexityRequest", () => {
  it("uses the verified decisions schema and cuts the input", () => {
    const req = buildComplexityRequest("laya", "Summarize a document", "x".repeat(STATE_CHARS + 500));
    expect(req.model).toBe("laya");
    expect(req.state.length).toBe("Summarize a document\n\n".length + STATE_CHARS);
    expect(req.questions["complexity"]).toMatchObject({ type: "choice", criteria: { simple: expect.any(String), standard: expect.any(String), complex: expect.any(String) } });
  });
});

describe("readComplexity", () => {
  it("takes the most likely label when it is confident enough", () => {
    expect(readComplexity(answers({ simple: 0.1, standard: 0.2, complex: 0.7 }))).toEqual({ complexity: "complex", confidence: 0.7, fellBack: false });
  });

  it("falls back to standard below 0.5, keeping the confidence it saw", () => {
    expect(readComplexity(answers({ simple: 0.4, standard: 0.35, complex: 0.25 }))).toEqual({ complexity: "standard", confidence: 0.4, fellBack: true });
  });

  it("falls back to standard when the answer is missing or malformed", () => {
    expect(readComplexity(answers(undefined))).toEqual({ complexity: "standard", fellBack: true });
    expect(readComplexity({ answers: {} })).toEqual({ complexity: "standard", fellBack: true });
    expect(readComplexity(answers({ other: 0.9 }))).toEqual({ complexity: "standard", fellBack: true });
  });

  it("maps complexity to the minimum quality", () => {
    expect(MIN_QUALITY).toEqual({ simple: 1, standard: 2, complex: 3 });
  });
});

describe("classifyComplexity", () => {
  const base = { sk: "sk-x", model: "laya", trustMode: "private" as const, taskId: "t1", attempt: 1, description: "d", input: "i" };

  it("returns the verdict with the recorded step", async () => {
    const decide = vi.fn().mockResolvedValue({ data: { model: "laya", ...answers({ simple: 0.9, standard: 0.05, complex: 0.05 }) }, status: 200, requestId: "req-d" });
    const out = await classifyComplexity({ ...base, router: { decide } });
    expect(out).toMatchObject({ complexity: "simple", fellBack: false, step: { step: "classify", model: "laya", requestId: "req-d" } });
    expect(decide.mock.calls[0]![2]).toEqual({ trustMode: "private", clientRequestId: "t1-1-classify" });
  });

  it("never throws: a failed call means standard and no step", async () => {
    const decide = vi.fn().mockRejectedValue(new Error("503"));
    expect(await classifyComplexity({ ...base, router: { decide } })).toEqual({ complexity: "standard", fellBack: true });
  });
});
