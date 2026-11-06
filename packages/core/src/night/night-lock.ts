/** The slice of the Prisma client the lock needs. Keeping it narrow makes the lock testable without a database. */
export interface NightStore {
  night: {
    upsert(args: { where: { id: bigint }; create: { id: bigint }; update: Record<string, never> }): Promise<unknown>;
    updateMany(args:
      | {
          where: { id: bigint; OR: Array<{ status: "PENDING" } | { status: "RUNNING"; startedAt: { lt: Date } }> };
          data: { status: "RUNNING"; startedAt: Date; finishedAt: null };
        }
      | {
          where: { id: bigint; status: "RUNNING" };
          data: { startedAt: Date };
        },
    ): Promise<{ count: number }>;
  };
}

/**
 * A RUNNING night with no heartbeat for this long belongs to a crashed worker.
 * The window is 50 minutes, so the old 90 minute threshold could never be reached inside it.
 */
export const STALE_RUNNING_MS = 10 * 60_000;

/** How often a live night refreshes `startedAt` so another process does not treat it as stale. */
export const HEARTBEAT_MS = 60_000;

/**
 * Tries to take the night for this process: `UPDATE ... WHERE status = 'PENDING'` (plan §9.1).
 * Returns false when another instance already holds it or the night is finished.
 * A FAILED night is not retaken: retrying every minute could spend credits again and again. A RUNNING one is taken over
 * only after it has had no heartbeat for `STALE_RUNNING_MS`.
 */
export async function acquireNight(db: NightStore, nightId: bigint, now: Date = new Date()): Promise<boolean> {
  await db.night.upsert({ where: { id: nightId }, create: { id: nightId }, update: {} });
  const { count } = await db.night.updateMany({
    where: { id: nightId, OR: [{ status: "PENDING" }, { status: "RUNNING", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } }] },
    data: { status: "RUNNING", startedAt: now, finishedAt: null },
  });
  return count === 1;
}

/**
 * Refreshes `startedAt` while this process owns the night. `startedAt` is the heartbeat:
 * a live night stays newer than `STALE_RUNNING_MS`, and a dead one can be retaken inside the window.
 * The timer is unref'd so it does not keep the process alive after the night ends; call the returned stop.
 */
export function startNightHeartbeat(db: NightStore, nightId: bigint, intervalMs = HEARTBEAT_MS, now: () => Date = () => new Date()): () => void {
  const timer = setInterval(() => {
    void db.night
      .updateMany({
        where: { id: nightId, status: "RUNNING" },
        data: { startedAt: now() },
      })
      .catch(() => undefined);
  }, intervalMs);
  if (typeof timer.unref === "function") timer.unref();
  return () => clearInterval(timer);
}
