/**
 * Generates a test vector to verify that the leaf hash in TypeScript
 * (OpenZeppelin StandardMerkleTree) matches the verification in Solidity.
 * The output is pasted into contracts/test/ShiftLedger.t.sol.
 * Leaves are packed by the core encoder so this vector cannot drift from LEAF_TYPES.
 */
import { StandardMerkleTree } from "@openzeppelin/merkle-tree";
import { encodeLeaf, LEAF_TYPES } from "../packages/core/src/merkle/leaf";

const leaves = [
  encodeLeaf({
    requestId: "req-test-1",
    owner: "0x1111111111111111111111111111111111111111",
    taskId: "task-1",
    outputRoot: "0x" + "ab".repeat(32),
    modelId: "0gm-1.0-35b-a3b",
    trust: "private",
    costUsdMicro: 1234n,
    isCommons: false,
  }),
  encodeLeaf({
    requestId: "req-test-2",
    owner: "0x2222222222222222222222222222222222222222",
    taskId: "commons-1",
    outputRoot: "0x" + "cd".repeat(32),
    modelId: "glm-5.3",
    trust: "private",
    costUsdMicro: 5678n,
    isCommons: true,
  }),
];

const tree = StandardMerkleTree.of(leaves, [...LEAF_TYPES]);
const out = {
  root: tree.root,
  leaf0: { values: leaves[0]!.map(String), hash: tree.leafHash(leaves[0]!), proof: tree.getProof(0) },
  leaf1: { values: leaves[1]!.map(String), hash: tree.leafHash(leaves[1]!), proof: tree.getProof(1) },
};
console.log(JSON.stringify(out, null, 2));
