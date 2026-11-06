import { createRouterClient, msUntilHardStop, redactString, type PrismaClient, type WorkerConfig } from "@shift/core";
import type { StorageClient } from "@shift/core/storage";
import { prismaPipelineStore } from "./pipeline/prisma-store";
import { runUser, type CatalogCache, type UserRouter } from "./pipeline/runUser";
import type { PipelineStore } from "./pipeline/store";

export interface NightContext {
  config: WorkerConfig;
  nightId: bigint;
  log: (message: string) => void;
  /** Used when `store` is not injected. The cron process always passes the real client. */
  db?: PrismaClient;
  store?: PipelineStore;
  router?: UserRouter;
  storage?: StorageClient;
  now?: () => Date;
  catalogCache?: CatalogCache;
  sleep?: (ms: number) => Promise<void>;
  readFile?: (absolutePath: string) => Promise<Uint8Array>;
}

/**
 * Runs every connected user's tasks for one night (plan §9.2).
 * Users run one after another. Inside a user, tasks run up to `MAX_CONCURRENCY`.
 * Anchoring the batch on-chain is a later step; this function does not mark the night DONE (the caller does)
 * and it does not invent a Merkle root.
 */
export async function runNight(ctx: NightContext): Promise<void> {
  const store = ctx.store ?? prismaPipelineStore(requiredDb(ctx));
  const users = await store.eligibleUsers();
  ctx.log(`night ${ctx.nightId}: ${users.length} connected user(s)`);
  if (users.length === 0) return;

  const now = ctx.now ?? (() => new Date());
  const router = ctx.router ?? createRouterClient({ baseUrl: ctx.config.ZG_ROUTER_BASE_URL });
  const storage = ctx.storage ?? (await defaultStorage(ctx.config));
  const catalogCache = ctx.catalogCache ?? {};

  for (const user of users) {
    if (msUntilHardStop(now(), ctx.config.NIGHT_HARD_STOP_UTC) === 0) {
      ctx.log(`night ${ctx.nightId}: hard stop reached; users not started stay queued`);
      break;
    }
    try {
      await runUser({
        user,
        nightId: ctx.nightId,
        config: ctx.config,
        store,
        router,
        storage,
        log: ctx.log,
        catalogCache,
        now,
        ...(ctx.sleep ? { sleep: ctx.sleep } : {}),
        ...(ctx.readFile ? { readFile: ctx.readFile } : {}),
      });
    } catch (err) {
      // runUser records its own failures. This only catches a failure of that recording, so one user cannot abort the night.
      ctx.log(`night ${ctx.nightId}: user ${user.id} failed before it could be recorded (${err instanceof Error ? redactString(err.message) : "unknown error"})`);
    }
  }
}

function requiredDb(ctx: NightContext): PrismaClient {
  if (!ctx.db) throw new Error("runNight needs a database.");
  return ctx.db;
}

async function defaultStorage(config: WorkerConfig): Promise<StorageClient> {
  const { createStorageClient } = await import("@shift/core/storage");
  return createStorageClient({
    rpcUrl: config.ZG_CHAIN_RPC_URL,
    indexerUrl: config.ZG_STORAGE_INDEXER_URL,
    privateKey: config.OPERATOR_PRIVATE_KEY,
  });
}
