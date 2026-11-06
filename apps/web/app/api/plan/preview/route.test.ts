import { RouterError, VaultError } from "@shift/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, openUserKey, getDb, getRouter, getConfig } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  openUserKey: vi.fn(),
  getDb: vi.fn(),
  getRouter: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/session", () => ({ getCurrentUser }));
vi.mock("../../../../lib/user-key", () => ({ openUserKey }));
vi.mock("../../../../lib/server", () => ({ getDb, getRouter, getConfig }));

import { clearPlanPreviewCache } from "../../../../lib/preview-cache";
import { GET } from "./route";

const SECRET = "mk-route-secret-value";

const cheapModels = [
  { id: "0gm-1.0-35b-a3b", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.000000001", completion: "0.000000002" } },
  { id: "glm-5.3", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.000000003", completion: "0.000000006" } },
];

function user() {
  return { id: "user-1", mode: "IAI_CREDITS_ONLY" as const, nightlyBudgetUsdMicro: null };
}

function openDoc() {
  return {
    id: "t1",
    type: "DOC_ANALYSIS",
    priority: 2,
    createdAt: new Date("2026-11-06T00:00:00Z"),
    inputPath: "user-1/notes.txt",
    inputMeta: { bytes: 4000, mime: "text/plain" },
    prompt: null,
  };
}

function balance(currency: string, credit: string) {
  return {
    address: "0xabc",
    currency,
    credit_balance: credit,
    deposit_balance: "0",
    pending_charge: "0",
    total_balance: credit,
  };
}

describe("GET /api/plan/preview", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    openUserKey.mockReset();
    getDb.mockReset();
    getRouter.mockReset();
    getConfig.mockReset();
    getConfig.mockReturnValue({ SAFETY_MARGIN_PCT: 10 });
    clearPlanPreviewCache();
  });

  it("returns 401 when the session cookie is missing", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "not_signed_in" });
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(getDb).not.toHaveBeenCalled();
    expect(getRouter).not.toHaveBeenCalled();
  });

  it("returns connection_invalid when the management key is gone", async () => {
    getCurrentUser.mockResolvedValue(user());
    openUserKey.mockReturnValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "connection_invalid" });
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns connection_invalid when the stored key cannot be opened, and hides other failures", async () => {
    getCurrentUser.mockResolvedValue(user());
    openUserKey.mockImplementation(() => {
      throw new VaultError("Could not decrypt the secret.");
    });
    const sealed = await GET();
    expect(sealed.status).toBe(401);
    expect(await sealed.json()).toEqual({ error: "connection_invalid" });

    openUserKey.mockImplementation(() => {
      throw new Error("master key path /tmp/mk-route-secret-value");
    });
    const broken = await GET();
    const body = await broken.json();
    expect(broken.status).toBe(500);
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain("mk-");
  });

  it("returns empty_queue without calling the Router", async () => {
    getCurrentUser.mockResolvedValue(user());
    openUserKey.mockReturnValue(SECRET);
    getDb.mockReturnValue({ task: { findMany: vi.fn(async () => []) } });
    const res = await GET();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "empty_queue", message: "Nothing is waiting for tonight." });
    expect(getRouter).not.toHaveBeenCalled();
  });

  it("returns the optimizer's estimate and does not echo the key", async () => {
    getCurrentUser.mockResolvedValue(user());
    openUserKey.mockReturnValue(SECRET);
    getDb.mockReturnValue({ task: { findMany: vi.fn(async () => [openDoc()]) } });
    const listModels = vi.fn(async () => ({ data: cheapModels, status: 200 }));
    const getBalance = vi.fn(async () => ({ data: balance("usd", "1000000"), status: 200 }));
    getRouter.mockReturnValue({ listModels, getBalance });

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(listModels).toHaveBeenCalledWith();
    expect(getBalance).toHaveBeenCalledWith(SECRET);
    expect(body).toMatchObject({
      qualityFloor: 1,
      complexity: "at_run_time",
      budgetMicro: "900000",
      spentEstimateMicro: "9",
      remainingMicro: "899991",
      assignments: [{ taskId: "t1", model: "glm-5.3", costMicro: "9" }],
      deferred: [],
    });
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(JSON.stringify(body)).not.toContain("sk-");
  });

  it("returns no_rate when the catalog cannot convert a 0G balance", async () => {
    getCurrentUser.mockResolvedValue(user());
    openUserKey.mockReturnValue(SECRET);
    getDb.mockReturnValue({ task: { findMany: vi.fn(async () => [openDoc()]) } });
    getRouter.mockReturnValue({
      listModels: async () => ({ data: cheapModels, status: 200 }),
      getBalance: async () => ({ data: balance("0g", "1000000000000000000"), status: 200 }),
    });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error).toBe("no_rate");
    expect(body.message).toMatch(/without inventing a rate/);
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("returns connection_invalid when the Router rejects the key", async () => {
    getCurrentUser.mockResolvedValue(user());
    openUserKey.mockReturnValue(SECRET);
    getDb.mockReturnValue({ task: { findMany: vi.fn(async () => [openDoc()]) } });
    getRouter.mockReturnValue({
      listModels: async () => ({ data: cheapModels, status: 200 }),
      getBalance: async () => {
        throw new RouterError({ status: 401, code: "invalid_api_key", message: `rejected ${SECRET}` });
      },
    });
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(401);
    expect(body).toEqual({ error: "connection_invalid" });
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });
});
