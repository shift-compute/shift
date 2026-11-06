import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../catalog/catalog";
import { MIN_QUALITY } from "./complexity";
import { optionsFor, planNight, type Plan, type PlanTask } from "./optimizer";

const e = (id: string, kind: CatalogEntry["kind"], over: Partial<CatalogEntry> = {}): CatalogEntry => ({ id, kind, trust: "private", promptAtto: 0n, completionAtto: 0n, imageAtto: 0n, ...over });

// Quality comes from quality.ts: 0gm = 2, glm-5.3 = 3, anything else 2.
// Doc of 4000 chars: tokens in 1150, out 700. 0gm costs 3 micro-USD, glm costs 9 (see per-token prices below), x1.15 included.
const catalog: CatalogEntry[] = [
  e("0gm-1.0-35b-a3b", "chat", { promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n }),
  e("glm-5.3", "chat", { promptAtto: 3_000_000_000n, completionAtto: 6_000_000_000n }),
  e("whisper-large-v3", "transcribe", { promptAtto: 1_000_000_000_000n }),
  e("z-image-turbo", "image", { imageAtto: 8_000_000_000_000n }),
];

const doc = (id: string, priority = 2, minute = 0): PlanTask => ({ id, type: "DOC_ANALYSIS", priority, createdAt: new Date(2026, 10, 6, 0, minute), size: { bytes: 4000, mime: "text/plain" } });

const audio = (id: string): PlanTask => ({ id, type: "AUDIO_SUMMARY", priority: 2, createdAt: new Date(2026, 10, 6), size: { bytes: 160_000, mime: "audio/mpeg" } });

const image = (id: string): PlanTask => ({ id, type: "IMAGE_FROM_PROMPT", priority: 2, createdAt: new Date(2026, 10, 6), size: { bytes: 0, mime: "text/plain", prompt: "a red balloon" } });

function expectClosed(plan: Plan, budget: bigint): void {
  const floor = budget < 0n ? 0n : budget;
  const spent = plan.assignments.reduce((sum, item) => sum + item.option.costMicro, 0n);
  expect(spent).toBe(plan.spentEstimateMicro);
  expect(plan.spentEstimateMicro + plan.remainingMicro).toBe(floor);
  expect(plan.remainingMicro).toBeGreaterThanOrEqual(0n);
}

describe("optionsFor", () => {
  it("offers one option per quality level, cheapest first", () => {
    const opts = optionsFor(doc("a"), catalog, "private");
    expect(opts.map((o) => [o.models.chat.id, o.quality])).toEqual([["0gm-1.0-35b-a3b", 2], ["glm-5.3", 3]]);
    expect(opts[0]!.costMicro).toBeLessThan(opts[1]!.costMicro);
  });

  it("drops models below the minimum quality", () => {
    expect(optionsFor({ ...doc("a"), minQuality: 3 }, catalog, "private").map((o) => o.models.chat.id)).toEqual(["glm-5.3"]);
  });

  it("returns nothing when the task needs a model type that does not exist", () => {
    const noStt = catalog.filter((c) => c.kind !== "transcribe");
    expect(optionsFor(audio("x"), noStt, "private")).toEqual([]);
    expect(optionsFor(image("y"), catalog.filter((c) => c.kind !== "image"), "private")).toEqual([]);
    expect(optionsFor(doc("z"), [], "private")).toEqual([]);
  });

  it("drops a dearer model that does not buy more quality", () => {
    const crowded: CatalogEntry[] = [
      ...catalog,
      e("lite-chat", "chat", { promptAtto: 100_000_000n, completionAtto: 200_000_000n }),
      e("bulk-chat", "chat", { promptAtto: 4_000_000_000n, completionAtto: 8_000_000_000n }),
    ];
    expect(optionsFor(doc("a"), crowded, "private").map((o) => [o.models.chat.id, o.quality])).toEqual([
      ["lite-chat", 2],
      ["glm-5.3", 3],
    ]);
  });

  it("keeps the higher quality when two models cost the same", () => {
    const tied: CatalogEntry[] = [
      e("0gm-1.0-35b-a3b", "chat", { promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n }),
      e("glm-5.3", "chat", { promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n }),
    ];
    const opts = optionsFor(doc("a"), tied, "private");
    expect(opts.map((o) => [o.models.chat.id, o.quality])).toEqual([["glm-5.3", 3]]);
  });

  it("pairs audio with the cheapest transcription model and images with the cheapest image model", () => {
    const extra: CatalogEntry[] = [
      ...catalog,
      e("whisper-tiny", "transcribe", { promptAtto: 1n }),
      e("image-large", "image", { imageAtto: 1n }),
    ];
    expect(optionsFor(audio("a"), extra, "private")[0]!.models.transcribe?.id).toBe("whisper-tiny");
    expect(optionsFor(image("b"), extra, "private")[0]!.models.image?.id).toBe("image-large");
    expect(optionsFor(doc("c"), extra, "private")[0]!.models.chat.id).toBe("0gm-1.0-35b-a3b");
  });

  it("treats trust as a floor: private stays private, and a looser floor still admits private models", () => {
    const mixed: CatalogEntry[] = [
      e("0gm-1.0-35b-a3b", "chat", { promptAtto: 5_000_000_000n, completionAtto: 10_000_000_000n }),
      e("glm-5.3", "chat", { trust: "verified", promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n }),
      e("open-chat", "chat", { trust: "standard", promptAtto: 0n, completionAtto: 0n }),
    ];
    expect(optionsFor(doc("a"), mixed, "private").map((o) => o.models.chat.id)).toEqual(["0gm-1.0-35b-a3b"]);
    expect(optionsFor(doc("a"), mixed, "verified").map((o) => o.models.chat.id)).toEqual(["glm-5.3"]);
    expect(optionsFor(doc("a"), mixed, "standard").map((o) => [o.models.chat.id, o.quality])).toEqual([
      ["open-chat", 2],
      ["glm-5.3", 3],
    ]);
    expect(optionsFor(doc("a"), catalog, "verified").map((o) => o.models.chat.id)).toEqual(["0gm-1.0-35b-a3b", "glm-5.3"]);
    expect(optionsFor(doc("a"), catalog.map((c) => ({ ...c, trust: "standard" as const })), "private")).toEqual([]);
  });

  it("drops a dearer model when a cheaper one is already higher quality", () => {
    const dominated: CatalogEntry[] = [
      e("glm-5.3", "chat", { promptAtto: 100_000_000n, completionAtto: 200_000_000n }),
      e("0gm-1.0-35b-a3b", "chat", { promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n }),
      e("bulk-chat", "chat", { promptAtto: 4_000_000_000n, completionAtto: 8_000_000_000n }),
    ];
    const opts = optionsFor(doc("a"), dominated, "private");
    expect(opts.map((o) => [o.models.chat.id, o.quality])).toEqual([["glm-5.3", 3]]);
    const cost = opts[0]!.costMicro;
    const plan = planNight([doc("a", 2, 0), doc("b", 1, 1)], dominated, "private", cost * 2n + 7n);
    expect(plan.assignments.map((item) => [item.taskId, item.option.models.chat.id, item.option.quality])).toEqual([
      ["a", "glm-5.3", 3],
      ["b", "glm-5.3", 3],
    ]);
    expect(plan.spentEstimateMicro).toBe(cost * 2n);
    expect(plan.remainingMicro).toBe(7n);
  });

  it("returns nothing when specialist models exist but no chat model does", () => {
    const noChat: CatalogEntry[] = [
      e("whisper-large-v3", "transcribe", { promptAtto: 1n }),
      e("z-image-turbo", "image", { imageAtto: 1n }),
      e("glm-5.3", "decision", { promptAtto: 1n }),
    ];
    expect(optionsFor(doc("notes"), noChat, "private")).toEqual([]);
    expect(optionsFor(audio("voice"), noChat, "private")).toEqual([]);
    expect(optionsFor(image("poster"), noChat, "private")).toEqual([]);
  });
});

describe("planNight", () => {
  it("spends spare budget on the upgrade and reports what is left", () => {
    const plan = planNight([doc("a")], catalog, "private", 1000n);
    expect(plan.assignments.map((a) => a.option.models.chat.id)).toEqual(["glm-5.3"]);
    expect(plan.deferred).toEqual([]);
    expect(plan.spentEstimateMicro + plan.remainingMicro).toBe(1000n);
  });

  it("keeps the cheap option when the upgrade does not fit", () => {
    const cheap = optionsFor(doc("a"), catalog, "private")[0]!.costMicro;
    const plan = planNight([doc("a")], catalog, "private", cheap);
    expect(plan.assignments[0]!.option.models.chat.id).toBe("0gm-1.0-35b-a3b");
    expect(plan.remainingMicro).toBe(0n);
  });

  it("serves higher priority first and defers what does not fit", () => {
    const cheap = optionsFor(doc("a"), catalog, "private")[0]!.costMicro;
    const plan = planNight([doc("low", 1, 0), doc("high", 3, 5)], catalog, "private", cheap);
    expect(plan.assignments.map((a) => a.taskId)).toEqual(["high"]);
    expect(plan.deferred).toEqual([{ taskId: "low", reason: "over_budget" }]);
  });

  it("gives a zero budget to nobody", () => {
    const plan = planNight([doc("a")], catalog, "private", 0n);
    expect(plan.assignments).toEqual([]);
    expect(plan.deferred).toEqual([{ taskId: "a", reason: "over_budget" }]);
    expectClosed(plan, 0n);
  });

  it("clamps a negative budget and still defers priced work", () => {
    const plan = planNight([doc("a")], catalog, "private", -5n);
    expect(plan.assignments).toEqual([]);
    expect(plan.deferred).toEqual([{ taskId: "a", reason: "over_budget" }]);
    expectClosed(plan, -5n);
  });

  it("assigns every free task, including at a zero budget, and keeps a paid surplus for commons", () => {
    const free = catalog.map((entry) => ({ ...entry, promptAtto: 0n, completionAtto: 0n, imageAtto: 0n }));
    const broke = planNight([doc("a", 1, 1), doc("b", 3, 2)], free, "private", 0n);
    expect(broke.assignments.map((item) => item.taskId)).toEqual(["b", "a"]);
    expect(broke.assignments.every((item) => item.option.models.chat.id === "glm-5.3" && item.option.costMicro === 0n)).toBe(true);
    expect(broke.deferred).toEqual([]);
    expectClosed(broke, 0n);

    const surplus = planNight([doc("a")], free, "private", 40n);
    expect(surplus.assignments[0]!.option.quality).toBe(3);
    expect(surplus.spentEstimateMicro).toBe(0n);
    expect(surplus.remainingMicro).toBe(40n);
  });

  it("takes a same-price quality step without spending the surplus", () => {
    const tied: CatalogEntry[] = [
      e("0gm-1.0-35b-a3b", "chat", { promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n }),
      e("glm-5.3", "chat", { promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n }),
    ];
    const cost = optionsFor(doc("a"), tied, "private")[0]!.costMicro;
    const plan = planNight([doc("low", 1, 1), doc("high", 3, 0)], tied, "private", cost * 2n + 50n);
    expect(plan.assignments.map((item) => [item.taskId, item.option.models.chat.id])).toEqual([
      ["high", "glm-5.3"],
      ["low", "glm-5.3"],
    ]);
    expect(plan.spentEstimateMicro).toBe(cost * 2n);
    expect(plan.remainingMicro).toBe(50n);
    expectClosed(plan, cost * 2n + 50n);
  });

  it("fills cheaper bases before any paid upgrade", () => {
    const opts = optionsFor(doc("a"), catalog, "private");
    const cheap = opts[0]!.costMicro;
    const rich = opts[1]!.costMicro;
    const plan = planNight([doc("second", 1, 1), doc("first", 3, 4)], catalog, "private", rich);
    expect(plan.assignments.map((item) => [item.taskId, item.option.models.chat.id])).toEqual([
      ["first", "0gm-1.0-35b-a3b"],
      ["second", "0gm-1.0-35b-a3b"],
    ]);
    expect(plan.deferred).toEqual([]);
    expect(plan.remainingMicro).toBe(rich - cheap * 2n);
    expect(plan.remainingMicro).toBeGreaterThan(0n);
    expectClosed(plan, rich);
  });

  it("leaves a surplus that cannot buy an upgrade for the commons queue", () => {
    const opts = optionsFor(doc("a"), catalog, "private");
    const cheap = opts[0]!.costMicro;
    const rich = opts[1]!.costMicro;
    const budget = rich - 1n;
    const plan = planNight([doc("a")], catalog, "private", budget);
    expect(plan.assignments[0]!.option.models.chat.id).toBe("0gm-1.0-35b-a3b");
    expect(plan.remainingMicro).toBe(budget - cheap);
    expect(plan.deferred).toEqual([]);
    expectClosed(plan, budget);
  });

  it("spends the last micro-USD when the upgrade fits exactly", () => {
    const rich = optionsFor(doc("a"), catalog, "private")[1]!.costMicro;
    const plan = planNight([doc("a")], catalog, "private", rich);
    expect(plan.assignments[0]!.option.models.chat.id).toBe("glm-5.3");
    expect(plan.remainingMicro).toBe(0n);
  });

  it("orders equal priority by createdAt and does not let a later task jump the queue", () => {
    const cheap = optionsFor(doc("a"), catalog, "private")[0]!.costMicro;
    const plan = planNight([doc("later", 2, 9), doc("earlier", 2, 1)], catalog, "private", cheap);
    expect(plan.assignments.map((item) => item.taskId)).toEqual(["earlier"]);
    expect(plan.deferred).toEqual([{ taskId: "later", reason: "over_budget" }]);
    expect(plan.remainingMicro).toBe(0n);
  });

  it("assigns bases from high priority to low, in that order", () => {
    const cheap = optionsFor(doc("a"), catalog, "private")[0]!.costMicro;
    const plan = planNight([doc("mid", 2, 3), doc("low", 1, 0), doc("high", 3, 8)], catalog, "private", cheap * 2n);
    expect(plan.assignments.map((item) => item.taskId)).toEqual(["high", "mid"]);
    expect(plan.assignments.every((item) => item.option.models.chat.id === "0gm-1.0-35b-a3b")).toBe(true);
    expect(plan.deferred).toEqual([{ taskId: "low", reason: "over_budget" }]);
    expectClosed(plan, cheap * 2n);
  });

  it("breaks an upgrade tie toward the earlier task", () => {
    const opts = optionsFor(doc("a"), catalog, "private");
    const cheap = opts[0]!.costMicro;
    const delta = opts[1]!.costMicro - cheap;
    const budget = cheap * 2n + delta;
    const plan = planNight([doc("later", 2, 5), doc("earlier", 2, 0)], catalog, "private", budget);
    expect(plan.assignments.map((item) => [item.taskId, item.option.models.chat.id])).toEqual([
      ["earlier", "glm-5.3"],
      ["later", "0gm-1.0-35b-a3b"],
    ]);
    expect(plan.remainingMicro).toBe(0n);
    expectClosed(plan, budget);
  });

  it("upgrades the best (quality × priority) / cost, not the highest priority", () => {
    // Prompt-only prices, so a larger document has a much bigger upgrade delta.
    const priced: CatalogEntry[] = [
      e("0gm-1.0-35b-a3b", "chat", { promptAtto: 1_000_000_000_000n }),
      e("glm-5.3", "chat", { promptAtto: 2_000_000_000_000n }),
    ];
    const low: PlanTask = { ...doc("low", 1, 1), size: { bytes: 0, mime: "text/plain", chars: 0 } };
    const high: PlanTask = { ...doc("high", 3, 0), size: { bytes: 20_000, mime: "text/plain", chars: 20_000 } };
    const quote = (task: PlanTask) => {
      const opts = optionsFor(task, priced, "private");
      const base = opts[0]!.costMicro;
      const delta = opts[1]!.costMicro - base;
      const gain = (opts[1]!.quality - opts[0]!.quality) * task.priority;
      return { base, delta, score: gain / Number(delta) };
    };
    const lowQ = quote(low);
    const highQ = quote(high);
    expect(lowQ.score).toBeGreaterThan(highQ.score);
    expect(highQ.delta).toBeGreaterThan(lowQ.delta);
    // Both upgrades fit on their own. Together they do not, so the ratio decides.
    const budget = lowQ.base + highQ.base + highQ.delta;
    expect(lowQ.delta + highQ.delta).toBeGreaterThan(highQ.delta);
    const plan = planNight([high, low], priced, "private", budget);
    expect(plan.assignments.map((item) => [item.taskId, item.option.models.chat.id])).toEqual([
      ["high", "0gm-1.0-35b-a3b"],
      ["low", "glm-5.3"],
    ]);
    expect(plan.deferred).toEqual([]);
    expect(plan.remainingMicro).toBe(highQ.delta - lowQ.delta);
    expectClosed(plan, budget);
  });

  it("does not spend on a task with no model, and does not use a model below minQuality", () => {
    const noStt = catalog.filter((entry) => entry.kind !== "transcribe");
    const skipped = planNight([audio("voice"), doc("notes")], noStt, "private", 1000n);
    expect(skipped.deferred).toEqual([{ taskId: "voice", reason: "no_model" }]);
    expect(skipped.assignments.map((item) => item.taskId)).toEqual(["notes"]);
    expect(skipped.remainingMicro).toBe(1000n - skipped.spentEstimateMicro);

    const empty = planNight([doc("later", 1, 2), doc("sooner", 3, 0)], [], "private", 80n);
    expect(empty.assignments).toEqual([]);
    expect(empty.deferred).toEqual([
      { taskId: "sooner", reason: "no_model" },
      { taskId: "later", reason: "no_model" },
    ]);
    expect(empty.remainingMicro).toBe(80n);

    const complex: PlanTask = { ...doc("hard"), minQuality: 3 };
    const cheap = optionsFor(doc("easy"), catalog, "private")[0]!.costMicro;
    const held = planNight([complex], catalog, "private", cheap);
    expect(optionsFor(complex, catalog, "private").map((item) => item.models.chat.id)).toEqual(["glm-5.3"]);
    expect(held.assignments).toEqual([]);
    expect(held.deferred).toEqual([{ taskId: "hard", reason: "over_budget" }]);
    expect(held.remainingMicro).toBe(cheap);

    expect(planNight([], catalog, "private", 40n)).toEqual({
      assignments: [],
      deferred: [],
      spentEstimateMicro: 0n,
      remainingMicro: 40n,
    });
  });

  it("defers every task when the catalog has no chat model", () => {
    const noChat: CatalogEntry[] = [
      e("whisper-large-v3", "transcribe", { promptAtto: 1n }),
      e("z-image-turbo", "image", { imageAtto: 1n }),
      e("glm-5.3", "decision", { promptAtto: 1n }),
    ];
    const plan = planNight([doc("later", 1, 2), audio("voice"), image("poster"), doc("sooner", 3, 0)], noChat, "private", 80n);
    expect(plan.assignments).toEqual([]);
    expect(plan.deferred).toEqual([
      { taskId: "sooner", reason: "no_model" },
      { taskId: "voice", reason: "no_model" },
      { taskId: "poster", reason: "no_model" },
      { taskId: "later", reason: "no_model" },
    ]);
    expect(plan.spentEstimateMicro).toBe(0n);
    expect(plan.remainingMicro).toBe(80n);
  });

  it("does not fall back to verified models when private has no TeeML", () => {
    const attested: CatalogEntry[] = [
      e("glm-5.3", "chat", { trust: "verified", promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n }),
      e("open-chat", "chat", { trust: "standard", promptAtto: 0n, completionAtto: 0n }),
      e("whisper-large-v3", "transcribe", { trust: "verified", promptAtto: 1n }),
      e("z-image-turbo", "image", { trust: "verified", imageAtto: 1n }),
    ];
    expect(optionsFor(doc("a"), attested, "private")).toEqual([]);
    expect(optionsFor(audio("a"), attested, "private")).toEqual([]);
    expect(optionsFor(image("a"), attested, "private")).toEqual([]);
    expect(optionsFor(doc("a"), attested, "verified").map((o) => o.models.chat.id)).toEqual(["glm-5.3"]);
    expect(optionsFor(audio("a"), attested, "verified")[0]!.models.transcribe?.id).toBe("whisper-large-v3");
    expect(optionsFor(image("a"), attested, "verified")[0]!.models.image?.id).toBe("z-image-turbo");

    const blocked = planNight([doc("notes", 3, 0), audio("voice"), image("poster")], attested, "private", 500n);
    expect(blocked.assignments).toEqual([]);
    expect(blocked.deferred).toEqual([
      { taskId: "notes", reason: "no_model" },
      { taskId: "voice", reason: "no_model" },
      { taskId: "poster", reason: "no_model" },
    ]);
    expect(blocked.remainingMicro).toBe(500n);

    const privateChat = e("0gm-1.0-35b-a3b", "chat", { promptAtto: 1_000_000_000n, completionAtto: 2_000_000_000n });
    const mixed = [privateChat, ...attested];
    const cost = optionsFor(doc("notes"), mixed, "private")[0]!.costMicro;
    expect(optionsFor(audio("voice"), mixed, "private")).toEqual([]);
    expect(optionsFor(image("poster"), mixed, "private")).toEqual([]);
    const plan = planNight([doc("notes", 1, 0), audio("voice"), image("poster")], mixed, "private", cost + 4n);
    expect(plan.assignments.map((item) => [item.taskId, item.option.models.chat.id])).toEqual([["notes", "0gm-1.0-35b-a3b"]]);
    expect(plan.deferred).toEqual([
      { taskId: "voice", reason: "no_model" },
      { taskId: "poster", reason: "no_model" },
    ]);
    expect(plan.remainingMicro).toBe(4n);
    expectClosed(plan, cost + 4n);
  });

  it("keeps a complexity floor and will not step down to a cheaper model", () => {
    const simple: PlanTask = { ...doc("easy", 1, 1), minQuality: MIN_QUALITY.simple };
    const standard: PlanTask = { ...doc("mid"), minQuality: MIN_QUALITY.standard };
    const complex: PlanTask = { ...doc("hard", 3, 0), minQuality: MIN_QUALITY.complex };
    expect(optionsFor(simple, catalog, "private").map((o) => o.models.chat.id)).toEqual(["0gm-1.0-35b-a3b", "glm-5.3"]);
    expect(optionsFor(standard, catalog, "private").map((o) => o.models.chat.id)).toEqual(["0gm-1.0-35b-a3b", "glm-5.3"]);
    expect(optionsFor(complex, catalog, "private").map((o) => o.models.chat.id)).toEqual(["glm-5.3"]);

    const noPremium = catalog.filter((entry) => entry.id !== "glm-5.3");
    expect(optionsFor(complex, noPremium, "private")).toEqual([]);
    expect(optionsFor({ ...audio("voice"), minQuality: MIN_QUALITY.complex }, noPremium, "private")).toEqual([]);
    expect(optionsFor({ ...image("poster"), minQuality: MIN_QUALITY.complex }, noPremium, "private")).toEqual([]);
    const base = optionsFor(simple, noPremium, "private")[0]!.costMicro;
    const unmet = planNight([complex, simple], noPremium, "private", base + 5n);
    expect(unmet.assignments.map((item) => item.taskId)).toEqual(["easy"]);
    expect(unmet.deferred).toEqual([{ taskId: "hard", reason: "no_model" }]);
    expect(unmet.remainingMicro).toBe(5n);

    const premium = optionsFor(complex, catalog, "private")[0]!.costMicro;
    expect(premium).toBeGreaterThan(base);
    const held = planNight([simple, complex], catalog, "private", base);
    expect(held.assignments.map((item) => [item.taskId, item.option.models.chat.id])).toEqual([["easy", "0gm-1.0-35b-a3b"]]);
    expect(held.deferred).toEqual([{ taskId: "hard", reason: "over_budget" }]);
    expect(held.remainingMicro).toBe(0n);

    expect(optionsFor({ ...audio("voice"), minQuality: MIN_QUALITY.complex }, catalog, "private").map((o) => [o.models.chat.id, o.models.transcribe?.id])).toEqual([
      ["glm-5.3", "whisper-large-v3"],
    ]);
    expect(optionsFor({ ...image("poster"), minQuality: MIN_QUALITY.complex }, catalog, "private").map((o) => [o.models.chat.id, o.models.image?.id])).toEqual([
      ["glm-5.3", "z-image-turbo"],
    ]);
  });

  it("gives a matched upgrade delta to the higher priority, then keeps upgrading while it fits", () => {
    const opts = optionsFor(doc("a"), catalog, "private");
    const cheap = opts[0]!.costMicro;
    const rich = opts[1]!.costMicro;
    const delta = rich - cheap;
    expect(delta).toBeGreaterThan(0n);
    const one = planNight([doc("early-low", 1, 0), doc("late-high", 3, 9)], catalog, "private", cheap * 2n + delta);
    expect(one.assignments.map((item) => [item.taskId, item.option.models.chat.id])).toEqual([
      ["late-high", "glm-5.3"],
      ["early-low", "0gm-1.0-35b-a3b"],
    ]);
    expect(one.remainingMicro).toBe(0n);
    expectClosed(one, cheap * 2n + delta);

    const both = planNight([doc("low", 1, 4), doc("high", 3, 1)], catalog, "private", rich * 2n);
    expect(both.assignments.map((item) => [item.taskId, item.option.models.chat.id])).toEqual([
      ["high", "glm-5.3"],
      ["low", "glm-5.3"],
    ]);
    expect(both.remainingMicro).toBe(0n);
    expectClosed(both, rich * 2n);
  });
});
