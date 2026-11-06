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
  /** Root, manifest and tx already stored. Null when this night has no row yet. */
  savedAnchor(nightId: bigint): Promise<SavedAnchor | null>;
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
  | {
      anchored: true;
      root: string;
      manifestRoot: string;
      /** Null when the contract already has the night and this process has no transaction hash to store. */
      anchorTx: string | null;
      itemCount: number;
    };

/** What is already stored for this night. Used to resume an anchor that uploaded the root but did not save the tx. */
export interface SavedAnchor {
  merkleRoot: string | null;
  manifestRoot: string | null;
  anchorTx: string | null;
  itemCount: number;
}

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
  const resumed = await resumeStoredAnchor(deps, log);
  if (resumed) return resumed;
  const tasks = await deps.store.completedTasks(deps.nightId);
  const sources = collectBatchLeaves(tasks, log);
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
 * Sends the anchor transaction for a root that was stored on a previous attempt and never got a tx hash.
 * Reads the contract first. A night that is already anchored is not sent again, and no hash is invented.
 */
async function resumeStoredAnchor(deps: AnchorDeps, log: (message: string) => void): Promise<AnchorResult | undefined> {
  const prior = await deps.store.savedAnchor(deps.nightId);
  if (!prior?.merkleRoot || !prior.manifestRoot || prior.anchorTx || prior.itemCount < 1) return undefined;
  const chain = await deps.ledger.readNight(deps.nightId);
  if (chain.anchored) {
    log(`night ${deps.nightId}: merkle root is stored and the contract already has this night; anchor transaction was not sent`);
    return { anchored: true, root: prior.merkleRoot, manifestRoot: prior.manifestRoot, anchorTx: null, itemCount: prior.itemCount };
  }
  const receipt = await deps.ledger.anchorNight({
    nightId: deps.nightId,
    root: asBytes32(prior.merkleRoot, "Merkle root"),
    manifestRoot: asBytes32(prior.manifestRoot, "Manifest root"),
    itemCount: prior.itemCount,
  });
  await deps.store.saveAnchorTx(deps.nightId, receipt.txHash);
  log(`night ${deps.nightId}: resumed anchor in ${receipt.txHash}`);
  return { anchored: true, root: prior.merkleRoot, manifestRoot: prior.manifestRoot, anchorTx: receipt.txHash, itemCount: prior.itemCount };
}

/**
 * One leaf per completed step that has a Router request id.
 * Several steps of one task share that task's output root.
 * Commons rows are not leaves. Each row stores one total and a list of request ids, and a rejected row has no output root.
 * A step that lacks a model, a reported cost, a trust tier, or an output root is skipped and logged. The rest of the night is still anchored.
 */
function collectBatchLeaves(tasks: readonly CompletedTask[], log: (message: string) => void): BatchLeaf[] {
  const leaves: BatchLeaf[] = [];
  const seen = new Set<string>();
  for (const task of tasks) {
    const steps = readSteps(task, log);
    if (!steps) continue;
    const ready = steps.filter((step) => step.requestId !== undefined && step.requestId.length > 0);
    if (ready.length === 0) continue;
    if (!task.outputRoot) {
      log(`night anchor: skipping task ${task.id} because it has a request id but no 0G Storage output root`);
      continue;
    }
    for (const step of ready) {
      const requestId = step.requestId ?? "";
      if (!step.model || !step.costUsdMicro || !step.trust) {
        log(`night anchor: skipping task ${task.id} request ${requestId} because it is missing a model, a reported cost, or a trust tier`);
        continue;
      }
      if (seen.has(requestId)) {
        log(`night anchor: skipping duplicate request id ${requestId} on task ${task.id}`);
        continue;
      }
      let values: MerkleLeafValues;
      try {
        values = leafFromStep(
          { step: step.step ?? "call", model: step.model, requestId, costUsdMicro: step.costUsdMicro, trust: step.trust },
          { owner: task.owner, taskId: task.id, outputRoot: task.outputRoot, trust: step.trust, isCommons: false },
        );
      } catch (err) {
        if (err instanceof MerkleLeafError) {
          log(`night anchor: skipping task ${task.id} request ${requestId} because ${err.message}`);
          continue;
        }
        throw err;
      }
      seen.add(requestId);
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

    async savedAnchor(nightId) {
      const night = await db.night.findUnique({
        where: { id: nightId },
        select: { merkleRoot: true, manifestRoot: true, anchorTx: true, itemCount: true },
      });
      if (!night) return null;
      return { merkleRoot: night.merkleRoot, manifestRoot: night.manifestRoot, anchorTx: night.anchorTx, itemCount: night.itemCount };
    },
  };
}

/** Null when the task's step blob is not a list. That task is skipped; the rest of the night is still anchored. */
function readSteps(task: CompletedTask, log: (message: string) => void): StoredStep[] | null {
  if (task.steps == null) return [];
  if (!Array.isArray(task.steps)) {
    log(`night anchor: skipping task ${task.id} because its steps are not a list`);
    return null;
  }
  const steps: StoredStep[] = [];
  task.steps.forEach((step, index) => {
    const parsed = storedStepSchema.safeParse(step);
    if (!parsed.success) {
      log(`night anchor: skipping task ${task.id} step ${index} because it is not a step record`);
      return;
    }
    steps.push(parsed.data);
  });
  return steps;
}

function asBytes32(value: string, label: string): `0x${string}` {
  if (!bytes32.test(value)) throw new AnchorError(`${label} must be a 0x-prefixed 32-byte hex string.`);
  return value.toLowerCase() as `0x${string}`;
}
