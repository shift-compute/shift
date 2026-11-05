/** The slice of the Prisma client the lock needs. Keeping it narrow makes the lock testable without a database. */
export interface NightStore {
  night: {
    upsert(args: { where: { id: bigint }; create: { id: bigint }; update: Record<string, never> }): Promise<unknown>;
    updateMany(args: {
      where: { id: bigint; OR: Array<{ status: "PENDING" } | { status: "RUNNING"; startedAt: { lt: Date } }> };
      data: { status: "RUNNING"; startedAt: Date; finishedAt: null };
    }): Promise<{ count: number }>;
  };
}

/** A night stuck in RUNNING longer than this is assumed to belong to a crashed worker. The window itself is 50 minutes. */
export const STALE_RUNNING_MS = 90 * 60_000;

/**
 * Tries to take the night for this process: `UPDATE ... WHERE status = 'PENDING'` (plan §9.1).
 * Returns false when another instance already holds it or the night is finished.
 * A FAILED night is not retaken: retrying every minute could spend credits again and again. A RUNNING one is taken over
 * only after it has been stuck for `STALE_RUNNING_MS`.
 */
export async function acquireNight(db: NightStore, nightId: bigint, now: Date = new Date()): Promise<boolean> {
  await db.night.upsert({ where: { id: nightId }, create: { id: nightId }, update: {} });
  const { count } = await db.night.updateMany({
    where: { id: nightId, OR: [{ status: "PENDING" }, { status: "RUNNING", startedAt: { lt: new Date(now.getTime() - STALE_RUNNING_MS) } }] },
    data: { status: "RUNNING", startedAt: now, finishedAt: null },
  });
  return count === 1;
}
