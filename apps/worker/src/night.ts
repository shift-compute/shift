import { anchorNight, createLedgerClient, createRouterClient, msUntilHardStop, prismaAnchorStore, prismaPipelineStore, redactString, runUser, type AnchorStore, type CatalogCache, type LedgerClient, type PipelineStore, type PrismaClient, type UserRouter, type WorkerConfig } from "@shift/core";
import type { StorageClient } from "@shift/core/storage";

export interface NightContext {
  config: WorkerConfig;
  nightId: bigint;
  log: (message: string) => void;
  /** Used when `store` is not injected. The cron process always passes the real client. */
  db?: PrismaClient;
  store?: PipelineStore;
  router?: UserRouter;
  storage?: StorageClient;
  /** DONE tasks for the anchor. Unset in production: the night reads them from `db`. */
  anchorStore?: AnchorStore;
  /** Signs `anchorNight`. Unset in production: built from the operator key. Tests pass a fake and never broadcast. */
  ledger?: LedgerClient;
  now?: () => Date;
  catalogCache?: CatalogCache;
  sleep?: (ms: number) => Promise<void>;
  readFile?: (absolutePath: string) => Promise<Uint8Array>;
}

/**
 * Runs every connected user's tasks for one night, then anchors the batch (plan §9.2).
 * Users run one after another. Inside a user, tasks run up to `MAX_CONCURRENCY`.
 * An empty batch does not upload a manifest and does not send a transaction.
 * This function does not mark the night DONE; the caller does, and that update keeps the root and tx written here.
 */
export async function runNight(ctx: NightContext): Promise<void> {
  const store = ctx.store ?? prismaPipelineStore(requiredDb(ctx));
  const users = await store.eligibleUsers();
  ctx.log(`night ${ctx.nightId}: ${users.length} connected user(s)`);

  let storage = ctx.storage;
  if (users.length > 0) {
    const now = ctx.now ?? (() => new Date());
    const router = ctx.router ?? createRouterClient({ baseUrl: ctx.config.ZG_ROUTER_BASE_URL });
    const client = storage ?? (await defaultStorage(ctx.config));
    storage = client;
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
          storage: client,
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

  await finishAnchor(ctx, storage);
}

async function finishAnchor(ctx: NightContext, storage: StorageClient | undefined): Promise<void> {
  const anchorStore = ctx.anchorStore ?? (ctx.db ? prismaAnchorStore(ctx.db) : undefined);
  if (!anchorStore) return;
  const client = storage ?? (await defaultStorage(ctx.config));
  const ledger = ctx.ledger ?? createLedgerClient({
    rpcUrl: ctx.config.ZG_CHAIN_RPC_URL,
    chainId: ctx.config.ZG_CHAIN_ID,
    address: ctx.config.LEDGER_CONTRACT_ADDRESS,
    privateKey: ctx.config.OPERATOR_PRIVATE_KEY,
  });
  await anchorNight({
    nightId: ctx.nightId,
    store: anchorStore,
    storage: client,
    ledger,
    chainId: ctx.config.ZG_CHAIN_ID,
    contractAddress: ctx.config.LEDGER_CONTRACT_ADDRESS,
    log: ctx.log,
    ...(ctx.now ? { now: ctx.now } : {}),
  });
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
