/**
 * Shift — Fase 0 (spike de verificación).
 *
 * Ejecuta pruebas REALES contra el 0G Router con la cuenta del equipo. No hay mocks.
 * Cubre U1–U8 del plan (SHIFT_PLAN.md, sección 21). Gasta una cantidad mínima de créditos.
 *
 * Uso:
 *   cp .env.example .env   # rellenar ZG_MK_KEY (scopes: account:read, keys:create, keys:manage)
 *   npm run smoke
 *
 * Resultado: docs/spike/SPIKE_RESULTS.json (sin secretos) + resumen en consola.
 */
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { basename } from "node:path";
import { makeClient, printable, deepFind, deepContains, type HttpResult } from "./lib/http";
import { redact } from "./lib/redact";

// ---------- configuración ----------
function loadDotEnv(path = ".env"): void {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && m[1] && process.env[m[1]] === undefined) process.env[m[1]] = (m[2] ?? "").replace(/^["']|["']$/g, "");
  }
}
loadDotEnv();

const BASE = process.env.ZG_ROUTER_BASE_URL ?? "https://router-api.0g.ai/v1";
const MK = process.env.ZG_MK_KEY ?? "";
const TRUST = process.env.SMOKE_TRUST_MODE ?? "private";
const CHAT_MODEL_OVERRIDE = process.env.SMOKE_CHAT_MODEL;
const DECISION_MODEL_OVERRIDE = process.env.SMOKE_DECISION_MODEL;
const LIMIT_FIELD = process.env.SMOKE_KEY_LIMIT_FIELD; // definir tras leer el OpenAPI (inspect-openapi)
const LIMIT_VALUE = process.env.SMOKE_KEY_LIMIT_VALUE;
const RUN_IMAGE = process.env.SMOKE_IMAGE === "1";
const AUDIO_FILE = process.env.SMOKE_AUDIO_FILE;

if (!MK.startsWith("mk-")) {
  console.error("ZG_MK_KEY falta o no empieza con 'mk-'. Créala en pc.0g.ai → Settings → Management Keys (Custom: account:read, keys:create, keys:manage).");
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

// ---------- pruebas ----------
async function main(): Promise<void> {
  console.log(`Router: ${BASE}\nTrust mode: ${TRUST}\n`);

  // U5 — cuenta
  const account = record(await request("GET", "/account", { key: MK }));
  if (account.status === 200) {
    const address = deepFind(account.body, (k, v) => /address|wallet/i.test(k) && typeof v === "string" && /^0x[0-9a-fA-F]{40}$/.test(v));
    const currency = deepFind(account.body, (k) => /currency|settle/i.test(k));
    check("U5", "GET /v1/account", address ? "PASS" : "INFO",
      `dirección=${address ?? "no encontrada (revisar evidencia)"} moneda=${JSON.stringify(currency ?? null)}`, account.body);
  } else {
    check("U5", "GET /v1/account", "FAIL", `HTTP ${account.status}`, account.body);
  }

  // U1 — saldo
  const balance = record(await request("GET", "/account/balance", { key: MK }));
  const funds = record(await request("GET", "/account/funds", { key: MK }));
  const credit = deepFind(balance.body, (k) => k === "credit_balance");
  const deposit = deepFind(balance.body, (k) => k === "deposit_balance");
  check("U1", "credit_balance visible", balance.status === 200 && credit !== undefined ? "PASS" : "FAIL",
    `HTTP ${balance.status} credit_balance=${JSON.stringify(credit)} deposit_balance=${JSON.stringify(deposit)} (funds HTTP ${funds.status})`,
    { balance: balance.body, funds: funds.body });

  // U6 — catálogo
  const modelsRes = record(await request("GET", "/models", { key: MK }));
  let models = asList(modelsRes.body);
  if (modelsRes.status !== 200 || models.length === 0) {
    const anon = record(await request("GET", "/models"));
    models = asList(anon.body);
  }
  mkdirSync("docs/spike", { recursive: true });
  writeFileSync("docs/spike/models.json", JSON.stringify(redact(models), null, 2));
  const tee = models.filter((m) => deepContains(m, "TeeML"));
  const chatModel = CHAT_MODEL_OVERRIDE ?? (tee.find((m) => /chat/i.test(lc(m.type)) || /0gm|glm/.test(lc(m.id)))?.id as string | undefined);
  const decisionModel = DECISION_MODEL_OVERRIDE ?? (models.find((m) => /laya|vela/.test(lc(m.id)))?.id as string | undefined);
  const imageModel = tee.find((m) => /image/.test(lc(m.type)) || /z-image/.test(lc(m.id)))?.id as string | undefined;
  const whisperModel = models.find((m) => /whisper/.test(lc(m.id)))?.id as string | undefined;
  check("U6", "Catálogo de modelos", models.length ? "PASS" : "FAIL",
    `${models.length} modelos, ${tee.length} con TeeML. chat=${chatModel} decision=${decisionModel} image=${imageModel} whisper=${whisperModel}. Detalle en docs/spike/models.json`);

  if (!chatModel) {
    check("U2", "Crear llave efímera", "SKIP", "Sin modelo de chat identificado; define SMOKE_CHAT_MODEL y reintenta.");
    return;
  }

  // U2 — crear sk- efímera
  const keyBody: Record<string, unknown> = { name: `shift-smoke-${Date.now()}`, trust_mode: TRUST };
  if (LIMIT_FIELD && LIMIT_VALUE) keyBody[LIMIT_FIELD] = isNaN(Number(LIMIT_VALUE)) ? LIMIT_VALUE : Number(LIMIT_VALUE);
  const created = record(await request("POST", "/api-keys", { key: MK, body: keyBody }));
  const secret = deepFind(created.body, (_k, v) => typeof v === "string" && v.startsWith("sk-")) as string | undefined;
  const keyId = deepFind(created.body, (k, v) => /^(id|key_id|api_key_id)$/.test(k) && (typeof v === "string" || typeof v === "number")) as string | number | undefined;
  check("U2", "POST /v1/api-keys", secret && keyId !== undefined ? "PASS" : "FAIL",
    `HTTP ${created.status} id=${keyId} body enviado=${JSON.stringify(Object.keys(keyBody))}${LIMIT_FIELD ? "" : " (sin campo de límite: define SMOKE_KEY_LIMIT_FIELD tras inspect-openapi)"}`,
    created.body);
  if (!secret || keyId === undefined) return;

  try {
    // U3 + U8 — inferencia mínima con verify_tee
    const chat = record(await request("POST", "/chat/completions", {
      key: secret,
      headers: { "X-0G-Provider-Trust-Mode": TRUST, "X-Client-Request-Id": `smoke-chat-${Date.now()}` },
      body: { model: chatModel, messages: [{ role: "user", content: "Reply with the single word: ok" }], max_tokens: 5, verify_tee: true },
    }));
    const requestId = chat.headers["x-request-id"];
    const trace = deepFind(chat.body, (k) => k === "x_0g_trace");
    const tee = deepFind(trace, (k) => k === "tee_verified");
    check("U8", "x_0g_trace + verify_tee (chat)", chat.status === 200 && trace ? "PASS" : "FAIL",
      `HTTP ${chat.status} X-Request-ID=${requestId} tee_verified=${JSON.stringify(tee)} (ausente = sin veredicto, no es fallo)`, { trace, error: chat.status !== 200 ? chat.body : undefined });

    // U3 — ¿se pagó con crédito?
    if (requestId) {
      await new Promise((r) => setTimeout(r, 8000)); // la liquidación puede tardar unos segundos
      const hist = record(await request("GET", "/account/usage/history?limit=50", { key: MK }));
      const row = asList(hist.body).find((r) => deepContains(r, requestId)) ?? deepFind(hist.body, (_k, v) => deepContains(v, requestId) && typeof v === "object");
      const creditUsed = deepFind(row, (k) => k === "credit_used");
      const depositUsed = deepFind(row, (k) => k === "deposit_used");
      check("U3", "Pago con crédito (usage history)", row ? (creditUsed !== undefined ? "PASS" : "INFO") : "FAIL",
        `HTTP ${hist.status} fila=${row ? "encontrada" : "no encontrada"} credit_used=${JSON.stringify(creditUsed)} deposit_used=${JSON.stringify(depositUsed)}`, row ?? hist.body);
      const after = record(await request("GET", "/account/balance", { key: MK }));
      check("U3b", "Saldo después", "INFO", `credit_balance antes=${JSON.stringify(credit)} después=${JSON.stringify(deepFind(after.body, (k) => k === "credit_balance"))}`);
    }

    // U7 — modelos de decisión
    if (decisionModel) {
      const dec = record(await request("POST", "/decisions", {
        key: secret,
        headers: { "X-0G-Provider-Trust-Mode": TRUST },
        body: {
          model: decisionModel,
          state: "Task: summarize a 2-minute voice note about a grocery list.",
          questions: [{ id: "complexity", type: "choice", text: "How much reasoning does this task need?", options: ["simple", "standard", "complex"] }],
        },
      }));
      check("U7", "POST /v1/decisions", dec.status === 200 ? "PASS" : "FAIL",
        `HTTP ${dec.status} (si falla, el cuerpo del error indica el schema correcto; compáralo con el OpenAPI)`, dec.body);
    } else {
      check("U7", "POST /v1/decisions", "SKIP", "No se encontró Laya/Vela; define SMOKE_DECISION_MODEL");
    }

    // U8 — imagen (opcional, cuesta más)
    if (RUN_IMAGE && imageModel) {
      const img = record(await request("POST", "/images/generations", {
        key: secret,
        headers: { "X-0G-Provider-Trust-Mode": TRUST },
        body: { model: imageModel, prompt: "a small paper lantern at dawn, flat illustration", n: 1, response_format: "b64_json", verify_tee: true },
      }));
      const trace = deepFind(img.body, (k) => k === "x_0g_trace");
      check("U8b", "Imagen + traza", img.status === 200 ? "PASS" : "FAIL", `HTTP ${img.status} X-Request-ID=${img.headers["x-request-id"]}`,
        img.status === 200 ? { trace } : img.body);
    } else {
      check("U8b", "Imagen + traza", "SKIP", "Activa con SMOKE_IMAGE=1");
    }

    // U8 — audio (opcional)
    if (AUDIO_FILE && whisperModel && existsSync(AUDIO_FILE)) {
      const form = new FormData();
      form.append("model", whisperModel);
      form.append("response_format", "verbose_json");
      form.append("file", new Blob([readFileSync(AUDIO_FILE)]), basename(AUDIO_FILE));
      const aud = record(await request("POST", "/audio/transcriptions", { key: secret, form, headers: { "X-0G-Provider-Trust-Mode": TRUST } }));
      check("U8c", "Transcripción + traza", aud.status === 200 ? "PASS" : "FAIL", `HTTP ${aud.status} X-Request-ID=${aud.headers["x-request-id"]}`,
        aud.status === 200 ? { trace: deepFind(aud.body, (k) => k === "x_0g_trace"), usage: deepFind(aud.body, (k) => k === "usage") } : aud.body);
    } else {
      check("U8c", "Transcripción + traza", "SKIP", "Define SMOKE_AUDIO_FILE con un audio corto (≤ 15 s)");
    }
  } finally {
    // U4 — revocación (siempre se ejecuta)
    const del = record(await request("DELETE", `/api-keys/${encodeURIComponent(String(keyId))}`, { key: MK }));
    const probe = record(await request("POST", "/chat/completions", {
      key: secret,
      body: { model: chatModel, messages: [{ role: "user", content: "ok" }], max_tokens: 1 },
    }));
    check("U4", "Revocación inmediata", (del.status >= 200 && del.status < 300) && probe.status === 401 ? "PASS" : "FAIL",
      `DELETE HTTP ${del.status}; llamada posterior HTTP ${probe.status} (esperado 401 api_key_revoked)`, probe.body);
  }
}

main()
  .catch((err: unknown) => check("ERR", "Excepción no controlada", "FAIL", String(err)))
  .finally(() => {
    writeFileSync("docs/spike/SPIKE_RESULTS.json", JSON.stringify(redact({ base: BASE, trust: TRUST, at: new Date().toISOString(), checks, calls }), null, 2));
    const fails = checks.filter((c) => c.verdict === "FAIL").length;
    console.log(`\n${checks.length} comprobaciones, ${fails} fallidas. Resultados: docs/spike/SPIKE_RESULTS.json`);
    console.log("Si U4 falló, revoca la llave manualmente en pc.0g.ai → API Keys.");
    process.exitCode = fails ? 1 : 0;
  });
