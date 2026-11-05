"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";

interface TaskRow {
  id: string;
  type: "AUDIO_SUMMARY" | "DOC_ANALYSIS" | "IMAGE_FROM_PROMPT";
  status: string;
  priority: number;
  prompt: string | null;
  inputBytes: number | null;
  createdAt: string;
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
const PRIORITY_LABEL = { 1: "Low", 2: "Normal", 3: "High" } as const;
const CANCELLABLE = new Set(["QUEUED", "PLANNED", "DEFERRED"]);

function size(bytes: number | null): string {
  if (bytes === null) return "";
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function Queue() {
  const [tasks, setTasks] = useState<TaskRow[] | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [type, setType] = useState<TaskRow["type"]>("AUDIO_SUMMARY");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/tasks").catch(() => null);
    if (!res) return setMessage("We could not reach the server. Try again in a moment.");
    if (res.status === 401) return setSignedOut(true);
    if (!res.ok) return setMessage("We could not load your queue.");
    setTasks(((await res.json()) as { tasks: TaskRow[] }).tasks);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

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
      <form onSubmit={submit} className="max-w-xl space-y-4">
        <div>
          <label htmlFor="task-type" className="block text-haze">
            What should Shift do?
          </label>
          <select
            id="task-type"
            value={type}
            onChange={(e) => setType(e.target.value as TaskRow["type"])}
            className="mt-1 w-full rounded-md border border-haze/40 bg-night px-3 py-2"
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
            <textarea id="task-prompt" name="prompt" required minLength={3} maxLength={1000} rows={3} className="mt-1 w-full rounded-md border border-haze/40 bg-night px-3 py-2" />
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
          <select id="task-priority" name="priority" defaultValue="2" className="mt-1 rounded-md border border-haze/40 bg-night px-3 py-2">
            <option value="3">High: run first</option>
            <option value="2">Normal</option>
            <option value="1">Low: run if there is room</option>
          </select>
        </div>

        <button type="submit" disabled={busy} className="rounded-md bg-sodium px-5 py-2 font-semibold text-sky disabled:opacity-60">
          {busy ? "Adding…" : "Add to tonight's queue"}
        </button>
        {message && (
          <p role="alert" className="border-l-4 border-sodium pl-3">
            {message}
          </p>
        )}
      </form>

      <section aria-label="Your tasks">
        <h2 className="text-2xl font-semibold">Your tasks</h2>
        {tasks === null ? (
          <p className="mt-3 text-haze">Loading…</p>
        ) : tasks.length === 0 ? (
          <p className="mt-3 text-haze">Nothing queued yet. Add a task above and Shift will pick it up before the reset.</p>
        ) : (
          <ul className="mt-4 divide-y divide-haze/20">
            {tasks.map((t) => (
              <li key={t.id} className="flex items-center justify-between gap-4 py-3">
                <div>
                  <p className="font-semibold">{TYPE_LABEL[t.type]}</p>
                  <p className="text-sm text-haze">
                    {STATUS_LABEL[t.status] ?? t.status} · {PRIORITY_LABEL[t.priority as 1 | 2 | 3] ?? "Normal"} priority
                    {t.inputBytes !== null && ` · ${size(t.inputBytes)}`}
                    {t.prompt && ` · “${t.prompt.length > 60 ? `${t.prompt.slice(0, 60)}…` : t.prompt}”`}
                  </p>
                </div>
                {CANCELLABLE.has(t.status) && (
                  <button type="button" onClick={() => cancel(t.id)} className="text-sm underline">
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
