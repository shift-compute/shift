"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { NightStrip } from "../night/NightStrip";
import { RunNow } from "./RunNow";
import { TonightEstimate } from "./TonightEstimate";
import { StatusBadge, type BadgeTone } from "../ui/StatusBadge";
import { stripFromSource } from "../../lib/night-strip";
import { formatAmount } from "../../lib/format";
import { verifyHref } from "../../lib/night-response";
import { readPreview, type PreviewPanel } from "./preview-state";

interface TaskRow {
  id: string;
  type: "AUDIO_SUMMARY" | "DOC_ANALYSIS" | "IMAGE_FROM_PROMPT";
  status: string;
  priority: number;
  prompt: string | null;
  inputBytes: number | null;
  createdAt: string;
  nightId?: string | null;
  error?: string | null;
  requestIds?: string[];
  actualCostUsdMicro?: string | null;
}

const TYPE_LABEL: Record<TaskRow["type"], string> = {
  AUDIO_SUMMARY: "Summarize audio",
  DOC_ANALYSIS: "Analyze a document",
  IMAGE_FROM_PROMPT: "Generate an image",
};
const ACCEPT: Partial<Record<TaskRow["type"], string>> = {
  AUDIO_SUMMARY: ".mp3,.m4a,.wav",
  DOC_ANALYSIS: ".pdf,.txt,.md",
};
const HINT: Record<TaskRow["type"], string> = {
  AUDIO_SUMMARY: "mp3, m4a or wav, up to 10 MB",
  DOC_ANALYSIS: "pdf, txt or md, up to 5 MB",
  IMAGE_FROM_PROMPT: "A short description, up to 1000 characters",
};
const STATUS_LABEL: Record<string, string> = {
  QUEUED: "Waiting for tonight",
  PLANNED: "Planned for tonight",
  RUNNING: "Running",
  DONE: "Done",
  FAILED: "Failed",
  DEFERRED: "Moved to the next night",
  CANCELLED: "Cancelled",
};
const STATUS_TONE: Record<string, BadgeTone> = { QUEUED: "wait", PLANNED: "active", RUNNING: "active", DONE: "done", FAILED: "bad", DEFERRED: "wait", CANCELLED: "neutral" };
const PRIORITY_LABEL = { 1: "Low", 2: "Normal", 3: "High" } as const;
const CANCELLABLE = new Set(["QUEUED", "PLANNED", "DEFERRED"]);

function size(bytes: number | null): string {
  if (bytes === null) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function Queue() {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [preview, setPreview] = useState<PreviewPanel | { phase: "loading" }>({ phase: "loading" });
  const [signedOut, setSignedOut] = useState(false);
  const [type, setType] = useState<TaskRow["type"]>("AUDIO_SUMMARY");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const tasksPromise = fetch("/api/tasks", { cache: "no-store" }).catch(() => null);
    const previewPromise = fetch("/api/plan/preview", { cache: "no-store" }).catch(() => null);
    const res = await tasksPromise;
    if (!res) {
      setMessage("We could not reach the server. Try again in a moment.");
      setPreview({ phase: "unavailable" });
      return;
    }
    if (res.status === 401) return setSignedOut(true);
    if (!res.ok) {
      setMessage("We could not load your queue.");
      setPreview(await readPreview(await previewPromise));
      return;
    }
    setTasks(((await res.json()) as { tasks: TaskRow[] }).tasks);
    setPreview(await readPreview(await previewPromise));
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (signedOut) return;
    const id = setInterval(() => {
      void (async () => {
        const res = await fetch("/api/tasks", { cache: "no-store" }).catch(() => null);
        if (!res || res.status === 401) {
          if (res?.status === 401) setSignedOut(true);
          return;
        }
        if (!res.ok) return;
        const body = (await res.json().catch(() => null)) as { tasks?: TaskRow[] } | null;
        if (!body?.tasks) return;
        setTasks(body.tasks);
      })();
    }, 8000);
    return () => clearInterval(id);
  }, [signedOut]);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    setBusy(true);
    setMessage(null);
    const data = new FormData(form);
    data.set("type", type);
    const res = await fetch("/api/tasks", { method: "POST", body: data }).catch(() => null);
    setBusy(false);
    if (!res) return setMessage("We could not reach the server. Try again in a moment.");
    if (!res.ok) {
      const body = (await res.json().catch(() => ({}))) as { message?: string; problems?: string[] };
      return setMessage(body.message ?? body.problems?.join(" ") ?? "That task could not be added.");
    }
    form.reset();
    await load();
  }

  async function cancel(id: string) {
    const res = await fetch(`/api/tasks/${id}`, { method: "DELETE" }).catch(() => null);
    if (!res || (!res.ok && res.status !== 409)) setMessage("We could not cancel that task.");
    await load();
  }

  if (signedOut) {
    return (
      <p>
        <a href="/connect">Connect your 0G account</a> to queue tasks.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      <form onSubmit={submit} className="surface-card max-w-xl space-y-4">
        <div>
          <label htmlFor="task-type" className="block text-haze">
            What should Shift do?
          </label>
          <select
            id="task-type"
            value={type}
            onChange={(e) => setType(e.target.value as TaskRow["type"])}
            className="field-input mt-1"
          >
            {Object.entries(TYPE_LABEL).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>

        {type === "IMAGE_FROM_PROMPT" ? (
          <div>
            <label htmlFor="task-prompt" className="block text-haze">
              Describe the image
            </label>
            <textarea id="task-prompt" name="prompt" required minLength={3} maxLength={1000} rows={3} className="field-input mt-1" />
          </div>
        ) : (
          <div>
            <label htmlFor="task-file" className="block text-haze">
              File
            </label>
            <input id="task-file" name="file" type="file" required accept={ACCEPT[type]} className="mt-1 block w-full" />
          </div>
        )}
        <p className="text-sm text-haze">{HINT[type]}</p>

        <div>
          <label htmlFor="task-priority" className="block text-haze">
            Priority
          </label>
          <select id="task-priority" name="priority" defaultValue="2" className="field-input mt-1 w-auto">
            <option value="3">High: run first</option>
            <option value="2">Normal</option>
            <option value="1">Low: run if there is room</option>
          </select>
        </div>

        <button type="submit" disabled={busy} className="btn-solid">
          {busy ? "Adding…" : "Add to tonight's queue"}
        </button>
        {message && (
          <p role="alert" className="surface-card-warn rounded-xl bg-white/70 py-2 pl-3">
            {message}
          </p>
        )}
      </form>

      <NightStrip model={stripFromSource(preview, tasks ?? [])} busy={preview.phase === "loading"} />

      <TonightEstimate panel={preview} tasks={tasks ?? []} />

      <RunNow tasks={tasks} queueFailed={tasks === null && message !== null} preview={preview} onFinished={() => void load()} />

      <section aria-label="Your tasks">
        <h2 className="text-2xl font-semibold">Your tasks</h2>
        {tasks === null ? (
          message ? null : <p className="mt-3 text-haze">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="mt-3 text-haze">Nothing queued yet. Add a task above and Shift will pick it up before the reset.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {tasks.map((t) => (
              <li key={t.id} className="surface-card surface-card-hover flex items-center justify-between gap-4 !p-4">
                <div>
                  <p className="flex flex-wrap items-center gap-2 font-semibold">
                    {TYPE_LABEL[t.type]}
                    <StatusBadge tone={STATUS_TONE[t.status]}>{STATUS_LABEL[t.status] ?? t.status}</StatusBadge>
                  </p>
                  <p className="text-sm text-haze">
                    {PRIORITY_LABEL[t.priority as 1 | 2 | 3] ?? "Normal"} priority
                    {t.inputBytes !== null && ` · ${size(t.inputBytes)}`}
                    {t.prompt && ` · “${t.prompt.length > 60 ? `${t.prompt.slice(0, 60)}…` : t.prompt}”`}
                  </p>
                  <TaskReceipt task={t} />
                </div>
                {CANCELLABLE.has(t.status) && (
                  <button type="button" onClick={() => cancel(t.id)} className="btn-quiet !min-h-9 text-sm">
                    Cancel
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

/** Stored with the task, so a disconnected Run now still leaves a receipt on the next load. */
function TaskReceipt({ task }: { task: TaskRow }) {
  const nightId = task.nightId && /^[1-9]\d*$/.test(task.nightId) ? task.nightId : null;
  const requestIds = (task.requestIds ?? []).filter((id) => /^[A-Za-z0-9][A-Za-z0-9._:-]{7,180}$/.test(id) && !/^(?:sk|mk)-/i.test(id));
  const cost = task.actualCostUsdMicro && /^\d+$/.test(task.actualCostUsdMicro) ? formatAmount(task.actualCostUsdMicro, "usd") : null;
  const finished = task.status === "DONE" || task.status === "FAILED" || task.status === "RUNNING";
  if (!finished && !task.error && !nightId) return null;
  return (
    <div className="mt-2 space-y-1 text-sm">
      {task.error && <p className="text-ink">{task.error}</p>}
      {cost && <p className="text-haze">Reported cost {cost}. This is the amount stored for the task, not a new charge.</p>}
      {nightId && (
        <p>
          <a href={`/nights/${nightId}`}>View night {nightId}</a>
          <span className="text-haze"> · The result, anchor and donation appear there only after this run stores them.</span>
        </p>
      )}
      {requestIds.length > 0 && (
        <p>
          {requestIds.map((id) => (
            <a key={id} href={verifyHref(id)} className="mr-3">
              Verify {id}
            </a>
          ))}
        </p>
      )}
    </div>
  );
}
