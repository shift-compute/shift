/** Credits reset at 00:00 UTC, which is 05:30 IST (UTC+5:30, no daylight saving). */
const DAY_MS = 24 * 60 * 60 * 1000;
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** Defaults of the nightly window (plan §9.1); the worker reads the real values from its environment. */
export const DEFAULT_NIGHT_START_UTC = "23:00";
export const DEFAULT_NIGHT_HARD_STOP_UTC = "23:50";

/** The next 00:00 UTC strictly after `now`. */
export function nextCutoff(now: Date): Date {
  return new Date((Math.floor(now.getTime() / DAY_MS) + 1) * DAY_MS);
}

export function msUntilCutoff(now: Date): number {
  return nextCutoff(now).getTime() - now.getTime();
}

/** "HH:MM:SS", rounded up to the next second so the display never shows 00:00:00 before the reset. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor((total % 3600) / 60))}:${pad(total % 60)}`;
}

/** The cutoff as a wall-clock time in India Standard Time, e.g. "05:30". */
export function cutoffInIst(cutoff: Date): string {
  const t = new Date(cutoff.getTime() + IST_OFFSET_MS);
  return `${String(t.getUTCHours()).padStart(2, "0")}:${String(t.getUTCMinutes()).padStart(2, "0")}`;
}

export type NightPhase = "day" | "window" | "after_hard_stop";

function minutesOfDay(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h as number) * 60 + (m as number);
}

/**
 * Where we are relative to the nightly run: before the window opens, inside it (tasks may run),
 * or after the hard stop (nothing runs until the reset).
 */
export function nightPhase(now: Date, startUtc = DEFAULT_NIGHT_START_UTC, hardStopUtc = DEFAULT_NIGHT_HARD_STOP_UTC): NightPhase {
  const minute = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (minute < minutesOfDay(startUtc)) return "day";
  return minute < minutesOfDay(hardStopUtc) ? "window" : "after_hard_stop";
}

/** A "HH:MM" time given in UTC as the same moment in India Standard Time, e.g. "23:00" -> "04:30". */
export function utcTimeInIst(hhmm: string): string {
  const total = (minutesOfDay(hhmm) + 330) % (24 * 60);
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}
