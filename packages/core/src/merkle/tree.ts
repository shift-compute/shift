import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { LEAF_TYPES, MerkleLeafError, type MerkleLeafValues } from "./leaf";

/** One leaf of a built tree: the packed values, their double-hash, and the proof of that hash. */
export interface MerkleTreeLeaf {
  /** Index in the list passed to `buildMerkleTree`. Sorting happens inside the tree, not in this list. */
  index: number;
  values: MerkleLeafValues;
  hash: string;
  proof: string[];
}

/** Root and proofs for a batch of leaves. Nothing here is written to the database or the chain. */
export interface MerkleBatch {
  root: string;
  leaves: MerkleTreeLeaf[];
}

/** Double-hash of one leaf: keccak256(bytes.concat(keccak256(abi.encode(LEAF_TYPES...)))). */
export function hashLeaf(values: MerkleLeafValues): string {
  const leaf = copyLeaf(values);
  return StandardMerkleTree.of([leaf], [...LEAF_TYPES]).leafHash(leaf);
}

/**
 * Builds a StandardMerkleTree (sorted leaf pairs, the encoding the contract's MerkleProof expects).
 * An empty batch and two identical leaves are refused: there is nothing to anchor, and a repeated
 * leaf would not say which request it belongs to.
 */
export function buildMerkleTree(leaves: readonly MerkleLeafValues[]): MerkleBatch {
  if (leaves.length === 0) throw new MerkleLeafError("A Merkle tree needs at least one leaf.");
  const values = leaves.map(copyLeaf);
  const tree = StandardMerkleTree.of(values, [...LEAF_TYPES]);
  const built: MerkleTreeLeaf[] = [];
  const seen = new Set<string>();
  for (const [index, value] of tree.entries()) {
    const hash = tree.leafHash(value);
    if (seen.has(hash)) throw new MerkleLeafError("Merkle leaves must be unique.");
    seen.add(hash);
    built.push({ index, values: value, hash, proof: tree.getProof(index) });
  }
  return { root: tree.root, leaves: built };
}

/** True when `proof` connects `values` to `root`. A malformed proof is not a member. */
export function verifyLeaf(root: string, values: MerkleLeafValues, proof: readonly string[]): boolean {
  try {
    return StandardMerkleTree.verify(root, [...LEAF_TYPES], copyLeaf(values), [...proof]);
  } catch {
    return false;
  }
}

function copyLeaf(values: MerkleLeafValues): MerkleLeafValues {
  const [requestIdHash, owner, taskIdHash, outputRoot, modelHash, trustTier, costUsdMicro, isCommons] = values;
  if (
    requestIdHash === undefined ||
    owner === undefined ||
    taskIdHash === undefined ||
    outputRoot === undefined ||
    modelHash === undefined ||
    trustTier === undefined ||
    costUsdMicro === undefined ||
    isCommons === undefined
  ) {
    throw new MerkleLeafError("A leaf must have 8 fields.");
  }
  return [requestIdHash, owner, taskIdHash, outputRoot, modelHash, trustTier, costUsdMicro, isCommons];
}
