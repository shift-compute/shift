import { getAddress, keccak256, toUtf8Bytes } from "ethers";
import { z } from "zod";
import type { TrustLevel } from "../catalog/catalog";
import type { StepRecord } from "../executors/types";

/**
 * OpenZeppelin StandardMerkleTree leaf encoding (plan §14.2).
 * The leaf hash is keccak256(bytes.concat(keccak256(abi.encode(values...)))),
 * the same bytes `ShiftLedger.leafHash` computes. Field hashes below are
 * keccak256 of the UTF-8 id; `outputRoot` is the 0G Storage root itself.
 */
export const LEAF_TYPES = [
  "bytes32", // requestIdHash   = keccak256(utf8(X-Request-ID))
  "address", // owner
  "bytes32", // taskIdHash      = keccak256(utf8(taskId or commonsItemId))
  "bytes32", // outputRoot      = 0G Storage root hash
  "bytes32", // modelHash       = keccak256(utf8(modelId))
  "uint8",   // trustTier       = 0 standard, 1 verified, 2 private
  "uint64",  // costUsdMicro
  "bool",    // isCommons
] as const;

/** 0 standard, 1 verified, 2 private. Matches the comment on `LEAF_TYPES`. */
export const TRUST_TIER = {
  standard: 0,
  verified: 1,
  private: 2,
} as const satisfies Record<TrustLevel, 0 | 1 | 2>;

export type TrustTier = (typeof TRUST_TIER)[TrustLevel];

export type MerkleLeafValues = [
  requestIdHash: `0x${string}`,
  owner: `0x${string}`,
  taskIdHash: `0x${string}`,
  outputRoot: `0x${string}`,
  modelHash: `0x${string}`,
  trustTier: TrustTier,
  costUsdMicro: bigint,
  isCommons: boolean,
];

/** Fields of one inference request, before they are packed into `LEAF_TYPES` order. */
export interface LeafInput {
  /** Router request id stored on the step (the UUID, not the raw gateway header). */
  requestId: string;
  /** 0G account that owns the result, or the donor for a commons item. */
  owner: string;
  /** Task id, or the commons item id when `isCommons` is true. */
  taskId: string;
  /** 0G Storage root hash of the output. */
  outputRoot: string;
  /** Model id as listed by the catalog. */
  modelId: string;
  trust: TrustLevel;
  /** Reported cost in micro-USD. It has to fit in a uint64. */
  costUsdMicro: bigint;
  isCommons: boolean;
}

/** Everything a step does not carry itself: whose result it is, where the output lives, and how it was run. */
export interface LeafContext {
  owner: string;
  taskId: string;
  outputRoot: string;
  trust: TrustLevel;
  isCommons?: boolean;
}

export class MerkleLeafError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MerkleLeafError";
  }
}

const UINT64_MAX = (1n << 64n) - 1n;

const bytes32Schema = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const addressSchema = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const nonEmptySchema = z.string().min(1);
const completedStepSchema = z.object({
  model: nonEmptySchema,
  requestId: nonEmptySchema,
  costUsdMicro: z.string().regex(/^\d+$/),
});

/** keccak256 of a UTF-8 string, as a 0x-prefixed bytes32. */
export function keccakUtf8(value: string): `0x${string}` {
  return keccak256(toUtf8Bytes(value)) as `0x${string}`;
}

/** Packs one inference request into the eight values `StandardMerkleTree` abi-encodes. */
export function encodeLeaf(input: LeafInput): MerkleLeafValues {
  const requestId = read(nonEmptySchema, input.requestId, "Request id must not be empty.");
  const taskId = read(nonEmptySchema, input.taskId, "Task id must not be empty.");
  const modelId = read(nonEmptySchema, input.modelId, "Model id must not be empty.");
  return [
    keccakUtf8(requestId),
    asAddress(input.owner),
    keccakUtf8(taskId),
    asBytes32(input.outputRoot, "Output root"),
    keccakUtf8(modelId),
    asTrustTier(input.trust),
    asUint64(input.costUsdMicro),
    asBool(input.isCommons),
  ];
}

/**
 * Builds a leaf from a completed task step. The step must carry the request id, the model and the
 * cost the Router reported. A missing cost is refused: a leaf never invents a zero.
 */
export function leafFromStep(step: StepRecord, context: LeafContext): MerkleLeafValues {
  const parsed = completedStepSchema.safeParse(step);
  if (!parsed.success) {
    throw new MerkleLeafError("A completed step needs a request id, a model id and a reported micro-USD cost.");
  }
  return encodeLeaf({
    requestId: parsed.data.requestId,
    owner: context.owner,
    taskId: context.taskId,
    outputRoot: context.outputRoot,
    modelId: parsed.data.model,
    trust: context.trust,
    costUsdMicro: BigInt(parsed.data.costUsdMicro),
    isCommons: context.isCommons ?? false,
  });
}

function read<T>(schema: z.ZodType<T>, value: unknown, message: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw new MerkleLeafError(message);
  return parsed.data;
}

function asAddress(value: string): `0x${string}` {
  const hex = read(addressSchema, value, "Owner must be a 0x-prefixed 20-byte address.");
  try {
    return getAddress(hex).toLowerCase() as `0x${string}`;
  } catch {
    throw new MerkleLeafError("Owner must be a valid checksummed address.");
  }
}

function asBytes32(value: string, label: string): `0x${string}` {
  const hex = read(bytes32Schema, value, `${label} must be a 0x-prefixed 32-byte hex string.`);
  return hex.toLowerCase() as `0x${string}`;
}

function asTrustTier(trust: TrustLevel): TrustTier {
  if (!(trust in TRUST_TIER)) throw new MerkleLeafError("Trust must be standard, verified or private.");
  return TRUST_TIER[trust];
}

function asBool(value: boolean): boolean {
  if (typeof value !== "boolean") throw new MerkleLeafError("isCommons must be a boolean.");
  return value;
}

function asUint64(value: bigint): bigint {
  if (typeof value !== "bigint" || value < 0n || value > UINT64_MAX) {
    throw new MerkleLeafError("costUsdMicro must fit in uint64.");
  }
  return value;
}
