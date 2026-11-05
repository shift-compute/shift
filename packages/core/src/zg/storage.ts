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

export interface StorageOptions {
  rpcUrl: string;
  indexerUrl: string;
  /** Operator key. Pays for storage; only the worker ever holds it. */
  privateKey: string;
  sleep?: (ms: number) => Promise<void>;
  maxAttempts?: number;
}

export class StorageError extends Error {
  constructor(message: string) {
    super(redactString(message));
    this.name = "StorageError";
  }
}

/**
 * 0G Storage through the official SDK (verified in Phase 0: upload, then download by root hash with a SHA-256 match).
 * Uploads are content addressed, so retrying one that failed halfway cannot store a second copy under a different root.
 */
export function createStorageClient(options: StorageOptions): StorageClient {
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxAttempts = options.maxAttempts ?? 3;
  const indexer = new Indexer(options.indexerUrl);
  const signer = new ethers.Wallet(options.privateKey, new ethers.JsonRpcProvider(options.rpcUrl));

  return {
    async upload(bytes) {
      if (bytes.byteLength === 0) throw new StorageError("Refusing to upload an empty file.");
      let lastError = "unknown error";
      for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        const data = new MemData(bytes);
        const [, treeErr] = await data.merkleTree();
        if (treeErr !== null) throw new StorageError(`Merkle tree generation failed: ${String(treeErr)}`);
        try {
          const [tx, err] = await indexer.upload(data, options.rpcUrl, signer as never);
          if (err === null) {
            const { rootHash, txHash } = "rootHash" in tx ? tx : { rootHash: tx.rootHashes[0]!, txHash: tx.txHashes[0]! };
            return { rootHash, txHash };
          }
          lastError = String(err);
        } catch (e) {
          lastError = e instanceof Error ? e.message : String(e);
        }
        if (attempt < maxAttempts) await sleep(2000 * attempt);
      }
      throw new StorageError(`Upload failed after ${maxAttempts} attempts: ${lastError}`);
    },

    async download(rootHash) {
      if (!/^0x[0-9a-fA-F]{64}$/.test(rootHash)) throw new StorageError("Root hash must be 0x followed by 64 hex characters.");
      const dir = await mkdtemp(path.join(tmpdir(), "shift-dl-"));
      const file = path.join(dir, "blob");
      try {
        const err = await indexer.download(rootHash, file, true);
        if (err !== null) throw new StorageError(`Download failed: ${String(err)}`);
        return new Uint8Array(await readFile(file));
      } finally {
        await rm(dir, { recursive: true, force: true });
      }
    },
  };
}

