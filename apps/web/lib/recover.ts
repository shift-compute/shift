import "server-only";
import { recoverStuckRuns, type PrismaClient, type RecoverRun, type RecoverTask } from "@shift/core";
import { getDb } from "./server";

/**
 * The web process does not boot the worker sweeper. Run now and process start both call this
 * so a crashed manual run does not stay RUNNING. A night that still has a fresh heartbeat is left alone.
 */
export async function recoverWebInterruptions(db: PrismaClient = getDb(), now: Date = new Date()): Promise<{ runs: string[]; tasks: string[] }> {
  return recoverStuckRuns(prismaRecoverStore(db), now);
}

function prismaRecoverStore(db: PrismaClient): {
  runningRuns(): Promise<RecoverRun[]>;
  failRuns(ids: string[], error: string): Promise<void>;
  runningTasks(): Promise<RecoverTask[]>;
  requeueTasks(ids: string[]): Promise<void>;
} {
  return {
    async runningRuns() {
      const runs = await db.nightRun.findMany({
        where: { status: "RUNNING" },
        select: {
          id: true,
          nightId: true,
          status: true,
          keyRevokedAt: true,
          keyCreatedAt: true,
          night: { select: { startedAt: true } },
        },
      });
      return runs.map((run) => ({
        id: run.id,
        nightId: run.nightId,
        status: run.status,
        keyRevokedAt: run.keyRevokedAt,
        keyCreatedAt: run.keyCreatedAt,
        nightStartedAt: run.night.startedAt,
      }));
    },
    async failRuns(ids, error) {
      if (ids.length === 0) return;
      await db.nightRun.updateMany({ where: { id: { in: ids }, status: "RUNNING" }, data: { status: "FAILED", error } });
    },
    async runningTasks() {
      const tasks = await db.task.findMany({ where: { status: "RUNNING" }, select: { id: true, nightId: true, steps: true } });
      return tasks.map((task) => ({ id: task.id, nightId: task.nightId, steps: task.steps }));
    },
    async requeueTasks(ids) {
      if (ids.length === 0) return;
      await db.task.updateMany({ where: { id: { in: ids }, status: "RUNNING" }, data: { status: "QUEUED" } });
    },
  };
}
