import type { PrismaClient, WorkerConfig } from "@shift/core";

export interface NightContext {
  db: PrismaClient;
  config: WorkerConfig;
  nightId: bigint;
  log: (message: string) => void;
}

/**
 * Runs every connected user's tasks for one night. The per-user pipeline arrives in the next commit;
 * until then a night fails loudly instead of being marked DONE without having done anything.
 */
export async function runNight(ctx: NightContext): Promise<void> {
  ctx.log(`night ${ctx.nightId}: pipeline not wired yet`);
  throw new Error("The per-user pipeline is not implemented yet.");
}
