import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDb, getConfig } = vi.hoisted(() => ({
  getDb: vi.fn(),
  getConfig: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/server", () => ({ getDb, getConfig }));

import { verifyResponseSchema } from "../../../../lib/verify-response";
import { VERIFY_LEAF_SELECT, VERIFY_TASK_SELECT } from "../../../../lib/verify-view";
import { GET } from "./route";

const MK = "mk-supersecretkey";
const SK = "sk-inferencekeyvalue";

const values = [
  "0x" + "11".repeat(32),
  "0x1111111111111111111111111111111111111111",
  "0x" + "22".repeat(32),
  "0x" + "33".repeat(32),
  "0x" + "44".repeat(32),
  "2",
  "1234",
  "false",
];

function call(requestId: string) {
  return GET(new Request(`http://test.local/api/verify/${requestId}`) as never, { params: Promise.resolve({ requestId }) });
}

describe("GET /api/verify/[requestId]", () => {
  const leafFind = vi.fn();
  const taskFind = vi.fn();

  beforeEach(() => {
    getDb.mockReset();
    getConfig.mockReset();
    leafFind.mockReset();
    taskFind.mockReset();
    getConfig.mockReturnValue({
      ZG_CHAIN_ID: 16602,
      ZG_CHAIN_RPC_URL: "https://evmrpc-testnet.0g.ai",
      LEDGER_CONTRACT_ADDRESS: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7",
      ZG_EXPLORER_URL: "https://chainscan-galileo.0g.ai/",
      ZG_STORAGE_INDEXER_URL: "https://indexer-storage-testnet-turbo.0g.ai",
    });
    getDb.mockReturnValue({
      merkleLeaf: { findUnique: leafFind },
      task: { findMany: taskFind },
    });
  });

  it("returns 404 for a blank, a path or a key, without touching the database", async () => {
    for (const requestId of ["", "a/b", MK, `note-${SK}`]) {
      const res = await call(requestId);
      expect(res.status).toBe(404);
      expect(await res.json()).toEqual({ error: "invalid_request" });
      expect(res.headers.get("cache-control")).toBe("no-store");
    }
    expect(getDb).not.toHaveBeenCalled();
  });

  it("returns not_found when no leaf is stored for that request id", async () => {
    leafFind.mockResolvedValue(null);
    const res = await call("req-missing");
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: "not_found" });
    expect(leafFind).toHaveBeenCalledWith({ where: { requestId: "req-missing" }, select: VERIFY_LEAF_SELECT });
    expect(taskFind).not.toHaveBeenCalled();
    expect(getConfig).not.toHaveBeenCalled();
  });

  it("returns the public leaf and does not leak a key or the raw trace", async () => {
    leafFind.mockResolvedValue({
      requestId: "req-1",
      nightId: 20261106n,
      values,
      leafHash: "0x" + "ab".repeat(32),
      proof: ["0x" + "cd".repeat(32)],
      night: {
        manifestRoot: "0x" + "ef".repeat(32),
        merkleRoot: "0x" + "12".repeat(32),
        anchorTx: null,
        donationsTx: MK,
      },
      user: { mkCiphertext: MK },
    });
    taskFind.mockResolvedValue([
      {
        id: "t1",
        prompt: MK,
        outputRoot: values[3],
        steps: [
          {
            step: "analyze",
            model: "glm-5.3",
            requestId: "req-1",
            trace: { provider: "0x743c", provider_identity: "anonymous1", tee_verified: true, billing: { total_cost: SK } },
          },
          { step: "classify", model: "laya", requestId: "req-2" },
        ],
      },
    ]);

    const res = await call("req-1");
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(taskFind).toHaveBeenCalledWith({ where: { nightId: 20261106n }, select: VERIFY_TASK_SELECT });
    expect(verifyResponseSchema.safeParse(body).success).toBe(true);
    expect(body).toMatchObject({
      requestId: "req-1",
      nightId: "20261106",
      manifestRoot: "0x" + "ef".repeat(32),
      anchorTx: null,
      outputRoot: values[3],
      outputUrl: `https://indexer-storage-testnet-turbo.0g.ai/file?root=${values[3]}`,
      model: "glm-5.3",
      trace: { provider: "0x743c", provider_identity: "anonymous1", tee_verified: true, tier: "private" },
      chainId: 16602,
      contractAddress: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7",
    });
    expect(body.proof).toEqual(["0x" + "cd".repeat(32)]);
    expect(body.values).toEqual(values);
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(MK);
    expect(encoded).not.toContain(SK);
    expect(encoded).not.toMatch(/\b(?:mk|sk)-/);
    expect(encoded).not.toContain("billing");
    expect(encoded).not.toContain("mkCiphertext");
    expect(encoded).not.toContain("donationsTx");
    expect(encoded).not.toContain("prompt");
  });

  it("hides a stored leaf that is not publishable and does not echo the thrown row", async () => {
    leafFind.mockResolvedValue({
      requestId: "req-1",
      nightId: 20261106n,
      values: [MK],
      leafHash: "0x" + "ab".repeat(32),
      proof: [],
      night: { manifestRoot: null, merkleRoot: null, anchorTx: null },
    });
    taskFind.mockResolvedValue([]);
    const res = await call("req-1");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain(MK);
  });

  it("hides a database failure and does not echo the thrown message", async () => {
    leafFind.mockRejectedValue(new Error(`connect ${MK}`));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    const res = await call("req-1");
    const body = await res.json();
    expect(res.status).toBe(500);
    expect(body).toEqual({ error: "internal_error" });
    expect(JSON.stringify(body)).not.toContain(MK);
  });
});
