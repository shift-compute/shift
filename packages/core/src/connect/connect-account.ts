import { sealSecret, type SealedSecret } from "../crypto/vault";
import { RouterError } from "../zg/errors";
import { withEphemeralKey } from "../zg/ephemeral-keys";
import type { RouterClient } from "../zg/router";

/** Scopes Shift asks the user for (plan §7.2). `keys:read` is deliberately not requested. */
export type RequiredScope = "account:read" | "keys:create" | "keys:manage";

const MIN_KEY_LENGTH = 20;

export type ConnectResult =
  | {
      ok: true;
      account: { address: string; currency: string; creditBalance: string; depositBalance: string };
      /** The management key encrypted for storage. The plaintext key is never part of the result. */
      sealed: SealedSecret;
    }
  | {
      ok: false;
      reason: "invalid_format" | "invalid_key" | "missing_scopes";
      missingScopes: RequiredScope[];
      /** Set when the probe key was created but could not be revoked: the user must revoke it by hand. */
      leftoverKeyId?: string;
    };

export type ConnectClient = Pick<RouterClient, "getAccount" | "getBalance" | "createApiKey" | "revokeApiKey">;

/**
 * The Router rejects a `credit_limit` below its minimum (verified: 100000000000000 wei = 0.0001 0G for 0G accounts),
 * so the probe key asks for the smallest accepted cap. The USD minimum is not verified yet; 0.01 is a safe guess.
 */
export function probeBudget(currency: string): string {
  return currency.toLowerCase() === "usd" ? "0.01" : "0.0001";
}

export function isPlausibleManagementKey(mk: string): boolean {
  return mk.startsWith("mk-") && mk.length >= MIN_KEY_LENGTH && /^[A-Za-z0-9._-]+$/.test(mk);
}

/**
 * Validates a management key and prepares it for storage (plan §8.1):
 * format → account and balance reads → probe of `keys:create` and `keys:manage` by creating and revoking
 * a throwaway key → encryption. Nothing is spent: the probe key is created with a minimal cap and revoked at once.
 * Other Router failures (network, rate limits, server errors) are thrown as RouterError.
 */
export async function connectAccount(client: ConnectClient, mk: string, masterKeyBase64: string, now: () => number = Date.now): Promise<ConnectResult> {
  if (!isPlausibleManagementKey(mk)) return { ok: false, reason: "invalid_format", missingScopes: [] };

  const missing: RequiredScope[] = [];
  let address: string | undefined;
  let currency = "";
  let creditBalance = "";
  let depositBalance = "";

  try {
    address = (await client.getAccount(mk)).data.address;
    const balance = (await client.getBalance(mk)).data;
    currency = balance.currency;
    creditBalance = balance.credit_balance;
    depositBalance = balance.deposit_balance;
  } catch (err) {
    if (err instanceof RouterError && err.kind === "invalid_api_key") return { ok: false, reason: "invalid_key", missingScopes: [] };
    if (err instanceof RouterError && err.kind === "insufficient_scope") missing.push("account:read");
    else throw err;
  }

  // The probe distinguishes the two key scopes: a 403 on creation means `keys:create`, a 403 on revocation means `keys:manage`.
  let leftoverKeyId: string | undefined;
  let revokeError: unknown;
  try {
    const run = await withEphemeralKey(
      client,
      { mk, nightId: "probe", runId: String(now()), budget: probeBudget(currency) },
      { onCreated: async () => {}, onRevokeFailed: async (_record, err) => void (revokeError = err) },
      async () => undefined,
      { attempts: 1 },
    );
    if (!run.revoked) {
      leftoverKeyId = run.keyId;
      // Only a permission problem means the scope is missing; anything else (network, server) must not be blamed on the user.
      if (revokeError instanceof RouterError && revokeError.kind === "insufficient_scope") missing.push("keys:manage");
      else throw revokeError;
    }
  } catch (err) {
    if (err instanceof RouterError && err.kind === "insufficient_scope" && !leftoverKeyId) missing.push("keys:create");
    else if (err instanceof RouterError && err.kind === "invalid_api_key") return { ok: false, reason: "invalid_key", missingScopes: [] };
    else throw err;
  }
  if (missing.length > 0) {
    return { ok: false, reason: "missing_scopes", missingScopes: missing, ...(leftoverKeyId ? { leftoverKeyId } : {}) };
  }
  if (!address) return { ok: false, reason: "invalid_key", missingScopes: [] };

  // Binding the ciphertext to the account address means it cannot be copied to another user's row.
  return { ok: true, account: { address, currency, creditBalance, depositBalance }, sealed: sealSecret(mk, masterKeyBase64, address.toLowerCase()) };
}
