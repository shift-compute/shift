/**
 * Plan §10.4, as integer percent: replan when the reported cost is strictly above 1.2× the estimate.
 * Compared as `actual * 100 > estimate * COST_DRIFT_PERCENT`, so 1.2× exactly does not replan.
 */
export const COST_DRIFT_PERCENT = 120n;

/**
 * Whether one finished task should recompute the rest of the night (plan §10.4).
 * A missing report does not replan: the pipeline keeps the estimate and continues.
 * An estimate of 0 replans on any positive report, because 1.2 × 0 is still 0.
 */
export function costDrifted(estimateMicro: bigint, actualMicro: bigint | undefined): boolean {
  if (actualMicro === undefined) return false;
  if (estimateMicro === 0n) return actualMicro > 0n;
  return actualMicro * 100n > estimateMicro * COST_DRIFT_PERCENT;
}
