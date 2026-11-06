import { readFileSync } from "node:fs";
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { describe, expect, it } from "vitest";
import { LEAF_TYPES as coreLeafTypes, hashLeaf, verifyLeaf, type MerkleLeafValues } from "@shift/core";
import { LEAF_TYPES, checkStoredProof, hashPackedLeaf, packLeaf, proofConnects } from "./verify-proof";

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

const vector = JSON.parse(readFileSync(new URL("../../../docs/spike/merkle-vector.json", import.meta.url), "utf8")) as SpikeVector;

function asCore(values: readonly string[]): MerkleLeafValues {
  const packed = packLeaf(values);
  if (!packed) throw new Error("spike values must pack");
  const tier = packed[5];
  if (tier !== 0 && tier !== 1 && tier !== 2) throw new Error("spike tier must be 0, 1 or 2");
  return [packed[0], packed[1], packed[2], packed[3], packed[4], tier, packed[6], packed[7]];
}

describe("browser leaf hash", () => {
  it("uses the same LEAF_TYPES as @shift/core", () => {
    expect([...LEAF_TYPES]).toEqual([...coreLeafTypes]);
  });

  it("matches StandardMerkleTree.leafHash and verify on the spike vector", () => {
    for (const leaf of [vector.leaf0, vector.leaf1]) {
      const packed = packLeaf(leaf.values);
      expect(packed).not.toBeNull();
      if (!packed) return;
      const core = asCore(leaf.values);
      const tree = StandardMerkleTree.of([core], [...LEAF_TYPES]);
      expect(tree.leafHash(core)).toBe(hashLeaf(core));
      expect(hashPackedLeaf(packed)).toBe(tree.leafHash(core));
      expect(hashPackedLeaf(packed)).toBe(leaf.hash);
      expect(proofConnects(vector.root, packed, leaf.proof)).toBe(true);
      expect(StandardMerkleTree.verify(vector.root, [...LEAF_TYPES], core, leaf.proof)).toBe(true);
      expect(verifyLeaf(vector.root, core, leaf.proof)).toBe(true);
      expect(checkStoredProof({ values: leaf.values, leafHash: leaf.hash, proof: leaf.proof, merkleRoot: vector.root })).toEqual({
        leafHash: leaf.hash,
        hashMatches: true,
        proofMatches: true,
      });
    }
    const swapped = packLeaf(vector.leaf0.values);
    expect(swapped).not.toBeNull();
    if (!swapped) return;
    expect(proofConnects(vector.root, swapped, vector.leaf1.proof)).toBe(false);
    expect(verifyLeaf(vector.root, asCore(vector.leaf0.values), vector.leaf1.proof)).toBe(false);
  });

  it("rejects a proof that is not bytes32 and a hash that was swapped", () => {
    const packed = packLeaf(vector.leaf0.values);
    expect(packed).not.toBeNull();
    if (!packed) return;
    expect(proofConnects(vector.root, packed, ["0x1234"])).toBe(false);
    expect(proofConnects("not-a-root", packed, vector.leaf0.proof)).toBe(false);
    expect(checkStoredProof({ values: vector.leaf0.values, leafHash: vector.leaf1.hash, proof: vector.leaf0.proof, merkleRoot: vector.root })).toMatchObject({
      hashMatches: false,
      proofMatches: true,
    });
    expect(checkStoredProof({ values: ["nope"], leafHash: vector.leaf0.hash, proof: [], merkleRoot: vector.root }).leafHash).toBeNull();
  });
});
