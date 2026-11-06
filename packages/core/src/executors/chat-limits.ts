import { attoToMicroCeil } from "../catalog/catalog";
import { ASSUMPTIONS } from "../catalog/estimator";

/** Output cap sent on the summary chat. Planning still uses the smaller estimator assumption. */
export const SUMMARY_MAX_TOKENS = 600;
/** Output cap sent on the document-analysis chat. */
export const ANALYSIS_MAX_TOKENS = 900;
/** Output cap sent on the image-prompt refine chat. */
export const REFINE_MAX_TOKENS = 200;

/**
 * Output cap for one commons translation: about 1.5× the source tokens, and at least 1.
 * Source tokens use the same 4 characters per token as the estimator.
 */
export function translationMaxTokens(sourceChars: number): number {
  const chars = Number.isFinite(sourceChars) && sourceChars > 0 ? sourceChars : 0;
  const sourceTokens = Math.ceil(chars / ASSUMPTIONS.charsPerToken);
  return Math.max(1, Math.ceil(sourceTokens * 1.5));
}

/**
 * Worst case for a chat call that failed before a request id came back.
 * `max_tokens` is the output cap; the price is the model's completion price.
 * A zero price stays zero: a cost is not invented.
 */
export function maxTokensCostMicro(maxTokens: number, completionAtto: bigint): bigint {
  if (!Number.isSafeInteger(maxTokens) || maxTokens < 1 || completionAtto <= 0n) return 0n;
  return attoToMicroCeil(BigInt(maxTokens) * completionAtto);
}
