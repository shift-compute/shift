import { candidates, type CatalogEntry } from "../catalog/catalog";
import { estimateTranslationMicro } from "../catalog/estimator";
import { maxTokensCostMicro, translationMaxTokens } from "../executors/chat-limits";
import { chatText } from "../executors/json-output";
import { recordStep } from "../executors/step";
import { msUntilHardStop } from "../night/schedule";
import { chatQuality } from "../optimizer/quality";
import { redactString } from "../redact";
import { RouterError } from "../zg/errors";
import type { ChatRequest, ChatResponse, InferenceOptions, RouterResponse, TrustMode } from "../zg/router";

/** The chat method tests inject. Production passes `router.chat`. */
export type CommonsChat = (sk: string, body: ChatRequest, options?: InferenceOptions) => Promise<RouterResponse<ChatResponse>>;

/** Plan §9.4: one call, then at most two retries, and only when the failure was retryable. */
const MAX_RETRIES = 2;
/**
 * Two commons pairs in a row whose model text is empty stop the loop.
 * Each billed pair is still recorded. Items not started stay PENDING. This is not a retry.
 */
export const EMPTY_ANSWER_STOP = 2;
const EMPTY_ANSWER = "The model returned an empty answer.";

/**
 * Target language stored on `CommonsItem.targetLang`. The name is what the prompt says.
 * Anything else is left PENDING and is not billed.
 */
export const TRANSLATION_LANGUAGES = {
  hi: "Hindi",
  mr: "Marathi",
} as const;

export type CommonsTargetLang = keyof typeof TRANSLATION_LANGUAGES;

/** Appendix B. The language name is "Hindi" or "Marathi". */
export function translationSystemPrompt(languageName: string): string {
  return `Translate the text from English to ${languageName}. Keep technical terms (Ethereum, smart contract, gas, wallet) in their common usage. Respond ONLY with the translation.`;
}

export interface CommonsItemRef {
  id: string;
  sourceText: string;
  targetLang: string;
}

/**
 * Fields written on a commons row.
 * `RUNNING` means both translations are stored and the quality gate has not accepted or rejected the item.
 * The gate sets `ACCEPTED` or `REJECTED`. `FAILED` means the pair did not finish; a billed call is not put back on the queue.
 * `PENDING` releases a claim when nothing was billed.
 */
export interface CommonsTranslationPatch {
  status: "PENDING" | "RUNNING" | "FAILED" | "ACCEPTED" | "REJECTED";
  translationA?: string | null;
  translationB?: string | null;
  modelA?: string | null;
  modelB?: string | null;
  requestIds?: string[];
  costUsdMicro?: bigint | null;
  donorUserId?: string | null;
  nightId?: bigint | null;
  gateModel?: string | null;
  gateProbability?: number | null;
  outputRoot?: string | null;
}

/** A RUNNING row that already has both translations, ready for the quality gate. */
export interface CommonsGateItem {
  id: string;
  sourceText: string;
  translationA: string;
  translationB: string;
  modelA: string;
  modelB: string;
  requestIds: string[];
  costUsdMicro: bigint | null;
  /** Set when an earlier pass scored the item and the upload did not finish. */
  gateModel: string | null;
  gateProbability: number | null;
}

export interface CommonsStore {
  /** PENDING items in a stable order (id ascending). A snapshot: the loop does not re-read the queue. */
  pendingItems(): Promise<CommonsItemRef[]>;
  /** PENDING → RUNNING for this donor. False when another run already took the row. */
  claim(id: string, donor: { userId: string; nightId: bigint }): Promise<boolean>;
  /**
   * This donor's RUNNING rows that already have both translations and both model ids.
   * Includes an earlier night: a pair left RUNNING (no decision model, or the upload failed) is finished
   * before a new pair is started. Ordered by id.
   */
  runningItems(userId: string): Promise<CommonsGateItem[]>;
  save(id: string, patch: CommonsTranslationPatch): Promise<void>;
}

export interface TranslationPair {
  modelA: CatalogEntry;
  modelB: CatalogEntry;
}

export interface CommonsTranslationResult {
  translated: number;
  failed: number;
  reportedMicro: bigint;
  accountedMicro: bigint;
  requestIds: string[];
  stop: "budget" | "no_model" | "hard_stop" | "balance" | "empty_answer" | "done";
}

interface TranslationCall {
  text: string;
  requestId?: string;
  reportedMicro?: bigint;
  /** Set when the call failed before a request id existed. Counted so a billed failure is not zero. */
  worstCaseMicro?: bigint;
  estimateMicro: bigint;
}

interface Ledger {
  remaining: bigint;
  reportedMicro: bigint;
  accountedMicro: bigint;
  requestIds: string[];
}

/**
 * Two distinct private chat models from the catalog.
 * A is the one a later gate would keep: higher chat quality, then the cheaper price, then the id.
 * Model ids are copied from the catalog. None are hard-coded here.
 *
 * Fewer than two private chats returns undefined. The night key is pinned to `private`, so a standard
 * or verified model is not a stand-in: the Router answers 503 instead of downgrading (plan §7.4).
 */
export function pickTranslationModels(catalog: CatalogEntry[]): TranslationPair | undefined {
  const seen = new Set<string>();
  const privateChats: CatalogEntry[] = [];
  for (const model of candidates(catalog, "chat", "private")) {
    if (seen.has(model.id)) continue;
    seen.add(model.id);
    privateChats.push(model);
  }
  if (privateChats.length < 2) return undefined;
  const ranked = [...privateChats].sort((a, b) => {
    const quality = chatQuality(b.id) - chatQuality(a.id);
    if (quality !== 0) return quality;
    const priceA = a.promptAtto + a.completionAtto;
    const priceB = b.promptAtto + b.completionAtto;
    if (priceA < priceB) return -1;
    if (priceA > priceB) return 1;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const modelA = ranked[0];
  const modelB = ranked[1];
  if (!modelA || !modelB || modelA.id === modelB.id) return undefined;
  return { modelA, modelB };
}

export async function runCommonsTranslations(input: {
  commons: CommonsStore;
  chat: CommonsChat;
  sk: string;
  catalog: CatalogEntry[];
  remainingMicro: bigint;
  userId: string;
  nightId: bigint;
  hardStopUtc: string;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  log?: (message: string) => void;
}): Promise<CommonsTranslationResult> {
  const now = input.now ?? (() => new Date());
  const sleep = input.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const log = input.log ?? (() => undefined);
  const pair = pickTranslationModels(input.catalog);
  const ledger: Ledger = {
    remaining: input.remainingMicro > 0n ? input.remainingMicro : 0n,
    reportedMicro: 0n,
    accountedMicro: 0n,
    requestIds: [],
  };
  if (!pair) return result(ledger, 0, 0, "no_model");
  if (ledger.remaining <= 0n) return result(ledger, 0, 0, "budget");

  const items = [...(await input.commons.pendingItems())].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  let translated = 0;
  let failed = 0;
  let emptyStreak = 0;
  for (const item of items) {
    if (msUntilHardStop(now(), input.hardStopUtc) === 0) return result(ledger, translated, failed, "hard_stop");
    const language = TRANSLATION_LANGUAGES[item.targetLang as CommonsTargetLang];
    if (!language || item.sourceText.trim().length === 0) continue;
    const promptChars = translationSystemPrompt(language).length;
    let pairCost: bigint;
    try {
      pairCost =
        estimateTranslationMicro(pair.modelA, item.sourceText.length, promptChars) +
        estimateTranslationMicro(pair.modelB, item.sourceText.length, promptChars);
    } catch (err) {
      log(`commons ${item.id}: skipped (${redactString(err instanceof Error ? err.message : "estimate failed")})`);
      continue;
    }
    if (pairCost > ledger.remaining) return result(ledger, translated, failed, "budget");

    const claimed = await input.commons.claim(item.id, { userId: input.userId, nightId: input.nightId });
    if (!claimed) continue;

    const outcome = await translatePair({
      commons: input.commons,
      chat: input.chat,
      sk: input.sk,
      item,
      language,
      promptChars,
      pair,
      ledger,
      userId: input.userId,
      nightId: input.nightId,
      sleep,
      log,
    });
    if (outcome === "done") {
      emptyStreak = 0;
      translated += 1;
    } else if (outcome === "empty") {
      failed += 1;
      emptyStreak += 1;
      if (emptyStreak >= EMPTY_ANSWER_STOP) {
        log(`commons: stopping after ${emptyStreak} empty answers; later items stay pending`);
        return result(ledger, translated, failed, "empty_answer");
      }
    } else if (outcome === "failed" || outcome === "budget" || outcome === "balance") {
      emptyStreak = 0;
      failed += 1;
    } else {
      emptyStreak = 0;
    }
    if (outcome === "budget") return result(ledger, translated, failed, "budget");
    if (outcome === "balance") return result(ledger, translated, failed, "balance");
  }
  return result(ledger, translated, failed, "done");
}

function result(ledger: Ledger, translated: number, failed: number, stop: CommonsTranslationResult["stop"]): CommonsTranslationResult {
  return {
    translated,
    failed,
    reportedMicro: ledger.reportedMicro,
    accountedMicro: ledger.accountedMicro,
    requestIds: ledger.requestIds,
    stop,
  };
}

async function translatePair(input: {
  commons: CommonsStore;
  chat: CommonsChat;
  sk: string;
  item: CommonsItemRef;
  language: string;
  promptChars: number;
  pair: TranslationPair;
  ledger: Ledger;
  userId: string;
  nightId: bigint;
  sleep: (ms: number) => Promise<void>;
  log: (message: string) => void;
}): Promise<"done" | "failed" | "released" | "empty" | "budget" | "balance"> {
  const calls: TranslationCall[] = [];
  const sideA = await translateSide(input, input.pair.modelA, "a");
  if (!sideA.ok) return finishFailed(input, calls, sideA.call, sideA.error);
  calls.push(sideA.call);
  applyCall(input.ledger, sideA.call);

  const bEstimate = estimateTranslationMicro(input.pair.modelB, input.item.sourceText.length, input.promptChars);
  if (bEstimate > input.ledger.remaining) {
    await persist(input, calls, "FAILED");
    input.log(`commons ${input.item.id}: translation B does not fit the remaining budget`);
    return "budget";
  }

  const sideB = await translateSide(input, input.pair.modelB, "b");
  if (!sideB.ok) return finishFailed(input, calls, sideB.call, sideB.error);
  calls.push(sideB.call);
  applyCall(input.ledger, sideB.call);
  await persist(input, calls, "RUNNING");
  return "done";
}

async function finishFailed(
  input: { commons: CommonsStore; item: CommonsItemRef; pair: TranslationPair; ledger: Ledger; userId: string; nightId: bigint; log: (message: string) => void },
  calls: TranslationCall[],
  failedCall: TranslationCall,
  error: unknown,
): Promise<"failed" | "released" | "empty" | "balance"> {
  const stop = stopsTheNight(error);
  const empty = isEmptyAnswer(error);
  if (billed(failedCall)) {
    calls.push(failedCall);
    applyCall(input.ledger, failedCall);
  }
  if (calls.length === 0) {
    await input.commons.save(input.item.id, { status: "PENDING", donorUserId: null, nightId: null });
    input.log(`commons ${input.item.id}: released (${failureText(error)})`);
    return stop ? "balance" : empty ? "empty" : "released";
  }
  await persist(input, calls, "FAILED");
  input.log(`commons ${input.item.id}: pair failed (${failureText(error)})`);
  return stop ? "balance" : empty ? "empty" : "failed";
}

async function translateSide(
  input: {
    chat: CommonsChat;
    sk: string;
    item: CommonsItemRef;
    language: string;
    promptChars: number;
    sleep: (ms: number) => Promise<void>;
  },
  model: CatalogEntry,
  side: "a" | "b",
): Promise<{ ok: true; call: TranslationCall } | { ok: false; call: TranslationCall; error: unknown }> {
  const estimateMicro = estimateTranslationMicro(model, input.item.sourceText.length, input.promptChars);
  let last: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await input.chat(
        input.sk,
        {
          model: model.id,
          max_tokens: translationMaxTokens(input.item.sourceText.length),
          messages: [
            { role: "system", content: translationSystemPrompt(input.language) },
            { role: "user", content: input.item.sourceText },
          ],
        },
        { trustMode: model.trust as TrustMode, clientRequestId: `${input.item.id}-${attempt}-translate-${side}` },
      );
      const step = recordStep(`translate-${side}`, model.id, res, model.trust as TrustMode);
      const call: TranslationCall = {
        text: "",
        estimateMicro,
        ...(step.requestId ? { requestId: step.requestId } : {}),
        ...reportedField(step.costUsdMicro),
      };
      try {
        const text = chatText(res.data).trim();
        if (text.length === 0) return { ok: false, call, error: new Error(EMPTY_ANSWER) };
        return { ok: true, call: { ...call, text } };
      } catch (err) {
        return { ok: false, call, error: err };
      }
    } catch (err) {
      last = err;
      const requestId = err instanceof RouterError ? err.requestId : undefined;
      if (stopsTheNight(err) || !(err instanceof RouterError) || !err.retryable || attempt === MAX_RETRIES) {
        const worstCaseMicro = requestId ? undefined : maxTokensCostMicro(translationMaxTokens(input.item.sourceText.length), model.completionAtto);
        return {
          ok: false,
          call: {
            text: "",
            estimateMicro,
            ...(requestId ? { requestId } : {}),
            ...(worstCaseMicro !== undefined && worstCaseMicro > 0n ? { worstCaseMicro } : {}),
          },
          error: err,
        };
      }
      await input.sleep(err.retryAfterMs ?? 1000 * (attempt + 1));
    }
  }
  return { ok: false, call: { text: "", estimateMicro }, error: last ?? new Error("The translation was not attempted.") };
}

async function persist(
  input: { commons: CommonsStore; item: CommonsItemRef; pair: TranslationPair; userId: string; nightId: bigint },
  calls: TranslationCall[],
  status: "RUNNING" | "FAILED",
): Promise<void> {
  const [first, second] = calls;
  const requestIds = calls.flatMap((call) => (call.requestId ? [call.requestId] : []));
  await input.commons.save(input.item.id, {
    status,
    donorUserId: input.userId,
    nightId: input.nightId,
    ...(first?.text ? { translationA: first.text, modelA: input.pair.modelA.id } : first ? { modelA: input.pair.modelA.id } : {}),
    ...(second?.text ? { translationB: second.text, modelB: input.pair.modelB.id } : second ? { modelB: input.pair.modelB.id } : {}),
    requestIds,
    costUsdMicro: reportedSum(calls),
  });
}

function applyCall(ledger: Ledger, call: TranslationCall): void {
  if (call.requestId) ledger.requestIds.push(call.requestId);
  const worst = call.worstCaseMicro !== undefined && call.worstCaseMicro > 0n ? call.worstCaseMicro : undefined;
  const used = call.reportedMicro !== undefined ? call.reportedMicro : worst !== undefined ? worst : call.estimateMicro > 0n ? call.estimateMicro : 0n;
  if (call.reportedMicro !== undefined) ledger.reportedMicro += call.reportedMicro;
  else if (worst !== undefined) ledger.reportedMicro += worst;
  ledger.accountedMicro += used;
  ledger.remaining = ledger.remaining > used ? ledger.remaining - used : 0n;
}

/** A failure with no request id still counts when we priced the worst case. Releasing it would hide a charge. */
function billed(call: TranslationCall): boolean {
  if (call.requestId !== undefined || call.reportedMicro !== undefined) return true;
  return call.worstCaseMicro !== undefined && call.worstCaseMicro > 0n;
}

function reportedField(cost: string | undefined): { reportedMicro: bigint } | Record<string, never> {
  if (cost === undefined || !/^\d+$/.test(cost)) return {};
  return { reportedMicro: BigInt(cost) };
}

function reportedSum(calls: TranslationCall[]): bigint | null {
  let sum = 0n;
  let any = false;
  for (const call of calls) {
    const part = call.reportedMicro ?? (call.worstCaseMicro !== undefined && call.worstCaseMicro > 0n ? call.worstCaseMicro : undefined);
    if (part !== undefined) {
      sum += part;
      any = true;
    }
  }
  return any ? sum : null;
}

function isEmptyAnswer(err: unknown): boolean {
  return err instanceof Error && err.message === EMPTY_ANSWER;
}

function stopsTheNight(err: unknown): boolean {
  return err instanceof RouterError && (err.action === "stop_user_batch" || err.action === "end_budget");
}

function failureText(err: unknown): string {
  const base = redactString(err instanceof Error ? err.message : "Unknown error");
  const id = err instanceof RouterError ? err.requestId : undefined;
  return (id ? `${base} (request ${id})` : base).slice(0, 500);
}
