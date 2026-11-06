import { describe, expect, it } from "vitest";
import { clientIp } from "./client-ip";

function headers(values: Record<string, string>): { get(name: string): string | null } {
  return { get: (name) => values[name.toLowerCase()] ?? null };
}

describe("clientIp", () => {
  it("reads the trusted proxy header and ignores a forged first X-Forwarded-For value", () => {
    expect(clientIp(headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "1.2.3.4, 203.0.113.9" }))).toBe("203.0.113.9");
    expect(clientIp(headers({ "x-forwarded-for": "1.2.3.4, 198.51.100.20" }))).toBe("198.51.100.20");
    expect(clientIp(headers({ "x-forwarded-for": "1.2.3.4" }))).toBe("1.2.3.4");
  });

  it("falls through a bad real-ip to the last forwarded hop, and to unknown when neither is an address", () => {
    expect(clientIp(headers({ "x-real-ip": "not-an-ip", "x-forwarded-for": "8.8.8.8, 4.4.4.4" }))).toBe("4.4.4.4");
    expect(clientIp(headers({ "x-forwarded-for": "forged" }))).toBe("unknown");
    expect(clientIp(headers({}))).toBe("unknown");
    expect(clientIp(headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
    expect(clientIp(headers({ "x-real-ip": "203.0.113.9:443" }))).toBe("203.0.113.9");
  });
});
