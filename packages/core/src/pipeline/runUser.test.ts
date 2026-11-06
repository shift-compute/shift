import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { buildCatalog } from "../catalog/catalog";
import { estimateCostMicro, estimateDecisionMicro, estimateTranslationMicro } from "../catalog/estimator";
import { complexityState } from "../optimizer/complexity";
import { COST_DRIFT_PERCENT, costDrifted } from "../optimizer/replan";
import { sealSecret } from "../crypto/vault";
import { RouterError } from "../zg/errors";
import type { StorageClient } from "../zg/storage";
import { translationSystemPrompt, type CommonsItemRef, type CommonsStore, type CommonsTranslationPatch } from "./commons";
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

const DOC_SIZE = { bytes: 21, mime: "text/plain", chars: 21 };

function docEstimate(model: Parameters<typeof buildCatalog>[0][number]): bigint {
  const entry = buildCatalog([model])[0];
  if (!entry) throw new Error("missing catalog entry");
  return estimateCostMicro("DOC_ANALYSIS", DOC_SIZE, { chat: entry });
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
    expect(audio.tasks.get("audio1")).toMatchObject({ status: "DONE", actualCostUsdMicro: 7n, complexity: null });
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

  it("keeps the rest of the plan when the reported cost stays within 1.2×", async () => {
    const priced = { ...chatModel, pricing_usd: { prompt: "0.0001", completion: "0.0006" } };
    const estimate = docEstimate(priced);
    const reported = (estimate * COST_DRIFT_PERCENT) / 100n;
    const budget = estimate * 2n;
    // A replan would see less than one estimate left and defer the second task. Staying under the line must not.
    expect(costDrifted(estimate, reported)).toBe(false);
    expect(reported).toBeGreaterThan(estimate);
    expect(budget - reported).toBeLessThan(estimate);
    let calls = 0;
    const h = harness({
      tasks: [doc("first"), doc("second")],
      models: [priced],
      balance: usdBalance(budget.toString(), "0"),
      chat: async () => {
        calls += 1;
        const cost = calls === 1 ? reported : 1n;
        return { data: { choices: [{ message: { content: '{"summary":"Done.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: cost.toString() } } };
      },
    });
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(calls).toBe(2);
    expect(h.tasks.get("first")).toMatchObject({ status: "DONE", estCostUsdMicro: estimate, actualCostUsdMicro: reported });
    expect(h.tasks.get("second")?.status).toBe("DONE");
  });

  it("replans the rest of the night when a reported cost blows past the estimate", async () => {
    const priced = { ...chatModel, pricing_usd: { prompt: "0.0001", completion: "0.0006" } };
    const estimate = docEstimate(priced);
    const reported = (estimate * COST_DRIFT_PERCENT) / 100n + 1n;
    const budget = estimate * 2n;
    expect(costDrifted(estimate, reported)).toBe(true);
    expect(budget - reported).toBeLessThan(estimate);
    let calls = 0;
    const h = harness({
      tasks: [doc("first"), doc("second")],
      models: [priced],
      balance: usdBalance(budget.toString(), "0"),
      chat: async () => {
        calls += 1;
        return { data: { choices: [{ message: { content: '{"summary":"Done.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: reported.toString() } } };
      },
    });
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(calls).toBe(1);
    expect(h.tasks.get("first")).toMatchObject({ status: "DONE", actualCostUsdMicro: reported });
    expect(h.tasks.get("second")).toMatchObject({ status: "DEFERRED", error: "The task does not fit in the remaining budget." });
  });

  it("replans a zero estimate when the Router reports any positive cost", async () => {
    const freeChat = { ...chatModel, pricing_usd: { prompt: "0", completion: "0" } };
    const imageModel = { id: "z-image-turbo", type: "text-to-image", verifiability: "TeeML", pricing_usd: { image: "0.02" } };
    const entries = buildCatalog([freeChat, imageModel]);
    const chat = entries.find((entry) => entry.kind === "chat");
    const image = entries.find((entry) => entry.kind === "image");
    if (!chat || !image) throw new Error("missing catalog entry");
    const imageEstimate = estimateCostMicro("IMAGE_FROM_PROMPT", { bytes: 0, prompt: "a red balloon" }, { chat, image });
    expect(docEstimate(freeChat)).toBe(0n);
    expect(imageEstimate).toBeGreaterThanOrEqual(10_000n);
    expect(costDrifted(0n, imageEstimate)).toBe(true);
    let images = 0;
    const h = harness({
      tasks: [doc("note"), { id: "poster", type: "IMAGE_FROM_PROMPT", priority: 2, createdAt: new Date("2026-11-06T18:00:00Z"), inputPath: null, inputMeta: {}, prompt: "a red balloon" }],
      models: [freeChat, imageModel],
      balance: usdBalance(imageEstimate.toString(), "0"),
      chat: async () => ({ data: { choices: [{ message: { content: '{"summary":"Done.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: imageEstimate.toString() } } }),
      generateImage: async () => {
        images += 1;
        throw new Error("the image task should have been deferred");
      },
    });
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(images).toBe(0);
    expect(h.tasks.get("note")).toMatchObject({ status: "DONE", estCostUsdMicro: 0n, actualCostUsdMicro: imageEstimate });
    expect(h.tasks.get("poster")).toMatchObject({ status: "DEFERRED", error: "The task does not fit in the remaining budget." });
  });

  it("does not replan when the response has no reported cost", async () => {
    const priced = { ...chatModel, pricing_usd: { prompt: "0.0001", completion: "0.0006" } };
    const estimate = docEstimate(priced);
    const budget = estimate * 2n;
    expect(costDrifted(estimate, undefined)).toBe(false);
    let calls = 0;
    const h = harness({
      tasks: [doc("first"), doc("second")],
      models: [priced],
      balance: usdBalance(budget.toString(), "0"),
      chat: async () => {
        calls += 1;
        return { data: { choices: [{ message: { content: '{"summary":"Done.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc" };
      },
    });
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(calls).toBe(2);
    expect(h.tasks.get("first")).toMatchObject({ status: "DONE", actualCostUsdMicro: null });
    expect(h.tasks.get("second")?.status).toBe("DONE");
  });

  it("drops the remaining queue when the model that failed is no longer usable", async () => {
    const cheap = { id: "lite-chat", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.00000008", completion: "0.00000048" } };
    const premium = { id: "glm-5.3", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.0001", completion: "0.0006" } };
    const cheapCost = docEstimate(cheap);
    const premiumCost = docEstimate(premium);
    const budget = 10_000n;
    // Both tasks fit on lite, and after the failure the leftover still covers another lite call.
    // They are deferred only because that model was removed and glm does not fit.
    expect(cheapCost * 2n).toBeLessThanOrEqual(budget);
    expect(budget - cheapCost).toBeGreaterThanOrEqual(cheapCost);
    expect(premiumCost).toBeGreaterThan(budget);
    const models: string[] = [];
    const h = harness({
      tasks: [doc("first"), doc("second")],
      models: [cheap, premium],
      balance: usdBalance(budget.toString(), "0"),
      chat: async (_sk, body) => {
        models.push(body.model);
        throw new RouterError({ status: 400, code: "model_not_capable", message: "model cannot serve this", requestId: "req-doc" });
      },
    });
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(models).toEqual(["lite-chat"]);
    expect(h.tasks.get("first")?.status).toBe("FAILED");
    expect(h.tasks.get("second")).toMatchObject({ status: "DEFERRED", error: "The task does not fit in the remaining budget." });
  });

  it("replans after a drifted cost even when storing the output fails", async () => {
    const priced = { ...chatModel, pricing_usd: { prompt: "0.0001", completion: "0.0006" } };
    const estimate = docEstimate(priced);
    const reported = (estimate * COST_DRIFT_PERCENT) / 100n + 1n;
    const h = harness({
      tasks: [doc("first"), doc("second")],
      models: [priced],
      balance: usdBalance((estimate * 2n).toString(), "0"),
      chat: async () => ({ data: { choices: [{ message: { content: '{"summary":"Done.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: reported.toString() } } }),
    });
    h.storage.upload = async () => {
      throw new Error("indexer down");
    };
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(h.tasks.get("first")).toMatchObject({ status: "FAILED", actualCostUsdMicro: reported });
    expect(h.tasks.get("first")?.error).toContain("indexer down");
    expect(h.tasks.get("second")).toMatchObject({ status: "DEFERRED", error: "The task does not fit in the remaining budget." });
  });

  it("does not start a queued task on a stale model while a replan is still writing", async () => {
    const cheap = { id: "lite-chat", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.00000008", completion: "0.00000048" } };
    const premium = { id: "glm-5.3", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.0001", completion: "0.0006" } };
    const cheapCost = docEstimate(cheap);
    const premiumCost = docEstimate(premium);
    // Four cheap bases plus one upgrade. The high-priority task is the one that starts on glm.
    const budget = cheapCost * 3n + premiumCost;
    const reported = premiumCost + 1n;
    const left = budget - reported - cheapCost;
    expect(costDrifted(cheapCost, reported)).toBe(true);
    expect(left).toBeGreaterThanOrEqual(cheapCost);
    expect(left).toBeLessThan(cheapCost * 2n);
    expect(budget).toBeGreaterThanOrEqual(10_000n);
    const seen: string[] = [];
    let releaseHolder!: () => void;
    const holderGate = new Promise<void>((resolve) => {
      releaseHolder = resolve;
    });
    const h = harness({
      tasks: [doc("runner"), doc("holder"), doc("drop"), doc("switch", { priority: 3 })],
      models: [cheap, premium],
      balance: usdBalance(budget.toString(), "0"),
      chat: async (_sk, body, options) => {
        const id = options?.clientRequestId?.split("-")[0] ?? "";
        seen.push(`${id}:${body.model}`);
        if (id === "holder") await holderGate;
        const cost = id === "runner" ? reported : 1n;
        return { data: { choices: [{ message: { content: '{"summary":"Done.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: `req-${id}`, trace: { billing: { total_cost_usd_micro: cost.toString() } } };
      },
    });
    const updateTask = h.store.updateTask.bind(h.store);
    h.store.updateTask = async (id, patch) => {
      if (id === "drop" && patch.status === "DEFERRED") {
        releaseHolder();
        await new Promise((resolve) => setTimeout(resolve, 0));
      }
      await updateTask(id, patch);
    };
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0, MAX_CONCURRENCY: 2 } });
    expect(seen.some((row) => row.startsWith("drop:"))).toBe(false);
    expect(seen).toContain("switch:lite-chat");
    expect(seen.some((row) => row.startsWith("switch:") && row.endsWith("glm-5.3"))).toBe(false);
    expect(h.tasks.get("runner")?.status).toBe("DONE");
    expect(h.tasks.get("holder")?.status).toBe("DONE");
    expect(h.tasks.get("drop")).toMatchObject({ status: "DEFERRED", error: "The task does not fit in the remaining budget." });
    expect(h.tasks.get("switch")).toMatchObject({ status: "DONE", chosenModel: "lite-chat" });
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
    expect(h.tasks.get("task1")?.complexity).toBe("complex");
    expect([...h.runs.values()][0]?.spentUsdMicro).toBe(7n);
  });

  it("classifies short text with the small decision model and long text with the large one", async () => {
    const models = [
      chatModel,
      { id: "laya", type: "decisions", verifiability: "TeeML", context_length: 512, pricing_usd: { prompt: "0", completion: "0" } },
      { id: "vela-2.0-9b", type: "decisions", verifiability: "TeeML", context_length: 16384, pricing_usd: { prompt: "0", completion: "0" } },
    ];
    const decide = (seen: string[]): UserRouter["decide"] => async (_sk, body) => {
      seen.push(body.model);
      return {
        data: { model: body.model, answers: { complexity: { type: "choice", probabilities: { simple: 0.8, standard: 0.1, complex: 0.1 } } } },
        status: 200,
        requestId: "req-decide",
      };
    };

    const shortSeen: string[] = [];
    const short = harness({ models, decide: decide(shortSeen) });
    await run(short);
    expect(shortSeen).toEqual(["laya"]);
    expect(short.tasks.get("task1")?.complexity).toBe("simple");

    const longSeen: string[] = [];
    const long = harness({ models, decide: decide(longSeen) });
    await run(long, { readFile: async () => new TextEncoder().encode("x".repeat(3000)) });
    expect(longSeen).toEqual(["vela-2.0-9b"]);
  });

  it("uses a non-private decision model when the catalog has no TeeML one", async () => {
    const seen: Array<{ model: string; trustMode?: string }> = [];
    const h = harness({
      models: [chatModel, { id: "open-decider", type: "decisions", context_length: 8192, pricing_usd: { prompt: "0", completion: "0" } }],
      decide: async (_sk, body, options) => {
        seen.push({ model: body.model, trustMode: options?.trustMode });
        return {
          data: { model: body.model, answers: { complexity: { type: "choice", probabilities: { standard: 0.9, simple: 0.05, complex: 0.05 } } } },
          status: 200,
          requestId: "req-decide",
        };
      },
    });
    await run(h);
    expect(seen).toEqual([{ model: "open-decider", trustMode: "standard" }]);
    expect(h.tasks.get("task1")?.complexity).toBe("standard");
  });

  it("plans standard and does not call decisions when the catalog has no decision model", async () => {
    const h = harness();
    await run(h);
    expect(h.tasks.get("task1")?.complexity).toBe("standard");
    expect(h.events).not.toContain("decide");
    expect([...h.runs.values()][0]?.spentUsdMicro).toBe(100n);
  });

  it("holds back the task estimate when the decision call reports no cost", async () => {
    const text = "Hello from the report";
    const decisionModel = { id: "wide-decision", type: "decisions", verifiability: "TeeML", context_length: 16384, pricing_usd: { prompt: "0.002", completion: "0" } };
    const catalog = buildCatalog([chatModel, decisionModel]);
    const decision = catalog.find((entry) => entry.kind === "decision");
    const chat = catalog.find((entry) => entry.kind === "chat");
    if (!decision || !chat) throw new Error("catalog fixture is missing a model");
    const taskCost = estimateCostMicro("DOC_ANALYSIS", { bytes: text.length, mime: "text/plain", chars: text.length }, { chat });
    const decisionCost = estimateDecisionMicro(decision, complexityState("DOC_ANALYSIS task", text).length);
    const budget = taskCost + decisionCost - 1n;
    expect(decisionCost).toBeGreaterThan(0n);
    expect(budget).toBeGreaterThanOrEqual(10_000n);

    let decided = 0;
    const h = harness({
      models: [chatModel, decisionModel],
      balance: usdBalance(budget.toString(), "0"),
      decide: async () => {
        decided += 1;
        return {
          data: { model: "wide-decision", answers: { complexity: { type: "choice", probabilities: { simple: 0.9, standard: 0.05, complex: 0.05 } } } },
          status: 200,
          requestId: "req-decide",
        };
      },
    });
    await run(h, { config: { ...config, SAFETY_MARGIN_PCT: 0 }, readFile: async () => new TextEncoder().encode(text) });
    expect(decided).toBe(1);
    expect(h.events).not.toContain("chat");
    expect(h.tasks.get("task1")?.status).toBe("DEFERRED");
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

  it("spends leftover budget on one translation pair and leaves the next item pending", async () => {
    const source = "Ethereum gas pays for a smart contract.";
    const cheap = { id: "lite-chat", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.0001", completion: "0.0001" } };
    const premium = { id: "glm-5.3", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.0001", completion: "0.0001" } };
    const entries = buildCatalog([cheap, premium]);
    const glm = entries.find((entry) => entry.id === "glm-5.3");
    const lite = entries.find((entry) => entry.id === "lite-chat");
    if (!glm || !lite) throw new Error("missing catalog entry");
    const taskEstimate = estimateCostMicro("DOC_ANALYSIS", DOC_SIZE, { chat: glm });
    const onePair = estimateTranslationMicro(glm, source.length, translationSystemPrompt("Hindi").length) + estimateTranslationMicro(lite, source.length, translationSystemPrompt("Hindi").length);
    const rows = [commonsRow("c1", source, "hi"), commonsRow("c2", source, "mr")];
    const models: string[] = [];
    const h = harness({
      models: [cheap, premium],
      balance: usdBalance((taskEstimate + onePair).toString(), "0"),
      chat: async (_sk, body) => {
        models.push(body.model);
        const translating = body.messages.some((message) => message.role === "system" && message.content.startsWith("Translate the text from English"));
        if (!translating) {
          return { data: { choices: [{ message: { content: '{"summary":"Done.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: taskEstimate.toString() } } };
        }
        return { data: { choices: [{ message: { content: `tr-${body.model}` } }] }, status: 200, requestId: `req-${body.model}`, trace: { billing: { total_cost_usd_micro: "1" } } };
      },
    });
    await run(h, {
      user: user({ donateLeftover: true }),
      commons: memoryCommons(rows),
      config: { ...config, SAFETY_MARGIN_PCT: 0 },
    });
    expect(h.tasks.get("task1")?.status).toBe("DONE");
    expect(models).toEqual(["glm-5.3", "glm-5.3", "lite-chat"]);
    expect(rows[0]).toMatchObject({ status: "RUNNING", translationA: "tr-glm-5.3", translationB: "tr-lite-chat", requestIds: ["req-glm-5.3", "req-lite-chat"], costUsdMicro: 2n, donorUserId: "user-1", nightId: NIGHT });
    expect(rows[1]?.status).toBe("PENDING");
    expect([...h.runs.values()][0]).toMatchObject({ spentUsdMicro: taskEstimate, donatedUsdMicro: 2n });
    expect(h.events).toContain("revoke");
    expect(h.uploads).toHaveLength(1);
  });

  it("does not translate when leftover donation is off", async () => {
    const rows = [commonsRow("c1", "Ethereum gas pays for a smart contract.", "hi")];
    let chats = 0;
    const h = harness({
      models: [
        { id: "lite-chat", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.000001", completion: "0.000001" } },
        { id: "glm-5.3", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.000001", completion: "0.000001" } },
      ],
      chat: async () => {
        chats += 1;
        return { data: { choices: [{ message: { content: '{"summary":"Done.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: "1" } } };
      },
    });
    await run(h, { commons: memoryCommons(rows), config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(chats).toBe(1);
    expect(rows[0]?.status).toBe("PENDING");
    expect([...h.runs.values()][0]?.donatedUsdMicro).toBe(0n);
  });

  it("translates with no personal tasks when donation is on", async () => {
    const source = "Ethereum gas pays for a smart contract.";
    const rows = [commonsRow("c1", source, "hi")];
    const h = harness({
      tasks: [],
      models: [
        { id: "0gm-1.0-35b-a3b", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.000001", completion: "0.000001" } },
        { id: "glm-5.3", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0.000001", completion: "0.000001" } },
      ],
      chat: async (_sk, body) => ({ data: { choices: [{ message: { content: body.model } }] }, status: 200, requestId: `req-${body.model}`, trace: { billing: { total_cost_usd_micro: "5" } } }),
    });
    const outcome = await run(h, { user: user({ donateLeftover: true }), commons: memoryCommons(rows), config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(outcome.status).toBe("DONE");
    expect(rows[0]).toMatchObject({ status: "RUNNING", modelA: "glm-5.3", modelB: "0gm-1.0-35b-a3b", translationA: "glm-5.3", translationB: "0gm-1.0-35b-a3b" });
    expect([...h.runs.values()][0]).toMatchObject({ spentUsdMicro: 0n, donatedUsdMicro: 10n });
    expect(h.uploads).toHaveLength(0);
    expect(h.events).toContain("revoke");
  });

  it("does not create a key for commons when the catalog has no private chat pair", async () => {
    const rows = [commonsRow("c1", "Ethereum gas pays for a smart contract.", "hi")];
    const h = harness({
      tasks: [],
      models: [
        { id: "plain-chat", type: "chatbot", pricing_usd: { prompt: "0.000001", completion: "0.000001" } },
        { id: "other-chat", type: "chatbot", pricing_usd: { prompt: "0.000001", completion: "0.000001" } },
      ],
      chat: async () => {
        throw new Error("chat must not be called");
      },
    });
    const outcome = await run(h, { user: user({ donateLeftover: true }), commons: memoryCommons(rows), config: { ...config, SAFETY_MARGIN_PCT: 0 } });
    expect(outcome.status).toBe("DONE");
    expect(h.events).toEqual(["models", "balance"]);
    expect(rows[0]?.status).toBe("PENDING");
    expect(h.logs.join("\n")).toContain("fewer than two private chat models");
    expect([...h.runs.values()][0]?.donatedUsdMicro).toBe(0n);
  });
});

function commonsRow(id: string, sourceText: string, targetLang: string): CommonsItemRef & CommonsTranslationPatch & { status: "PENDING" | "RUNNING" | "FAILED"; requestIds: string[] } {
  return { id, sourceText, targetLang, status: "PENDING", requestIds: [] };
}

function memoryCommons(rows: Array<CommonsItemRef & { status: "PENDING" | "RUNNING" | "FAILED"; requestIds: string[] }>): CommonsStore {
  return {
    pendingItems: async () => rows.filter((row) => row.status === "PENDING").map((row) => ({ id: row.id, sourceText: row.sourceText, targetLang: row.targetLang })),
    claim: async (id, donor) => {
      const row = rows.find((item) => item.id === id);
      if (!row || row.status !== "PENDING") return false;
      row.status = "RUNNING";
      Object.assign(row, { donorUserId: donor.userId, nightId: donor.nightId });
      return true;
    },
    save: async (id, patch) => {
      const row = rows.find((item) => item.id === id);
      if (!row) throw new Error(`missing ${id}`);
      Object.assign(row, patch);
    },
  };
}
