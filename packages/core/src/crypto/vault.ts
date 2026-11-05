import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/** What gets stored for an encrypted secret (maps to User.mkCiphertext / mkIv / mkAuthTag). */
export interface SealedSecret {
  ciphertext: Buffer;
  /** 12 random bytes, unique per encryption. */
  iv: Buffer;
  /** 16-byte GCM authentication tag. */
  authTag: Buffer;
}

/** Deliberately vague: it must not reveal whether the key, the data or the context was wrong. */
export class VaultError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "VaultError";
  }
}

const IV_BYTES = 12;
const KEY_BYTES = 32;

function parseMasterKey(masterKeyBase64: string): Buffer {
  const key = /^[A-Za-z0-9+/]+={0,2}$/.test(masterKeyBase64) ? Buffer.from(masterKeyBase64, "base64") : Buffer.alloc(0);
  if (key.length !== KEY_BYTES) throw new VaultError("The master key must be base64 of exactly 32 bytes.");
  return key;
}

/**
 * Encrypts a secret with AES-256-GCM. `context` (e.g. the account address) is authenticated but not stored:
 * a ciphertext copied to another user's row fails to decrypt.
 */
export function sealSecret(plaintext: string, masterKeyBase64: string, context?: string): SealedSecret {
  const key = parseMasterKey(masterKeyBase64);
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  if (context !== undefined) cipher.setAAD(Buffer.from(context, "utf8"));
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

/** Decrypts a secret. Keep the result in memory only: never write it to disk, logs or responses. */
export function openSecret(sealed: SealedSecret, masterKeyBase64: string, context?: string): string {
  const key = parseMasterKey(masterKeyBase64);
  try {
    const decipher = createDecipheriv("aes-256-gcm", key, sealed.iv);
    if (context !== undefined) decipher.setAAD(Buffer.from(context, "utf8"));
    decipher.setAuthTag(sealed.authTag);
    return Buffer.concat([decipher.update(sealed.ciphertext), decipher.final()]).toString("utf8");
  } catch {
    throw new VaultError("Could not decrypt the secret.");
  }
}
