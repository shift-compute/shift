import { describe, expect, it } from "vitest";
import { createStorageClient, type StorageIndexer } from "./storage";

const ROOT = `0x${"ab".repeat(32)}`;
const TX = `0x${"cd".repeat(32)}`;

function client(indexer: StorageIndexer, over: { uploadTimeoutMs?: number; maxAttempts?: number; sleep?: (ms: number) => Promise<void> } = {}) {
  return createStorageClient({
    rpcUrl: "http://127.0.0.1:8545",
    indexerUrl: "http://127.0.0.1:1",
    signer: {},
    uploadTimeoutMs: over.uploadTimeoutMs ?? 30,
    maxAttempts: over.maxAttempts ?? 1,
    sleep: over.sleep ?? (async () => undefined),
    indexer,
  });
}

describe("createStorageClient upload", () => {
  it("fails a stuck indexer attempt instead of waiting forever", async () => {
    let calls = 0;
    const storage = client(
      {
        upload: () => {
          calls += 1;
          return new Promise(() => undefined);
        },
        download: async () => null,
      },
      { uploadTimeoutMs: 25, maxAttempts: 2 },
    );
    const started = Date.now();
    await expect(storage.upload(new Uint8Array([1, 2, 3]))).rejects.toThrow(/timed out/);
    expect(Date.now() - started).toBeLessThan(2_000);
    expect(calls).toBe(2);
  });

  it("runs one upload at a time", async () => {
    let active = 0;
    let max = 0;
    let started = 0;
    let releaseFirst: () => void = () => undefined;
    const firstGate = new Promise<void>((resolve) => {
      releaseFirst = resolve;
    });
    const storage = client(
      {
        upload: async () => {
          started += 1;
          active += 1;
          max = Math.max(max, active);
          if (started === 1) await firstGate;
          active -= 1;
          return [{ rootHash: ROOT, txHash: TX }, null];
        },
        download: async () => null,
      },
      { uploadTimeoutMs: 5_000 },
    );
    const bytes = new Uint8Array([1, 2, 3, 4]);
    const first = storage.upload(bytes);
    const second = storage.upload(bytes);
    await new Promise((resolve) => setTimeout(resolve, 30));
    expect(started).toBe(1);
    releaseFirst();
    await Promise.all([first, second]);
    expect(max).toBe(1);
    expect(started).toBe(2);
  });
});
