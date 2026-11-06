import { STALE_RUNNING_MS } from "../night/night-lock";
import { z } from "zod";

/** A crashed run is closed with this text. It is not a Router error and it does not hide a paid call. */
export const INTERRUPTED_RUN_ERROR = "Interrupted before the run finished.";

const recordedStep = z.object({ requestId: z.string().optional() }).passthrough();
const stepList = z.array(z.unknown());

/**
 * True when any step stored on the task carries a Router request id.
 * An empty or blank id does not count: the call was not recorded, so the task may be run again.
 */
export function stepsHaveRequestId(steps: unknown): boolean {
  const parsed = stepList.safeParse(steps);
  if (!parsed.success) return false;
  return parsed.data.some((item) => {
    const step = recordedStep.safeParse(item);
    if (!step.success) return false;
    const id = step.data.requestId?.trim();
    return id !== undefined && id.length > 0;
  });
}

export interface RecoverTask {
  id: string;
  steps: unknown;
  nightId?: bigint | null;
}

export interface RecoverRun {
  id: string;
  status: string;
  nightId: bigint;
  keyRevokedAt: Date | null;
  keyCreatedAt: Date | null;
  /** `Night.startedAt`. The worker refreshes it every minute. A manual run does not. */
  nightStartedAt: Date | null;
}

/**
 * A RUNNING night run that can no longer be the live one.
 * A revoked key is finished. A missing night clock, or a night with no heartbeat for `staleMs`, is a crash.
 * A live worker night refreshes `startedAt` inside `STALE_RUNNING_MS`, so this does not close it.
 */
export function nightRunIsStuck(run: RecoverRun, now: Date, staleMs = STALE_RUNNING_MS): boolean {
  if (run.status !== "RUNNING") return false;
  if (run.keyRevokedAt) return true;
  if (!run.nightStartedAt) return true;
  return now.getTime() - run.nightStartedAt.getTime() >= staleMs;
}

/** Plan §9.4. RUNNING tasks with no Router request id go back to QUEUED. Tasks that already recorded one stay RUNNING. */
export async function recoverInterruptedTasks(store: {
  runningTasks(): Promise<RecoverTask[]>;
  requeueTasks(ids: string[]): Promise<void>;
}): Promise<string[]> {
  const running = await store.runningTasks();
  const ids = running.filter((task) => !stepsHaveRequestId(task.steps)).map((task) => task.id);
  if (ids.length > 0) await store.requeueTasks(ids);
  return ids;
}

/** Closes every RUNNING night run. Call this when the process that owned those runs has just started. */
export async function recoverInterruptedRuns(store: {
  runningRuns(): Promise<Array<Pick<RecoverRun, "id" | "status">>>;
  failRuns(ids: string[], error: string): Promise<void>;
}): Promise<string[]> {
  const ids = (await store.runningRuns()).filter((run) => run.status === "RUNNING").map((run) => run.id);
  if (ids.length > 0) await store.failRuns(ids, INTERRUPTED_RUN_ERROR);
  return ids;
}

/**
 * Closes stuck RUNNING runs and requeues their tasks that never received a request id.
 * A run that still has a fresh night heartbeat is left alone, so a live worker night is not cancelled.
 */
export async function recoverStuckRuns(
  store: {
    runningRuns(): Promise<RecoverRun[]>;
    failRuns(ids: string[], error: string): Promise<void>;
    runningTasks(): Promise<RecoverTask[]>;
    requeueTasks(ids: string[]): Promise<void>;
  },
  now: Date,
): Promise<{ runs: string[]; tasks: string[] }> {
  const stuck = (await store.runningRuns()).filter((run) => nightRunIsStuck(run, now));
  const nights = new Set(stuck.map((run) => run.nightId.toString()));
  if (stuck.length > 0) await store.failRuns(stuck.map((run) => run.id), INTERRUPTED_RUN_ERROR);
  const tasks = await store.runningTasks();
  const ids = tasks
    .filter((task) => {
      if (stepsHaveRequestId(task.steps)) return false;
      if (task.nightId == null) return true;
      return nights.has(task.nightId.toString());
    })
    .map((task) => task.id);
  if (ids.length > 0) await store.requeueTasks(ids);
  return { runs: stuck.map((run) => run.id), tasks: ids };
}
