import {
  anchorNight,
  createLedgerClient,
  manualNightId,
  prismaAnchorStore,
  prismaPipelineStore,
  redact,
  redactString,
  runUser,
  type ConnectedUser,
  type PipelineStore,
  type PrismaClient,
  type RateLimitResult,
  type RunConfig,
  type RunUserOutcome,
  type UserRouter,
} from "@shift/core";
import type { StorageClient } from "@shift/core/storage";
import { StorageKeyError } from "./operator-key";

/** One pipeline start per user. Plan §19.5. */
export const RUN_NOW_LIMIT = 1;
export const RUN_NOW_WINDOW_MS = 10 * 60_000;

export interface RunNowUser {
  id: string;
  accountAddress: string;
  mode: ConnectedUser["mode"];
  nightlyBudgetUsdMicro: bigint | null;
  donateLeftover: boolean;
  mkCiphertext: Uint8Array | null;
  mkIv: Uint8Array | null;
  mkAuthTag: Uint8Array | null;
}

export interface RunNowTaskView {
  id: string;
  type: string;
  status: string;
  error: string | null;
  chosenModel: string | null;
  outputRoot: string | null;
}

export interface RunNowSummary {
  nightId: string;
  status: RunUserOutcome["status"];
  runId: string;
  error: string | null;
  tasks: RunNowTaskView[];
}

export type RunNowResult =
  | { status: 401; body: { error: "not_signed_in" } }
  | { status: 429; body: { error: "rate_limited"; retryAfterSeconds: number; message: string } }
  | { status: 409; body: { error: "not_connected" | "no_queued_work"; message: string } }
  | { status: 503; body: { error: "storage_unconfigured"; message: string } }
  | { status: 200; body: RunNowSummary }
  | { status: 500; body: { error: "internal_error" } };

export interface RunNowDeps {
  user: RunNowUser | null;
  limiter: { check(userId: string): RateLimitResult };
  /** QUEUED and DEFERRED tasks, the same set `runUser` will load. */
  countOpenTasks: (userId: string) => Promise<number>;
  /** Throws StorageKeyError when this process cannot pay for 0G Storage. */
  ensureStorage: () => void;
  now?: () => Date;
  log?: (message: string) => void;
  /** The real `runUser` for this user and night. Tests pass a fake; the route does not. */
  run: (user: ConnectedUser, nightId: bigint) => Promise<RunNowSummary>;
}

/**
 * Decides whether this request may start the shared pipeline.
 * A missing session, a missing key, an empty queue, or a missing storage signer does not consume the 10-minute window
 * and does not call the Router. The window applies to pipeline starts, which are what spend credits.
 */
export async function executeRunNow(deps: RunNowDeps): Promise<RunNowResult> {
  if (!deps.user) return { status: 401, body: { error: "not_signed_in" } };

  const connected = asConnected(deps.user);
  if (!connected) {
    return { status: 409, body: { error: "not_connected", message: "This account has no management key stored. Connect again before running." } };
  }

  const open = await deps.countOpenTasks(connected.id);
  if (open === 0) {
    return { status: 409, body: { error: "no_queued_work", message: "There is no queued or deferred work for this account. Add a task before running." } };
  }

  try {
    deps.ensureStorage();
  } catch (err) {
    if (err instanceof StorageKeyError) {
      return { status: 503, body: { error: "storage_unconfigured", message: "Run now cannot upload outputs because the storage signer is not configured." } };
    }
    throw err;
  }

  const limit = deps.limiter.check(connected.id);
  if (!limit.allowed) {
    return {
      status: 429,
      body: {
        error: "rate_limited",
        retryAfterSeconds: limit.retryAfterSeconds,
        message: "Run now is limited to once every 10 minutes.",
      },
    };
  }

  const nightId = manualNightId((deps.now ?? (() => new Date()))());
  try {
    const summary = await deps.run(connected, nightId);
    return { status: 200, body: redact({ ...summary, nightId: nightId.toString() }) };
  } catch (err) {
    (deps.log ?? (() => undefined))(redactString(err instanceof Error ? err.message : "unknown error"));
    return { status: 500, body: { error: "internal_error" } };
  }
}

export interface ManualRunHooks {
  beginNight(nightId: bigint, now: Date): Promise<void>;
  finishNight(nightId: bigint, status: "DONE" | "FAILED", now: Date): Promise<void>;
  readBack(nightId: bigint, userId: string, runId: string): Promise<{ error: string | null; tasks: RunNowTaskView[] }>;
}

/**
 * One user's manual night on the shared pipeline. `runUser` is the same function the worker calls.
 */
export async function executeManualRun(deps: {
  user: ConnectedUser;
  nightId: bigint;
  config: RunConfig;
  store: PipelineStore;
  router: UserRouter;
  storage: StorageClient;
  hooks: ManualRunHooks;
  /** Same anchor as the nightly worker. Tests omit it; a manual run with real tasks passes it. */
  anchor?: (nightId: bigint) => Promise<unknown>;
  log: (message: string) => void;
  now?: () => Date;
}): Promise<RunNowSummary> {
  const now = deps.now ?? (() => new Date());
  await deps.hooks.beginNight(deps.nightId, now());
  try {
    const outcome = await runUser({
      user: deps.user,
      nightId: deps.nightId,
      config: deps.config,
      store: deps.store,
      router: deps.router,
      storage: deps.storage,
      log: deps.log,
      now,
    });
    await deps.anchor?.(deps.nightId);
    const back = await deps.hooks.readBack(deps.nightId, deps.user.id, outcome.runId);
    // The night row is the batch. A user's FAILED or SKIPPED run is still a finished batch; the summary carries that status.
    await deps.hooks.finishNight(deps.nightId, "DONE", now());
    return { nightId: deps.nightId.toString(), status: outcome.status, runId: outcome.runId, error: back.error, tasks: back.tasks };
  } catch (err) {
    await deps.hooks.finishNight(deps.nightId, "FAILED", now()).catch(() => undefined);
    throw err;
  }
}

/** Production wiring: Prisma for the night row, and the real `runUser`. */
export async function runCurrentUser(deps: {
  db: PrismaClient;
  user: ConnectedUser;
  nightId: bigint;
  config: RunConfig;
  router: UserRouter;
  storage: StorageClient;
  log: (message: string) => void;
  now?: () => Date;
  chainId: number;
  chainRpcUrl: string;
  ledgerAddress: string;
  /** Operator key. Signs the anchor transaction and pays gas. Never log it. */
  operatorKey: string;
}): Promise<RunNowSummary> {
  const ledger = createLedgerClient({
    rpcUrl: deps.chainRpcUrl,
    chainId: deps.chainId,
    address: deps.ledgerAddress,
    privateKey: deps.operatorKey,
  });
  return executeManualRun({
    ...deps,
    store: prismaPipelineStore(deps.db),
    hooks: prismaHooks(deps.db),
    anchor: (nightId) =>
      anchorNight({
        nightId,
        store: prismaAnchorStore(deps.db),
        storage: deps.storage,
        ledger,
        chainId: deps.chainId,
        contractAddress: deps.ledgerAddress,
        log: deps.log,
        ...(deps.now ? { now: deps.now } : {}),
      }),
  });
}

function prismaHooks(db: PrismaClient): ManualRunHooks {
  return {
    async beginNight(nightId, now) {
      await db.night.upsert({
        where: { id: nightId },
        create: { id: nightId, status: "RUNNING", startedAt: now },
        update: {},
      });
    },
    async finishNight(nightId, status, now) {
      if (status === "DONE") {
        const running = await db.nightRun.count({ where: { nightId, status: "RUNNING" } });
        if (running > 0) return;
      }
      await db.night.update({ where: { id: nightId }, data: { status, finishedAt: now } });
    },
    async readBack(nightId, userId, runId) {
      const run = await db.nightRun.findUnique({ where: { id: runId }, select: { error: true } });
      const tasks = await db.task.findMany({
        where: { userId, nightId },
        select: { id: true, type: true, status: true, error: true, chosenModel: true, outputRoot: true },
      });
      return {
        error: run?.error ?? null,
        tasks: tasks.map((task) => ({
          id: task.id,
          type: task.type,
          status: task.status,
          error: task.error,
          chosenModel: task.chosenModel,
          outputRoot: task.outputRoot,
        })),
      };
    },
  };
}

function asConnected(user: RunNowUser): ConnectedUser | null {
  if (!user.mkCiphertext || !user.mkIv || !user.mkAuthTag) return null;
  return {
    id: user.id,
    accountAddress: user.accountAddress,
    mode: user.mode,
    nightlyBudgetUsdMicro: user.nightlyBudgetUsdMicro,
    donateLeftover: user.donateLeftover,
    mkCiphertext: Buffer.from(user.mkCiphertext),
    mkIv: Buffer.from(user.mkIv),
    mkAuthTag: Buffer.from(user.mkAuthTag),
  };
}
