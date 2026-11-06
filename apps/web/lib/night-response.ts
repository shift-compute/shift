import { z } from "zod";

const TRUST = ["private", "verified", "standard"] as const;
const TASK_TYPE = ["AUDIO_SUMMARY", "DOC_ANALYSIS", "IMAGE_FROM_PROMPT"] as const;
const NIGHT_STATUS = ["PENDING", "RUNNING", "ANCHORING", "DONE", "FAILED"] as const;
const digits = z.string().regex(/^\d+$/);

const stepSchema = z.object({
  step: z.string(),
  model: z.string(),
  trust: z.enum(TRUST).nullable(),
  requestId: z.string().nullable(),
  /** `true` verified, `false` a bad attestation, `null` when the trace carried no verdict. */
  teeVerified: z.boolean().nullable(),
  costUsdMicro: digits.nullable(),
});

const taskSchema = z.object({
  id: z.string(),
  type: z.enum(TASK_TYPE),
  status: z.string(),
  prompt: z.string().nullable(),
  chosenModel: z.string().nullable(),
  outputRoot: z.string().nullable(),
  actualCostUsdMicro: digits.nullable(),
  error: z.string().nullable(),
  steps: z.array(stepSchema),
});

/** Credit vs deposit, present only when the night run recorded at least one of the two. */
const spendingSchema = z.object({
  currency: z.string(),
  creditUsed: digits.nullable(),
  depositUsed: digits.nullable(),
  spentUsdMicro: digits,
});

const publicNightSchema = z.object({
  id: z.string().regex(/^[1-9]\d*$/),
  status: z.enum(NIGHT_STATUS),
  merkleRoot: z.string().nullable(),
  manifestRoot: z.string().nullable(),
  anchorTx: z.string().nullable(),
  explorerUrl: z.string().min(1),
  itemCount: z.number().int().nonnegative(),
  startedAt: z.string().nullable(),
  finishedAt: z.string().nullable(),
});

/**
 * `GET /api/nights/[id]`. Public batch fields are always present for a recorded night.
 * `results` exists only for the signed-in user, and only when that night row exists.
 */
export const nightResponseSchema = z
  .object({
    night: publicNightSchema.nullable(),
    signedIn: z.boolean(),
    results: z
      .object({
        tasks: z.array(taskSchema),
        spending: spendingSchema.nullable(),
      })
      .optional(),
  })
  .superRefine((body, ctx) => {
    const personal = body.night !== null && body.signedIn;
    if (personal && body.results === undefined) {
      ctx.addIssue({ code: "custom", message: "A signed-in viewer of a recorded night receives their results." });
    }
    if (!personal && body.results !== undefined) {
      ctx.addIssue({ code: "custom", message: "Results are only returned for a signed-in viewer of a recorded night." });
    }
  });

export type NightResponse = z.infer<typeof nightResponseSchema>;
export type PublicNight = z.infer<typeof publicNightSchema>;
export type NightTaskResult = z.infer<typeof taskSchema>;
export type NightSpending = z.infer<typeof spendingSchema>;
export type ProvenanceStep = z.infer<typeof stepSchema>;

export type NightPanel =
  | { phase: "unavailable" }
  | { phase: "invalid" }
  | { phase: "empty" }
  | { phase: "ready"; night: PublicNight; signedIn: false }
  | { phase: "ready"; night: PublicNight; signedIn: true; results: NonNullable<NightResponse["results"]> };

/** Turns the night response into the panel state. A bad body never throws into the page. */
export async function readNight(res: Response | null): Promise<NightPanel> {
  if (!res) return { phase: "unavailable" };
  if (res.status === 404) return { phase: "invalid" };
  if (!res.ok) return { phase: "unavailable" };
  const body: unknown = await res.json().catch(() => null);
  const parsed = nightResponseSchema.safeParse(body);
  if (!parsed.success) return { phase: "unavailable" };
  if (!parsed.data.night) return { phase: "empty" };
  if (!parsed.data.signedIn || !parsed.data.results) return { phase: "ready", night: parsed.data.night, signedIn: false };
  return { phase: "ready", night: parsed.data.night, signedIn: true, results: parsed.data.results };
}

const STEP_LABEL: Record<string, string> = {
  classify: "Complexity check",
  transcribe: "Transcription",
  summarize: "Summary",
  analyze: "Analysis",
  refine: "Prompt rewrite",
  image: "Image",
};

export function stepLabel(step: string): string {
  return STEP_LABEL[step] ?? step;
}

export function trustLabel(trust: ProvenanceStep["trust"]): string {
  switch (trust) {
    case "private":
      return "Private (TeeML)";
    case "verified":
      return "Verified (TeeTLS)";
    case "standard":
      return "Standard";
    default:
      return "Trust level not recorded";
  }
}

/** Absent is a missing verdict, not a failed attestation (plan §7). */
export function teeVerdict(teeVerified: boolean | null): string {
  if (teeVerified === true) return "TEE attestation verified";
  if (teeVerified === false) return "TEE attestation failed";
  return "No TEE verdict. That is not a failure.";
}

/** Stub until the verifier page (F3.11) reads `rid`. */
export function verifyHref(requestId: string): string {
  return `/verify?rid=${encodeURIComponent(requestId)}`;
}

const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export function anchorHref(explorerUrl: string, anchorTx: string): string | null {
  if (!TX_HASH.test(anchorTx)) return null;
  return `${explorerUrl.replace(/\/+$/, "")}/tx/${anchorTx}`;
}

const NIGHT_STATUS_LABEL: Record<PublicNight["status"], string> = {
  PENDING: "Waiting to start",
  RUNNING: "Running",
  ANCHORING: "Anchoring on 0G Chain",
  DONE: "Finished",
  FAILED: "Failed",
};

export function nightStatusLabel(status: PublicNight["status"]): string {
  return NIGHT_STATUS_LABEL[status];
}

/** `YYYYMMDD` rendered in UTC, or null when the id is not that calendar date. */
export function calendarNight(id: string): string | null {
  if (!/^20\d{6}$/.test(id)) return null;
  const year = Number(id.slice(0, 4));
  const month = Number(id.slice(4, 6));
  const day = Number(id.slice(6, 8));
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" }).format(date);
}

export function nightHeading(id: string): string {
  const dated = calendarNight(id);
  return dated ? `Night of ${dated}` : `Night ${id}`;
}

export function formatUtc(iso: string): string | null {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const y = date.getUTCFullYear();
  const m = String(date.getUTCMonth() + 1).padStart(2, "0");
  const d = String(date.getUTCDate()).padStart(2, "0");
  const hh = String(date.getUTCHours()).padStart(2, "0");
  const mm = String(date.getUTCMinutes()).padStart(2, "0");
  return `${y}-${m}-${d} ${hh}:${mm} UTC`;
}
