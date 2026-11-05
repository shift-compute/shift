import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import path from "node:path";

// The repo keeps a single .env at its root, shared with the worker and the scripts; Next only looks in apps/web by default.
loadEnvConfig(path.resolve(import.meta.dirname, "../.."));

const config: NextConfig = {
  reactStrictMode: true,
  // @shift/core ships TypeScript sources. Only server code may import it: it holds the vault and the Router client.
  transpilePackages: ["@shift/core"],
};

export default config;
