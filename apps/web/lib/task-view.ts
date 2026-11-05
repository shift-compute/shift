import type { Task } from "@shift/core";

/** What the queue UI needs about a task. Paths, raw errors and internal steps stay on the server. */
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
  };
}
