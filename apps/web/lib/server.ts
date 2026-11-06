import "server-only";
import { createDb, createRouterClient, loadWebConfig, type PrismaClient, type RouterClient, type WebConfig } from "@shift/core";
import type { StorageClient } from "@shift/core/storage";
import { readOperatorKey } from "./operator-key";

// Server-only singletons. They survive hot reloads in development through globalThis.
const globals = globalThis as unknown as { __shift?: { config?: WebConfig; db?: PrismaClient; router?: RouterClient; storage?: StorageClient } };
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

/** Storage client for a manual run. The operator key never goes into `WebConfig` or a response. */
export async function getStorage(): Promise<StorageClient> {
  if (state.storage) return state.storage;
  const { createStorageClient } = await import("@shift/core/storage");
  const config = getConfig();
  state.storage = createStorageClient({
    rpcUrl: config.ZG_CHAIN_RPC_URL,
    indexerUrl: config.ZG_STORAGE_INDEXER_URL,
    privateKey: readOperatorKey(process.env),
  });
  return state.storage;
}
