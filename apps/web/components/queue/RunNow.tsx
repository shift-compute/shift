"use client";

import { useRef, useState } from "react";
import type { PreviewPanel } from "./preview-state";
import {
  describeRunNowFailure,
  eligibilityCopy,
  estimateCopy,
  openTaskCount,
  presentRunNowSuccess,
  runGate,
  RUN_NOW_TIMEOUT_MS,
  unknownRunOutcome,
  type PresentedRun,
  type RunNowFailure,
} from "./run-now-state";

type Notice = { kind: "idle" } | { kind: "pending" } | { kind: "failure"; failure: RunNowFailure } | { kind: "result"; result: PresentedRun };

/**
 * The queue's manual run. One POST to the existing authenticated route.
 * A second click, a timeout, and a lost response do not send another start.
 */
export function RunNow({
  tasks,
  queueFailed,
  preview,
  onFinished,
}: {
  tasks: readonly { status: string }[] | null;
  queueFailed: boolean;
  preview: PreviewPanel | { phase: "loading" };
  onFinished: () => void;
}) {
  const [pending, setPending] = useState(false);
  const [held, setHeld] = useState(false);
  const [notice, setNotice] = useState<Notice>({ kind: "idle" });
  const inFlight = useRef(false);
  const openCount = openTaskCount(tasks);
  const gate = runGate({ pending: pending || inFlight.current, held, openCount, queueFailed, previewPhase: preview.phase });
  const estimate = estimateCopy(preview);

  function stopAfterUnknown(failure: RunNowFailure) {
    if (!failure.ambiguous) {
      setNotice({ kind: "failure", failure });
      return;
    }
    setHeld(true);
    setNotice({ kind: "failure", failure });
    onFinished();
  }

  async function onRun() {
    const decision = runGate({ pending: inFlight.current, held, openCount, queueFailed, previewPhase: preview.phase });
    if (decision.action === "ignore" || decision.action === "wait") return;
    if (decision.action === "blocked") {
      setNotice({
        kind: "failure",
        failure: {
          kind: preview.phase === "reconnect" ? "reconnect" : "no_work",
          title: preview.phase === "reconnect" ? "This account is not connected" : "Nothing is waiting",
          detail: decision.message,
          retry: false,
          ambiguous: false,
        },
      });
      return;
    }

    inFlight.current = true;
    setPending(true);
    setNotice({ kind: "pending" });
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), RUN_NOW_TIMEOUT_MS);
    try {
      const res = await fetch("/api/runs/now", { method: "POST", cache: "no-store", signal: controller.signal });
      const body: unknown = await res.json().catch(() => null);
      if (!res.ok) {
        stopAfterUnknown(describeRunNowFailure({ status: res.status, body, retryAfterHeader: res.headers.get("Retry-After") }));
        return;
      }
      const result = presentRunNowSuccess(body);
      if (!result) {
        stopAfterUnknown(unknownRunOutcome());
        return;
      }
      setNotice({ kind: "result", result });
      onFinished();
    } catch (err) {
      const aborted = err instanceof DOMException && err.name === "AbortError";
      stopAfterUnknown(describeRunNowFailure({ status: aborted ? "timeout" : "network", body: null }));
    } finally {
      clearTimeout(timer);
      inFlight.current = false;
      setPending(false);
    }
  }

  return (
    <RunNowPanel
      eligibility={eligibilityCopy(openCount, queueFailed, preview.phase, held)}
      estimate={estimate}
      pending={pending}
      canStart={gate.action === "start"}
      notice={notice}
      onRun={() => void onRun()}
    />
  );
}

export function RunNowPanel({
  eligibility,
  estimate,
  pending,
  canStart,
  notice,
  onRun,
}: {
  eligibility: string;
  estimate: string | null;
  pending: boolean;
  canStart: boolean;
  notice: Notice;
  onRun: () => void;
}) {
  const failure = notice.kind === "failure" ? notice.failure : null;
  const result = notice.kind === "result" ? notice.result : null;

  return (
    <section aria-labelledby="run-now-title" aria-busy={pending} className="max-w-xl space-y-4 rounded-md bg-night p-5">
      <div>
        <h2 id="run-now-title" className="text-2xl font-semibold">
          Run tonight's shift now
        </h2>
        <p id="run-now-eligibility" className="mt-1 text-sm text-haze">
          {eligibility}
        </p>
        {estimate && <p className="mt-2 text-sm">{estimate}</p>}
      </div>
      <button
        type="button"
        onClick={onRun}
        disabled={pending || !canStart}
        aria-describedby="run-now-eligibility"
        className="cta cta-primary disabled:cursor-not-allowed disabled:opacity-60"
      >
        {pending ? "Running tonight's shift…" : "Run tonight's shift now"}
      </button>
      {pending && (
        <p className="text-sm text-haze" aria-live="polite">
          This can take a few minutes. This page will not start a second run.
        </p>
      )}
      {failure && (
        <div role="alert" className="border-l-4 border-teal pl-3">
          <p className="font-semibold">{failure.title}</p>
          <p className="mt-1 text-haze">{failure.detail}</p>
          {(failure.kind === "signed_out" || failure.kind === "reconnect") && (
            <p className="mt-2">
              <a href="/connect">Connect your 0G account</a>
            </p>
          )}
        </div>
      )}
      {result && (
        <div aria-live="polite" className="space-y-3">
          <p className="font-semibold">{result.headline}</p>
          <p className="text-haze">{result.detail}</p>
          <p>
            <a href={result.nightHref}>View this night</a>
            <span className="text-haze"> · Night {result.nightId}</span>
          </p>
          {result.tasks.length > 0 && (
            <ul className="divide-y divide-haze/20">
              {result.tasks.map((task) => (
                <li key={task.id} className="py-2">
                  <p className="font-semibold">{task.label}</p>
                  <p className="text-sm text-haze">
                    {task.statusLabel}
                    {task.error ? ` · ${task.error}` : ""}
                  </p>
                  {task.verify.length > 0 && (
                    <p className="mt-1 text-sm">
                      {task.verify.map((link) => (
                        <a key={link.requestId} href={link.href} className="mr-3">
                          Verify result {link.requestId}
                        </a>
                      ))}
                    </p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </section>
  );
}
