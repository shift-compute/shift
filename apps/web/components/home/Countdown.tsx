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

function useNow() {
  // The clock only exists in the browser: rendering it on the server would mismatch on hydration.
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

export function Countdown({ showPhase = true }: { showPhase?: boolean }) {
  const now = useNow();
  const cutoff = now ? nextCutoff(now) : null;
  return (
    <section aria-label="Time until credits reset">
      <p className="text-haze">Credits reset in</p>
      <p className="mt-1 font-display text-5xl font-medium tabular-nums text-teal sm:text-6xl">{now ? formatCountdown(msUntilCutoff(now)) : "--:--:--"}</p>
      <p className="mt-2 text-haze">at 00:00 UTC{cutoff ? ` (${cutoffInIst(cutoff)} IST)` : ""}</p>
      {showPhase && now && <p className="mt-4 text-lg">{PHASE_TEXT[nightPhase(now)]}</p>}
    </section>
  );
}

/** Same phase sentence as the countdown, for when the figure and the sentence sit apart. */
export function ResetPhase() {
  const now = useNow();
  if (!now) return null;
  return <p className="text-center text-base text-ink">{PHASE_TEXT[nightPhase(now)]}</p>;
}
