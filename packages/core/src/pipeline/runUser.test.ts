import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildCatalog } from "../catalog/catalog";
import { estimateCostMicro } from "../catalog/estimator";
import { sealSecret } from "../crypto/vault";
import { RouterError } from "../zg/errors";
import type { StorageClient } from "../zg/storage";
import { runUser, type RunConfig, type UserRouter } from "./runUser";
import type { ConnectedUser, OpenTask, PipelineStore, TaskPatch } from "./store";

const MK = "mk-0123456789abcdefghijklmnop";
const SK = "sk-abcdefghijklmnopqrstuvwxyz";
const KEY = Buffer.alloc(32, 7).toString("base64");
const ADDRESS = "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f";
const NIGHT = 20261106n;
const NOW = () => new Date("2026-11-06T23:10:00Z");

const config: RunConfig = {
  SHIFT_MASTER_KEY: KEY,
  SAFETY_MARGIN_PCT: 10,
  MAX_CONCURRENCY: 1,
  NIGHT_HARD_STOP_UTC: "23:50",
  UPLOAD_DIR: "/tmp/shift-uploads",
};

function user(over: Partial<ConnectedUser> = {}): ConnectedUser {
  const sealed = sealSecret(MK, KEY, ADDRESS.toLowerCase());
  return {
    id: "user-1",
    accountAddress: ADDRESS,
    mode: "IAI_CREDITS_ONLY",
    nightlyBudgetUsdMicro: null,
    donateLeftover: false,
    mkCiphertext: sealed.ciphertext,
    mkIv: sealed.iv,
    mkAuthTag: sealed.authTag,
    ...over,
  };
}

function doc(id = "task1", over: Partial<OpenTask> = {}): OpenTask {
  return {
    id,
    type: "DOC_ANALYSIS",
    priority: 2,
    createdAt: new Date("2026-11-06T12:00:00Z"),
    inputPath: `${id}.txt`,
    inputMeta: { bytes: 21, mime: "text/plain" },
    prompt: null,
    ...over,
  };
}

const chatModel = {
  id: "0gm-1.0-35b-a3b",
  type: "chatbot",
  verifiability: "TeeML",
  pricing_usd: { prompt: "0.00000008", completion: "0.00000048" },
  pricing: { prompt: "548000000000", completion: "3290000000000" },
};

function usdBalance(credit = "100000000", deposit = "999000000") {
  return { address: ADDRESS, currency: "usd", credit_balance: credit, deposit_balance: deposit, pending_charge: "0", total_balance: credit };
}

interface SavedRun {
  id: string;
  status: string;
  error?: string | null;
  ephemeralKeyId?: string | null;
  keyRevokedAt?: Date | null;
  spentUsdMicro?: bigint;
  donatedUsdMicro?: bigint;
  creditUsed?: string | null;
  depositUsed?: string | null;
}

interface Harness {
  events: string[];
  logs: string[];
  tasks: Map<string, TaskPatch & { status?: string }>;
  runs: Map<string, SavedRun>;
  uploads: Uint8Array[];
  store: PipelineStore;
  router: UserRouter;
  storage: StorageClient;
}

function harness(options: { tasks?: OpenTask[]; models?: unknown[]; balance?: ReturnType<typeof usdBalance>; chat?: UserRouter["chat"]; transcribe?: UserRouter["transcribe"]; generateImage?: UserRouter["generateImage"]; decide?: UserRouter["decide"] } = {}): Harness {
  const events: string[] = [];
  const logs: string[] = [];
  const tasks = new Map<string, TaskPatch & { status?: string }>();
  const runs = new Map<string, SavedRun>();
  const uploads: Uint8Array[] = [];
  const open = options.tasks ?? [doc()];
  let seq = 0;

  const store: PipelineStore = {
    eligibleUsers: async () => [],
    openTasks: async () => open.filter((task) => {
      const status = tasks.get(task.id)?.status ?? "QUEUED";
      return status === "QUEUED" || status === "DEFERRED";
    }),
    findRun: async () => null,
    createRun: async () => {
      const id = `run-${++seq}`;
      runs.set(id, { id, status: "RUNNING", ephemeralKeyId: null, keyRevokedAt: null });
      return { id };
    },
    updateRun: async (id, patch) => {
      const run = runs.get(id);
      if (!run) throw new Error(`missing run ${id}`);
      Object.assign(run, patch);
      if (patch.ephemeralKeyId) events.push("persist");
      if (patch.keyRevokedAt) events.push("marked-revoked");
    },
    updateTask: async (id, patch) => {
      tasks.set(id, { ...tasks.get(id), ...patch });
    },
  };

  const router: UserRouter = {
    listModels: async () => {
      events.push("models");
      return { data: (options.models ?? [chatModel]) as never, status: 200 };
    },
    getBalance: async () => {
      events.push("balance");
      return { data: options.balance ?? usdBalance(), status: 200 };
    },
    getUsageHistory: async () => ({
      data: [
        { request_id: "req-other", credit_used: "5", deposit_used: "7" },
        { request_id: "req-doc", credit_used: "40", deposit_used: "1" },
        { request_id: "req-audio", credit_used: "3", deposit_used: "0" },
        { request_id: "req-image", credit_used: "2", deposit_used: "0" },
      ],
      status: 200,
    }),
    createApiKey: async (_mk, params) => {
      events.push(`create:${params.trustMode}:${params.creditLimit}`);
      return { data: { key_id: "key-1", key: SK, name: params.name }, status: 200 };
    },
    revokeApiKey: async () => {
      events.push("revoke");
      return { data: { key_id: "key-1" }, status: 200 };
    },
    chat: options.chat ?? (async () => {
      events.push("chat");
      return { data: { choices: [{ message: { content: '{"summary":"A short summary.","actionItems":["Send it"],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: "100", currency: "usd" } } };
    }),
    decide: options.decide ?? (async () => {
      throw new Error("no decision model was expected");
    }),
    transcribe: options.transcribe ?? (async () => {
      throw new Error("no transcription was expected");
    }),
    generateImage: options.generateImage ?? (async () => {
      throw new Error("no image was expected");
    }),
  };

  const storage: StorageClient = {
    upload: async (bytes: Uint8Array) => {
      uploads.push(bytes);
      return { rootHash: `0x${createHash("sha256").update(bytes).digest("hex")}`, txHash: `0x${"11".repeat(32)}` };
    },
    download: async () => {
      throw new Error("not used");
    },
  };

  return { events, logs, tasks, runs, uploads, store, router, storage };
}

function run(h: Harness, over: Partial<Parameters<typeof runUser>[0]> = {}) {
  return runUser({
    user: user(),
    nightId: NIGHT,
    config,
    store: h.store,
    router: h.router,
    storage: h.storage,
    log: (message) => h.logs.push(message),
    now: NOW,
    sleep: async () => undefined,
    readFile: async () => new TextEncoder().encode("Hello from the report"),
    ...over,
  });
}

describe("runUser", () => {
  it("caps a private key from the credit balance, stores the output and revokes the key", async () => {
    const h = harness();
    const outcome = await run(h);
    expect(outcome.status).toBe("DONE");
    expect(h.events).toEqual(["models", "balance", "create:private:90", "persist", "chat", "revoke", "marked-revoked", "balance"]);
    const task = h.tasks.get("task1");
    expect(task?.status).toBe("DONE");
    expect(task?.chosenModel).toBe("0gm-1.0-35b-a3b");
    expect(task?.actualCostUsdMicro).toBe(100n);
    expect(task?.outputRoot).toBe(`0x${createHash("sha256").update(h.uploads[0]!).digest("hex")}`);
    expect(JSON.parse(new TextDecoder().decode(h.uploads[0]!)).result.summary).toBe("A short summary.");
    const saved = [...h.runs.values()][0];
    expect(saved?.spentUsdMicro).toBe(100n);
    expect(saved?.creditUsed).toBe("40");
    expect(saved?.depositUsed).toBe("1");
    expect(saved?.donatedUsdMicro).toBe(0n);
    expect(h.logs.join("\n")).not.toContain(MK);
    expect(h.logs.join("\n")).not.toContain(SK);
  });

  it("runs an audio task and an image task through their executors", async () => {
    const audio = harness({
      tasks: [{ id: "audio1", type: "AUDIO_SUMMARY", priority: 2, createdAt: new Date(), inputPath: "clip.mp3", inputMeta: { bytes: 4, mime: "audio/mpeg" }, prompt: null }],
      models: [chatModel, { id: "whisper-large-v3", type: "speech-to-text", verifiability: "TeeML", pricing_usd: { prompt: "0.00001" } }],
      transcribe: async () => ({ data: { text: "good morning" }, status: 200, requestId: "req-audio", trace: { billing: { total_cost_usd_micro: "3" } } }),
      chat: async () => ({ data: { choices: [{ message: { content: '{"summary":"Morning.","keyPoints":["Hello"]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: "4" } } }),
    });
    await run(audio, { readFile: async () => new Uint8Array([0x49, 0x44, 0x33, 0]) });
    expect(audio.tasks.get("audio1")).toMatchObject({ status: "DONE", actualCostUsdMicro: 7n });
    expect(audio.events).toContain("revoke");

    const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1]);
    const image = harness({
      tasks: [{ id: "image1", type: "IMAGE_FROM_PROMPT", priority: 2, createdAt: new Date(), inputPath: null, inputMeta: {}, prompt: "a red balloon" }],
      models: [{ ...chatModel }, { id: "z-image-turbo", type: "text-to-image", verifiability: "TeeML", pricing_usd: { image: "0.001" } }],
      chat: async () => ({ data: { choices: [{ message: { content: '{"prompt":"a red balloon over a quiet street"}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: "5" } } }),
      generateImage: async () => ({ data: { data: [{ b64_json: png.toString("base64") }] }, status: 200, requestId: "req-image", trace: { billing: { total_cost_usd_micro: "9" } } }),
    });
    await run(image);
    expect(image.tasks.get("image1")?.status).toBe("DONE");
    expect(image.uploads).toHaveLength(2);
    expect(image.runs.values().next().value?.creditUsed).toBe("42");
  });

  it("defers what does not fit and does not create a key when nothing fits", async () => {
    const expensive = { ...chatModel, pricing_usd: { prompt: "1", completion: "1" } };
    const h = harness({
      tasks: [doc("high", { priority: 3 }), doc("low", { priority: 1 })],
      models: [expensive],
      balance: usdBalance("10000", "0"),
    });
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(h.events.some((event) => event.startsWith("create"))).toBe(false);
    expect(h.tasks.get("high")?.status).toBe("DEFERRED");
    expect(h.tasks.get("low")?.status).toBe("DEFERRED");
  });

  it("does not create a key when the user has no tasks or the balance is below the minimum", async () => {
    const empty = harness({ tasks: [] });
    expect((await run(empty)).status).toBe("SKIPPED");
    expect(empty.events).toEqual([]);

    const poor = harness({ balance: usdBalance("100", "500000000") });
    expect((await run(poor, { config: { ...config, SAFETY_MARGIN_PCT: 0 } })).status).toBe("SKIPPED");
    expect(poor.events).toEqual(["models", "balance"]);
    expect(poor.tasks.get("task1")?.status).toBeUndefined();
  });

  it("refuses a 0G account when the catalog implies no rate", async () => {
    const h = harness({
      balance: { ...usdBalance((10n ** 18n).toString(), "0"), currency: "0g" },
      models: [{ id: "0gm-1.0-35b-a3b", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.00000008", completion: "0.00000048" } }],
    });
    const outcome = await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(outcome.status).toBe("FAILED");
    expect([...h.runs.values()][0]?.error).toContain("without inventing a rate");
    expect(h.events.some((event) => event.startsWith("create"))).toBe(false);
  });

  it("keeps going after one task fails, and still revokes the key", async () => {
    let calls = 0;
    const h = harness({
      tasks: [doc("bad"), doc("good")],
      chat: async () => {
        calls += 1;
        if (calls === 1) throw new Error(`model exploded ${SK}`);
        return { data: { choices: [{ message: { content: '{"summary":"Ok.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: "10" } } };
      },
    });
    await run(h);
    expect(h.tasks.get("bad")?.status).toBe("FAILED");
    expect(h.tasks.get("bad")?.error).toContain("sk-[REDACTED]");
    expect(h.tasks.get("bad")?.error).not.toContain(SK);
    expect(h.tasks.get("good")?.status).toBe("DONE");
    expect(h.events).toContain("revoke");
  });

  it("stops the rest of the queue when the balance runs out", async () => {
    let calls = 0;
    const h = harness({
      tasks: [doc("first"), doc("second")],
      chat: async () => {
        calls += 1;
        throw new RouterError({ status: 402, code: "insufficient_balance", message: "insufficient balance" });
      },
    });
    await run(h);
    expect(calls).toBe(1);
    expect(h.tasks.get("first")?.status).toBe("FAILED");
    expect(h.tasks.get("second")?.status).toBe("DEFERRED");
    expect(h.events).toContain("revoke");
  });

  it("retries a 5xx twice and then stores the successful call", async () => {
    const attempts: string[] = [];
    const h = harness({
      chat: async (_sk, _body, options) => {
        attempts.push(options?.clientRequestId ?? "");
        if (attempts.length < 3) throw new RouterError({ status: 500, message: "upstream down" });
        return { data: { choices: [{ message: { content: '{"summary":"Recovered.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: "8" } } };
      },
    });
    await run(h);
    expect(attempts).toEqual(["task1-0-analyze", "task1-1-analyze", "task1-2-analyze"]);
    expect(h.tasks.get("task1")?.status).toBe("DONE");
  });

  it("does not start after the hard stop and will not run over a key that is still alive", async () => {
    const stopped = harness();
    const outcome = await run(stopped, { now: () => new Date("2026-11-06T23:50:00Z") });
    expect(outcome.status).toBe("SKIPPED");
    expect(stopped.events).toEqual([]);
    expect(stopped.tasks.size).toBe(0);

    const blocked = harness();
    blocked.store.findRun = async () => ({ id: "run-old", status: "RUNNING", ephemeralKeyId: "key-old", keyRevokedAt: null });
    const update = vi.fn(async () => undefined);
    blocked.store.updateRun = update;
    const again = await run(blocked);
    expect(again).toEqual({ status: "FAILED", runId: "run-old" });
    expect(blocked.events).toEqual([]);
    expect(update).toHaveBeenCalledWith("run-old", expect.objectContaining({ status: "FAILED" }));
  });

  it("fails a task whose path escapes the upload directory and does not call the router", async () => {
    const h = harness({ tasks: [doc("evil", { inputPath: "../../etc/passwd" })] });
    await run(h);
    expect(h.tasks.get("evil")).toMatchObject({ status: "FAILED" });
    expect(h.tasks.get("evil")?.error).toContain("escapes");
    expect(h.events).toEqual([]);
  });

  it("replans the rest of the night when a reported cost blows past the estimate", async () => {
    const priced = { ...chatModel, pricing_usd: { prompt: "0.0001", completion: "0.0006" } };
    const estimate = estimateCostMicro("DOC_ANALYSIS", { bytes: 21, mime: "text/plain", chars: 21 }, { chat: buildCatalog([priced])[0]! });
    // Both tasks fit the estimate; the first call then reports the whole budget.
    const budget = estimate * 2n;
    let calls = 0;
    const h = harness({
      tasks: [doc("first"), doc("second")],
      models: [priced],
      balance: usdBalance(budget.toString(), "0"),
      chat: async () => {
        calls += 1;
        return { data: { choices: [{ message: { content: '{"summary":"Done.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: budget.toString() } } };
      },
    });
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(calls).toBe(1);
    expect(h.tasks.get("first")?.status).toBe("DONE");
    expect(h.tasks.get("second")?.status).toBe("DEFERRED");
  });

  it("drops a task whose decision comes back as complex when no model is good enough", async () => {
    const h = harness({
      models: [chatModel, { id: "vela-2.0-9b", type: "decisions", verifiability: "TeeML", context_length: 16000, pricing_usd: { prompt: "0", completion: "0" } }],
      decide: async () => ({
        data: { model: "vela-2.0-9b", answers: { complexity: { type: "choice", choice: "complex", probabilities: { complex: 0.91, standard: 0.05, simple: 0.04 } } } },
        status: 200,
        requestId: "req-decide",
        trace: { billing: { total_cost_usd_micro: "7" } },
      }),
    });
    await run(h);
    expect(h.events).toContain("revoke");
    expect(h.events).not.toContain("chat");
    expect(h.tasks.get("task1")?.status).toBe("DEFERRED");
    expect(h.tasks.get("task1")?.steps).toMatchObject([{ step: "classify", requestId: "req-decide" }]);
    expect([...h.runs.values()][0]?.spentUsdMicro).toBe(7n);
  });

  it("runs two tasks at once when the concurrency allows it", async () => {
    let inFlight = 0;
    let max = 0;
    const h = harness({
      tasks: [doc("a"), doc("b")],
      chat: async () => {
        inFlight += 1;
        max = Math.max(max, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 20));
        inFlight -= 1;
        return { data: { choices: [{ message: { content: '{"summary":"Ok.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: "1" } } };
      },
    });
    await run(h, { config: { ...config, MAX_CONCURRENCY: 2 } });
    expect(max).toBe(2);
    expect(h.tasks.get("a")?.status).toBe("DONE");
    expect(h.tasks.get("b")?.status).toBe("DONE");
  });
});
