import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser, getDb, getConfig } = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getDb: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/session", () => ({ getCurrentUser }));
vi.mock("../../../../lib/server", () => ({ getDb, getConfig }));

import { NIGHT_PUBLIC_SELECT, NIGHT_RUN_SPEND_SELECT, NIGHT_TASK_SELECT } from "../../../../lib/night-view";
import { GET } from "./route";

const MK = "mk-supersecretkey";
const SK = "sk-inferencekeyvalue";

function call(id: string) {
  return GET(new Request(`http://test.local/api/nights/${id}`) as never, { params: Promise.resolve({ id }) });
}

describe("GET /api/nights/[id]", () => {
  const nightFind = vi.fn();
  const runFind = vi.fn();
  const taskFind = vi.fn();

  beforeEach(() => {
    getCurrentUser.mockReset();
    getDb.mockReset();
    getConfig.mockReset();
    nightFind.mockReset();
    runFind.mockReset();
    taskFind.mockReset();
    getConfig.mockReturnValue({ ZG_EXPLORER_URL: "https://chainscan-galileo.0g.ai/" });
    getDb.mockReturnValue({
      night: { findUnique: nightFind },
      nightRun: { findUnique: runFind },
      task: { findMany: taskFind },
    });
  });

  it("returns 404 for an id that is not a night, without touching the session or the database", async () => {
    for (const id of ["nope", "0", "01", "9223372036854775808"]) {
      const res = await call(id);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "invalid_night" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(getCurrentUser).not.toHaveBeenCalled();
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns an empty night when the id is valid and no row exists", async () => {
    getCurrentUser.mockResolvedValue(null);
    nightFind.mockResolvedValue(null);
    const signedOut = await call("20261106");
    expect(signedOut.status).toBe(200);
    expect(await signedOut.json()).toEqual({ night: null, signedIn: false });

    getCurrentUser.mockResolvedValue({ id: "user-1", currency: "0g", mkCiphertext: Buffer.from(MK) });
    const signedIn = await call("1762394400");
    expect(await signedIn.json()).toEqual({ night: null, signedIn: true });
    expect(runFind).not.toHaveBeenCalled();
    expect(taskFind).not.toHaveBeenCalled();
    expect(nightFind).toHaveBeenCalledWith({ where: { id: 20261106n }, select: NIGHT_PUBLIC_SELECT });
  });

  it("returns public batch fields without a session and does not read anyone's tasks", async () => {
    getCurrentUser.mockResolvedValue(null);
    nightFind.mockResolvedValue({
      id: 20261106n,
      status: "DONE",
      merkleRoot: "0x" + "ab".repeat(32),
      manifestRoot: null,
      anchorTx: null,
      itemCount: 0,
      startedAt: null,
      finishedAt: null,
      donationsTx: MK,
    });
    const res = await call("20261106");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      signedIn: false,
      night: { id: "20261106", merkleRoot: "0x" + "ab".repeat(32), manifestRoot: null, anchorTx: null, explorerUrl: "https://chainscan-galileo.0g.ai" },
    });
    expect(body).not.toHaveProperty("results");
    expect(JSON.stringify(body)).not.toContain(MK);
    expect(runFind).not.toHaveBeenCalled();
    expect(taskFind).not.toHaveBeenCalled();
  });

  it("returns this user's steps and spending, and never a key or the raw trace", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", currency: "0g", mkCiphertext: Buffer.from(MK), mkIv: Buffer.from("iv"), mkAuthTag: Buffer.from("tag") });
    nightFind.mockResolvedValue({
      id: 20261106n,
      status: "DONE",
      merkleRoot: "0x" + "ab".repeat(32),
      manifestRoot: "0x" + "cd".repeat(32),
      anchorTx: "0x" + "ef".repeat(32),
      itemCount: 1,
      startedAt: new Date("2026-11-06T23:00:00.000Z"),
      finishedAt: new Date("2026-11-06T23:40:00.000Z"),
    });
    runFind.mockResolvedValue({
      spentUsdMicro: 40n,
      creditUsed: "1000000000000000000",
      depositUsed: "1",
      ephemeralKeyId: `key-${SK}`,
      balanceBefore: { authorization: SK },
    });
    taskFind.mockResolvedValue([
      {
        id: "t1",
        type: "DOC_ANALYSIS",
        status: "DONE",
        prompt: `notes ${MK}`,
        chosenModel: "glm-5.3",
        outputRoot: "0x" + "11".repeat(32),
        actualCostUsdMicro: 40n,
        error: null,
        inputPath: `uploads/${SK}`,
        steps: [
          {
            step: "analyze",
            model: "glm-5.3",
            trust: "private",
            requestId: "req-1",
            costUsdMicro: "40",
            trace: { tee_verified: true, provider_identity: SK },
          },
          { step: "classify", model: "laya", trust: "private", requestId: "req-2" },
        ],
      },
    ]);

    const res = await call("20261106");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(runFind).toHaveBeenCalledWith({
      where: { nightId_userId: { nightId: 20261106n, userId: "user-1" } },
      select: NIGHT_RUN_SPEND_SELECT,
    });
    expect(taskFind).toHaveBeenCalledWith({
      where: { userId: "user-1", nightId: 20261106n },
      orderBy: { createdAt: "asc" },
      select: NIGHT_TASK_SELECT,
    });
    expect(body.results.tasks[0]).toMatchObject({
      id: "t1",
      outputRoot: "0x" + "11".repeat(32),
      prompt: "notes [redacted]",
      steps: [
        { requestId: "req-1", model: "glm-5.3", trust: "private", teeVerified: true, costUsdMicro: "40" },
        { requestId: "req-2", model: "laya", trust: "private", teeVerified: null },
      ],
    });
    expect(body.results.spending).toEqual({
      currency: "0g",
      creditUsed: "1000000000000000000",
      depositUsed: "1",
      spentUsdMicro: "40",
    });
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(MK);
    expect(encoded).not.toContain(SK);
    expect(encoded).not.toMatch(/\b(?:mk|sk)-/);
    expect(encoded).not.toContain("ephemeralKeyId");
    expect(encoded).not.toContain("inputPath");
    expect(encoded).not.toContain("provider_identity");
    expect(encoded).not.toContain("mkCiphertext");
  });

  it("hides a database failure and does not echo the thrown message", async () => {
    getCurrentUser.mockResolvedValue({ id: "user-1", currency: "usd" });
    nightFind.mockRejectedValue(new Error(`connect ${MK}`));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await call("20261106");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain(MK);
  });
});
