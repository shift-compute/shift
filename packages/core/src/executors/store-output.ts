import { createHash } from "node:crypto";
import { z } from "zod";
import { openOutput, OutputSealError, sealOutput } from "../crypto/output-seal";
import { redact } from "../redact";
import type { StorageClient } from "../zg/storage";
import type { ExecutorResult, OutputFile, StepRecord } from "./types";

export interface StoredFile {
  name: string;
  mime: string;
  bytes: number;
  sha256: string;
  rootHash: string;
  txHash: string;
}

/**
 * What ends up inside the ciphertext on 0G Storage: the result, where each ciphertext file lives,
 * and the evidence of every call. The Merkle leaf points at the ciphertext root, not these bytes.
 */
export interface TaskOutputDocument {
  version: 1;
  taskId: string;
  type: string;
  result: unknown;
  files: StoredFile[];
  steps: StepRecord[];
  createdAt: string;
}

export interface StoredTaskOutput {
  /** Root hash of the encrypted JSON document. This is what the Merkle leaf and the verify page point at. */
  rootHash: string;
  txHash: string;
  document: TaskOutputDocument;
  documentBytes: Uint8Array;
}

export interface StoreOutputOptions {
  /** SHIFT_MASTER_KEY. Combined with the account address; never written to storage. */
  masterKey: string;
  /** 0G account address. HKDF info and GCM additional data, so another account cannot open the blob. */
  accountAddress: string;
  now?: Date;
}

/** A file the owner can show. Bytes are the decrypted plaintext. */
export interface OpenedOutputFile {
  name: string;
  mime: string;
  sha256: string;
  rootHash: string;
  dataBase64: string;
}

/** What `GET /api/tasks/[id]/output` returns to the signed-in owner. Steps stay on the server. */
export interface OpenedTaskOutput {
  taskId: string;
  type: string;
  result: unknown;
  files: OpenedOutputFile[];
  createdAt: string;
  /** The indexer object is ciphertext. This view is the decrypted result. */
  sealed: true;
}

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

const ROOT = /^0x[0-9a-fA-F]{64}$/;
const MAX_FILES = 8;
const MAX_FILE_BYTES = 12 * 1024 * 1024;

const storedFileSchema = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().min(1).max(200),
  bytes: z.number().int().nonnegative().max(MAX_FILE_BYTES),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  rootHash: z.string().regex(ROOT),
  txHash: z.string().min(1).max(200),
});

const documentSchema = z.object({
  version: z.literal(1),
  taskId: z.string().min(1).max(200),
  type: z.string().min(1).max(80),
  result: z.unknown(),
  files: z.array(storedFileSchema).max(MAX_FILES),
  steps: z.array(z.unknown()),
  createdAt: z.string().min(1).max(40),
});

/**
 * Encrypts each output file, then the JSON document, and uploads only ciphertext.
 * File entries inside the document point at those ciphertext roots.
 * Commons outputs do not use this function; they stay public JSON.
 */
export async function storeTaskOutput(
  storage: StorageClient,
  task: { id: string; type: string },
  output: ExecutorResult<unknown>,
  options: StoreOutputOptions,
): Promise<StoredTaskOutput> {
  const now = options.now ?? new Date();
  const files: StoredFile[] = [];
  for (const file of output.files as OutputFile[]) {
    const sealed = sealOutput(file.bytes, options.masterKey, options.accountAddress);
    const stored = await storage.upload(sealed);
    files.push({
      name: file.name,
      mime: file.mime,
      bytes: file.bytes.byteLength,
      sha256: sha256(file.bytes),
      ...stored,
    });
  }
  const document: TaskOutputDocument = {
    version: 1,
    taskId: task.id,
    type: task.type,
    result: output.result,
    files,
    steps: output.steps,
    createdAt: now.toISOString(),
  };
  const documentBytes = new TextEncoder().encode(JSON.stringify(document));
  const sealedDocument = sealOutput(documentBytes, options.masterKey, options.accountAddress);
  const { rootHash, txHash } = await storage.upload(sealedDocument);
  return { rootHash, txHash, document, documentBytes };
}

/**
 * Downloads the ciphertext root, decrypts it for this account, then decrypts each file it names.
 * A wrong account, a tampered blob, or a file whose plaintext hash does not match the document fails closed.
 */
export async function openStoredTaskOutput(
  storage: StorageClient,
  rootHash: string,
  options: StoreOutputOptions,
): Promise<OpenedTaskOutput> {
  if (!ROOT.test(rootHash)) throw new OutputSealError();
  let documentBytes: Uint8Array;
  try {
    documentBytes = openOutput(await storage.download(rootHash), options.masterKey, options.accountAddress);
  } catch (err) {
    if (err instanceof OutputSealError) throw err;
    throw new OutputSealError();
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(documentBytes));
  } catch {
    throw new OutputSealError();
  }
  const document = documentSchema.safeParse(parsed);
  if (!document.success) throw new OutputSealError();

  const files: OpenedOutputFile[] = [];
  for (const file of document.data.files) {
    let plain: Uint8Array;
    try {
      plain = openOutput(await storage.download(file.rootHash), options.masterKey, options.accountAddress);
    } catch (err) {
      if (err instanceof OutputSealError) throw err;
      throw new OutputSealError();
    }
    if (plain.byteLength !== file.bytes || sha256(plain) !== file.sha256) throw new OutputSealError();
    files.push({
      name: file.name,
      mime: file.mime,
      sha256: file.sha256,
      rootHash: file.rootHash,
      dataBase64: Buffer.from(plain).toString("base64"),
    });
  }

  return {
    taskId: document.data.taskId,
    type: document.data.type,
    result: redact(document.data.result),
    files,
    createdAt: document.data.createdAt,
    sealed: true,
  };
}
