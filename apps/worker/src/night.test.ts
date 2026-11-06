import { describe, expect, it } from "vitest";
import { sealSecret, type WorkerConfig } from "@shift/core";
import { runNight } from "./night";
import type { UserRouter } from "./pipeline/runUser";
import type { ConnectedUser, OpenTask, PipelineStore, TaskPatch } from "./pipeline/store";

const KEY = Buffer.alloc(32, 4).toString("base64");
const ADDRESS = "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f";

function connected(id: string, secret: string): ConnectedUser {
  const sealed = sealSecret(secret, KEY, ADDRESS.toLowerCase());
  return {
    id,
    accountAddress: ADDRESS,
    mode: "IAI_CREDITS_ONLY",
    nightlyBudgetUsdMicro: null,
    donateLeftover: false,
    mkCiphertext: sealed.ciphertext,
    mkIv: sealed.iv,
    mkAuthTag: sealed.authTag,
  };
}

function memory(users: ConnectedUser[], tasks: OpenTask[]) {
  const state = new Map<string, TaskPatch>();
  const runs: string[] = [];
  let modelsCalls = 0;
  const store: PipelineStore = {
    eligibleUsers: async () => users,
    openTasks: async (userId) => tasks.filter((task) => task.inputPath?.startsWith(userId) && (state.get(task.id)?.status ?? "QUEUED") !== "DONE"),
    findRun: async () => null,
    createRun: async (_nightId, userId) => {
      runs.push(userId);
      return { id: `run-${userId}` };
    },
    updateRun: async () => undefined,
    updateTask: async (id, patch) => {
      state.set(id, { ...state.get(id), ...patch });
    },
  };
  return { store, state, runs, modelsCalls: () => modelsCalls, countModels: () => { modelsCalls += 1; } };
}

const config = {
  SHIFT_MASTER_KEY: KEY,
  SAFETY_MARGIN_PCT: 0,
  MAX_CONCURRENCY: 1,
  NIGHT_START_UTC: "23:00",
  NIGHT_HARD_STOP_UTC: "23:50",
  UPLOAD_DIR: "/tmp/shift-uploads",
} as WorkerConfig;

const docReply = { data: { choices: [{ message: { content: '{"summary":"Ok.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: "1" } } };

describe("runNight", () => {
  it("finishes quietly when nobody is connected", async () => {
    const logs: string[] = [];
    const store = memory([], []).store;
    await runNight({
      config,
      nightId: 20261106n,
      log: (message) => logs.push(message),
      store,
      router: { listModels: async () => { throw new Error("should not be called"); } } as unknown as UserRouter,
      storage: { upload: async () => { throw new Error("should not be called"); }, download: async () => { throw new Error("no"); } },
    });
    expect(logs.join("\n")).toContain("0 connected");
  });

  it("runs the next user when the first one fails, and loads the catalog once", async () => {
    const mkA = "mk-aaaaaaaaaaaaaaaaaaaa";
    const mkB = "mk-bbbbbbbbbbbbbbbbbbbb";
    const users = [connected("a", mkA), connected("b", mkB)];
    const tasks: OpenTask[] = [
      { id: "ta", type: "DOC_ANALYSIS", priority: 2, createdAt: new Date(), inputPath: "a/doc.txt", inputMeta: { mime: "text/plain" }, prompt: null },
      { id: "tb", type: "DOC_ANALYSIS", priority: 2, createdAt: new Date(), inputPath: "b/doc.txt", inputMeta: { mime: "text/plain" }, prompt: null },
    ];
    const mem = memory(users, tasks);
    let models = 0;
    const router = {
      listModels: async () => {
        models += 1;
        return { data: [{ id: "0gm-1.0-35b-a3b", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0", completion: "0" } }], status: 200 };
      },
      getBalance: async (mk: string) => {
        if (mk === mkA) throw new Error("router down for the first user");
        return { data: { address: ADDRESS, currency: "usd", credit_balance: "1000000", deposit_balance: "0", pending_charge: "0", total_balance: "1000000" }, status: 200 };
      },
      getUsageHistory: async () => ({ data: [], status: 200 }),
      createApiKey: async () => ({ data: { key_id: "key-b", key: "sk-bbbbbbbbbbbbbbbbbbbb", name: "shift" }, status: 200 }),
      revokeApiKey: async () => ({ data: { key_id: "key-b" }, status: 200 }),
      chat: async () => docReply,
      decide: async () => { throw new Error("no"); },
      transcribe: async () => { throw new Error("no"); },
      generateImage: async () => { throw new Error("no"); },
    } as UserRouter;

    await runNight({
      config,
      nightId: 20261106n,
      log: () => undefined,
      store: mem.store,
      router,
      storage: { upload: async () => ({ rootHash: `0x${"ab".repeat(32)}`, txHash: `0x${"cd".repeat(32)}` }), download: async () => new Uint8Array() },
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
      readFile: async () => new TextEncoder().encode("hello"),
    });

    expect(models).toBe(1);
    expect(mem.runs).toEqual(["a", "b"]);
    expect(mem.state.get("ta")?.status).toBeUndefined();
    expect(mem.state.get("tb")?.status).toBe("DONE");
  });

  it("does not start a later user after the hard stop", async () => {
    const users = [connected("a", "mk-aaaaaaaaaaaaaaaaaaaa"), connected("b", "mk-bbbbbbbbbbbbbbbbbbbb")];
    const tasks: OpenTask[] = [
      { id: "ta", type: "DOC_ANALYSIS", priority: 2, createdAt: new Date(), inputPath: "a/doc.txt", inputMeta: { mime: "text/plain" }, prompt: null },
      { id: "tb", type: "DOC_ANALYSIS", priority: 2, createdAt: new Date(), inputPath: "b/doc.txt", inputMeta: { mime: "text/plain" }, prompt: null },
    ];
    const mem = memory(users, tasks);
    let now = new Date("2026-11-06T23:40:00Z");
    const router = {
      listModels: async () => ({ data: [{ id: "0gm-1.0-35b-a3b", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0", completion: "0" } }], status: 200 }),
      getBalance: async () => ({ data: { address: ADDRESS, currency: "usd", credit_balance: "1000000", deposit_balance: "0", pending_charge: "0", total_balance: "1000000" }, status: 200 }),
      getUsageHistory: async () => ({ data: [], status: 200 }),
      createApiKey: async () => ({ data: { key_id: "key", key: "sk-cccccccccccccccccccc", name: "shift" }, status: 200 }),
      revokeApiKey: async () => ({ data: { key_id: "key" }, status: 200 }),
      chat: async () => {
        now = new Date("2026-11-06T23:50:00Z");
        return docReply;
      },
      decide: async () => { throw new Error("no"); },
      transcribe: async () => { throw new Error("no"); },
      generateImage: async () => { throw new Error("no"); },
    } as UserRouter;

    await runNight({
      config,
      nightId: 20261106n,
      log: () => undefined,
      store: mem.store,
      router,
      storage: { upload: async () => ({ rootHash: `0x${"ab".repeat(32)}`, txHash: `0x${"cd".repeat(32)}` }), download: async () => new Uint8Array() },
      now: () => now,
      sleep: async () => undefined,
      readFile: async () => new TextEncoder().encode("hello"),
    });

    expect(mem.runs).toEqual(["a"]);
    expect(mem.state.get("tb")).toBeUndefined();
  });
});
