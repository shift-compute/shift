import type { CatalogEntry, TrustLevel } from "../catalog/catalog";
import { ASSUMPTIONS, estimateDecisionMicro } from "../catalog/estimator";
import { recordStep } from "../executors/step";
import type { StepRecord } from "../executors/types";
import type { DecisionsRequest, RouterClient, TrustMode } from "../zg/router";
import type { DecisionsResponse } from "../zg/schemas";

export type Complexity = "simple" | "standard" | "complex";

/** Minimum model quality each complexity asks for (plan §10.2). */
export const MIN_QUALITY: Record<Complexity, 1 | 2 | 3> = { simple: 1, standard: 2, complex: 3 };

/** Below this top probability the decision model is unsure, so we plan for the middle case. */
export const MIN_CONFIDENCE = 0.5;

/** Characters of the input shown to the decision model. Laya reads about 512 tokens, Vela far more. */
export const STATE_CHARS = 1500;

const QUESTION = {
  type: "choice",
  instructions: "How much reasoning does this task need?",
  criteria: {
    simple: "a quick answer is enough",
    standard: "some reasoning is needed",
    complex: "deep multi-step reasoning is needed",
  },
} as const;

/** State sent to the decision model: a short description plus the first {@link STATE_CHARS} characters of the input. */
export function complexityState(description: string, input: string): string {
  return `${description}\n\n${input.slice(0, STATE_CHARS)}`.trim();
}

export function buildComplexityRequest(model: string, description: string, input: string): DecisionsRequest {
  return {
    model,
    state: complexityState(description, input),
    questions: { complexity: { ...QUESTION, criteria: { ...QUESTION.criteria } } },
  };
}

export interface ComplexityVerdict {
  complexity: Complexity;
  /** Probability of the chosen label, or undefined when the model gave none. */
  confidence?: number;
  /** True when the answer was unusable or too uncertain and the middle case was used instead. */
  fellBack: boolean;
}

/** Reads the answer and applies the confidence rule. Never throws: a bad answer just means "standard". */
export function readComplexity(response: Pick<DecisionsResponse, "answers">): ComplexityVerdict {
  const answer = response.answers["complexity"];
  const probabilities = answer?.probabilities;
  if (!probabilities) return { complexity: "standard", fellBack: true };

  let best: Complexity | undefined;
  let bestP = -1;
  for (const label of ["simple", "standard", "complex"] as const) {
    const p = probabilities[label];
    if (typeof p === "number" && p > bestP) {
      best = label;
      bestP = p;
    }
  }
  if (!best || bestP < MIN_CONFIDENCE) return { complexity: "standard", ...(best ? { confidence: bestP } : {}), fellBack: true };
  return { complexity: best, confidence: bestP, fellBack: false };
}

export interface ClassifyInput {
  router: Pick<RouterClient, "decide">;
  sk: string;
  /** Decision model id from the catalog (Laya for short inputs, Vela for longer ones). */
  model: string;
  trustMode: TrustMode;
  taskId: string;
  attempt: number;
  description: string;
  input: string;
}

export interface Classification extends ComplexityVerdict {
  /** Evidence of the call, absent when it failed. Its cost comes out of the night's budget. */
  step?: StepRecord;
}

/**
 * One real `/v1/decisions` call. If it fails for any reason the task is planned as "standard": the classifier only
 * decides how much to spend, so it must never be the reason a task is lost.
 */
export async function classifyComplexity(i: ClassifyInput): Promise<Classification> {
  try {
    const res = await i.router.decide(i.sk, buildComplexityRequest(i.model, i.description, i.input), {
      trustMode: i.trustMode,
      clientRequestId: `${i.taskId}-${i.attempt}-classify`,
    });
    return { ...readComplexity(res.data), step: recordStep("classify", i.model, res) };
  } catch {
    return { complexity: "standard", fellBack: true };
  }
}

/** Strictest trust first. A TeeML model is preferred; a verified one is next; an ordinary catalog model is last. */
const DECISION_TRUST: readonly TrustLevel[] = ["private", "verified", "standard"];

function textTokens(textChars: number): number {
  if (!Number.isFinite(textChars) || textChars <= 0) return 0;
  return Math.ceil(textChars / ASSUMPTIONS.charsPerToken);
}

function pickInTier(models: CatalogEntry[], tokens: number): CatalogEntry | undefined {
  if (models.length === 0) return undefined;
  const byId = models.slice().sort((a, b) => a.id.localeCompare(b.id));
  const sized = byId.filter((model) => model.contextLength !== undefined);
  const fitting = sized
    .filter((model) => (model.contextLength ?? 0) >= tokens)
    .sort((a, b) => (a.contextLength ?? 0) - (b.contextLength ?? 0) || a.id.localeCompare(b.id));
  if (fitting[0]) return fitting[0];
  const largest = sized
    .slice()
    .sort((a, b) => (b.contextLength ?? 0) - (a.contextLength ?? 0) || a.id.localeCompare(b.id))[0];
  return largest ?? byId[0];
}

/**
 * Decision model for one text task (plan §10.2).
 * The id always comes from `catalog`. Private (TeeML) models are used when any exist; otherwise the strictest
 * tier that does (verified, then standard). Inside that tier the smallest context that can hold `textChars`
 * wins — Laya's published context is 512 tokens, Vela's is far larger — and if none can, the largest context.
 * A model with no published context is used only when the tier has no sized model.
 * Returns undefined when the catalog has no decision model: the caller plans `standard` and does not call the Router.
 */
export function pickDecisionModel(catalog: readonly CatalogEntry[], textChars: number): CatalogEntry | undefined {
  const tokens = textTokens(textChars);
  for (const trust of DECISION_TRUST) {
    const picked = pickInTier(
      catalog.filter((entry) => entry.kind === "decision" && entry.trust === trust),
      tokens,
    );
    if (picked) return picked;
  }
  return undefined;
}

export interface ClassificationSpend {
  /** Micro-USD to take out of the night budget for this classification. */
  micro: bigint;
  /** `reported` is the Router's figure; `estimate` is {@link estimateDecisionMicro}; `none` was not priced. */
  source: "reported" | "estimate" | "none";
}

/**
 * What one classification costs the night (plan §10.2).
 * The Router's reported cost wins. Otherwise the catalog estimate of the state that was sent.
 * No model and no reported cost is zero: nothing was called, so nothing is spent.
 */
export function classificationSpendMicro(input: {
  model?: CatalogEntry;
  /** Length of {@link complexityState}, the text the decision call actually carries. */
  stateChars: number;
  step?: Pick<StepRecord, "costUsdMicro">;
}): ClassificationSpend {
  const reported = input.step?.costUsdMicro;
  if (reported !== undefined && /^\d+$/.test(reported)) return { micro: BigInt(reported), source: "reported" };
  if (!input.model || input.model.kind !== "decision") return { micro: 0n, source: "none" };
  const chars = Number.isFinite(input.stateChars) && input.stateChars > 0 ? input.stateChars : 0;
  return { micro: estimateDecisionMicro(input.model, chars), source: "estimate" };
}
