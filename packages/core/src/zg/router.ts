import { z } from "zod";
import { RouterError, routerErrorFromResponse } from "./errors";
import {
  accountSchema,
  apiKeyCreatedSchema,
  apiKeyRevokedSchema,
  balanceSchema,
  decisionsResponseSchema,
  fundsSchema,
  modelsListSchema,
  traceSchema,
  usageHistorySchema,
  type Account,
  type ApiKeyCreated,
  type Balance,
  type DecisionsResponse,
  type Funds,
  type Model,
  type Trace,
  type UsageRow,
} from "./schemas";

export type TrustMode = "private" | "verified" | "standard";

export interface RouterClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  /** Retries for 429 rate limits and 503 balance-read failures (plan §7.5: at most 3). */
  maxRetries?: number;
  timeoutMs?: number;
}

export interface RouterResponse<T> {
  data: T;
  status: number;
  /** The Router's official request ID (a UUID, also in `x_0g_trace.request_id`). Always store it. */
  requestId?: string;
  /** The raw `X-Request-ID` header, which arrives as "<gateway trace id>, <router request id>". */
  requestIdRaw?: string;
  /** Parsed `x_0g_trace` when the response carries one. */
  trace?: Trace;
}

export interface InferenceOptions {
  trustMode?: TrustMode;
  /** Sent as `X-Client-Request-Id` (≤ 512 ASCII chars) to track abandoned requests. */
  clientRequestId?: string;
}

interface CallOptions<T> {
  key?: string;
  body?: unknown;
  form?: FormData;
  schema: z.ZodType<T>;
  trustMode?: TrustMode;
  clientRequestId?: string;
}

// Errors that happen before the request leaves the machine: retrying can never duplicate a charge or a key.
const PRE_SEND_CODES = new Set(["UND_ERR_CONNECT_TIMEOUT", "ENOTFOUND", "EAI_AGAIN"]);
const MAX_NETWORK_RETRIES = 5;
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

// Loose on purpose: chat is OpenAI-compatible, but a real paid call is still pending (U3/U8).
const chatResponseSchema = z.looseObject({
  choices: z.array(z.looseObject({ message: z.looseObject({ content: z.string().nullable().optional() }) })),
});
const looseSchema = z.looseObject({});

export type ChatResponse = z.infer<typeof chatResponseSchema>;

export interface ChatRequest {
  model: string;
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>;
  max_tokens?: number;
  verify_tee?: boolean;
  [extra: string]: unknown;
}

/** A decision question. `criteria` is a label → description map (or a list of labels) for `choice`, a list of level descriptions for `score`. */
export interface DecisionQuestion {
  type: "choice" | "score" | "noul";
  instructions: string;
  criteria?: Record<string, string> | string[];
}

export interface DecisionsRequest {
  model: string;
  state: string;
  questions: Record<string, DecisionQuestion>;
}

export function extractRequestId(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  return parts.find((p) => UUID_RE.test(p)) ?? parts.at(-1);
}

function parseRetryAfter(value: string | null): number | undefined {
  if (!value) return undefined;
  const seconds = Number(value);
  const ms = Number.isFinite(seconds) ? seconds * 1000 : Date.parse(value) - Date.now();
  return Number.isFinite(ms) ? Math.min(Math.max(ms, 0), 60_000) : undefined;
}

function causeCode(err: unknown): string | undefined {
  const cause = (err as { cause?: { code?: unknown } } | null)?.cause;
  return typeof cause?.code === "string" ? cause.code : undefined;
}

export function createRouterClient(options: RouterClientOptions) {
  const base = options.baseUrl.replace(/\/+$/, "");
  const doFetch = options.fetchImpl ?? fetch;
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  const maxRetries = options.maxRetries ?? 3;
  const timeoutMs = options.timeoutMs ?? 120_000;

  async function call<T>(method: string, path: string, opts: CallOptions<T>): Promise<RouterResponse<T>> {
    const headers: Record<string, string> = {};
    if (opts.key) headers["Authorization"] = `Bearer ${opts.key}`;
    if (opts.trustMode) headers["X-0G-Provider-Trust-Mode"] = opts.trustMode;
    if (opts.clientRequestId !== undefined) {
      if (opts.clientRequestId.length === 0 || opts.clientRequestId.length > 512 || /[^\x20-\x7e]/.test(opts.clientRequestId)) {
        throw new TypeError("clientRequestId must be 1-512 printable ASCII characters");
      }
      headers["X-Client-Request-Id"] = opts.clientRequestId;
    }
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    const idempotent = method === "GET" || method === "DELETE";

    let networkRetries = 0;
    let retries = 0;
    for (;;) {
      let res: Response;
      try {
        res = await doFetch(`${base}${path}`, { method, headers, body, signal: AbortSignal.timeout(timeoutMs) });
      } catch (err) {
        const code = causeCode(err);
        // After a POST may have left the machine a retry could charge twice, so only pre-send failures are retried there.
        const safe = (code !== undefined && PRE_SEND_CODES.has(code)) || (idempotent && code !== undefined);
        if (safe && networkRetries < MAX_NETWORK_RETRIES) {
          networkRetries++;
          await sleep(1000 * networkRetries);
          continue;
        }
        throw RouterError.network(`${method} ${path} failed (${code ?? (err instanceof Error ? err.name : "unknown")})`);
      }

      const text = await res.text();
      let parsed: unknown = null;
      try {
        parsed = text.length ? JSON.parse(text) : null;
      } catch {
        parsed = text;
      }
      const requestIdRaw = res.headers.get("x-request-id") ?? undefined;
      const requestId = extractRequestId(requestIdRaw);

      if (!res.ok) {
        const err = routerErrorFromResponse(res.status, parsed, requestId, parseRetryAfter(res.headers.get("retry-after")));
        const worthRetrying = err.kind === "rate_limited" || err.kind === "balance_unavailable";
        if (worthRetrying && retries < maxRetries) {
          retries++;
          await sleep(err.retryAfterMs ?? 1000 * 2 ** retries);
          continue;
        }
        throw err;
      }

      const checked = opts.schema.safeParse(parsed);
      if (!checked.success) {
        throw RouterError.unexpected(path, checked.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`).join("; "), requestId);
      }
      const traceRaw = (parsed as { x_0g_trace?: unknown } | null)?.x_0g_trace;
      const trace = traceRaw === undefined ? undefined : traceSchema.safeParse(traceRaw);
      return {
        data: checked.data,
        status: res.status,
        ...(requestId ? { requestId } : {}),
        ...(requestIdRaw ? { requestIdRaw } : {}),
        ...(trace?.success ? { trace: trace.data } : {}),
      };
    }
  }

  const infer = (o?: InferenceOptions) => ({
    ...(o?.trustMode ? { trustMode: o.trustMode } : {}),
    ...(o?.clientRequestId !== undefined ? { clientRequestId: o.clientRequestId } : {}),
  });

  return {
    /** Catalog and prices. Works without a key; with one it may include more detail. */
    async listModels(key?: string): Promise<RouterResponse<Model[]>> {
      const r = await call("GET", "/models", { ...(key ? { key } : {}), schema: modelsListSchema });
      return { ...r, data: r.data.data };
    },

    // ---- management key (mk-) ----
    getAccount: (mk: string): Promise<RouterResponse<Account>> => call("GET", "/account", { key: mk, schema: accountSchema }),
    getBalance: (mk: string): Promise<RouterResponse<Balance>> => call("GET", "/account/balance", { key: mk, schema: balanceSchema }),
    getFunds: (mk: string): Promise<RouterResponse<Funds>> => call("GET", "/account/funds", { key: mk, schema: fundsSchema }),
    async getUsageHistory(mk: string, query: { limit?: number } = {}): Promise<RouterResponse<UsageRow[]>> {
      const qs = query.limit ? `?limit=${query.limit}` : "";
      const r = await call("GET", `/account/usage/history${qs}`, { key: mk, schema: usageHistorySchema });
      return { ...r, data: r.data.data };
    },
    /** Creates an ephemeral sk- key. The returned `key` is the only copy of the secret: never log it. */
    createApiKey(
      mk: string,
      params: { name: string; trustMode: TrustMode; creditLimit?: string },
    ): Promise<RouterResponse<ApiKeyCreated>> {
      return call("POST", "/api-keys", {
        key: mk,
        schema: apiKeyCreatedSchema,
        // `credit_limit` is a string in 0G units; a JSON number is rejected by the Router.
        body: { name: params.name, trust_mode: params.trustMode, ...(params.creditLimit !== undefined ? { credit_limit: params.creditLimit } : {}) },
      });
    },
    revokeApiKey: (mk: string, keyId: string) =>
      call("DELETE", `/api-keys/${encodeURIComponent(keyId)}`, { key: mk, schema: apiKeyRevokedSchema }),

    // ---- inference key (sk-) ----
    chat: (sk: string, body: ChatRequest, o?: InferenceOptions): Promise<RouterResponse<ChatResponse>> =>
      call("POST", "/chat/completions", { key: sk, body, schema: chatResponseSchema, ...infer(o) }),
    decide: (sk: string, body: DecisionsRequest, o?: InferenceOptions): Promise<RouterResponse<DecisionsResponse>> =>
      call("POST", "/decisions", { key: sk, body, schema: decisionsResponseSchema, ...infer(o) }),
    transcribe: (sk: string, form: FormData, o?: InferenceOptions) => call("POST", "/audio/transcriptions", { key: sk, form, schema: looseSchema, ...infer(o) }),
    generateImage: (sk: string, body: { model: string; prompt: string; [extra: string]: unknown }, o?: InferenceOptions) =>
      call("POST", "/images/generations", { key: sk, body, schema: looseSchema, ...infer(o) }),
  };
}

export type RouterClient = ReturnType<typeof createRouterClient>;
