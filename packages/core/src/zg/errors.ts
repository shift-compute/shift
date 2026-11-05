import { redact, redactString } from "../redact";

/** What went wrong, following the error table in plan §7.5. */
export type RouterErrorKind =
  | "insufficient_balance"
  | "credit_limit_exceeded"
  | "rate_limited"
  | "api_key_revoked"
  | "invalid_api_key"
  | "insufficient_scope"
  | "no_provider_for_trust_mode"
  | "balance_unavailable"
  | "model_not_capable"
  | "invalid_request"
  | "unexpected_response"
  | "network"
  | "server_error"
  | "unknown";

/** What the caller should do about it. */
export type RouterErrorAction =
  | "stop_user_batch"
  | "end_budget"
  | "retry_after"
  | "retry_backoff"
  | "expected_after_revoke"
  | "show_missing_scope"
  | "switch_provider_or_model"
  | "exclude_model_and_replan"
  | "fix_request"
  | "none";

interface Classification {
  kind: RouterErrorKind;
  action: RouterErrorAction;
  retryable: boolean;
}

const BY_CODE: Record<string, Classification> = {
  insufficient_balance: { kind: "insufficient_balance", action: "stop_user_batch", retryable: false },
  pay_no_balance: { kind: "insufficient_balance", action: "stop_user_batch", retryable: false },
  pay_insufficient_spendable: { kind: "insufficient_balance", action: "stop_user_batch", retryable: false },
  pay_debt_threshold: { kind: "insufficient_balance", action: "stop_user_batch", retryable: false },
  // The ephemeral key reached its cap: this is the normal end of the budget, not a failure.
  credit_limit_exceeded: { kind: "credit_limit_exceeded", action: "end_budget", retryable: false },
  fair_share_exceeded: { kind: "rate_limited", action: "retry_after", retryable: true },
  api_key_revoked: { kind: "api_key_revoked", action: "expected_after_revoke", retryable: false },
  invalid_api_key: { kind: "invalid_api_key", action: "none", retryable: false },
  insufficient_scope: { kind: "insufficient_scope", action: "show_missing_scope", retryable: false },
  no_provider_for_trust_mode: { kind: "no_provider_for_trust_mode", action: "switch_provider_or_model", retryable: false },
  vault_unavailable: { kind: "balance_unavailable", action: "retry_backoff", retryable: true },
  pay_gate_unavailable: { kind: "balance_unavailable", action: "retry_backoff", retryable: true },
  model_not_capable: { kind: "model_not_capable", action: "exclude_model_and_replan", retryable: false },
  model_format_mismatch: { kind: "model_not_capable", action: "exclude_model_and_replan", retryable: false },
};

function classify(status: number, code: string | undefined): Classification {
  if (code && BY_CODE[code]) return BY_CODE[code];
  if (status === 429) return { kind: "rate_limited", action: "retry_after", retryable: true };
  if (status === 401) return { kind: "invalid_api_key", action: "none", retryable: false };
  if (status === 402) return { kind: "insufficient_balance", action: "stop_user_batch", retryable: false };
  if (status === 403) return { kind: "insufficient_scope", action: "show_missing_scope", retryable: false };
  if (status >= 400 && status < 500) return { kind: "invalid_request", action: "fix_request", retryable: false };
  if (status >= 500) return { kind: "server_error", action: "retry_backoff", retryable: true };
  return { kind: "unknown", action: "none", retryable: false };
}

export interface RouterErrorInit {
  status: number;
  code?: string;
  message: string;
  requestId?: string;
  retryAfterMs?: number;
  /** Error body, already redacted. Useful for 4xx where the upstream explains the schema problem. */
  details?: unknown;
}

/** An error from the 0G Router. Never contains an API key: message and details are redacted. */
export class RouterError extends Error {
  readonly kind: RouterErrorKind;
  readonly action: RouterErrorAction;
  readonly retryable: boolean;
  readonly status: number;
  readonly code: string | undefined;
  readonly requestId: string | undefined;
  readonly retryAfterMs: number | undefined;
  readonly details: unknown;

  constructor(init: RouterErrorInit, override?: Classification) {
    const c = override ?? classify(init.status, init.code);
    super(redactString(init.message));
    this.name = "RouterError";
    this.kind = c.kind;
    this.action = c.action;
    this.retryable = c.retryable;
    this.status = init.status;
    this.code = init.code;
    this.requestId = init.requestId;
    this.retryAfterMs = init.retryAfterMs;
    this.details = redact(init.details);
  }

  /** A failure to reach the Router at all (DNS, connect, reset, timeout). `status` is 0. */
  static network(message: string): RouterError {
    return new RouterError({ status: 0, message }, { kind: "network", action: "retry_backoff", retryable: true });
  }

  /** The Router answered 2xx but the body does not match the shape verified in Phase 0. */
  static unexpected(path: string, problem: string, requestId?: string): RouterError {
    return new RouterError(
      { status: 200, message: `Unexpected response shape from ${path}: ${problem}`, ...(requestId ? { requestId } : {}) },
      { kind: "unexpected_response", action: "none", retryable: false },
    );
  }
}

/** Builds a RouterError from a non-2xx response body. Handles both `{error:{...}}` and `{_0g, error:{...}}` shapes. */
export function routerErrorFromResponse(status: number, body: unknown, requestId: string | undefined, retryAfterMs: number | undefined): RouterError {
  const err = (body as { error?: { code?: unknown; message?: unknown; metadata?: { raw?: unknown } } } | null)?.error;
  const code = typeof err?.code === "string" ? err.code : undefined;
  const message = typeof err?.message === "string" ? err.message : `HTTP ${status}`;
  return new RouterError({
    status,
    message,
    details: body,
    ...(code ? { code } : {}),
    ...(requestId ? { requestId } : {}),
    ...(retryAfterMs !== undefined ? { retryAfterMs } : {}),
  });
}
