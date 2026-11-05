import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "./generated/client";

export { PrismaClient };
export * from "./generated/enums";

/** Creates a Prisma client over a pooled PostgreSQL connection. Server-side only. */
export function createDb(connectionString: string): PrismaClient {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}
export type { User } from "./generated/client";
