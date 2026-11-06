import { usdStringToAtto } from "./catalog";

/**
 * 0G wei ↔ micro-USD, using only rates the catalog itself implies.
 * A model that publishes the same unit under `pricing` (wei) and `pricing_usd` is one sample.
 * Nothing here hard-codes a 0G price. No sample means the conversion fails instead of inventing a rate
 * (the same rule the night pipeline uses when it cannot cap a 0G account).
 */

export const WEI_PER_OG = 10n ** 18n;
const MICRO_PER_USD = 1_000_000n;

export interface PricePair {
  pricing?: { prompt?: unknown; completion?: unknown; image?: unknown } | Record<string, unknown> | null;
  pricing_usd?: { prompt?: unknown; completion?: unknown; image?: unknown } | Record<string, unknown> | null;
}

/** Thrown when a wei balance cannot be expressed in micro-USD without making up a 0G/USD rate. */
export class MissingCatalogRateError extends Error {
  readonly reason = "no_rate" as const;

  constructor(
    message = "The catalog has no 0G price next to a USD price, so a wei balance cannot be converted without inventing a rate.",
  ) {
    super(message);
    this.name = "MissingCatalogRateError";
  }
}

function nativeWei(value: unknown): bigint | undefined {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return undefined;
  const wei = BigInt(value);
  return wei === 0n ? undefined : wei;
}

function priceField(source: PricePair["pricing"], field: "prompt" | "completion" | "image"): unknown {
  if (source == null || typeof source !== "object") return undefined;
  return (source as Record<string, unknown>)[field];
}

/**
 * micro-USD per 1 0G. The median's lower middle value is used so the rate is never rounded up.
 * Undefined when the catalog publishes no comparable pair.
 */
export function impliedMicroUsdPerOg(models: readonly PricePair[]): bigint | undefined {
  const rates: bigint[] = [];
  for (const model of models) {
    for (const field of ["prompt", "completion", "image"] as const) {
      const wei = nativeWei(priceField(model.pricing, field));
      const atto = usdStringToAtto(priceField(model.pricing_usd, field));
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

/** The catalog rate, or {@link MissingCatalogRateError} when no pair exists. */
export function requireMicroUsdPerOg(models: readonly PricePair[]): bigint {
  const rate = impliedMicroUsdPerOg(models);
  if (rate === undefined) throw new MissingCatalogRateError();
  return rate;
}

/** Truncates. A balance is never rounded up into spend that the account does not have. */
export function weiToMicroUsd(wei: bigint, microUsdPerOg: bigint): bigint {
  if (wei < 0n) throw new Error("weiToMicroUsd received a negative amount.");
  if (microUsdPerOg < 0n) throw new Error("weiToMicroUsd received a negative rate.");
  return (wei * microUsdPerOg) / WEI_PER_OG;
}

/** Truncates. The key limit is never rounded up past the USD cap. */
export function microUsdToWei(micro: bigint, microUsdPerOg: bigint): bigint {
  if (micro < 0n) throw new Error("microUsdToWei received a negative amount.");
  if (microUsdPerOg <= 0n) throw new MissingCatalogRateError();
  return (micro * WEI_PER_OG) / microUsdPerOg;
}

/** Wei balance → micro-USD at the catalog's implied rate. Fails when the catalog has no pair. */
export function ogWeiToMicroUsd(wei: bigint, models: readonly PricePair[]): bigint {
  return weiToMicroUsd(wei, requireMicroUsdPerOg(models));
}

/** micro-USD cap → wei at the catalog's implied rate. Fails when the catalog has no pair. */
export function microUsdToOgWei(micro: bigint, models: readonly PricePair[]): bigint {
  return microUsdToWei(micro, requireMicroUsdPerOg(models));
}
