import { getAddress } from "viem";
import type { CommonsDonor, CommonsItemPublic, CommonsResponse } from "./commons-response";

/** Finished commons rows only. Translation B, request ids and the donor user id stay on the server. */
export const COMMONS_ITEM_SELECT = {
  id: true,
  status: true,
  sourceText: true,
  translationA: true,
  targetLang: true,
  modelA: true,
  modelB: true,
  gateModel: true,
  gateProbability: true,
  outputRoot: true,
} as const;

/** Positive donations. The vault, the ephemeral key and the balance blobs stay on the server. */
export const COMMONS_DONATION_SELECT = {
  donatedUsdMicro: true,
  user: { select: { accountAddress: true } },
} as const;

/** The seeded corpus is 200 paragraphs. The cap keeps a public read bounded. */
export const COMMONS_LIST_LIMIT = 500;

const SOURCE_MAX = 600;
const TRANSLATION_MAX = 1200;
const ADDRESS = /^0x[0-9a-fA-F]{40}$/;

export interface CommonsItemRow {
  id: string;
  status: string;
  sourceText: string;
  translationA: string | null;
  targetLang: string;
  modelA: string | null;
  modelB: string | null;
  gateModel: string | null;
  gateProbability: number | null;
  outputRoot: string | null;
}

export interface CommonsDonationRow {
  donatedUsdMicro: bigint;
  user: { accountAddress: string };
}

/**
 * JSON for `GET /api/commons`.
 * Only ACCEPTED and REJECTED rows in Hindi or Marathi are published.
 * Prose that contains a management or inference key is redacted. A model id or a storage root that contains one is dropped.
 * Donor totals sum `donatedUsdMicro` by account address. A non-address, and a non-positive amount, are left out.
 */
export function commonsBody(input: { items: CommonsItemRow[]; donations: CommonsDonationRow[]; failedCount?: number }): CommonsResponse {
  const items = input.items.flatMap(oneItem);
  const donors = donorsOf(input.donations);
  const total = donors.reduce((sum, donor) => sum + BigInt(donor.donatedUsdMicro), 0n);
  const failed = Number.isInteger(input.failedCount) && (input.failedCount ?? 0) >= 0 ? (input.failedCount as number) : 0;
  return { items, donors, totalDonatedUsdMicro: total.toString(), failedCount: failed };
}

function oneItem(row: CommonsItemRow): CommonsItemPublic[] {
  if (row.status !== "ACCEPTED" && row.status !== "REJECTED") return [];
  const lang = row.targetLang.trim().toLowerCase();
  if (lang !== "hi" && lang !== "mr") return [];
  const id = publicToken(row.id);
  if (!id) return [];
  return [
    {
      id,
      status: row.status,
      sourceExcerpt: excerpt(row.sourceText, SOURCE_MAX),
      translationA: row.translationA === null ? null : prose(row.translationA, TRANSLATION_MAX),
      targetLang: lang,
      modelA: modelOf(row.modelA),
      modelB: modelOf(row.modelB),
      gateModel: modelOf(row.gateModel),
      gateProbability: probabilityOf(row.gateProbability),
      outputRoot: publicHash(row.outputRoot),
    },
  ];
}

function donorsOf(rows: CommonsDonationRow[]): CommonsDonor[] {
  const totals = new Map<string, { address: string; amount: bigint }>();
  for (const row of rows) {
    if (row.donatedUsdMicro <= 0n) continue;
    const address = publicAddress(row.user.accountAddress);
    if (!address) continue;
    const key = address.toLowerCase();
    const existing = totals.get(key);
    if (existing) existing.amount += row.donatedUsdMicro;
    else totals.set(key, { address, amount: row.donatedUsdMicro });
  }
  return [...totals.values()]
    .sort((a, b) => {
      if (a.amount === b.amount) return a.address.toLowerCase().localeCompare(b.address.toLowerCase());
      return a.amount > b.amount ? -1 : 1;
    })
    .map((donor) => ({ address: donor.address, donatedUsdMicro: donor.amount.toString() }));
}

function probabilityOf(value: number | null): number | null {
  if (value === null || !Number.isFinite(value) || value < 0 || value > 1) return null;
  return value;
}

function modelOf(value: string | null): string | null {
  if (value === null) return null;
  return publicToken(value);
}

function excerpt(value: string, max: number): string {
  return clip(stripSecrets(value).replace(/\s+/g, " ").trim(), max);
}

function prose(value: string, max: number): string | null {
  const cleaned = clip(stripSecrets(value).replace(/\s+/g, " ").trim(), max);
  return cleaned.length === 0 ? null : cleaned;
}

function publicAddress(value: string): string | null {
  const cleaned = value.trim();
  if (!ADDRESS.test(cleaned) || hasSecret(cleaned)) return null;
  try {
    return getAddress(cleaned);
  } catch {
    return null;
  }
}

/** A hash or an id. A value that contains a key is dropped rather than published in redacted form. */
function publicHash(value: string | null): string | null {
  if (value === null || value.length === 0 || value.length > 200 || hasSecret(value)) return null;
  return value;
}

function publicToken(value: string): string | null {
  if (hasSecret(value)) return null;
  const cleaned = value.trim();
  if (cleaned.length === 0 || cleaned.length > 200) return null;
  return cleaned;
}

function hasSecret(value: string): boolean {
  // "task-1" and "mask-large" are not keys. A word boundary misses a key glued to hex ("0xmk-...").
  // Requiring six characters after the hyphen keeps "mask-large" (five) while still catching that form.
  return /\b(?:sk|mk)-/.test(value) || /(?:sk|mk)-[A-Za-z0-9._-]{6,}/.test(value);
}

function stripSecrets(value: string): string {
  return value.replace(/\b(?:sk|mk)-[A-Za-z0-9._[\]-]*/g, "[redacted]").replace(/(?:sk|mk)-[A-Za-z0-9._-]{6,}/g, "[redacted]");
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
