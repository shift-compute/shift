/**
 * Extracts from the official 0G Router OpenAPI spec the exact schemas Shift needs.
 *
 * 1. Download the spec from https://0gfoundation.github.io/0g-router/openapi.yaml
 *    (the "Download OpenAPI specification" button on the docs page).
 * 2. Save it as docs/spike/openapi.yaml (or .json).
 * 3. npm run inspect-openapi -- docs/spike/openapi.yaml
 *
 * Output: docs/spike/openapi-excerpt.md with the request/response of each relevant endpoint.
 * Use it to set SMOKE_KEY_LIMIT_FIELD and the /v1/decisions schema.
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
// Spec paths may or may not carry the /v1 prefix and may name path parameters differently, so match loosely.
function findPath(p: string): string | undefined {
  const norm = (s: string) => s.replace(/^\/v1/, "").replace(/\{[^}]+\}/g, "{}");
  return Object.keys(paths).find((k) => norm(k) === norm(p));
}

let md = `# 0G Router OpenAPI excerpt\n\nSource: \`${file}\` — generated ${new Date().toISOString()}\n\n`;
for (const [method, p] of WANTED) {
  const actual = findPath(p);
  const op = actual ? ((paths[actual] as Json)?.[method] as Json | undefined) : undefined;
  md += `## ${method.toUpperCase()} ${p}\n\n`;
  if (!op) {
    md += `_Not found in the spec._\n\n`;
    continue;
  }
  md += `Path in spec: \`${actual}\`\n\n${op.summary ?? ""}\n\n`;
  if (op.parameters) md += "### Parameters\n```json\n" + JSON.stringify(expand(op.parameters), null, 2) + "\n```\n";
  if (op.requestBody) md += "### Request body\n```json\n" + JSON.stringify(expand(op.requestBody), null, 2) + "\n```\n";
  const ok = (op.responses as Json | undefined)?.["200"] ?? (op.responses as Json | undefined)?.["201"];
  if (ok) md += "### 2xx response\n```json\n" + JSON.stringify(expand(ok), null, 2) + "\n```\n";
  md += "\n";
}

mkdirSync("docs/spike", { recursive: true });
writeFileSync("docs/spike/openapi-excerpt.md", md);
console.log("Wrote docs/spike/openapi-excerpt.md");

// Quick hint for the per-key limit field
const createKey = findPath("/v1/api-keys");
const body = createKey ? expand(((paths[createKey] as Json)?.post as Json | undefined)?.requestBody) : undefined;
const props = JSON.stringify(body ?? {}).match(/"([a-z_]*(limit|credit|budget|cap)[a-z_]*)"/gi);
console.log("Candidate per-key limit fields:", props ? [...new Set(props)].join(", ") : "none found (see excerpt)");
