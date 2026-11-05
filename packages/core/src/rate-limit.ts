export interface RateLimitResult {
  allowed: boolean;
  /** Seconds until the oldest hit leaves the window; only meaningful when `allowed` is false. */
  retryAfterSeconds: number;
}

/**
 * Sliding-window limiter kept in memory. It protects a single server process, which is how the web app is deployed;
 * a multi-instance deployment would need a shared store instead.
 */
export function createRateLimiter(limit: number, windowMs: number, now: () => number = Date.now) {
  const hits = new Map<string, number[]>();

  return {
    check(key: string): RateLimitResult {
      const t = now();
      const recent = (hits.get(key) ?? []).filter((h) => t - h < windowMs);
      if (recent.length >= limit) {
        hits.set(key, recent);
        return { allowed: false, retryAfterSeconds: Math.max(1, Math.ceil((windowMs - (t - recent[0]!)) / 1000)) };
      }
      recent.push(t);
      hits.set(key, recent);
      // Drop idle keys so the map cannot grow without bound.
      if (hits.size > 10_000) for (const [k, v] of hits) if (v.every((h) => t - h >= windowMs)) hits.delete(k);
      return { allowed: true, retryAfterSeconds: 0 };
    },
  };
}
