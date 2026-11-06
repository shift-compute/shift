import type { NightResponse, NightSpending, ProvenanceStep, PublicNight } from "./night-response";

/** Columns of `Night` that are public batch data. Vault and donation fields stay out. */
export const NIGHT_PUBLIC_SELECT = {
  id: true,
  status: true,
  merkleRoot: true,
  manifestRoot: true,
  anchorTx: true,
  itemCount: true,
  startedAt: true,
  finishedAt: true,
} as const;

/** Credit and deposit totals. The ephemeral key id and balance blobs stay on the server. */
export const NIGHT_RUN_SPEND_SELECT = {
  spentUsdMicro: true,
  creditUsed: true,
  depositUsed: true,
} as const;

/** Provenance for one user's tasks. Paths and the raw upload stay on the server. */
export const NIGHT_TASK_SELECT = {
  id: true,
  type: true,
  status: true,
  prompt: true,
  chosenModel: true,
  outputRoot: true,
  actualCostUsdMicro: true,
  steps: true,
  error: true,
} as const;

const TRUST = new Set(["private", "verified", "standard"]);
const TASK_TYPES = ["AUDIO_SUMMARY", "DOC_ANALYSIS", "IMAGE_FROM_PROMPT"] as const;
const NIGHT_STATUSES = ["PENDING", "RUNNING", "ANCHORING", "DONE", "FAILED"] as const;

type TaskTypeName = (typeof TASK_TYPES)[number];
type TrustName = "private" | "verified" | "standard";

export interface NightRow {
  id: bigint;
  status: string;
  merkleRoot: string | null;
  manifestRoot: string | null;
  anchorTx: string | null;
  itemCount: number;
  startedAt: Date | null;
  finishedAt: Date | null;
}

export interface NightRunSpendRow {
  spentUsdMicro: bigint;
  creditUsed: string | null;
  depositUsed: string | null;
}

export interface NightTaskRow {
  id: string;
  type: string;
  status: string;
  prompt: string | null;
  chosenModel: string | null;
  outputRoot: string | null;
  actualCostUsdMicro: bigint | null;
  steps: unknown;
  error: string | null;
}

export interface NightResultsInput {
  night: NightRow | null;
  signedIn: boolean;
  explorerUrl: string;
  /** Account currency, used to label credit and deposit. Ignored when there is no split to show. */
  currency: string;
  run: NightRunSpendRow | null;
  /** Ignored unless the viewer is signed in and the night row exists. */
  tasks: NightTaskRow[];
}

/**
 * JSON for `GET /api/nights/[id]`.
 * Personal tasks and the credit/deposit split are included only for a signed-in viewer of a recorded night.
 * Strings that contain a management or inference key are stripped; unknown step fields (the raw trace) are dropped.
 */
export function nightResultsBody(input: NightResultsInput): NightResponse {
  const night = input.night ? publicNight(input.night, input.explorerUrl) : null;
  if (!night) return { night: null, signedIn: input.signedIn };
  if (!input.signedIn) return { night, signedIn: false };
  return {
    night,
    signedIn: true,
    results: {
      tasks: input.tasks.flatMap(taskResult),
      spending: spendingOf(input.run, input.currency),
    },
  };
}

function publicNight(row: NightRow, explorerUrl: string): PublicNight | null {
  if (!isNightStatus(row.status)) return null;
  return {
    id: row.id.toString(),
    status: row.status,
    merkleRoot: publicHash(row.merkleRoot),
    manifestRoot: publicHash(row.manifestRoot),
    anchorTx: publicHash(row.anchorTx),
    explorerUrl: explorerUrl.replace(/\/+$/, ""),
    itemCount: row.itemCount,
    startedAt: row.startedAt ? row.startedAt.toISOString() : null,
    finishedAt: row.finishedAt ? row.finishedAt.toISOString() : null,
  };
}

function taskResult(task: NightTaskRow): NonNullable<NightResponse["results"]>["tasks"] {
  if (!isTaskType(task.type)) return [];
  return [
    {
      id: task.id,
      type: task.type,
      status: clip(stripSecrets(task.status), 40),
      prompt: task.prompt === null ? null : clip(stripSecrets(task.prompt), 1000),
      chosenModel: task.chosenModel === null ? null : publicToken(task.chosenModel),
      outputRoot: publicHash(task.outputRoot),
      actualCostUsdMicro: nonNegBig(task.actualCostUsdMicro),
      error: task.error === null ? null : clip(stripSecrets(task.error), 500),
      steps: provenanceSteps(task.steps),
    },
  ];
}

function spendingOf(run: NightRunSpendRow | null, currency: string): NightSpending | null {
  if (!run) return null;
  const creditUsed = digits(run.creditUsed);
  const depositUsed = digits(run.depositUsed);
  // A run with neither side recorded is not a zero. The page waits until the split exists.
  if (creditUsed === null && depositUsed === null) return null;
  const spent = nonNegBig(run.spentUsdMicro);
  if (spent === null) return null;
  return { currency: clip(stripSecrets(currency), 16), creditUsed, depositUsed, spentUsdMicro: spent };
}

function provenanceSteps(value: unknown): ProvenanceStep[] {
  if (!Array.isArray(value)) return [];
  const steps: ProvenanceStep[] = [];
  for (const item of value) {
    const step = oneStep(item);
    if (step) steps.push(step);
  }
  return steps;
}

function oneStep(item: unknown): ProvenanceStep | null {
  if (!item || typeof item !== "object") return null;
  const row = item as Record<string, unknown>;
  const step = typeof row.step === "string" ? publicToken(row.step) : null;
  const model = typeof row.model === "string" ? publicToken(row.model) : null;
  if (!step || !model) return null;
  return {
    step,
    model,
    trust: typeof row.trust === "string" && isTrust(row.trust) ? row.trust : null,
    requestId: typeof row.requestId === "string" ? publicToken(row.requestId) : null,
    teeVerified: teeOf(row.trace),
    costUsdMicro: typeof row.costUsdMicro === "string" ? digits(row.costUsdMicro) : null,
  };
}

/** `true` or `false` only when the trace actually carried a boolean. Anything else, including a missing trace, is no verdict. */
function teeOf(trace: unknown): boolean | null {
  if (!trace || typeof trace !== "object" || !("tee_verified" in trace)) return null;
  const flag = (trace as { tee_verified?: unknown }).tee_verified;
  return typeof flag === "boolean" ? flag : null;
}

function isNightStatus(status: string): status is PublicNight["status"] {
  return (NIGHT_STATUSES as readonly string[]).includes(status);
}

function isTaskType(type: string): type is TaskTypeName {
  return (TASK_TYPES as readonly string[]).includes(type);
}

function isTrust(trust: string): trust is TrustName {
  return TRUST.has(trust);
}

function digits(value: string | null): string | null {
  if (value === null || !/^\d+$/.test(value)) return null;
  return value;
}

function nonNegBig(value: bigint | null): string | null {
  if (value === null || value < 0n) return null;
  return value.toString();
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
  // Same boundary as `redactString`: "task-1" and "mask-large" are not keys.
  return /\b(?:sk|mk)-/.test(value);
}

function stripSecrets(value: string): string {
  return value.replace(/\b(?:sk|mk)-[A-Za-z0-9._[\]-]*/g, "[redacted]");
}

function clip(value: string, max: number): string {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
