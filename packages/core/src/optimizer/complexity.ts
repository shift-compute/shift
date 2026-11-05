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

export function buildComplexityRequest(model: string, description: string, input: string): DecisionsRequest {
  const state = `${description}\n\n${input.slice(0, STATE_CHARS)}`.trim();
  return { model, state, questions: { complexity: { ...QUESTION, criteria: { ...QUESTION.criteria } } } };
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
