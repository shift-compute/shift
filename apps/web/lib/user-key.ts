import "server-only";
import { openRotatedSecret, type User } from "@shift/core";
import { getConfig, getDb } from "./server";

/**
 * Decrypts the user's management key. Call it only where the key is about to be used and keep the result in a local
 * variable: never store it, log it, or put it in a response. Returns null when the user is not connected.
 * A row that opens with SHIFT_MASTER_KEY_PREV is re-sealed with SHIFT_MASTER_KEY before this returns.
 */
export async function openUserKey(user: User): Promise<string | null> {
  if (!user.mkCiphertext || !user.mkIv || !user.mkAuthTag) return null;
  const config = getConfig();
  const opened = openRotatedSecret(
    { ciphertext: Buffer.from(user.mkCiphertext), iv: Buffer.from(user.mkIv), authTag: Buffer.from(user.mkAuthTag) },
    config.SHIFT_MASTER_KEY,
    config.SHIFT_MASTER_KEY_PREV,
    user.accountAddress,
  );
  if (opened.resealed) {
    await getDb().user.update({
      where: { id: user.id },
      data: { mkCiphertext: opened.resealed.ciphertext, mkIv: opened.resealed.iv, mkAuthTag: opened.resealed.authTag },
    });
  }
  return opened.plaintext;
}
