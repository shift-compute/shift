"use client";

import { useEffect, useRef, useState } from "react";
import { readPreview } from "../queue/preview-state";
import { NightStrip } from "../night/NightStrip";
import {
  signedOutNightStrip,
  stripFromPreview,
  stripFromSource,
  type NightStripModel,
  type StripAssignment,
  type StripTask,
} from "../../lib/night-strip";

const POLL_MS = 8000;

function tasksOf(body: unknown): StripTask[] {
  if (!body || typeof body !== "object" || !("tasks" in body)) return [];
  const tasks = (body as { tasks?: unknown }).tasks;
  if (!Array.isArray(tasks)) return [];
  const rows: StripTask[] = [];
  for (const task of tasks) {
    if (!task || typeof task !== "object") continue;
    const row = task as { id?: unknown; status?: unknown; type?: unknown; prompt?: unknown };
    if (typeof row.id !== "string" || typeof row.status !== "string") continue;
    rows.push({
      id: row.id,
      status: row.status,
      type: typeof row.type === "string" ? row.type : undefined,
      prompt: typeof row.prompt === "string" ? row.prompt : null,
    });
  }
  return rows;
}

/**
 * Home strip. The preview is read once (live balance and catalog, no execution).
 * While the page is open, task status is refreshed from the database so a running night advances the edge
 * without asking the Router again. The first preview is kept, so a task that finishes keeps its estimated width.
 */
export function HomeNightStrip() {
  const [model, setModel] = useState<NightStripModel>(() => stripFromSource({ phase: "loading" }, []));
  const [busy, setBusy] = useState(true);
  const previewRef = useRef<{ budgetMicro: string; assignments: StripAssignment[] } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function readTasks(): Promise<{ tasks: StripTask[]; signedOut: boolean } | null> {
      const res = await fetch("/api/tasks", { cache: "no-store" }).catch(() => null);
      if (!res) return null;
      if (res.status === 401) return { tasks: [], signedOut: true };
      if (!res.ok) return { tasks: [], signedOut: false };
      return { tasks: tasksOf(await res.json().catch(() => null)), signedOut: false };
    }

    async function poll() {
      const preview = previewRef.current;
      if (!preview) return;
      const taskResult = await readTasks();
      if (cancelled || !taskResult || taskResult.signedOut) return;
      setModel(stripFromPreview(preview, taskResult.tasks));
    }

    async function initial() {
      const [taskResult, previewRes] = await Promise.all([readTasks(), fetch("/api/plan/preview", { cache: "no-store" }).catch(() => null)]);
      if (cancelled) return;
      if (!taskResult) {
        setModel(stripFromSource({ phase: "unavailable" }, []));
        setBusy(false);
        return;
      }
      if (taskResult.signedOut) {
        setModel(signedOutNightStrip());
        setBusy(false);
        return;
      }
      const panel = await readPreview(previewRes);
      if (cancelled) return;
      if (panel.phase === "ready") previewRef.current = panel.preview;
      setModel(stripFromSource(panel, taskResult.tasks));
      setBusy(false);
      if (panel.phase === "ready") timer = setInterval(() => void poll(), POLL_MS);
    }

    void initial();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, []);

  return <NightStrip model={model} busy={busy} />;
}
