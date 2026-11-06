import type { RouterClient } from "../zg/router";
import type { Model } from "../zg/schemas";
import { buildCatalog, type CatalogEntry } from "./catalog";

/** Plan §9.3 step 4: one catalog read is reused across the users of a night. */
export const CATALOG_TTL_MS = 10 * 60_000;

export interface CatalogCache {
  at?: number;
  /** The key the cached list was read with. `undefined` means the public, unauthenticated catalog. */
  key?: string;
  models?: Model[];
  catalog?: CatalogEntry[];
}

/** The Router method that calls `GET /v1/models`. The real client satisfies this; tests pass their own. */
export type CatalogLister = Pick<RouterClient, "listModels">;

export interface LoadedCatalog {
  models: Model[];
  catalog: CatalogEntry[];
  fromCache: boolean;
}

/**
 * Loads the live model list through the Router client and normalizes it with {@link buildCatalog}.
 * A fresh `cache` is reused until {@link CATALOG_TTL_MS} has passed. Model ids come only from the response.
 *
 * Missing `verifiability` and an empty TeeML set do not throw: those models are trust `standard`, and private
 * mode simply has no candidate. That matches the reduced catalog recorded in PROGRESS.md. A failed read leaves
 * the previous cache untouched and surfaces the Router error.
 */
export async function loadModelCatalog(
  router: CatalogLister,
  cache: CatalogCache,
  nowMs: number,
  key?: string,
): Promise<LoadedCatalog> {
  if (isFresh(cache, nowMs, key)) {
    return { models: cache.models as Model[], catalog: cache.catalog as CatalogEntry[], fromCache: true };
  }
  const listed = key === undefined ? await router.listModels() : await router.listModels(key);
  const models = listed.data;
  const catalog = buildCatalog(models);
  cache.at = nowMs;
  cache.key = key;
  cache.models = models;
  cache.catalog = catalog;
  return { models, catalog, fromCache: false };
}

function isFresh(cache: CatalogCache, nowMs: number, key: string | undefined): boolean {
  return cache.models !== undefined && cache.catalog !== undefined && cache.at !== undefined && cache.key === key && nowMs - cache.at < CATALOG_TTL_MS;
}
