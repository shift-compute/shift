import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { Indexer, MemData } from "@0gfoundation/0g-ts-sdk";
import { ethers } from "ethers";
import { redactString } from "../redact";

export interface StoredBlob {
  rootHash: string;
  txHash: string;
}

/** The two operations the rest of the code needs. Tests and dry runs substitute their own. */
export interface StorageClient {
  upload(bytes: Uint8Array): Promise<StoredBlob>;
  download(rootHash: string): Promise<Uint8Array>;
}

/** One attempt. A stuck node fails the attempt so the retry loop can move on. */
export const UPLOAD_TIMEOUT_MS = 120_000;
/** A stuck indexer download must not hold the result page open. */
export const DOWNLOAD_TIMEOUT_MS = 20_000;

/**
 * The indexer operations this client uses. Tests pass a fake.
 * The official `Indexer` satisfies this; a stuck `upload` is timed out per attempt.
 */
export interface StorageIndexer {
  upload(data: unknown, rpcUrl: string, signer: unknown): Promise<readonly [unknown, unknown]>;
  download(rootHash: string, filePath: string, proof: boolean): Promise<unknown>;
}

export interface StorageOptions {
  rpcUrl: string;
  indexerUrl: string;
  /** Operator key. Pays for storage; only the worker ever holds it. Omit only when `signer` is injected by a test. */
  privateKey?: string;
  /** Test hook. Production builds a wallet from `privateKey`. */
  signer?: unknown;
  /** Test hook. Production uses the official Indexer. */
  indexer?: StorageIndexer;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
  /** Per `indexer.upload` attempt. Defaults to {@link UPLOAD_TIMEOUT_MS}. */
  uploadTimeoutMs?: number;
  /** Per `indexer.download`. Defaults to {@link DOWNLOAD_TIMEOUT_MS}. The SDK call is not aborted. */
  downloadTimeoutMs?: number;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(redactString(message));
    this.name = "StorageError";
  }
}

/** One upload at a time. The signer is shared, and overlapping uploads can collide on it. */
function createUploadLock(): <T>(fn: () => Promise<T>) => Promise<T> {
  let tail: Promise<void> = Promise.resolve();
  return async function exclusive<T>(fn: () => Promise<T>): Promise<T> {
    const prev = tail;
    let release: () => void = () => undefined;
    tail = new Promise<void>((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  };
}

/**
 * Rejects when `work` does not settle in time. A later rejection of `work` is swallowed
 * so a stuck node that fails after the timeout is not an unhandled rejection.
 */
function withTimeout<T>(work: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
  });
  work.then(
    () => undefined,
    () => undefined,
  );
  return Promise.race([work, timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}

/**
 * 0G Storage through the official SDK (verified in Phase 0: upload, then download by root hash with a SHA-256 match).
 * Uploads are content addressed, so retrying one that failed halfway cannot store a second copy under a different root.
 * Each indexer attempt has a timeout, and uploads share one lock so two tasks cannot sign at once.
 */
export function createStorageClient(options: StorageOptions): StorageClient {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxAttempts = options.maxAttempts ?? 3;
  const uploadTimeoutMs = options.uploadTimeoutMs ?? UPLOAD_TIMEOUT_MS;
  const downloadTimeoutMs = options.downloadTimeoutMs ?? DOWNLOAD_TIMEOUT_MS;
  if (!options.signer && !options.privateKey) throw new StorageError("A storage signer or operator key is required.");
  const indexer = options.indexer ?? (new Indexer(options.indexerUrl) as unknown as StorageIndexer);
  const signer = options.signer ?? new ethers.Wallet(options.privateKey as string, new ethers.JsonRpcProvider(options.rpcUrl));
  const exclusive = createUploadLock();

  return {
    async upload(bytes) {
      if (bytes.byteLength === 0) throw new StorageError("Refusing to upload an empty file.");
      return exclusive(async () => {
        let lastError = "unknown error";
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          const data = new MemData(bytes);
          const [, treeErr] = await data.merkleTree();
          if (treeErr !== null) throw new StorageError(`Merkle tree generation failed: ${String(treeErr)}`);
          try {
            const [tx, err] = await withTimeout(indexer.upload(data, options.rpcUrl, signer), uploadTimeoutMs, "Upload attempt");
            if (err === null && tx !== null && typeof tx === "object") {
              const record = tx as { rootHash?: unknown; rootHashes?: unknown[]; txHash?: unknown; txHashes?: unknown[] };
              const rootHash = typeof record.rootHash === "string" ? record.rootHash : record.rootHashes?.[0];
              const txHash = typeof record.txHash === "string" ? record.txHash : record.txHashes?.[0];
              if (typeof rootHash === "string" && typeof txHash === "string") return { rootHash, txHash };
              lastError = "Upload succeeded but returned no root hash.";
            } else {
              lastError = String(err);
            }
          } catch (e) {
            lastError = e instanceof Error ? e.message : String(e);
          }
          if (attempt < maxAttempts) await sleep(2000 * attempt);
        }
        throw new StorageError(`Upload failed after ${maxAttempts} attempts: ${lastError}`);
      });
    },

    async download(rootHash) {
      if (!/^0x[0-9a-fA-F]{64}$/.test(rootHash)) throw new StorageError("Root hash must be 0x followed by 64 hex characters.");
      const dir = await mkdtemp(path.join(tmpdir(), "shift-dl-"));
      const file = path.join(dir, "blob");
      try {
        const err = await withTimeout(indexer.download(rootHash, file, true), downloadTimeoutMs, "Download");
        if (err !== null) throw new StorageError(`Download failed: ${String(err)}`);
        return new Uint8Array(await readFile(file));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

