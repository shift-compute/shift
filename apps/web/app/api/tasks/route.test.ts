import type { Task } from "@shift/core";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, getDb } = vi.hoisted(() => ({ getCurrentUser: vi.fn(), getDb: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/session", () => ({ getCurrentUser }));
vi.mock("../../../lib/server", () => ({ getDb }));

import { GET } from "./route";

const MK = "mk-alicesecretkeyvalue";

function row(over: Partial<Task> & Pick<Task, "id" | "userId">): Task {
  return {
    type: "DOC_ANALYSIS",
    status: "FAILED",
    priority: 2,
    prompt: null,
    inputPath: `${over.userId}/secret.bin`,
    inputMeta: { bytes: 89 },
    nightId: 1794004512n,
    complexity: null,
    chosenModel: null,
    estCostUsdMicro: null,
    actualCostUsdMicro: 1000n,
    steps: [{ requestId: `req-${over.userId}-doc-1`, trace: { authorization: MK } }],
    outputRoot: null,
    outputTx: null,
    error: `${over.userId} stored failure`,
    createdAt: new Date("2026-11-06T22:49:35.000Z"),
    updatedAt: new Date("2026-11-06T22:49:35.000Z"),
    ...over,
  } as Task;
}

const alice = row({ id: "alice-task", userId: "alice", error: `alice stored failure ${MK}` });
const bob = row({
  id: "bob-task",
  userId: "bob",
  nightId: 111n,
  error: "bob-only-failure mk-bobsecretkeyvalue",
  steps: [{ requestId: "req-bob-only-9999", trace: { note: "bob trace" } }],
  inputPath: "bob/private.bin",
});

describe("GET /api/tasks", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
    getDb.mockReset();
  });

  it("returns only the signed-in user's receipt and strips keys", async () => {
    getCurrentUser.mockResolvedValue({ id: "alice" });
    const findMany = vi.fn(async (args: { where?: { userId?: string } }) => {
      const id = args.where?.userId;
      return [alice, bob].filter((task) => task.userId === id);
    });
    getDb.mockReturnValue({ task: { findMany } });

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { userId: "alice" } }));
    expect(body.tasks).toHaveLength(1);
    expect(body.tasks[0]).toMatchObject({
      id: "alice-task",
      nightId: "1794004512",
      error: "alice stored failure [redacted]",
      requestIds: ["req-alice-doc-1"],
      actualCostUsdMicro: "1000",
    });
    const text = JSON.stringify(body);
    expect(text).not.toContain(MK);
    expect(text).not.toContain("bob-only-failure");
    expect(text).not.toContain("req-bob-only-9999");
    expect(text).not.toContain("mk-bobsecretkeyvalue");
    expect(text).not.toContain("secret.bin");
    expect(text).not.toContain("private.bin");
    expect(text).not.toContain("trace");
  });
});
