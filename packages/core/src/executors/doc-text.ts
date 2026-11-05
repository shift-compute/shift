import { PDFParse } from "pdf-parse";
import { MAX_DOC_CHARS } from "./doc-limits";
import { ExecutorOutputError } from "./json-output";

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

/** Extracts the text of an upload on the server: PDFs through pdf-parse, text and markdown as UTF-8. */
export async function extractDocText(bytes: Uint8Array, ext: string, maxChars = MAX_DOC_CHARS): Promise<DocText> {
  if (ext === ".pdf") {
    const parser = new PDFParse({ data: bytes });
    try {
      const { text } = await parser.getText();
      return limitText(stripPageMarkers(text), maxChars);
    } catch (err) {
      if (err instanceof ExecutorOutputError) throw err;
      throw new ExecutorOutputError("The PDF could not be read. It may be scanned, encrypted or damaged.");
    } finally {
      await parser.destroy();
    }
  }
  return limitText(new TextDecoder("utf-8").decode(bytes), maxChars);
}
