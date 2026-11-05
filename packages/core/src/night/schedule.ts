const MINUTE_MS = 60_000;

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h as number) * 60 + (m as number);
}

/** True while tasks may start: from `startUtc` (inclusive) to `hardStopUtc` (exclusive), in UTC. */
export function inNightWindow(now: Date, startUtc: string, hardStopUtc: string): boolean {
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  return minute >= minutesOfDay(startUtc) && minute < minutesOfDay(hardStopUtc);
}

/** `YYYYMMDD` of the UTC day that ends at the cutoff this run is racing against (plan §9.1). */
export function nightIdFor(now: Date): bigint {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth() + 1;
  const d = now.getUTCDate();
  return BigInt(y * 10_000 + m * 100 + d);
}

/** Manual runs use unix seconds, which can never collide with a YYYYMMDD id (those are below 10^8). */
export function manualNightId(now: Date): bigint {
  return BigInt(Math.floor(now.getTime() / 1000));
}

/** Milliseconds left before nothing may start, never negative. Used to skip tasks that cannot finish in time. */
export function msUntilHardStop(now: Date, hardStopUtc: string): number {
  const stop = new Date(now);
  stop.setUTCHours(0, 0, 0, 0);
  stop.setTime(stop.getTime() + minutesOfDay(hardStopUtc) * MINUTE_MS);
  return Math.max(0, stop.getTime() - now.getTime());
}
