import { describe, expect, it } from "vitest";
import { ExecutorOutputError } from "./json-output";
import { PDF_PARSE_TIMEOUT_MS, extractDocText } from "./doc-text";

describe("extractDocText", () => {
  it("reads text and markdown as UTF-8", async () => {
    const text = await extractDocText(new TextEncoder().encode("Hello\r\n\r\n\r\nthere"), ".txt");
    expect(text).toEqual({ text: "Hello\n\nthere", chars: "Hello\n\nthere".length, truncated: false });
    const md = await extractDocText(new TextEncoder().encode("# Title"), ".md");
    expect(md.text).toBe("# Title");
  });

  it("uses a 30 second budget for a PDF", () => {
    expect(PDF_PARSE_TIMEOUT_MS).toBe(30_000);
  });

  it("returns text when the PDF parse finishes inside the budget", async () => {
    const doc = await extractDocText(new Uint8Array([1]), ".pdf", 100, {
      timeoutMs: 1_000,
      openPdf: () => ({
        getText: async () => ({ text: "Hello from the pdf\n-- 1 of 1 --" }),
        destroy: async () => undefined,
      }),
    });
    expect(doc.text).toBe("Hello from the pdf");
  });

  it("abandons a PDF parse that does not finish", async () => {
    let destroyed = false;
    const started = Date.now();
    await expect(
      extractDocText(new Uint8Array([1]), ".pdf", 100, {
        timeoutMs: 30,
        openPdf: () => ({
          getText: () => new Promise(() => undefined),
          destroy: async () => {
            destroyed = true;
          },
        }),
      }),
    ).rejects.toThrow(ExecutorOutputError);
    await expect(
      extractDocText(new Uint8Array([1]), ".pdf", 100, {
        timeoutMs: 20,
        openPdf: () => ({
          getText: () => new Promise(() => undefined),
          destroy: async () => undefined,
        }),
      }),
    ).rejects.toThrow(/too long/);
    expect(Date.now() - started).toBeLessThan(1_000);
    expect(destroyed).toBe(true);
  });
});