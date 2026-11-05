export type Mode = "IAI_CREDITS_ONLY" | "BUDGET";

export interface SettingsInput {
  mode: Mode;
  /** What the user typed in the budget field. */
  budgetText: string;
  donateLeftover: boolean;
}

export type SettingsPayload =
  | { ok: true; payload: { mode: Mode; nightlyBudgetUsd?: number; donateLeftover: boolean } }
  | { ok: false; message: string };

// Keep in sync with MIN_BUDGET_USD / MAX_BUDGET_USD in @shift/core (the client must not import that package).
const MIN = 0.01;
const MAX = 100;

/** Builds the body for PATCH /api/settings from the form, or explains what is wrong with it. */
export function buildSettingsPayload({ mode, budgetText, donateLeftover }: SettingsInput): SettingsPayload {
  if (mode === "IAI_CREDITS_ONLY") return { ok: true, payload: { mode, donateLeftover } };
  const text = budgetText.trim().replace(",", ".");
  const value = Number(text);
  if (text === "" || !Number.isFinite(value)) return { ok: false, message: "Enter your nightly cap in US dollars, for example 2.50." };
  if (value < MIN || value > MAX) return { ok: false, message: `The cap must be between $${MIN.toFixed(2)} and $${MAX} per night.` };
  return { ok: true, payload: { mode, nightlyBudgetUsd: value, donateLeftover } };
}
