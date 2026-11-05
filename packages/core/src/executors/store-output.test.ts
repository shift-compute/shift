import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { storeTaskOutput } from "./store-output";
import type { StorageClient } from "../zg/storage";

function fakeStorage() {
  const uploads: Uint8Array[] = [];
  const client: StorageClient = {
    async upload(bytes) {
      uploads.push(bytes);
      return { rootHash: `0x${String(uploads.length).padStart(64, "0")}`, txHash: `0xtx${uploads.length}` };
    },
    async download() {
      throw new Error("not used");
    },
  };
  return { client, uploads };
}

describe("storeTaskOutput", () => {
  it("uploads files first and the document last, and the document references the file roots", async () => {
    const { client, uploads } = fakeStorage();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const out = await storeTaskOutput(
      client,
      { id: "t1", type: "IMAGE_FROM_PROMPT" },
      { result: { revisedPrompt: "p" }, files: [{ name: "image.png", mime: "image/png", bytes: png }], steps: [{ step: "image", model: "m", requestId: "r" }] },
      new Date("2026-11-06T23:10:00Z"),
    );

    expect(uploads).toHaveLength(2);
    expect(uploads[0]).toBe(png);
    expect(out.rootHash).toBe(`0x${"2".padStart(64, "0")}`);
    expect(out.document.files).toEqual([
      { name: "image.png", mime: "image/png", bytes: 4, sha256: createHash("sha256").update(png).digest("hex"), rootHash: `0x${"1".padStart(64, "0")}`, txHash: "0xtx1" },
    ]);
    expect(JSON.parse(new TextDecoder().decode(out.documentBytes))).toEqual(out.document);
    expect(out.document.createdAt).toBe("2026-11-06T23:10:00.000Z");
  });

  it("stores a text-only result with a single upload", async () => {
    const { client, uploads } = fakeStorage();
    const out = await storeTaskOutput(client, { id: "t2", type: "DOC_ANALYSIS" }, { result: { summary: "s" }, files: [], steps: [] });
    expect(uploads).toHaveLength(1);
    expect(out.document.files).toEqual([]);
  });

  it("stops before the document when a file upload fails", async () => {
    const calls: number[] = [];
    const client: StorageClient = {
      async upload() {
        calls.push(1);
        throw new Error("indexer down");
      },
      async download() {
        throw new Error("unused");
      },
    };
    await expect(storeTaskOutput(client, { id: "t3", type: "X" }, { result: {}, files: [{ name: "a", mime: "x", bytes: new Uint8Array([1]) }], steps: [] })).rejects.toThrow(/indexer down/);
    expect(calls).toHaveLength(1);
  });
});
