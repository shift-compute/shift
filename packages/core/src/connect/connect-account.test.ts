import { describe, expect, it, vi } from "vitest";
import { openSecret } from "../crypto/vault";
import { RouterError } from "../zg/errors";
import { connectAccount, isPlausibleManagementKey, probeBudget, type ConnectClient } from "./connect-account";

const MK = "mk-0123456789abcdefghijklmnopqrstuv";
const MASTER = Buffer.alloc(32, 5).toString("base64");
const ADDRESS = "0xDBDCB1F11B6B8EA7AE2B5735954F251306D6F88F";

const scopeError = () => new RouterError({ status: 403, code: "insufficient_scope", message: "missing scope" });
const keyError = () => new RouterError({ status: 401, code: "invalid_api_key", message: "Invalid API key or token" });
const networkError = () => RouterError.network("GET /account failed (ECONNRESET)");

interface Overrides {
  getAccount?: () => Promise<unknown>;
  getBalance?: () => Promise<unknown>;
  createApiKey?: () => Promise<unknown>;
  revokeApiKey?: () => Promise<unknown>;
}

function fakeClient(o: Overrides = {}) {
  const client = {
    getAccount: vi.fn(o.getAccount ?? (async () => ({ data: { address: ADDRESS }, status: 200 }))),
    getBalance: vi.fn(
      o.getBalance ?? (async () => ({ data: { address: ADDRESS, currency: "0g", credit_balance: "1.5", deposit_balance: "0", pending_charge: "0", total_balance: "1.5" }, status: 200 })),
    ),
    createApiKey: vi.fn(o.createApiKey ?? (async () => ({ data: { key_id: "probe-1", key: "sk-probeprobeprobeprobe", name: "n" }, status: 200 }))),
    revokeApiKey: vi.fn(o.revokeApiKey ?? (async () => ({ data: { key_id: "probe-1" }, status: 200 }))),
  };
  return client as unknown as ConnectClient & typeof client;
}

describe("isPlausibleManagementKey", () => {
  it("accepts mk- keys of reasonable length and rejects everything else", () => {
    expect(isPlausibleManagementKey(MK)).toBe(true);
    expect(isPlausibleManagementKey("sk-0123456789abcdefghijklmnopqrstuv")).toBe(false);
    expect(isPlausibleManagementKey("mk-short")).toBe(false);
    expect(isPlausibleManagementKey("mk-has spaces in it 0123456789")).toBe(false);
    expect(isPlausibleManagementKey("")).toBe(false);
  });
});

describe("connectAccount", () => {
  it("connects, probes the key scopes without leaving a key behind, and seals the key", async () => {
    const client = fakeClient();
    const r = await connectAccount(client, MK, MASTER);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.account).toEqual({ address: ADDRESS, currency: "0g", creditBalance: "1.5", depositBalance: "0" });
    expect(client.createApiKey).toHaveBeenCalledTimes(1);
    expect(client.revokeApiKey).toHaveBeenCalledWith(MK, "probe-1");
    // The ciphertext is bound to the lowercase account address and opens back to the original key.
    expect(openSecret(r.sealed, MASTER, ADDRESS.toLowerCase())).toBe(MK);
  });

  it("asks the probe key for a cap above the Router's minimum, depending on the account currency", async () => {
    const zg = fakeClient();
    await connectAccount(zg, MK, MASTER);
    expect(zg.createApiKey).toHaveBeenCalledWith(MK, expect.objectContaining({ creditLimit: "0.0001" }));
    expect(probeBudget("0g")).toBe("0.0001");
    expect(probeBudget("USD")).toBe("0.01");
  });

  it("never exposes the plaintext key in the result", async () => {
    const r = await connectAccount(fakeClient(), MK, MASTER);
    expect(JSON.stringify(r)).not.toContain(MK);
  });

  it("rejects a malformed key without calling the Router", async () => {
    const client = fakeClient();
    await expect(connectAccount(client, "not-a-key", MASTER)).resolves.toMatchObject({ ok: false, reason: "invalid_format" });
    expect(client.getAccount).not.toHaveBeenCalled();
  });

  it("reports an invalid or revoked key", async () => {
    const client = fakeClient({ getAccount: async () => { throw keyError(); } });
    await expect(connectAccount(client, MK, MASTER)).resolves.toMatchObject({ ok: false, reason: "invalid_key" });
  });

  it("reports a missing account:read scope", async () => {
    const client = fakeClient({ getAccount: async () => { throw scopeError(); } });
    await expect(connectAccount(client, MK, MASTER)).resolves.toMatchObject({ ok: false, reason: "missing_scopes", missingScopes: ["account:read"] });
  });

  it("reports a missing keys:create scope", async () => {
    const client = fakeClient({ createApiKey: async () => { throw scopeError(); } });
    const r = await connectAccount(client, MK, MASTER);
    expect(r).toMatchObject({ ok: false, reason: "missing_scopes", missingScopes: ["keys:create"] });
    expect(client.revokeApiKey).not.toHaveBeenCalled();
  });

  it("reports a missing keys:manage scope and the probe key left active", async () => {
    const client = fakeClient({ revokeApiKey: async () => { throw scopeError(); } });
    const r = await connectAccount(client, MK, MASTER);
    expect(r).toMatchObject({ ok: false, reason: "missing_scopes", missingScopes: ["keys:manage"], leftoverKeyId: "probe-1" });
  });

  it("lists every missing scope at once when account:read and keys:create are both missing", async () => {
    const client = fakeClient({ getAccount: async () => { throw scopeError(); }, createApiKey: async () => { throw scopeError(); } });
    const r = await connectAccount(client, MK, MASTER);
    expect(r).toMatchObject({ ok: false, missingScopes: ["account:read", "keys:create"] });
  });

  it("does not blame the user for network failures", async () => {
    const readFails = fakeClient({ getAccount: async () => { throw networkError(); } });
    await expect(connectAccount(readFails, MK, MASTER)).rejects.toMatchObject({ kind: "network" });
    const revokeFails = fakeClient({ revokeApiKey: async () => { throw networkError(); } });
    await expect(connectAccount(revokeFails, MK, MASTER)).rejects.toMatchObject({ kind: "network" });
  });
});
