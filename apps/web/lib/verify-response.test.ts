import { describe, expect, it } from "vitest";
import { readVerify, safeHttpUrl, verifyResponseSchema } from "./verify-response";

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const values = [
  "0x" + "11".repeat(32),
  "0x1111111111111111111111111111111111111111",
  "0x" + "22".repeat(32),
  "0x" + "33".repeat(32),
  "0x" + "44".repeat(32),
  "2",
  "1234",
  "false",
] as const;

const body = {
  requestId: "req-1",
  nightId: "20261106",
  manifestRoot: "0x" + "ab".repeat(32),
  merkleRoot: "0x" + "cd".repeat(32),
  anchorTx: "0x" + "ef".repeat(32),
  outputRoot: values[3],
  outputUrl: "https://indexer-storage-testnet-turbo.0g.ai/file?root=" + values[3],
  manifestUrl: "https://indexer-storage-testnet-turbo.0g.ai/file?root=" + "0x" + "ab".repeat(32),
  values,
  proof: ["0x" + "01".repeat(32)],
  leafHash: "0x" + "02".repeat(32),
  model: "glm-5.3",
  trace: { provider: "0x743c", provider_identity: "anonymous1", tee_verified: null, tier: "private" },
  chainId: 16602,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  contractAddress: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7",
  explorerUrl: "https://chainscan-galileo.0g.ai",
};

describe("readVerify", () => {
  it("maps an empty lookup, a bad id, an unknown id and a recorded leaf", async () => {
    await expect(readVerify(null)).resolves.toEqual({ phase: "unavailable" });
    await expect(readVerify(jsonRes(404, { error: "invalid_request" }))).resolves.toEqual({ phase: "invalid" });
    await expect(readVerify(jsonRes(404, { error: "not_found" }))).resolves.toEqual({ phase: "not_found" });
    await expect(readVerify(jsonRes(500, { error: "internal_error" }))).resolves.toEqual({ phase: "unavailable" });
    await expect(readVerify(jsonRes(200, { requestId: "req-1" }))).resolves.toEqual({ phase: "unavailable" });
    await expect(readVerify(jsonRes(200, body))).resolves.toEqual({ phase: "ready", body });
  });

  it("rejects a body whose output root is not the root packed into the leaf", () => {
    expect(verifyResponseSchema.safeParse({ ...body, outputRoot: "0x" + "99".repeat(32) }).success).toBe(false);
    expect(verifyResponseSchema.safeParse({ ...body, trace: { ...body.trace, tier: "standard" } }).success).toBe(false);
  });
});

describe("safeHttpUrl", () => {
  it("keeps http(s) links and drops anything else", () => {
    expect(safeHttpUrl("https://indexer-storage-testnet-turbo.0g.ai/file?root=0xab")).toBe("https://indexer-storage-testnet-turbo.0g.ai/file?root=0xab");
    expect(safeHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeHttpUrl(null)).toBeNull();
  });
});
