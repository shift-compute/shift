import { formatAmount } from "../../lib/format";
import type { PreviewPanel, TonightPreview } from "./preview-state";

const TYPE_LABEL: Record<string, string> = {
  AUDIO_SUMMARY: "Summarize audio",
  DOC_ANALYSIS: "Analyze a document",
  IMAGE_FROM_PROMPT: "Generate an image",
};

const DEFER_TEXT = {
  no_model: "No private model can run this task.",
  over_budget: "It does not fit in tonight's budget.",
  not_runnable: "Shift cannot estimate this task from what is stored.",
} as const;

interface TaskHint {
  id: string;
  prompt: string | null;
}

type Panel = PreviewPanel | { phase: "loading" };

function labelFor(taskId: string, type: string, tasks: TaskHint[]): string {
  const name = TYPE_LABEL[type] ?? "Task";
  const prompt = tasks.find((task) => task.id === taskId)?.prompt;
  if (!prompt) return name;
  const short = prompt.length > 40 ? `${prompt.slice(0, 40)}…` : prompt;
  return `${name}: “${short}”`;
}

function modelLine(item: TonightPreview["assignments"][number]): string {
  const parts = [`Chat ${item.model}`, `quality ${item.quality}`];
  if (item.transcribeModel) parts.push(`Transcription ${item.transcribeModel}`);
  if (item.imageModel) parts.push(`Image ${item.imageModel}`);
  return parts.join(" · ");
}

export function TonightEstimate({ panel, tasks }: { panel: Panel; tasks: TaskHint[] }) {
  return (
    <section aria-label="Tonight's estimate" aria-busy={panel.phase === "loading"} className="max-w-xl space-y-4 rounded-md bg-night p-5">
      <div>
        <h2 className="text-2xl font-semibold">Tonight's estimate</h2>
        <p className="mt-1 text-sm text-haze">
          Live catalog prices and your live balance. Complexity is filled in when the shift runs, so every task is planned at quality floor 1. This does not spend credits.
        </p>
      </div>
      {panel.phase === "loading" && (
        <p className="text-haze" aria-live="polite">
          Estimating tonight…
        </p>
      )}
      {panel.phase === "unavailable" && <p className="border-l-4 border-sodium pl-3">We could not reach the server. Try again in a moment.</p>}
      {panel.phase === "reconnect" && (
        <p className="border-l-4 border-sodium pl-3">
          Your management key is no longer valid. <a href="/connect">Connect your 0G account</a> again to see tonight's estimate.
        </p>
      )}
      {panel.phase === "empty" && <p className="text-haze">{panel.message}</p>}
      {panel.phase === "message" && (
        <p role="alert" className="border-l-4 border-sodium pl-3">
          {panel.message}
        </p>
      )}
      {panel.phase === "ready" && <Ready preview={panel.preview} tasks={tasks} />}
    </section>
  );
}

function Ready({ preview, tasks }: { preview: TonightPreview; tasks: TaskHint[] }) {
  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
        <dt className="text-haze">Budget for tonight</dt>
        <dd className="font-semibold text-sodium">{formatAmount(preview.budgetMicro, "usd")}</dd>
        <dt className="text-haze">Estimated spend</dt>
        <dd>{formatAmount(preview.spentEstimateMicro, "usd")}</dd>
        <dt className="text-haze">Left for the commons queue</dt>
        <dd className="font-semibold text-light">{formatAmount(preview.remainingMicro, "usd")}</dd>
      </dl>

      {preview.assignments.length === 0 ? (
        <p className="text-sm text-haze">Nothing is assigned tonight. What remains stays for the commons queue.</p>
      ) : (
        <ul className="divide-y divide-haze/20">
          {preview.assignments.map((item) => (
            <li key={item.taskId} className="flex items-baseline justify-between gap-4 py-2">
              <div>
                <p className="font-semibold">{labelFor(item.taskId, item.type, tasks)}</p>
                <p className="text-sm text-haze">{modelLine(item)}</p>
              </div>
              <p className="shrink-0 text-sm">{formatAmount(item.costMicro, "usd")}</p>
            </li>
          ))}
        </ul>
      )}

      {preview.deferred.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-haze">Not tonight</h3>
          <ul className="mt-1 space-y-2">
            {preview.deferred.map((item) => (
              <li key={item.taskId}>
                <p className="font-semibold">{labelFor(item.taskId, item.type, tasks)}</p>
                <p className="text-sm text-haze">{DEFER_TEXT[item.reason]}</p>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
