import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb } = vi.hoisted(() => ({ getDb: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../../../lib/server", () => ({ getDb }));

import { COMMONS_DONATION_SELECT, COMMONS_ITEM_SELECT, COMMONS_LIST_LIMIT } from "../../../lib/commons-view";
import { GET } from "./route";

const MK = "mk-supersecretkey";
const SK = "sk-inferencekeyvalue";
const ALICE = "0x1111111111111111111111111111111111111111";

describe("GET /api/commons", () => {
  const itemFind = vi.fn();
  const itemCount = vi.fn();
  const runFind = vi.fn();

  beforeEach(() => {
    getDb.mockReset();
    itemFind.mockReset();
    itemCount.mockReset();
    runFind.mockReset();
    itemCount.mockResolvedValue(0);
    getDb.mockReturnValue({
      commonsItem: { findMany: itemFind, count: itemCount },
      nightRun: { findMany: runFind },
    });
  });

  it("returns an empty public queue without reading a session", async () => {
    itemFind.mockResolvedValue([]);
    runFind.mockResolvedValue([]);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(res.headers.get("cache-control")).toBe("no-store");
    expect(await res.json()).toEqual({ items: [], donors: [], totalDonatedUsdMicro: "0", failedCount: 0 });
    expect(itemFind).toHaveBeenCalledWith({
      where: { status: { in: ["ACCEPTED", "REJECTED"] } },
      orderBy: { updatedAt: "desc" },
      take: COMMONS_LIST_LIMIT,
      select: COMMONS_ITEM_SELECT,
    });
    expect(runFind).toHaveBeenCalledWith({
      where: { donatedUsdMicro: { gt: 0 } },
      select: COMMONS_DONATION_SELECT,
    });
    expect(JSON.stringify(COMMONS_ITEM_SELECT)).not.toContain("translationB");
    expect(JSON.stringify(COMMONS_ITEM_SELECT)).not.toContain("requestIds");
    expect(JSON.stringify(COMMONS_DONATION_SELECT)).not.toContain("mkCiphertext");
    expect(JSON.stringify(COMMONS_DONATION_SELECT)).not.toContain("ephemeralKeyId");
  });

  it("shapes accepted and rejected rows and sums donations, without a key", async () => {
    itemFind.mockResolvedValue([
      {
        id: "item-1",
        status: "ACCEPTED",
        sourceText: `Gas ${MK}`,
        translationA: "अनुवाद",
        targetLang: "hi",
        modelA: "glm-5.3",
        modelB: SK,
        gateModel: "laya",
        gateProbability: 0.8,
        outputRoot: "0x" + "ab".repeat(32),
        translationB: `hidden ${SK}`,
        requestIds: [SK],
        donorUserId: "user-1",
      },
      {
        id: "item-2",
        status: "REJECTED",
        sourceText: "A validator proposes blocks.",
        translationA: "एक अनुवाद",
        targetLang: "mr",
        modelA: "0gm-1.0-35b-a3b",
        modelB: "glm-5.3",
        gateModel: "laya",
        gateProbability: 0.2,
        outputRoot: null,
      },
    ]);
    runFind.mockResolvedValue([
      { donatedUsdMicro: 10n, user: { accountAddress: ALICE, mkCiphertext: Buffer.from(MK) } },
      { donatedUsdMicro: 5n, user: { accountAddress: ALICE }, ephemeralKeyId: SK },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.items).toHaveLength(2);
    expect(body.items[0]).toMatchObject({ id: "item-1", status: "ACCEPTED", sourceExcerpt: "Gas [redacted]", modelB: null, gateProbability: 0.8 });
    expect(body.items[1]).toMatchObject({ id: "item-2", status: "REJECTED", outputRoot: null, gateProbability: 0.2 });
    expect(body.totalDonatedUsdMicro).toBe("15");
    expect(body.donors).toHaveLength(1);
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(MK);
    expect(encoded).not.toContain(SK);
    expect(encoded).not.toMatch(/\b(?:mk|sk)-/);
    expect(encoded).not.toContain("translationB");
    expect(encoded).not.toContain("requestIds");
    expect(encoded).not.toContain("donorUserId");
    expect(encoded).not.toContain("mkCiphertext");
    expect(encoded).not.toContain("ephemeralKeyId");
  });

  it("hides a database failure and does not echo the thrown message", async () => {
    itemFind.mockRejectedValue(new Error(`connect ${MK}`));
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain(MK);
    expect(JSON.stringify(error.mock.calls)).not.toContain(MK);
    error.mockRestore();
  });
});
