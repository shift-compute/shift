import { describe, expect, it } from "vitest";
import { ATTO_PER_MICRO, buildCatalog, type CatalogEntry, type TrustLevel } from "../catalog/catalog";
import { estimateTranslationMicro } from "../catalog/estimator";
import { RouterError } from "../zg/errors";
import {
  pickTranslationModels,
  runCommonsTranslations,
  translationSystemPrompt,
  type CommonsChat,
  type CommonsItemRef,
  type CommonsStore,
  type CommonsTranslationPatch,
} from "./commons";

const NIGHT = 20261106n;
const SOURCE = "Ethereum gas pays for a smart contract.";

function chatEntry(id: string, trust: TrustLevel, promptAtto = ATTO_PER_MICRO, completionAtto = ATTO_PER_MICRO): CatalogEntry {
  return { id, kind: "chat", trust, promptAtto, completionAtto, imageAtto: 0n };
}

interface Row extends CommonsItemRef {
  status: "PENDING" | "RUNNING" | "FAILED";
  translationA?: string | null;
  translationB?: string | null;
  modelA?: string | null;
  modelB?: string | null;
  requestIds: string[];
  costUsdMicro?: bigint | null;
  donorUserId?: string | null;
  nightId?: bigint | null;
  gateModel?: string | null;
}

function memory(rows: Row[], refuse?: (id: string) => boolean) {
  const store: CommonsStore = {
    pendingItems: async () => rows.filter((row) => row.status === "PENDING").map((row) => ({ id: row.id, sourceText: row.sourceText, targetLang: row.targetLang })),
    claim: async (id, donor) => {
      const row = rows.find((item) => item.id === id);
      if (!row || row.status !== "PENDING" || refuse?.(id)) return false;
      row.status = "RUNNING";
      row.donorUserId = donor.userId;
      row.nightId = donor.nightId;
      return true;
    },
    save: async (id, patch: CommonsTranslationPatch) => {
      const row = rows.find((item) => item.id === id);
      if (!row) throw new Error(`missing ${id}`);
      Object.assign(row, patch);
    },
  };
  return store;
}

function item(id: string, over: Partial<Row> = {}): Row {
  return { id, sourceText: SOURCE, targetLang: "hi", status: "PENDING", requestIds: [], ...over };
}

const tee = [
  chatEntry("glm-5.3", "private"),
  chatEntry("0gm-1.0-35b-a3b", "private"),
  chatEntry("plain-chat", "standard"),
  { id: "laya", kind: "decision" as const, trust: "private" as const, promptAtto: 0n, completionAtto: 0n, imageAtto: 0n },
];

function pairCost(source = SOURCE, language = "Hindi"): bigint {
  const promptChars = translationSystemPrompt(language).length;
  return estimateTranslationMicro(tee[0]!, source.length, promptChars) + estimateTranslationMicro(tee[1]!, source.length, promptChars);
}

describe("pickTranslationModels", () => {
  it("picks two distinct private chats, best quality first, and ignores other kinds", () => {
    const pair = pickTranslationModels(tee);
    expect(pair?.modelA.id).toBe("glm-5.3");
    expect(pair?.modelB.id).toBe("0gm-1.0-35b-a3b");
  });

  it("breaks a quality tie by price and then by id", () => {
    const same = [chatEntry("zeta", "private", 5n, 5n), chatEntry("alpha", "private", 5n, 5n), chatEntry("cheap", "private", 1n, 1n)];
    expect(pickTranslationModels(same)?.modelA.id).toBe("cheap");
    expect(pickTranslationModels(same)?.modelB.id).toBe("alpha");
    const tied = [chatEntry("zeta", "private"), chatEntry("alpha", "private")];
    expect(pickTranslationModels(tied)?.modelA.id).toBe("alpha");
    expect(pickTranslationModels(tied)?.modelB.id).toBe("zeta");
  });

  it("returns nothing when TeeML chat is missing or there is only one private chat", () => {
    expect(pickTranslationModels([chatEntry("plain-chat", "standard"), chatEntry("other", "verified")])).toBeUndefined();
    expect(pickTranslationModels([chatEntry("0gm-1.0-35b-a3b", "private"), chatEntry("plain-chat", "standard")])).toBeUndefined();
    expect(pickTranslationModels([])).toBeUndefined();
    expect(pickTranslationModels([chatEntry("0gm-1.0-35b-a3b", "private"), chatEntry("0gm-1.0-35b-a3b", "private")])).toBeUndefined();
  });
});

describe("runCommonsTranslations", () => {
  it("translates one pair and leaves the next PENDING when the budget cannot fund it", async () => {
    const calls: Array<{ model: string; system: string; user: string; trust?: string; id?: string }> = [];
    const rows = [item("c2", { targetLang: "mr" }), item("c1")];
    const chat: CommonsChat = async (_sk, body, options) => {
      calls.push({
        model: body.model,
        system: body.messages[0]?.content ?? "",
        user: body.messages[1]?.content ?? "",
        ...(options?.trustMode ? { trust: options.trustMode } : {}),
        ...(options?.clientRequestId ? { id: options.clientRequestId } : {}),
      });
      const side = body.model === "glm-5.3" ? "a" : "b";
      return {
        data: { choices: [{ message: { content: `  ${side}-text  ` } }] },
        status: 200,
        requestId: `req-${side}`,
        trace: { billing: { total_cost_usd_micro: side === "a" ? "30" : "40" } },
      };
    };
    const outcome = await runCommonsTranslations({
      commons: memory(rows),
      chat,
      sk: "sk-test-key-value",
      catalog: tee,
      remainingMicro: pairCost(),
      userId: "user-1",
      nightId: NIGHT,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });

    expect(outcome).toMatchObject({ translated: 1, failed: 0, reportedMicro: 70n, stop: "budget" });
    expect(outcome.requestIds).toEqual(["req-a", "req-b"]);
    expect(calls.map((call) => call.model)).toEqual(["glm-5.3", "0gm-1.0-35b-a3b"]);
    expect(calls[0]).toMatchObject({
      system: translationSystemPrompt("Hindi"),
      user: SOURCE,
      trust: "private",
      id: "c1-0-translate-a",
    });
    expect(calls[1]?.system).toBe(translationSystemPrompt("Hindi"));
    expect(rows.find((row) => row.id === "c1")).toMatchObject({
      status: "RUNNING",
      translationA: "a-text",
      translationB: "b-text",
      modelA: "glm-5.3",
      modelB: "0gm-1.0-35b-a3b",
      requestIds: ["req-a", "req-b"],
      costUsdMicro: 70n,
      donorUserId: "user-1",
      nightId: NIGHT,
    });
    expect(rows.find((row) => row.id === "c1")?.gateModel).toBeUndefined();
    expect(rows.find((row) => row.id === "c2")?.status).toBe("PENDING");
    expect(JSON.stringify(calls)).not.toContain("sk-test-key-value");
  });

  it("does not call chat when the pair estimate is above the remaining budget", async () => {
    let calls = 0;
    const rows = [item("c1"), item("short", { sourceText: "Hi." })];
    const outcome = await runCommonsTranslations({
      commons: memory(rows),
      chat: async () => {
        calls += 1;
        throw new Error("chat must not be called");
      },
      sk: "sk-test",
      catalog: tee,
      remainingMicro: pairCost() - 1n,
      userId: "user-1",
      nightId: NIGHT,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(outcome.stop).toBe("budget");
    expect(calls).toBe(0);
    expect(rows.every((row) => row.status === "PENDING")).toBe(true);
  });

  it("skips an empty TeeML catalog without inventing model ids", async () => {
    const standard = buildCatalog([
      { id: "plain-chat", type: "chatbot", pricing_usd: { prompt: "0.000001", completion: "0.000001" } },
      { id: "other-chat", type: "chatbot", verifiability: "TeeTLS", pricing_usd: { prompt: "0.000001", completion: "0.000001" } },
    ]);
    let calls = 0;
    const rows = [item("c1")];
    const outcome = await runCommonsTranslations({
      commons: memory(rows),
      chat: async () => {
        calls += 1;
        throw new Error("chat must not be called");
      },
      sk: "sk-test",
      catalog: standard,
      remainingMicro: 1_000_000n,
      userId: "user-1",
      nightId: NIGHT,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(outcome).toMatchObject({ translated: 0, reportedMicro: 0n, stop: "no_model" });
    expect(calls).toBe(0);
    expect(rows[0]?.status).toBe("PENDING");
  });

  it("skips a row another run already claimed and continues", async () => {
    const rows = [item("c1"), item("c2", { targetLang: "mr" })];
    const seen: string[] = [];
    const outcome = await runCommonsTranslations({
      commons: memory(rows, (id) => id === "c1"),
      chat: async (_sk, body) => {
        seen.push(body.model);
        return { data: { choices: [{ message: { content: body.model } }] }, status: 200, requestId: `req-${body.model}`, trace: { billing: { total_cost_usd_micro: "1" } } };
      },
      sk: "sk-test",
      catalog: tee,
      remainingMicro: pairCost() * 3n,
      userId: "user-1",
      nightId: NIGHT,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(outcome.translated).toBe(1);
    expect(rows.find((row) => row.id === "c1")?.status).toBe("PENDING");
    expect(rows.find((row) => row.id === "c2")).toMatchObject({ status: "RUNNING", translationA: "glm-5.3", modelB: "0gm-1.0-35b-a3b" });
    expect(seen).toEqual(["glm-5.3", "0gm-1.0-35b-a3b"]);
  });

  it("retries a 500 and then stores the translation", async () => {
    const attempts: string[] = [];
    const rows = [item("c1")];
    await runCommonsTranslations({
      commons: memory(rows),
      chat: async (_sk, _body, options) => {
        const id = options?.clientRequestId ?? "";
        attempts.push(id);
        if (id.endsWith("translate-a") && attempts.filter((itemId) => itemId.endsWith("translate-a")).length === 1) {
          throw new RouterError({ status: 500, message: "upstream down" });
        }
        return { data: { choices: [{ message: { content: "अनुवाद" } }] }, status: 200, requestId: `req-${id}`, trace: { billing: { total_cost_usd_micro: "2" } } };
      },
      sk: "sk-test",
      catalog: tee,
      remainingMicro: pairCost(),
      userId: "user-1",
      nightId: NIGHT,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(attempts).toEqual(["c1-0-translate-a", "c1-1-translate-a", "c1-0-translate-b"]);
    expect(rows[0]).toMatchObject({ status: "RUNNING", translationA: "अनुवाद", translationB: "अनुवाद" });
  });

  it("keeps a billed half and stops the queue when the balance runs out", async () => {
    const rows = [item("c1"), item("c2")];
    let calls = 0;
    const outcome = await runCommonsTranslations({
      commons: memory(rows),
      chat: async () => {
        calls += 1;
        if (calls === 1) {
          return { data: { choices: [{ message: { content: "एक" } }] }, status: 200, requestId: "req-a", trace: { billing: { total_cost_usd_micro: "9" } } };
        }
        throw new RouterError({ status: 402, code: "insufficient_balance", message: "insufficient balance", requestId: "req-b" });
      },
      sk: "sk-test",
      catalog: tee,
      remainingMicro: pairCost() * 5n,
      userId: "user-1",
      nightId: NIGHT,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(calls).toBe(2);
    expect(outcome).toMatchObject({ translated: 0, failed: 1, reportedMicro: 9n, stop: "balance" });
    expect(rows[0]).toMatchObject({ status: "FAILED", translationA: "एक", requestIds: ["req-a", "req-b"], costUsdMicro: 9n });
    expect(rows[0]?.translationB).toBeUndefined();
    expect(rows[1]?.status).toBe("PENDING");
  });

  it("does not call the second model when the first answer is empty", async () => {
    const rows = [item("c1")];
    let calls = 0;
    await runCommonsTranslations({
      commons: memory(rows),
      chat: async () => {
        calls += 1;
        return { data: { choices: [{ message: { content: "   " } }] }, status: 200, requestId: "req-empty", trace: { billing: { total_cost_usd_micro: "4" } } };
      },
      sk: "sk-test",
      catalog: tee,
      remainingMicro: pairCost(),
      userId: "user-1",
      nightId: NIGHT,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(calls).toBe(1);
    expect(rows[0]).toMatchObject({ status: "FAILED", modelA: "glm-5.3", requestIds: ["req-empty"], costUsdMicro: 4n });
    expect(rows[0]?.translationA).toBeUndefined();
    expect(rows[0]?.modelB).toBeUndefined();
  });

  it("leaves an unknown language pending and still translates the next row", async () => {
    const rows = [item("c1", { targetLang: "en" }), item("c2", { sourceText: "   " }), item("c3", { targetLang: "mr" })];
    const outcome = await runCommonsTranslations({
      commons: memory(rows),
      chat: async (_sk, body) => ({ data: { choices: [{ message: { content: "ok" } }] }, status: 200, requestId: body.model, trace: { billing: { total_cost_usd_micro: "1" } } }),
      sk: "sk-test",
      catalog: tee,
      remainingMicro: pairCost(SOURCE, "Marathi") * 2n,
      userId: "user-1",
      nightId: NIGHT,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(outcome.translated).toBe(1);
    expect(rows[0]?.status).toBe("PENDING");
    expect(rows[1]?.status).toBe("PENDING");
    expect(rows[2]).toMatchObject({ status: "RUNNING", translationA: "ok" });
  });

  it("stops at the hard stop before claiming another item", async () => {
    const rows = [item("c1"), item("c2")];
    let now = new Date("2026-11-06T23:40:00Z");
    const outcome = await runCommonsTranslations({
      commons: memory(rows),
      chat: async () => {
        now = new Date("2026-11-06T23:50:00Z");
        return { data: { choices: [{ message: { content: "ok" } }] }, status: 200, requestId: "req", trace: { billing: { total_cost_usd_micro: "1" } } };
      },
      sk: "sk-test",
      catalog: tee,
      remainingMicro: pairCost() * 5n,
      userId: "user-1",
      nightId: NIGHT,
      hardStopUtc: "23:50",
      now: () => now,
      sleep: async () => undefined,
    });
    expect(outcome.stop).toBe("hard_stop");
    expect(outcome.translated).toBe(1);
    expect(rows[1]?.status).toBe("PENDING");
  });
});
