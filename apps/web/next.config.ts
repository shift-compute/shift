import { loadEnvConfig } from "@next/env";
import type { NextConfig } from "next";
import path from "node:path";

// The repo keeps a single .env at its root, shared with the worker and the scripts; Next only looks in apps/web by default.
loadEnvConfig(path.resolve(import.meta.dirname, "../.."));

const config: NextConfig = {
  reactStrictMode: true,
  // @shift/core ships TypeScript sources. Only server code may import it: it holds the vault and the Router client.
  transpilePackages: ["@shift/core"],
  webpack: (webpackConfig, { isServer }) => {
    // pdf-parse's ESM build throws when webpack evaluates it. API routes import @shift/core,
    // so the server bundle loads the package from Node instead.
    if (isServer && Array.isArray(webpackConfig.externals)) {
      webpackConfig.externals.push(({ request }: { request?: string }, callback: (err?: Error | null, result?: string) => void) => {
        if (request === "pdf-parse") {
          callback(null, "commonjs pdf-parse");
          return;
        }
        callback();
      });
    }
    return webpackConfig;
  },
};

export default config;
