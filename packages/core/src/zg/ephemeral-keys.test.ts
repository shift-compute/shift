import { describe, expect, it, vi } from "vitest";
import { ephemeralKeyName, sweepOrphanedKeys, withEphemeralKey, type KeyClient, type LifecycleHooks } from "./ephemeral-keys";

const MK = "mk-0123456789abcdefghijklmnop";
const SK = "sk-abcdefghijklmnopqrstuvwxyz";
const params = { mk: MK, nightId: "20261107", runId: "run1", budget: "0.5" };
const noSleep = async () => {};

function fakeClient(opts: { revokeFailures?: number } = {}) {
  const events: string[] = [];
  let failures = opts.revokeFailures ?? 0;
  const client = {
    createApiKey: vi.fn(async (_mk: string, p: { name: string; trustMode: string; creditLimit?: string }) => {
      events.push("create");
      return { data: { key_id: "key-1", key: SK, name: p.name }, status: 200 };
    }),
    revokeApiKey: vi.fn(async () => {
      if (failures > 0) {
        failures--;
        events.push("revoke-failed");
        throw new Error("network down");
      }
      events.push("revoke");
      return { data: { key_id: "key-1" }, status: 200 };
    }),
  };
  return { client: client as unknown as KeyClient & typeof client, events };
}

function hooks(events: string[]): Required<LifecycleHooks> {
  return {
    onCreated: vi.fn(async () => void events.push("persist")),
    onRevoked: vi.fn(async () => void events.push("marked-revoked")),
    onRevokeFailed: vi.fn(async () => void events.push("revoke-gave-up")),
  };
}

describe("ephemeralKeyName", () => {
  it("builds a readable, safe name", () => {
    expect(ephemeralKeyName("20261107", "Run 1!")).toBe("shift-20261107-run-1");
    expect(ephemeralKeyName("manual-1793900000", "x".repeat(60))).toHaveLength("shift-manual-1793900000-".length + 24);
  });
});

describe("withEphemeralKey", () => {
  it("creates, persists the id before use, uses, then revokes and marks it", async () => {
    const { client, events } = fakeClient();
    const h = hooks(events);
    const out = await withEphemeralKey(client, params, h, async (sk, keyId) => {
      events.push("use");
      expect(sk).toBe(SK);
      expect(keyId).toBe("key-1");
      return 42;
    }, { sleep: noSleep });
    expect(events).toEqual(["create", "persist", "use", "revoke", "marked-revoked"]);
    expect(out).toEqual({ result: 42, keyId: "key-1", revoked: true });
  });

  it("creates the key as private with the budget as credit_limit", async () => {
    const { client } = fakeClient();
    await withEphemeralKey(client, params, hooks([]), async () => 1, { sleep: noSleep });
    expect(client.createApiKey).toHaveBeenCalledWith(MK, { name: "shift-20261107-run1", trustMode: "private", creditLimit: "0.5" });
  });

  it("revokes the key and rethrows the original error when use fails", async () => {
    const { client, events } = fakeClient();
    const boom = new Error("task exploded");
    await expect(withEphemeralKey(client, params, hooks(events), async () => { throw boom; }, { sleep: noSleep })).rejects.toBe(boom);
    expect(events).toEqual(["create", "persist", "revoke", "marked-revoked"]);
  });

  it("revokes immediately if the key id cannot be persisted", async () => {
    const { client, events } = fakeClient();
    const h = hooks(events);
    h.onCreated = vi.fn(async () => { throw new Error("db down"); });
    const use = vi.fn();
    await expect(withEphemeralKey(client, params, h, use, { sleep: noSleep })).rejects.toThrow("db down");
    expect(use).not.toHaveBeenCalled();
    expect(events).toEqual(["create", "revoke", "marked-revoked"]);
  });

  it("retries a failed revocation and succeeds", async () => {
    const { client, events } = fakeClient({ revokeFailures: 2 });
    const out = await withEphemeralKey(client, params, hooks(events), async () => "ok", { sleep: noSleep });
    expect(out.revoked).toBe(true);
    expect(events.filter((e) => e === "revoke-failed")).toHaveLength(2);
    expect(client.revokeApiKey).toHaveBeenCalledTimes(3);
  });

  it("reports revoked=false when every attempt fails, without losing the result", async () => {
    const { client, events } = fakeClient({ revokeFailures: 99 });
    const h = hooks(events);
    const out = await withEphemeralKey(client, params, h, async () => "result", { sleep: noSleep });
    expect(out).toEqual({ result: "result", keyId: "key-1", revoked: false });
    expect(h.onRevokeFailed).toHaveBeenCalledTimes(1);
    expect(h.onRevoked).not.toHaveBeenCalled();
  });

  it("does not create a key to revoke when creation itself fails", async () => {
    const { client } = fakeClient();
    client.createApiKey.mockRejectedValueOnce(new Error("403 insufficient_scope"));
    await expect(withEphemeralKey(client, params, hooks([]), async () => 1, { sleep: noSleep })).rejects.toThrow("insufficient_scope");
    expect(client.revokeApiKey).not.toHaveBeenCalled();
  });
});

describe("sweepOrphanedKeys", () => {
  const now = new Date("2026-11-07T01:00:00Z");
  const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);

  it("revokes only keys older than the minimum age", async () => {
    const { client } = fakeClient();
    const report = await sweepOrphanedKeys(
      client,
      [
        { keyId: "old", mk: MK, createdAt: minutesAgo(180) },
        { keyId: "young", mk: MK, createdAt: minutesAgo(30) },
      ],
      { now, sleep: noSleep },
    );
    expect(report).toEqual({ revoked: ["old"], failed: [], skipped: ["young"] });
    expect(client.revokeApiKey).toHaveBeenCalledTimes(1);
  });

  it("keeps going and reports keys it could not revoke", async () => {
    const { client } = fakeClient({ revokeFailures: 3 });
    const report = await sweepOrphanedKeys(
      client,
      [
        { keyId: "a", mk: MK, createdAt: minutesAgo(200) },
        { keyId: "b", mk: MK, createdAt: minutesAgo(200) },
      ],
      { now, sleep: noSleep },
    );
    expect(report.failed.map((f) => f.keyId)).toEqual(["a"]);
    expect(report.revoked).toEqual(["b"]);
  });
});
