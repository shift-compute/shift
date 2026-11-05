/**
 * Shift — Phase 0 (verification spike).
 *
 * Runs REAL checks against the 0G Router with the team account. No mocks.
 * Covers U1–U8 of the plan (SHIFT_PLAN.md, section 21). Spends a minimal amount of credits.
 *
 * Usage:
 *   cp .env.example .env   # fill in ZG_MK_KEY (scopes: account:read, keys:create, keys:manage)
 *   pnpm smoke
 *
 * Output: docs/spike/SPIKE_RESULTS.json (no secrets) + console summary.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { makeClient, printable, deepFind, deepContains, type HttpResult } from "./lib/http";
import { loadDotEnv } from "./lib/env";
import { redact } from "./lib/redact";

// ---------- configuration ----------
loadDotEnv();

const BASE = process.env.ZG_ROUTER_BASE_URL ?? "https://router-api.0g.ai/v1";
const MK = process.env.ZG_MK_KEY ?? "";
const TRUST = process.env.SMOKE_TRUST_MODE ?? "private";
const CHAT_MODEL_OVERRIDE = process.env.SMOKE_CHAT_MODEL;
const DECISION_MODEL_OVERRIDE = process.env.SMOKE_DECISION_MODEL;
const LIMIT_FIELD = process.env.SMOKE_KEY_LIMIT_FIELD; // set after reading the OpenAPI spec (inspect-openapi)
const LIMIT_VALUE = process.env.SMOKE_KEY_LIMIT_VALUE;
const RUN_IMAGE = process.env.SMOKE_IMAGE === "1";
const AUDIO_FILE = process.env.SMOKE_AUDIO_FILE;

if (!MK.startsWith("mk-")) {
  console.error("ZG_MK_KEY is missing or does not start with 'mk-'. Create it at pc.0g.ai → Settings → Management Keys (Custom: account:read, keys:create, keys:manage).");
  process.exit(1);
}

const request = makeClient(BASE);

type Verdict = "PASS" | "FAIL" | "INFO" | "SKIP";
interface Check { id: string; title: string; verdict: Verdict; notes: string; evidence?: unknown }
const checks: Check[] = [];
const calls: unknown[] = [];

function record(r: HttpResult): HttpResult {
  calls.push(printable(r));
  return r;
}
function check(id: string, title: string, verdict: Verdict, notes: string, evidence?: unknown): void {
  checks.push({ id, title, verdict, notes, evidence: redact(evidence) });
  const icon = { PASS: "✅", FAIL: "❌", INFO: "ℹ️ ", SKIP: "⏭️ " }[verdict];
  console.log(`${icon} ${id} ${title} — ${notes}`);
}

function asList(body: unknown): Record<string, unknown>[] {
  if (Array.isArray(body)) return body as Record<string, unknown>[];
  const data = (body as { data?: unknown })?.data;
  return Array.isArray(data) ? (data as Record<string, unknown>[]) : [];
}
const lc = (v: unknown) => String(v ?? "").toLowerCase();

// ---------- checks ----------
async function main(): Promise<void> {
  console.log(`Router: ${BASE}\nTrust mode: ${TRUST}\n`);

  // U5 — account
  const account = record(await request("GET", "/account", { key: MK }));
  if (account.status === 200) {
    const address = deepFind(account.body, (k, v) => /address|wallet/i.test(k) && typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v));
    const currency = deepFind(account.body, (k) => /currency|settle/i.test(k));
    check("U5", "GET /v1/account", address ? "PASS" : "INFO",
      `address=${address ?? "not found (see evidence)"} currency=${JSON.stringify(currency ?? null)}`, account.body);
  } else {
    check("U5", "GET /v1/account", "FAIL", `HTTP ${account.status}`, account.body);
  }

  // U1 — balance
  const balance = record(await request("GET", "/account/balance", { key: MK }));
  const funds = record(await request("GET", "/account/funds", { key: MK }));
  const credit = deepFind(balance.body, (k) => k === "credit_balance");
  const deposit = deepFind(balance.body, (k) => k === "deposit_balance");
  check("U1", "credit_balance visible", balance.status === 200 && credit !== undefined ? "PASS" : "FAIL",
    `HTTP ${balance.status} credit_balance=${JSON.stringify(credit)} deposit_balance=${JSON.stringify(deposit)} (funds HTTP ${funds.status})`,
    { balance: balance.body, funds: funds.body });

  // U6 — catalog
  const modelsRes = record(await request("GET", "/models", { key: MK }));
  let models = asList(modelsRes.body);
  if (modelsRes.status !== 200 || models.length === 0) {
    const anon = record(await request("GET", "/models"));
    models = asList(anon.body);
  }
  mkdirSync("docs/spike", { recursive: true });
  writeFileSync("docs/spike/models.json", JSON.stringify(redact(models), null, 2));
  const tee = models.filter((m) => deepContains(m, "TeeML"));
  const chatModel = CHAT_MODEL_OVERRIDE || (tee.find((m) => /chat/i.test(lc(m.type)) || /0gm|glm/.test(lc(m.id)))?.id as string | undefined);
  const decisionModel = DECISION_MODEL_OVERRIDE || (models.find((m) => /laya|vela/.test(lc(m.id)))?.id as string | undefined);
  const imageModel = tee.find((m) => /image/.test(lc(m.type)) || /z-image/.test(lc(m.id)))?.id as string | undefined;
  const whisperModel = models.find((m) => /whisper/.test(lc(m.id)))?.id as string | undefined;
  check("U6", "Model catalog", models.length ? "PASS" : "FAIL",
    `${models.length} models, ${tee.length} with TeeML. chat=${chatModel} decision=${decisionModel} image=${imageModel} whisper=${whisperModel}. Details in docs/spike/models.json`);

  if (!chatModel) {
    check("U2", "Create ephemeral key", "SKIP", "No chat model identified; set SMOKE_CHAT_MODEL and retry.");
    return;
  }

  // U2 — create ephemeral sk- key
  const keyBody: Record<string, unknown> = { name: `shift-smoke-${Date.now()}`, trust_mode: TRUST };
  if (LIMIT_FIELD && LIMIT_VALUE) keyBody[LIMIT_FIELD] = LIMIT_VALUE; // the spec types credit_limit as a string (0G units)
  const created = record(await request("POST", "/api-keys", { key: MK, body: keyBody }));
  // The response also carries `key_preview` ("sk-0c5ee…"), which is not a usable key: take the full `key` field.
  const secret = deepFind(created.body, (k, v) => k === "key" && typeof v === "string" && v.startsWith("sk-") && !v.includes("…")) as string | undefined;
  const keyId = deepFind(created.body, (k, v) => /^(id|key_id|api_key_id)$/.test(k) && (typeof v === "string" || typeof v === "number")) as string | number | undefined;
  check("U2", "POST /v1/api-keys", secret && keyId !== undefined ? "PASS" : "FAIL",
    `HTTP ${created.status} id=${keyId} sent body=${JSON.stringify(Object.keys(keyBody))}${LIMIT_FIELD ? "" : " (no limit field: set SMOKE_KEY_LIMIT_FIELD after inspect-openapi)"}`,
    created.body);
  if (keyId !== undefined && !secret) {
    // A key was created but its secret was not found: never leave it active.
    const del = record(await request("DELETE", `/api-keys/${encodeURIComponent(String(keyId))}`, { key: MK }));
    check("U4", "Revoke key without usable secret", del.status >= 200 && del.status < 300 ? "PASS" : "FAIL", `DELETE HTTP ${del.status}`, del.body);
  }
  if (!secret || keyId === undefined) return;

  try {
    // U3 + U8 — minimal inference with verify_tee
    const chat = record(await request("POST", "/chat/completions", {
      key: secret,
      headers: { "X-0G-Provider-Trust-Mode": TRUST, "X-Client-Request-Id": `smoke-chat-${Date.now()}` },
      body: { model: chatModel, messages: [{ role: "user", content: "Reply with the single word: ok" }], max_tokens: 5, verify_tee: true },
    }));
    const requestId = chat.headers["x-request-id"];
    const trace = deepFind(chat.body, (k) => k === "x_0g_trace");
    const tee = deepFind(trace, (k) => k === "tee_verified");
    check("U8", "x_0g_trace + verify_tee (chat)", chat.status === 200 && trace ? "PASS" : "FAIL",
      `HTTP ${chat.status} X-Request-ID=${requestId} tee_verified=${JSON.stringify(tee)} (absent = no verdict, not a failure)`, { trace, error: chat.status !== 200 ? chat.body : undefined });

    // U3 — was it paid with credit?
    if (requestId) {
      await new Promise((r) => setTimeout(r, 8000)); // settlement can take a few seconds
      const hist = record(await request("GET", "/account/usage/history?limit=50", { key: MK }));
      const row = asList(hist.body).find((r) => deepContains(r, requestId)) ?? deepFind(hist.body, (_k, v) => deepContains(v, requestId) && typeof v === "object");
      const creditUsed = deepFind(row, (k) => k === "credit_used");
      const depositUsed = deepFind(row, (k) => k === "deposit_used");
      check("U3", "Paid with credit (usage history)", row ? (creditUsed !== undefined ? "PASS" : "INFO") : "FAIL",
        `HTTP ${hist.status} row=${row ? "found" : "not found"} credit_used=${JSON.stringify(creditUsed)} deposit_used=${JSON.stringify(depositUsed)}`, row ?? hist.body);
      const after = record(await request("GET", "/account/balance", { key: MK }));
      check("U3b", "Balance after", "INFO", `credit_balance before=${JSON.stringify(credit)} after=${JSON.stringify(deepFind(after.body, (k) => k === "credit_balance"))}`);
    }

    // U7 — decision models
    if (decisionModel) {
      const dec = record(await request("POST", "/decisions", {
        key: secret,
        headers: { "X-0G-Provider-Trust-Mode": TRUST },
        body: {
          model: decisionModel,
          state: "Task: summarize a 2-minute voice note about a grocery list.",
          // Verified shape (F0.3): `questions` is an object keyed by question name; a choice question needs `instructions` and `criteria`.
          questions: {
            complexity: {
              type: "choice",
              instructions: "How much reasoning does this task need?",
              criteria: { simple: "a quick answer is enough", standard: "some reasoning is needed", complex: "deep multi-step reasoning is needed" },
            },
          },
        },
      }));
      check("U7", "POST /v1/decisions", dec.status === 200 ? "PASS" : "FAIL",
        `HTTP ${dec.status} (on failure the error body shows the correct schema; compare it with the OpenAPI spec)`, dec.body);
    } else {
      check("U7", "POST /v1/decisions", "SKIP", "Laya/Vela not found; set SMOKE_DECISION_MODEL");
    }

    // U8 — image (optional, costs more)
    if (RUN_IMAGE && imageModel) {
      const img = record(await request("POST", "/images/generations", {
        key: secret,
        headers: { "X-0G-Provider-Trust-Mode": TRUST },
        body: { model: imageModel, prompt: "a small paper lantern at dawn, flat illustration", n: 1, response_format: "b64_json", verify_tee: true },
      }));
      const trace = deepFind(img.body, (k) => k === "x_0g_trace");
      check("U8b", "Image + trace", img.status === 200 ? "PASS" : "FAIL", `HTTP ${img.status} X-Request-ID=${img.headers["x-request-id"]}`,
        img.status === 200 ? { trace } : img.body);
    } else {
      check("U8b", "Image + trace", "SKIP", "Enable with SMOKE_IMAGE=1");
    }

    // U8 — audio (optional)
    if (AUDIO_FILE && whisperModel && existsSync(AUDIO_FILE)) {
      const form = new FormData();
      form.append("model", whisperModel);
      form.append("response_format", "verbose_json");
      form.append("file", new Blob([readFileSync(AUDIO_FILE)]), basename(AUDIO_FILE));
      const aud = record(await request("POST", "/audio/transcriptions", { key: secret, form, headers: { "X-0G-Provider-Trust-Mode": TRUST } }));
      check("U8c", "Transcription + trace", aud.status === 200 ? "PASS" : "FAIL", `HTTP ${aud.status} X-Request-ID=${aud.headers["x-request-id"]}`,
        aud.status === 200 ? { trace: deepFind(aud.body, (k) => k === "x_0g_trace"), usage: deepFind(aud.body, (k) => k === "usage") } : aud.body);
    } else {
      check("U8c", "Transcription + trace", "SKIP", "Set SMOKE_AUDIO_FILE to a short audio file (≤ 15 s)");
    }
  } finally {
    // U4 — revocation (always runs)
    const del = record(await request("DELETE", `/api-keys/${encodeURIComponent(String(keyId))}`, { key: MK }));
    try {
      const probe = record(await request("POST", "/chat/completions", {
        key: secret,
        body: { model: chatModel, messages: [{ role: "user", content: "ok" }], max_tokens: 1 },
      }));
      check("U4", "Immediate revocation", (del.status >= 200 && del.status < 300) && probe.status === 401 ? "PASS" : "FAIL",
        `DELETE HTTP ${del.status}; follow-up call HTTP ${probe.status} (expected 401 api_key_revoked)`, probe.body);
    } catch (err) {
      check("U4", "Immediate revocation", "FAIL", `DELETE HTTP ${del.status}; follow-up call threw: ${String(err)}`);
    }
  }
}

main()
  .catch((err: unknown) => check("ERR", "Unhandled exception", "FAIL", String(err)))
  .finally(() => {
    writeFileSync("docs/spike/SPIKE_RESULTS.json", JSON.stringify(redact({ base: BASE, trust: TRUST, at: new Date().toISOString(), checks, calls }), null, 2));
    const fails = checks.filter((c) => c.verdict === "FAIL").length;
    console.log(`\n${checks.length} checks, ${fails} failed. Results: docs/spike/SPIKE_RESULTS.json`);
    console.log("If U4 failed, revoke the key manually at pc.0g.ai → API Keys.");
    process.exitCode = fails ? 1 : 0;
  });
