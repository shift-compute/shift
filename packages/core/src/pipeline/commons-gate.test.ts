import { describe, expect, it } from "vitest";
import { ATTO_PER_MICRO, type CatalogEntry, type TrustLevel } from "../catalog/catalog";
import { estimateDecisionMicro } from "../catalog/estimator";
import { RouterError } from "../zg/errors";
import type { CommonsGateItem, CommonsStore, CommonsTranslationPatch } from "./commons";
import {
  DEFAULT_COMMONS_GATE_THRESHOLD,
  GATE_INSTRUCTIONS,
  buildGateRequest,
  commonsOutput,
  gateQuestionChars,
  gateState,
  pickGateModel,
  readYesProbability,
  runCommonsQualityGate,
  type CommonsDecide,
} from "./commons-gate";

const USER = "user-1";
const SOURCE = "Ethereum gas pays for a smart contract.";
const ROOT = `0x${"ab".repeat(32)}`;

function decision(id: string, trust: TrustLevel, contextLength?: number, promptAtto = 0n): CatalogEntry {
  return { id, kind: "decision", trust, promptAtto, completionAtto: 0n, imageAtto: 0n, ...(contextLength !== undefined ? { contextLength } : {}) };
}

const laya = decision("laya", "private", 512);

interface Row extends CommonsGateItem {
  status: "RUNNING" | "ACCEPTED" | "REJECTED";
  donorUserId: string;
  outputRoot?: string | null;
}

function item(id: string, over: Partial<Row> = {}): Row {
  return {
    id,
    sourceText: SOURCE,
    translationA: "अनुवाद ए",
    translationB: "अनुवाद बी",
    modelA: "glm-5.3",
    modelB: "0gm-1.0-35b-a3b",
    requestIds: ["req-a", "req-b"],
    costUsdMicro: 70n,
    gateModel: null,
    gateProbability: null,
    status: "RUNNING",
    donorUserId: USER,
    ...over,
  };
}

function memory(rows: Row[]): CommonsStore {
  return {
    pendingItems: async () => [],
    claim: async () => false,
    runningItems: async (userId) =>
      rows.flatMap((row) => {
        if (row.status !== "RUNNING" || row.donorUserId !== userId) return [];
        return [{
          id: row.id,
          sourceText: row.sourceText,
          translationA: row.translationA,
          translationB: row.translationB,
          modelA: row.modelA,
          modelB: row.modelB,
          requestIds: row.requestIds,
          costUsdMicro: row.costUsdMicro,
          gateModel: row.gateModel,
          gateProbability: row.gateProbability,
        }];
      }),
    save: async (id, patch: CommonsTranslationPatch) => {
      const row = rows.find((entry) => entry.id === id);
      if (!row) throw new Error(`missing ${id}`);
      Object.assign(row, patch);
    },
  };
}

function yesBody(model: string, probability: number) {
  return { model, answers: { choice: { type: "choice", choice: "yes", probabilities: { yes: probability, no: 1 - probability } } } };
}

describe("pickGateModel", () => {
  it("uses the smallest fitting context from the catalog and does not invent an id", () => {
    const catalog = [
      decision("vela-2.0-9b", "private", 16_384),
      laya,
      { id: "plain-chat", kind: "chat" as const, trust: "standard" as const, promptAtto: 0n, completionAtto: 0n, imageAtto: 0n },
    ];
    const fit = pickGateModel(catalog, SOURCE, "ए", "बी");
    expect(fit?.model.id).toBe("laya");
    expect(fit?.state).toBe(gateState(SOURCE, "ए", "बी"));

    const long = "word ".repeat(2_000);
    const wide = pickGateModel(catalog, long, long, long);
    expect(wide?.model.id).toBe("vela-2.0-9b");
    expect(wide?.state).toBe(gateState(long, long, long));
  });

  it("truncates to the only published context and returns nothing when the catalog has no decision model", () => {
    expect(pickGateModel([], SOURCE, "a", "b")).toBeUndefined();
    expect(pickGateModel([{ id: "plain-chat", kind: "chat", trust: "standard", promptAtto: 0n, completionAtto: 0n, imageAtto: 0n }], SOURCE, "a", "b")).toBeUndefined();
    const picked = pickGateModel([decision("narrow-dm", "private", 40)], "x".repeat(400), "y".repeat(400), "z".repeat(400));
    expect(picked?.model.id).toBe("narrow-dm");
    expect(picked && picked.state.length).toBeLessThanOrEqual(40 * 4 - gateQuestionChars());
    expect(picked?.state.startsWith("Source:\n")).toBe(true);
  });

  it("prefers a stricter tier over a larger standard model", () => {
    const open = decision("open-dm", "standard", 8_192);
    const attested = decision("attested", "verified", 1_024);
    expect(pickGateModel([open, attested], SOURCE, "a", "b")?.model.id).toBe("attested");
    expect(pickGateModel([open], SOURCE, "a", "b")?.model.id).toBe("open-dm");
  });
});

describe("buildGateRequest", () => {
  it("asks the verified yes/no choice question", () => {
    const request = buildGateRequest("laya", "state");
    expect(request).toEqual({
      model: "laya",
      state: "state",
      questions: {
        choice: { type: "choice", instructions: GATE_INSTRUCTIONS, criteria: ["yes", "no"] },
      },
    });
    expect(Array.isArray(request.questions["choice"]?.criteria)).toBe(true);
    expect(DEFAULT_COMMONS_GATE_THRESHOLD).toBe(0.75);
  });

  it("reads P(yes) and ignores a missing probability", () => {
    expect(readYesProbability({ answers: { choice: { type: "choice", probabilities: { yes: 0.8, no: 0.2 } } } })).toBe(0.8);
    expect(readYesProbability({ answers: {} })).toBeUndefined();
    expect(readYesProbability({ answers: { choice: { type: "choice", probabilities: { no: 1 } } } })).toBeUndefined();
    expect(readYesProbability({ answers: { choice: { type: "choice", probabilities: { yes: Number.NaN } } } })).toBeUndefined();
  });
});

describe("runCommonsQualityGate", () => {
  it("accepts translation A at the threshold and uploads CommonsOutput", async () => {
    const rows = [item("c1")];
    const uploads: Uint8Array[] = [];
    const seen: Array<{ model: string; trust?: string; id?: string; criteria?: unknown }> = [];
    const outcome = await runCommonsQualityGate({
      commons: memory(rows),
      decide: async (sk, body, options) => {
        expect(sk).toBe("sk-test-key-value");
        seen.push({
          model: body.model,
          ...(options?.trustMode ? { trust: options.trustMode } : {}),
          ...(options?.clientRequestId ? { id: options.clientRequestId } : {}),
          criteria: body.questions["choice"]?.criteria,
        });
        return { data: yesBody(body.model, 0.75), status: 200, requestId: "req-gate", trace: { billing: { total_cost_usd_micro: "5" } } };
      },
      upload: async (bytes) => {
        uploads.push(bytes);
        return { rootHash: ROOT };
      },
      sk: "sk-test-key-value",
      catalog: [laya],
      remainingMicro: 1_000_000n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });

    expect(outcome).toMatchObject({ accepted: 1, rejected: 0, held: 0, reportedMicro: 5n, requestIds: ["req-gate"], stop: "done" });
    expect(rows[0]).toMatchObject({
      status: "ACCEPTED",
      gateModel: "laya",
      gateProbability: 0.75,
      requestIds: ["req-a", "req-b", "req-gate"],
      costUsdMicro: 75n,
      outputRoot: ROOT,
      translationA: "अनुवाद ए",
      translationB: "अनुवाद बी",
    });
    expect(JSON.parse(new TextDecoder().decode(uploads[0]!))).toEqual(commonsOutput(rows[0]!, "laya", ["req-a", "req-b", "req-gate"], 0.75));
    expect(seen[0]).toMatchObject({ model: "laya", trust: "private", id: "c1-0-gate", criteria: ["yes", "no"] });
    expect(JSON.stringify(uploads)).not.toContain("sk-test-key-value");
  });

  it("rejects below the threshold, keeps the texts, and does not upload", async () => {
    const rows = [item("c1")];
    let uploads = 0;
    const outcome = await runCommonsQualityGate({
      commons: memory(rows),
      decide: async (_sk, body) => ({ data: yesBody(body.model, 0.749), status: 200, requestId: "req-gate", trace: { billing: { total_cost_usd_micro: "5" } } }),
      upload: async () => {
        uploads += 1;
        throw new Error("rejected items are not uploaded");
      },
      sk: "sk-test",
      catalog: [laya],
      remainingMicro: 1_000_000n,
      userId: USER,
      threshold: 0.9,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(outcome).toMatchObject({ accepted: 0, rejected: 1, reportedMicro: 5n, stop: "done" });
    expect(uploads).toBe(0);
    expect(rows[0]).toMatchObject({ status: "REJECTED", gateProbability: 0.749, translationA: "अनुवाद ए", translationB: "अनुवाद बी", costUsdMicro: 75n });
    expect(rows[0]?.outputRoot).toBeUndefined();
  });

  it("leaves every row RUNNING when the catalog has no decision model", async () => {
    const rows = [item("c1"), item("c2", { donorUserId: "someone-else" })];
    let calls = 0;
    const outcome = await runCommonsQualityGate({
      commons: memory(rows),
      decide: async () => {
        calls += 1;
        throw new Error("decide must not be called");
      },
      upload: async () => {
        throw new Error("upload must not be called");
      },
      sk: "sk-test",
      catalog: [{ id: "plain-chat", kind: "chat", trust: "private", promptAtto: 1n, completionAtto: 1n, imageAtto: 0n }],
      remainingMicro: 1_000_000n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(calls).toBe(0);
    expect(outcome).toMatchObject({ accepted: 0, rejected: 0, held: 1, reportedMicro: 0n, stop: "no_model" });
    expect(rows.every((row) => row.status === "RUNNING")).toBe(true);
    expect(rows[0]?.gateProbability).toBeNull();
  });

  it("stays RUNNING when the answer has no P(yes)", async () => {
    const rows = [item("c1")];
    await runCommonsQualityGate({
      commons: memory(rows),
      decide: async () => ({ data: { model: "laya", answers: { choice: { type: "choice", probabilities: { no: 0.9 } } } }, status: 200, requestId: "req-gate", trace: { billing: { total_cost_usd_micro: "2" } } }),
      upload: async () => {
        throw new Error("upload must not be called");
      },
      sk: "sk-test",
      catalog: [laya],
      remainingMicro: 1_000_000n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(rows[0]).toMatchObject({ status: "RUNNING", gateModel: "laya", requestIds: ["req-a", "req-b", "req-gate"], costUsdMicro: 72n });
    expect(rows[0]?.gateProbability).toBeNull();
    expect(rows[0]?.outputRoot).toBeUndefined();
  });

  it("keeps a passing probability RUNNING when the upload fails, then uploads without a second decision", async () => {
    const rows = [item("c1")];
    let uploads = 0;
    const first = await runCommonsQualityGate({
      commons: memory(rows),
      decide: async (_sk, body) => ({ data: yesBody(body.model, 0.91), status: 200, requestId: "req-gate", trace: { billing: { total_cost_usd_micro: "3" } } }),
      upload: async () => {
        uploads += 1;
        throw new Error("indexer down");
      },
      sk: "sk-test",
      catalog: [laya],
      remainingMicro: 1_000_000n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(first).toMatchObject({ accepted: 0, held: 1, reportedMicro: 3n });
    expect(rows[0]).toMatchObject({ status: "RUNNING", gateProbability: 0.91, gateModel: "laya" });
    expect(rows[0]?.outputRoot).toBeUndefined();

    let decisions = 0;
    const second = await runCommonsQualityGate({
      commons: memory(rows),
      decide: async () => {
        decisions += 1;
        throw new Error("the scored item must not be decided again");
      },
      upload: async () => {
        uploads += 1;
        return { rootHash: ROOT };
      },
      sk: "sk-test",
      catalog: [laya],
      remainingMicro: 0n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(decisions).toBe(0);
    expect(second).toMatchObject({ accepted: 1, reportedMicro: 0n, stop: "done" });
    expect(rows[0]).toMatchObject({ status: "ACCEPTED", outputRoot: ROOT, costUsdMicro: 73n });
    expect(uploads).toBe(2);
  });

  it("does not call the model when the estimate does not fit", async () => {
    const rows = [item("c1")];
    const priced = decision("laya", "private", 512, ATTO_PER_MICRO);
    const picked = pickGateModel([priced], SOURCE, "अनुवाद ए", "अनुवाद बी");
    if (!picked) throw new Error("missing decision model");
    const estimate = estimateDecisionMicro(priced, picked.state.length + gateQuestionChars());
    expect(estimate > 0n).toBe(true);
    let calls = 0;
    const outcome = await runCommonsQualityGate({
      commons: memory(rows),
      decide: async () => {
        calls += 1;
        throw new Error("decide must not be called");
      },
      upload: async () => {
        throw new Error("upload must not be called");
      },
      sk: "sk-test",
      catalog: [priced],
      remainingMicro: estimate - 1n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(calls).toBe(0);
    expect(outcome.stop).toBe("budget");
    expect(rows[0]?.status).toBe("RUNNING");
  });

  it("retries a 500 and then accepts", async () => {
    const rows = [item("c1")];
    const attempts: string[] = [];
    await runCommonsQualityGate({
      commons: memory(rows),
      decide: (async (_sk, body, options) => {
        const id = options?.clientRequestId ?? "";
        attempts.push(id);
        if (attempts.length === 1) throw new RouterError({ status: 500, message: "upstream down" });
        return { data: yesBody(body.model, 0.8), status: 200, requestId: "req-gate", trace: { billing: { total_cost_usd_micro: "1" } } };
      }) as CommonsDecide,
      upload: async () => ({ rootHash: ROOT }),
      sk: "sk-test",
      catalog: [laya],
      remainingMicro: 1_000_000n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(attempts).toEqual(["c1-0-gate", "c1-1-gate"]);
    expect(rows[0]?.status).toBe("ACCEPTED");
  });

  it("stops the queue on an empty balance and does not accept", async () => {
    const rows = [item("c1"), item("c2")];
    let calls = 0;
    const outcome = await runCommonsQualityGate({
      commons: memory(rows),
      decide: async () => {
        calls += 1;
        throw new RouterError({ status: 402, code: "insufficient_balance", message: "insufficient balance sk-secret-value", requestId: "req-fail" });
      },
      upload: async () => {
        throw new Error("upload must not be called");
      },
      sk: "sk-secret-value",
      catalog: [laya],
      remainingMicro: 1_000_000n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
      log: (message) => {
        expect(message).not.toContain("sk-secret-value");
      },
    });
    expect(calls).toBe(1);
    expect(outcome.stop).toBe("balance");
    expect(rows[0]).toMatchObject({ status: "RUNNING", requestIds: ["req-a", "req-b", "req-fail"] });
    expect(rows[1]).toMatchObject({ status: "RUNNING", requestIds: ["req-a", "req-b"] });
    expect(rows.every((row) => row.status !== "ACCEPTED")).toBe(true);
  });

  it("leaves the row RUNNING when the private key cannot run the decision model", async () => {
    const rows = [item("c1")];
    const outcome = await runCommonsQualityGate({
      commons: memory(rows),
      decide: async () => {
        throw new RouterError({ status: 503, code: "no_provider_for_trust_mode", message: "no provider" });
      },
      upload: async () => {
        throw new Error("upload must not be called");
      },
      sk: "sk-test",
      catalog: [decision("open-dm", "standard", 1024)],
      remainingMicro: 1_000_000n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(outcome).toMatchObject({ accepted: 0, held: 1, stop: "done" });
    expect(rows[0]?.status).toBe("RUNNING");
  });

  it("stops at the hard stop before the next item", async () => {
    const rows = [item("c1"), item("c2")];
    let now = new Date("2026-11-06T23:40:00Z");
    let calls = 0;
    const outcome = await runCommonsQualityGate({
      commons: memory(rows),
      decide: async (_sk, body) => {
        calls += 1;
        now = new Date("2026-11-06T23:50:00Z");
        return { data: yesBody(body.model, 0.95), status: 200, requestId: "req-gate", trace: { billing: { total_cost_usd_micro: "1" } } };
      },
      upload: async () => ({ rootHash: ROOT }),
      sk: "sk-test",
      catalog: [laya],
      remainingMicro: 1_000_000n,
      userId: USER,
      threshold: 0.75,
      hardStopUtc: "23:50",
      now: () => now,
      sleep: async () => undefined,
    });
    expect(calls).toBe(1);
    expect(outcome.stop).toBe("hard_stop");
    expect(rows[0]?.status).toBe("ACCEPTED");
    expect(rows[1]?.status).toBe("RUNNING");
  });
});
