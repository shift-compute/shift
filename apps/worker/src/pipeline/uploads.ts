import path from "node:path";

/** Absolute path of an upload. Refuses a path that climbs out of UPLOAD_DIR, whatever the database row contains. */
export function resolveUpload(uploadDir: string, inputPath: string): string {
  const root = path.resolve(uploadDir);
  const full = path.resolve(root, inputPath);
  if (full !== root && !full.startsWith(root + path.sep)) {
    throw new Error("Upload path escapes UPLOAD_DIR.");
  }
  return full;
}
