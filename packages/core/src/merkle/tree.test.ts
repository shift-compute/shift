import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { hashLeaf as exportedHashLeaf, verifyLeaf as exportedVerifyLeaf } from "@shift/core";
import { encodeLeaf, keccakUtf8, leafFromStep, MerkleLeafError } from "./leaf";
import { buildMerkleTree, hashLeaf, verifyLeaf } from "./tree";

interface SpikeLeaf {
  values: string[];
  hash: string;
  proof: string[];
}

interface SpikeVector {
  root: string;
  leaf0: SpikeLeaf;
  leaf1: SpikeLeaf;
}

/** Fixed vector shared with contracts/test/ShiftLedger.t.sol (scripts/merkle-vector.ts). */
const vector = JSON.parse(
  readFileSync(new URL("../../../../docs/spike/merkle-vector.json", import.meta.url), "utf8"),
) as SpikeVector;

const spikeLeaves = [
  encodeLeaf({
    requestId: "req-test-1",
    owner: "0x1111111111111111111111111111111111111111",
    taskId: "task-1",
    outputRoot: `0x${"ab".repeat(32)}`,
    modelId: "0gm-1.0-35b-a3b",
    trust: "private",
    costUsdMicro: 1234n,
    isCommons: false,
  }),
  encodeLeaf({
    requestId: "req-test-2",
    owner: "0x2222222222222222222222222222222222222222",
    taskId: "commons-1",
    outputRoot: `0x${"cd".repeat(32)}`,
    modelId: "glm-5.3",
    trust: "private",
    costUsdMicro: 5678n,
    isCommons: true,
  }),
] as const;

const strings = (values: readonly unknown[]) => values.map(String);

describe("merkle parity with the spike vector", () => {
  it("exports the hash and verify helpers from @shift/core", () => {
    expect(exportedHashLeaf).toBe(hashLeaf);
    expect(exportedVerifyLeaf).toBe(verifyLeaf);
  });

  it("matches the fixed root, leaf hashes, proofs and packed values", () => {
    expect(spikeLeaves[0][0]).toBe(keccakUtf8("req-test-1"));
    expect(strings(spikeLeaves[0])).toEqual(vector.leaf0.values);
    expect(strings(spikeLeaves[1])).toEqual(vector.leaf1.values);
    expect(hashLeaf(spikeLeaves[0])).toBe(vector.leaf0.hash);
    expect(hashLeaf(spikeLeaves[1])).toBe(vector.leaf1.hash);

    const batch = buildMerkleTree(spikeLeaves);
    expect(batch.root).toBe(vector.root);
    expect(batch.leaves.map((leaf) => leaf.hash)).toEqual([vector.leaf0.hash, vector.leaf1.hash]);
    expect(batch.leaves[0]?.proof).toEqual(vector.leaf0.proof);
    expect(batch.leaves[1]?.proof).toEqual(vector.leaf1.proof);
    expect(verifyLeaf(batch.root, spikeLeaves[0], vector.leaf0.proof)).toBe(true);
    expect(verifyLeaf(batch.root, spikeLeaves[1], vector.leaf1.proof)).toBe(true);
    expect(verifyLeaf(batch.root, spikeLeaves[0], vector.leaf1.proof)).toBe(false);
  });

  it("builds the same first leaf from a completed step", () => {
    const fromStep = leafFromStep(
      { step: "chat", model: "0gm-1.0-35b-a3b", requestId: "req-test-1", costUsdMicro: "1234" },
      {
        owner: "0x1111111111111111111111111111111111111111",
        taskId: "task-1",
        outputRoot: `0x${"ab".repeat(32)}`,
        trust: "private",
      },
    );
    expect(hashLeaf(fromStep)).toBe(vector.leaf0.hash);
  });
});

describe("buildMerkleTree", () => {
  it("uses the leaf hash as the root when the batch has one leaf", () => {
    const batch = buildMerkleTree([spikeLeaves[0]]);
    expect(batch.root).toBe(vector.leaf0.hash);
    expect(batch.leaves[0]?.proof).toEqual([]);
    expect(verifyLeaf(batch.root, spikeLeaves[0], [])).toBe(true);
    expect(verifyLeaf(batch.root, spikeLeaves[1], [])).toBe(false);
  });

  it("proves every leaf of a three-leaf tree", () => {
    const third = encodeLeaf({
      requestId: "req-test-3",
      owner: "0x3333333333333333333333333333333333333333",
      taskId: "task-3",
      outputRoot: `0x${"ef".repeat(32)}`,
      modelId: "laya",
      trust: "standard",
      costUsdMicro: 0n,
      isCommons: false,
    });
    const batch = buildMerkleTree([spikeLeaves[0], spikeLeaves[1], third]);
    expect(batch.root).not.toBe(vector.root);
    for (const leaf of batch.leaves) {
      expect(verifyLeaf(batch.root, leaf.values, leaf.proof)).toBe(true);
      expect(verifyLeaf(batch.root, leaf.values, [])).toBe(false);
    }
    const shifted = encodeLeaf({
      requestId: "req-test-3",
      owner: "0x3333333333333333333333333333333333333333",
      taskId: "task-3",
      outputRoot: `0x${"ef".repeat(32)}`,
      modelId: "laya",
      trust: "standard",
      costUsdMicro: 1n,
      isCommons: false,
    });
    expect(verifyLeaf(batch.root, shifted, batch.leaves[2]?.proof ?? [])).toBe(false);
  });

  it("treats a truncated proof as not a member", () => {
    expect(verifyLeaf(vector.root, spikeLeaves[0], ["0x01"])).toBe(false);
    expect(verifyLeaf("not-a-root", spikeLeaves[0], vector.leaf0.proof)).toBe(false);
  });

  it("refuses an empty batch and a duplicated leaf", () => {
    expect(() => buildMerkleTree([])).toThrow(MerkleLeafError);
    expect(() => buildMerkleTree([spikeLeaves[0], spikeLeaves[0]])).toThrow(MerkleLeafError);
  });
});
