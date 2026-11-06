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
export function runGate(input: {
  pending: boolean;
  openCount: number | null;
  queueFailed: boolean;
  previewPhase: PreviewPhase;
  /** An unclear POST already happened. Do not send another one from this page. */
  held?: boolean;
}): RunClick {
  if (input.pending) return { action: "ignore" };
  if (input.held) return { action: "wait" };
  if (input.queueFailed) return { action: "wait" };
  if (input.openCount === null) return { action: "wait" };
  if (input.openCount === 0) {
    return { action: "blocked", message: "There is no queued or deferred work for this account. Add a task before running." };
  }
  if (input.previewPhase === "reconnect") {
    return { action: "blocked", message: "Your management key is no longer valid. Connect again before running." };
  }
  // A loading or failed preview has not confirmed a price. The saved cap stays on the server either way.
  if (input.previewPhase !== "ready") return { action: "wait" };
  return { action: "start" };
}

export function eligibilityCopy(openCount: number | null, queueFailed: boolean, previewPhase: PreviewPhase = "ready", held = false): string {
  if (held) {
    return "The last response was not a clear result. Credits may already have been spent, up to the cap saved on the account for this run. This page reloaded the queue and will not send another run.";
  }
  if (queueFailed) return "We could not load your queue, so Run now stays off. This page will not start a run.";
  if (openCount === null) return "Loading your queue…";
  if (openCount === 0) return "Nothing is queued or deferred. Add a task before running. This does not spend credits.";
  if (previewPhase === "reconnect") return "Your management key is no longer valid. Connect again before running. This page will not start a run.";
  if (previewPhase === "loading") return "Loading the preview. Run now stays off until it loads. No price is confirmed yet.";
  if (previewPhase !== "ready") {
    return "The preview could not be read, so this page is not confirming a price and will not start a run. The cap saved on the account is what a run is allowed to spend, and that cap applies to each run. Reload the queue to read the preview again.";
  }
  const noun = openCount === 1 ? "task is" : "tasks are";
  return `${openCount} ${noun} waiting. Run now spends real credits on this run, up to the cap saved on the account. That cap is not a daily pool: another run can spend it again. The figures below are a preview, not a receipt. This page does not start a second run by itself.`;
}

/**
 * Preview figures only. Absent unless the preview succeeded, so a loading or failed preview cannot look confirmed.
 * `budgetMicro` is what this run may spend (the saved cap, clamped by the live balance), not a daily remainder.
 */
export function estimateCopy(panel: PreviewPanel | { phase: "loading" }): string | null {
  if (panel.phase !== "ready") return null;
  const preview = panel.preview;
  return `Preview for this run: budget ${formatAmount(preview.budgetMicro, "usd")}, estimated spend ${formatAmount(preview.spentEstimateMicro, "usd")}, left for the commons queue ${formatAmount(preview.remainingMicro, "usd")}. The cap saved on the account applies again to the next run.`;
}

export interface RunNowFailure {
  kind: "signed_out" | "reconnect" | "no_work" | "rate_limited" | "storage" | "timeout" | "lost" | "failed" | "unknown";
  title: string;
  detail: string;
  retryAfterSeconds?: number;
  /** A spending start is never repeated from this page. */
  retry: false;
  /**
   * True when this response does not prove whether credits were spent.
   * The page reloads the queue and does not send another POST.
   */
  ambiguous: boolean;
}

/** 5xx and a 200 this page cannot read. The run may already have spent the saved cap. */
export function unknownRunOutcome(): RunNowFailure {
  return {
    kind: "unknown",
    title: "This page does not know if the shift started",
    detail:
      "The response was not a clear result. Credits may already have been spent, up to the cap saved on the account for this run. That cap applies to each run, not once per day. The queue will be reloaded from the server. This page will not send another run.",
    retry: false,
    ambiguous: true,
  };
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
      detail: "Shift may still be running this shift, and credits may already have been spent. Check the queue and your nights. A start that already began counts against the 10-minute limit. This page will not send another run.",
      retry: false,
      ambiguous: true,
    };
  }
  if (input.status === "network") {
    return {
      kind: "lost",
      title: "We lost the response",
      detail: "If the run started, credits may already have been spent and it still counts against the 10-minute limit. Check the queue before trying again. This page will not send another run on its own.",
      retry: false,
      ambiguous: true,
    };
  }
  if (input.status === 401 || error === "not_signed_in") {
    return { kind: "signed_out", title: "Connect your 0G account", detail: "Run now only starts for the signed-in account. This request did not start a run.", retry: false, ambiguous: false };
  }
  if (input.status === 409 && error === "not_connected") {
    return {
      kind: "reconnect",
      title: "This account is not connected",
      detail: message || "This account has no management key stored. Connect again before running. This request did not start a run.",
      retry: false,
      ambiguous: false,
    };
  }
  if (input.status === 409 && error === "no_queued_work") {
    return {
      kind: "no_work",
      title: "Nothing is waiting",
      detail: message || "There is no queued or deferred work for this account. Add a task before running. This request did not start a run.",
      retry: false,
      ambiguous: false,
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
      ambiguous: false,
    };
  }
  if (error === "storage_unconfigured") {
    return {
      kind: "storage",
      title: "Run now cannot upload outputs",
      detail: `${message || "The storage signer is not configured."} This request did not start a run.`,
      retry: false,
      ambiguous: false,
    };
  }
  // 5xx, a proxy timeout (408), or nginx's client-closed 499: the handler may still be spending.
  // A Railway 499 log does not say whether the browser saw that status or the socket just died.
  if (typeof input.status === "number" && (input.status >= 500 || input.status === 408 || input.status === 499)) return unknownRunOutcome();
  return {
    kind: "failed",
    title: "This request was not accepted",
    detail: message || "The request was not accepted. This page will not send another run on its own.",
    retry: false,
    ambiguous: false,
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
