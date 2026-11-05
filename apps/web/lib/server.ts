import "server-only";
import { createDb, createRouterClient, loadWebConfig, type PrismaClient, type RouterClient, type WebConfig } from "@shift/core";

// Server-only singletons. They survive hot reloads in development through globalThis.
const globals = globalThis as unknown as { __shift?: { config?: WebConfig; db?: PrismaClient; router?: RouterClient } };
const state = (globals.__shift ??= {});

/** Validated environment. Throws a ConfigError (naming variables, never values) if something is missing. */
export function getConfig(): WebConfig {
  return (state.config ??= loadWebConfig());
}

export function getDb(): PrismaClient {
  return (state.db ??= createDb(getConfig().DATABASE_URL));
}

export function getRouter(): RouterClient {
  return (state.router ??= createRouterClient({ baseUrl: getConfig().ZG_ROUTER_BASE_URL }));
}
