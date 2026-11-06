import { describe, expect, it, vi } from "vitest";
import { runDocAnalysis } from "./doc-analysis";
import { extractDocText, limitText } from "./doc-text";
import { ExecutorOutputError } from "./json-output";
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
    expect(out.steps).toEqual([{ step: "analyze", model: "m", trust: "verified", requestId: "req-1" }]);
    expect(chat.mock.calls[0]![2]).toEqual({ trustMode: "verified", clientRequestId: "t9-1-analyze" });
    expect(chat.mock.calls[0]![1].max_tokens).toBe(900);
  });

  it("reads a chat completion and drops fields the schema does not declare", async () => {
    const chat = vi.fn().mockResolvedValue({
      data: {
        id: "chatcmpl-9",
        object: "chat.completion",
        created: 1677652288,
        model: "m",
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: '{"summary":"A contract.","actionItems":["Sign"],"risks":["Deadline"],"confidence":0.9}' },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 40, completion_tokens: 20, total_tokens: 60 },
      },
      status: 200,
      requestId: "req-9",
    });
    const ctx: ExecutorContext = { router: { chat } as unknown as ExecutorContext["router"], sk: "sk-x", models: { chat: "m" }, trustMode: "private", taskId: "t9", attempt: 1 };
    const out = await runDocAnalysis(ctx, { text: "body", chars: 4, truncated: false });
    expect(out.result).toEqual({ summary: "A contract.", actionItems: ["Sign"], risks: ["Deadline"], truncated: false, chars: 4 });
    expect(out.result).not.toHaveProperty("confidence");
  });

  it("rejects partial and ill-typed chat bodies without echoing a leaked key", async () => {
    const leaked = "mk-0123456789abcdefghijklmnopqrstuv";
    const run = (data: unknown) => {
      const chat = vi.fn().mockResolvedValue({ data, status: 200, requestId: "req-bad" });
      const ctx: ExecutorContext = { router: { chat } as unknown as ExecutorContext["router"], sk: "sk-x", models: { chat: "m" }, trustMode: "private", taskId: "t9", attempt: 1 };
      return runDocAnalysis(ctx, { text: "body", chars: 4, truncated: false });
    };

    await expect(run({ id: "chatcmpl-1", object: "chat.completion" })).rejects.toBeInstanceOf(ExecutorOutputError);
    await expect(run({ choices: [{ index: 0, finish_reason: "length" }] })).rejects.toBeInstanceOf(ExecutorOutputError);
    await expect(run({ choices: [{ message: { content: "" } }] })).rejects.toThrow(/empty/);
    await expect(run({ choices: [{ message: { content: '{"summary":"s","actionItems":"sign","risks":[]}' } }] })).rejects.toThrow(/actionItems/);
    await expect(run({ choices: [{ message: { content: '{"summary":"","actionItems":[],"risks":[]}' } }] })).rejects.toThrow(/summary/);

    try {
      await run({ choices: [{ message: { content: `see ${leaked}` } }] });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ExecutorOutputError);
      expect(String(err)).not.toContain(leaked);
    }
  });
});

