import { createRateLimiter, type ConnectedUser, type OpenTask, type PipelineStore, type RunConfig, type TaskPatch, type UserRouter } from "@shift/core";
import type { StorageClient } from "@shift/core/storage";
import { describe, expect, it, vi } from "vitest";
import { StorageKeyError } from "./operator-key";
import { executeManualRun, executeRunNow, requestIdsFromSteps, type ManualRunHooks, type RunNowSummary, type RunNowUser } from "./run-now";

const NOW = new Date("2026-11-06T10:00:00.900Z");
const NIGHT = 1793959200n;
const MK = "mk-0123456789abcdef";
const SK = "sk-abcdefghijklmnopqrstuvwxyz";

const config: RunConfig = {
  SHIFT_MASTER_KEY: Buffer.alloc(32, 1).toString("base64"),
  SAFETY_MARGIN_PCT: 10,
  MAX_CONCURRENCY: 1,
  NIGHT_HARD_STOP_UTC: "23:50",
  UPLOAD_DIR: "/tmp/shift-uploads",
  COMMONS_GATE_THRESHOLD: 0.75,
};

function user(over: Partial<RunNowUser> = {}): RunNowUser {
  return {
    id: "user-1",
    accountAddress: "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f",
    mode: "IAI_CREDITS_ONLY",
    nightlyBudgetUsdMicro: null,
    donateLeftover: false,
    mkCiphertext: Buffer.from("ciphertext"),
    mkIv: Buffer.from("iv"),
    mkAuthTag: Buffer.from("tag"),
    ...over,
  };
}

function summary(over: Partial<RunNowSummary> = {}): RunNowSummary {
  return { nightId: "0", status: "DONE", runId: "run-1", error: null, tasks: [], ...over };
}

function allow() {
  return { check: vi.fn(() => ({ allowed: true, retryAfterSeconds: 0 })) };
}

describe("requestIdsFromSteps", () => {
  it("copies request ids and drops traces, duplicates, and key-shaped values", () => {
    expect(
      requestIdsFromSteps([
        { step: "summarize", requestId: "req-doc-1234", trace: { authorization: MK } },
        { requestId: "req-doc-1234" },
        { requestId: "short" },
        { requestId: SK },
        { requestId: "  req-audio-1 " },
      ]),
    ).toEqual(["req-doc-1234", "req-audio-1"]);
  });

  it("returns nothing when steps are missing", () => {
    expect(requestIdsFromSteps(null)).toEqual([]);
    expect(requestIdsFromSteps({})).toEqual([]);
  });
});

describe("executeRunNow", () => {
  it("rejects a missing session before any work", async () => {
    const run = vi.fn();
    const countOpenTasks = vi.fn();
    const limiter = allow();
    const result = await executeRunNow({ user: null, limiter, countOpenTasks, ensureStorage: () => undefined, run });
    expect(result).toEqual({ status: 401, body: { error: "not_signed_in" } });
    expect(run).not.toHaveBeenCalled();
    expect(countOpenTasks).not.toHaveBeenCalled();
    expect(limiter.check).not.toHaveBeenCalled();
  });

  it("refuses an account with no stored key and does not start the pipeline", async () => {
    const run = vi.fn();
    const limiter = allow();
    const result = await executeRunNow({
      user: user({ mkCiphertext: null }),
      limiter,
      countOpenTasks: async () => 1,
      ensureStorage: () => undefined,
      run,
    });
    expect(result.status).toBe(409);
    if (result.status === 409) expect(result.body.error).toBe("not_connected");
    expect(run).not.toHaveBeenCalled();
    expect(limiter.check).not.toHaveBeenCalled();
  });

  it("refuses an empty queue instead of reporting a fake success", async () => {
    const run = vi.fn();
    const result = await executeRunNow({
      user: user(),
      limiter: allow(),
      countOpenTasks: async (id) => {
        expect(id).toBe("user-1");
        return 0;
      },
      ensureStorage: () => undefined,
      run,
    });
    expect(result.status).toBe(409);
    if (result.status === 409) expect(result.body.error).toBe("no_queued_work");
    expect(run).not.toHaveBeenCalled();
  });

  it("fails visibly when storage cannot be paid for, before the Router", async () => {
    const run = vi.fn();
    const result = await executeRunNow({
      user: user(),
      limiter: allow(),
      countOpenTasks: async () => 1,
      ensureStorage: () => {
        throw new StorageKeyError();
      },
      run,
    });
    expect(result.status).toBe(503);
    if (result.status === 503) expect(result.body.error).toBe("storage_unconfigured");
    expect(run).not.toHaveBeenCalled();
  });

  it("allows one pipeline start per 10 minutes per user", async () => {
    let t = 1_000;
    const limiter = createRateLimiter(1, 10 * 60_000, () => t);
    const run = vi.fn(async () => summary());
    const deps = {
      user: user(),
      limiter,
      countOpenTasks: async () => 1,
      ensureStorage: () => undefined,
      now: () => NOW,
      run,
    };
    expect((await executeRunNow(deps)).status).toBe(200);
    const limited = await executeRunNow(deps);
    expect(limited.status).toBe(429);
    if (limited.status === 429) {
      expect(limited.body.error).toBe("rate_limited");
      expect(limited.body.retryAfterSeconds).toBeGreaterThan(0);
    }
    expect(run).toHaveBeenCalledTimes(1);
    t += 10 * 60_000;
    expect((await executeRunNow(deps)).status).toBe(200);
    expect(run).toHaveBeenCalledTimes(2);
  });

  it("runs only the signed-in user and returns the unix-seconds night id", async () => {
    const seen: { id?: string; nightId?: bigint } = {};
    const result = await executeRunNow({
      user: user(),
      limiter: allow(),
      countOpenTasks: async () => 2,
      ensureStorage: () => undefined,
      now: () => NOW,
      run: async (connected, nightId) => {
        seen.id = connected.id;
        seen.nightId = nightId;
        return summary({ nightId: "999", error: `leaked ${MK}`, tasks: [{ id: "t1", type: "DOC_ANALYSIS", status: "FAILED", error: `saw ${SK}`, chosenModel: null, outputRoot: null, requestIds: [] }] });
      },
    });
    expect(seen).toEqual({ id: "user-1", nightId: NIGHT });
    expect(result.status).toBe(200);
    if (result.status !== 200) return;
    expect(result.body.nightId).toBe(NIGHT.toString());
    expect(result.body.status).toBe("DONE");
    const body = JSON.stringify(result.body);
    expect(body).not.toContain(MK);
    expect(body).not.toContain(SK);
    expect(body).toContain("mk-[REDACTED]");
    expect(body).toContain("sk-[REDACTED]");
  });

  it("hides unexpected failures and does not return the secret that caused them", async () => {
    const logs: string[] = [];
    const result = await executeRunNow({
      user: user(),
      limiter: allow(),
      countOpenTasks: async () => 1,
      ensureStorage: () => undefined,
      log: (message) => logs.push(message),
      run: async () => {
        throw new Error(`vault blew up ${MK}`);
      },
    });
    expect(result).toEqual({ status: 500, body: { error: "internal_error" } });
    expect(logs.join("\n")).not.toContain(MK);
    expect(logs.join("\n")).toContain("mk-[REDACTED]");
  });
});

describe("executeManualRun", () => {
  it("calls the shared runUser for that user and does not touch the Router when the upload path is illegal", async () => {
    const calls: string[] = [];
    const saved = new Map<string, TaskPatch>();
    const nights: Array<{ id: bigint; status: "DONE" | "FAILED" }> = [];
    const open: OpenTask = {
      id: "evil",
      type: "DOC_ANALYSIS",
      priority: 2,
      createdAt: new Date("2026-11-06T09:00:00Z"),
      inputPath: "../../etc/passwd",
      inputMeta: { bytes: 4, mime: "text/plain" },
      prompt: null,
    };
    const store: PipelineStore = {
      eligibleUsers: async () => [],
      openTasks: async (userId) => (userId === "user-1" ? [open] : []),
      findRun: async () => null,
      findRunningRun: async () => null,
      createRun: async () => ({ id: "run-real" }),
      updateRun: async () => undefined,
      updateTask: async (id, patch) => {
        saved.set(id, patch);
      },
    };
    const router = new Proxy({} as UserRouter, {
      get: () => () => {
        calls.push("router");
        throw new Error("the Router must not be called");
      },
    });
    const storage: StorageClient = {
      upload: async () => {
        throw new Error("storage must not be called");
      },
      download: async () => {
        throw new Error("storage must not be called");
      },
    };
    const order: string[] = [];
    const hooks: ManualRunHooks = {
      beginNight: async (id) => {
        expect(id).toBe(NIGHT);
      },
      finishNight: async (id, status) => {
        order.push(`finish:${status}`);
        nights.push({ id, status });
      },
      readBack: async (_nightId, userId) => ({
        error: null,
        tasks: [...saved.entries()].filter(() => userId === "user-1").map(([id, patch]) => ({
          id,
          type: open.type,
          status: patch.status ?? "QUEUED",
          error: patch.error ?? null,
          chosenModel: patch.chosenModel ?? null,
          outputRoot: patch.outputRoot ?? null,
          requestIds: [],
        })),
      }),
    };

    const result = await executeRunNow({
      user: user(),
      limiter: allow(),
      countOpenTasks: async () => 1,
      ensureStorage: () => undefined,
      now: () => NOW,
      run: (connected: ConnectedUser, nightId) =>
        executeManualRun({
          user: connected,
          nightId,
          config,
          store,
          router,
          storage,
          hooks,
          anchor: async () => {
            order.push("anchor");
          },
          log: () => undefined,
          now: () => NOW,
        }),
    });

    expect(calls).toEqual([]);
    expect(order).toEqual(["anchor", "finish:DONE"]);
    expect(saved.get("evil")?.status).toBe("FAILED");
    expect(saved.get("evil")?.error).toContain("escapes");
    expect(nights).toEqual([{ id: NIGHT, status: "DONE" }]);
    expect(result.status).toBe(200);
    if (result.status !== 200) return;
    expect(result.body).toMatchObject({
      nightId: NIGHT.toString(),
      status: "DONE",
      runId: "run-real",
      tasks: [{ id: "evil", status: "FAILED" }],
    });
    expect(result.body.tasks[0]?.error).toContain("escapes");
  });

  it("marks the manual night failed when anchoring throws", async () => {
    const nights: Array<"DONE" | "FAILED"> = [];
    const open: OpenTask = {
      id: "evil",
      type: "DOC_ANALYSIS",
      priority: 2,
      createdAt: new Date("2026-11-06T09:00:00Z"),
      inputPath: "../../etc/passwd",
      inputMeta: { bytes: 4, mime: "text/plain" },
      prompt: null,
    };
    const store: PipelineStore = {
      eligibleUsers: async () => [],
      openTasks: async () => [open],
      findRun: async () => null,
      findRunningRun: async () => null,
      createRun: async () => ({ id: "run-real" }),
      updateRun: async () => undefined,
      updateTask: async () => undefined,
    };
    const result = await executeRunNow({
      user: user(),
      limiter: allow(),
      countOpenTasks: async () => 1,
      ensureStorage: () => undefined,
      now: () => NOW,
      run: (connected, nightId) =>
        executeManualRun({
          user: connected,
          nightId,
          config,
          store,
          router: {} as UserRouter,
          storage: { upload: async () => { throw new Error("no"); }, download: async () => { throw new Error("no"); } },
          hooks: {
            beginNight: async () => undefined,
            finishNight: async (_id, status) => {
              nights.push(status);
            },
            readBack: async () => ({ error: null, tasks: [] }),
          },
          anchor: async () => {
            throw new Error("rpc down");
          },
          log: () => undefined,
          now: () => NOW,
        }),
    });
    expect(nights).toEqual(["FAILED"]);
    expect(result).toEqual({ status: 500, body: { error: "internal_error" } });
  });
});
