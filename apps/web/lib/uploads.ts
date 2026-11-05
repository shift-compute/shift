import "server-only";
import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { getConfig } from "./server";

/** Absolute path of an upload, given the relative `inputPath` stored on the task. Refuses anything outside UPLOAD_DIR. */
export function resolveUpload(inputPath: string): string {
  const root = path.resolve(getConfig().UPLOAD_DIR);
  const full = path.resolve(root, inputPath);
  if (full !== root && !full.startsWith(root + path.sep)) throw new Error("Upload path escapes UPLOAD_DIR");
  return full;
}

/** Saves bytes under `<userId>/<random>.<ext>` and returns the relative path. File names never come from the client. */
export async function saveUpload(userId: string, ext: string, bytes: Uint8Array): Promise<string> {
  const rel = path.join(userId, `${randomUUID()}${ext}`);
  const full = resolveUpload(rel);
  await mkdir(path.dirname(full), { recursive: true });
  await writeFile(full, bytes);
  return rel;
}

export async function deleteUpload(inputPath: string): Promise<void> {
  await rm(resolveUpload(inputPath), { force: true });
}
