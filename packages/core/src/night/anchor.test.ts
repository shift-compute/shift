import { getAddress } from "ethers";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../db/client";
import { verifyLeaf } from "../merkle/tree";
import type { LedgerAnchor, LedgerClient } from "../zg/ledger";
import type { StorageClient } from "../zg/storage";
import { anchorNight, prismaAnchorStore, type AnchorStore, type CompletedTask, type PersistedLeaf } from "./anchor";
import type { NightManifest } from "./manifest";

const NIGHT = 20261106n;
const NOW = new Date("2026-11-06T23:40:00.000Z");
const CONTRACT = "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7";
const OUTPUT = `0x${"ab".repeat(32)}`;
const MANIFEST_ROOT = `0x${"cd".repeat(32)}` as `0x${string}`;
const TX = `0x${"12".repeat(32)}` as `0x${string}`;

const done: CompletedTask = {
  id: "task-1",
  owner: "0x1111111111111111111111111111111111111111",
  outputRoot: OUTPUT,
  steps: [
    { step: "classify", model: "laya", requestId: "req-classify", costUsdMicro: "4", trust: "verified" },
    { step: "analyze", model: "0gm-1.0-35b-a3b", requestId: "req-analyze", costUsdMicro: "10", trust: "private" },
    { step: "note", model: "ignored" },
  ],
};

function memory(tasks: CompletedTask[]) {
  const saved = {
    order: [] as string[],
    root: null as string | null,
    manifestRoot: null as string | null,
    anchorTx: null as string | null,
    itemCount: null as number | null,
    leaves: [] as PersistedLeaf[],
  };
  const store: AnchorStore = {
    completedTasks: async () => tasks,
    saveTree: async (_nightId, root, itemCount, leaves) => {
      saved.order.push("tree");
      saved.root = root;
      saved.itemCount = itemCount;
      saved.leaves = leaves;
    },
    saveManifestRoot: async (_nightId, manifestRoot) => {
      saved.order.push("manifest");
      saved.manifestRoot = manifestRoot;
    },
    saveAnchorTx: async (_nightId, anchorTx) => {
      saved.order.push("tx");
      saved.anchorTx = anchorTx;
    },
  };
  return { store, saved };
}

function fakes(tasks: CompletedTask[]) {
  const uploads: Uint8Array[] = [];
  const anchored: LedgerAnchor[] = [];
  const { store, saved } = memory(tasks);
  const storage: StorageClient = {
    upload: async (bytes) => {
      uploads.push(bytes);
      return { rootHash: MANIFEST_ROOT, txHash: `0x${"ef".repeat(32)}` };
    },
    download: async () => {
      throw new Error("download is not part of anchoring");
    },
  };
  const ledger = {
    anchorNight: async (input: LedgerAnchor) => {
      anchored.push(input);
      return { txHash: TX };
    },
    recordDonations: () => {
      throw new Error("recordDonations must not be called");
    },
  } satisfies LedgerClient & { recordDonations: () => void };
  return { store, saved, storage, ledger, uploads, anchored };
}

function manifestFrom(bytes: Uint8Array): NightManifest {
  return JSON.parse(new TextDecoder().decode(bytes)) as NightManifest;
}

describe("anchorNight", () => {
  it("does not upload or send a transaction when the batch has no request ids", async () => {
    const empty = fakes([]);
    const withNoRequest = fakes([
      { id: "task-1", owner: done.owner, outputRoot: OUTPUT, steps: [{ step: "analyze", model: "m" }] },
    ]);

    await expect(anchorNight({ ...deps(empty), nightId: NIGHT })).resolves.toEqual({ anchored: false, reason: "empty" });
    await expect(anchorNight({ ...deps(withNoRequest), nightId: NIGHT })).resolves.toEqual({ anchored: false, reason: "empty" });

    expect(empty.uploads).toHaveLength(0);
    expect(empty.anchored).toHaveLength(0);
    expect(empty.saved.order).toEqual([]);
    expect(withNoRequest.uploads).toHaveLength(0);
    expect(withNoRequest.anchored).toHaveLength(0);
    expect(withNoRequest.saved.order).toEqual([]);
  });

  it("builds the manifest and the tree, persists proofs, and calls the injected client", async () => {
    const fake = fakes([done]);
    const result = await anchorNight({ ...deps(fake), nightId: NIGHT, now: () => NOW });

    expect(result).toEqual({ anchored: true, root: fake.saved.root, manifestRoot: MANIFEST_ROOT, anchorTx: TX, itemCount: 2 });
    expect(fake.saved.order).toEqual(["tree", "manifest", "tx"]);
    expect(fake.saved.itemCount).toBe(2);
    expect(fake.anchored).toEqual([{ nightId: NIGHT, root: fake.saved.root, manifestRoot: MANIFEST_ROOT, itemCount: 2 }]);
    expect(fake.saved.leaves.map((leaf) => leaf.requestId)).toEqual(["req-classify", "req-analyze"]);

    const manifest = manifestFrom(fake.uploads[0]!);
    expect(manifest).toMatchObject({
      nightId: NIGHT.toString(),
      root: fake.saved.root,
      itemCount: 2,
      generatedAt: NOW.toISOString(),
      chainId: 16602,
      contract: getAddress(CONTRACT),
      donationsRecorded: false,
    });
    expect(manifest.leaves.map((leaf) => [leaf.requestId, leaf.model, leaf.trust, leaf.step, leaf.isCommons])).toEqual([
      ["req-classify", "laya", "verified", "classify", false],
      ["req-analyze", "0gm-1.0-35b-a3b", "private", "analyze", false],
    ]);
    expect(manifest.leaves.every((leaf) => leaf.outputRoot === OUTPUT && leaf.taskId === "task-1")).toBe(true);
    expect(manifest.leaves[1]?.costUsdMicro).toBe("10");
    expect(manifest.leaves[1]?.owner).toBe(done.owner);

    for (const leaf of fake.saved.leaves) {
      expect(leaf.proof.length).toBeGreaterThan(0);
      expect(leaf.values).toEqual(manifest.leaves.find((item) => item.requestId === leaf.requestId)?.values);
      const values = manifest.leaves.find((item) => item.requestId === leaf.requestId);
      expect(values).toBeDefined();
      expect(verifyLeaf(fake.saved.root!, parseValues(leaf.values), leaf.proof)).toBe(true);
    }
    expect(verifyLeaf(fake.saved.root!, parseValues(fake.saved.leaves[0]!.values), fake.saved.leaves[1]!.proof)).toBe(false);
  });

  it("refuses a request that has no cost, trust or output root, and does not send a transaction", async () => {
    const missingCost = fakes([{ ...done, steps: [{ step: "analyze", model: "m", requestId: "req-1", trust: "private" }] }]);
    const missingTrust = fakes([{ ...done, steps: [{ step: "analyze", model: "m", requestId: "req-1", costUsdMicro: "1" }] }]);
    const missingRoot = fakes([{ ...done, outputRoot: null }]);
    const duplicate = fakes([
      done,
      { ...done, id: "task-2", steps: [{ step: "analyze", model: "m", requestId: "req-analyze", costUsdMicro: "1", trust: "private" }] },
    ]);

    await expect(anchorNight({ ...deps(missingCost), nightId: NIGHT })).rejects.toThrow(/reported cost/);
    await expect(anchorNight({ ...deps(missingTrust), nightId: NIGHT })).rejects.toThrow(/trust tier/);
    await expect(anchorNight({ ...deps(missingRoot), nightId: NIGHT })).rejects.toThrow(/output root/);
    await expect(anchorNight({ ...deps(duplicate), nightId: NIGHT })).rejects.toThrow(/appears twice/);

    for (const fake of [missingCost, missingTrust, missingRoot, duplicate]) {
      expect(fake.anchored).toHaveLength(0);
      expect(fake.uploads).toHaveLength(0);
      expect(fake.saved.anchorTx).toBeNull();
    }
  });

  it("does not store the transaction when the chain client rejects it", async () => {
    const fake = fakes([done]);
    fake.ledger.anchorNight = vi.fn(async () => {
      throw new Error("already anchored");
    });
    await expect(anchorNight({ ...deps(fake), nightId: NIGHT })).rejects.toThrow(/already anchored/);
    expect(fake.saved.order).toEqual(["tree", "manifest"]);
    expect(fake.saved.manifestRoot).toBe(MANIFEST_ROOT);
    expect(fake.saved.anchorTx).toBeNull();
  });

  it("loads only DONE tasks of this night from Prisma", async () => {
    const findMany = vi.fn().mockResolvedValue([
      {
        id: "task-9",
        outputRoot: OUTPUT,
        steps: [],
        user: { accountAddress: done.owner },
      },
    ]);
    const db = { task: { findMany } } as unknown as PrismaClient;
    await expect(prismaAnchorStore(db).completedTasks(NIGHT)).resolves.toEqual([
      { id: "task-9", owner: done.owner, outputRoot: OUTPUT, steps: [] },
    ]);
    expect(findMany).toHaveBeenCalledWith({
      where: { nightId: NIGHT, status: "DONE" },
      orderBy: { id: "asc" },
      select: { id: true, outputRoot: true, steps: true, user: { select: { accountAddress: true } } },
    });
  });
});

function deps(fake: ReturnType<typeof fakes>) {
  return { store: fake.store, storage: fake.storage, ledger: fake.ledger, chainId: 16602, contractAddress: CONTRACT };
}

/** The JSON column stores every packed field as a string. Verification needs the tuple's real types. */
function parseValues(values: string[]): [`0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, `0x${string}`, 0 | 1 | 2, bigint, boolean] {
  const [requestIdHash, owner, taskIdHash, outputRoot, modelHash, trust, cost, isCommons] = values;
  if (!requestIdHash || !owner || !taskIdHash || !outputRoot || !modelHash || trust === undefined || cost === undefined || isCommons === undefined) {
    throw new Error("leaf values were not persisted");
  }
  const tier = Number(trust);
  if (tier !== 0 && tier !== 1 && tier !== 2) throw new Error("trust tier was not persisted");
  return [requestIdHash as `0x${string}`, owner as `0x${string}`, taskIdHash as `0x${string}`, outputRoot as `0x${string}`, modelHash as `0x${string}`, tier, BigInt(cost), isCommons === "true"];
}
