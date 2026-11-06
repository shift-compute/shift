import { z } from "zod";
import { impliedMicroUsdPerOg } from "../catalog/rate";
import { loadModelCatalog, type CatalogCache, type CatalogLister } from "../catalog/loader";
import { planNight, type PlanTask } from "../optimizer/optimizer";
import { TASK_TYPES, type TaskTypeName } from "../tasks/task-input";
import type { RouterClient } from "../zg/router";
import { decideBudget } from "./budget";
import type { OpenTask } from "./store";

/**
 * Quality floor for a plan made before any ephemeral key exists.
 * `runUser` uses the same floor for its pre-key check. Complexity classification calls `/v1/decisions`
 * and spends credits, so the preview does not run it. The night fills complexity in at run time.
 */
export const PREVIEW_QUALITY_FLOOR = 1;

const inputMetaSchema = z.object({
  bytes: z.number().int().nonnegative().optional(),
  mime: z.string().optional(),
  durationSec: z.number().nonnegative().optional(),
  chars: z.number().int().nonnegative().optional(),
});

/** Catalog and balance only. Inference, decisions and key management are not on this type, so a preview cannot call them. */
export type PreviewRouter = CatalogLister & Pick<RouterClient, "getBalance">;

export interface PreviewAccount {
  mode: "IAI_CREDITS_ONLY" | "BUDGET";
  nightlyBudgetUsdMicro: bigint | null;
}

export interface PreviewInput {
  /** QUEUED and DEFERRED tasks, the same set `runUser` loads. */
  tasks: OpenTask[];
  account: PreviewAccount;
  /** Management key, used only for `GET /v1/account/balance`. Never copied into the result. */
  mk: string;
  router: PreviewRouter;
  marginPct: number;
  catalogCache?: CatalogCache;
  nowMs?: number;
}

export interface TonightAssignment {
  taskId: string;
  type: string;
  /** Chat model the optimizer chose. */
  model: string;
  transcribeModel: string | null;
  imageModel: string | null;
  quality: 1 | 2 | 3;
  /** Micro-USD, decimal integer as a string so a large total is not rounded through JSON. */
  costMicro: string;
}

export interface TonightPreview {
  qualityFloor: 1;
  /** Classification happens in the real run, after an ephemeral key exists. */
  complexity: "at_run_time";
  budgetMicro: string;
  spentEstimateMicro: string;
  /** What plan §10.4 leaves for the commons queue. */
  remainingMicro: string;
  assignments: TonightAssignment[];
  deferred: Array<{ taskId: string; type: string; reason: "no_model" | "over_budget" | "not_runnable" }>;
}

export type PreviewFailure =
  | "empty_queue"
  | "no_rate"
  | "below_minimum"
  | "missing_cap"
  | "unreadable_balance"
  | "unsupported_currency";

export type PreviewOutcome =
  | { ok: true; preview: TonightPreview }
  | { ok: false; error: PreviewFailure; message: string };

/**
 * Tonight's estimate (plan §10.4). Real balance and real catalog prices, then the same optimizer the night uses.
 * Does not create a key, call `/v1/decisions`, or execute a task. Sizes come from the stored metadata and the prompt.
 * Reading the upload again, and classifying complexity, both happen at run time.
 */
export async function previewTonight(input: PreviewInput): Promise<PreviewOutcome> {
  if (input.tasks.length === 0) {
    return { ok: false, error: "empty_queue", message: "Nothing is waiting for tonight." };
  }

  const runnable: PlanTask[] = [];
  const skipped: TonightPreview["deferred"] = [];
  for (const row of input.tasks) {
    const plan = planTaskForPreview(row);
    if (plan) runnable.push(plan);
    else skipped.push({ taskId: row.id, type: row.type, reason: "not_runnable" });
  }

  const { models, catalog } = await loadModelCatalog(input.router, input.catalogCache ?? {}, input.nowMs ?? Date.now());
  const balance = await input.router.getBalance(input.mk);
  const budget = decideBudget({
    mode: input.account.mode,
    currency: balance.data.currency,
    creditBalance: balance.data.credit_balance,
    depositBalance: balance.data.deposit_balance,
    nightlyBudgetUsdMicro: input.account.nightlyBudgetUsdMicro,
    marginPct: input.marginPct,
    microUsdPerOg: impliedMicroUsdPerOg(models),
  });
  if (!budget.ok) return { ok: false, error: budget.reason, message: budget.detail };

  const plan = planNight(runnable, catalog, "private", budget.budgetMicro);
  const typeOf = new Map(input.tasks.map((task) => [task.id, task.type]));
  return {
    ok: true,
    preview: {
      qualityFloor: PREVIEW_QUALITY_FLOOR,
      complexity: "at_run_time",
      budgetMicro: budget.budgetMicro.toString(),
      spentEstimateMicro: plan.spentEstimateMicro.toString(),
      remainingMicro: plan.remainingMicro.toString(),
      assignments: plan.assignments.map((item) => {
        const type = typeOf.get(item.taskId) ?? "";
        const specialists = specialistModels(type, item.option.models);
        return {
          taskId: item.taskId,
          type,
          model: item.option.models.chat.id,
          transcribeModel: specialists.transcribeModel,
          imageModel: specialists.imageModel,
          quality: item.option.quality,
          costMicro: item.option.costMicro.toString(),
        };
      }),
      deferred: [
        ...plan.deferred.map((item) => ({ taskId: item.taskId, type: typeOf.get(item.taskId) ?? "", reason: item.reason })),
        ...skipped,
      ],
    },
  };
}

/** A task the estimator can price from what is already stored. Unusable rows are deferred, not failed. */
export function planTaskForPreview(row: OpenTask): PlanTask | null {
  const type = z.enum(TASK_TYPES).safeParse(row.type);
  if (!type.success) return null;
  const meta = inputMetaSchema.safeParse(row.inputMeta ?? {});
  if (!meta.success) return null;
  if (type.data === "IMAGE_FROM_PROMPT") {
    if (!row.prompt || row.prompt.trim().length === 0) return null;
  } else if (!row.inputPath) {
    return null;
  }

  return {
    id: row.id,
    type: type.data,
    priority: row.priority,
    createdAt: row.createdAt,
    minQuality: PREVIEW_QUALITY_FLOOR,
    size: {
      bytes: meta.data.bytes ?? 0,
      ...(meta.data.mime ? { mime: meta.data.mime } : {}),
      ...(meta.data.durationSec !== undefined ? { durationSec: meta.data.durationSec } : {}),
      ...(meta.data.chars !== undefined ? { chars: meta.data.chars } : {}),
      ...(row.prompt ? { prompt: row.prompt } : {}),
    },
  };
}

function specialistModels(
  type: string,
  models: { transcribe?: { id: string }; image?: { id: string } },
): { transcribeModel: string | null; imageModel: string | null } {
  const name = type as TaskTypeName;
  if (name === "AUDIO_SUMMARY") return { transcribeModel: models.transcribe?.id ?? null, imageModel: null };
  if (name === "IMAGE_FROM_PROMPT") return { transcribeModel: null, imageModel: models.image?.id ?? null };
  return { transcribeModel: null, imageModel: null };
}
