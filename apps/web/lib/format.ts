const SYMBOLS: Record<string, string> = { "0g": "0G", usd: "USD" };

/**
 * Formats an amount string from the Router for display, truncating (never rounding up) to `maxDecimals`.
 * Amounts stay strings end to end: 0G balances can carry up to 18 decimals, which floats cannot hold.
 */
export function formatAmount(value: string, currency: string, maxDecimals = 6): string {
  const [whole = "0", frac = ""] = value.split(".");
  const trimmed = frac.slice(0, maxDecimals).replace(/0+$/, "");
  const number = trimmed ? `${whole}.${trimmed}` : whole;
  return `${number} ${SYMBOLS[currency.toLowerCase()] ?? currency.toUpperCase()}`;
}
