/**
 * Extrae del OpenAPI oficial del 0G Router los schemas exactos que Shift necesita.
 *
 * 1. Descarga la especificación desde https://0gfoundation.github.io/0g-router/ ("Download OpenAPI specification").
 * 2. Guárdala como docs/spike/openapi.json (o .yaml).
 * 3. npm run inspect-openapi -- docs/spike/openapi.json
 *
 * Salida: docs/spike/openapi-excerpt.md con request/response de cada endpoint relevante.
 * Úsala para fijar SMOKE_KEY_LIMIT_FIELD y el schema de /v1/decisions.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { parse as parseYaml } from "yaml";

type Json = Record<string, unknown>;

const file = process.argv[2] ?? "docs/spike/openapi.json";
const raw = readFileSync(file, "utf8");
const spec = (file.endsWith(".yaml") || file.endsWith(".yml") ? parseYaml(raw) : JSON.parse(raw)) as Json;

const WANTED: Array<[string, string]> = [
  ["get", "/v1/account"],
  ["get", "/v1/account/balance"],
  ["get", "/v1/account/funds"],
  ["get", "/v1/account/usage/history"],
  ["get", "/v1/api-keys"],
  ["post", "/v1/api-keys"],
  ["patch", "/v1/api-keys/{id}"],
  ["delete", "/v1/api-keys/{id}"],
  ["get", "/v1/models"],
  ["post", "/v1/chat/completions"],
  ["post", "/v1/decisions"],
  ["post", "/v1/audio/transcriptions"],
  ["post", "/v1/images/generations"],
];

function resolveRef(ref: string): unknown {
  return ref.replace(/^#\//, "").split("/").reduce<unknown>((acc, part) => (acc as Json)?.[part.replace(/~1/g, "/").replace(/~0/g, "~")], spec);
}

function expand(node: unknown, depth = 0, seen = new Set<string>()): unknown {
  if (depth > 6 || node === null || typeof node !== "object") return node;
  if (Array.isArray(node)) return node.map((n) => expand(n, depth + 1, seen));
  const obj = node as Json;
  if (typeof obj.$ref === "string") {
    if (seen.has(obj.$ref)) return { $ref: obj.$ref, note: "circular" };
    const next = new Set(seen).add(obj.$ref);
    return expand(resolveRef(obj.$ref), depth + 1, next);
  }
  const out: Json = {};
  for (const [k, v] of Object.entries(obj)) out[k] = expand(v, depth + 1, seen);
  return out;
}

const paths = (spec.paths ?? {}) as Json;
// Las rutas del spec pueden o no llevar el prefijo /v1 y usar otro nombre de parámetro; buscamos de forma tolerante.
function findPath(p: string): string | undefined {
  const norm = (s: string) => s.replace(/^\/v1/, "").replace(/\{[^}]+\}/g, "{}");
  return Object.keys(paths).find((k) => norm(k) === norm(p));
}

let md = `# Extracto del OpenAPI del 0G Router\n\nFuente: \`${file}\` — generado ${new Date().toISOString()}\n\n`;
for (const [method, p] of WANTED) {
  const actual = findPath(p);
  const op = actual ? ((paths[actual] as Json)?.[method] as Json | undefined) : undefined;
  md += `## ${method.toUpperCase()} ${p}\n\n`;
  if (!op) {
    md += `_No encontrado en el spec._\n\n`;
    continue;
  }
  md += `Ruta en spec: \`${actual}\`\n\n${op.summary ?? ""}\n\n`;
  if (op.parameters) md += "### Parámetros\n```json\n" + JSON.stringify(expand(op.parameters), null, 2) + "\n```\n";
  if (op.requestBody) md += "### Request body\n```json\n" + JSON.stringify(expand(op.requestBody), null, 2) + "\n```\n";
  const ok = (op.responses as Json | undefined)?.["200"] ?? (op.responses as Json | undefined)?.["201"];
  if (ok) md += "### Respuesta 2xx\n```json\n" + JSON.stringify(expand(ok), null, 2) + "\n```\n";
  md += "\n";
}

mkdirSync("docs/spike", { recursive: true });
writeFileSync("docs/spike/openapi-excerpt.md", md);
console.log("Escrito docs/spike/openapi-excerpt.md");

// Pista rápida para el campo de límite por llave
const createKey = findPath("/v1/api-keys");
const body = createKey ? expand(((paths[createKey] as Json)?.post as Json | undefined)?.requestBody) : undefined;
const props = JSON.stringify(body ?? {}).match(/"([a-z_]*(limit|credit|budget|cap)[a-z_]*)"/gi);
console.log("Campos candidatos para límite por llave:", props ? [...new Set(props)].join(", ") : "ninguno encontrado (ver extracto)");
