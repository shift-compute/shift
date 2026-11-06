import { candidates, type CatalogEntry, type TrustLevel } from "../catalog/catalog";
import { estimateCostMicro, type EstimateModels, type TaskSize } from "../catalog/estimator";
import type { TaskTypeName } from "../tasks/task-input";
import { chatQuality } from "./quality";

export interface PlanTask {
  id: string;
  type: TaskTypeName;
  /** 1 low, 2 normal, 3 high. */
  priority: number;
  createdAt: Date;
  size: TaskSize;
  /** Minimum chat quality, from the complexity classification. Defaults to 1. */
  minQuality?: 1 | 2 | 3;
}

export interface PlanOption {
  models: EstimateModels;
  quality: 1 | 2 | 3;
  costMicro: bigint;
}

export interface PlanAssignment {
  taskId: string;
  option: PlanOption;
}

export interface Plan {
  assignments: PlanAssignment[];
  /** Tasks that did not fit; they go to the next night with status DEFERRED. */
  deferred: Array<{ taskId: string; reason: "no_model" | "over_budget" }>;
  spentEstimateMicro: bigint;
  /** What is left for the commons queue (plan §10.4 step 3). */
  remainingMicro: bigint;
}

const cheapest = <T extends CatalogEntry>(list: T[], cost: (e: T) => bigint): T | undefined =>
  list.reduce<T | undefined>((best, e) => (best === undefined || cost(e) < cost(best) ? e : best), undefined);

/**
 * All sensible ways to run one task: one option per chat model, paired with the cheapest transcription or image model
 * that fits the trust level. Reduced to the frontier where more money buys strictly more quality.
 */
export function optionsFor(task: PlanTask, catalog: CatalogEntry[], trust: TrustLevel): PlanOption[] {
  const minQuality = task.minQuality ?? 1;
  const chats = candidates(catalog, "chat", trust).filter((c) => chatQuality(c.id) >= minQuality);
  const stt = cheapest(candidates(catalog, "transcribe", trust), (e) => e.promptAtto);
  const image = cheapest(candidates(catalog, "image", trust), (e) => e.imageAtto);
  if (task.type === "AUDIO_SUMMARY" && !stt) return [];
  if (task.type === "IMAGE_FROM_PROMPT" && !image) return [];

  const all: PlanOption[] = chats.map((chat) => {
    const models: EstimateModels = { chat, ...(stt ? { transcribe: stt } : {}), ...(image ? { image } : {}) };
    return { models, quality: chatQuality(chat.id), costMicro: estimateCostMicro(task.type, task.size, models) };
  });

  // Cheapest first. The same price keeps the higher quality, so a free step up is the base and not a later upgrade.
  // A dearer option stays only when it is strictly better than every cheaper one.
  all.sort((a, b) => (a.costMicro < b.costMicro ? -1 : a.costMicro > b.costMicro ? 1 : b.quality - a.quality));
  const frontier: PlanOption[] = [];
  for (const o of all) if (frontier.length === 0 || o.quality > frontier[frontier.length - 1]!.quality) frontier.push(o);
  return frontier;
}

/**
 * Multiple-choice knapsack, greedy (plan §10.4): give every task its cheapest option in priority order, then spend what
 * is left on the upgrades with the best (quality gained x priority) per micro-USD.
 */
export function planNight(tasks: PlanTask[], catalog: CatalogEntry[], trust: TrustLevel, budgetMicro: bigint): Plan {
  const options = new Map<string, PlanOption[]>();
  const deferred: Plan["deferred"] = [];
  const chosen = new Map<string, number>(); // task id -> index into its frontier
  const start = budgetMicro < 0n ? 0n : budgetMicro;
  let remaining = start;

  const ordered = [...tasks].sort((a, b) => b.priority - a.priority || a.createdAt.getTime() - b.createdAt.getTime());
  for (const task of ordered) {
    const opts = optionsFor(task, catalog, trust);
    if (opts.length === 0) {
      deferred.push({ taskId: task.id, reason: "no_model" });
      continue;
    }
    options.set(task.id, opts);
    if (opts[0]!.costMicro <= remaining) {
      chosen.set(task.id, 0);
      remaining -= opts[0]!.costMicro;
    } else {
      deferred.push({ taskId: task.id, reason: "over_budget" });
    }
  }

  const priorityOf = new Map(tasks.map((t) => [t.id, t.priority]));
  for (;;) {
    let best: { id: string; delta: bigint; score: number } | undefined;
    for (const [id, index] of chosen) {
      const opts = options.get(id)!;
      const next = opts[index + 1];
      if (!next) continue;
      const delta = next.costMicro - opts[index]!.costMicro;
      if (delta > remaining) continue;
      const gain = (next.quality - opts[index]!.quality) * (priorityOf.get(id) ?? 1);
      // A free upgrade (delta 0) beats any paid one.
      const score = delta === 0n ? Number.POSITIVE_INFINITY : gain / Number(delta);
      if (!best || score > best.score) best = { id, delta, score };
    }
    if (!best) break;
    chosen.set(best.id, chosen.get(best.id)! + 1);
    remaining -= best.delta;
  }

  const assignments: PlanAssignment[] = ordered.flatMap((t) => (chosen.has(t.id) ? [{ taskId: t.id, option: options.get(t.id)![chosen.get(t.id)!]! }] : []));
  return {
    assignments,
    deferred,
    spentEstimateMicro: start - remaining,
    remainingMicro: remaining,
  };
}
