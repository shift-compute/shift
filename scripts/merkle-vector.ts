/**
 * Genera un vector de prueba para verificar que el hash de hoja en TypeScript
 * (StandardMerkleTree de OpenZeppelin) coincide con la verificación en Solidity.
 * El resultado se pega en contracts/test/ShiftLedger.t.sol.
 */
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { keccak256, toUtf8Bytes } from "./lib/hash";

export const LEAF_TYPES = ["bytes32", "address", "bytes32", "bytes32", "bytes32", "uint8", "uint64", "bool"] as const;

const leaves = [
  [keccak256(toUtf8Bytes("req-test-1")), "0x1111111111111111111111111111111111111111", keccak256(toUtf8Bytes("task-1")),
   "0x" + "ab".repeat(32), keccak256(toUtf8Bytes("0gm-1.0-35b-a3b")), 2, 1234n, false],
  [keccak256(toUtf8Bytes("req-test-2")), "0x2222222222222222222222222222222222222222", keccak256(toUtf8Bytes("commons-1")),
   "0x" + "cd".repeat(32), keccak256(toUtf8Bytes("glm-5.3")), 2, 5678n, true],
];

const tree = StandardMerkleTree.of(leaves, [...LEAF_TYPES]);
const out = {
  root: tree.root,
  leaf0: { values: leaves[0]!.map(String), hash: tree.leafHash(leaves[0]!), proof: tree.getProof(0) },
  leaf1: { values: leaves[1]!.map(String), hash: tree.leafHash(leaves[1]!), proof: tree.getProof(1) },
};
console.log(JSON.stringify(out, null, 2));
