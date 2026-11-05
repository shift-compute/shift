import { describe, expect, it, vi } from "vitest";
import { runDocAnalysis } from "./doc-analysis";
import { extractDocText, limitText } from "./doc-text";
import type { ExecutorContext } from "./types";

const text = (s: string) => new TextEncoder().encode(s);

// A tiny valid PDF with one line of text, built by hand so the test needs no fixture file.
function tinyPdf(line: string): Uint8Array {
  const stream = `BT /F1 18 Tf 20 100 Td (${line}) Tj ET`;
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 200] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let out = "%PDF-1.4\n";
  const offs: number[] = [];
  objs.forEach((o, i) => {
    offs.push(out.length);
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = out.length;
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offs.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}`;
  out += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new Uint8Array(Buffer.from(out, "latin1"));
}

describe("limitText", () => {
  it("normalizes whitespace and flags truncation", () => {
    expect(limitText("a  \r\n\r\n\r\n\r\nb")).toEqual({ text: "a\n\nb", chars: 4, truncated: false });
    expect(limitText("x".repeat(30), 10)).toEqual({ text: "x".repeat(10), chars: 30, truncated: true });
  });

  it("rejects documents without text", () => {
    expect(() => limitText("  \n ")).toThrow(/No readable text/);
  });
});

describe("extractDocText", () => {
  it("reads txt and md as UTF-8", async () => {
    expect((await extractDocText(text("# Título\nhola"), ".md")).text).toBe("# Título\nhola");
  });

  it("extracts the text of a pdf without page markers", async () => {
    const out = await extractDocText(tinyPdf("Hello Shift night run"), ".pdf");
    expect(out.text).toBe("Hello Shift night run");
  });

  it("gives a plain message for a damaged pdf", async () => {
    await expect(extractDocText(text("%PDF-1.4 garbage"), ".pdf")).rejects.toThrow(/could not be read/);
  });
});

describe("runDocAnalysis", () => {
  it("returns the analysis with the truncation flag and one recorded step", async () => {
    const chat = vi.fn().mockResolvedValue({
      data: { choices: [{ message: { content: '{"summary":"s","actionItems":["a"]}' } }] },
      status: 200,
      requestId: "req-1",
    });
    const ctx: ExecutorContext = { router: { chat } as unknown as ExecutorContext["router"], sk: "sk-x", models: { chat: "m" }, trustMode: "verified", taskId: "t9", attempt: 1 };
    const out = await runDocAnalysis(ctx, { text: "body", chars: 99, truncated: true });

    expect(out.result).toEqual({ summary: "s", actionItems: ["a"], risks: [], truncated: true, chars: 99 });
    expect(out.steps).toEqual([{ step: "analyze", model: "m", requestId: "req-1" }]);
    expect(chat.mock.calls[0]![2]).toEqual({ trustMode: "verified", clientRequestId: "t9-1-analyze" });
  });
});

