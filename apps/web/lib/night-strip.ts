import { formatAmount } from "./format";

/** One basis point is 0.01% of the strip. Shares always sum with the remainder to 10_000. */
const BPS = 10_000;

export type StripBlockState = "planned" | "running" | "done" | "failed";
export type StripTone = "planned" | "running" | "finished";

export interface NightStripSegment {
  id: string;
  label: string;
  /** Integer micro-USD string, or null when no cost was reported. */
  costMicro: string | null;
  costLabel: string;
  state: StripBlockState;
  /** Width share in basis points. Zero still renders as a sliver so a task without a cost stays visible. */
  shareBps: number;
}

/** Everything the night strip draws. Widths are cost shares, never clock time. */
export interface NightStripModel {
  tone: StripTone;
  /** How much of the strip, from the left, has already been spent. A finished night is the full 10_000. */
  consumedBps: number;
  segments: NightStripSegment[];
  remainderBps: number;
  caption: string;
  startLabel: string;
  endLabel: string;
}

export interface StripAssignment {
  taskId: string;
  type: string;
  costMicro: string;
}

export interface StripTask {
  id: string;
  status: string;
  type?: string;
  prompt?: string | null;
}

export interface StripNightTask {
  id: string;
  type: string;
  status: string;
  prompt: string | null;
  actualCostUsdMicro: string | null;
}

export type RecordedNightStatus = "PENDING" | "RUNNING" | "ANCHORING" | "DONE" | "FAILED";

/** Same phases as the plan-preview panel, including the loading state the queue holds locally. */
export type StripSource =
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "reconnect" }
  | { phase: "empty"; message: string }
  | { phase: "message"; message: string }
  | { phase: "ready"; preview: { budgetMicro: string; assignments: StripAssignment[] } };

const TYPE_LABEL: Record<string, string> = {
  AUDIO_SUMMARY: "Summarize audio",
  DOC_ANALYSIS: "Analyze a document",
  IMAGE_FROM_PROMPT: "Generate an image",
};

const LIVE_EMPTY = "From now until 00:00 UTC. Tasks will sit here, sized by what they cost.";
const PLANNED = "Each block is a task. Its width is its share of tonight's budget, from now until 00:00 UTC.";
const RUNNING = "The budget is being spent from left to right.";
const TASKS_DONE = "Tonight's tasks are done.";
const EQUAL = "Costs are not reported yet, so each task has an equal share.";

export function stripStateLabel(state: StripBlockState): string {
  switch (state) {
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "failed":
      return "Not completed";
    default:
      return "Planned";
  }
}

export function emptyNightStrip(caption: string): NightStripModel {
  return {
    tone: "planned",
    consumedBps: 0,
    segments: [],
    remainderBps: BPS,
    caption,
    startLabel: "Now",
    endLabel: "00:00 UTC",
  };
}

export function signedOutNightStrip(): NightStripModel {
  return emptyNightStrip("Connect your 0G account to place tonight's tasks on this strip.");
}

/** Tonight's plan. Block width is estimated micro-USD over the night budget; task status paints the live edge. */
export function stripFromPreview(preview: { budgetMicro: string; assignments: StripAssignment[] }, tasks: readonly StripTask[]): NightStripModel {
  const budget = micro(preview.budgetMicro) ?? 0n;
  const weights = preview.assignments.map((assignment) => micro(assignment.costMicro) ?? 0n);
  const { shares, remainder } = layout(weights, budget);
  const byId = new Map(tasks.map((task) => [task.id, task]));
  const segments = preview.assignments.map((assignment, index) => {
    const task = byId.get(assignment.taskId);
    const cost = micro(assignment.costMicro);
    return segment({
      id: `${assignment.taskId}:${index}`,
      type: task?.type ?? assignment.type,
      prompt: task?.prompt,
      costMicro: cost === null ? null : assignment.costMicro,
      state: blockState(task?.status),
      shareBps: shares[index] ?? 0,
    });
  });
  return liveModel(segments, remainder);
}

export function stripFromSource(source: StripSource, tasks: readonly StripTask[]): NightStripModel {
  switch (source.phase) {
    case "loading":
      return emptyNightStrip("Reading tonight's plan.");
    case "unavailable":
      return emptyNightStrip("Tonight's strip will show once the estimate loads.");
    case "reconnect":
      return emptyNightStrip("Your management key is no longer valid. Connect your 0G account again to see tonight's tasks.");
    case "empty":
      return emptyNightStrip(source.message || "Nothing is waiting for tonight.");
    case "message":
      return emptyNightStrip(source.message || "Tonight's strip will show once the estimate loads.");
    case "ready":
      return stripFromPreview(source.preview, tasks);
  }
}

/**
 * A recorded night. Widths use the cost the Router reported.
 * When every cost is missing, tasks share the strip equally and the label says the cost was not reported.
 * First light is only the `DONE` night, not a night that is still running or anchoring.
 */
export function stripFromNight(status: RecordedNightStatus, tasks: readonly StripNightTask[]): NightStripModel {
  const parsed = tasks.map((task) => micro(task.actualCostUsdMicro));
  const allUnknown = tasks.length > 0 && parsed.every((cost) => cost === null);
  const weights = allUnknown ? tasks.map(() => 1n) : parsed.map((cost) => cost ?? 0n);
  const budget = weights.reduce((sum, weight) => sum + weight, 0n);
  const { shares, remainder } = layout(weights, budget);
  const segments = tasks.map((task, index) => {
    const known = parsed[index];
    const reported = !allUnknown && known !== null && known !== undefined;
    return segment({
      id: `${task.id}:${index}`,
      type: task.type,
      prompt: task.prompt,
      costMicro: reported ? task.actualCostUsdMicro : null,
      state: blockState(task.status),
      shareBps: shares[index] ?? 0,
    });
  });
  const doneBps = consumedOf(segments);
  const note = allUnknown ? ` ${EQUAL}` : "";

  if (status === "DONE") {
    return {
      tone: "finished",
      consumedBps: BPS,
      segments,
      remainderBps: remainder,
      caption: `This night is finished.${note}`,
      startLabel: "Start",
      endLabel: "First light",
    };
  }
  if (status === "FAILED") {
    return {
      tone: "planned",
      consumedBps: doneBps,
      segments,
      remainderBps: remainder,
      caption: `This night stopped before it finished.${note}`,
      startLabel: "Start",
      endLabel: "Stopped",
    };
  }
  if (status === "RUNNING" || status === "ANCHORING") {
    return {
      tone: "running",
      consumedBps: doneBps,
      segments,
      remainderBps: remainder,
      caption: `${status === "ANCHORING" ? "This night is being anchored on 0G Chain." : RUNNING}${note}`,
      startLabel: "Now",
      endLabel: "00:00 UTC",
    };
  }
  return {
    tone: "planned",
    consumedBps: 0,
    segments,
    remainderBps: remainder,
    caption: `This night has not started.${note}`,
    startLabel: "Start",
    endLabel: "00:00 UTC",
  };
}

function liveModel(segments: NightStripSegment[], remainder: number): NightStripModel {
  const doneBps = consumedOf(segments);
  const states = segments.map((segment) => segment.state);
  const finished = states.length > 0 && states.every((state) => state === "done");
  const running = states.some((state) => state === "running") || doneBps > 0;
  const tone: StripTone = finished ? "finished" : running ? "running" : "planned";
  const caption = segments.length === 0 ? LIVE_EMPTY : tone === "finished" ? TASKS_DONE : tone === "running" ? RUNNING : PLANNED;
  return {
    tone,
    consumedBps: finished ? BPS : tone === "running" ? doneBps : 0,
    segments,
    remainderBps: remainder,
    caption,
    startLabel: "Now",
    endLabel: "00:00 UTC",
  };
}

function segment(input: {
  id: string;
  type: string;
  prompt?: string | null;
  costMicro: string | null;
  state: StripBlockState;
  shareBps: number;
}): NightStripSegment {
  return {
    id: input.id,
    label: taskLabel(input.type, input.prompt),
    costMicro: input.costMicro,
    costLabel: input.costMicro === null ? "Cost not reported" : formatAmount(input.costMicro, "usd"),
    state: input.state,
    shareBps: input.shareBps,
  };
}

function taskLabel(type: string, prompt?: string | null): string {
  const name = TYPE_LABEL[type] ?? "Task";
  const text = prompt?.trim();
  if (!text) return name;
  const short = text.length > 32 ? `${text.slice(0, 32)}…` : text;
  return `${name}: “${short}”`;
}

function blockState(status: string | undefined): StripBlockState {
  if (status === "DONE") return "done";
  if (status === "RUNNING") return "running";
  if (status === "FAILED") return "failed";
  return "planned";
}

function consumedOf(segments: readonly NightStripSegment[]): number {
  return segments.reduce((sum, segment) => sum + (segment.state === "done" ? segment.shareBps : 0), 0);
}

function micro(value: string | null | undefined): bigint | null {
  if (value == null || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

/**
 * Integer shares of the strip. `budget` is the night's micro-USD; leftover budget is the unassigned tail
 * (what the plan leaves for the commons). A cost above the budget fills the strip with no tail.
 * Zero costs inside a zero budget share the strip equally, because there is no cost to proportion.
 */
function layout(weights: readonly bigint[], budget: bigint): { shares: number[]; remainder: number } {
  if (weights.length === 0) return { shares: [], remainder: BPS };
  const sum = weights.reduce((total, weight) => total + weight, 0n);
  if (budget <= 0n && sum <= 0n) {
    return { shares: largestRemainder(weights.map(() => 1n), BigInt(weights.length)), remainder: 0 };
  }
  if (budget <= 0n || sum > budget) return { shares: largestRemainder(weights, sum), remainder: 0 };
  const parts = largestRemainder([...weights, budget - sum], budget);
  return { shares: parts.slice(0, -1), remainder: parts[parts.length - 1] ?? 0 };
}

/** Largest-remainder apportionment so the parts sum to exactly `BPS`. */
function largestRemainder(parts: readonly bigint[], total: bigint): number[] {
  if (parts.length === 0 || total <= 0n) return parts.map(() => 0);
  const floors = parts.map((part) => Number((part * BigInt(BPS)) / total));
  let used = floors.reduce((sum, part) => sum + part, 0);
  const order = parts
    .map((part, index) => ({ index, rem: (part * BigInt(BPS)) % total }))
    .sort((a, b) => (a.rem === b.rem ? a.index - b.index : a.rem > b.rem ? -1 : 1));
  for (const row of order) {
    if (used >= BPS) break;
    const current = floors[row.index];
    if (current === undefined) continue;
    floors[row.index] = current + 1;
    used += 1;
  }
  return floors;
}
