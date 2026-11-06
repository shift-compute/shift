import { z } from "zod";
import { formatAmount } from "../../lib/format";
import type { Mode } from "./settings";

/**
 * What `GET /api/session` returns, plus the signed-out body.
 * The management key is not part of this shape.
 */
export interface SessionProp {
  connected: boolean;
  account?: { address: string; currency: string };
  mode?: string;
  donateLeftover?: boolean;
  nightlyBudgetUsdMicro?: string | null;
}

export interface SavedSettings {
  mode: Mode;
  budgetText: string;
  donateLeftover: boolean;
}

export type SessionScreen =
  | { phase: "signed_out" }
  | { phase: "connected"; address: string; currency: string; settings: SavedSettings }
  | { phase: "unreadable" };

const connectedSchema = z.object({
  connected: z.literal(true),
  account: z.object({
    address: z.string().min(1),
    currency: z.string().min(1),
  }),
  mode: z.enum(["IAI_CREDITS_ONLY", "BUDGET"]),
  donateLeftover: z.boolean(),
  nightlyBudgetUsdMicro: z.string().regex(/^\d+$/).nullable(),
});

/**
 * The signed-in row is the source of truth. A body this page cannot read stays
 * off the paste form, so a failed read does not ask for the management key again.
 */
export function readSession(body: unknown): SessionScreen {
  if (!body || typeof body !== "object") return { phase: "unreadable" };
  if ((body as { connected?: unknown }).connected === false) return { phase: "signed_out" };
  const parsed = connectedSchema.safeParse(body);
  if (!parsed.success) return { phase: "unreadable" };
  return {
    phase: "connected",
    address: parsed.data.account.address,
    currency: parsed.data.account.currency,
    settings: {
      mode: parsed.data.mode,
      budgetText: microToBudgetInput(parsed.data.nightlyBudgetUsdMicro),
      donateLeftover: parsed.data.donateLeftover,
    },
  };
}

/** Exact dollars from a stored micro-USD integer. 200000 → "0.2". */
export function microToBudgetInput(micro: string | null): string {
  if (micro === null || !/^\d+$/.test(micro)) return "";
  const digits = (micro.replace(/^0+/, "") || "0").padStart(7, "0");
  const whole = digits.slice(0, -6);
  const frac = digits.slice(-6).replace(/0+$/, "");
  return frac ? `${whole}.${frac}` : whole;
}

const accountSchema = z.object({
  currency: z.string().min(1),
  balance: z.object({
    credit: z.string(),
    deposit: z.string(),
  }),
});

/** Live `/api/account` balances, formatted from Router base units. */
export function presentAccountBalances(body: unknown): { credit: string; deposit: string } | null {
  const parsed = accountSchema.safeParse(body);
  if (!parsed.success) return null;
  return {
    credit: formatAmount(parsed.data.balance.credit, parsed.data.currency),
    deposit: formatAmount(parsed.data.balance.deposit, parsed.data.currency),
  };
}

/** Balances returned once by `POST /api/connect`, in the same base units. */
export function presentConnectBalances(account: { currency: string; creditBalance: string; depositBalance: string }): { credit: string; deposit: string } {
  return {
    credit: formatAmount(account.creditBalance, account.currency),
    deposit: formatAmount(account.depositBalance, account.currency),
  };
}
