import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from "node:crypto";

/**
 * Personal task outputs on 0G Storage.
 * The per-user key is HKDF-SHA256(SHIFT_MASTER_KEY, account address), then AES-256-GCM,
 * the same construction as the management-key vault (12-byte IV, 16-byte tag, address as AAD).
 * The blob is what gets uploaded. The Merkle leaf stores that ciphertext root.
 */

const IV_BYTES = 12;
const TAG_BYTES = 16;
const KEY_BYTES = 32;
const MAGIC = Buffer.from("SHF1");
/** Domain separator so this key is not the raw master key the vault uses. */
const HKDF_SALT = Buffer.from("shift-output-hkdf-v1", "utf8");
const HKDF_INFO_PREFIX = "shift-personal-output-v1";

/** Deliberately vague: it must not reveal whether the key, the address or the bytes were wrong. */
export class OutputSealError extends Error {
  constructor() {
    super("Could not decrypt the output.");
    this.name = "OutputSealError";
  }
}

function parseMasterKey(masterKeyBase64: string): Buffer {
  const key = /^[A-Za-z0-9+/]+={0,2}$/.test(masterKeyBase64) ? Buffer.from(masterKeyBase64, "base64") : Buffer.alloc(0);
  if (key.length !== KEY_BYTES) throw new OutputSealError();
  return key;
}

function addressAad(accountAddress: string): Buffer {
  return Buffer.from(accountAddress.trim().toLowerCase(), "utf8");
}

/** 32-byte AES key for one 0G account. A different address derives a different key. */
export function deriveOutputKey(masterKeyBase64: string, accountAddress: string): Buffer {
  const info = Buffer.from(`${HKDF_INFO_PREFIX}:${accountAddress.trim().toLowerCase()}`, "utf8");
  return Buffer.from(hkdfSync("sha256", parseMasterKey(masterKeyBase64), HKDF_SALT, info, KEY_BYTES));
}

/** Encrypts bytes. The result is magic || iv || tag || ciphertext and does not contain the plaintext. */
export function sealOutput(plaintext: Uint8Array, masterKeyBase64: string, accountAddress: string): Uint8Array {
  const key = deriveOutputKey(masterKeyBase64, accountAddress);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const aad = addressAad(accountAddress);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([MAGIC, iv, tag, ciphertext]);
}

/** Decrypts a blob produced by {@link sealOutput}. A wrong address, key, or flipped byte fails closed. */
export function openOutput(blob: Uint8Array, masterKeyBase64: string, accountAddress: string): Uint8Array {
  const buf = Buffer.from(blob);
  const header = MAGIC.length + IV_BYTES + TAG_BYTES;
  if (buf.length < header || !buf.subarray(0, MAGIC.length).equals(MAGIC)) throw new OutputSealError();
  const iv = buf.subarray(MAGIC.length, MAGIC.length + IV_BYTES);
  const tag = buf.subarray(MAGIC.length + IV_BYTES, header);
  const ciphertext = buf.subarray(header);
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) throw new OutputSealError();
  try {
    const key = deriveOutputKey(masterKeyBase64, accountAddress);
    const decipher = createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAAD(addressAad(accountAddress));
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  } catch (err) {
    if (err instanceof OutputSealError) throw err;
    throw new OutputSealError();
  }
}
