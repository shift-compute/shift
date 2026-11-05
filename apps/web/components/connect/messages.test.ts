import { describe, expect, it } from "vitest";
import { consoleUrlFor } from "../../lib/console-url";
import { describeConnectError, shortAddress } from "./messages";

describe("describeConnectError", () => {
  it("lists missing scopes with the console's wording", () => {
    const m = describeConnectError(403, { error: "missing_scopes", missingScopes: ["keys:create", "keys:manage"] });
    expect(m.missingScopes).toEqual(["Create keys (keys:create)", "Revoke / update (keys:manage)"]);
  });

  it("tells the user to revoke a probe key that was left active", () => {
    const m = describeConnectError(403, { error: "missing_scopes", missingScopes: ["keys:manage"], leftoverKeyId: "abc-123" });
    expect(m.detail).toContain("abc-123");
    expect(m.detail).toContain("revoke");
  });

  it("explains an sk- key was pasted instead of an mk- key", () => {
    expect(describeConnectError(400, { error: "invalid_key_format" }).detail).toContain("sk-");
  });

  it("says the key was not stored when the Router is unreachable", () => {
    expect(describeConnectError(502, { error: "router_unavailable" }).detail).toContain("not stored");
  });

  it("shows how long to wait when rate limited", () => {
    expect(describeConnectError(429, { error: "rate_limited", retryAfterSeconds: 42 }).detail).toContain("42 seconds");
  });

  it("falls back to a generic message for unknown or missing bodies", () => {
    expect(describeConnectError(500, null).title).toBe("Something went wrong");
    expect(describeConnectError(418, { error: "teapot" }).detail).toBe("The request was not accepted.");
  });
});

describe("shortAddress", () => {
  it("shortens long addresses and leaves short values alone", () => {
    expect(shortAddress("0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f")).toBe("0xdbdc…f88f");
    expect(shortAddress("0x12")).toBe("0x12");
  });
});

describe("consoleUrlFor", () => {
  it("matches the console to the Router network", () => {
    expect(consoleUrlFor("https://router-api.0g.ai/v1")).toBe("https://pc.0g.ai");
    expect(consoleUrlFor("https://router-api-testnet.integratenetwork.work/v1")).toBe("https://pc.testnet.0g.ai");
  });
});
