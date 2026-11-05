import { describe, expect, it, vi } from "vitest";
import { RouterError } from "./errors";
import { createRouterClient, extractRequestId } from "./router";

// Fixtures are bodies captured from the real Router during Phase 0 (docs/spike/SPIKE_RESULTS.json), not invented ones.
const ADDRESS = "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f";
const REAL_HEADERS = { "x-request-id": "16b1c01ab15588ea, 3976195e-1879-4a65-bfb7-82e6ddd910ab" };
const MK = "mk-0123456789abcdefghijklmnop";
const SK = "sk-0123456789abcdefghijklmnop";

type Step = Response | Error;
const json = (status: number, body: unknown, headers: Record<string, string> = REAL_HEADERS) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json", ...headers } });
const netError = (code: string) => Object.assign(new TypeError("fetch failed"), { cause: { code } });

function setup(steps: Step[]) {
  const queue = [...steps];
  const fetchImpl = vi.fn(async (_url: string | URL | Request, _init?: RequestInit) => {
    const next = queue.shift();
    if (!next) throw new Error("no more scripted responses");
    if (next instanceof Error) throw next;
    return next;
  });
  const sleeps: number[] = [];
  const client = createRouterClient({
    baseUrl: "https://router.test/v1/",
    fetchImpl: fetchImpl as unknown as typeof fetch,
    sleep: async (ms) => void sleeps.push(ms),
  });
  return { client, fetchImpl, sleeps };
}

const balanceBody = { address: ADDRESS, currency: "0g", deposit_balance: "0", credit_balance: "0", pending_charge: "0", total_balance: "0", balance: "0" };
const insufficient = { _0g: { source: "upstream", upstream_status: 402 }, error: { code: "insufficient_balance", message: "Insufficient balance", type: "payment_error" } };

describe("extractRequestId", () => {
  it("picks the Router UUID out of the two-value header", () => {
    expect(extractRequestId("16b1c01ab15588ea, 3976195e-1879-4a65-bfb7-82e6ddd910ab")).toBe("3976195e-1879-4a65-bfb7-82e6ddd910ab");
  });
  it("falls back to the last value when none is a UUID, and handles absence", () => {
    expect(extractRequestId("abc, def")).toBe("def");
    expect(extractRequestId(null)).toBeUndefined();
  });
});

describe("requests", () => {
  it("sends the key as a bearer token and validates the balance shape", async () => {
    const { client, fetchImpl } = setup([json(200, balanceBody)]);
    const r = await client.getBalance(MK);
    expect(r.data.credit_balance).toBe("0");
    expect(r.requestId).toBe("3976195e-1879-4a65-bfb7-82e6ddd910ab");
    const [url, init] = fetchImpl.mock.calls[0]!;
    expect(String(url)).toBe("https://router.test/v1/account/balance");
    expect((init?.headers as Record<string, string>)["Authorization"]).toBe(`Bearer ${MK}`);
  });

  it("creates an ephemeral key sending credit_limit as a string", async () => {
    const created = { key_id: "f44f43cc-781b-4a06-884d-cdb05be1c6d6", name: "n", key_preview: "sk-0ac07…", credit_limit: "0.01", currency: "0g", status: "active", trust_mode: "private", key: SK };
    const { client, fetchImpl } = setup([json(200, created)]);
    const r = await client.createApiKey(MK, { name: "shift-test", trustMode: "private", creditLimit: "0.01" });
    expect(r.data.key).toBe(SK);
    const sent = JSON.parse(String(fetchImpl.mock.calls[0]![1]!.body));
    expect(sent).toEqual({ name: "shift-test", trust_mode: "private", credit_limit: "0.01" });
  });

  it("rejects a key response whose secret is only the truncated preview", async () => {
    const { client } = setup([json(200, { key_id: "x", name: "n", key: "sk-0ac07…" })]);
    await expect(client.createApiKey(MK, { name: "n", trustMode: "private" })).rejects.toMatchObject({ kind: "unexpected_response" });
  });

  it("parses a decisions response using the verified schema and sends trust headers", async () => {
    const body = { model: "laya", answers: { complexity: { type: "choice", choice: "simple", probabilities: { simple: 0.7315, standard: 0.1858, complex: 0.0827 } } } };
    const { client, fetchImpl } = setup([json(200, body)]);
    const r = await client.decide(
      SK,
      { model: "laya", state: "Task", questions: { complexity: { type: "choice", instructions: "How hard?", criteria: ["simple", "standard", "complex"] } } },
      { trustMode: "private", clientRequestId: "task1-1-classify" },
    );
    expect(r.data.answers["complexity"]?.choice).toBe("simple");
    const headers = fetchImpl.mock.calls[0]![1]!.headers as Record<string, string>;
    expect(headers["X-0G-Provider-Trust-Mode"]).toBe("private");
    expect(headers["X-Client-Request-Id"]).toBe("task1-1-classify");
  });

  it("captures the x_0g_trace of an inference response, tolerating missing fields", async () => {
    const chat = { choices: [{ message: { content: "ok" } }], x_0g_trace: { request_id: "3976195e-1879-4a65-bfb7-82e6ddd910ab", provider: "0x743c", billing: { total_cost: "12", currency: "0g" } } };
    const { client } = setup([json(200, chat)]);
    const r = await client.chat(SK, { model: "0gm-1.0-35b-a3b", messages: [{ role: "user", content: "hi" }], max_tokens: 5 });
    expect(r.trace?.provider).toBe("0x743c");
    expect(r.trace?.tee_verified).toBeUndefined();
    expect(r.trace?.billing?.currency).toBe("0g");
  });

  it("rejects invalid X-Client-Request-Id values before sending anything", async () => {
    const { client, fetchImpl } = setup([]);
    await expect(client.chat(SK, { model: "m", messages: [] }, { clientRequestId: "ñ" })).rejects.toThrow(TypeError);
    await expect(client.chat(SK, { model: "m", messages: [] }, { clientRequestId: "x".repeat(513) })).rejects.toThrow(TypeError);
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("error mapping (plan §7.5)", () => {
  it("maps 402 insufficient_balance to stopping the user's batch, without retrying", async () => {
    const { client, fetchImpl } = setup([json(402, insufficient)]);
    const err = await client.chat(SK, { model: "m", messages: [] }).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(RouterError);
    expect(err).toMatchObject({ kind: "insufficient_balance", action: "stop_user_batch", status: 402, retryable: false, requestId: "3976195e-1879-4a65-bfb7-82e6ddd910ab" });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("treats credit_limit_exceeded as the normal end of the budget", async () => {
    const { client } = setup([json(429, { error: { code: "credit_limit_exceeded", message: "limit", type: "x" } })]);
    await expect(client.chat(SK, { model: "m", messages: [] })).rejects.toMatchObject({ kind: "credit_limit_exceeded", action: "end_budget", retryable: false });
  });

  it("maps invalid and revoked keys, missing scopes and unsupported trust modes", async () => {
    const cases: Array<[number, string, string]> = [
      [401, "invalid_api_key", "invalid_api_key"],
      [401, "api_key_revoked", "api_key_revoked"],
      [403, "insufficient_scope", "insufficient_scope"],
      [503, "no_provider_for_trust_mode", "no_provider_for_trust_mode"],
      [400, "model_not_capable", "model_not_capable"],
    ];
    for (const [status, code, kind] of cases) {
      const { client } = setup([json(status, { error: { code, message: "m", type: "t" } })]);
      await expect(client.getAccount(MK)).rejects.toMatchObject({ kind, code });
    }
  });

  it("keeps the upstream explanation for 4xx errors so schema problems are diagnosable", async () => {
    const body = { error: { message: "upstream 422", type: "invalid_request_error", metadata: { raw: "{\"detail\":\"question 'complexity': no 'instructions'\"}" } } };
    const { client } = setup([json(422, body)]);
    const err = (await client.decide(SK, { model: "laya", state: "s", questions: {} }).catch((e: unknown) => e)) as RouterError;
    expect(err.kind).toBe("invalid_request");
    expect(JSON.stringify(err.details)).toContain("no 'instructions'");
  });

  it("never lets an API key leak through an error", async () => {
    const { client } = setup([json(401, { error: { code: "invalid_api_key", message: `bad key ${SK}`, type: "t" }, echoed: { authorization: `Bearer ${SK}` } })]);
    const err = (await client.getAccount(MK).catch((e: unknown) => e)) as RouterError;
    expect(err.message).not.toContain(SK);
    expect(JSON.stringify(err.details)).not.toContain(SK);
  });
});

describe("retries", () => {
  it("retries a 429 after Retry-After and then succeeds", async () => {
    const limited = json(429, { error: { code: "fair_share_exceeded", message: "slow down", type: "t" } }, { ...REAL_HEADERS, "retry-after": "2" });
    const { client, fetchImpl, sleeps } = setup([limited, json(200, balanceBody)]);
    const r = await client.getBalance(MK);
    expect(r.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(sleeps).toEqual([2000]);
  });

  it("gives up after the configured number of 429 retries", async () => {
    const limited = () => json(429, { error: { code: "fair_share_exceeded", message: "x", type: "t" } }, { ...REAL_HEADERS, "retry-after": "1" });
    const { client, fetchImpl } = setup([limited(), limited(), limited(), limited()]);
    await expect(client.getBalance(MK)).rejects.toMatchObject({ kind: "rate_limited" });
    expect(fetchImpl).toHaveBeenCalledTimes(4); // 1 attempt + 3 retries
  });

  it("retries pre-send failures even for POST", async () => {
    const { client, fetchImpl } = setup([netError("UND_ERR_CONNECT_TIMEOUT"), netError("ENOTFOUND"), json(200, { choices: [{ message: { content: "ok" } }] })]);
    const r = await client.chat(SK, { model: "m", messages: [] });
    expect(r.status).toBe(200);
    expect(fetchImpl).toHaveBeenCalledTimes(3);
  });

  it("does not retry a POST that may have been sent (it could be charged twice)", async () => {
    const { client, fetchImpl } = setup([netError("ECONNRESET"), json(200, { choices: [] })]);
    await expect(client.chat(SK, { model: "m", messages: [] })).rejects.toMatchObject({ kind: "network", retryable: true });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
  });

  it("does retry idempotent GETs after a reset", async () => {
    const { client, fetchImpl } = setup([netError("ECONNRESET"), json(200, balanceBody)]);
    await expect(client.getBalance(MK)).resolves.toMatchObject({ status: 200 });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });
});
