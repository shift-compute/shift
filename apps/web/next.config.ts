import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  // @shift/core ships TypeScript sources. Only server code may import it: it holds the vault and the Router client.
  transpilePackages: ["@shift/core"],
};

export default config;
