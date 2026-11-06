import { verifyResponseSchema, type VerifyResponse } from "./verify-response";

/** Columns of one anchored leaf. The vault, the user row and the raw step list stay out of the response. */
export const VERIFY_LEAF_SELECT = {
  requestId: true,
  nightId: true,
  values: true,
  leafHash: true,
  proof: true,
  night: {
    select: {
      manifestRoot: true,
      merkleRoot: true,
      anchorTx: true,
    },
  },
} as const;

/** Steps are scanned for the matching request id. Prompts, paths and the user relation stay on the server. */
export const VERIFY_TASK_SELECT = {
  steps: true,
} as const;

const REQUEST_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

const TIER_NAME = ["standard", "verified", "private"] as const;

export interface VerifyLeafRow {
  requestId: string;
  nightId: bigint;
  values: unknown;
  leafHash: string;
  proof: unknown;
  night: {
    manifestRoot: string | null;
    merkleRoot: string | null;
    anchorTx: string | null;
  } | null;
}

export interface VerifyTaskRow {
  steps: unknown;
}

/** Public chain endpoints the browser needs to call `verifyLeaf` itself. */
export interface VerifyChainPublic {
  chainId: number;
  rpcUrl: string;
  contractAddress: string;
  explorerUrl: string;
  storageIndexerUrl: string;
}

/**
 * A Router request id, as stored on the leaf.
 * A management or inference key is not a request id, and the response never echoes it.
 */
export function parseRequestId(raw: string): string | null {
  const id = raw.trim();
  if (!REQUEST_ID.test(id)) return null;
  if (hasSecret(id)) return null;
  return id;
}

/**
 * JSON for `GET /api/verify/[requestId]`.
 * Returns null when the stored leaf cannot be shown (the route answers 500 and does not echo the row).
 * Strings that contain an `mk-` or `sk-` key are dropped. Unknown trace fields are not copied.
 */
export function verifyBody(input: { requestId: string; leaf: VerifyLeafRow; tasks: readonly VerifyTaskRow[]; chain: VerifyChainPublic }): VerifyResponse | null {
  if (!input.leaf.night) return null;
  const values = parseValues(input.leaf.values);
  const proof = parseProof(input.leaf.proof);
  const leafHash = publicBytes32(input.leaf.leafHash);
  if (!values || !proof || !leafHash) return null;
  if (hasSecret(input.chain.rpcUrl) || hasSecret(input.chain.explorerUrl) || hasSecret(input.chain.storageIndexerUrl)) return null;
  if (!ADDRESS.test(input.chain.contractAddress) || !Number.isSafeInteger(input.chain.chainId) || input.chain.chainId <= 0) return null;

  const tierCode = values[5];
  const tier = TIER_NAME[Number(tierCode)];
  if (!tier) return null;
  const outputRoot = values[3];
  const manifestRoot = publicBytes32(input.leaf.night.manifestRoot);
  const step = findStep(input.tasks, input.requestId);

  const candidate = {
    requestId: input.requestId,
    nightId: input.leaf.nightId.toString(),
    manifestRoot,
    merkleRoot: publicBytes32(input.leaf.night.merkleRoot),
    anchorTx: publicBytes32(input.leaf.night.anchorTx),
    outputRoot,
    outputUrl: storageFileUrl(input.chain.storageIndexerUrl, outputRoot),
    manifestUrl: storageFileUrl(input.chain.storageIndexerUrl, manifestRoot),
    values,
    proof,
    leafHash,
    model: step.model,
    trace: {
      provider: step.provider,
      provider_identity: step.providerIdentity,
      tee_verified: step.teeVerified,
      tier,
    },
    chainId: input.chain.chainId,
    rpcUrl: input.chain.rpcUrl,
    contractAddress: input.chain.contractAddress,
    explorerUrl: input.chain.explorerUrl.replace(/\/+$/, ""),
  };
  const parsed = verifyResponseSchema.safeParse(candidate);
  return parsed.success ? parsed.data : null;
}

type StoredValues = [string, string, string, string, string, "0" | "1" | "2", string, "true" | "false"];

function parseValues(value: unknown): StoredValues | null {
  if (!Array.isArray(value) || value.length !== 8) return null;
  const items = value.map((item) => (typeof item === "string" ? item : null));
  if (items.some((item) => item === null)) return null;
  const [requestIdHash, owner, taskIdHash, outputRoot, modelHash, tier, cost, commons] = items as string[];
  if (!requestIdHash || !owner || !taskIdHash || !outputRoot || !modelHash || !tier || !cost || !commons) return null;
  const hashes = [requestIdHash, taskIdHash, outputRoot, modelHash].map((item) => item.toLowerCase());
  const ownerHex = owner.toLowerCase();
  if (hashes.some((item) => !BYTES32.test(item) || hasSecret(item)) || !ADDRESS.test(ownerHex) || hasSecret(ownerHex)) return null;
  if (tier !== "0" && tier !== "1" && tier !== "2") return null;
  if (!/^(0|[1-9]\d*)$/.test(cost) || hasSecret(cost)) return null;
  if (BigInt(cost) > (1n << 64n) - 1n) return null;
  if (commons !== "true" && commons !== "false") return null;
  const [requestHash, taskHash, outputHash, model] = hashes;
  if (!requestHash || !taskHash || !outputHash || !model) return null;
  return [requestHash, ownerHex, taskHash, outputHash, model, tier, cost, commons];
}

function parseProof(value: unknown): string[] | null {
  if (!Array.isArray(value)) return null;
  const proof: string[] = [];
  for (const item of value) {
    const hash = publicBytes32(typeof item === "string" ? item : null);
    if (!hash) return null;
    proof.push(hash);
  }
  return proof;
}

interface SafeStep {
  model: string | null;
  provider: string | null;
  providerIdentity: string | null;
  teeVerified: boolean | null;
}

function findStep(tasks: readonly VerifyTaskRow[], requestId: string): SafeStep {
  for (const task of tasks) {
    if (!Array.isArray(task.steps)) continue;
    for (const item of task.steps) {
      if (!item || typeof item !== "object") continue;
      const row = item as Record<string, unknown>;
      if (row.requestId !== requestId) continue;
      const trace = row.trace && typeof row.trace === "object" ? (row.trace as Record<string, unknown>) : null;
      return {
        model: publicToken(row.model),
        provider: publicToken(trace?.provider),
        providerIdentity: publicToken(trace?.provider_identity),
        teeVerified: teeOf(trace),
      };
    }
  }
  return { model: null, provider: null, providerIdentity: null, teeVerified: null };
}

/** `true` or `false` only when the trace carried a boolean. Anything else, including a missing trace, is no verdict. */
function teeOf(trace: Record<string, unknown> | null): boolean | null {
  if (!trace || !("tee_verified" in trace)) return null;
  const flag = trace.tee_verified;
  return typeof flag === "boolean" ? flag : null;
}

function storageFileUrl(indexer: string, root: string | null): string | null {
  if (!root || hasSecret(indexer) || hasSecret(root)) return null;
  let base: URL;
  try {
    base = new URL(indexer);
  } catch {
    return null;
  }
  if (base.protocol !== "https:" && base.protocol !== "http:") return null;
  return `${base.toString().replace(/\/+$/, "")}/file?root=${root}`;
}

function publicBytes32(value: string | null): string | null {
  if (value === null || !BYTES32.test(value) || hasSecret(value)) return null;
  return value.toLowerCase();
}

function publicToken(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.trim();
  if (cleaned.length === 0 || cleaned.length > 200 || hasSecret(cleaned)) return null;
  return cleaned;
}

function hasSecret(value: string): boolean {
  // Same boundary as the night page: "task-1" and "mask-large" are not keys.
  return /\b(?:sk|mk)-/.test(value);
}
