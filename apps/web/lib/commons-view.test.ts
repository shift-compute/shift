import { describe, expect, it } from "vitest";
import { getAddress } from "viem";
import { commonsResponseSchema } from "./commons-response";
import { commonsBody, type CommonsDonationRow, type CommonsItemRow } from "./commons-view";

const MK = "mk-supersecretkey";
const SK = "sk-inferencekeyvalue";
const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";
const ROOT = "0x" + "ab".repeat(32);

function item(over: Partial<CommonsItemRow> = {}): CommonsItemRow {
  return {
    id: "item-1",
    status: "ACCEPTED",
    sourceText: "Gas pays for computation on Ethereum.",
    translationA: "गैस एथेरियम पर गणना का भुगतान करती है।",
    targetLang: "hi",
    modelA: "0gm-1.0-35b-a3b",
    modelB: "glm-5.3",
    gateModel: "laya",
    gateProbability: 0.91,
    outputRoot: ROOT,
    ...over,
  };
}

function donation(address: string, amount: bigint): CommonsDonationRow {
  return { donatedUsdMicro: amount, user: { accountAddress: address } };
}

describe("commonsBody", () => {
  it("keeps accepted and rejected Hindi and Marathi rows, and drops the rest", () => {
    const body = commonsBody({
      items: [
        item(),
        item({
          id: "item-2",
          status: "REJECTED",
          targetLang: "MR",
          translationA: "मराठी भाषांतर",
          gateProbability: 0.4,
          outputRoot: null,
          modelA: "mask-large",
        }),
        item({ id: "pending", status: "PENDING" }),
        item({ id: "running", status: "RUNNING" }),
        item({ id: "failed", status: "FAILED" }),
        item({ id: "english", targetLang: "en" }),
      ],
      donations: [],
    });
    expect(commonsResponseSchema.safeParse(body).success).toBe(true);
    expect(body.items.map((row) => row.id)).toEqual(["item-1", "item-2"]);
    expect(body.items[0]).toMatchObject({
      status: "ACCEPTED",
      targetLang: "hi",
      sourceExcerpt: "Gas pays for computation on Ethereum.",
      translationA: "गैस एथेरियम पर गणना का भुगतान करती है।",
      modelA: "0gm-1.0-35b-a3b",
      modelB: "glm-5.3",
      gateModel: "laya",
      gateProbability: 0.91,
      outputRoot: ROOT,
    });
    expect(body.items[1]).toMatchObject({
      status: "REJECTED",
      targetLang: "mr",
      modelA: "mask-large",
      gateProbability: 0.4,
      outputRoot: null,
    });
    expect(body.donors).toEqual([]);
    expect(body.totalDonatedUsdMicro).toBe("0");
  });

  it("clips the source and the translation, and collapses whitespace", () => {
    const body = commonsBody({
      items: [item({ sourceText: `  hello   \n\n${"a".repeat(700)}`, translationA: `  ${"b".repeat(1300)}  ` })],
      donations: [],
    });
    expect(body.items[0]?.sourceExcerpt.startsWith("hello ")).toBe(true);
    expect(body.items[0]?.sourceExcerpt).toHaveLength(600);
    expect(body.items[0]?.sourceExcerpt.endsWith("…")).toBe(true);
    expect(body.items[0]?.translationA).toHaveLength(1200);
    expect(body.items[0]?.translationA?.endsWith("…")).toBe(true);
  });

  it("redacts keys in prose and drops a model or a root that contains one", () => {
    const body = commonsBody({
      items: [
        item({
          sourceText: `see ${MK} please`,
          translationA: `notes ${SK}`,
          modelA: SK,
          modelB: "task-1",
          gateModel: `prefix ${MK}`,
          outputRoot: `0x${MK}`,
        }),
      ],
      donations: [donation(ALICE, 5n)],
    });
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(MK);
    expect(encoded).not.toContain(SK);
    expect(encoded).not.toMatch(/\b(?:mk|sk)-/);
    expect(body.items[0]).toMatchObject({
      sourceExcerpt: "see [redacted] please",
      translationA: "notes [redacted]",
      modelA: null,
      modelB: "task-1",
      gateModel: null,
      outputRoot: null,
    });
  });

  it("drops a probability outside 0 to 1 and a blank translation", () => {
    const body = commonsBody({
      items: [
        item({ id: "high", gateProbability: 1.2 }),
        item({ id: "nan", gateProbability: Number.NaN }),
        item({ id: "blank", translationA: "   ", gateProbability: null, outputRoot: "" }),
        item({ id: "edges", gateProbability: 0 }),
        item({ id: MK }),
      ],
      donations: [],
    });
    expect(commonsResponseSchema.safeParse(body).success).toBe(true);
    expect(body.items.map((row) => [row.id, row.gateProbability, row.translationA, row.outputRoot])).toEqual([
      ["high", null, item().translationA, ROOT],
      ["nan", null, item().translationA, ROOT],
      ["blank", null, null, null],
      ["edges", 0, item().translationA, ROOT],
    ]);
  });

  it("sums donations by account and skips a bad address or a non-positive amount", () => {
    const body = commonsBody({
      items: [],
      donations: [
        donation(ALICE, 10n),
        donation(`0x${"1".repeat(40)}`, 7n),
        donation(BOB.toUpperCase().replace(/^0X/, "0x"), 4n),
        donation("not-an-address", 99n),
        donation(`0x${"3".repeat(40)}`, 0n),
        donation(`0x${"4".repeat(40)}`, -3n),
        donation(MK, 8n),
      ],
    });
    expect(commonsResponseSchema.safeParse(body).success).toBe(true);
    expect(body.donors).toEqual([
      { address: getAddress(ALICE), donatedUsdMicro: "17" },
      { address: getAddress(BOB), donatedUsdMicro: "4" },
    ]);
    expect(body.totalDonatedUsdMicro).toBe("21");
    expect(JSON.stringify(body)).not.toContain(MK);
  });
});
