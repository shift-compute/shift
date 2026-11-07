import { describe, expect, it, vi } from "vitest";
import { chainDetail, chainTitle, checkOnChain, createLedgerReader, settleChainCheck, type ChainNight, type LedgerReader } from "./verify-chain";

const ROOT = `0x${"ab".repeat(32)}` as Hex;
const OTHER = `0x${"cd".repeat(32)}` as Hex;
const ZERO = `0x${"00".repeat(32)}` as Hex;
const LEAF = `0x${"11".repeat(32)}` as Hex;
const PROOF = [`0x${"22".repeat(32)}`];
const TX = `0x${"33".repeat(32)}`;

type Hex = `0x${string}`;

function night(over: Partial<ChainNight> = {}): ChainNight {
  return {
    root: ROOT,
    manifestRoot: OTHER,
    itemCount: 2,
    anchoredAt: 1_700_000_000n,
    donationsRecorded: false,
    ...over,
  };
}

function reader(over: Partial<LedgerReader> = {}): LedgerReader {
  return {
    async readNight() {
      return night();
    },
    async verifyLeaf() {
      return true;
    },
    async anchorBlock() {
      return 42n;
    },
    ...over,
  };
}

const input = {
  nightId: 20261106n,
  leaf: LEAF,
  proof: PROOF,
  storedRoot: ROOT,
  anchorTx: TX,
};

describe("checkOnChain", () => {
  it("confirms a leaf the contract accepts and reports the anchor block", async () => {
    const verdict = await checkOnChain(reader(), input);
    expect(verdict).toEqual({
      status: "confirmed",
      blockNumber: 42n,
      anchoredAt: 1_700_000_000n,
      chainRoot: ROOT,
      contractAccepted: true,
    });
    expect(chainTitle(verdict)).toBe("This result belongs to the batch anchored in block 42.");
    expect(chainDetail(verdict)).toContain("verifyLeaf");
  });

  it("still confirms when the anchor receipt cannot be read", async () => {
    const verdict = await checkOnChain(
      reader({
        async anchorBlock() {
          throw new Error("missing");
        },
      }),
      { ...input, anchorTx: null },
    );
    expect(verdict.status).toBe("confirmed");
    expect(verdict.blockNumber).toBeNull();
    expect(chainTitle(verdict)).toBe("This result belongs to the anchored batch.");
  });

  it("rejects a leaf the contract does not accept", async () => {
    const verdict = await checkOnChain(
      reader({
        async verifyLeaf() {
          return false;
        },
      }),
      input,
    );
    expect(verdict.status).toBe("rejected");
    expect(verdict.contractAccepted).toBe(false);
  });

  it("reports a night that has not been anchored", async () => {
    const verdict = await checkOnChain(reader({ async readNight() { return night({ root: ZERO, anchoredAt: 0n }); } }), input);
    expect(verdict.status).toBe("not_anchored");
    expect(chainTitle(verdict)).toBe("This night has no root on the contract yet.");
  });

  it("reports when the stored root is not the root on the contract", async () => {
    const verdict = await checkOnChain(reader(), { ...input, storedRoot: OTHER });
    expect(verdict.status).toBe("root_mismatch");
    expect(verdict.chainRoot).toBe(ROOT);
    expect(verdict.contractAccepted).toBe(true);
  });

  it("is unavailable when the RPC call fails, and does not call the chain for a bad proof", async () => {
    const failed = await checkOnChain(
      reader({
        async readNight() {
          throw new Error("rpc down");
        },
      }),
      input,
    );
    expect(failed.status).toBe("unavailable");
    expect(failed.contractAccepted).toBeNull();
    expect(chainDetail(failed)).toContain("leaf hash");

    const readNight = vi.fn();
    const skipped = await checkOnChain(
      { readNight, verifyLeaf: vi.fn(), anchorBlock: vi.fn() },
      { ...input, proof: ["0x1234"] },
    );
    expect(skipped.status).toBe("unavailable");
    expect(readNight).not.toHaveBeenCalled();
  });

  it("settles a hung contract read as unavailable and does not confirm the leaf", async () => {
    const verdict = await settleChainCheck(
      reader({
        async readNight() {
          return new Promise(() => undefined);
        },
      }),
      input,
      20,
    );
    expect(verdict).toEqual({ status: "unavailable", blockNumber: null, anchoredAt: null, chainRoot: null, contractAccepted: null });
    expect(chainTitle(verdict)).toBe("The chain check could not be read.");
  });
});

describe("createLedgerReader", () => {
  it("refuses a contract address that is not 20 bytes, without a network call", () => {
    expect(() =>
      createLedgerReader({
        chainId: 16602,
        rpcUrl: "https://evmrpc-testnet.0g.ai",
        contractAddress: "0x1234",
      }),
    ).toThrow();
  });
});
