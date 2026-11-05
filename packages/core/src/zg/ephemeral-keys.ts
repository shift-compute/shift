import type { RouterClient, TrustMode } from "./router";

/** The part of the Router client the key lifecycle needs. */
export type KeyClient = Pick<RouterClient, "createApiKey" | "revokeApiKey">;

export interface KeyRecord {
  keyId: string;
  createdAt: Date;
}

export interface LifecycleHooks {
  /** Persist the key id BEFORE the key is used, so a crash can never leave an untracked key (plan §8.2). */
  onCreated(record: KeyRecord): Promise<void>;
  onRevoked?(record: KeyRecord & { revokedAt: Date }): Promise<void>;
  /** Called when every revocation attempt failed; the sweeper will retry later. */
  onRevokeFailed?(record: KeyRecord, error: unknown): Promise<void>;
}

export interface EphemeralKeyParams {
  /** Management key of the user. Used only to create and revoke. */
  mk: string;
  /** Night id (YYYYMMDD or a manual run id) and run id; they build the key name `shift-<nightId>-<runId>`. */
  nightId: string;
  runId: string;
  /** `credit_limit` for the key: a decimal string in the account's currency units (0G units for 0G accounts). */
  budget: string;
  trustMode?: TrustMode;
}

export interface EphemeralKeyResult<T> {
  result: T;
  keyId: string;
  /** False only if every revocation attempt failed. The key is then left to the sweeper. */
  revoked: boolean;
}

export interface RevokeOptions {
  attempts?: number;
  sleep?: (ms: number) => Promise<void>;
  now?: () => Date;
}

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Keeps a key name readable and within a safe alphabet and length. */
export function ephemeralKeyName(nightId: string, runId: string): string {
  const clean = (s: string, max: number) => s.toLowerCase().replace(/[^a-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, max);
  return `shift-${clean(nightId, 24)}-${clean(runId, 24)}`;
}

async function revokeWithRetries(client: KeyClient, mk: string, keyId: string, opts: RevokeOptions): Promise<{ ok: true } | { ok: false; error: unknown }> {
  const attempts = opts.attempts ?? 3;
  const sleep = opts.sleep ?? defaultSleep;
  let lastError: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      await client.revokeApiKey(mk, keyId);
      return { ok: true };
    } catch (err) {
      lastError = err;
      if (i < attempts) await sleep(1000 * i);
    }
  }
  return { ok: false, error: lastError };
}

/**
 * Creates a capped, ephemeral sk- key, hands it to `use`, and always revokes it afterwards.
 * Order: create → `onCreated` (persist the id) → use → revoke → `onRevoked`.
 * The secret is only ever passed to `use`; it is not stored or returned.
 * If `use` throws, its error is rethrown after revocation, never masked by a revocation problem.
 */
export async function withEphemeralKey<T>(
  client: KeyClient,
  params: EphemeralKeyParams,
  hooks: LifecycleHooks,
  use: (sk: string, keyId: string) => Promise<T>,
  opts: RevokeOptions = {},
): Promise<EphemeralKeyResult<T>> {
  const now = opts.now ?? (() => new Date());
  const created = await client.createApiKey(params.mk, {
    name: ephemeralKeyName(params.nightId, params.runId),
    trustMode: params.trustMode ?? "private",
    creditLimit: params.budget,
  });
  const record: KeyRecord = { keyId: created.data.key_id, createdAt: now() };

  const finish = async (): Promise<boolean> => {
    const outcome = await revokeWithRetries(client, params.mk, record.keyId, opts);
    if (outcome.ok) {
      await hooks.onRevoked?.({ ...record, revokedAt: now() });
      return true;
    }
    await hooks.onRevokeFailed?.(record, outcome.error);
    return false;
  };

  let result: T;
  try {
    await hooks.onCreated(record);
    result = await use(created.data.key, record.keyId);
  } catch (err) {
    await finish();
    throw err;
  }
  const revoked = await finish();
  return { result, keyId: record.keyId, revoked };
}

export interface OrphanKey {
  keyId: string;
  /** Already decrypted by the caller; used only to revoke. */
  mk: string;
  createdAt: Date;
}

export interface SweepReport {
  revoked: string[];
  failed: Array<{ keyId: string; error: unknown }>;
  /** Keys younger than the minimum age: they may still be in use by a running batch. */
  skipped: string[];
}

const TWO_HOURS_MS = 2 * 60 * 60 * 1000;

/**
 * Revokes keys that were created but never marked revoked (plan §8.3, point 3).
 * Only keys older than `minAgeMs` (default 2 hours) are touched.
 */
export async function sweepOrphanedKeys(
  client: KeyClient,
  orphans: OrphanKey[],
  options: { now?: Date; minAgeMs?: number } & Omit<RevokeOptions, "now"> = {},
): Promise<SweepReport> {
  const now = options.now ?? new Date();
  const minAge = options.minAgeMs ?? TWO_HOURS_MS;
  const report: SweepReport = { revoked: [], failed: [], skipped: [] };
  for (const orphan of orphans) {
    if (now.getTime() - orphan.createdAt.getTime() < minAge) {
      report.skipped.push(orphan.keyId);
      continue;
    }
    const outcome = await revokeWithRetries(client, orphan.mk, orphan.keyId, { attempts: options.attempts, sleep: options.sleep });
    if (outcome.ok) report.revoked.push(orphan.keyId);
    else report.failed.push({ keyId: orphan.keyId, error: outcome.error });
  }
  return report;
}
