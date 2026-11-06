import { z } from "zod";
import { formatAmount } from "../../lib/format";
import { verifyHref } from "../../lib/night-response";
import type { PreviewPanel } from "./preview-state";

/** Matches the route's `maxDuration`. One POST; the page does not send another. */
export const RUN_NOW_TIMEOUT_MS = 300_000;

const OPEN = new Set(["QUEUED", "DEFERRED"]);

export type PreviewPhase = PreviewPanel["phase"] | "loading";

export function openTaskCount(tasks: readonly { status: string }[] | null): number | null {
  if (tasks === null) return null;
  return tasks.filter((task) => OPEN.has(task.status)).length;
}

export type RunClick =
  | { action: "start" }
  | { action: "ignore" }
  | { action: "wait" }
  | { action: "blocked"; message: string };

/**
 * Whether this click may POST /api/runs/now.
 * A click while a start is in flight is ignored. An empty queue never starts a run.
 */
export function runGate(input: { pending: boolean; openCount: number | null; queueFailed: boolean; previewPhase: PreviewPhase }): RunClick {
  if (input.pending) return { action: "ignore" };
  if (input.queueFailed) return { action: "wait" };
  if (input.openCount === null) return { action: "wait" };
  if (input.previewPhase === "reconnect") {
    return { action: "blocked", message: "Your management key is no longer valid. Connect again before running." };
  }
  if (input.openCount === 0) {
    return { action: "blocked", message: "There is no queued or deferred work for this account. Add a task before running." };
  }
  return { action: "start" };
}

export function eligibilityCopy(openCount: number | null, queueFailed: boolean, previewPhase: PreviewPhase = "ready"): string {
  if (queueFailed) return "We could not load your queue, so Run now stays off. This page will not start a run.";
  if (previewPhase === "reconnect") return "Your management key is no longer valid. Connect again before running. This page will not start a run.";
  if (openCount === null) return "Loading your queue…";
  if (openCount === 0) return "Nothing is queued or deferred. Add a task before running. This does not spend credits.";
  const noun = openCount === 1 ? "task is" : "tasks are";
  return `${openCount} ${noun} waiting. Run now starts the same pipeline as the nightly shift and spends real credits, up to tonight's cap. It can start once every 10 minutes. This page does not retry a start.`;
}

/** Cap and estimate from the preview. Amounts are micro-USD integers. */
export function estimateCopy(panel: PreviewPanel | { phase: "loading" }): string | null {
  if (panel.phase !== "ready") return null;
  const preview = panel.preview;
  return `Tonight's cap is ${formatAmount(preview.budgetMicro, "usd")}. Estimated spend is ${formatAmount(preview.spentEstimateMicro, "usd")}. Left for the commons queue is ${formatAmount(preview.remainingMicro, "usd")}.`;
}

export interface RunNowFailure {
  kind: "signed_out" | "reconnect" | "no_work" | "rate_limited" | "storage" | "timeout" | "lost" | "failed";
  title: string;
  detail: string;
  retryAfterSeconds?: number;
  /** A spending start is never repeated from this page. */
  retry: false;
}

function safeText(value: unknown, fallback: string): string {
  if (typeof value !== "string") return fallback;
  const text = value.trim();
  if (text.length === 0 || text.length > 400) return fallback;
  if (/\b(?:sk|mk)-/i.test(text)) return fallback;
  return text;
}

function retryAfterSeconds(body: { retryAfterSeconds?: unknown } | null, header: string | null | undefined): number {
  if (typeof body?.retryAfterSeconds === "number" && Number.isFinite(body.retryAfterSeconds)) return Math.max(0, Math.ceil(body.retryAfterSeconds));
  if (header && /^\d+$/.test(header)) return Number(header);
  return 600;
}

/** Maps the route's status onto copy. Every branch sets `retry: false`. */
export function describeRunNowFailure(input: { status: number | "timeout" | "network"; body: unknown; retryAfterHeader?: string | null }): RunNowFailure {
  const body = input.body && typeof input.body === "object" ? (input.body as { error?: unknown; message?: unknown; retryAfterSeconds?: unknown }) : null;
  const error = typeof body?.error === "string" ? body.error : undefined;
  const message = safeText(body?.message, "");

  if (input.status === "timeout") {
    return {
      kind: "timeout",
      title: "The request timed out",
      detail: "Shift may still be running this shift. Check the queue and your nights before starting again. A start that already began counts against the 10-minute limit. This page will not send another run.",
      retry: false,
    };
  }
  if (input.status === "network") {
    return {
      kind: "lost",
      title: "We lost the response",
      detail: "If the run started, it still counts against the 10-minute limit. Check the queue before trying again. This page will not send another run on its own.",
      retry: false,
    };
  }
  if (input.status === 401 || error === "not_signed_in") {
    return { kind: "signed_out", title: "Connect your 0G account", detail: "Run now only starts for the signed-in account.", retry: false };
  }
  if (input.status === 409 && error === "not_connected") {
    return {
      kind: "reconnect",
      title: "This account is not connected",
      detail: message || "This account has no management key stored. Connect again before running.",
      retry: false,
    };
  }
  if (input.status === 409 && error === "no_queued_work") {
    return {
      kind: "no_work",
      title: "Nothing is waiting",
      detail: message || "There is no queued or deferred work for this account. Add a task before running.",
      retry: false,
    };
  }
  if (input.status === 429 || error === "rate_limited") {
    const seconds = retryAfterSeconds(body, input.retryAfterHeader);
    const wait = `Wait ${seconds} seconds before starting another shift. This page will not send another run.`;
    return {
      kind: "rate_limited",
      title: "Run now is limited to once every 10 minutes",
      detail: message ? `${message} ${wait}` : wait,
      retryAfterSeconds: seconds,
      retry: false,
    };
  }
  if (input.status === 503 || error === "storage_unconfigured") {
    return {
      kind: "storage",
      title: "Run now cannot upload outputs",
      detail: message || "The storage signer is not configured, so this shift did not start.",
      retry: false,
    };
  }
  return {
    kind: "failed",
    title: "This shift did not start",
    detail: message || (typeof input.status === "number" && input.status >= 500
      ? "Something went wrong. Check the queue before trying again. This page will not send another run on its own."
      : "The request was not accepted. This page will not send another run on its own."),
    retry: false,
  };
}

const TYPE_LABEL: Record<string, string> = {
  AUDIO_SUMMARY: "Summarize audio",
  DOC_ANALYSIS: "Analyze a document",
  IMAGE_FROM_PROMPT: "Generate an image",
};

const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Waiting for tonight",
  PLANNED: "Planned for tonight",
  RUNNING: "Running",
  DONE: "Done",
  FAILED: "Failed",
  DEFERRED: "Moved to the next night",
  CANCELLED: "Cancelled",
};

const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,180}$/;

const successSchema = z.object({
  nightId: z.string().regex(/^\d+$/),
  status: z.string().min(1),
  runId: z.string().min(1),
  error: z.string().nullable(),
  tasks: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      status: z.string(),
      error: z.string().nullable(),
      chosenModel: z.string().nullable(),
      outputRoot: z.string().nullable(),
      requestIds: z.array(z.string()).optional(),
    }),
  ),
});

export interface PresentedTask {
  id: string;
  label: string;
  status: string;
  statusLabel: string;
  error: string | null;
  verify: Array<{ requestId: string; href: string }>;
}

export interface PresentedRun {
  headline: string;
  detail: string;
  nightId: string;
  nightHref: string;
  tasks: PresentedTask[];
  partial: boolean;
  retry: false;
}

function publicError(value: string | null): string | null {
  if (!value) return null;
  if (/\b(?:sk|mk)-/i.test(value)) return "The stored error is hidden because it contained a key.";
  return value.length > 400 ? `${value.slice(0, 400)}…` : value;
}

function verifyLinks(ids: string[] | undefined): PresentedTask["verify"] {
  const links: PresentedTask["verify"] = [];
  for (const id of ids ?? []) {
    if (!REQUEST_ID.test(id) || /^(?:sk|mk)-/i.test(id) || id.includes("REDACTED")) continue;
    links.push({ requestId: id, href: verifyHref(id) });
  }
  return links;
}

/**
 * Turns a 200 body into what the queue should say.
 * A night row can be finished while individual tasks failed. Those failures stay visible.
 */
export function presentRunNowSuccess(body: unknown): PresentedRun | null {
  const parsed = successSchema.safeParse(body);
  if (!parsed.success) return null;
  const data = parsed.data;
  const tasks: PresentedTask[] = data.tasks.map((task) => ({
    id: task.id,
    label: TYPE_LABEL[task.type] ?? "Task",
    status: task.status,
    statusLabel: STATUS_LABEL[task.status] ?? task.status,
    error: publicError(task.error),
    verify: task.status === "DONE" ? verifyLinks(task.requestIds) : [],
  }));
  const done = tasks.filter((task) => task.status === "DONE").length;
  const failed = tasks.filter((task) => task.status === "FAILED").length;
  const partial = failed > 0 && done > 0;
  const stored = publicError(data.error);
  const extra = stored ? ` ${stored}` : "";

  let headline = "This shift finished";
  let detail = `Open the night to see provenance and verify each result.${extra}`;
  if (data.status === "SKIPPED") {
    headline = "This shift did not run";
    detail = `Shift did not start the work.${extra} Nothing was filled in.`;
  } else if (partial) {
    headline = "Some tasks failed";
    detail = `Some tasks finished and some failed. Verify a finished result from this night. A failed task keeps the error Shift stored.${extra}`;
  } else if (data.status === "FAILED" || (done === 0 && tasks.length > 0)) {
    headline = data.status === "FAILED" ? "This shift failed" : "No task finished";
    detail = `No finished task is ready to verify.${extra} Shift does not fill in a result.`;
  } else if (data.status !== "DONE") {
    headline = `This shift ended as ${data.status}`;
  }

  return {
    headline,
    detail,
    nightId: data.nightId,
    nightHref: `/nights/${data.nightId}`,
    tasks,
    partial,
    retry: false,
  };
}
