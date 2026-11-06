import { createRateLimiter } from "@shift/core";
import { RUN_NOW_LIMIT, RUN_NOW_WINDOW_MS } from "./run-now";

/** Survives a dev reload. A module-level `const` would reset the window every time the file is evaluated again. */
const GLOBAL = "__shiftLimiters";

interface Limiter {
  check(key: string): { allowed: boolean; retryAfterSeconds: number };
}

interface Bag {
  connect?: Limiter;
  runNow?: Limiter;
}

function bag(): Bag {
  const g = globalThis as typeof globalThis & { [GLOBAL]?: Bag };
  return (g[GLOBAL] ??= {});
}

export const CONNECT_LIMIT = 5;
export const CONNECT_WINDOW_MS = 60_000;

/** 5 connect attempts per minute per client address. */
export function connectLimiter(): Limiter {
  const store = bag();
  return (store.connect ??= createRateLimiter(CONNECT_LIMIT, CONNECT_WINDOW_MS));
}

/** One pipeline start per user per 10 minutes. */
export function runNowLimiter(): Limiter {
  const store = bag();
  return (store.runNow ??= createRateLimiter(RUN_NOW_LIMIT, RUN_NOW_WINDOW_MS));
}
