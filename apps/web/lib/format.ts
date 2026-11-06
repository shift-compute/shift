/** Decimals of the integer amounts the Router returns: wei for 0G accounts, micro-USD for USD accounts. */
const DECIMALS: Record<string, number> = { "0g": 18, usd: 6 };
const SYMBOLS: Record<string, string> = { "0g": "0G", usd: "USD" };

/**
 * Formats a balance from the Router for display. The Router sends integer strings in base units (wei or micro-USD),
 * so "5000000" on a USD account is 5 USD. Truncates (never rounds up) to `maxDecimals`; BigInt keeps 18-decimal
 * values exact where floats cannot.
 */
export function formatAmount(value: string, currency: string, maxDecimals = 6): string {
  const key = currency.toLowerCase();
  const decimals = DECIMALS[key] ?? 0;
  const symbol = SYMBOLS[key] ?? currency.toUpperCase();
  if (!/^\d+$/.test(value)) return `${value} ${symbol}`;

  const digits = value.padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  const frac = digits.slice(digits.length - decimals, digits.length - decimals + maxDecimals).replace(/0+$/, "");
  return `${frac ? `${whole}.${frac}` : whole} ${symbol}`;
}
