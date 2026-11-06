"use client";

import { useEffect, useState } from "react";
import { utcDayElapsed } from "../../lib/countdown";

/**
 * Hero clock: the UTC day advancing toward 00:00. Width is time, never spend.
 * The first paint snaps; later seconds ease. Reduced motion drops the ease and the edge pulse.
 */
export function ResetBar() {
  const [now, setNow] = useState<Date | null>(null);
  const [smooth, setSmooth] = useState(false);

  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => {
      setNow(new Date());
      setSmooth(true);
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const elapsed = now ? utcDayElapsed(now) : null;
  const ease = smooth ? "transition-transform duration-700 ease-out motion-reduce:transition-none" : "";
  const edgeEase = smooth ? "transition-[left] duration-700 ease-out motion-reduce:transition-none" : "";

  return (
    <div>
      <div className="flex justify-between text-sm text-haze">
        <span>Now</span>
        <span>00:00 UTC</span>
      </div>
      <div className="relative mt-2 h-2 overflow-hidden rounded-sm bg-night" aria-hidden="true">
        {elapsed !== null && (
          <div className={`absolute inset-0 origin-left bg-sodium ${ease}`} style={{ transform: `scaleX(${elapsed})` }} />
        )}
        {elapsed !== null && (
          <div
            className={`night-edge pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-paper motion-reduce:animate-none ${edgeEase}`}
            style={{ left: `${elapsed * 100}%` }}
          />
        )}
      </div>
      <p className="mt-3 text-sm text-haze">This UTC day, advancing toward the 00:00 reset.</p>
    </div>
  );
}
