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
    savedAnchor: async () => ({
      merkleRoot: saved.root,
      manifestRoot: saved.manifestRoot,
      anchorTx: saved.anchorTx,
      itemCount: saved.itemCount ?? 0,
    }),
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
  const ledger: LedgerClient = {
    anchorNight: async (input: LedgerAnchor) => {
      anchored.push(input);
      return { txHash: TX };
    },
    readNight: async () => {
      throw new Error("anchorNight must not read donations");
    },
    recordDonations: async () => {
      throw new Error("recordDonations must not be called");
    },
  };
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

  it("skips a step that lacks model, cost or trust and anchors the rest", async () => {
    const bad: CompletedTask = {
      id: "bad",
      owner: done.owner,
      outputRoot: OUTPUT,
      steps: [{ step: "analyze", requestId: "req-bad", trust: "private" }],
    };
    const logs: string[] = [];
    const fake = fakes([bad, done]);
    const result = await anchorNight({ ...deps(fake), nightId: NIGHT, now: () => NOW, log: (message) => logs.push(message) });

    expect(result).toMatchObject({ anchored: true, itemCount: 2, anchorTx: TX });
    expect(fake.anchored).toHaveLength(1);
    expect(fake.saved.leaves.map((leaf) => leaf.requestId)).toEqual(["req-classify", "req-analyze"]);
    expect(logs.join("\n")).toContain("req-bad");
    expect(logs.join("\n")).toContain("missing a model, a reported cost, or a trust tier");
  });

  it("records why a task cannot be a leaf and does not anchor a night that has none", async () => {
    const missingRoot = fakes([{ ...done, outputRoot: null }]);
    const logs: string[] = [];
    await expect(anchorNight({ ...deps(missingRoot), nightId: NIGHT, log: (message) => logs.push(message) })).resolves.toEqual({
      anchored: false,
      reason: "empty",
    });
    expect(logs.join("\n")).toContain("no 0G Storage output root");
    expect(missingRoot.anchored).toHaveLength(0);
    expect(missingRoot.uploads).toHaveLength(0);
    expect(missingRoot.saved.anchorTx).toBeNull();
  });

  it("does not send a second transaction when the stored root is already on chain", async () => {
    const fake = fakes([done]);
    const root = `0x${"11".repeat(32)}`;
    fake.store.savedAnchor = async () => ({ merkleRoot: root, manifestRoot: MANIFEST_ROOT, anchorTx: null, itemCount: 2 });
    fake.ledger.readNight = async () => ({ anchored: true, donationsRecorded: false });
    const logs: string[] = [];
    const result = await anchorNight({ ...deps(fake), nightId: NIGHT, log: (message) => logs.push(message) });

    expect(result).toEqual({ anchored: true, root, manifestRoot: MANIFEST_ROOT, anchorTx: null, itemCount: 2 });
    expect(fake.anchored).toHaveLength(0);
    expect(fake.uploads).toHaveLength(0);
    expect(fake.saved.order).toEqual([]);
    expect(logs.join("\n")).toContain("already has this night");
  });

  it("sends the anchor transaction when the root is stored and the night is not on chain", async () => {
    const fake = fakes([done]);
    const root = `0x${"11".repeat(32)}`;
    fake.store.savedAnchor = async () => ({ merkleRoot: root, manifestRoot: MANIFEST_ROOT, anchorTx: null, itemCount: 2 });
    fake.ledger.readNight = async () => ({ anchored: false, donationsRecorded: false });
    const result = await anchorNight({ ...deps(fake), nightId: NIGHT });

    expect(fake.uploads).toHaveLength(0);
    expect(fake.anchored).toEqual([{ nightId: NIGHT, root, manifestRoot: MANIFEST_ROOT, itemCount: 2 }]);
    expect(result).toEqual({ anchored: true, root, manifestRoot: MANIFEST_ROOT, anchorTx: TX, itemCount: 2 });
    expect(fake.saved.order).toEqual(["tx"]);
    expect(fake.saved.anchorTx).toBe(TX);
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
