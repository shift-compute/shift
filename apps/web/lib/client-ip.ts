/**
 * Client address for rate limits.
 * Railway's public edge sets `X-Real-IP` and overwrites a client-supplied value.
 * The first `X-Forwarded-For` entry is whatever the caller sent when a proxy only appends,
 * so it is never used. Without `X-Real-IP`, the last `X-Forwarded-For` hop is the one the closest proxy added.
 */
const IPV4 = /^(?:25[0-5]|2[0-4]\d|1?\d?\d)(?:\.(?:25[0-5]|2[0-4]\d|1?\d?\d)){3}$/;
const IPV6 = /^[0-9a-fA-F:]{2,64}$/;

export function clientIp(headers: { get(name: string): string | null }): string {
  const real = oneIp(headers.get("x-real-ip"));
  if (real) return real;
  const forwarded = headers.get("x-forwarded-for");
  if (!forwarded) return "unknown";
  const parts = forwarded.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
  const last = parts.length > 0 ? oneIp(parts[parts.length - 1] ?? null) : null;
  return last ?? "unknown";
}

function oneIp(value: string | null): string | null {
  if (!value) return null;
  let host = value.trim();
  if (!host || host.includes(",")) return null;
  if (host.startsWith("[")) {
    const end = host.indexOf("]");
    if (end <= 1) return null;
    host = host.slice(1, end);
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(host)) {
    host = host.replace(/:\d+$/, "");
  }
  if (IPV4.test(host) || (host.includes(":") && IPV6.test(host))) return host;
  return null;
}
