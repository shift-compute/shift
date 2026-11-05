import { describe, expect, it } from "vitest";
import { checkUpload, imagePromptSchema } from "./task-input";

const bytes = (...b: number[]) => new Uint8Array(b);
const text = (s: string) => new TextEncoder().encode(s);

describe("checkUpload", () => {
  it("accepts a pdf by signature and extension", () => {
    expect(checkUpload("DOC_ANALYSIS", "Report.PDF", text("%PDF-1.7 ..."))).toEqual({ ok: true, mime: "application/pdf", ext: ".pdf" });
  });

  it("accepts mp3 with an ID3 tag or a frame sync, and wav and m4a", () => {
    expect(checkUpload("AUDIO_SUMMARY", "a.mp3", text("ID3\u0004")).ok).toBe(true);
    expect(checkUpload("AUDIO_SUMMARY", "a.mp3", bytes(0xff, 0xfb, 0x90)).ok).toBe(true);
    expect(checkUpload("AUDIO_SUMMARY", "a.wav", text("RIFF\0\0\0\0WAVEfmt ")).ok).toBe(true);
    expect(checkUpload("AUDIO_SUMMARY", "a.m4a", bytes(0, 0, 0, 0x20, 0x66, 0x74, 0x79, 0x70)).ok).toBe(true);
  });

  it("rejects a type that belongs to another task", () => {
    const r = checkUpload("AUDIO_SUMMARY", "notes.pdf", text("%PDF-"));
    expect(r).toMatchObject({ ok: false, error: "unsupported_type" });
  });

  it("rejects empty, oversized and renamed files", () => {
    expect(checkUpload("DOC_ANALYSIS", "a.txt", new Uint8Array(0))).toMatchObject({ error: "empty_file" });
    expect(checkUpload("DOC_ANALYSIS", "a.txt", new Uint8Array(5 * 1024 * 1024 + 1).fill(97))).toMatchObject({ error: "file_too_large" });
    expect(checkUpload("DOC_ANALYSIS", "a.pdf", text("just text"))).toMatchObject({ error: "content_mismatch" });
    expect(checkUpload("DOC_ANALYSIS", "a.txt", bytes(104, 0, 105))).toMatchObject({ error: "content_mismatch" });
  });

  it("allows audio up to 10 MB", () => {
    const big = new Uint8Array(10 * 1024 * 1024);
    big.set(text("RIFF\0\0\0\0WAVE"));
    expect(checkUpload("AUDIO_SUMMARY", "a.wav", big).ok).toBe(true);
  });
});

describe("imagePromptSchema", () => {
  it("trims, defaults the priority, and bounds the length", () => {
    expect(imagePromptSchema.parse({ prompt: "  a lighthouse at dusk  " })).toEqual({ prompt: "a lighthouse at dusk", priority: 2 });
    expect(imagePromptSchema.safeParse({ prompt: "hi" }).success).toBe(false);
    expect(imagePromptSchema.safeParse({ prompt: "x".repeat(1001) }).success).toBe(false);
    expect(imagePromptSchema.safeParse({ prompt: "valid prompt", priority: 4 }).success).toBe(false);
  });
});
