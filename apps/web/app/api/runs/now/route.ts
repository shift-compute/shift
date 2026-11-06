import { redactString, type RunConfig, type WebConfig } from "@shift/core";
import { NextResponse } from "next/server";
import { runNowLimiter } from "../../../../lib/limits";
import { readOperatorKey } from "../../../../lib/operator-key";
import { recoverWebInterruptions } from "../../../../lib/recover";
import { executeRunNow, runCurrentUser, type RunNowResult } from "../../../../lib/run-now";
import { getConfig, getDb, getRouter, getStorage } from "../../../../lib/server";
import { getCurrentUser } from "../../../../lib/session";

export const runtime = "nodejs";
// A real user night can outlast the default function limit. Platforms that honor this keep the request alive.
export const maxDuration = 300;

function log(message: string): void {
  console.log(`${new Date().toISOString()} ${redactString(message)}`);
}

function runConfig(config: WebConfig): RunConfig {
  return {
    SHIFT_MASTER_KEY: config.SHIFT_MASTER_KEY,
    ...(config.SHIFT_MASTER_KEY_PREV ? { SHIFT_MASTER_KEY_PREV: config.SHIFT_MASTER_KEY_PREV } : {}),
    UPLOAD_DIR: config.UPLOAD_DIR,
    SAFETY_MARGIN_PCT: config.SAFETY_MARGIN_PCT,
    MAX_CONCURRENCY: config.MAX_CONCURRENCY,
    NIGHT_HARD_STOP_UTC: config.NIGHT_HARD_STOP_UTC,
    COMMONS_GATE_THRESHOLD: config.COMMONS_GATE_THRESHOLD,
  };
}

function respond(result: RunNowResult): NextResponse {
  const headers = result.status === 429 ? { "Retry-After": String(result.body.retryAfterSeconds) } : undefined;
  return NextResponse.json(result.body, { status: result.status, headers });
}

/**
 * Runs the real per-user pipeline now (plan §9.1). Same `runUser` as the nightly worker, for the signed-in user only,
 * then the same `anchorNight` when the batch has leaves, and `recordDonations` when that night has a positive donation.
 * Manual nights use a unix-seconds id because `Night.id` is a BigInt.
 */
export async function POST() {
  await recoverWebInterruptions().catch((err: unknown) => {
    console.error("recover:", err instanceof Error ? err.name : "unknown error");
  });
  const user = await getCurrentUser();
  const result = await executeRunNow({
    user,
    limiter: runNowLimiter(),
    log,
    countOpenTasks: (userId) => getDb().task.count({ where: { userId, status: { in: ["QUEUED", "DEFERRED"] } } }),
    ensureStorage: () => {
      readOperatorKey(process.env);
    },
    run: async (connected, nightId) => {
      const config = getConfig();
      const summary = await runCurrentUser({
        db: getDb(),
        user: connected,
        nightId,
        config: runConfig(config),
        router: getRouter(),
        storage: await getStorage(),
        log,
        chainId: config.ZG_CHAIN_ID,
        chainRpcUrl: config.ZG_CHAIN_RPC_URL,
        ledgerAddress: config.LEDGER_CONTRACT_ADDRESS,
        operatorKey: readOperatorKey(process.env),
      });
      log(`run now user ${connected.id} night ${summary.nightId} ${summary.status}`);
      return summary;
    },
  });
  return respond(result);
}
