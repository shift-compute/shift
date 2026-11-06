import {
  PrismaClient,
  openSecret,
  recoverInterruptedRuns,
  recoverInterruptedTasks,
  redactString,
  stepsHaveRequestId,
  sweepOrphanedKeys,
  type KeyClient,
  type OrphanKey,
  type RecoverRun,
} from "@shift/core";

export { recoverInterruptedRuns, recoverInterruptedTasks, stepsHaveRequestId };

/** node-cron schedule: minute 0, 10, 20, 30, 40 and 50. Plan §8.3. */
export const SWEEP_CRON = "*/10 * * * *";

/** Same cutoff as `sweepOrphanedKeys`: a key is old enough once it has been alive for 2 hours. */
export const ORPHAN_MIN_AGE_MS = 2 * 60 * 60 * 1000;

/** A connected user's sealed management key. The plaintext is decrypted only inside the sweep. */
export interface SweepUser {
  id: string;
  accountAddress: string;
  mkCiphertext: Buffer | null;
  mkIv: Buffer | null;
  mkAuthTag: Buffer | null;
}

/** A night run whose ephemeral key has not been marked revoked. */
export interface LiveKey {
  runId: string;
  keyId: string;
  keyCreatedAt: Date;
  user: SweepUser;
}

export interface RunningTaskRow {
  id: string;
  steps: unknown;
}

/**
 * What the sweeper reads and writes. Production uses Prisma; tests use an in-memory store.
 * The store never sees a decrypted management key.
 */
export interface SweeperStore {
  /**
   * Alive keys (`ephemeralKeyId` set, `keyRevokedAt` null).
   * `createdBefore` is the newest creation time the caller is willing to revoke.
   * A store may ignore it and return younger rows; the sweeper drops those before decrypting.
   */
  liveKeys(createdBefore: Date): Promise<LiveKey[]>;
  markRevoked(keyIds: string[], revokedAt: Date): Promise<void>;
  runningTasks(): Promise<RunningTaskRow[]>;
  /** Sets these tasks back to QUEUED only while they are still RUNNING. */
  requeueTasks(ids: string[]): Promise<void>;
  runningRuns(): Promise<RecoverRun[]>;
  /** Sets these runs to FAILED only while they are still RUNNING. */
  failRuns(ids: string[], error: string): Promise<void>;
}

export interface SweepDeps {
  store: SweeperStore;
  keys: KeyClient;
  masterKey: string;
  now?: () => Date;
  minAgeMs?: number;
  sleep?: (ms: number) => Promise<void>;
  attempts?: number;
  log?: (message: string) => void;
}

export interface SweepOutcome {
  revoked: string[];
  failed: string[];
  skipped: string[];
}

/**
 * Revokes ephemeral keys that are still marked alive and are at least `minAgeMs` old (default 2 hours).
 * The management key is decrypted per user, passed only to `sweepOrphanedKeys`, and dropped before returning.
 * A key is stamped `keyRevokedAt` only after the Router revoke succeeds. Failures stay unstamped for the next sweep.
 */
export async function sweepEphemeralKeys(deps: SweepDeps): Promise<SweepOutcome> {
  const now = deps.now?.() ?? new Date();
  const minAgeMs = deps.minAgeMs ?? ORPHAN_MIN_AGE_MS;
  const cutoff = new Date(now.getTime() - minAgeMs);
  const say = (message: string) => deps.log?.(redactString(message));

  const rows = await deps.store.liveKeys(cutoff);
  const skipped: string[] = [];
  const failed: string[] = [];
  const orphans: OrphanKey[] = [];
  const opened = new Map<string, string | null>();

  try {
    for (const row of rows) {
      if (row.keyCreatedAt.getTime() > cutoff.getTime()) {
        skipped.push(row.keyId);
        continue;
      }
      const mk = managementKey(opened, row.user, deps.masterKey);
      if (!mk) {
        failed.push(row.keyId);
        say(`sweep: user ${row.user.id} key ${row.keyId} left alive; the management key could not be opened`);
        continue;
      }
      orphans.push({ keyId: row.keyId, mk, createdAt: row.keyCreatedAt });
    }

    const report = await sweepOrphanedKeys(deps.keys, orphans, {
      now,
      minAgeMs,
      ...(deps.sleep ? { sleep: deps.sleep } : {}),
      ...(deps.attempts !== undefined ? { attempts: deps.attempts } : {}),
    });
    if (report.revoked.length > 0) await deps.store.markRevoked(report.revoked, now);
    for (const item of report.failed) {
      const message = item.error instanceof Error ? item.error.message : "revoke failed";
      say(`sweep: key ${item.keyId} left alive; revoke failed: ${message}`);
    }

    say(`sweep: revoked ${report.revoked.length}, failed ${report.failed.length + failed.length}, skipped ${report.skipped.length + skipped.length}`);
    return {
      revoked: report.revoked,
      failed: [...failed, ...report.failed.map((item) => item.keyId)],
      skipped: [...skipped, ...report.skipped],
    };
  } finally {
    for (const orphan of orphans) orphan.mk = "";
    opened.clear();
  }
}

/** Runs `run` unless a previous call is still in progress. Overlapping cron ticks must not revoke twice. */
export function createSweepLock(run: () => Promise<void>): () => Promise<boolean> {
  let active = false;
  return async () => {
    if (active) return false;
    active = true;
    try {
      await run();
      return true;
    } finally {
      active = false;
    }
  };
}

function managementKey(opened: Map<string, string | null>, user: SweepUser, masterKey: string): string | null {
  const cached = opened.get(user.id);
  if (cached !== undefined) return cached;
  const mk = openManagementKey(user, masterKey);
  opened.set(user.id, mk);
  return mk;
}

/** Decrypts in memory. A missing or unreadable vault returns null and never throws the ciphertext. */
function openManagementKey(user: SweepUser, masterKey: string): string | null {
  if (!user.mkCiphertext || !user.mkIv || !user.mkAuthTag) return null;
  try {
    return openSecret(
      { ciphertext: user.mkCiphertext, iv: user.mkIv, authTag: user.mkAuthTag },
      masterKey,
      user.accountAddress.toLowerCase(),
    );
  } catch {
    return null;
  }
}

function asBuffer(value: Uint8Array | null): Buffer | null {
  return value ? Buffer.from(value) : null;
}

/** Prisma backing for the sweeper. Reads sealed keys only; revocation goes through `sweepEphemeralKeys`. */
export function prismaSweeperStore(db: PrismaClient): SweeperStore {
  return {
    async liveKeys(createdBefore) {
      const runs = await db.nightRun.findMany({
        where: {
          ephemeralKeyId: { not: null },
          keyRevokedAt: null,
          keyCreatedAt: { not: null, lte: createdBefore },
        },
        select: {
          id: true,
          ephemeralKeyId: true,
          keyCreatedAt: true,
          user: {
            select: { id: true, accountAddress: true, mkCiphertext: true, mkIv: true, mkAuthTag: true },
          },
        },
      });
      const live: LiveKey[] = [];
      for (const run of runs) {
        if (!run.ephemeralKeyId || !run.keyCreatedAt) continue;
        live.push({
          runId: run.id,
          keyId: run.ephemeralKeyId,
          keyCreatedAt: run.keyCreatedAt,
          user: {
            id: run.user.id,
            accountAddress: run.user.accountAddress,
            mkCiphertext: asBuffer(run.user.mkCiphertext),
            mkIv: asBuffer(run.user.mkIv),
            mkAuthTag: asBuffer(run.user.mkAuthTag),
          },
        });
      }
      return live;
    },

    async markRevoked(keyIds, revokedAt) {
      if (keyIds.length === 0) return;
      await db.nightRun.updateMany({
        where: { ephemeralKeyId: { in: keyIds }, keyRevokedAt: null },
        data: { keyRevokedAt: revokedAt },
      });
    },

    async runningTasks() {
      const tasks = await db.task.findMany({
        where: { status: "RUNNING" },
        select: { id: true, steps: true },
      });
      return tasks.map((task) => ({ id: task.id, steps: task.steps }));
    },

    async requeueTasks(ids) {
      if (ids.length === 0) return;
      await db.task.updateMany({
        where: { id: { in: ids }, status: "RUNNING" },
        data: { status: "QUEUED" },
      });
    },

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
      await db.nightRun.updateMany({
        where: { id: { in: ids }, status: "RUNNING" },
        data: { status: "FAILED", error },
      });
    },
  };
}
