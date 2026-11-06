import { describe, expect, it, vi } from "vitest";
import type { Balance, Model } from "../zg/schemas";
import { previewTonight, type PreviewAccount, type PreviewRouter } from "./preview";
import type { OpenTask } from "./store";

const SECRET = "mk-preview-secret-value";

const iai: PreviewAccount = { mode: "IAI_CREDITS_ONLY", nightlyBudgetUsdMicro: null };

function chat(id: string, prompt: string, completion: string, withRate = false): Model {
  const wei: Record<string, string> = {
    "0.000000001": "100000000000",
    "0.000000002": "200000000000",
    "0.000000003": "300000000000",
    "0.000000006": "600000000000",
  };
  return {
    id,
    type: "chatbot",
    verifiability: "TeeML",
    pricing_usd: { prompt, completion },
    ...(withRate ? { pricing: { prompt: wei[prompt], completion: wei[completion] } } : {}),
  };
}

const cheap = [
  chat("0gm-1.0-35b-a3b", "0.000000001", "0.000000002"),
  chat("glm-5.3", "0.000000003", "0.000000006"),
];

const rated = [
  chat("0gm-1.0-35b-a3b", "0.000000001", "0.000000002", true),
  chat("glm-5.3", "0.000000003", "0.000000006", true),
];

function balance(currency: string, credit: string, deposit = "0"): Balance {
  return {
    address: "0x0000000000000000000000000000000000000001",
    currency,
    credit_balance: credit,
    deposit_balance: deposit,
    pending_charge: "0",
    total_balance: credit,
  };
}

function task(over: Partial<OpenTask> & Pick<OpenTask, "id">): OpenTask {
  return {
    type: "DOC_ANALYSIS",
    priority: 2,
    createdAt: new Date("2026-11-06T00:00:00Z"),
    inputPath: `${over.id}.txt`,
    inputMeta: { bytes: 4000, mime: "text/plain" },
    prompt: null,
    ...over,
  };
}

function router(models: Model[], bal: Balance, extra: Record<string, () => never> = {}) {
  const live = {
    listModels: vi.fn(async (key?: string) => {
      if (key !== undefined) throw new Error("preview must not send a key to the catalog");
      return { data: models, status: 200 };
    }),
    getBalance: vi.fn(async (mk: string) => {
      if (mk !== SECRET) throw new Error("preview called balance with an unexpected key");
      return { data: bal, status: 200 };
    }),
    ...extra,
  };
  return live as typeof live & PreviewRouter;
}

function assertClosed(preview: { budgetMicro: string; spentEstimateMicro: string; remainingMicro: string; assignments: Array<{ costMicro: string }> }): void {
  const budget = BigInt(preview.budgetMicro);
  const spent = BigInt(preview.spentEstimateMicro);
  const remaining = BigInt(preview.remainingMicro);
  const assigned = preview.assignments.reduce((sum, item) => sum + BigInt(item.costMicro), 0n);
  expect(spent).toBe(assigned);
  expect(spent + remaining).toBe(budget);
}

describe("previewTonight", () => {
  it("does not call the Router when the queue is empty", async () => {
    const live = router(cheap, balance("usd", "1000000"));
    const outcome = await previewTonight({ tasks: [], account: iai, mk: SECRET, router: live, marginPct: 10 });
    expect(outcome).toEqual({ ok: false, error: "empty_queue", message: "Nothing is waiting for tonight." });
    expect(live.listModels).not.toHaveBeenCalled();
    expect(live.getBalance).not.toHaveBeenCalled();
  });

  it("plans with live prices, keeps the safety margin, and leaves the remainder for commons", async () => {
    const live = router(cheap, balance("usd", "1000000", "9000000"), {
      decide: () => { throw new Error("preview must not classify"); },
      createApiKey: () => { throw new Error("preview must not create a key"); },
      chat: () => { throw new Error("preview must not run a chat"); },
    });
    const outcome = await previewTonight({
      tasks: [task({ id: "notes" })],
      account: iai,
      mk: SECRET,
      router: live,
      marginPct: 10,
    });
    expect(live.listModels).toHaveBeenCalledOnce();
    expect(live.listModels).toHaveBeenCalledWith();
    expect(live.getBalance).toHaveBeenCalledOnce();
    expect(live.getBalance).toHaveBeenCalledWith(SECRET);
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.preview).toMatchObject({
      qualityFloor: 1,
      complexity: "at_run_time",
      budgetMicro: "900000",
      spentEstimateMicro: "9",
      remainingMicro: "899991",
      assignments: [{ taskId: "notes", type: "DOC_ANALYSIS", model: "glm-5.3", quality: 3, costMicro: "9", transcribeModel: null, imageModel: null }],
      deferred: [],
    });
    assertClosed(outcome.preview);
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
    expect(JSON.stringify(outcome)).not.toContain("sk-");
  });

  it("keeps the quality floor of 1 when the budget cannot buy the upgrade", async () => {
    // 0.0004 0G at the paired catalog rate (10_000 micro-USD per 0G) is 4 micro-USD.
    // The cheap chat is 3; the quality-3 upgrade is 9. A floor of 3 would defer the task.
    const live = router(rated, balance("0g", "400000000000000"));
    const outcome = await previewTonight({
      tasks: [task({ id: "notes" })],
      account: iai,
      mk: SECRET,
      router: live,
      marginPct: 0,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.preview.budgetMicro).toBe("4");
    expect(outcome.preview.assignments).toEqual([
      expect.objectContaining({ taskId: "notes", model: "0gm-1.0-35b-a3b", quality: 2, costMicro: "3" }),
    ]);
    expect(outcome.preview.remainingMicro).toBe("1");
    expect(outcome.preview.complexity).toBe("at_run_time");
    assertClosed(outcome.preview);
  });

  it("assigns the higher priority when only one task fits", async () => {
    const live = router(rated, balance("0g", "500000000000000"));
    const outcome = await previewTonight({
      tasks: [
        task({ id: "later-high", priority: 3, createdAt: new Date("2026-11-06T00:05:00Z") }),
        task({ id: "earlier-low", priority: 1, createdAt: new Date("2026-11-06T00:00:00Z") }),
      ],
      account: iai,
      mk: SECRET,
      router: live,
      marginPct: 0,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.preview.assignments.map((item) => item.taskId)).toEqual(["later-high"]);
    expect(outcome.preview.deferred).toEqual([{ taskId: "earlier-low", type: "DOC_ANALYSIS", reason: "over_budget" }]);
    assertClosed(outcome.preview);
  });

  it("caps budget mode with the nightly limit", async () => {
    const live = router(cheap, balance("usd", "5000000", "5000000"));
    const outcome = await previewTonight({
      tasks: [task({ id: "notes" })],
      account: { mode: "BUDGET", nightlyBudgetUsdMicro: 20_000n },
      mk: SECRET,
      router: live,
      marginPct: 10,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.preview.budgetMicro).toBe("20000");
    expect(outcome.preview.assignments[0]).toMatchObject({ model: "glm-5.3", costMicro: "9" });
    expect(outcome.preview.remainingMicro).toBe("19991");
  });

  it("reports no_rate when a 0G catalog has no paired price", async () => {
    const live = router(cheap, balance("0g", "1000000000000000000"));
    const outcome = await previewTonight({ tasks: [task({ id: "notes" })], account: iai, mk: SECRET, router: live, marginPct: 0 });
    expect(outcome.ok).toBe(false);
    if (outcome.ok) return;
    expect(outcome.error).toBe("no_rate");
    expect(outcome.message).toMatch(/without inventing a rate/);
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
  });

  it("passes through a balance that cannot fund a key", async () => {
    const low = router(cheap, balance("usd", "100"));
    const below = await previewTonight({ tasks: [task({ id: "notes" })], account: iai, mk: SECRET, router: low, marginPct: 10 });
    expect(below).toMatchObject({ ok: false, error: "below_minimum" });

    const uncapped = router(cheap, balance("usd", "1000000"));
    const missing = await previewTonight({
      tasks: [task({ id: "notes" })],
      account: { mode: "BUDGET", nightlyBudgetUsdMicro: null },
      mk: SECRET,
      router: uncapped,
      marginPct: 0,
    });
    expect(missing).toMatchObject({ ok: false, error: "missing_cap" });
  });

  it("defers every task when the private catalog is empty and still returns the budget", async () => {
    const standard: Model[] = [{ id: "open-chat", type: "chatbot", pricing_usd: { prompt: "0.000000001", completion: "0.000000002" } }];
    const live = router(standard, balance("usd", "1000000"));
    const outcome = await previewTonight({ tasks: [task({ id: "notes" })], account: iai, mk: SECRET, router: live, marginPct: 10 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.preview.assignments).toEqual([]);
    expect(outcome.preview.deferred).toEqual([{ taskId: "notes", type: "DOC_ANALYSIS", reason: "no_model" }]);
    expect(outcome.preview.spentEstimateMicro).toBe("0");
    expect(outcome.preview.remainingMicro).toBe(outcome.preview.budgetMicro);
  });

  it("defers a task the minimum budget cannot buy", async () => {
    const expensive = [chat("0gm-1.0-35b-a3b", "0.00001", "0.00002")];
    const live = router(expensive, balance("usd", "10000"));
    const outcome = await previewTonight({ tasks: [task({ id: "notes" })], account: iai, mk: SECRET, router: live, marginPct: 0 });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.preview.budgetMicro).toBe("10000");
    expect(outcome.preview.assignments).toEqual([]);
    expect(outcome.preview.deferred).toEqual([{ taskId: "notes", type: "DOC_ANALYSIS", reason: "over_budget" }]);
    expect(outcome.preview.spentEstimateMicro).toBe("0");
    expect(outcome.preview.remainingMicro).toBe("10000");
  });

  it("prices audio and image with their specialist models and skips a task it cannot size", async () => {
    const models: Model[] = [
      ...cheap,
      { id: "whisper-large-v3", type: "speech-to-text", verifiability: "TeeML", pricing_usd: { prompt: "0.000001" } },
      { id: "z-image-turbo", type: "text-to-image", verifiability: "TeeML", pricing_usd: { image: "0.000001" } },
    ];
    const live = router(models, balance("usd", "1000000"));
    const outcome = await previewTonight({
      tasks: [
        task({ id: "voice", type: "AUDIO_SUMMARY", inputMeta: { bytes: 160_000, mime: "audio/mpeg" } }),
        task({ id: "poster", type: "IMAGE_FROM_PROMPT", inputPath: null, prompt: "a red balloon" }),
        task({ id: "blank", type: "IMAGE_FROM_PROMPT", inputPath: null, prompt: "   " }),
        task({ id: "odd", type: "VIDEO", inputPath: null }),
      ],
      account: iai,
      mk: SECRET,
      router: live,
      marginPct: 10,
    });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    const voice = outcome.preview.assignments.find((item) => item.taskId === "voice");
    const poster = outcome.preview.assignments.find((item) => item.taskId === "poster");
    expect(voice).toMatchObject({ model: "glm-5.3", transcribeModel: "whisper-large-v3", imageModel: null });
    expect(poster).toMatchObject({ model: "glm-5.3", transcribeModel: null, imageModel: "z-image-turbo" });
    expect(outcome.preview.deferred).toEqual([
      { taskId: "blank", type: "IMAGE_FROM_PROMPT", reason: "not_runnable" },
      { taskId: "odd", type: "VIDEO", reason: "not_runnable" },
    ]);
    expect(voice?.costMicro).toMatch(/^\d+$/);
    expect(poster?.costMicro).toMatch(/^\d+$/);
    assertClosed(outcome.preview);
    expect(JSON.stringify(outcome)).not.toContain(SECRET);
  });
});
