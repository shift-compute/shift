import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { modelsListSchema, type Model } from "../zg/schemas";
import { candidates } from "./catalog";
import { CATALOG_TTL_MS, loadModelCatalog, type CatalogCache, type CatalogLister } from "./loader";

const fixturePath = path.resolve(__dirname, "../../../../docs/spike/models.json");

function fixtureModels(): Model[] {
  const raw: unknown = JSON.parse(readFileSync(fixturePath, "utf8"));
  return modelsListSchema.parse({ data: raw }).data;
}

function lister(models: Model[], calls: string[]): CatalogLister {
  return {
    listModels: async (key?: string) => {
      calls.push(key ?? "");
      return { data: models, status: 200 };
    },
  };
}

describe("loadModelCatalog", () => {
  it("reuses the list for ten minutes and refreshes on the boundary", async () => {
    const calls: string[] = [];
    const cache: CatalogCache = {};
    const router = lister(fixtureModels(), calls);
    const start = 1_700_000_000_000;

    const first = await loadModelCatalog(router, cache, start);
    const again = await loadModelCatalog(router, cache, start + CATALOG_TTL_MS - 1);
    expect(again.fromCache).toBe(true);
    expect(again.catalog).toBe(first.catalog);
    expect(calls).toEqual([""]);

    const refreshed = await loadModelCatalog(router, cache, start + CATALOG_TTL_MS);
    expect(refreshed.fromCache).toBe(false);
    expect(calls).toEqual(["", ""]);
    expect(refreshed.catalog.find((entry) => entry.id === "whisper-large-v3")).toMatchObject({ kind: "transcribe", trust: "private" });
    expect(refreshed.catalog.find((entry) => entry.id === "z-image-turbo")).toMatchObject({ kind: "image", trust: "private", imageAtto: 8_800_000_000_000_000n });
    expect(candidates(refreshed.catalog, "chat", "private").length).toBeGreaterThan(0);
    expect(candidates(refreshed.catalog, "chat", "standard").length).toBeGreaterThan(candidates(refreshed.catalog, "chat", "private").length);
  });

  it("does not share a cache across keys and leaves it untouched when the read fails", async () => {
    const cache: CatalogCache = {};
    let fail = false;
    let calls = 0;
    const router: CatalogLister = {
      listModels: async () => {
        calls += 1;
        if (fail) throw new Error("catalog unavailable");
        return {
          data: [{ id: "plain", type: "chatbot", pricing_usd: { prompt: "0.000001", completion: "0.000002" } }],
          status: 200,
        };
      },
    };
    const start = 50_000;
    const loaded = await loadModelCatalog(router, cache, start);
    expect(loaded.catalog).toHaveLength(1);

    fail = true;
    await expect(loadModelCatalog(router, cache, start + CATALOG_TTL_MS)).rejects.toThrow("catalog unavailable");
    expect(cache.at).toBe(start);
    expect(cache.catalog).toEqual(loaded.catalog);
    expect(calls).toBe(2);

    fail = false;
    const authed = await loadModelCatalog(router, cache, start, "sk-not-a-real-key");
    expect(authed.fromCache).toBe(false);
    expect(cache.key).toBe("sk-not-a-real-key");
  });

  it("accepts a reduced catalog with no verifiability and no TeeML models", async () => {
    const body = modelsListSchema.parse({
      data: [
        { id: "open-chat", type: "chatbot", pricing_usd: { prompt: "0.000002", completion: "0.000004" } },
        { id: "also-chat", type: "chatbot", verifiability: null, pricing: { prompt: "1" }, pricing_usd: { prompt: "0.00000001" } },
        { id: "embed", type: "embeddings" },
      ],
    });
    const { catalog } = await loadModelCatalog({ listModels: async () => ({ data: body.data, status: 200 }) }, {}, 0);
    expect(catalog.map((entry) => entry.id)).toEqual(["open-chat", "also-chat"]);
    expect(catalog.every((entry) => entry.trust === "standard")).toBe(true);
    expect(candidates(catalog, "chat", "private")).toEqual([]);
    expect(candidates(catalog, "decision", "private")).toEqual([]);
    expect(candidates(catalog, "transcribe", "private")).toEqual([]);
    expect(candidates(catalog, "image", "private")).toEqual([]);
  });

  it("caches an empty list instead of throwing", async () => {
    let calls = 0;
    const router: CatalogLister = {
      listModels: async () => {
        calls += 1;
        return { data: [], status: 200 };
      },
    };
    const cache: CatalogCache = {};
    const loaded = await loadModelCatalog(router, cache, 10);
    const cached = await loadModelCatalog(router, cache, 11);
    expect(loaded.catalog).toEqual([]);
    expect(cached.fromCache).toBe(true);
    expect(calls).toBe(1);
  });
});
