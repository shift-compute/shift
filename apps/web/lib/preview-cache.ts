import type { CatalogCache } from "@shift/core";

/** One catalog read is reused for ten minutes. The route must not export this: Next only allows route handlers on that module. */
export const previewCatalogCache: CatalogCache = {};

export function clearPlanPreviewCache(): void {
  previewCatalogCache.at = undefined;
  previewCatalogCache.key = undefined;
  previewCatalogCache.models = undefined;
  previewCatalogCache.catalog = undefined;
}
