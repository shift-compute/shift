"use client";

import { useEffect, useState } from "react";
import { outputView, readTaskOutput, type TaskOutputPanel } from "../../lib/task-output";

/** Loads the decrypted result for the signed-in owner. The storage root on the card stays the ciphertext. */
export const OUTPUT_LOAD_TIMEOUT_MS = 25_000;

export function TaskOutput({ taskId, enabled, timeoutMs = OUTPUT_LOAD_TIMEOUT_MS }: { taskId: string; enabled: boolean; timeoutMs?: number }) {
  const [panel, setPanel] = useState<TaskOutputPanel>(enabled ? { phase: "loading" } : { phase: "hidden" });

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    void (async () => {
      try {
        const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/output`, { cache: "no-store", signal: controller.signal });
        if (cancelled) return;
        setPanel(await readTaskOutput(res));
      } catch {
        if (!cancelled) {
          setPanel({
            phase: "unavailable",
            detail: "The result request did not finish. Shift is not showing a made-up summary.",
          });
        }
      } finally {
        clearTimeout(timer);
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(timer);
      controller.abort();
    };
  }, [taskId, enabled, timeoutMs]);

  if (panel.phase === "hidden") return null;
  if (panel.phase === "loading") {
    return <p className="text-haze">Loading your result…</p>;
  }
  if (panel.phase === "locked") {
    return <p className="text-haze">This result is encrypted. Only the account that ran it can read it here.</p>;
  }
  if (panel.phase === "unavailable") {
    return <p className="text-haze">{panel.detail}</p>;
  }

  const view = outputView(panel.body.result);
  const images = panel.body.files.filter((file) => file.mime.startsWith("image/"));
  return (
    <div className="space-y-3 border-t border-ink/10 pt-4">
      <h4 className="font-semibold">Result</h4>
      {view.summary && <p>{view.summary}</p>}
      {view.lists.map((list) => (
        <div key={list.label}>
          <p className="text-sm text-haze">{list.label}</p>
          <ul className="list-disc pl-5">
            {list.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ))}
      {view.notes.map((note) => (
        <p key={note} className="text-haze">
          {note}
        </p>
      ))}
      {images.map((file) => (
        // The bytes were decrypted for this owner. They are not the public indexer object.
        // eslint-disable-next-line @next/next/no-img-element
        <img key={file.sha256} src={`data:${file.mime};base64,${file.dataBase64}`} alt={file.name} className="max-w-full rounded-md" />
      ))}
      {!view.summary && view.lists.length === 0 && view.notes.length === 0 && images.length === 0 && (
        <p className="text-haze">The result was stored, and it has no text to show.</p>
      )}
    </div>
  );
}
