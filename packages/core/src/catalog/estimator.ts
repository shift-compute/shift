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
  if (size.durationSec !== undefined) return Math.max(1, Math.ceil(size.durationSec));
  const rate = size.mime === "audio/wav" ? ASSUMPTIONS.wavBytesPerSecond : ASSUMPTIONS.compressedBytesPerSecond;
  return Math.max(1, Math.ceil(size.bytes / rate));
}

export function estimateDocChars(size: Pick<TaskSize, "bytes" | "mime" | "chars">): number {
  const raw = size.chars ?? (size.mime === "application/pdf" ? Math.ceil(size.bytes * ASSUMPTIONS.pdfTextRatio) : size.bytes);
  return Math.min(raw, MAX_DOC_CHARS);
}

const tokens = (chars: number) => Math.ceil(chars / ASSUMPTIONS.charsPerToken);

function chatAtto(model: CatalogEntry, tokensIn: number, tokensOut: number): bigint {
  return BigInt(tokensIn) * model.promptAtto + BigInt(tokensOut) * model.completionAtto;
}

/** Estimated cost of one task with one choice of models, in micro-USD, rounded up and padded by the safety factor. */
export function estimateCostMicro(type: TaskTypeName, size: TaskSize, models: EstimateModels): bigint {
  let atto: bigint;
  switch (type) {
    case "AUDIO_SUMMARY": {
      if (!models.transcribe) throw new Error("A transcription model is required to estimate an audio task.");
      const seconds = estimateAudioSeconds(size);
      const transcriptTokens = tokens(seconds * ASSUMPTIONS.transcriptCharsPerSecond);
      atto = BigInt(seconds) * models.transcribe.promptAtto + chatAtto(models.chat, transcriptTokens + ASSUMPTIONS.promptOverheadTokens, ASSUMPTIONS.summaryOutputTokens);
      break;
    }
    case "DOC_ANALYSIS":
      atto = chatAtto(models.chat, tokens(estimateDocChars(size)) + ASSUMPTIONS.promptOverheadTokens, ASSUMPTIONS.analysisOutputTokens);
      break;
    case "IMAGE_FROM_PROMPT": {
      if (!models.image) throw new Error("An image model is required to estimate an image task.");
      const promptTokens = tokens(size.prompt?.length ?? 0) + ASSUMPTIONS.promptOverheadTokens;
      atto = chatAtto(models.chat, promptTokens, ASSUMPTIONS.refineOutputTokens) + models.image.imageAtto;
      break;
    }
  }
  return attoToMicroCeil((atto * ASSUMPTIONS.safetyPercent) / 100n);
}
