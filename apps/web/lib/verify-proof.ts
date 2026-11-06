import { concat, encodeAbiParameters, keccak256, type Hex } from "viem";

/**
 * OpenZeppelin `StandardMerkleTree` leaf encoding (plan §14.2).
 * The browser does not import `@shift/core` (that package is server-only) or
 * `@openzeppelin/merkle-tree` (it pulls ethers v5 into the page). These bytes are
 * `keccak256(bytes.concat(keccak256(abi.encode(LEAF_TYPES))))`, and the proof walks
 * sorted pairs the way `MerkleProof.verify` does. `verify-proof.test.ts` checks them
 * against `StandardMerkleTree.leafHash` and `StandardMerkleTree.verify`.
 */
export const LEAF_TYPES = [
  "bytes32", // requestIdHash
  "address", // owner
  "bytes32", // taskIdHash
  "bytes32", // outputRoot
  "bytes32", // modelHash
  "uint8", // trustTier
  "uint64", // costUsdMicro
  "bool", // isCommons
] as const;

const LEAF_PARAMETERS = [
  { type: "bytes32" },
  { type: "address" },
  { type: "bytes32" },
  { type: "bytes32" },
  { type: "bytes32" },
  { type: "uint8" },
  { type: "uint64" },
  { type: "bool" },
] as const;

const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const UINT64_MAX = (1n << 64n) - 1n;

export type PackedLeaf = readonly [Hex, Hex, Hex, Hex, Hex, number, bigint, boolean];

export interface LocalProofCheck {
  /** Hash recomputed from `values`, or null when the values are not a leaf. */
  leafHash: Hex | null;
  /** The recomputed hash equals the hash stored with the leaf. */
  hashMatches: boolean;
  /** The proof connects the recomputed leaf to the stored Merkle root. */
  proofMatches: boolean;
}

/** Turns the eight strings stored on `MerkleLeaf.values` back into the types the tree abi-encodes. */
export function packLeaf(values: readonly string[]): PackedLeaf | null {
  if (values.length !== 8) return null;
  const [requestIdHash, owner, taskIdHash, outputRoot, modelHash, tier, cost, commons] = values;
  if (
    requestIdHash === undefined ||
    owner === undefined ||
    taskIdHash === undefined ||
    outputRoot === undefined ||
    modelHash === undefined ||
    tier === undefined ||
    cost === undefined ||
    commons === undefined
  ) {
    return null;
  }
  const hashes = [requestIdHash, taskIdHash, outputRoot, modelHash].map((item) => item.toLowerCase());
  const ownerHex = owner.toLowerCase();
  const [requestHash, taskHash, outputHash, model] = hashes;
  if (
    requestHash === undefined ||
    taskHash === undefined ||
    outputHash === undefined ||
    model === undefined ||
    !BYTES32.test(requestHash) ||
    !ADDRESS.test(ownerHex) ||
    !BYTES32.test(taskHash) ||
    !BYTES32.test(outputHash) ||
    !BYTES32.test(model)
  ) {
    return null;
  }
  if (tier !== "0" && tier !== "1" && tier !== "2") return null;
  if (!/^(0|[1-9]\d*)$/.test(cost)) return null;
  const costUsdMicro = BigInt(cost);
  if (costUsdMicro > UINT64_MAX) return null;
  if (commons !== "true" && commons !== "false") return null;
  const trustTier = tier === "0" ? 0 : tier === "1" ? 1 : 2;
  return [requestHash as Hex, ownerHex as Hex, taskHash as Hex, outputHash as Hex, model as Hex, trustTier, costUsdMicro, commons === "true"];
}

/** Double-hash of one leaf. Same bytes as `StandardMerkleTree.leafHash`. */
export function hashPackedLeaf(values: PackedLeaf): Hex {
  const encoded = encodeAbiParameters(LEAF_PARAMETERS, values);
  return keccak256(keccak256(encoded));
}

/** True when `proof` connects `values` to `root`. A malformed proof is not a member. */
export function proofConnects(root: string, values: PackedLeaf, proof: readonly string[]): boolean {
  if (!BYTES32.test(root)) return false;
  try {
    let computed = hashPackedLeaf(values);
    for (const sibling of proof) {
      if (!BYTES32.test(sibling)) return false;
      computed = hashPair(computed, sibling.toLowerCase() as Hex);
    }
    return computed.toLowerCase() === root.toLowerCase();
  } catch {
    return false;
  }
}

/**
 * Local half of the verifier: recompute the leaf and check it against the root Shift stored.
 * The contract check is separate (`verify-chain.ts`) and uses `leafHash` from here.
 */
export function checkStoredProof(input: {
  values: readonly string[];
  leafHash: string;
  proof: readonly string[];
  merkleRoot: string | null;
}): LocalProofCheck {
  const packed = packLeaf(input.values);
  if (!packed) return { leafHash: null, hashMatches: false, proofMatches: false };
  try {
    const leafHash = hashPackedLeaf(packed);
    return {
      leafHash,
      hashMatches: leafHash.toLowerCase() === input.leafHash.toLowerCase(),
      proofMatches: input.merkleRoot !== null && proofConnects(input.merkleRoot, packed, input.proof),
    };
  } catch {
    return { leafHash: null, hashMatches: false, proofMatches: false };
  }
}

function hashPair(a: Hex, b: Hex): Hex {
  const left = a.toLowerCase() as Hex;
  const right = b.toLowerCase() as Hex;
  const [first, second] = BigInt(left) <= BigInt(right) ? [left, right] : [right, left];
  return keccak256(concat([first, second]));
}
