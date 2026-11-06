import { describe, expect, it } from "vitest";
import { deriveOutputKey, openOutput, OutputSealError, sealOutput } from "./output-seal";

const KEY = Buffer.alloc(32, 9).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 10).toString("base64");
const ALICE = "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f";
const BOB = "0x0000000000000000000000000000000000000001";
const PLAIN = new TextEncoder().encode('{"summary":"only Alice"}');

describe("personal output seal", () => {
  it("round-trips bytes for the account that sealed them", () => {
    const sealed = sealOutput(PLAIN, KEY, ALICE);
    expect(Buffer.from(openOutput(sealed, KEY, ALICE.toUpperCase()))).toEqual(Buffer.from(PLAIN));
    expect(sealed.byteLength).toBeGreaterThan(PLAIN.byteLength);
    expect(Buffer.from(sealed).includes(Buffer.from("only Alice"))).toBe(false);
  });

  it("derives a different key per account, so another user cannot decrypt", () => {
    expect(deriveOutputKey(KEY, ALICE).equals(deriveOutputKey(KEY, BOB))).toBe(false);
    const sealed = sealOutput(PLAIN, KEY, ALICE);
    expect(() => openOutput(sealed, KEY, BOB)).toThrow(OutputSealError);
    expect(() => openOutput(sealed, OTHER_KEY, ALICE)).toThrow(OutputSealError);
  });

  it("rejects a tampered ciphertext, header, iv or tag", () => {
    const sealed = Buffer.from(sealOutput(PLAIN, KEY, ALICE));
    const flip = (at: number) => {
      const copy = Buffer.from(sealed);
      copy[at] = (copy[at] ?? 0) ^ 0xff;
      return copy;
    };
    expect(() => openOutput(flip(0), KEY, ALICE)).toThrow(OutputSealError);
    expect(() => openOutput(flip(5), KEY, ALICE)).toThrow(OutputSealError);
    expect(() => openOutput(flip(20), KEY, ALICE)).toThrow(OutputSealError);
    expect(() => openOutput(flip(sealed.length - 1), KEY, ALICE)).toThrow(OutputSealError);
    expect(() => openOutput(sealed.subarray(0, 10), KEY, ALICE)).toThrow(OutputSealError);
  });

  it("does not put the plaintext in the error", () => {
    try {
      openOutput(sealOutput(PLAIN, KEY, ALICE), KEY, BOB);
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(OutputSealError);
      expect(String(err)).not.toContain("only Alice");
      expect(String(err)).not.toContain(KEY);
    }
  });
});
