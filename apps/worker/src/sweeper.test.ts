import { sealSecret, type KeyClient } from "@shift/core";
import { describe, expect, it, vi } from "vitest";
import {
  ORPHAN_MIN_AGE_MS,
  SWEEP_CRON,
  createSweepLock,
  recoverInterruptedTasks,
  sweepEphemeralKeys,
  type LiveKey,
  type RunningTaskRow,
  type SweeperStore,
} from "./sweeper";

const MK = "mk-0123456789abcdefghijklmnop";
const KEY = Buffer.alloc(32, 7).toString("base64");
const ADDRESS = "0xDBdCB1f11B6b8eA7ae2b5735954F251306d6F88F";
const NOW = new Date("2026-11-07T03:00:00Z");
const noSleep = async () => {};

interface Row extends LiveKey {
  keyRevokedAt: Date | null;
}

interface TaskRow extends RunningTaskRow {
  status: "QUEUED" | "PLANNED" | "RUNNING" | "DONE" | "FAILED" | "DEFERRED" | "CANCELLED";
}

function sealedUser(id = "user-1", secret = MK) {
  const sealed = sealSecret(secret, KEY, ADDRESS.toLowerCase());
  return {
    id,
    accountAddress: ADDRESS,
    mkCiphertext: sealed.ciphertext,
    mkIv: sealed.iv,
    mkAuthTag: sealed.authTag,
  };
}

function row(keyId: string, ageMs: number, over: Partial<Row> = {}): Row {
  return {
    runId: `run-${keyId}`,
    keyId,
    keyCreatedAt: new Date(NOW.getTime() - ageMs),
    keyRevokedAt: null,
    user: sealedUser(),
    ...over,
  };
}

function memory(rows: Row[], tasks: TaskRow[] = []) {
  const store: SweeperStore = {
    // Returns every alive key, including young ones, so the sweeper's own age check is what the tests observe.
    liveKeys: async () => rows.filter((item) => item.keyRevokedAt === null).map(({ keyRevokedAt: _revoked, ...live }) => live),
    markRevoked: async (keyIds, revokedAt) => {
      for (const item of rows) {
        if (item.keyRevokedAt === null && keyIds.includes(item.keyId)) item.keyRevokedAt = revokedAt;
      }
    },
    runningTasks: async () => tasks.filter((task) => task.status === "RUNNING").map((task) => ({ id: task.id, steps: task.steps })),
    requeueTasks: async (ids) => {
      for (const task of tasks) {
        if (task.status === "RUNNING" && ids.includes(task.id)) task.status = "QUEUED";
      }
    },
  };
  return { store, rows, tasks };
}

function keys(revoke: (mk: string, keyId: string) => Promise<unknown>) {
  const revokeApiKey = vi.fn(revoke);
  const createApiKey = vi.fn(async () => {
    throw new Error("the sweeper must not create keys");
  });
  return { client: { createApiKey, revokeApiKey } as unknown as KeyClient, revokeApiKey, createApiKey };
}

describe("sweepEphemeralKeys", () => {
  it("skips a key younger than 2 hours", async () => {
    const young = row("young", ORPHAN_MIN_AGE_MS - 1);
    const { store, rows } = memory([young]);
    const { client, revokeApiKey, createApiKey } = keys(async () => ({ data: { key_id: "young" }, status: 200 }));
    const logs: string[] = [];

    const report = await sweepEphemeralKeys({
      store,
      keys: client,
      masterKey: KEY,
      now: () => NOW,
      sleep: noSleep,
      log: (message) => logs.push(message),
    });

    expect(report).toEqual({ revoked: [], failed: [], skipped: ["young"] });
    expect(rows[0]?.keyRevokedAt).toBeNull();
    expect(revokeApiKey).not.toHaveBeenCalled();
    expect(createApiKey).not.toHaveBeenCalled();
    expect(logs.join("\n")).not.toContain(MK);
  });

  it("revokes an orphan that is 2 hours old and stamps keyRevokedAt", async () => {
    const old = row("old", ORPHAN_MIN_AGE_MS);
    const { store, rows } = memory([old]);
    const seen: Array<{ mk: string; keyId: string }> = [];
    const { client, createApiKey } = keys(async (mk, keyId) => {
      seen.push({ mk, keyId });
      return { data: { key_id: keyId }, status: 200 };
    });
    const logs: string[] = [];

    const report = await sweepEphemeralKeys({
      store,
      keys: client,
      masterKey: KEY,
      now: () => NOW,
      sleep: noSleep,
      log: (message) => logs.push(message),
    });

    expect(report).toEqual({ revoked: ["old"], failed: [], skipped: [] });
    expect(seen).toEqual([{ mk: MK, keyId: "old" }]);
    expect(rows[0]?.keyRevokedAt).toEqual(NOW);
    expect(createApiKey).not.toHaveBeenCalled();
    expect(logs.join("\n")).not.toContain(MK);
    expect(JSON.stringify(report)).not.toContain(MK);
  });

  it("leaves the key unrevoked when revocation fails, without logging the secret", async () => {
    const old = row("old", ORPHAN_MIN_AGE_MS + 60_000);
    const { store, rows } = memory([old]);
    const { client } = keys(async () => {
      throw new Error(`router rejected ${MK}`);
    });
    const logs: string[] = [];

    const report = await sweepEphemeralKeys({
      store,
      keys: client,
      masterKey: KEY,
      now: () => NOW,
      sleep: noSleep,
      attempts: 1,
      log: (message) => logs.push(message),
    });

    expect(report.revoked).toEqual([]);
    expect(report.failed).toEqual(["old"]);
    expect(rows[0]?.keyRevokedAt).toBeNull();
    expect(logs.join("\n")).not.toContain(MK);
    expect(JSON.stringify(report)).not.toContain(MK);
  });

  it("does not stamp a key whose management key cannot be opened", async () => {
    const old = row("old", ORPHAN_MIN_AGE_MS, {
      user: { id: "user-1", accountAddress: ADDRESS, mkCiphertext: null, mkIv: null, mkAuthTag: null },
    });
    const { store, rows } = memory([old]);
    const { client, revokeApiKey } = keys(async () => ({ data: { key_id: "old" }, status: 200 }));

    const report = await sweepEphemeralKeys({
      store,
      keys: client,
      masterKey: KEY,
      now: () => NOW,
      sleep: noSleep,
    });

    expect(report.failed).toEqual(["old"]);
    expect(rows[0]?.keyRevokedAt).toBeNull();
    expect(revokeApiKey).not.toHaveBeenCalled();
  });

  it("does not requeue tasks while sweeping keys", async () => {
    const old = row("old", ORPHAN_MIN_AGE_MS);
    const tasks: TaskRow[] = [{ id: "live", status: "RUNNING", steps: null }];
    const { store } = memory([old], tasks);
    const { client } = keys(async (_mk, keyId) => ({ data: { key_id: keyId }, status: 200 }));

    await sweepEphemeralKeys({ store, keys: client, masterKey: KEY, now: () => NOW, sleep: noSleep });

    expect(tasks[0]?.status).toBe("RUNNING");
  });
});

describe("recoverInterruptedTasks", () => {
  it("returns RUNNING tasks to QUEUED only when no request id is recorded", async () => {
    const tasks: TaskRow[] = [
      { id: "bare", status: "RUNNING", steps: null },
      { id: "empty", status: "RUNNING", steps: [] },
      { id: "no-id", status: "RUNNING", steps: [{ step: "analyze", model: "m" }] },
      { id: "blank", status: "RUNNING", steps: [{ requestId: "  " }] },
      { id: "paid", status: "RUNNING", steps: [{ step: "analyze", model: "m", requestId: "req-1" }] },
      { id: "mixed", status: "RUNNING", steps: [{ step: "classify" }, { step: "analyze", requestId: "req-2" }] },
      { id: "beside-junk", status: "RUNNING", steps: [{ requestId: null }, { requestId: "req-3" }] },
      { id: "done", status: "DONE", steps: null },
      { id: "queued", status: "QUEUED", steps: null },
      { id: "planned", status: "PLANNED", steps: [{ step: "analyze" }] },
      { id: "failed", status: "FAILED", steps: [] },
    ];
    const { store } = memory([], tasks);

    const requeued = await recoverInterruptedTasks(store);

    expect(requeued).toEqual(["bare", "empty", "no-id", "blank"]);
    expect(tasks.map((task) => [task.id, task.status])).toEqual([
      ["bare", "QUEUED"],
      ["empty", "QUEUED"],
      ["no-id", "QUEUED"],
      ["blank", "QUEUED"],
      ["paid", "RUNNING"],
      ["mixed", "RUNNING"],
      ["beside-junk", "RUNNING"],
      ["done", "DONE"],
      ["queued", "QUEUED"],
      ["planned", "PLANNED"],
      ["failed", "FAILED"],
    ]);
  });
});

describe("sweeper schedule", () => {
  it("runs every 10 minutes and skips an overlapping call", async () => {
    expect(SWEEP_CRON).toBe("*/10 * * * *");
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let started = 0;
    const locked = createSweepLock(async () => {
      started += 1;
      await gate;
    });

    const first = locked();
    await Promise.resolve();
    expect(await locked()).toBe(false);
    expect(started).toBe(1);
    release();
    expect(await first).toBe(true);
    expect(await locked()).toBe(true);
    expect(started).toBe(2);
  });
});
