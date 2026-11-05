import { z } from "zod";

export const MIN_BUDGET_USD = 0.01;
export const MAX_BUDGET_USD = 100;

/** What a user may change about how Shift spends: mode, nightly cap and whether leftovers are donated. */
export const spendingSettingsSchema = z
  .object({
    mode: z.enum(["IAI_CREDITS_ONLY", "BUDGET"]),
    /** Nightly cap in USD. Required for BUDGET mode, ignored (and cleared) for iAI mode. */
    nightlyBudgetUsd: z.number().finite().min(MIN_BUDGET_USD).max(MAX_BUDGET_USD).optional(),
    donateLeftover: z.boolean().optional(),
  })
  .refine((s) => s.mode !== "BUDGET" || s.nightlyBudgetUsd !== undefined, {
    path: ["nightlyBudgetUsd"],
    message: "is required in budget mode",
  });

export type SpendingSettings = z.infer<typeof spendingSettingsSchema>;

/** Dollars to micro-USD as an exact integer (rounds, so 0.1 + 0.2 style float noise cannot leak in). */
export function usdToMicro(usd: number): bigint {
  return BigInt(Math.round(usd * 1_000_000));
}

/** Fields to write on the user row. In iAI mode the budget is cleared so no stale cap survives a mode switch. */
export function toUserUpdate(s: SpendingSettings) {
  return {
    mode: s.mode,
    nightlyBudgetUsdMicro: s.mode === "BUDGET" ? usdToMicro(s.nightlyBudgetUsd as number) : null,
    ...(s.donateLeftover !== undefined ? { donateLeftover: s.donateLeftover } : {}),
  };
}
