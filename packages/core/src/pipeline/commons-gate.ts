import type { CatalogEntry } from "../catalog/catalog";
import { ASSUMPTIONS, estimateDecisionMicro } from "../catalog/estimator";
import { recordStep } from "../executors/step";
import { msUntilHardStop } from "../night/schedule";
import { pickDecisionModel } from "../optimizer/complexity";
import { redactString } from "../redact";
import { RouterError } from "../zg/errors";
import type { DecisionsRequest, InferenceOptions, RouterResponse, TrustMode } from "../zg/router";
import type { DecisionsResponse } from "../zg/schemas";
import type { CommonsGateItem, CommonsStore } from "./commons";

/** Plan §9.4: one call, then at most two retries, and only when the failure was retryable. */
const MAX_RETRIES = 2;

/** Default for `COMMONS_GATE_THRESHOLD` when a caller does not pass one. Matches the env schema. */
export const DEFAULT_COMMONS_GATE_THRESHOLD = 0.75;

/** Verified choice question (plan §12.2). `criteria` is the label list Phase 0 accepted. */
export const GATE_INSTRUCTIONS = "Do translation A and translation B convey the same meaning as the source?";
export const GATE_CRITERIA = ["yes", "no"] as const;

const LABEL_SOURCE = "Source:\n";
const LABEL_A = "\n\nTranslation A:\n";
const LABEL_B = "\n\nTranslation B:\n";

/** The decide method tests inject. Production passes `router.decide`. */
export type CommonsDecide = (
  sk: string,
  body: DecisionsRequest,
  options?: InferenceOptions,
) => Promise<RouterResponse<DecisionsResponse>>;

/** What an accepted item stores on 0G Storage. Translation B stays on the row; the file keeps translation A. */
export interface CommonsOutput {
  source: string;
  translationA: string;
  models: { translationA: string; translationB: string; gate: string };
  requestIds: string[];
  probability: number;
}

export interface CommonsGateResult {
  accepted: number;
  rejected: number;
  /** Left RUNNING. Not an acceptance. */
  held: number;
  reportedMicro: bigint;
  accountedMicro: bigint;
  requestIds: string[];
  stop: "budget" | "no_model" | "hard_stop" | "balance" | "done";
}

interface Ledger {
  remaining: bigint;
  reportedMicro: bigint;
  accountedMicro: bigint;
  requestIds: string[];
}

/** State the decision model reads: the source and both translations, labeled so the question can name them. */
export function gateState(source: string, translationA: string, translationB: string): string {
  return `${LABEL_SOURCE}${source}${LABEL_A}${translationA}${LABEL_B}${translationB}`;
}

/** Characters the choice question adds next to the state, so the picked context can hold both. */
export function gateQuestionChars(): number {
  return GATE_INSTRUCTIONS.length + GATE_CRITERIA.join("").length;
}

export function buildGateRequest(model: string, state: string): DecisionsRequest {
  return {
    model,
    state,
    questions: {
      choice: {
        type: "choice",
        instructions: GATE_INSTRUCTIONS,
        criteria: [...GATE_CRITERIA],
      },
    },
  };
}

/** `P(yes)` from the verified answer shape. Missing or non-finite is not a probability. */
export function readYesProbability(response: Pick<DecisionsResponse, "answers">): number | undefined {
  const p = response.answers["choice"]?.probabilities?.["yes"];
  if (typeof p !== "number" || !Number.isFinite(p)) return undefined;
  return p;
}

/**
 * Decision model for one commons item (plan §12.2 step 3).
 * The id comes from {@link pickDecisionModel}: strictest trust tier, then the smallest context that can hold the
 * state plus the question (a Laya-sized model when the text fits, otherwise a larger one such as Vela). No id is
 * hard-coded. The returned state is shortened so it fits that context. Undefined when the catalog has no decision model.
 */
export function pickGateModel(
  catalog: readonly CatalogEntry[],
  source: string,
  translationA: string,
  translationB: string,
): { model: CatalogEntry; state: string } | undefined {
  const full = gateState(source, translationA, translationB);
  const model = pickDecisionModel(catalog, full.length + gateQuestionChars());
  if (!model) return undefined;
  const budget = model.contextLength === undefined ? full.length : Math.max(0, model.contextLength * ASSUMPTIONS.charsPerToken - gateQuestionChars());
  return { model, state: fitState(source, translationA, translationB, budget) };
}

export function commonsOutput(item: CommonsGateItem, gateModel: string, requestIds: string[], probability: number): CommonsOutput {
  return {
    source: item.sourceText,
    translationA: item.translationA,
    models: { translationA: item.modelA, translationB: item.modelB, gate: gateModel },
    requestIds,
    probability,
  };
}

/**
 * Quality gate for this donor's RUNNING commons rows (plan §12.2 steps 3–5).
 * Accepts translation A when `P(yes)` is at least `threshold` and uploads the CommonsOutput JSON. A lower probability
 * is `REJECTED` and stays on the row. No decision model, a missing `P(yes)`, or a failed upload leaves the row
 * `RUNNING`: those are not acceptances. The Router's reported cost is what the donation tally adds.
 * This function does not call `recordDonations`.
 */
export async function runCommonsQualityGate(input: {
  commons: CommonsStore;
  decide: CommonsDecide;
  upload: (bytes: Uint8Array) => Promise<{ rootHash: string }>;
  sk: string;
  catalog: CatalogEntry[];
  remainingMicro: bigint;
  userId: string;
  threshold: number;
  hardStopUtc: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<CommonsGateResult> {
  const now = input.now ?? (() => new Date());
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const log = input.log ?? (() => undefined);
  const threshold = normalizeThreshold(input.threshold);
  const ledger: Ledger = {
    remaining: input.remainingMicro > 0n ? input.remainingMicro : 0n,
    reportedMicro: 0n,
    accountedMicro: 0n,
    requestIds: [],
  };
  const items = [...(await input.commons.runningItems(input.userId))].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (items.length === 0) return result(ledger, 0, 0, 0, "done");
  if (!pickDecisionModel(input.catalog, 0)) {
    log(`commons gate: no decision model in the catalog; ${items.length} item(s) stay RUNNING`);
    return result(ledger, 0, 0, items.length, "no_model");
  }

  let accepted = 0;
  let rejected = 0;
  let held = 0;
  for (let index = 0; index < items.length; index++) {
    const item = items[index];
    if (!item) break;
    if (msUntilHardStop(now(), input.hardStopUtc) === 0) {
      log(`commons ${item.id}: hard stop before the quality gate`);
      return result(ledger, accepted, rejected, held + (items.length - index), "hard_stop");
    }
    const outcome = await gateItem({ ...input, sleep, log, threshold, ledger, item });
    if (outcome === "budget" || outcome === "balance") {
      return result(ledger, accepted, rejected, held + (items.length - index), outcome);
    }
    if (outcome === "accepted") accepted += 1;
    else if (outcome === "rejected") rejected += 1;
    else held += 1;
  }
  return result(ledger, accepted, rejected, held, "done");
}

function result(ledger: Ledger, accepted: number, rejected: number, held: number, stop: CommonsGateResult["stop"]): CommonsGateResult {
  return {
    accepted,
    rejected,
    held,
    reportedMicro: ledger.reportedMicro,
    accountedMicro: ledger.accountedMicro,
    requestIds: ledger.requestIds,
    stop,
  };
}

async function gateItem(input: {
  commons: CommonsStore;
  decide: CommonsDecide;
  upload: (bytes: Uint8Array) => Promise<{ rootHash: string }>;
  sk: string;
  catalog: CatalogEntry[];
  threshold: number;
  ledger: Ledger;
  item: CommonsGateItem;
  sleep: (ms: number) => Promise<void>;
  log: (message: string) => void;
}): Promise<"accepted" | "rejected" | "held" | "budget" | "balance"> {
  const item = input.item;
  const known = item.gateProbability;
  if (typeof known === "number" && Number.isFinite(known) && item.gateModel) {
    if (known < input.threshold) {
      await input.commons.save(item.id, { status: "REJECTED", gateModel: item.gateModel, gateProbability: known });
      input.log(`commons ${item.id}: rejected (P(yes)=${known})`);
      return "rejected";
    }
    return finishAccepted(input, known, item.requestIds, item.gateModel, undefined);
  }

  const picked = pickGateModel(input.catalog, item.sourceText, item.translationA, item.translationB);
  if (!picked || picked.state.length === 0) {
    input.log(`commons ${item.id}: no decision model can hold this item; it stays RUNNING`);
    return "held";
  }
  const estimate = estimateDecisionMicro(picked.model, picked.state.length + gateQuestionChars());
  if (estimate > input.ledger.remaining) {
    input.log(`commons ${item.id}: quality gate does not fit the remaining budget`);
    return "budget";
  }

  const call = await ask(input, picked.model, picked.state);
  if (!call.ok) {
    if (call.requestId !== undefined) {
      apply(input.ledger, call.reported, estimate, call.requestId);
      await input.commons.save(item.id, {
        status: "RUNNING",
        gateModel: picked.model.id,
        requestIds: withId(item.requestIds, call.requestId),
        costUsdMicro: addCost(item.costUsdMicro, call.reported),
      });
    }
    input.log(`commons ${item.id}: quality gate failed (${failureText(call.error)}); it stays RUNNING`);
    return call.stop ? "balance" : "held";
  }

  apply(input.ledger, call.reported, estimate, call.requestId);
  const requestIds = withId(item.requestIds, call.requestId);
  const costUsdMicro = addCost(item.costUsdMicro, call.reported);
  if (call.probability === undefined) {
    await input.commons.save(item.id, { status: "RUNNING", gateModel: picked.model.id, requestIds, costUsdMicro });
    input.log(`commons ${item.id}: decision model returned no P(yes); it stays RUNNING`);
    return "held";
  }
  if (call.probability < input.threshold) {
    await input.commons.save(item.id, {
      status: "REJECTED",
      gateModel: picked.model.id,
      gateProbability: call.probability,
      requestIds,
      costUsdMicro,
    });
    input.log(`commons ${item.id}: rejected (P(yes)=${call.probability})`);
    return "rejected";
  }
  return finishAccepted(input, call.probability, requestIds, picked.model.id, costUsdMicro);
}

async function finishAccepted(
  input: {
    commons: CommonsStore;
    upload: (bytes: Uint8Array) => Promise<{ rootHash: string }>;
    item: CommonsGateItem;
    log: (message: string) => void;
  },
  probability: number,
  requestIds: string[],
  gateModel: string,
  costUsdMicro: bigint | null | undefined,
): Promise<"accepted" | "held"> {
  const root = await uploadOutput(input, gateModel, requestIds, probability);
  const patch = {
    gateModel,
    gateProbability: probability,
    requestIds,
    ...(costUsdMicro !== undefined ? { costUsdMicro } : {}),
  };
  if (!root) {
    await input.commons.save(input.item.id, { status: "RUNNING", ...patch });
    return "held";
  }
  await input.commons.save(input.item.id, { status: "ACCEPTED", outputRoot: root, ...patch });
  input.log(`commons ${input.item.id}: accepted (P(yes)=${probability})`);
  return "accepted";
}

async function uploadOutput(
  input: { upload: (bytes: Uint8Array) => Promise<{ rootHash: string }>; item: CommonsGateItem; log: (message: string) => void },
  gateModel: string,
  requestIds: string[],
  probability: number,
): Promise<string | undefined> {
  const bytes = new TextEncoder().encode(JSON.stringify(commonsOutput(input.item, gateModel, requestIds, probability)));
  try {
    const stored = await input.upload(bytes);
    if (stored.rootHash.length === 0) {
      input.log(`commons ${input.item.id}: upload returned an empty root; it stays RUNNING`);
      return undefined;
    }
    return stored.rootHash;
  } catch (err) {
    input.log(`commons ${input.item.id}: upload failed (${failureText(err)}); it stays RUNNING`);
    return undefined;
  }
}

async function ask(
  input: { decide: CommonsDecide; sk: string; item: CommonsGateItem; sleep: (ms: number) => Promise<void> },
  model: CatalogEntry,
  state: string,
): Promise<
  | { ok: true; requestId?: string; reported?: bigint; probability: number | undefined }
  | { ok: false; requestId?: string; reported?: bigint; error: unknown; stop: boolean }
> {
  let last: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await input.decide(input.sk, buildGateRequest(model.id, state), {
        trustMode: model.trust as TrustMode,
        clientRequestId: `${input.item.id}-${attempt}-gate`,
      });
      const step = recordStep("gate", model.id, res, model.trust as TrustMode);
      const reported = parseReported(step.costUsdMicro);
      return {
        ok: true,
        ...(step.requestId ? { requestId: step.requestId } : {}),
        ...(reported !== undefined ? { reported } : {}),
        probability: readYesProbability(res.data),
      };
    } catch (err) {
      last = err;
      const requestId = err instanceof RouterError ? err.requestId : undefined;
      const stop = stopsTheNight(err);
      if (stop || !(err instanceof RouterError) || !err.retryable || attempt === MAX_RETRIES) {
        return { ok: false, ...(requestId ? { requestId } : {}), error: err, stop };
      }
      await input.sleep(err.retryAfterMs ?? 1000 * (attempt + 1));
    }
  }
  return { ok: false, error: last ?? new Error("The quality gate was not attempted."), stop: false };
}

function fitState(source: string, translationA: string, translationB: string, maxChars: number): string {
  const full = gateState(source, translationA, translationB);
  if (maxChars >= full.length) return full;
  if (maxChars <= 0) return "";
  const labels = LABEL_SOURCE.length + LABEL_A.length + LABEL_B.length;
  if (maxChars <= labels) return full.slice(0, maxChars);
  const room = maxChars - labels;
  const third = Math.floor(room / 3);
  const extra = room - third * 3;
  const text = `${LABEL_SOURCE}${source.slice(0, third + extra)}${LABEL_A}${translationA.slice(0, third)}${LABEL_B}${translationB.slice(0, third)}`;
  return text.length <= maxChars ? text : text.slice(0, maxChars);
}

function apply(ledger: Ledger, reported: bigint | undefined, estimate: bigint, requestId: string | undefined): void {
  if (requestId) ledger.requestIds.push(requestId);
  const used = reported !== undefined ? reported : estimate > 0n ? estimate : 0n;
  if (reported !== undefined) ledger.reportedMicro += reported;
  ledger.accountedMicro += used;
  ledger.remaining = ledger.remaining > used ? ledger.remaining - used : 0n;
}

function addCost(existing: bigint | null, reported: bigint | undefined): bigint | null {
  if (reported === undefined) return existing;
  return (existing ?? 0n) + reported;
}

function withId(ids: string[], requestId: string | undefined): string[] {
  if (!requestId || ids.includes(requestId)) return ids;
  return [...ids, requestId];
}

function parseReported(cost: string | undefined): bigint | undefined {
  if (cost === undefined || !/^\d+$/.test(cost)) return undefined;
  return BigInt(cost);
}

function normalizeThreshold(value: number): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) return DEFAULT_COMMONS_GATE_THRESHOLD;
  return value;
}

function stopsTheNight(err: unknown): boolean {
  return err instanceof RouterError && (err.action === "stop_user_batch" || err.action === "end_budget");
}

function failureText(err: unknown): string {
  const base = redactString(err instanceof Error ? err.message : "Unknown error");
  const id = err instanceof RouterError ? err.requestId : undefined;
  return (id ? `${base} (request ${id})` : base).slice(0, 500);
}
