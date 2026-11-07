import { z } from "zod";

const LANGS = ["hi", "mr"] as const;
const STATUSES = ["ACCEPTED", "REJECTED"] as const;
const digits = z.string().regex(/^(0|[1-9]\d*)$/);
const positiveDigits = z.string().regex(/^[1-9]\d*$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);

const itemSchema = z.object({
  id: z.string().min(1).max(200),
  status: z.enum(STATUSES),
  sourceExcerpt: z.string().max(600),
  translationA: z.string().max(1200).nullable(),
  targetLang: z.enum(LANGS),
  modelA: z.string().max(200).nullable(),
  modelB: z.string().max(200).nullable(),
  gateModel: z.string().max(200).nullable(),
  gateProbability: z.number().min(0).max(1).nullable(),
  outputRoot: z.string().min(1).max(200).nullable(),
});

const donorSchema = z.object({
  address,
  donatedUsdMicro: positiveDigits,
});

/**
 * `GET /api/commons`. Public. Accepted and rejected translations, plus the
 * donated micro-USD recorded for each 0G account.
 */
export const commonsResponseSchema = z
  .object({
    items: z.array(itemSchema),
    donors: z.array(donorSchema),
    totalDonatedUsdMicro: digits,
    failedCount: z.number().int().nonnegative(),
  })
  .superRefine((body, ctx) => {
    const sum = body.donors.reduce((total, donor) => total + BigInt(donor.donatedUsdMicro), 0n);
    if (sum.toString() !== body.totalDonatedUsdMicro) {
      ctx.addIssue({ code: "custom", message: "Donor amounts must add up to the total." });
    }
  });

export type CommonsResponse = z.infer<typeof commonsResponseSchema>;
export type CommonsItemPublic = z.infer<typeof itemSchema>;
export type CommonsDonor = z.infer<typeof donorSchema>;

export type CommonsPanel =
  | { phase: "unavailable" }
  | { phase: "empty" }
  | { phase: "ready"; data: CommonsResponse };

/** Turns the commons response into the panel state. A bad body never throws into the page. */
export async function readCommons(res: Response | null): Promise<CommonsPanel> {
  if (!res || !res.ok) return { phase: "unavailable" };
  const body: unknown = await res.json().catch(() => null);
  const parsed = commonsResponseSchema.safeParse(body);
  if (!parsed.success) return { phase: "unavailable" };
  if (parsed.data.items.length === 0 && parsed.data.donors.length === 0 && parsed.data.failedCount === 0) return { phase: "empty" };
  return { phase: "ready", data: parsed.data };
}

const LANG_LABEL: Record<CommonsItemPublic["targetLang"], string> = {
  hi: "Hindi",
  mr: "Marathi",
};

export function languageLabel(lang: CommonsItemPublic["targetLang"]): string {
  return LANG_LABEL[lang];
}

export function commonsStatusLabel(status: CommonsItemPublic["status"]): string {
  return status === "ACCEPTED" ? "Accepted" : "Rejected";
}

/** One decimal percent. 0.75 is "75%"; 0.812 is "81.2%". */
export function formatProbability(value: number): string {
  const tenths = Math.round(value * 1000);
  const whole = Math.trunc(tenths / 10);
  const frac = Math.abs(tenths % 10);
  return frac === 0 ? `${whole}%` : `${whole}.${frac}%`;
}

export function modelsLabel(item: Pick<CommonsItemPublic, "modelA" | "modelB" | "gateModel">): string {
  const pair = [item.modelA, item.modelB].filter((model): model is string => model !== null);
  const translated = pair.length === 0 ? "Translation models not recorded" : pair.join(" and ");
  const gate = item.gateModel === null ? "Filter model not recorded" : `Filter: ${item.gateModel}`;
  return `${translated}. ${gate}.`;
}
