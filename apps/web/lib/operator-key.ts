const OPERATOR_KEY = /^0x[0-9a-fA-F]{64}$/;

/** The storage signer is missing or not a private key. The message never includes the value. */
export class StorageKeyError extends Error {
  constructor() {
    super("OPERATOR_PRIVATE_KEY is missing or not a 0x-prefixed 32-byte hex key.");
    this.name = "StorageKeyError";
  }
}

/**
 * Operator key for 0G Storage uploads during a manual run.
 * It is intentionally not part of `WebConfig`: the rest of the web app must not see it.
 */
export function readOperatorKey(env: Record<string, string | undefined>): string {
  const value = env.OPERATOR_PRIVATE_KEY ?? "";
  if (!OPERATOR_KEY.test(value)) throw new StorageKeyError();
  return value;
}
