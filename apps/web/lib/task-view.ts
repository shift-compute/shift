import type { Task } from "@shift/core";

const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{7,200}$/;
const SECRET_ID = /^(?:sk|mk)-/i;

/**
 * What the queue keeps after a reload. The upload path and the step trace stay on the server.
 * A failed task's error and any request ids are included so the night can be opened without the POST body.
 */
export function taskView(task: Task) {
  const meta = (task.inputMeta ?? {}) as { bytes?: number; mime?: string };
  return {
    id: task.id,
    type: task.type,
    status: task.status,
    priority: task.priority,
    prompt: task.prompt,
    inputBytes: meta.bytes ?? null,
    chosenModel: task.chosenModel,
    outputRoot: task.outputRoot,
    createdAt: task.createdAt.toISOString(),
    nightId: task.nightId === null ? null : task.nightId.toString(),
    error: publicError(task.error),
    requestIds: requestIdsFromSteps(task.steps),
    actualCostUsdMicro: task.actualCostUsdMicro === null || task.actualCostUsdMicro < 0n ? null : task.actualCostUsdMicro.toString(),
  };
}

function publicError(value: string | null): string | null {
  if (value === null) return null;
  const cleaned = value.replace(/\b(?:sk|mk)-[A-Za-z0-9._[\]-]*/g, "[redacted]").trim();
  if (cleaned.length === 0) return null;
  return cleaned.length <= 500 ? cleaned : `${cleaned.slice(0, 499)}…`;
}

/** Request ids only. Traces and key-shaped values are dropped. */
export function requestIdsFromSteps(steps: unknown): string[] {
  if (!Array.isArray(steps)) return [];
  const ids: string[] = [];
  for (const step of steps) {
    if (!step || typeof step !== "object") continue;
    const raw = (step as { requestId?: unknown }).requestId;
    if (typeof raw !== "string") continue;
    const id = raw.trim();
    if (!REQUEST_ID.test(id) || SECRET_ID.test(id) || ids.includes(id)) continue;
    ids.push(id);
  }
  return ids;
}
