import { sealOutput } from "@shift/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, getDb, getConfig, getStorage } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getDb: vi.fn(),
  getConfig: vi.fn(),
  getStorage: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../../lib/session", () => ({ getCurrentUser }));
vi.mock("../../../../../lib/server", () => ({ getDb, getConfig, getStorage }));

import { GET } from "./route";

const KEY = Buffer.alloc(32, 4).toString("base64");
const ALICE = "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f";
const ROOT = "0x" + "ab".repeat(32);

function document(summary: string): Uint8Array {
  const body = {
    version: 1,
    taskId: "task-1",
    type: "DOC_ANALYSIS",
    result: { summary },
    files: [],
    steps: [],
    createdAt: "2026-11-06T23:10:00.000Z",
  };
  return sealOutput(new TextEncoder().encode(JSON.stringify(body)), KEY, ALICE);
}

function call(id = "task-1") {
  return GET(new Request(`http://test.local/api/tasks/${id}/output`) as never, { params: Promise.resolve({ id }) });
}

describe("GET /api/tasks/[id]/output", () => {
  const taskFind = vi.fn();
  const blobs = new Map<string, Uint8Array>();

  beforeEach(() => {
    getCurrentUser.mockReset();
    getDb.mockReset();
    getConfig.mockReset();
    getStorage.mockReset();
    taskFind.mockReset();
    blobs.clear();
    getConfig.mockReturnValue({ SHIFT_MASTER_KEY: KEY });
    getDb.mockReturnValue({ task: { findFirst: taskFind } });
    getStorage.mockResolvedValue({
      upload: async () => {
        throw new Error("unused");
      },
      download: async (root: string) => {
        const bytes = blobs.get(root);
        if (!bytes) throw new Error("missing");
        return bytes;
      },
    });
  });

  it("returns 401 when nobody is signed in and does not read the task", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "not_signed_in" });
    expect(taskFind).not.toHaveBeenCalled();
    expect(res.headers.get("cache-control")).toBe("private, no-store");
  });

  it("returns 404 for a task this user does not own", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-2", accountAddress: "0x" + "11".repeat(20) });
    taskFind.mockResolvedValue(null);
    const res = await call();
    expect(res.status).toBe(404);
    expect(taskFind).toHaveBeenCalledWith({ where: { id: "task-1", userId: "user-2" }, select: { id: true, outputRoot: true } });
    expect(getStorage).not.toHaveBeenCalled();
  });

  it("decrypts the ciphertext for the owner", async () => {
    blobs.set(ROOT, document("only Alice"));
    getCurrentUser.mockResolvedValue({ id: "user-1", accountAddress: ALICE });
    taskFind.mockResolvedValue({ id: "task-1", outputRoot: ROOT });
    const res = await call();
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ taskId: "task-1", result: { summary: "only Alice" }, sealed: true, files: [] });
  });

  it("refuses a tampered ciphertext", async () => {
    const sealed = Buffer.from(document("only Alice"));
    sealed[sealed.length - 1] = (sealed[sealed.length - 1] ?? 0) ^ 0xff;
    blobs.set(ROOT, sealed);
    getCurrentUser.mockResolvedValue({ id: "user-1", accountAddress: ALICE });
    taskFind.mockResolvedValue({ id: "task-1", outputRoot: ROOT });
    const res = await call();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: "cannot_decrypt" });
  });

  it("does not open the blob for a different account address", async () => {
    blobs.set(ROOT, document("only Alice"));
    getCurrentUser.mockResolvedValue({ id: "user-1", accountAddress: "0x" + "22".repeat(20) });
    taskFind.mockResolvedValue({ id: "task-1", outputRoot: ROOT });
    const res = await call();
    expect(res.status).toBe(403);
    const encoded = JSON.stringify(await res.json());
    expect(encoded).not.toContain("only Alice");
  });
});
