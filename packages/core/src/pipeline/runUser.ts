import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CatalogEntry } from "../catalog/catalog";
import { loadModelCatalog, type CatalogCache } from "../catalog/loader";
import { impliedMicroUsdPerOg } from "../catalog/rate";
import type { WorkerConfig } from "../config";
import { openSecret } from "../crypto/vault";
import { extractDocText, type DocText } from "../executors/doc-text";
import { runAudioSummary } from "../executors/audio-summary";
import { runDocAnalysis } from "../executors/doc-analysis";
import { runImageFromPrompt } from "../executors/image-from-prompt";
import { recordStep } from "../executors/step";
import { storeTaskOutput } from "../executors/store-output";
import type { ExecutorResult, StepRecord } from "../executors/types";
import { msUntilHardStop } from "../night/schedule";
import { MIN_QUALITY, buildComplexityRequest, classificationSpendMicro, complexityState, pickDecisionModel, readComplexity, type Complexity } from "../optimizer/complexity";
import { planNight, type PlanOption, type PlanTask } from "../optimizer/optimizer";
import { costDrifted } from "../optimizer/replan";
import { redactString } from "../redact";
import { TASK_TYPES } from "../tasks/task-input";
import { withEphemeralKey } from "../zg/ephemeral-keys";
import { RouterError } from "../zg/errors";
import type { RouterClient } from "../zg/router";
import type { UsageRow } from "../zg/schemas";
import type { StorageClient } from "../zg/storage";
import { z } from "zod";
import { decideBudget, type BudgetDecision } from "./budget";
import { pickTranslationModels, runCommonsTranslations, type CommonsStore, type CommonsTranslationResult } from "./commons";
import { DEFAULT_COMMONS_GATE_THRESHOLD, runCommonsQualityGate, type CommonsDecide, type CommonsGateResult } from "./commons-gate";
import type { ConnectedUser, OpenTask, PipelineStore, RunPatch } from "./store";
import { resolveUpload } from "./uploads";

/** Plan §9.4: a task is tried once more, at most twice, and only when the failure was a 429 or a 5xx. */
const MAX_RETRIES = 2;
const USAGE_HISTORY_LIMIT = 100;
/** A task that is still running after this is failed. It is never left RUNNING. */
export const TASK_DEADLINE_MS = 5 * 60_000;

const inputMetaSchema = z.object({
  bytes: z.number().int().nonnegative().optional(),
  mime: z.string().optional(),
  durationSec: z.number().nonnegative().optional(),
  chars: z.number().int().nonnegative().optional(),
});

const MIME_BY_EXT: Record<string, string> = {
  ".mp3": "audio/mpeg",
  ".m4a": "audio/mp4",
  ".wav": "audio/wav",
  ".pdf": "application/pdf",
  ".txt": "text/plain",
  ".md": "text/markdown",
};

export type RunConfig = Pick<WorkerConfig, "SHIFT_MASTER_KEY" | "SAFETY_MARGIN_PCT" | "MAX_CONCURRENCY" | "NIGHT_HARD_STOP_UTC" | "UPLOAD_DIR" | "COMMONS_GATE_THRESHOLD">;

/** The Router methods one user night needs. The real client satisfies this; tests pass their own. */
export type UserRouter = Pick<RouterClient, "listModels" | "getBalance" | "getUsageHistory" | "createApiKey" | "revokeApiKey" | "chat" | "decide" | "transcribe" | "generateImage">;

export interface RunUserDeps {
  user: ConnectedUser;
  nightId: bigint;
  config: RunConfig;
  store: PipelineStore;
  router: UserRouter;
  storage: StorageClient;
  log: (message: string) => void;
  catalogCache?: CatalogCache;
  now?: () => Date;
  sleep?: (ms: number) => Promise<void>;
  readFile?: (absolutePath: string) => Promise<Uint8Array>;
  /** PENDING commons rows. Absent in tests that do not donate. The worker passes the Prisma store. */
  commons?: CommonsStore;
  /** Per-task cap. Defaults to {@link TASK_DEADLINE_MS}. Tests pass a short value. Also capped by the hard stop. */
  taskDeadlineMs?: number;
}

export interface RunUserOutcome {
  status: "DONE" | "SKIPPED" | "FAILED";
  runId: string;
}

interface Prepared {
  row: OpenTask;
  plan: PlanTask;
  bytes?: Uint8Array;
  doc?: DocText;
  fileName?: string;
  complexity?: Complexity;
  classifyStep?: StepRecord;
}

interface Spend {
  requestIds: string[];
  /** Sum of `total_cost_usd_micro` the Router actually reported. Missing traces add nothing. */
  reportedMicro: bigint;
  /** Reported cost where we have it, otherwise the estimate. This is what the optimizer treats as spent. */
  accountedMicro: bigint;
  /** Reported cost of commons translations and the quality gate. Personal tasks stay in `reportedMicro`. */
  donatedMicro: bigint;
}

const DEFER = {
  no_model: "No private model can run this task at the quality it needs.",
  over_budget: "The task does not fit in the remaining budget.",
} as const;

/**
 * One connected user's night (plan §9.3).
 * Decrypts the management key in memory, caps an ephemeral inference key, plans with the optimizer and runs the
 * executors for real. The key is revoked before this function returns. When `donateLeftover` is set, whatever budget
 * the personal tasks did not spend translates PENDING commons items and runs the decision-model quality gate
 * (plan §12.2, steps 1–5). `recordDonations` is still a later phase.
 */
export async function runUser(deps: RunUserDeps): Promise<RunUserOutcome> {
  const run = await openRun(deps.store, deps.nightId, deps.user.id);
  if (run.done) {
    deps.log(`user ${deps.user.id}: already finished for night ${deps.nightId}`);
    return { status: "DONE", runId: run.id };
  }
  if (run.blocked) {
    deps.log(`user ${deps.user.id}: an ephemeral key from an interrupted run is still alive`);
    return { status: "FAILED", runId: run.id };
  }

  try {
    return await runOpen(deps, run.id);
  } catch (err) {
    const error = failureText(err);
    deps.log(`user ${deps.user.id}: ${error}`);
    await deps.store.updateRun(run.id, { status: "FAILED", error }).catch(() => undefined);
    return { status: "FAILED", runId: run.id };
  }
}

async function openRun(store: PipelineStore, nightId: bigint, userId: string): Promise<{ id: string; done?: boolean; blocked?: boolean }> {
  const existing = await store.findRun(nightId, userId);
  if (!existing) return store.createRun(nightId, userId);
  if (existing.status === "DONE") return { id: existing.id, done: true };
  if (existing.ephemeralKeyId && !existing.keyRevokedAt) {
    await store.updateRun(existing.id, {
      status: "FAILED",
      error: "An ephemeral key from an interrupted run is still alive. It has to be revoked before this user can run again.",
    });
    return { id: existing.id, blocked: true };
  }
  await store.updateRun(existing.id, { status: "RUNNING", error: null });
  return { id: existing.id };
}

async function runOpen(deps: RunUserDeps, runId: string): Promise<RunUserOutcome> {
  const { user, store, router, log } = deps;
  const now = deps.now ?? (() => new Date());
  const tasks = await store.openTasks(user.id);
  const donateConfigured = user.donateLeftover && deps.commons !== undefined;
  if (msUntilHardStop(now(), deps.config.NIGHT_HARD_STOP_UTC) === 0) {
    await store.updateRun(runId, { status: "SKIPPED", error: "The hard stop was already reached, so this user did not start." });
    log(`user ${user.id}: hard stop reached before start`);
    return { status: "SKIPPED", runId };
  }
  if (tasks.length === 0 && !donateConfigured) {
    await store.updateRun(runId, { status: "SKIPPED", error: "No queued tasks." });
    log(`user ${user.id}: no queued tasks`);
    return { status: "SKIPPED", runId };
  }

  const runnable = tasks.length === 0 ? [] : await prepareTasks(deps, tasks);
  if (runnable.length === 0 && !donateConfigured) {
    await store.updateRun(runId, { status: "DONE", spentUsdMicro: 0n, donatedUsdMicro: 0n });
    return { status: "DONE", runId };
  }

  // Decrypted only for this run. The string cannot be wiped, but it is not logged, stored or returned.
  let mk = openSecret(
    { ciphertext: user.mkCiphertext, iv: user.mkIv, authTag: user.mkAuthTag },
    deps.config.SHIFT_MASTER_KEY,
    user.accountAddress.toLowerCase(),
  );
  try {
    return await runWithKey(deps, runId, mk, runnable);
  } finally {
    mk = "";
  }
}

async function runWithKey(deps: RunUserDeps, runId: string, mk: string, runnable: Prepared[]): Promise<RunUserOutcome> {
  const { user, store, router, log } = deps;
  const now = deps.now ?? (() => new Date());
  const { models, catalog } = await loadModelCatalog(router, deps.catalogCache ?? {}, now().getTime());
  const balance = await router.getBalance(mk);
  const budget = decideBudget({
    mode: user.mode,
    currency: balance.data.currency,
    creditBalance: balance.data.credit_balance,
    depositBalance: balance.data.deposit_balance,
    nightlyBudgetUsdMicro: user.nightlyBudgetUsdMicro,
    marginPct: deps.config.SAFETY_MARGIN_PCT,
    microUsdPerOg: impliedMicroUsdPerOg(models),
  });
  if (!budget.ok) {
    const status = budget.reason === "below_minimum" ? "SKIPPED" : "FAILED";
    await store.updateRun(runId, { status, error: budget.detail, balanceBefore: balance.data });
    log(`user ${user.id}: ${budget.detail}`);
    return { status, runId };
  }
  await store.updateRun(runId, { balanceBefore: balance.data, budgetUsdMicro: budget.budgetMicro });

  // Classification needs the ephemeral key, so this check still uses the quality floor of 1.
  // executePlan writes MIN_QUALITY onto each text task and calls planNight again with what that call left.
  const pair = pickTranslationModels(catalog);
  const donate = user.donateLeftover && deps.commons !== undefined && pair !== undefined;
  const preview = planNight(runnable.map((task) => task.plan), catalog, "private", budget.budgetMicro);
  if (preview.assignments.length === 0 && !donate) {
    for (const item of preview.deferred) await defer(store, deps.nightId, item.taskId, DEFER[item.reason]);
    await store.updateRun(runId, { status: "DONE", spentUsdMicro: 0n, donatedUsdMicro: 0n });
    if (user.donateLeftover && deps.commons && !pair) {
      log(`user ${user.id}: leftover budget is not spent on commons; the catalog has fewer than two private chat models`);
    } else {
      log(`user ${user.id}: nothing fits tonight's budget`);
    }
    return { status: "DONE", runId };
  }

  const chosen = new Set(preview.assignments.map((item) => item.taskId));
  for (const item of preview.deferred) await defer(store, deps.nightId, item.taskId, DEFER[item.reason]);

  let revokeError: string | undefined;
  const spend = await withEphemeralKey(
    router,
    { mk, nightId: String(deps.nightId), runId, budget: budget.creditLimit, trustMode: "private" },
    {
      onCreated: async (record) => {
        await store.updateRun(runId, { ephemeralKeyId: record.keyId, keyCreatedAt: record.createdAt });
      },
      onRevoked: async (record) => {
        await store.updateRun(runId, { keyRevokedAt: record.revokedAt });
      },
      onRevokeFailed: async (_record, err) => {
        revokeError = failureText(err);
      },
    },
    async (sk) => {
      const personal =
        preview.assignments.length === 0
          ? { requestIds: [], reportedMicro: 0n, accountedMicro: 0n, donatedMicro: 0n }
          : await executePlan(deps, sk, runnable.filter((task) => chosen.has(task.row.id)), catalog, budget);
      const commonsSpend = await spendCommons(deps, sk, catalog, budget.budgetMicro, personal.accountedMicro);
      return {
        requestIds: [...personal.requestIds, ...commonsSpend.requestIds],
        reportedMicro: personal.reportedMicro,
        accountedMicro: personal.accountedMicro + commonsSpend.accountedMicro,
        donatedMicro: commonsSpend.reportedMicro,
      };
    },
    { sleep: deps.sleep },
  );

  const summary: RunPatch = {
    status: "DONE",
    spentUsdMicro: spend.result.reportedMicro,
    donatedUsdMicro: spend.result.donatedMicro,
    ...(revokeError ? { error: `The ephemeral key could not be revoked; the sweeper will retry. ${revokeError}` } : {}),
  };
  await recordUsage(deps, mk, spend.result.requestIds, summary);
  await store.updateRun(runId, summary);
  return { status: "DONE", runId };
}

async function spendCommons(deps: RunUserDeps, sk: string, catalog: CatalogEntry[], budgetMicro: bigint, spentAccounted: bigint): Promise<Spend> {
  const none: Spend = { requestIds: [], reportedMicro: 0n, accountedMicro: 0n, donatedMicro: 0n };
  if (!deps.user.donateLeftover || !deps.commons) return none;
  const remaining = budgetMicro > spentAccounted ? budgetMicro - spentAccounted : 0n;
  const now = deps.now ?? (() => new Date());
  const commons = deps.commons;
  const gateBase = {
    commons,
    decide: ((key, body, options) => deps.router.decide(key, body, options)) satisfies CommonsDecide,
    upload: (bytes: Uint8Array) => deps.storage.upload(bytes),
    sk,
    catalog,
    userId: deps.user.id,
    threshold: deps.config.COMMONS_GATE_THRESHOLD ?? DEFAULT_COMMONS_GATE_THRESHOLD,
    hardStopUtc: deps.config.NIGHT_HARD_STOP_UTC,
    now,
    ...(deps.sleep ? { sleep: deps.sleep } : {}),
    log: deps.log,
  };
  // Finish pairs already RUNNING (an earlier night had no decision model, or the upload failed) before new translations.
  const opened = await runCommonsQualityGate({ ...gateBase, remainingMicro: remaining });
  const afterOpen = remaining > opened.accountedMicro ? remaining - opened.accountedMicro : 0n;
  const blocked = opened.stop === "hard_stop" || opened.stop === "balance";
  const translated = blocked
    ? { translated: 0, failed: 0, reportedMicro: 0n, accountedMicro: 0n, requestIds: [] as string[], stop: opened.stop }
    : await runCommonsTranslations({
        commons,
        chat: (key, body, options) => deps.router.chat(key, body, options),
        sk,
        catalog,
        remainingMicro: afterOpen,
        userId: deps.user.id,
        nightId: deps.nightId,
        hardStopUtc: deps.config.NIGHT_HARD_STOP_UTC,
        now,
        ...(deps.sleep ? { sleep: deps.sleep } : {}),
        log: deps.log,
      });
  logTranslations(deps, translated, afterOpen);
  const afterPairs = afterOpen > translated.accountedMicro ? afterOpen - translated.accountedMicro : 0n;
  const closed =
    blocked || translated.stop === "hard_stop" || translated.stop === "balance"
      ? emptyGate()
      : await runCommonsQualityGate({ ...gateBase, remainingMicro: afterPairs });
  const accepted = opened.accepted + closed.accepted;
  const rejected = opened.rejected + closed.rejected;
  if (accepted > 0 || rejected > 0) {
    const gateReported = opened.reportedMicro + closed.reportedMicro;
    deps.log(`user ${deps.user.id}: commons gate accepted ${accepted}, rejected ${rejected}; ${gateReported} micro-USD`);
  }
  const reported = opened.reportedMicro + translated.reportedMicro + closed.reportedMicro;
  return {
    requestIds: [...opened.requestIds, ...translated.requestIds, ...closed.requestIds],
    reportedMicro: reported,
    accountedMicro: opened.accountedMicro + translated.accountedMicro + closed.accountedMicro,
    donatedMicro: reported,
  };
}

function emptyGate(): CommonsGateResult {
  return { accepted: 0, rejected: 0, held: 0, reportedMicro: 0n, accountedMicro: 0n, requestIds: [], stop: "done" };
}

function logTranslations(deps: RunUserDeps, translated: CommonsTranslationResult, remaining: bigint): void {
  if (translated.stop === "no_model" && remaining > 0n) {
    deps.log(`user ${deps.user.id}: ${remaining} micro-USD left; the catalog has fewer than two private chat models, so commons items stay pending`);
  } else if (translated.translated > 0 || translated.failed > 0) {
    deps.log(`user ${deps.user.id}: commons translations ${translated.translated} ready, ${translated.failed} failed; ${translated.reportedMicro} micro-USD`);
  } else if (translated.stop === "budget" && remaining > 0n) {
    deps.log(`user ${deps.user.id}: ${remaining} micro-USD left cannot fund another translation pair; pending commons items stay pending`);
  } else if (translated.stop === "hard_stop") {
    deps.log(`user ${deps.user.id}: hard stop reached; commons items not started stay pending`);
  }
}

async function prepareTasks(deps: RunUserDeps, tasks: OpenTask[]): Promise<Prepared[]> {
  const ready: Prepared[] = [];
  for (const row of tasks) {
    const result = await prepareOne(deps, row);
    if (result.ok) ready.push(result.task);
    else await deps.store.updateTask(row.id, { status: "FAILED", nightId: deps.nightId, error: result.error });
  }
  return ready;
}

async function prepareOne(deps: RunUserDeps, row: OpenTask): Promise<{ ok: true; task: Prepared } | { ok: false; error: string }> {
  const type = z.enum(TASK_TYPES).safeParse(row.type);
  if (!type.success) return { ok: false, error: "The task type is not one Shift can run." };
  const meta = inputMetaSchema.safeParse(row.inputMeta ?? {});
  if (!meta.success) return { ok: false, error: "The task's stored file metadata is not usable." };
  const plan: PlanTask = {
    id: row.id,
    type: type.data,
    priority: row.priority,
    createdAt: row.createdAt,
    // Floor until a text task is classified. executePlan replaces this with MIN_QUALITY from that verdict.
    minQuality: 1,
    size: { bytes: meta.data.bytes ?? 0, ...(meta.data.mime ? { mime: meta.data.mime } : {}), ...(meta.data.durationSec !== undefined ? { durationSec: meta.data.durationSec } : {}), ...(meta.data.chars !== undefined ? { chars: meta.data.chars } : {}), ...(row.prompt ? { prompt: row.prompt } : {}) },
  };

  if (type.data === "IMAGE_FROM_PROMPT") {
    if (!row.prompt || row.prompt.trim().length === 0) return { ok: false, error: "This image task has no prompt." };
    return { ok: true, task: { row, plan } };
  }
  if (!row.inputPath) return { ok: false, error: "This task has no file." };

  let absolute: string;
  try {
    absolute = resolveUpload(deps.config.UPLOAD_DIR, row.inputPath);
  } catch (err) {
    return { ok: false, error: failureText(err) };
  }
  let bytes: Uint8Array;
  try {
    bytes = await (deps.readFile ?? readFile)(absolute);
  } catch {
    return { ok: false, error: "The upload is missing on disk." };
  }
  plan.size = { ...plan.size, bytes: meta.data.bytes ?? bytes.byteLength };
  const fileName = path.basename(row.inputPath);
  if (type.data === "AUDIO_SUMMARY") return { ok: true, task: { row, plan, bytes, fileName } };

  try {
    const doc = await extractDocText(bytes, path.extname(fileName).toLowerCase());
    plan.size = { ...plan.size, chars: doc.chars };
    return { ok: true, task: { row, plan, bytes, doc, fileName } };
  } catch (err) {
    return { ok: false, error: failureText(err) };
  }
}

async function executePlan(deps: RunUserDeps, sk: string, tasks: Prepared[], catalog: CatalogEntry[], budget: Extract<BudgetDecision, { ok: true }>): Promise<Spend> {
  const spend: Spend = { requestIds: [], reportedMicro: 0n, accountedMicro: 0n, donatedMicro: 0n };
  let activeCatalog = catalog;
  let stop = false;
  const now = deps.now ?? (() => new Date());
  const dropped = new Set<string>();

  const deferId = async (id: string, reason: string) => {
    if (dropped.has(id)) return;
    dropped.add(id);
    const task = tasks.find((item) => item.row.id === id);
    await deps.store.updateTask(id, {
      status: "DEFERRED",
      nightId: deps.nightId,
      error: reason,
      ...(task?.complexity ? { complexity: task.complexity } : {}),
      ...(task?.classifyStep ? { steps: [task.classifyStep] } : {}),
    });
  };

  for (const task of tasks) {
    if (msUntilHardStop(now(), deps.config.NIGHT_HARD_STOP_UTC) === 0) {
      stop = true;
      break;
    }
    if (task.row.type === "AUDIO_SUMMARY") continue;
    const text = task.doc?.text ?? task.row.prompt ?? "";
    // The full task text picks Laya vs Vela. The request itself still sends the truncated state.
    const model = pickDecisionModel(activeCatalog, `${task.row.type}\n${text}`.length);
    if (!model) {
      task.complexity = "standard";
      task.plan.minQuality = MIN_QUALITY.standard;
      deps.log(`user ${deps.user.id}: no decision model in the catalog; task ${task.row.id} is planned as standard`);
      continue;
    }
    const verdict = await classify(deps, sk, task, model, text);
    if (verdict === "stop") {
      stop = true;
      break;
    }
    task.complexity = verdict.complexity;
    task.plan.minQuality = MIN_QUALITY[verdict.complexity];
    const estimate = classificationSpendMicro({ model, stateChars: complexityState(`${task.row.type} task`, text).length }).micro;
    if (verdict.step) addCost(spend, [verdict.step], estimate);
    task.classifyStep = verdict.step;
  }
  if (stop) {
    for (const task of tasks) await deferId(task.row.id, "Planning stopped before execution, so this task waits for another night.");
    deps.log(`user ${deps.user.id}: planning stopped before any task ran`);
    return spend;
  }

  const remaining = budget.budgetMicro > spend.accountedMicro ? budget.budgetMicro - spend.accountedMicro : 0n;
  const plan = planNight(tasks.map((task) => task.plan), activeCatalog, "private", remaining);
  const assignment = new Map<string, PlanOption>(plan.assignments.map((item) => [item.taskId, item.option]));
  for (const item of plan.deferred) await deferId(item.taskId, DEFER[item.reason]);

  const queue = tasks.filter((task) => assignment.has(task.row.id));
  const limit = deps.config.MAX_CONCURRENCY;
  // Tasks already inside runTask are off the queue. Their estimate stays reserved so a replan cannot spend it twice.
  const running = new Set<string>();
  // Dequeue and replan share one turn. A worker may be inside runTask while another replans; it must not pull the
  // next task until the new assignments and DEFERRED rows are stored.
  let turn: Promise<void> = Promise.resolve();
  const exclusive = <T>(fn: () => Promise<T> | T): Promise<T> => {
    const run = turn.then(fn);
    turn = run.then(() => undefined, () => undefined);
    return run;
  };

  const deferRest = async (reason: string) => {
    stop = true;
    for (const task of queue) await deferId(task.row.id, reason);
  };

  const replan = async () => {
    const left = queue.filter((task) => !dropped.has(task.row.id));
    const reserved = [...running].reduce((sum, id) => sum + (assignment.get(id)?.costMicro ?? 0n), 0n);
    const committed = spend.accountedMicro + reserved;
    const budgetLeft = budget.budgetMicro > committed ? budget.budgetMicro - committed : 0n;
    const next = planNight(left.map((task) => task.plan), activeCatalog, "private", budgetLeft);
    const keep = new Map(next.assignments.map((item) => [item.taskId, item.option]));
    for (const task of left) {
      const option = keep.get(task.row.id);
      if (!option) {
        const why = next.deferred.find((item) => item.taskId === task.row.id);
        await deferId(task.row.id, why ? DEFER[why.reason] : DEFER.over_budget);
      } else assignment.set(task.row.id, option);
    }
  };

  await runPool(Math.min(limit, queue.length), async () => {
    for (;;) {
      const next = await exclusive(() => {
        if (stop || msUntilHardStop(now(), deps.config.NIGHT_HARD_STOP_UTC) === 0) return undefined;
        for (;;) {
          const task = queue.shift();
          if (!task) return undefined;
          if (dropped.has(task.row.id)) continue;
          const option = assignment.get(task.row.id);
          if (!option) continue;
          running.add(task.row.id);
          return { task, option };
        }
      });
      if (!next) return;
      const outcome = await runTask(deps, sk, next.task, next.option, spend);
      running.delete(next.task.row.id);
      if (outcome === "stop") {
        await exclusive(() => deferRest("The balance or the key limit was reached, so the remaining tasks wait for another night."));
        return;
      }
      if (outcome === "exclude") {
        await exclusive(async () => {
          const ids = new Set([next.option.models.chat.id, next.option.models.transcribe?.id, next.option.models.image?.id].filter((id): id is string => id !== undefined));
          activeCatalog = activeCatalog.filter((entry) => !ids.has(entry.id));
          await replan();
        });
      }
      if (outcome === "replan") await exclusive(() => replan());
    }
  });

  for (const task of queue) {
    if (dropped.has(task.row.id) || !task.classifyStep) continue;
    await deps.store.updateTask(task.row.id, { steps: [task.classifyStep] });
  }
  if (msUntilHardStop(now(), deps.config.NIGHT_HARD_STOP_UTC) === 0) {
    deps.log(`user ${deps.user.id}: hard stop reached; tasks not started stay queued`);
  }
  return spend;
}

type TaskOutcome = "ok" | "stop" | "exclude" | "replan";

async function runTask(deps: RunUserDeps, sk: string, task: Prepared, option: PlanOption, spend: Spend): Promise<TaskOutcome> {
  const clock = deps.now ?? (() => new Date());
  const hardStopMs = msUntilHardStop(clock(), deps.config.NIGHT_HARD_STOP_UTC);
  const limitMs = deps.taskDeadlineMs ?? TASK_DEADLINE_MS;
  const deadlineMs = Math.min(limitMs, hardStopMs);
  const deadlineMessage =
    hardStopMs <= limitMs
      ? "The hard stop passed before this task could finish."
      : "The task exceeded its deadline.";
  await deps.store.updateTask(task.row.id, {
    status: "RUNNING",
    nightId: deps.nightId,
    complexity: task.complexity ?? null,
    chosenModel: option.models.chat.id,
    estCostUsdMicro: option.costMicro,
  });
  if (deadlineMs <= 0) {
    await deps.store.updateTask(task.row.id, { status: "FAILED", nightId: deps.nightId, error: deadlineMessage });
    return "ok";
  }

  const gate = { expired: false };
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<"deadline">((resolve) => {
    timer = setTimeout(() => {
      gate.expired = true;
      resolve("deadline");
    }, deadlineMs);
  });
  const body = runTaskBody(deps, sk, task, option, spend, gate).then(
    (outcome) => outcome,
    (err: unknown) => {
      if (gate.expired) return "ok" as TaskOutcome;
      throw err;
    },
  );
  try {
    const outcome = await Promise.race([body, timeout]);
    if (outcome === "deadline") {
      await deps.store.updateTask(task.row.id, { status: "FAILED", nightId: deps.nightId, error: deadlineMessage });
      return "ok";
    }
    return outcome;
  } catch (err) {
    await deps.store.updateTask(task.row.id, { status: "FAILED", nightId: deps.nightId, error: failureText(err) }).catch(() => undefined);
    throw err;
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function runTaskBody(deps: RunUserDeps, sk: string, task: Prepared, option: PlanOption, spend: Spend, gate: { expired: boolean }): Promise<TaskOutcome> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));

  const failedSteps: StepRecord[] = [];
  let last: unknown;
  let output: ExecutorResult<unknown> | undefined;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      output = await dispatch(deps.router, sk, task, option, attempt);
      break;
    } catch (err) {
      last = err;
      output = undefined;
      if (err instanceof RouterError && err.requestId) {
        failedSteps.push({ step: "error", model: option.models.chat.id, requestId: err.requestId, trust: option.models.chat.trust });
      }
      if (isStop(err)) break;
      if (!(err instanceof RouterError) || !err.retryable || attempt === MAX_RETRIES) break;
      await sleep(err.retryAfterMs ?? 1000 * (attempt + 1));
    }
  }

  const prior = task.classifyStep ? [task.classifyStep] : [];
  if (!output) {
    if (gate.expired) return "ok";
    const steps = [...prior, ...failedSteps];
    if (failedSteps.length > 0) addCost(spend, failedSteps, option.costMicro);
    await deps.store.updateTask(task.row.id, { status: "FAILED", nightId: deps.nightId, ...(steps.length > 0 ? { steps } : {}), error: failureText(last) });
    if (isStop(last)) return "stop";
    if (last instanceof RouterError && (last.action === "exclude_model_and_replan" || last.action === "switch_provider_or_model")) return "exclude";
    return "ok";
  }

  // The inference already happened. A storage failure must not run it again.
  const steps = [...prior, ...output.steps];
  addCost(spend, output.steps, option.costMicro);
  const actual = reportedCost(output.steps);
  if (gate.expired) return "ok";
  try {
    const stored = await storeTaskOutput(deps.storage, { id: task.row.id, type: task.plan.type }, output);
    if (gate.expired) return "ok";
    await deps.store.updateTask(task.row.id, {
      status: "DONE",
      nightId: deps.nightId,
      steps,
      outputRoot: stored.rootHash,
      outputTx: stored.txHash,
      actualCostUsdMicro: actual ?? null,
      error: null,
    });
  } catch (err) {
    // The call was already billed. A storage failure must not run it again, but the drift check below still runs.
    if (gate.expired) return "ok";
    await deps.store.updateTask(task.row.id, { status: "FAILED", nightId: deps.nightId, steps, actualCostUsdMicro: actual ?? null, error: failureText(err) });
  }
  return costDrifted(option.costMicro, actual) ? "replan" : "ok";
}

async function dispatch(router: UserRouter, sk: string, task: Prepared, option: PlanOption, attempt: number): Promise<ExecutorResult<unknown>> {
  const ctx = {
    router: router as RouterClient,
    sk,
    trustMode: "private" as const,
    taskId: task.row.id,
    attempt,
    models: {
      chat: option.models.chat.id,
      ...(option.models.transcribe ? { transcribe: option.models.transcribe.id } : {}),
      ...(option.models.image ? { image: option.models.image.id } : {}),
    },
  };
  switch (task.plan.type) {
    case "AUDIO_SUMMARY": {
      const mime = task.plan.size.mime ?? MIME_BY_EXT[path.extname(task.fileName ?? "").toLowerCase()] ?? "application/octet-stream";
      return runAudioSummary(ctx, { bytes: task.bytes ?? new Uint8Array(), fileName: task.fileName ?? "audio", mime });
    }
    case "DOC_ANALYSIS":
      return runDocAnalysis(ctx, task.doc ?? { text: "", chars: 0, truncated: false });
    case "IMAGE_FROM_PROMPT":
      return runImageFromPrompt(ctx, task.row.prompt ?? "");
  }
}

async function classify(deps: RunUserDeps, sk: string, task: Prepared, model: CatalogEntry, text: string): Promise<{ complexity: Complexity; step?: StepRecord } | "stop"> {
  const sleep = deps.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const description = `${task.row.type} task`;
  let last: unknown;
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const res = await deps.router.decide(sk, buildComplexityRequest(model.id, description, text), {
        trustMode: model.trust,
        clientRequestId: `${task.row.id}-${attempt}-classify`,
      });
      return { ...readComplexity(res.data), step: recordStep("classify", model.id, res, model.trust) };
    } catch (err) {
      last = err;
      if (isStop(err)) return "stop";
      if (!(err instanceof RouterError) || !err.retryable || attempt === MAX_RETRIES) break;
      await sleep(err.retryAfterMs ?? 1000 * (attempt + 1));
    }
  }
  // The classifier only chooses how much to spend, so a bad answer is "standard" and the task is not lost.
  deps.log(`user ${deps.user.id}: complexity of task ${task.row.id} fell back to standard (${failureText(last)})`);
  return { complexity: "standard" };
}

async function recordUsage(deps: RunUserDeps, mk: string, requestIds: string[], summary: RunPatch): Promise<void> {
  const wanted = new Set(requestIds);
  try {
    const history = await deps.router.getUsageHistory(mk, { limit: USAGE_HISTORY_LIMIT });
    const rows = history.data.filter((row) => wanted.has(row.request_id));
    summary.creditUsed = sumField(rows, "credit_used");
    summary.depositUsed = sumField(rows, "deposit_used");
    const missing = requestIds.filter((id) => !rows.some((row) => row.request_id === id));
    if (missing.length > 0) deps.log(`user ${deps.user.id}: ${missing.length} request id(s) were not in the usage history yet`);
  } catch (err) {
    deps.log(`user ${deps.user.id}: usage history could not be read (${failureText(err)})`);
  }
  try {
    summary.balanceAfter = (await deps.router.getBalance(mk)).data;
  } catch (err) {
    deps.log(`user ${deps.user.id}: balance after the run could not be read (${failureText(err)})`);
  }
}

function addCost(spend: Spend, steps: StepRecord[], estimate: bigint): void {
  for (const step of steps) if (step.requestId) spend.requestIds.push(step.requestId);
  const actual = reportedCost(steps);
  if (actual !== undefined) {
    spend.reportedMicro += actual;
    spend.accountedMicro += actual;
  } else if (estimate > 0n) {
    spend.accountedMicro += estimate;
  }
}

function reportedCost(steps: StepRecord[]): bigint | undefined {
  let sum = 0n;
  let any = false;
  for (const step of steps) {
    if (step.costUsdMicro !== undefined && /^\d+$/.test(step.costUsdMicro)) {
      sum += BigInt(step.costUsdMicro);
      any = true;
    }
  }
  return any ? sum : undefined;
}

function sumField(rows: UsageRow[], field: "credit_used" | "deposit_used"): string | null {
  let sum = 0n;
  let any = false;
  for (const row of rows) {
    const value = row[field];
    if (typeof value === "string" && /^\d+$/.test(value)) {
      sum += BigInt(value);
      any = true;
    }
  }
  return any ? sum.toString() : null;
}

function isStop(err: unknown): boolean {
  return err instanceof RouterError && (err.action === "stop_user_batch" || err.action === "end_budget");
}

async function defer(store: PipelineStore, nightId: bigint, taskId: string, reason: string): Promise<void> {
  await store.updateTask(taskId, { status: "DEFERRED", nightId, error: reason });
}

async function runPool(limit: number, worker: () => Promise<void>): Promise<void> {
  if (limit <= 0) return;
  await Promise.all(Array.from({ length: limit }, () => worker()));
}

function failureText(err: unknown): string {
  const base = redactString(err instanceof Error ? err.message : "Unknown error");
  const id = err instanceof RouterError ? err.requestId : undefined;
  return (id ? `${base} (request ${id})` : base).slice(0, 500);
}
