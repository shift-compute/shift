import { z } from "zod";

export const TASK_TYPES = ["AUDIO_SUMMARY", "DOC_ANALYSIS", "IMAGE_FROM_PROMPT"] as const;
export type TaskTypeName = (typeof TASK_TYPES)[number];

const MB = 1024 * 1024;

interface UploadRule {
  maxBytes: number;
  /** Allowed file extensions (lower case, with dot) mapped to the MIME type we store. */
  extensions: Record<string, string>;
}

/** Upload limits per task type. Image tasks take a text prompt instead of a file. */
export const UPLOAD_RULES: Record<Exclude<TaskTypeName, "IMAGE_FROM_PROMPT">, UploadRule> = {
  AUDIO_SUMMARY: { maxBytes: 10 * MB, extensions: { ".mp3": "audio/mpeg", ".m4a": "audio/mp4", ".wav": "audio/wav" } },
  DOC_ANALYSIS: { maxBytes: 5 * MB, extensions: { ".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown" } },
};

export const MAX_PROMPT_CHARS = 1000;

export const priorityEnum = z.coerce.number().int().min(1).max(3);

export interface UploadCheck {
  ok: true;
  mime: string;
  ext: string;
}
export interface UploadProblem {
  ok: false;
  error: "unsupported_type" | "empty_file" | "file_too_large" | "content_mismatch";
  message: string;
}

function extensionOf(name: string): string {
  const i = name.lastIndexOf(".");
  return i < 0 ? "" : name.slice(i).toLowerCase();
}

/** Checks the first bytes against what the extension promises, so a renamed file is not accepted. */
function matchesSignature(ext: string, head: Uint8Array): boolean {
  const ascii = (from: number, text: string) => text.split("").every((c, i) => head[from + i] === c.charCodeAt(0));
  switch (ext) {
    case ".pdf":
      return ascii(0, "%PDF-");
    case ".wav":
      return ascii(0, "RIFF") && ascii(8, "WAVE");
    case ".mp3":
      return ascii(0, "ID3") || (head[0] === 0xff && ((head[1] ?? 0) & 0xe0) === 0xe0);
    case ".m4a":
      return ascii(4, "ftyp");
    case ".txt":
    case ".md":
      // Text must not contain NUL bytes.
      return !head.includes(0);
    default:
      return false;
  }
}

export function checkUpload(type: Exclude<TaskTypeName, "IMAGE_FROM_PROMPT">, fileName: string, bytes: Uint8Array): UploadCheck | UploadProblem {
  const rule = UPLOAD_RULES[type];
  const ext = extensionOf(fileName);
  const mime = rule.extensions[ext];
  if (!mime) return { ok: false, error: "unsupported_type", message: `Accepted files for this task: ${Object.keys(rule.extensions).join(", ")}.` };
  if (bytes.byteLength === 0) return { ok: false, error: "empty_file", message: "The file is empty." };
  if (bytes.byteLength > rule.maxBytes) return { ok: false, error: "file_too_large", message: `The file is larger than ${rule.maxBytes / MB} MB.` };
  if (!matchesSignature(ext, bytes.subarray(0, 16))) return { ok: false, error: "content_mismatch", message: `The file content does not look like a ${ext} file.` };
  return { ok: true, mime, ext };
}

export const imagePromptSchema = z.object({
  prompt: z.string().trim().min(3, "Describe the image in at least a few words.").max(MAX_PROMPT_CHARS),
  priority: priorityEnum.default(2),
});
