import { describe, expect, it } from "vitest";
import { parseRequestId, verifyBody, type VerifyChainPublic, type VerifyLeafRow, type VerifyTaskRow } from "./verify-view";

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

const chain: VerifyChainPublic = {
  chainId: 16602,
  rpcUrl: "https://evmrpc-testnet.0g.ai",
  contractAddress: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7",
  explorerUrl: "https://chainscan-galileo.0g.ai/",
  storageIndexerUrl: "https://indexer-storage-testnet-turbo.0g.ai/",
};

function leaf(over: Partial<VerifyLeafRow> = {}): VerifyLeafRow {
  return {
    requestId: "req-1",
    nightId: 20261106n,
    values,
    leafHash: "0x" + "AB".repeat(32),
    proof: ["0x" + "CD".repeat(32)],
    night: {
      manifestRoot: "0x" + "ef".repeat(32),
      merkleRoot: "0x" + "12".repeat(32),
      anchorTx: "0x" + "34".repeat(32),
    },
    ...over,
  };
}

function tasks(): VerifyTaskRow[] {
  return [
    {
      steps: [
        {
          step: "analyze",
          model: "glm-5.3",
          requestId: "req-1",
          trust: "private",
          costUsdMicro: "1234",
          apiKey: MK,
          trace: {
            provider: "0x743c",
            provider_identity: "anonymous1",
            tee_verified: true,
            billing: { total_cost_usd_micro: "1234", currency: "usd" },
            request_rewritten: ["drop_system"],
            note: MK,
          },
        },
        { step: "classify", model: SK, requestId: "req-other", trace: { tee_verified: false, provider_identity: SK } },
      ],
    },
  ];
}

describe("parseRequestId", () => {
  it("accepts a router id and rejects blanks, paths and keys", () => {
    expect(parseRequestId("  req-1 ")).toBe("req-1");
    expect(parseRequestId("3976195e-1879-4a65-bfb7-82e6ddd910ab")).toBe("3976195e-1879-4a65-bfb7-82e6ddd910ab");
    expect(parseRequestId("")).toBeNull();
    expect(parseRequestId("a/b")).toBeNull();
    expect(parseRequestId(MK)).toBeNull();
    expect(parseRequestId(`req-${SK}`)).toBeNull();
  });
});

describe("verifyBody", () => {
  it("returns the leaf, the proof, the night and the safe trace fields", () => {
    const body = verifyBody({ requestId: "req-1", leaf: leaf(), tasks: tasks(), chain });
    expect(body).toMatchObject({
      requestId: "req-1",
      nightId: "20261106",
      manifestRoot: "0x" + "ef".repeat(32),
      merkleRoot: "0x" + "12".repeat(32),
      anchorTx: "0x" + "34".repeat(32),
      outputRoot: values[3],
      outputUrl: `https://indexer-storage-testnet-turbo.0g.ai/file?root=${values[3]}`,
      manifestUrl: `https://indexer-storage-testnet-turbo.0g.ai/file?root=${"0x" + "ef".repeat(32)}`,
      values,
      proof: ["0x" + "cd".repeat(32)],
      leafHash: "0x" + "ab".repeat(32),
      model: "glm-5.3",
      trace: { provider: "0x743c", provider_identity: "anonymous1", tee_verified: true, tier: "private" },
      chainId: 16602,
      rpcUrl: "https://evmrpc-testnet.0g.ai",
      contractAddress: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7",
      explorerUrl: "https://chainscan-galileo.0g.ai",
    });
    expect(Object.keys(body?.trace ?? {}).sort()).toEqual(["provider", "provider_identity", "tee_verified", "tier"]);
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(MK);
    expect(encoded).not.toContain(SK);
    expect(encoded).not.toContain("billing");
    expect(encoded).not.toContain("request_rewritten");
    expect(encoded).not.toContain("apiKey");
  });

  it("treats a missing or non-boolean tee_verified as no verdict", () => {
    const absent = verifyBody({
      requestId: "req-1",
      leaf: leaf(),
      tasks: [{ steps: [{ requestId: "req-1", model: "glm-5.3", trace: { provider: "0xabc" } }] }],
      chain,
    });
    expect(absent?.trace.tee_verified).toBeNull();
    expect(absent?.trace.provider).toBe("0xabc");

    const text = verifyBody({
      requestId: "req-1",
      leaf: leaf({ values: values.map((item, index) => (index === 5 ? "0" : item)) }),
      tasks: [{ steps: [{ requestId: "req-1", model: "laya", trace: { tee_verified: "yes" } }] }],
      chain,
    });
    expect(text?.trace.tee_verified).toBeNull();
    expect(text?.trace.tier).toBe("standard");
    expect(text?.model).toBe("laya");
  });

  it("drops a trace field that contains a key and still returns the leaf", () => {
    const body = verifyBody({
      requestId: "req-1",
      leaf: leaf({ values: values.map((item, index) => (index === 5 ? "1" : item)) }),
      tasks: [{ steps: [{ requestId: "req-1", model: `glm ${MK}`, trace: { provider_identity: SK, tee_verified: false } }] }],
      chain,
    });
    expect(body?.trace).toEqual({ provider: null, provider_identity: null, tee_verified: false, tier: "verified" });
    expect(body?.model).toBeNull();
    expect(JSON.stringify(body)).not.toMatch(/\b(?:mk|sk)-/);
  });

  it("returns null when the stored values are not a leaf, without keeping the secret that rode along", () => {
    const body = verifyBody({
      requestId: "req-1",
      leaf: leaf({ values: [...values, MK] }),
      tasks: tasks(),
      chain,
    });
    expect(body).toBeNull();
  });

  it("leaves the manifest link empty when the night has no manifest root", () => {
    const row = leaf();
    if (!row.night) throw new Error("fixture night");
    const body = verifyBody({ requestId: "req-1", leaf: leaf({ night: { ...row.night, manifestRoot: null } }), tasks: [], chain });
    expect(body?.manifestRoot).toBeNull();
    expect(body?.manifestUrl).toBeNull();
    expect(body?.trace.tee_verified).toBeNull();
    expect(body?.model).toBeNull();
  });
});
