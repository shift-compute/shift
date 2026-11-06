import { describe, expect, it, vi } from "vitest";
import { classificationSpendMicro as exportedSpend, pickDecisionModel as exportedPick } from "@shift/core";
import { ASSUMPTIONS, estimateDecisionMicro } from "../catalog/estimator";
import type { CatalogEntry } from "../catalog/catalog";
import { buildComplexityRequest, classificationSpendMicro, classifyComplexity, complexityState, MIN_QUALITY, pickDecisionModel, readComplexity, STATE_CHARS } from "./complexity";

const answers = (probabilities: Record<string, number> | undefined) => ({ answers: { complexity: { type: "choice", ...(probabilities ? { probabilities } : {}) } } });

describe("buildComplexityRequest", () => {
  it("uses the verified decisions schema and cuts the input", () => {
    const req = buildComplexityRequest("laya", "Summarize a document", "x".repeat(STATE_CHARS + 500));
    expect(req.model).toBe("laya");
    expect(req.state).toBe(complexityState("Summarize a document", "x".repeat(STATE_CHARS + 500)));
    expect(req.state.length).toBe("Summarize a document\n\n".length + STATE_CHARS);
    expect(req.questions["complexity"]).toEqual({
      type: "choice",
      instructions: "How much reasoning does this task need?",
      criteria: {
        simple: "a quick answer is enough",
        standard: "some reasoning is needed",
        complex: "deep multi-step reasoning is needed",
      },
    });
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

const decision = (id: string, trust: CatalogEntry["trust"], contextLength?: number, promptAtto = 0n): CatalogEntry => ({
  id,
  kind: "decision",
  trust,
  promptAtto,
  completionAtto: 0n,
  imageAtto: 0n,
  ...(contextLength !== undefined ? { contextLength } : {}),
});

/** Characters that tokenize to exactly `tokens` under the estimator's 4 characters per token. */
const charsFor = (tokens: number) => tokens * ASSUMPTIONS.charsPerToken;

describe("pickDecisionModel", () => {
  const laya = decision("laya", "private", 512);
  const vela = decision("vela-2.0-9b", "private", 16384);
  const catalog = [vela, laya];

  it("picks the smallest catalog context that holds the text, and never a hard-coded id", () => {
    expect(pickDecisionModel(catalog, charsFor(512))?.id).toBe("laya");
    expect(pickDecisionModel(catalog, charsFor(512) + 1)?.id).toBe("vela-2.0-9b");
    expect(pickDecisionModel([decision("short-dm", "private", 512), decision("long-dm", "private", 16384)], 100)?.id).toBe("short-dm");
  });

  it("uses the largest context when the text fits none, and an unsized model only when nothing is sized", () => {
    expect(pickDecisionModel(catalog, charsFor(20_000))?.id).toBe("vela-2.0-9b");
    expect(pickDecisionModel([decision("b-open", "private"), decision("a-open", "private")], 100)?.id).toBe("a-open");
  });

  it("prefers a private model, then verified, then any decision model", () => {
    const roomy = decision("roomy-standard", "standard", 100_000);
    expect(pickDecisionModel([laya, roomy], charsFor(1_000))?.id).toBe("laya");
    expect(pickDecisionModel([roomy, decision("attested", "verified", 16384)], 100)?.id).toBe("attested");
    expect(pickDecisionModel([roomy], 10)?.id).toBe("roomy-standard");
  });

  it("ignores other kinds and returns undefined without throwing when no decision model exists", () => {
    const chat: CatalogEntry = { id: "0gm-1.0-35b-a3b", kind: "chat", trust: "private", promptAtto: 1n, completionAtto: 1n, imageAtto: 0n, contextLength: 32000 };
    expect(pickDecisionModel([chat], 100)).toBeUndefined();
    expect(pickDecisionModel([], Number.NaN)).toBeUndefined();
    expect(pickDecisionModel(catalog, Number.NaN)?.id).toBe("laya");
    expect(exportedPick).toBe(pickDecisionModel);
  });
});

describe("classificationSpendMicro", () => {
  const priced = decision("vela-2.0-9b", "private", 16384, 40_000_000_000n);

  it("uses the reported step cost, otherwise the estimate of the state that was sent", () => {
    const stateChars = complexityState("DOC_ANALYSIS task", "x".repeat(STATE_CHARS + 20)).length;
    expect(classificationSpendMicro({ model: priced, stateChars, step: { costUsdMicro: "7" } })).toEqual({ micro: 7n, source: "reported" });
    expect(classificationSpendMicro({ model: priced, stateChars, step: { costUsdMicro: "0" } })).toEqual({ micro: 0n, source: "reported" });
    expect(classificationSpendMicro({ model: priced, stateChars })).toEqual({
      micro: estimateDecisionMicro(priced, stateChars),
      source: "estimate",
    });
  });

  it("spends nothing when there is no model and no reported cost", () => {
    expect(classificationSpendMicro({ stateChars: 1500 })).toEqual({ micro: 0n, source: "none" });
    const chat: CatalogEntry = { id: "chat", kind: "chat", trust: "private", promptAtto: 1n, completionAtto: 1n, imageAtto: 0n };
    expect(classificationSpendMicro({ model: chat, stateChars: 1500 })).toEqual({ micro: 0n, source: "none" });
    expect(exportedSpend).toBe(classificationSpendMicro);
  });
});
