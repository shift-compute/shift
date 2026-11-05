"use client";

import { useEffect, useState } from "react";
import {
  DEFAULT_NIGHT_HARD_STOP_UTC,
  DEFAULT_NIGHT_START_UTC,
  cutoffInIst,
  formatCountdown,
  msUntilCutoff,
  nextCutoff,
  nightPhase,
  utcTimeInIst,
} from "../../lib/countdown";

const PHASE_TEXT = {
  day: `Tonight's run opens at ${DEFAULT_NIGHT_START_UTC} UTC (${utcTimeInIst(DEFAULT_NIGHT_START_UTC)} IST).`,
  window: `Tonight's run is open. Nothing starts after ${DEFAULT_NIGHT_HARD_STOP_UTC} UTC.`,
  after_hard_stop: "Tonight's run is closed. Whatever is left expires at the reset.",
} as const;

export function Countdown() {
  // The clock only exists in the browser: rendering it on the server would mismatch on hydration.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const cutoff = now ? nextCutoff(now) : null;
  return (
    <section aria-label="Time until credits reset">
      <p className="text-haze">Credits reset in</p>
      <p className="mt-1 font-display text-6xl font-semibold tabular-nums text-sodium sm:text-7xl">{now ? formatCountdown(msUntilCutoff(now)) : "--:--:--"}</p>
      <p className="mt-2 text-haze">at 00:00 UTC{cutoff ? ` (${cutoffInIst(cutoff)} IST)` : ""}</p>
      {now && <p className="mt-4 text-lg">{PHASE_TEXT[nightPhase(now)]}</p>}
    </section>
  );
}
