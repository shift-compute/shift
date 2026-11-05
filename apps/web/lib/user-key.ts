import "server-only";
import { openSecret, type User } from "@shift/core";
import { getConfig } from "./server";

/**
 * Decrypts the user's management key. Call it only where the key is about to be used and keep the result in a local
 * variable: never store it, log it, or put it in a response. Returns null when the user is not connected.
 */
export function openUserKey(user: User): string | null {
  if (!user.mkCiphertext || !user.mkIv || !user.mkAuthTag) return null;
  return openSecret(
    { ciphertext: Buffer.from(user.mkCiphertext), iv: Buffer.from(user.mkIv), authTag: Buffer.from(user.mkAuthTag) },
    getConfig().SHIFT_MASTER_KEY,
    user.accountAddress,
  );
}
