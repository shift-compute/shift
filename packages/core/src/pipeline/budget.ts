import { usdStringToAtto } from "../catalog/catalog";

/**
 * Turns a live balance into the two numbers the night needs: the optimizer's budget in micro-USD, and the
 * `credit_limit` for the ephemeral key in the account's own units.
 *
 * iAI mode spends `credit_balance` only, minus the safety margin (plan §8.3). Budget mode may also spend the
 * deposit, up to the user's nightly cap. A 0G balance is wei and catalog prices are USD, so the conversion uses the
 * rate implied by models that publish both `pricing` (wei) and `pricing_usd`. No rate is ever hardcoded: if the
 * catalog does not imply one, the user is skipped visibly.
 */

const WEI_PER_OG = 10n ** 18n;
const MICRO_PER_USD = 1_000_000n;

/** Smallest `credit_limit` the Router accepted for a 0G account (0.0001 0G). Verified while connecting accounts. */
export const MIN_OG_WEI = 100_000_000_000_000n;
/**
 * Smallest limit we send for a USD account. The Router's USD minimum is not verified; this is the same 0.01
 * the connection probe uses, and we refuse to create a key below it.
 */
export const MIN_USD_MICRO = 10_000n;

export interface PricePair {
  pricing?: { prompt?: unknown; completion?: unknown; image?: unknown } | null;
  pricing_usd?: { prompt?: unknown; completion?: unknown; image?: unknown } | null;
}

export type BudgetDecision =
  | { ok: true; budgetMicro: bigint; creditLimit: string; nativeAmount: bigint }
  | { ok: false; reason: "below_minimum" | "no_rate" | "unreadable_balance" | "unsupported_currency" | "missing_cap"; detail: string };

/** Decimal string in `decimals` fractional digits, trailing zeros removed. `formatUnits(1500000n, 6)` is `"1.5"`. */
export function formatUnits(amount: bigint, decimals: number): string {
  if (amount < 0n) throw new Error("formatUnits received a negative amount.");
  const scale = 10n ** BigInt(decimals);
  const whole = amount / scale;
  const frac = (amount % scale).toString().padStart(decimals, "0").replace(/0+$/, "");
  return frac.length === 0 ? whole.toString() : `${whole}.${frac}`;
}

function integerAmount(value: string): bigint | undefined {
  return /^\d+$/.test(value) ? BigInt(value) : undefined;
}

function nativeWei(value: unknown): bigint | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const wei = BigInt(value);
  return wei === 0n ? undefined : wei;
}

/**
 * micro-USD per 1 0G, from every model that prices the same unit in wei and in USD.
 * The median's lower middle value is used so the rate is never rounded up. Undefined when nothing usable is published.
 */
export function impliedMicroUsdPerOg(models: readonly PricePair[]): bigint | undefined {
  const rates: bigint[] = [];
  for (const model of models) {
    for (const field of ["prompt", "completion", "image"] as const) {
      const wei = nativeWei(model.pricing?.[field]);
      const atto = usdStringToAtto(model.pricing_usd?.[field]);
      if (wei === undefined || atto === 0n) continue;
      // atto-USD per wei, scaled to micro-USD per 1e18 wei.
      const rate = (atto * MICRO_PER_USD) / wei;
      if (rate > 0n) rates.push(rate);
    }
  }
  if (rates.length === 0) return undefined;
  rates.sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const mid = Math.floor(rates.length / 2);
  return rates.length % 2 === 1 ? rates[mid] : rates[mid - 1];
}

export interface BudgetInput {
  mode: "IAI_CREDITS_ONLY" | "BUDGET";
  /** From `GET /v1/account/balance`. `"0g"` amounts are wei; `"usd"` amounts are micro-USD. */
  currency: string;
  creditBalance: string;
  depositBalance: string;
  nightlyBudgetUsdMicro: bigint | null;
  marginPct: number;
  /** Required for 0G accounts. Ignored for USD accounts, whose balance is already micro-USD. */
  microUsdPerOg?: bigint;
}

function reject(reason: Extract<BudgetDecision, { ok: false }>["reason"], detail: string): BudgetDecision {
  return { ok: false, reason, detail };
}

/**
 * Decides whether this user can run tonight.
 * The key limit is formatted the way a verified create call sends it: a decimal string ("0.0001" 0G, "1.5" USD),
 * not a raw wei integer.
 */
export function decideBudget(input: BudgetInput): BudgetDecision {
  const currency = input.currency.toLowerCase();
  if (currency !== "0g" && currency !== "usd") {
    return reject("unsupported_currency", `Accounts settling in "${input.currency}" are not supported.`);
  }
  const credit = integerAmount(input.creditBalance);
  const deposit = integerAmount(input.depositBalance);
  if (credit === undefined || deposit === undefined) {
    return reject("unreadable_balance", "The Router balance was not an integer amount of wei or micro-USD, so no key was created.");
  }

  const margin = input.mode === "IAI_CREDITS_ONLY" ? input.marginPct : 0;
  // iAI credits expire; the deposit is the user's own money and is never part of this mode.
  const spendable = input.mode === "IAI_CREDITS_ONLY" ? credit : credit + deposit;
  let native = (spendable * BigInt(100 - margin)) / 100n;

  if (input.mode === "BUDGET") {
    if (input.nightlyBudgetUsdMicro === null || input.nightlyBudgetUsdMicro <= 0n) {
      return reject("missing_cap", "Budget mode has no nightly cap, so no key was created.");
    }
    const capNative = currency === "usd" ? input.nightlyBudgetUsdMicro : nativeFromMicro(input.nightlyBudgetUsdMicro, input.microUsdPerOg);
    if (capNative === undefined) {
      return reject("no_rate", "The catalog has no 0G price next to a USD price, so the nightly cap cannot be converted without inventing a rate.");
    }
    if (capNative < native) native = capNative;
  }

  if (currency === "0g" && input.microUsdPerOg === undefined && input.mode === "IAI_CREDITS_ONLY") {
    return reject("no_rate", "The catalog has no 0G price next to a USD price, so the credit balance cannot be converted without inventing a rate.");
  }

  const minimum = currency === "0g" ? MIN_OG_WEI : MIN_USD_MICRO;
  if (native < minimum) {
    const unit = currency === "0g" ? "0G" : "USD";
    const decimals = currency === "0g" ? 18 : 6;
    return reject("below_minimum", `Spendable amount ${formatUnits(native, decimals)} ${unit} is below the minimum key limit of ${formatUnits(minimum, decimals)} ${unit}.`);
  }

  const budgetMicro = currency === "usd" ? native : nativeToMicro(native, input.microUsdPerOg as bigint);
  return {
    ok: true,
    budgetMicro,
    nativeAmount: native,
    creditLimit: formatUnits(native, currency === "0g" ? 18 : 6),
  };
}

function nativeFromMicro(micro: bigint, microUsdPerOg: bigint | undefined): bigint | undefined {
  if (microUsdPerOg === undefined || microUsdPerOg === 0n) return undefined;
  return (micro * WEI_PER_OG) / microUsdPerOg;
}

function nativeToMicro(wei: bigint, microUsdPerOg: bigint): bigint {
  return (wei * microUsdPerOg) / WEI_PER_OG;
}
