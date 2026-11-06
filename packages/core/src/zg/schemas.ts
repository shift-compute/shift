import { z } from "zod";

/**
 * Response shapes verified against the real Router in Phase 0 (docs/SPIKE_RESULTS.md).
 * Objects are loose on purpose: extra fields are kept, only what Shift relies on is required.
 * Amounts are integer strings in base units. OpenAPI: "0g" is wei, "usd" is micro-USD (USD × 1e6).
 */

export const accountSchema = z.looseObject({
  address: z.string(),
  created_at: z.string().optional(),
  onboarded_at: z.string().nullable().optional(),
  og_mode_available: z.boolean().optional(),
});

export const balanceSchema = z.looseObject({
  address: z.string(),
  currency: z.string(),
  deposit_balance: z.string(),
  credit_balance: z.string(),
  pending_charge: z.string(),
  total_balance: z.string(),
});

export const fundsSchema = z.looseObject({
  address: z.string(),
  currency: z.string(),
  total: z.string(),
  router: z.looseObject({ deposit: z.string(), credit: z.string(), pending_charge: z.string() }).optional(),
  /** The vault shared across 0G products. Spendable on 0G accounts but not part of the Router ledger balance. */
  payment_layer: z.looseObject({ balance: z.string() }).optional(),
});

/** `key` is the only usable secret and is returned once; `key_preview` is truncated and unusable. */
export const apiKeyCreatedSchema = z.looseObject({
  key_id: z.string(),
  key: z.string().regex(/^sk-[A-Za-z0-9._-]+$/, "must be a full sk- key, not a truncated preview"),
  name: z.string(),
  credit_limit: z.string().nullable().optional(),
  currency: z.string().optional(),
  trust_mode: z.string().optional(),
  status: z.string().optional(),
  created_at: z.string().optional(),
});

export const apiKeyRevokedSchema = z.looseObject({ key_id: z.string() });

export const modelSchema = z.looseObject({
  id: z.string(),
  type: z.string(),
  /** Absent on the reduced catalog (see PROGRESS blockers). Null is treated the same as missing. */
  verifiability: z.string().nullish(),
  context_length: z.number().optional(),
  image_capabilities: z.looseObject({ max_n: z.number().optional() }).optional(),
  /** Native price in wei for a 0G account. Paired with `pricing_usd` to imply the conversion rate. */
  pricing: z.record(z.string(), z.unknown()).nullish(),
  pricing_usd: z.record(z.string(), z.unknown()).nullish(),
});

export const modelsListSchema = z.looseObject({ data: z.array(modelSchema) });

export const usageRowSchema = z.looseObject({
  request_id: z.string(),
  model_id: z.string().optional(),
  api_key_id: z.string().optional(),
  cost: z.string().optional(),
  credit_used: z.string().optional(),
  deposit_used: z.string().optional(),
});

export const usageHistorySchema = z.looseObject({ data: z.array(usageRowSchema) });

/** Answer to one decision question. For `choice`, `probabilities` maps each label to its probability. */
export const decisionAnswerSchema = z.looseObject({
  type: z.string(),
  choice: z.string().optional(),
  probabilities: z.record(z.string(), z.number()).optional(),
  confidence: z.number().optional(),
});

export const decisionsResponseSchema = z.looseObject({
  model: z.string(),
  answers: z.record(z.string(), decisionAnswerSchema),
});

/**
 * `x_0g_trace` is present on inference responses. Its exact shape is still being verified (U8, blocked by a 0 balance),
 * so every field is optional and unknown fields are kept.
 */
export const traceSchema = z.looseObject({
  request_id: z.string().optional(),
  provider: z.string().optional(),
  provider_identity: z.string().optional(),
  tee_verified: z.boolean().optional(),
  billing: z
    .looseObject({
      input_cost: z.union([z.string(), z.number()]).optional(),
      output_cost: z.union([z.string(), z.number()]).optional(),
      total_cost: z.union([z.string(), z.number()]).optional(),
      currency: z.string().optional(),
      total_cost_usd_micro: z.union([z.string(), z.number()]).optional(),
    })
    .optional(),
});

export type Account = z.infer<typeof accountSchema>;
export type Balance = z.infer<typeof balanceSchema>;
export type Funds = z.infer<typeof fundsSchema>;
export type ApiKeyCreated = z.infer<typeof apiKeyCreatedSchema>;
export type Model = z.infer<typeof modelSchema>;
export type UsageRow = z.infer<typeof usageRowSchema>;
export type DecisionsResponse = z.infer<typeof decisionsResponseSchema>;
export type Trace = z.infer<typeof traceSchema>;
