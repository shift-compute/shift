import { z } from "zod";

const micro = z.string().regex(/^\d+$/);

/** Wire shape of `GET /api/plan/preview`. Amounts are micro-USD integers, never floats. */
export const tonightPreviewSchema = z.object({
  qualityFloor: z.literal(1),
  complexity: z.literal("at_run_time"),
  budgetMicro: micro,
  spentEstimateMicro: micro,
  remainingMicro: micro,
  assignments: z.array(
    z.object({
      taskId: z.string(),
      type: z.string(),
      model: z.string(),
      transcribeModel: z.string().nullable(),
      imageModel: z.string().nullable(),
      quality: z.union([z.literal(1), z.literal(2), z.literal(3)]),
      costMicro: micro,
    }),
  ),
  deferred: z.array(
    z.object({
      taskId: z.string(),
      type: z.string(),
      reason: z.enum(["no_model", "over_budget", "not_runnable"]),
    }),
  ),
});

export type TonightPreview = z.infer<typeof tonightPreviewSchema>;

export type PreviewPanel =
  | { phase: "unavailable" }
  | { phase: "reconnect" }
  | { phase: "empty"; message: string }
  | { phase: "message"; message: string }
  | { phase: "ready"; preview: TonightPreview };

const FALLBACK = "We could not read tonight's estimate. Try again in a moment.";
const ROUTER = "We could not read the live catalog or your balance. Try again in a moment.";

/** Turns the preview response into the panel state. A bad body never throws into the page. */
export async function readPreview(res: Response | null): Promise<PreviewPanel> {
  if (!res) return { phase: "unavailable" };
  const body = (await res.json().catch(() => null)) as { error?: unknown; message?: unknown } | null;
  const error = typeof body?.error === "string" ? body.error : undefined;
  const message = typeof body?.message === "string" && body.message.length > 0 ? body.message : undefined;

  if (res.status === 401 && error === "connection_invalid") return { phase: "reconnect" };
  if (res.status === 401) return { phase: "unavailable" };
  if (error === "empty_queue") return { phase: "empty", message: message ?? "Nothing is waiting for tonight." };
  if (error === "router_unavailable") return { phase: "message", message: ROUTER };
  if (!res.ok) return { phase: "message", message: message ?? FALLBACK };

  const parsed = tonightPreviewSchema.safeParse(body);
  if (!parsed.success) return { phase: "message", message: FALLBACK };
  return { phase: "ready", preview: parsed.data };
}
