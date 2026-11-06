import { describe, expect, it } from "vitest";
import { openRotatedSecret, openSecret, sealSecret, VaultError } from "./vault";

const KEY = Buffer.alloc(32, 9).toString("base64");
const PREV = Buffer.alloc(32, 8).toString("base64");
const OTHER_KEY = Buffer.alloc(32, 10).toString("base64");
const MK = "mk-0123456789abcdefghijklmnopqrstuv";
const ACCOUNT = "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f";

describe("vault", () => {
  it("round-trips a secret", () => {
    expect(openSecret(sealSecret(MK, KEY), KEY)).toBe(MK);
  });

  it("round-trips with a context and handles non-ASCII text", () => {
    const sealed = sealSecret("clave-ñ-✓", KEY, ACCOUNT);
    expect(openSecret(sealed, KEY, ACCOUNT)).toBe("clave-ñ-✓");
  });

  it("uses a fresh 12-byte IV and a 16-byte tag every time", () => {
    const a = sealSecret(MK, KEY);
    const b = sealSecret(MK, KEY);
    expect(a.iv).toHaveLength(12);
    expect(a.authTag).toHaveLength(16);
    expect(a.iv.equals(b.iv)).toBe(false);
    expect(a.ciphertext.equals(b.ciphertext)).toBe(false);
  });

  it("does not store the plaintext", () => {
    const sealed = sealSecret(MK, KEY);
    expect(sealed.ciphertext.toString("utf8")).not.toContain("mk-");
    expect(sealed.ciphertext.includes(Buffer.from(MK))).toBe(false);
  });

  it("rejects a tampered ciphertext, IV or auth tag", () => {
    const sealed = sealSecret(MK, KEY);
    const flip = (b: Buffer) => Buffer.concat([Buffer.from([b[0]! ^ 1]), b.subarray(1)]);
    expect(() => openSecret({ ...sealed, ciphertext: flip(sealed.ciphertext) }, KEY)).toThrow(VaultError);
    expect(() => openSecret({ ...sealed, iv: flip(sealed.iv) }, KEY)).toThrow(VaultError);
    expect(() => openSecret({ ...sealed, authTag: flip(sealed.authTag) }, KEY)).toThrow(VaultError);
  });

  it("rejects the wrong master key", () => {
    expect(() => openSecret(sealSecret(MK, KEY), OTHER_KEY)).toThrow(VaultError);
  });

  it("binds the ciphertext to its context", () => {
    const sealed = sealSecret(MK, KEY, ACCOUNT);
    expect(() => openSecret(sealed, KEY, "0x0000000000000000000000000000000000000001")).toThrow(VaultError);
    expect(() => openSecret(sealed, KEY)).toThrow(VaultError);
    // The other direction: a seal with no account must not open under one.
    expect(() => openSecret(sealSecret(MK, KEY), KEY, ACCOUNT)).toThrow(VaultError);
  });

  it("rejects a truncated iv, a truncated tag and an empty ciphertext", () => {
    const sealed = sealSecret(MK, KEY, ACCOUNT);
    expect(() => openSecret({ ...sealed, iv: sealed.iv.subarray(0, 8) }, KEY, ACCOUNT)).toThrow(VaultError);
    expect(() => openSecret({ ...sealed, authTag: sealed.authTag.subarray(0, 8) }, KEY, ACCOUNT)).toThrow(VaultError);
    expect(() => openSecret({ ...sealed, ciphertext: Buffer.alloc(0) }, KEY, ACCOUNT)).toThrow(VaultError);
  });

  it("requires a master key of exactly 32 bytes", () => {
    expect(() => sealSecret(MK, Buffer.alloc(16).toString("base64"))).toThrow(VaultError);
    expect(() => sealSecret(MK, "not base64!!")).toThrow(VaultError);
    expect(() => openSecret(sealSecret(MK, KEY), "")).toThrow(VaultError);
  });

  it("never includes the secret or the key in error messages", () => {
    const sealed = sealSecret(MK, KEY, ACCOUNT);
    const flip = (b: Buffer) => Buffer.concat([Buffer.from([b[0]! ^ 1]), b.subarray(1)]);
    const attempts = [
      () => openSecret(sealed, OTHER_KEY, ACCOUNT),
      () => openSecret(sealed, KEY, "0x0000000000000000000000000000000000000001"),
      () => openSecret(sealed, KEY),
      () => openSecret({ ...sealed, ciphertext: flip(sealed.ciphertext) }, KEY, ACCOUNT),
      () => openSecret({ ...sealed, iv: flip(sealed.iv) }, KEY, ACCOUNT),
      () => openSecret({ ...sealed, authTag: flip(sealed.authTag) }, KEY, ACCOUNT),
      () => openSecret({ ...sealed, authTag: sealed.authTag.subarray(0, 8) }, KEY, ACCOUNT),
      () => sealSecret(MK, MK),
    ];
    for (const attempt of attempts) {
      try {
        attempt();
        expect.unreachable();
      } catch (err) {
        if (!(err instanceof VaultError)) throw err;
        const text = `${err.name}\n${err.message}\n${err.stack ?? ""}`;
        expect(text).not.toContain(MK);
        expect(text).not.toContain(KEY);
        expect(text).not.toContain(OTHER_KEY);
        expect(text).not.toContain(ACCOUNT);
      }
    }
  });

  it("re-seals a row that opens with the previous key", () => {
    const sealed = sealSecret(MK, PREV, ACCOUNT);
    const opened = openRotatedSecret(sealed, KEY, PREV, ACCOUNT);
    expect(opened.plaintext).toBe(MK);
    expect(opened.resealed).not.toBeNull();
    expect(openSecret(opened.resealed!, KEY, ACCOUNT)).toBe(MK);
    expect(() => openSecret(opened.resealed!, PREV, ACCOUNT)).toThrow(VaultError);
    const current = openRotatedSecret(sealSecret(MK, KEY, ACCOUNT), KEY, PREV, ACCOUNT);
    expect(current.plaintext).toBe(MK);
    expect(current.resealed).toBeNull();
  });

  it("still fails a wrong key", () => {
    expect(() => openRotatedSecret(sealSecret(MK, KEY, ACCOUNT), OTHER_KEY, PREV, ACCOUNT)).toThrow(VaultError);
    expect(() => openRotatedSecret(sealSecret(MK, KEY, ACCOUNT), OTHER_KEY, undefined, ACCOUNT)).toThrow(VaultError);
  });

  it("still fails a row bound to another account address", () => {
    const sealed = sealSecret(MK, PREV, ACCOUNT);
    const other = "0x0000000000000000000000000000000000000001";
    expect(() => openRotatedSecret(sealed, KEY, PREV, other)).toThrow(VaultError);
    expect(() => openRotatedSecret(sealed, PREV, KEY, other)).toThrow(VaultError);
  });
});
