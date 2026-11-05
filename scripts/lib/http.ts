import { redact } from "./redact";

export interface HttpResult {
  method: string;
  path: string;
  status: number;
  ms: number;
  headers: Record<string, string>;
  body: unknown; // parsed JSON when possible, otherwise text
}

export interface RequestOptions {
  key?: string;
  body?: unknown;
  form?: FormData;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

export function makeClient(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, "");
  return async function request(method: string, path: string, opts: RequestOptions = {}): Promise<HttpResult> {
    const headers: Record<string, string> = { ...(opts.headers ?? {}) };
    if (opts.key) headers["Authorization"] = `Bearer ${opts.key}`;
    let body: BodyInit | undefined;
    if (opts.form) body = opts.form;
    else if (opts.body !== undefined) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(opts.body);
    }
    const started = Date.now();
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body,
      signal: AbortSignal.timeout(opts.timeoutMs ?? 120_000),
    });
    const text = await res.text();
    let parsed: unknown = text;
    try {
      parsed = text.length ? JSON.parse(text) : null;
    } catch {
      /* keep text */
    }
    const outHeaders: Record<string, string> = {};
    res.headers.forEach((v, k) => (outHeaders[k] = v));
    return { method, path, status: res.status, ms: Date.now() - started, headers: outHeaders, body: parsed };
  };
}

export function printable(r: HttpResult): unknown {
  return redact({ method: r.method, path: r.path, status: r.status, ms: r.ms, requestId: r.headers["x-request-id"], body: r.body });
}

/** Depth-first search for the first value satisfying `pred`. Used because exact response shapes are still unverified. */
export function deepFind(value: unknown, pred: (k: string, v: unknown) => boolean, depth = 0): unknown {
  if (depth > 8 || value === null || typeof value !== "object") return undefined;
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (pred(k, v)) return v;
    const nested = deepFind(v, pred, depth + 1);
    if (nested !== undefined) return nested;
  }
  return undefined;
}

export function deepContains(value: unknown, needle: string): boolean {
  return JSON.stringify(value ?? "").includes(needle);
}
