import { getAddress } from "ethers";
import type { TrustLevel } from "../catalog/catalog";
import type { MerkleLeafValues } from "../merkle/leaf";

/** One inference request inside `NightManifest.json`, with the proof and the values a person can read. */
export interface NightManifestLeaf {
  requestId: string;
  /** 0G account that owns the result. Lowercase, the same address packed into the leaf. */
  owner: string;
  taskId: string;
  /** Which call this was: analyze, classify, transcribe, and so on. */
  step: string;
  /** Catalog model id, not the hash packed into the leaf. */
  model: string;
  trust: TrustLevel;
  /** Reported cost in micro-USD, as a decimal string. */
  costUsdMicro: string;
  outputRoot: string;
  /** Personal steps are false. Commons rows are not leaves in this build (F4.4). */
  isCommons: boolean;
  /** Packed `LEAF_TYPES` values, in order, as decimal or hex strings. */
  values: string[];
  leafHash: string;
  proof: string[];
}

/**
 * The file uploaded to 0G Storage for one night (plan §13, §14.4).
 * `donationsRecorded` stays false in this file: the manifest is uploaded before `recordDonations`, which is its own transaction.
 */
export interface NightManifest {
  nightId: string;
  root: string;
  itemCount: number;
  generatedAt: string;
  chainId: number;
  contract: string;
  donationsRecorded: false;
  leaves: NightManifestLeaf[];
}

export interface ManifestLeafInput {
  requestId: string;
  owner: string;
  taskId: string;
  step: string;
  model: string;
  trust: TrustLevel;
  costUsdMicro: string;
  outputRoot: string;
  isCommons: boolean;
  values: MerkleLeafValues;
  leafHash: string;
  proof: readonly string[];
}

export class ManifestError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ManifestError";
  }
}

/** Builds the JSON document. `contract` is checksummed so the file names the deployment a person can open. */
export function buildNightManifest(input: {
  nightId: bigint;
  root: string;
  chainId: number;
  contract: string;
  generatedAt: Date;
  leaves: readonly ManifestLeafInput[];
}): NightManifest {
  let contract: string;
  try {
    contract = getAddress(input.contract);
  } catch {
    throw new ManifestError("Ledger address must be a 0x-prefixed 20-byte address.");
  }
  return {
    nightId: input.nightId.toString(),
    root: input.root,
    itemCount: input.leaves.length,
    generatedAt: input.generatedAt.toISOString(),
    chainId: input.chainId,
    contract,
    donationsRecorded: false,
    leaves: input.leaves.map((leaf) => ({
      requestId: leaf.requestId,
      owner: leaf.owner,
      taskId: leaf.taskId,
      step: leaf.step,
      model: leaf.model,
      trust: leaf.trust,
      costUsdMicro: leaf.costUsdMicro,
      outputRoot: leaf.outputRoot,
      isCommons: leaf.isCommons,
      values: leaf.values.map(String),
      leafHash: leaf.leafHash,
      proof: [...leaf.proof],
    })),
  };
}

/** UTF-8 bytes of the manifest, pretty-printed so the storage file can be read without a formatter. */
export function encodeNightManifest(manifest: NightManifest): Uint8Array {
  return new TextEncoder().encode(`${JSON.stringify(manifest, null, 2)}\n`);
}
