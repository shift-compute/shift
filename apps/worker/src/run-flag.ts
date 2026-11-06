import { msUntilHardStop } from "@shift/core";

/**
 * Runs `run` immediately and on every minute. The immediate call is the boot retake:
 * inside the window, `tick` can pick up a RUNNING night whose heartbeat is stale.
 * A FAILED night is still refused by the lock.
 */
export function startNightLoop(schedule: (expression: string, task: () => void) => void, run: () => void): void {
  schedule("* * * * *", run);
  run();
}

/** In-process guard so two ticks of this process do not run the night at once. */
export interface RunFlag {
  held: boolean;
  /** Bumped every time the flag is taken. A late release only clears its own hold. */
  token: number;
}

export function createRunFlag(): RunFlag {
  return { held: false, token: 0 };
}

/**
 * Holds the flag while `run` is in progress.
 * Also drops it when `hardStopUtc` passes, so a hung upload cannot block the next tick.
 * Returns false when another tick in this process already holds the flag.
 */
export async function withNightFlag(
  flag: RunFlag,
  hardStopUtc: string,
  now: Date,
  log: (message: string) => void,
  run: () => Promise<void>,
): Promise<boolean> {
  if (flag.held) return false;
  flag.held = true;
  const token = ++flag.token;
  const waitMs = msUntilHardStop(now, hardStopUtc);
  const timer = setTimeout(() => {
    if (flag.token !== token || !flag.held) return;
    flag.held = false;
    log("hard stop reached; releasing the in-process night flag");
  }, waitMs);
  try {
    await run();
    return true;
  } finally {
    clearTimeout(timer);
    if (flag.token === token) flag.held = false;
  }
}
