import { describe, expect, it } from "vitest";
import type { CatalogEntry } from "../catalog/catalog";
import { optionsFor, planNight, type PlanTask } from "./optimizer";

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
    expect(optionsFor({ id: "x", type: "AUDIO_SUMMARY", priority: 2, createdAt: new Date(), size: { bytes: 160_000, mime: "audio/mpeg" } }, noStt, "private")).toEqual([]);
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
  });
});
