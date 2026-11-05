import { createRequire } from "node:module";
// js-sha3 ships as a dependency of @openzeppelin/merkle-tree; in the real project use viem (keccak256, toBytes).
const require = createRequire(import.meta.url);
const { keccak_256 } = require("js-sha3") as { keccak_256: (d: Uint8Array) => string };
export const toUtf8Bytes = (s: string) => new TextEncoder().encode(s);
export const keccak256 = (d: Uint8Array) => "0x" + keccak_256(d);
