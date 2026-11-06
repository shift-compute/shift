import type { TrustLevel } from "../catalog/catalog";
import type { PrismaClient } from "../db/client";
import { leafFromStep, MerkleLeafError, type MerkleLeafValues } from "../merkle/leaf";
import { buildMerkleTree } from "../merkle/tree";
import type { LedgerClient } from "../zg/ledger";
import type { StorageClient } from "../zg/storage";
import { buildNightManifest, encodeNightManifest } from "./manifest";
import { z } from "zod";

const bytes32 = /^0x[0-9a-fA-F]{64}$/;
const trustSchema = z.enum(["standard", "verified", "private"]);

const storedStepSchema = z.object({
  step: z.string().optional(),
  model: z.string().optional(),
  requestId: z.string().optional(),
  costUsdMicro: z.string().optional(),
  trust: trustSchema.optional(),
});

type StoredStep = z.infer<typeof storedStepSchema>;

/** A DONE task the anchor reads. `steps` is the JSON stored on the row; it is validated here, not trusted. */
export interface CompletedTask {
  id: string;
  /** 0G account address of the user who owns the result. */
  owner: string;
  outputRoot: string | null;
  steps: unknown;
}

export interface PersistedLeaf {
  requestId: string;
  /** Packed values as strings, so they fit in a JSON column. */
  values: string[];
  leafHash: string;
  proof: string[];
}

/**
 * Persistence for one night's tree. Production uses Prisma. Tests use an in-memory store.
 * The caller still marks the night DONE or FAILED; these writes only fill the root, the manifest and the tx.
 */
export interface AnchorStore {
  /**
   * DONE tasks for this night, in a stable order.
   * Commons rows are not included. A commons leaf needs a per-request cost and a storage root, and a rejected row has neither (F4.4).
   */
  completedTasks(nightId: bigint): Promise<CompletedTask[]>;
  /** Replaces this night's leaves and stores the Merkle root and count. */
  saveTree(nightId: bigint, root: string, itemCount: number, leaves: PersistedLeaf[]): Promise<void>;
  saveManifestRoot(nightId: bigint, manifestRoot: string): Promise<void>;
  saveAnchorTx(nightId: bigint, anchorTx: string): Promise<void>;
}

export interface AnchorDeps {
  nightId: bigint;
  store: AnchorStore;
  storage: StorageClient;
  ledger: LedgerClient;
  chainId: number;
  contractAddress: string;
  now?: () => Date;
  log?: (message: string) => void;
}

export type AnchorResult =
  | { anchored: false; reason: "empty" }
  | { anchored: true; root: string; manifestRoot: string; anchorTx: string; itemCount: number };

export class AnchorError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnchorError";
  }
}

interface BatchLeaf {
  requestId: string;
  owner: string;
  taskId: string;
  step: string;
  model: string;
  trust: TrustLevel;
  costUsdMicro: string;
  outputRoot: string;
  isCommons: false;
  values: MerkleLeafValues;
}

/**
 * Anchors one night on 0G Chain (plan §14.4).
 * An empty batch returns without uploading and without a transaction.
 * Donations are a later call (`recordNightDonations`), and only when a positive amount exists.
 */
export async function anchorNight(deps: AnchorDeps): Promise<AnchorResult> {
  const log = deps.log ?? (() => undefined);
  const tasks = await deps.store.completedTasks(deps.nightId);
  const sources = collectBatchLeaves(tasks);
  if (sources.length === 0) {
    log(`night ${deps.nightId}: empty batch, not anchored`);
    return { anchored: false, reason: "empty" };
  }
  if (sources.length > 0xffffffff) throw new AnchorError("A night cannot anchor more than uint32 leaves.");

  const tree = buildMerkleTree(sources.map((source) => source.values));
  const packed = tree.leaves.map((leaf) => {
    const source = sources[leaf.index];
    if (!source) throw new AnchorError("Merkle tree returned a leaf index that is not in the batch.");
    return {
      source,
      values: leaf.values.map(String),
      leafHash: asBytes32(leaf.hash, "Leaf hash"),
      proof: leaf.proof.map((item) => asBytes32(item, "Proof node")),
    };
  });

  const root = asBytes32(tree.root, "Merkle root");
  await deps.store.saveTree(
    deps.nightId,
    root,
    packed.length,
    packed.map((leaf) => ({
      requestId: leaf.source.requestId,
      values: leaf.values,
      leafHash: leaf.leafHash,
      proof: leaf.proof,
    })),
  );

  const manifest = buildNightManifest({
    nightId: deps.nightId,
    root,
    chainId: deps.chainId,
    contract: deps.contractAddress,
    generatedAt: (deps.now ?? (() => new Date()))(),
    leaves: packed.map((leaf) => ({ ...leaf.source, values: leaf.source.values, leafHash: leaf.leafHash, proof: leaf.proof })),
  });
  const uploaded = await deps.storage.upload(encodeNightManifest(manifest));
  const manifestRoot = asBytes32(uploaded.rootHash, "Manifest root");
  await deps.store.saveManifestRoot(deps.nightId, manifestRoot);

  const receipt = await deps.ledger.anchorNight({
    nightId: deps.nightId,
    root,
    manifestRoot,
    itemCount: packed.length,
  });
  await deps.store.saveAnchorTx(deps.nightId, receipt.txHash);
  log(`night ${deps.nightId}: anchored ${packed.length} leaf(s) in ${receipt.txHash}`);
  return { anchored: true, root, manifestRoot, anchorTx: receipt.txHash, itemCount: packed.length };
}

/**
 * One leaf per completed step that has a Router request id.
 * Several steps of one task share that task's output root.
 * Commons rows are not leaves. Each row stores one total and a list of request ids, and a rejected row has no output root.
 * A request id without a reported cost, a trust tier, or an output root fails the night: a leaf never invents them.
 */
function collectBatchLeaves(tasks: readonly CompletedTask[]): BatchLeaf[] {
  const leaves: BatchLeaf[] = [];
  const seen = new Set<string>();
  for (const task of tasks) {
    const ready = readSteps(task).filter((step) => step.requestId !== undefined && step.requestId.length > 0);
    if (ready.length === 0) continue;
    if (!task.outputRoot) throw new AnchorError(`Task ${task.id} has a request id but no 0G Storage output root.`);
    for (const step of ready) {
      const requestId = step.requestId ?? "";
      if (!step.model || !step.costUsdMicro || !step.trust) {
        throw new AnchorError(`Task ${task.id} request ${requestId} is missing a model, a reported cost, or a trust tier.`);
      }
      if (seen.has(requestId)) throw new AnchorError(`Request id ${requestId} appears twice in this night.`);
      seen.add(requestId);
      let values: MerkleLeafValues;
      try {
        values = leafFromStep(
          { step: step.step ?? "call", model: step.model, requestId, costUsdMicro: step.costUsdMicro, trust: step.trust },
          { owner: task.owner, taskId: task.id, outputRoot: task.outputRoot, trust: step.trust, isCommons: false },
        );
      } catch (err) {
        if (err instanceof MerkleLeafError) throw new AnchorError(`Task ${task.id} request ${requestId}: ${err.message}`);
        throw err;
      }
      const owner = values[1];
      leaves.push({
        requestId,
        owner,
        taskId: task.id,
        step: step.step && step.step.length > 0 ? step.step : "call",
        model: step.model,
        trust: step.trust,
        costUsdMicro: step.costUsdMicro,
        outputRoot: values[3],
        isCommons: false,
        values,
      });
    }
  }
  return leaves;
}

/** Prisma backing. The night row already exists: the lock or the manual run created it. */
export function prismaAnchorStore(db: PrismaClient): AnchorStore {
  return {
    async completedTasks(nightId) {
      const tasks = await db.task.findMany({
        where: { nightId, status: "DONE" },
        orderBy: { id: "asc" },
        select: { id: true, outputRoot: true, steps: true, user: { select: { accountAddress: true } } },
      });
      return tasks.map((task) => ({
        id: task.id,
        owner: task.user.accountAddress,
        outputRoot: task.outputRoot,
        steps: task.steps,
      }));
    },

    async saveTree(nightId, root, itemCount, leaves) {
      await db.$transaction([
        db.merkleLeaf.deleteMany({ where: { nightId } }),
        db.night.update({ where: { id: nightId }, data: { merkleRoot: root, itemCount } }),
        db.merkleLeaf.createMany({
          data: leaves.map((leaf) => ({
            nightId,
            requestId: leaf.requestId,
            values: leaf.values,
            leafHash: leaf.leafHash,
            proof: leaf.proof,
          })),
        }),
      ]);
    },

    async saveManifestRoot(nightId, manifestRoot) {
      await db.night.update({ where: { id: nightId }, data: { manifestRoot } });
    },

    async saveAnchorTx(nightId, anchorTx) {
      await db.night.update({ where: { id: nightId }, data: { anchorTx } });
    },
  };
}

function readSteps(task: CompletedTask): StoredStep[] {
  if (task.steps == null) return [];
  if (!Array.isArray(task.steps)) throw new AnchorError(`Task ${task.id} has steps that are not a list.`);
  return task.steps.map((step, index) => {
    const parsed = storedStepSchema.safeParse(step);
    if (!parsed.success) throw new AnchorError(`Task ${task.id} step ${index} is not a step record.`);
    return parsed.data;
  });
}

function asBytes32(value: string, label: string): `0x${string}` {
  if (!bytes32.test(value)) throw new AnchorError(`${label} must be a 0x-prefixed 32-byte hex string.`);
  return value.toLowerCase() as `0x${string}`;
}
