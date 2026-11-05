import { defineConfig } from "prisma/config";
import { loadDotEnv } from "./scripts/lib/env";

// Prisma 7 does not read .env by itself; load it so `pnpm db:*` works with the same file as the rest of the project.
loadDotEnv();

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL ?? "" },
});
