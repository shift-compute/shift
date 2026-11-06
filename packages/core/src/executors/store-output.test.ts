import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { openOutput, OutputSealError } from "../crypto/output-seal";
import { openStoredTaskOutput, storeTaskOutput } from "./store-output";
import type { StorageClient } from "../zg/storage";

const KEY = Buffer.alloc(32, 4).toString("base64");
const ALICE = "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f";
const BOB = "0x0000000000000000000000000000000000000002";

function fakeStorage() {
  const uploads: Uint8Array[] = [];
  const byRoot = new Map<string, Uint8Array>();
  const client: StorageClient = {
    async upload(bytes) {
      uploads.push(bytes);
      const rootHash = `0x${createHash("sha256").update(bytes).digest("hex")}`;
      byRoot.set(rootHash, bytes);
      return { rootHash, txHash: `0xtx${uploads.length}` };
    },
    async download(rootHash) {
      const bytes = byRoot.get(rootHash);
      if (!bytes) throw new Error(`missing ${rootHash}`);
      return bytes;
    },
  };
  return { client, uploads, byRoot };
}

const key = { masterKey: KEY, accountAddress: ALICE };

describe("storeTaskOutput", () => {
  it("uploads ciphertext for the file and the document, and the leaf root opens back to the result", async () => {
    const { client, uploads } = fakeStorage();
    const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47]);
    const out = await storeTaskOutput(
      client,
      { id: "t1", type: "IMAGE_FROM_PROMPT" },
      { result: { revisedPrompt: "p" }, files: [{ name: "image.png", mime: "image/png", bytes: png }], steps: [{ step: "image", model: "m", requestId: "r" }] },
      { ...key, now: new Date("2026-11-06T23:10:00Z") },
    );

    expect(uploads).toHaveLength(2);
    expect(Buffer.from(uploads[0]!).equals(Buffer.from(png))).toBe(false);
    expect(Buffer.from(uploads[0]!).includes(Buffer.from(png))).toBe(false);
    expect(Buffer.from(openOutput(uploads[0]!, KEY, ALICE))).toEqual(Buffer.from(png));
    const documentPlain = openOutput(uploads[1]!, KEY, ALICE);
    expect(JSON.parse(new TextDecoder().decode(documentPlain))).toEqual(out.document);
    expect(out.document.files[0]).toMatchObject({
      name: "image.png",
      mime: "image/png",
      bytes: 4,
      sha256: createHash("sha256").update(png).digest("hex"),
    });
    expect(out.document.files[0]?.rootHash).toBe(`0x${createHash("sha256").update(uploads[0]!).digest("hex")}`);
    expect(out.rootHash).toBe(`0x${createHash("sha256").update(uploads[1]!).digest("hex")}`);
    expect(out.document.createdAt).toBe("2026-11-06T23:10:00.000Z");

    const opened = await openStoredTaskOutput(client, out.rootHash, key);
    expect(opened.result).toEqual({ revisedPrompt: "p" });
    expect(opened.sealed).toBe(true);
    expect(Buffer.from(opened.files[0]!.dataBase64, "base64")).toEqual(Buffer.from(png));
  });

  it("stores a text-only result as one ciphertext upload", async () => {
    const { client, uploads } = fakeStorage();
    const out = await storeTaskOutput(client, { id: "t2", type: "DOC_ANALYSIS" }, { result: { summary: "s" }, files: [], steps: [] }, key);
    expect(uploads).toHaveLength(1);
    expect(out.document.files).toEqual([]);
    expect(new TextDecoder().decode(uploads[0]!)).not.toContain("summary");
    const opened = await openStoredTaskOutput(client, out.rootHash, key);
    expect(opened).toMatchObject({ taskId: "t2", type: "DOC_ANALYSIS", result: { summary: "s" }, files: [] });
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
    await expect(
      storeTaskOutput(client, { id: "t3", type: "X" }, { result: {}, files: [{ name: "a", mime: "x", bytes: new Uint8Array([1]) }], steps: [] }, key),
    ).rejects.toThrow(/indexer down/);
    expect(calls).toHaveLength(1);
  });

  it("refuses another account and a tampered ciphertext", async () => {
    const { client, byRoot } = fakeStorage();
    const out = await storeTaskOutput(client, { id: "t4", type: "DOC_ANALYSIS" }, { result: { summary: "secret" }, files: [], steps: [] }, key);
    await expect(openStoredTaskOutput(client, out.rootHash, { masterKey: KEY, accountAddress: BOB })).rejects.toThrow(OutputSealError);

    const blob = byRoot.get(out.rootHash);
    if (!blob) throw new Error("missing blob");
    const tampered = Buffer.from(blob);
    tampered[tampered.length - 1] = (tampered[tampered.length - 1] ?? 0) ^ 0xff;
    byRoot.set(out.rootHash, tampered);
    await expect(openStoredTaskOutput(client, out.rootHash, key)).rejects.toThrow(OutputSealError);
  });
});
