import { describe, expect, it } from "vitest";
import { getAddress } from "ethers";
import { sealSecret, type AnchorStore, type CommonsStore, type CompletedTask, type ConnectedUser, type DonationStore, type LedgerClient, type OpenTask, type PipelineStore, type TaskPatch, type UserRouter, type WorkerConfig } from "@shift/core";
import { runNight } from "./night";

const KEY = Buffer.alloc(32, 4).toString("base64");
const ADDRESS = "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f";

function connected(id: string, secret: string): ConnectedUser {
  const sealed = sealSecret(secret, KEY, ADDRESS.toLowerCase());
  return {
    id,
    accountAddress: ADDRESS,
    mode: "IAI_CREDITS_ONLY",
    nightlyBudgetUsdMicro: null,
    donateLeftover: false,
    mkCiphertext: sealed.ciphertext,
    mkIv: sealed.iv,
    mkAuthTag: sealed.authTag,
  };
}

function memory(users: ConnectedUser[], tasks: OpenTask[]) {
  const state = new Map<string, TaskPatch>();
  const runs: string[] = [];
  let modelsCalls = 0;
  const store: PipelineStore = {
    eligibleUsers: async () => users,
    openTasks: async (userId) => tasks.filter((task) => task.inputPath?.startsWith(userId) && (state.get(task.id)?.status ?? "QUEUED") !== "DONE"),
    findRun: async () => null,
    createRun: async (_nightId, userId) => {
      runs.push(userId);
      return { id: `run-${userId}` };
    },
    updateRun: async () => undefined,
    updateTask: async (id, patch) => {
      state.set(id, { ...state.get(id), ...patch });
    },
  };
  return { store, state, runs, modelsCalls: () => modelsCalls, countModels: () => { modelsCalls += 1; } };
}

const config = {
  SHIFT_MASTER_KEY: KEY,
  SAFETY_MARGIN_PCT: 0,
  MAX_CONCURRENCY: 1,
  NIGHT_START_UTC: "23:00",
  NIGHT_HARD_STOP_UTC: "23:50",
  UPLOAD_DIR: "/tmp/shift-uploads",
  COMMONS_GATE_THRESHOLD: 0.75,
} as WorkerConfig;

const docReply = { data: { choices: [{ message: { content: '{"summary":"Ok.","actionItems":[],"risks":[]}' } }] }, status: 200, requestId: "req-doc", trace: { billing: { total_cost_usd_micro: "1" } } };

/** An anchor store with nothing to prove, and a ledger that fails if a transaction is attempted. */
function emptyAnchor() {
  let lookups = 0;
  const anchorStore: AnchorStore = {
    completedTasks: async () => {
      lookups += 1;
      return [];
    },
    saveTree: async () => {
      throw new Error("empty night must not write a tree");
    },
    saveManifestRoot: async () => {
      throw new Error("empty night must not write a manifest");
    },
    saveAnchorTx: async () => {
      throw new Error("empty night must not write a tx");
    },
  };
  const ledger: LedgerClient = {
    anchorNight: async () => {
      throw new Error("empty night must not send a transaction");
    },
    readNight: async () => {
      throw new Error("empty night must not read donations");
    },
    recordDonations: async () => {
      throw new Error("empty night must not record donations");
    },
  };
  return { anchorStore, ledger, lookups: () => lookups };
}

describe("runNight", () => {
  it("finishes quietly when nobody is connected and does not anchor an empty batch", async () => {
    const logs: string[] = [];
    const store = memory([], []).store;
    const anchored = emptyAnchor();
    await runNight({
      config,
      nightId: 20261106n,
      log: (message) => logs.push(message),
      store,
      anchorStore: anchored.anchorStore,
      ledger: anchored.ledger,
      router: { listModels: async () => { throw new Error("should not be called"); } } as unknown as UserRouter,
      storage: { upload: async () => { throw new Error("should not be called"); }, download: async () => { throw new Error("no"); } },
    });
    expect(logs.join("\n")).toContain("0 connected");
    expect(logs.join("\n")).toContain("empty batch, not anchored");
    expect(anchored.lookups()).toBe(1);
  });

  it("runs the next user when the first one fails, and loads the catalog once", async () => {
    const mkA = "mk-aaaaaaaaaaaaaaaaaaaa";
    const mkB = "mk-bbbbbbbbbbbbbbbbbbbb";
    const users = [connected("a", mkA), connected("b", mkB)];
    const tasks: OpenTask[] = [
      { id: "ta", type: "DOC_ANALYSIS", priority: 2, createdAt: new Date(), inputPath: "a/doc.txt", inputMeta: { mime: "text/plain" }, prompt: null },
      { id: "tb", type: "DOC_ANALYSIS", priority: 2, createdAt: new Date(), inputPath: "b/doc.txt", inputMeta: { mime: "text/plain" }, prompt: null },
    ];
    const mem = memory(users, tasks);
    let models = 0;
    const router = {
      listModels: async () => {
        models += 1;
        return { data: [{ id: "0gm-1.0-35b-a3b", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0", completion: "0" } }], status: 200 };
      },
      getBalance: async (mk: string) => {
        if (mk === mkA) throw new Error("router down for the first user");
        return { data: { address: ADDRESS, currency: "usd", credit_balance: "1000000", deposit_balance: "0", pending_charge: "0", total_balance: "1000000" }, status: 200 };
      },
      getUsageHistory: async () => ({ data: [], status: 200 }),
      createApiKey: async () => ({ data: { key_id: "key-b", key: "sk-bbbbbbbbbbbbbbbbbbbb", name: "shift" }, status: 200 }),
      revokeApiKey: async () => ({ data: { key_id: "key-b" }, status: 200 }),
      chat: async () => docReply,
      decide: async () => { throw new Error("no"); },
      transcribe: async () => { throw new Error("no"); },
      generateImage: async () => { throw new Error("no"); },
    } as UserRouter;

    const anchored = emptyAnchor();
    await runNight({
      config,
      nightId: 20261106n,
      log: () => undefined,
      store: mem.store,
      anchorStore: anchored.anchorStore,
      ledger: anchored.ledger,
      router,
      storage: { upload: async () => ({ rootHash: `0x${"ab".repeat(32)}`, txHash: `0x${"cd".repeat(32)}` }), download: async () => new Uint8Array() },
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
      readFile: async () => new TextEncoder().encode("hello"),
    });
    expect(anchored.lookups()).toBe(1);

    expect(models).toBe(1);
    expect(mem.runs).toEqual(["a", "b"]);
    expect(mem.state.get("ta")?.status).toBeUndefined();
    expect(mem.state.get("tb")?.status).toBe("DONE");
  });

  it("does not start a later user after the hard stop", async () => {
    const users = [connected("a", "mk-aaaaaaaaaaaaaaaaaaaa"), connected("b", "mk-bbbbbbbbbbbbbbbbbbbb")];
    const tasks: OpenTask[] = [
      { id: "ta", type: "DOC_ANALYSIS", priority: 2, createdAt: new Date(), inputPath: "a/doc.txt", inputMeta: { mime: "text/plain" }, prompt: null },
      { id: "tb", type: "DOC_ANALYSIS", priority: 2, createdAt: new Date(), inputPath: "b/doc.txt", inputMeta: { mime: "text/plain" }, prompt: null },
    ];
    const mem = memory(users, tasks);
    let now = new Date("2026-11-06T23:40:00Z");
    const router = {
      listModels: async () => ({ data: [{ id: "0gm-1.0-35b-a3b", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0", completion: "0" } }], status: 200 }),
      getBalance: async () => ({ data: { address: ADDRESS, currency: "usd", credit_balance: "1000000", deposit_balance: "0", pending_charge: "0", total_balance: "1000000" }, status: 200 }),
      getUsageHistory: async () => ({ data: [], status: 200 }),
      createApiKey: async () => ({ data: { key_id: "key", key: "sk-cccccccccccccccccccc", name: "shift" }, status: 200 }),
      revokeApiKey: async () => ({ data: { key_id: "key" }, status: 200 }),
      chat: async () => {
        now = new Date("2026-11-06T23:50:00Z");
        return docReply;
      },
      decide: async () => { throw new Error("no"); },
      transcribe: async () => { throw new Error("no"); },
      generateImage: async () => { throw new Error("no"); },
    } as UserRouter;

    const anchored = emptyAnchor();
    await runNight({
      config,
      nightId: 20261106n,
      log: () => undefined,
      store: mem.store,
      anchorStore: anchored.anchorStore,
      ledger: anchored.ledger,
      router,
      storage: { upload: async () => ({ rootHash: `0x${"ab".repeat(32)}`, txHash: `0x${"cd".repeat(32)}` }), download: async () => new Uint8Array() },
      now: () => now,
      sleep: async () => undefined,
      readFile: async () => new TextEncoder().encode("hello"),
    });
    expect(anchored.lookups()).toBe(1);

    expect(mem.runs).toEqual(["a"]);
    expect(mem.state.get("tb")).toBeUndefined();
  });

  it("anchors completed tasks after the user loop without calling the Router when nobody is queued", async () => {
    const task: CompletedTask = {
      id: "task-1",
      owner: "0x1111111111111111111111111111111111111111",
      outputRoot: `0x${"ab".repeat(32)}`,
      steps: [{ step: "analyze", model: "0gm-1.0-35b-a3b", requestId: "req-1", costUsdMicro: "10", trust: "private" }],
    };
    const uploads: Uint8Array[] = [];
    let itemCount = 0;
    const anchorStore: AnchorStore = {
      completedTasks: async () => [task],
      saveTree: async () => undefined,
      saveManifestRoot: async () => undefined,
      saveAnchorTx: async () => undefined,
    };
    const ledger: LedgerClient = {
      anchorNight: async (input) => {
        itemCount = input.itemCount;
        expect(input.manifestRoot).toBe(`0x${"cd".repeat(32)}`);
        expect(input.nightId).toBe(20261106n);
        return { txHash: `0x${"12".repeat(32)}` };
      },
      readNight: async () => {
        throw new Error("this night has no donation store");
      },
      recordDonations: async () => {
        throw new Error("recordDonations must not be called");
      },
    };

    await runNight({
      config: { ...config, ZG_CHAIN_ID: 16602, LEDGER_CONTRACT_ADDRESS: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7" } as WorkerConfig,
      nightId: 20261106n,
      log: () => undefined,
      store: memory([], []).store,
      anchorStore,
      ledger,
      router: { listModels: async () => { throw new Error("the Router must not be called"); } } as unknown as UserRouter,
      storage: {
        upload: async (bytes) => {
          uploads.push(bytes);
          return { rootHash: `0x${"cd".repeat(32)}`, txHash: `0x${"ef".repeat(32)}` };
        },
        download: async () => new Uint8Array(),
      },
    });

    expect(itemCount).toBe(1);
    const manifest = JSON.parse(new TextDecoder().decode(uploads[0]!)) as { donationsRecorded: boolean; leaves: { requestId: string; isCommons: boolean }[] };
    expect(manifest.donationsRecorded).toBe(false);
    expect(manifest.leaves.map((leaf) => [leaf.requestId, leaf.isCommons])).toEqual([["req-1", false]]);
  });

  it("records a positive donation after the anchor and skips an empty donation list", async () => {
    const task: CompletedTask = {
      id: "task-1",
      owner: "0x1111111111111111111111111111111111111111",
      outputRoot: `0x${"ab".repeat(32)}`,
      steps: [{ step: "analyze", model: "0gm-1.0-35b-a3b", requestId: "req-1", costUsdMicro: "10", trust: "private" }],
    };
    const donor = "0x3333333333333333333333333333333333333333";
    const donationTx = `0x${"45".repeat(32)}` as `0x${string}`;
    const calls: string[] = [];
    const saved: string[] = [];
    const anchorStore: AnchorStore = {
      completedTasks: async () => [task],
      saveTree: async () => undefined,
      saveManifestRoot: async () => undefined,
      saveAnchorTx: async () => undefined,
    };
    const donations: DonationStore = {
      donationsTx: async () => null,
      positiveDonations: async () => [{ address: donor, amountUsdMicro: 9n }],
      saveDonationsTx: async (_nightId, tx) => {
        saved.push(tx);
      },
    };
    const ledger: LedgerClient = {
      anchorNight: async () => {
        calls.push("anchor");
        return { txHash: `0x${"12".repeat(32)}` };
      },
      readNight: async (nightId) => {
        calls.push("read");
        expect(nightId).toBe(20261106n);
        return { anchored: true, donationsRecorded: false };
      },
      recordDonations: async (input) => {
        calls.push("record");
        expect(input).toEqual({ nightId: 20261106n, donors: [getAddress(donor)], amounts: [9n] });
        return { txHash: donationTx };
      },
    };

    await runNight({
      config: { ...config, ZG_CHAIN_ID: 16602, LEDGER_CONTRACT_ADDRESS: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7" } as WorkerConfig,
      nightId: 20261106n,
      log: () => undefined,
      store: memory([], []).store,
      anchorStore,
      donations,
      ledger,
      router: { listModels: async () => { throw new Error("the Router must not be called"); } } as unknown as UserRouter,
      storage: {
        upload: async () => ({ rootHash: `0x${"cd".repeat(32)}`, txHash: `0x${"ef".repeat(32)}` }),
        download: async () => new Uint8Array(),
      },
    });
    expect(calls).toEqual(["anchor", "read", "record"]);
    expect(saved).toEqual([donationTx]);

    const skipped: string[] = [];
    const emptyDonations: DonationStore = {
      donationsTx: async () => null,
      positiveDonations: async () => [],
      saveDonationsTx: async () => {
        throw new Error("an empty donation list must not be stored");
      },
    };
    await runNight({
      config: { ...config, ZG_CHAIN_ID: 16602, LEDGER_CONTRACT_ADDRESS: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7" } as WorkerConfig,
      nightId: 20261106n,
      log: () => undefined,
      store: memory([], []).store,
      anchorStore,
      donations: emptyDonations,
      ledger: {
        anchorNight: async () => {
          skipped.push("anchor");
          return { txHash: `0x${"12".repeat(32)}` };
        },
        readNight: async () => {
          throw new Error("an empty donation list must not be read on-chain");
        },
        recordDonations: async () => {
          throw new Error("an empty donation list must not be sent");
        },
      },
      router: { listModels: async () => { throw new Error("the Router must not be called"); } } as unknown as UserRouter,
      storage: {
        upload: async () => ({ rootHash: `0x${"cd".repeat(32)}`, txHash: `0x${"ef".repeat(32)}` }),
        download: async () => new Uint8Array(),
      },
    });
    expect(skipped).toEqual(["anchor"]);
  });

  it("translates a pending commons item from leftover budget after personal tasks", async () => {
    const user = connected("donor", "mk-dddddddddddddddddddd");
    user.donateLeftover = true;
    const mem = memory([user], []);
    const row = {
      id: "c1",
      sourceText: "Ethereum gas pays for a smart contract.",
      targetLang: "hi",
      status: "PENDING",
      requestIds: [] as string[],
      translationA: undefined as string | undefined,
      translationB: undefined as string | undefined,
      modelA: undefined as string | undefined,
      modelB: undefined as string | undefined,
      donorUserId: undefined as string | undefined,
      costUsdMicro: undefined as bigint | undefined,
      gateModel: undefined as string | null | undefined,
      gateProbability: undefined as number | null | undefined,
    };
    const commons: CommonsStore = {
      pendingItems: async () => (row.status === "PENDING" ? [{ id: row.id, sourceText: row.sourceText, targetLang: row.targetLang }] : []),
      claim: async (id, donor) => {
        if (row.status !== "PENDING" || id !== row.id) return false;
        row.status = "RUNNING";
        row.donorUserId = donor.userId;
        expect(donor.userId).toBe("donor");
        return true;
      },
      runningItems: async (userId) => {
        if (row.status !== "RUNNING" || row.donorUserId !== userId || !row.translationA || !row.translationB || !row.modelA || !row.modelB) return [];
        return [{
          id: row.id,
          sourceText: row.sourceText,
          translationA: row.translationA,
          translationB: row.translationB,
          modelA: row.modelA,
          modelB: row.modelB,
          requestIds: row.requestIds,
          costUsdMicro: row.costUsdMicro ?? null,
          gateModel: row.gateModel ?? null,
          gateProbability: row.gateProbability ?? null,
        }];
      },
      save: async (_id, patch) => {
        Object.assign(row, patch);
      },
    };
    const models: string[] = [];
    const router = {
      listModels: async () => ({
        data: [
          { id: "glm-5.3", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0", completion: "0" } },
          { id: "0gm-1.0-35b-a3b", type: "chatbot", verifiability: "TeeML", pricing_usd: { prompt: "0", completion: "0" } },
        ],
        status: 200,
      }),
      getBalance: async () => ({ data: { address: ADDRESS, currency: "usd", credit_balance: "1000000", deposit_balance: "0", pending_charge: "0", total_balance: "1000000" }, status: 200 }),
      getUsageHistory: async () => ({ data: [], status: 200 }),
      createApiKey: async () => ({ data: { key_id: "key-d", key: "sk-dddddddddddddddddddd", name: "shift" }, status: 200 }),
      revokeApiKey: async () => ({ data: { key_id: "key-d" }, status: 200 }),
      chat: async (_sk: string, body: { model: string }) => {
        models.push(body.model);
        return { data: { choices: [{ message: { content: `tr-${body.model}` } }] }, status: 200, requestId: `req-${body.model}`, trace: { billing: { total_cost_usd_micro: "3" } } };
      },
      decide: async () => {
        throw new Error("the quality gate is not part of this step");
      },
      transcribe: async () => {
        throw new Error("no");
      },
      generateImage: async () => {
        throw new Error("no");
      },
    } as UserRouter;
    const anchored = emptyAnchor();
    await runNight({
      config,
      nightId: 20261106n,
      log: () => undefined,
      store: mem.store,
      commons,
      anchorStore: anchored.anchorStore,
      ledger: anchored.ledger,
      router,
      storage: { upload: async () => { throw new Error("commons translations are not uploaded in this step"); }, download: async () => new Uint8Array() },
      now: () => new Date("2026-11-06T23:10:00Z"),
      sleep: async () => undefined,
    });
    expect(models).toEqual(["glm-5.3", "0gm-1.0-35b-a3b"]);
    expect(row).toMatchObject({ status: "RUNNING", translationA: "tr-glm-5.3", translationB: "tr-0gm-1.0-35b-a3b", requestIds: ["req-glm-5.3", "req-0gm-1.0-35b-a3b"], costUsdMicro: 6n });
    expect(anchored.lookups()).toBe(1);
    expect(mem.runs).toEqual(["donor"]);
  });
});
