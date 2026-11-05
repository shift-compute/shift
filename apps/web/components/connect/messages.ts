/** Scope names as the 0G console shows them, so users can match what they tick. */
export const SCOPE_LABELS: Record<string, string> = {
  "account:read": "Read account (account:read)",
  "keys:create": "Create keys (keys:create)",
  "keys:manage": "Revoke / update (keys:manage)",
};

/** Shape of the JSON errors returned by POST /api/connect. */
export interface ConnectErrorBody {
  error?: string;
  missingScopes?: string[];
  leftoverKeyId?: string | null;
  retryAfterSeconds?: number;
}

export interface ErrorMessage {
  title: string;
  detail: string;
  /** Scopes the user still has to tick, in console wording. */
  missingScopes?: string[];
}

export function describeConnectError(status: number, body: ConnectErrorBody | null): ErrorMessage {
  switch (body?.error) {
    case "missing_scopes": {
      const scopes = (body.missingScopes ?? []).map((s) => SCOPE_LABELS[s] ?? s);
      const leftover = body.leftoverKeyId
        ? ` A test key (${body.leftoverKeyId}) could not be revoked; please revoke it under API Keys in the console.`
        : "";
      return {
        title: "This key is missing permissions",
        detail: `Create a new management key with the Custom preset and tick exactly the three permissions below.${leftover}`,
        missingScopes: scopes,
      };
    }
    case "invalid_key_format":
      return { title: "That does not look like a management key", detail: "Management keys start with mk-. API keys that start with sk- cannot be used here." };
    case "invalid_key":
      return { title: "The 0G Router did not accept this key", detail: "Check that you copied the whole key and that it has not been revoked." };
    case "rate_limited":
      return { title: "Too many attempts", detail: `Wait ${body.retryAfterSeconds ?? 60} seconds and try again.` };
    case "router_unavailable":
      return { title: "We could not reach the 0G Router", detail: "This is usually temporary. Your key was not stored; try again in a moment." };
    default:
      return { title: "Something went wrong", detail: status >= 500 ? "Your key was not stored. Try again in a moment." : "The request was not accepted." };
  }
}

/** Short form of an address for display: 0x1234…abcd. */
export function shortAddress(address: string): string {
  return address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
}
