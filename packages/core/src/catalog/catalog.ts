import type { Model } from "../zg/schemas";

/** Prices are kept as integers in atto-USD (1e-18 USD) so per-token prices like 0.00000008 stay exact. */
export const ATTO_PER_USD = 10n ** 18n;
export const ATTO_PER_MICRO = 10n ** 12n;

export type ModelKind = "chat" | "transcribe" | "image" | "decision";
/** Lower is stricter: TeeML runs inside a TEE the Router can attest, TeeTLS is attested end to end over TLS. */
export type TrustLevel = "private" | "verified" | "standard";
export const TRUST_RANK: Record<TrustLevel, number> = { private: 0, verified: 1, standard: 2 };

export interface CatalogEntry {
  id: string;
  kind: ModelKind;
  trust: TrustLevel;
  contextLength?: number;
  /** atto-USD per input token. For transcription models the Router lists the rate in the same `prompt` field (see note below). */
  promptAtto: bigint;
  completionAtto: bigint;
  /** atto-USD per generated image, for image models. */
  imageAtto: bigint;
  /** Largest `n` the model accepts per request. */
  maxImages?: number;
}

const KIND_BY_TYPE: Record<string, ModelKind> = {
  chatbot: "chat",
  "speech-to-text": "transcribe",
  "text-to-image": "image",
  decisions: "decision",
};

/** Parses a decimal string such as "0.00000048" into atto-USD without going through floating point. */
export function usdStringToAtto(value: unknown): bigint {
  if (typeof value === "number") value = String(value);
  if (typeof value !== "string" || !/^\d+(\.\d+)?$/.test(value.trim())) return 0n;
  const [whole = "0", frac = ""] = value.trim().split(".");
  return BigInt(whole) * ATTO_PER_USD + BigInt(frac.padEnd(18, "0").slice(0, 18));
}

export function trustOf(verifiability: string | undefined): TrustLevel {
  if (verifiability === "TeeML") return "private";
  if (verifiability === "TeeTLS") return "verified";
  return "standard";
}

/**
 * Turns the Router's model list into the entries Shift can plan with. Types Shift does not use (video, speech output,
 * embeddings) are dropped. NOTE: the unit of a transcription model's price is not documented (U-open); it is read from
 * `pricing_usd.prompt` and treated as USD per second of audio by the estimator.
 */
export function buildCatalog(models: Model[]): CatalogEntry[] {
  const entries: CatalogEntry[] = [];
  for (const m of models) {
    const kind = KIND_BY_TYPE[m.type];
    if (!kind) continue;
    const p = (m.pricing_usd ?? {}) as Record<string, unknown>;
    const caps = (m as { image_capabilities?: { max_n?: unknown } }).image_capabilities;
    const contextLength = (m as { context_length?: unknown }).context_length;
    entries.push({
      id: m.id,
      kind,
      trust: trustOf(m.verifiability),
      ...(typeof contextLength === "number" ? { contextLength } : {}),
      promptAtto: usdStringToAtto(p["prompt"]),
      completionAtto: usdStringToAtto(p["completion"]),
      imageAtto: usdStringToAtto(p["image"]),
      ...(typeof caps?.max_n === "number" ? { maxImages: caps.max_n } : {}),
    });
  }
  return entries;
}

/** Models of one kind that satisfy a trust mode, i.e. at least as strict as the mode asks for. */
export function candidates(catalog: CatalogEntry[], kind: ModelKind, mode: TrustLevel): CatalogEntry[] {
  return catalog.filter((e) => e.kind === kind && TRUST_RANK[e.trust] <= TRUST_RANK[mode]);
}

/** Rounds atto-USD up to whole micro-USD, so a cost is never under-reported. */
export function attoToMicroCeil(atto: bigint): bigint {
  return (atto + ATTO_PER_MICRO - 1n) / ATTO_PER_MICRO;
}
