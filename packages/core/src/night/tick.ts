import { acquireNight, type NightStore } from "./night-lock";
import { inNightWindow, nightIdFor } from "./schedule";

export interface TickDeps {
  db: NightStore;
  startUtc: string;
  hardStopUtc: string;
  /** Runs the whole night. Resolves when every user is done; throwing marks the night FAILED in the caller. */
  runNight(nightId: bigint): Promise<void>;
  now?: () => Date;
  log?: (message: string) => void;
}

export type TickOutcome = "outside_window" | "busy" | "ran" | "failed";

/**
 * One cron tick, called every minute. Outside the window it does nothing; inside it, the first instance to take the
 * lock runs the night, and every later tick (or other instance) sees `busy` until the night is DONE.
 */
export async function tick(deps: TickDeps): Promise<TickOutcome> {
  const now = (deps.now ?? (() => new Date()))();
  const log = deps.log ?? (() => undefined);
  if (!inNightWindow(now, deps.startUtc, deps.hardStopUtc)) return "outside_window";

  const nightId = nightIdFor(now);
  if (!(await acquireNight(deps.db, nightId, now))) return "busy";

  log(`night ${nightId} acquired`);
  try {
    await deps.runNight(nightId);
    return "ran";
  } catch (err) {
    log(`night ${nightId} failed: ${err instanceof Error ? err.message : String(err)}`);
    return "failed";
  }
}
