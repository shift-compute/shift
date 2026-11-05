import { createHash } from "node:crypto";
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

/** What ends up on 0G Storage as the task's JSON: the result, where each file lives, and the evidence of every call. */
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
  /** Root hash of the JSON document: this is what the Merkle leaf and the verify page point at. */
  rootHash: string;
  txHash: string;
  document: TaskOutputDocument;
  documentBytes: Uint8Array;
}

const sha256 = (b: Uint8Array) => createHash("sha256").update(b).digest("hex");

/** Uploads each output file, then the JSON document that references them. The document is uploaded last so it never points at a missing file. */
export async function storeTaskOutput(
  storage: StorageClient,
  task: { id: string; type: string },
  output: ExecutorResult<unknown>,
  now: Date = new Date(),
): Promise<StoredTaskOutput> {
  const files: StoredFile[] = [];
  for (const file of output.files as OutputFile[]) {
    const stored = await storage.upload(file.bytes);
    files.push({ name: file.name, mime: file.mime, bytes: file.bytes.byteLength, sha256: sha256(file.bytes), ...stored });
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
  const { rootHash, txHash } = await storage.upload(documentBytes);
  return { rootHash, txHash, document, documentBytes };
}
