/** Removes any 0G Router secret (sk-/mk-) from strings and nested objects before logging, saving or throwing. */
const SECRET_RE = /\b(sk|mk)-[A-Za-z0-9._-]{6,}/g;
const SECRET_KEY_RE = /authorization|secret|api_key$|^key$/i;

export function redactString(s: string): string {
  return s.replace(SECRET_RE, (_m, prefix: string) => `${prefix}-[REDACTED]`);
}

export function redact<T>(value: T): T {
  if (typeof value === "string") return redactString(value) as T;
  if (Array.isArray(value)) return value.map((v) => redact(v)) as T;
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = SECRET_KEY_RE.test(k) && typeof v === "string" ? "[REDACTED]" : redact(v);
    }
    return out as T;
  }
  return value;
}
