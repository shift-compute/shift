import { MAX_DOC_CHARS } from "../executors/doc-limits";
import type { TaskTypeName } from "../tasks/task-input";
import { attoToMicroCeil, type CatalogEntry } from "./catalog";

/** Rough, documented assumptions. The estimator is only used to plan; real cost is read from the Router after each call. */
export const ASSUMPTIONS = {
  /** Compressed audio (mp3/m4a) at about 128 kbit/s; WAV at 16 kHz 16-bit mono. */
  compressedBytesPerSecond: 16_000,
  wavBytesPerSecond: 32_000,
  /** Spoken language is about 150 words a minute, so roughly 15 characters a second. */
  transcriptCharsPerSecond: 15,
  charsPerToken: 4,
  /** System prompt and framing added to every chat call. */
  promptOverheadTokens: 150,
  summaryOutputTokens: 400,
  analysisOutputTokens: 700,
  refineOutputTokens: 120,
  /** Uploaded PDFs carry markup and fonts: assume 30% of their bytes are text. */
  pdfTextRatio: 0.3,
  /** Plan with 15% more than the estimate (plan §10.3). */
  safetyPercent: 115n,
} as const;

export interface TaskSize {
  bytes: number;
  mime?: string;
  /** Characters of text, when known (documents after extraction). */
  chars?: number;
  /** Seconds of audio, when known. */
  durationSec?: number;
  prompt?: string;
}

export interface EstimateModels {
  chat: CatalogEntry;
  transcribe?: CatalogEntry;
  image?: CatalogEntry;
}

export function estimateAudioSeconds(size: Pick<TaskSize, "bytes" | "mime" | "durationSec">): number {
  if (size.durationSec !== undefined && Number.isFinite(size.durationSec)) return Math.max(1, Math.ceil(size.durationSec));
  const rate = size.mime === "audio/wav" ? ASSUMPTIONS.wavBytesPerSecond : ASSUMPTIONS.compressedBytesPerSecond;
  const bytes = Number.isFinite(size.bytes) && size.bytes > 0 ? size.bytes : 0;
  return Math.max(1, Math.ceil(bytes / rate));
}

export function estimateDocChars(size: Pick<TaskSize, "bytes" | "mime" | "chars">): number {
  const bytes = Number.isFinite(size.bytes) && size.bytes > 0 ? size.bytes : 0;
  const known = size.chars !== undefined && Number.isFinite(size.chars) ? size.chars : undefined;
  const raw = known ?? (size.mime === "application/pdf" ? Math.ceil(bytes * ASSUMPTIONS.pdfTextRatio) : bytes);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  return Math.min(raw, MAX_DOC_CHARS);
}

const tokens = (chars: number) => (Number.isFinite(chars) && chars > 0 ? Math.ceil(chars / ASSUMPTIONS.charsPerToken) : 0);

function count(n: number): bigint {
  if (!Number.isSafeInteger(n) || n < 0) throw new Error("This input is too large to estimate.");
  return BigInt(n);
}

function chatAtto(model: CatalogEntry, tokensIn: number, tokensOut: number): bigint {
  return count(tokensIn) * model.promptAtto + count(tokensOut) * model.completionAtto;
}

function requireKind(model: CatalogEntry | undefined, kind: CatalogEntry["kind"], message: string): CatalogEntry {
  if (!model || model.kind !== kind) throw new Error(message);
  return model;
}

/** ×1.15, then round up to whole micro-USD. A positive remainder is never dropped; zero stays zero. */
function withSafetyMicro(atto: bigint): bigint {
  return attoToMicroCeil((atto * ASSUMPTIONS.safetyPercent) / 100n);
}

/**
 * Estimated cost of one task with one choice of models, in micro-USD.
 * Planning only: the Router reports the real cost after the call.
 *
 * Transcription reads `pricing_usd.prompt` as USD per second. The Router does not document that unit.
 * Image cost is the flat per-image price plus the refine chat the executor runs. The TeeML image model
 * publishes no size-tier variants. If an image model bills input tokens, those are the planned revised prompt.
 */
export function estimateCostMicro(type: TaskTypeName, size: TaskSize, models: EstimateModels): bigint {
  const chat = requireKind(models.chat, "chat", "A chat model is required to estimate this task.");
  let atto: bigint;
  switch (type) {
    case "AUDIO_SUMMARY": {
      const transcribe = requireKind(models.transcribe, "transcribe", "A transcription model is required to estimate an audio task.");
      const seconds = estimateAudioSeconds(size);
      const transcriptTokens = tokens(seconds * ASSUMPTIONS.transcriptCharsPerSecond);
      atto = count(seconds) * transcribe.promptAtto + chatAtto(chat, transcriptTokens + ASSUMPTIONS.promptOverheadTokens, ASSUMPTIONS.summaryOutputTokens);
      break;
    }
    case "DOC_ANALYSIS":
      atto = chatAtto(chat, tokens(estimateDocChars(size)) + ASSUMPTIONS.promptOverheadTokens, ASSUMPTIONS.analysisOutputTokens);
      break;
    case "IMAGE_FROM_PROMPT": {
      const image = requireKind(models.image, "image", "An image model is required to estimate an image task.");
      const promptTokens = tokens(size.prompt?.length ?? 0) + ASSUMPTIONS.promptOverheadTokens;
      atto = chatAtto(chat, promptTokens, ASSUMPTIONS.refineOutputTokens) + image.imageAtto + count(ASSUMPTIONS.refineOutputTokens) * image.promptAtto;
      break;
    }
  }
  return withSafetyMicro(atto);
}

/**
 * Estimated cost of one decision-model call, in micro-USD (plan §10.3).
 * Laya and Vela are billed on input tokens, so `chars` is the state plus the question text the caller will send.
 * Output tokens are not invented: both TeeML decision models publish a completion price of 0.
 * Same ×1.15 padding and ceil as task estimates. Planning only — F3.3 deducts this from the night budget.
 */
export function estimateDecisionMicro(model: CatalogEntry, chars: number): bigint {
  const decision = requireKind(model, "decision", "A decision model is required to estimate a decision call.");
  if (!Number.isFinite(chars) || chars < 0) throw new Error("Decision input length must be a non-negative finite number of characters.");
  return withSafetyMicro(chatAtto(decision, tokens(chars), 0));
}
