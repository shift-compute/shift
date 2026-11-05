/**
 * Generates TypeScript types for the 0G Router API from the official OpenAPI spec.
 *
 * Usage: pnpm gen:router-types [spec]
 *   spec: local file or URL. Defaults to docs/spike/openapi.yaml, falling back to the official URL.
 * Output: packages/core/src/zg/generated/router.ts (committed).
 */
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { pathToFileURL } from "node:url";
import openapiTS, { astToString } from "openapi-typescript";

const OFFICIAL_URL = "https://0gfoundation.github.io/0g-router/openapi.yaml";
const LOCAL_SPEC = "docs/spike/openapi.yaml";
const OUT = "packages/core/src/zg/generated/router.ts";

const arg = process.argv[2];
const source = arg ?? (existsSync(LOCAL_SPEC) ? LOCAL_SPEC : OFFICIAL_URL);
const input = /^https?:\/\//.test(source) ? new URL(source) : pathToFileURL(source);

const header = `/**
 * GENERATED FILE — do not edit by hand.
 * Source: official 0G Router OpenAPI spec (${OFFICIAL_URL}).
 * Regenerate with: pnpm gen:router-types
 * The spec is the source of truth: if it disagrees with docs/SHIFT_PLAN.md, the spec wins.
 * Some schemas are loose in the spec (e.g. /v1/decisions); the hand-written client validates the verified shapes.
 */
`;

const ast = await openapiTS(input);
mkdirSync(dirname(OUT), { recursive: true });
writeFileSync(OUT, header + astToString(ast));
console.log(`Wrote ${OUT} from ${source}`);
