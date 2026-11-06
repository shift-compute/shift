import { PDFParse } from "pdf-parse";
import { MAX_DOC_CHARS } from "./doc-limits";
import { ExecutorOutputError } from "./json-output";

/** A hostile PDF must not hold the process. The parse is abandoned after this long. */
export const PDF_PARSE_TIMEOUT_MS = 30_000;

export interface PdfReader {
  getText(): Promise<{ text: string }>;
  destroy(): Promise<void>;
}

/**
 * Resolves with `work`, or rejects with `timeoutError` when `work` does not settle in time.
 * A later rejection of `work` is swallowed so the abandoned parse is not an unhandled rejection.
 */
export async function awaitWithin<T>(work: Promise<T>, ms: number, timeoutError: Error): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(timeoutError), ms);
  });
  work.then(
    () => undefined,
    () => undefined,
  );
  try {
    return await Promise.race([work, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

export { MAX_DOC_CHARS } from "./doc-limits";

export interface DocText {
  text: string;
  chars: number;
  truncated: boolean;
}

/** pdf-parse adds "-- 1 of 3 --" page markers; they are noise for the model. */
function stripPageMarkers(text: string): string {
  return text.replace(/^-- \d+ of \d+ --$/gm, "");
}

function normalize(text: string): string {
  return text.replace(/\r\n?/g, "\n").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
}

export function limitText(raw: string, maxChars = MAX_DOC_CHARS): DocText {
  const text = normalize(raw);
  if (text.length === 0) throw new ExecutorOutputError("No readable text was found in the document.");
  return text.length > maxChars ? { text: text.slice(0, maxChars), chars: text.length, truncated: true } : { text, chars: text.length, truncated: false };
}

/**
 * Extracts the text of an upload on the server: PDFs through pdf-parse, text and markdown as UTF-8.
 * `hooks` is for tests. Production uses pdf-parse and {@link PDF_PARSE_TIMEOUT_MS}.
 */
export async function extractDocText(
  bytes: Uint8Array,
  ext: string,
  maxChars = MAX_DOC_CHARS,
  hooks?: { timeoutMs?: number; openPdf?: (bytes: Uint8Array) => PdfReader },
): Promise<DocText> {
  if (ext === ".pdf") {
    const timeoutMs = hooks?.timeoutMs ?? PDF_PARSE_TIMEOUT_MS;
    const parser = hooks?.openPdf ? hooks.openPdf(bytes) : new PDFParse({ data: bytes });
    try {
      const { text } = await awaitWithin(parser.getText(), timeoutMs, new ExecutorOutputError("The PDF took too long to read."));
      return limitText(stripPageMarkers(text), maxChars);
    } catch (err) {
      if (err instanceof ExecutorOutputError) throw err;
      throw new ExecutorOutputError("The PDF could not be read. It may be scanned, encrypted or damaged.");
    } finally {
      await parser.destroy().catch(() => undefined);
    }
  }
  return limitText(new TextDecoder("utf-8").decode(bytes), maxChars);
}
