import { describe, expect, it } from "vitest";
import { commonsStatusLabel, formatProbability, languageLabel, modelsLabel, readCommons } from "./commons-response";

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const item = {
  id: "item-1",
  status: "ACCEPTED",
  sourceExcerpt: "Gas pays for computation.",
  translationA: "अनुवाद",
  targetLang: "hi",
  modelA: "0gm-1.0-35b-a3b",
  modelB: "glm-5.3",
  gateModel: "laya",
  gateProbability: 0.91,
  outputRoot: "0x" + "ab".repeat(32),
};

const donor = { address: "0x1111111111111111111111111111111111111111", donatedUsdMicro: "12" };

describe("readCommons", () => {
  it("maps a missing response, a failure, an empty queue and a recorded queue", async () => {
    await expect(readCommons(null)).resolves.toEqual({ phase: "unavailable" });
    await expect(readCommons(jsonRes(500, { error: "internal_error" }))).resolves.toEqual({ phase: "unavailable" });
    await expect(readCommons(jsonRes(200, { items: [], donors: [], totalDonatedUsdMicro: "0", failedCount: 0 }))).resolves.toEqual({ phase: "empty" });
    await expect(readCommons(jsonRes(200, { items: [item], donors: [donor], totalDonatedUsdMicro: "12", failedCount: 0 }))).resolves.toMatchObject({
      phase: "ready",
    });
  });

  it("keeps a queue that only failed, instead of calling it empty", async () => {
    const panel = await readCommons(jsonRes(200, { items: [], donors: [], totalDonatedUsdMicro: "0", failedCount: 200 }));
    expect(panel).toMatchObject({ phase: "ready", data: { failedCount: 200, items: [] } });
  });

  it("refuses a body whose donor amounts do not add up, and a probability above 1", async () => {
    const mismatch = await readCommons(jsonRes(200, { items: [], donors: [donor], totalDonatedUsdMicro: "1", failedCount: 0 }));
    expect(mismatch.phase).toBe("unavailable");
    const high = await readCommons(jsonRes(200, { items: [{ ...item, gateProbability: 1.2 }], donors: [], totalDonatedUsdMicro: "0", failedCount: 0 }));
    expect(high.phase).toBe("unavailable");
  });

  it("treats a queue with only donations as ready", async () => {
    const panel = await readCommons(jsonRes(200, { items: [], donors: [donor], totalDonatedUsdMicro: "12", failedCount: 0 }));
    expect(panel.phase).toBe("ready");
  });
});

describe("commons labels", () => {
  it("names the languages, the filter outcome and the models", () => {
    expect(languageLabel("hi")).toBe("Hindi");
    expect(languageLabel("mr")).toBe("Marathi");
    expect(commonsStatusLabel("ACCEPTED")).toBe("Accepted");
    expect(commonsStatusLabel("REJECTED")).toBe("Rejected");
    expect(modelsLabel(item)).toBe("0gm-1.0-35b-a3b and glm-5.3. Filter: laya.");
    expect(modelsLabel({ modelA: null, modelB: null, gateModel: null })).toBe("Translation models not recorded. Filter model not recorded.");
  });

  it("formats the filter probability as a percent", () => {
    expect(formatProbability(0)).toBe("0%");
    expect(formatProbability(1)).toBe("100%");
    expect(formatProbability(0.75)).toBe("75%");
    expect(formatProbability(0.812)).toBe("81.2%");
  });
});
