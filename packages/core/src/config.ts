import { z } from "zod";

/** Thrown when environment variables are missing or invalid. Messages name variables but never echo their values (they may be secrets). */
export class ConfigError extends Error {
  constructor(readonly problems: string[]) {
    super(`Invalid environment configuration:\n${problems.map((p) => `  - ${p}`).join("\n")}`);
    this.name = "ConfigError";
  }
}

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "must be HH:MM in 24h UTC");
const url = z.url({ message: "must be a valid URL" });
const evmAddress = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x-prefixed 20-byte address");
const privateKey = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a 0x-prefixed 32-byte hex key");

/** 32 random bytes encoded as base64 (e.g. `openssl rand -base64 32`). */
const masterKey = z.string().refine((v) => /^[A-Za-z0-9+/]+={0,2}$/.test(v) && Buffer.from(v, "base64").length === 32, {
  message: "must be base64 of exactly 32 bytes",
});

/** Variables shared by the web app and the worker. */
const sharedShape = {
  DATABASE_URL: z.string().regex(/^postgres(ql)?:\/\//, "must be a postgresql:// URL"),
  SHIFT_MASTER_KEY: masterKey,
  /** Previous master key, while rows sealed with it are re-sealed under SHIFT_MASTER_KEY. */
  SHIFT_MASTER_KEY_PREV: masterKey.optional(),
  ZG_ROUTER_BASE_URL: url,
  ZG_CHAIN_ID: z.coerce.number().int().positive(),
  ZG_CHAIN_RPC_URL: url,
  ZG_EXPLORER_URL: url,
  ZG_STORAGE_INDEXER_URL: url,
  LEDGER_CONTRACT_ADDRESS: evmAddress,
  UPLOAD_DIR: z.string().min(1).default("./uploads"),
  // Shared so a manual run from the web app uses the same caps as the nightly worker.
  NIGHT_HARD_STOP_UTC: hhmm.default("23:50"),
  SAFETY_MARGIN_PCT: z.coerce.number().int().min(0).max(50).default(10),
  MAX_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(3),
  // Shared so a manual run uses the same cutoff as the nightly worker.
  COMMONS_GATE_THRESHOLD: z.coerce.number().min(0).max(1).default(0.75),
};

const webSchema = z.object({
  ...sharedShape,
  SESSION_SECRET: z.string().min(32, "must be at least 32 characters"),
  PUBLIC_APP_URL: url,
});

const workerSchema = z
  .object({
    ...sharedShape,
    OPERATOR_PRIVATE_KEY: privateKey,
    NIGHT_START_UTC: hhmm.default("23:00"),
  })
  .refine((c) => c.NIGHT_START_UTC < c.NIGHT_HARD_STOP_UTC, {
    path: ["NIGHT_HARD_STOP_UTC"],
    message: "must be later than NIGHT_START_UTC",
  });

export type WebConfig = z.infer<typeof webSchema>;
export type WorkerConfig = z.infer<typeof workerSchema>;

type Env = Record<string, string | undefined>;

function parse<T extends z.ZodType>(schema: T, env: Env): z.infer<T> {
  // Empty strings (e.g. `FOO=` in a .env file) count as missing so defaults and "required" errors apply.
  const cleaned = Object.fromEntries(Object.entries(env).filter(([, v]) => v !== undefined && v !== ""));
  const result = schema.safeParse(cleaned);
  if (!result.success) {
    throw new ConfigError(result.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`));
  }
  return result.data;
}

/** Config for the Next.js app. It deliberately has no access to the operator private key. */
export function loadWebConfig(env: Env = process.env): WebConfig {
  return parse(webSchema, env);
}

/** Config for the nightly worker. The process must not start if this throws. */
export function loadWorkerConfig(env: Env = process.env): WorkerConfig {
  return parse(workerSchema, env);
}
