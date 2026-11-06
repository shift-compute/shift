import { z } from "zod";

const fileSchema = z.object({
  name: z.string().min(1).max(200),
  mime: z.string().min(1).max(200),
  sha256: z.string().regex(/^[0-9a-f]{64}$/),
  rootHash: z.string().regex(/^0x[0-9a-fA-F]{64}$/),
  dataBase64: z.string().min(1).max(16_000_000),
});

/** Body of `GET /api/tasks/[id]/output` after the server decrypted the owner's ciphertext. */
export const taskOutputSchema = z.object({
  taskId: z.string().min(1).max(200),
  type: z.string().min(1).max(80),
  result: z.unknown(),
  files: z.array(fileSchema).max(8),
  createdAt: z.string().min(1).max(40),
  sealed: z.literal(true),
});

export type TaskOutputBody = z.infer<typeof taskOutputSchema>;

export type TaskOutputPanel =
  | { phase: "hidden" }
  | { phase: "loading" }
  | { phase: "unavailable" }
  | { phase: "locked" }
  | { phase: "ready"; body: TaskOutputBody };

/** Turns the output response into the panel state. A bad body never throws into the page. */
export async function readTaskOutput(res: Response | null): Promise<TaskOutputPanel> {
  if (!res) return { phase: "unavailable" };
  if (res.status === 401 || res.status === 403) return { phase: "locked" };
  if (!res.ok) return { phase: "unavailable" };
  const body: unknown = await res.json().catch(() => null);
  const parsed = taskOutputSchema.safeParse(body);
  if (!parsed.success) return { phase: "unavailable" };
  return { phase: "ready", body: parsed.data };
}

export interface OutputView {
  summary: string | null;
  lists: Array<{ label: string; items: string[] }>;
  notes: string[];
}

const LIST_LABEL: Record<string, string> = {
  actionItems: "Action items",
  risks: "Risks",
  keyPoints: "Key points",
};

/** Pulls the fields the executors store, ignoring anything that is not text. */
export function outputView(result: unknown): OutputView {
  if (!result || typeof result !== "object" || Array.isArray(result)) return { summary: null, lists: [], notes: [] };
  const record = result as Record<string, unknown>;
  const summary = typeof record.summary === "string" && record.summary.trim() ? record.summary.trim() : null;
  const lists: OutputView["lists"] = [];
  for (const key of ["actionItems", "risks", "keyPoints"] as const) {
    const value = record[key];
    if (!Array.isArray(value)) continue;
    const items = value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
    if (items.length > 0) lists.push({ label: LIST_LABEL[key] ?? key, items });
  }
  const notes: string[] = [];
  if (typeof record.transcript === "string" && record.transcript.trim()) notes.push(record.transcript.trim());
  if (typeof record.revisedPrompt === "string" && record.revisedPrompt.trim()) notes.push(record.revisedPrompt.trim());
  if (record.truncated === true) notes.push("The document was longer than what was sent to the model.");
  return { summary, lists, notes };
}
