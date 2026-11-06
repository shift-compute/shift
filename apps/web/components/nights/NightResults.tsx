"use client";

import { useEffect, useState } from "react";
import { NightStrip } from "../night/NightStrip";
import { TaskOutput } from "./TaskOutput";
import { StatTile } from "../ui/StatTile";
import { StatusBadge, type BadgeTone } from "../ui/StatusBadge";
import { formatAmount } from "../../lib/format";
import { stripFromNight } from "../../lib/night-strip";
import {
  anchorHref,
  formatUtc,
  nightStatusLabel,
  readNight,
  stepLabel,
  teeVerdict,
  trustLabel,
  verifyHref,
  type NightPanel,
  type NightResponse,
  type NightSpending,
  type NightTaskResult,
  type PublicNight,
} from "../../lib/night-response";

const TYPE_LABEL: Record<NightTaskResult["type"], string> = {
  AUDIO_SUMMARY: "Summarize audio",
  DOC_ANALYSIS: "Analyze a document",
  IMAGE_FROM_PROMPT: "Generate an image",
};

const TASK_STATUS: Record<string, string> = {
  QUEUED: "Waiting for tonight",
  PLANNED: "Planned for tonight",
  RUNNING: "Running",
  DONE: "Done",
  FAILED: "Failed",
  DEFERRED: "Moved to the next night",
  CANCELLED: "Cancelled",
};

const TASK_TONE: Record<string, BadgeTone> = { QUEUED: "wait", PLANNED: "active", RUNNING: "active", DONE: "done", FAILED: "bad", DEFERRED: "wait", CANCELLED: "neutral" };

export function NightResults({ nightId }: { nightId: string }) {
  const [panel, setPanel] = useState<NightPanel | { phase: "loading" }>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setInterval> | undefined;

    async function load() {
      const res = await fetch(`/api/nights/${encodeURIComponent(nightId)}`, { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      const next = await readNight(res);
      if (cancelled) return;
      setPanel(next);
      const live = next.phase === "ready" && (next.night.status === "RUNNING" || next.night.status === "ANCHORING");
      if (live && timer === undefined) timer = setInterval(() => void load(), 8000);
      if (!live && timer !== undefined) {
        clearInterval(timer);
        timer = undefined;
      }
    }

    void load();
    return () => {
      cancelled = true;
      if (timer) clearInterval(timer);
    };
  }, [nightId]);

  if (panel.phase === "loading") {
    return (
      <p className="text-haze" aria-live="polite">
        Loading this night…
      </p>
    );
  }
  if (panel.phase === "invalid") {
    return <p className="surface-card-warn rounded-xl bg-white/70 py-2 pl-3">That night id is not valid.</p>;
  }
  if (panel.phase === "unavailable") {
    return <p className="surface-card-warn rounded-xl bg-white/70 py-2 pl-3">We could not load this night. Try again in a moment.</p>;
  }
  if (panel.phase === "empty") {
    return <p className="text-haze">No night with this id has been recorded. Nights show up here after a shift runs.</p>;
  }

  const strip = stripFromNight(panel.night.status, panel.signedIn ? panel.results.tasks : []);

  return (
    <div className="space-y-8">
      <NightStrip model={strip} />
      <Batch night={panel.night} />
      {panel.signedIn ? <Personal results={panel.results} /> : <ConnectPrompt />}
    </div>
  );
}

function ConnectPrompt() {
  return (
    <p>
      <a href="/connect">Connect your 0G account</a> to see your results from this night.
    </p>
  );
}

function Personal({ results }: { results: NonNullable<NightResponse["results"]> }) {
  return (
    <>
      {results.spending && <Spending spending={results.spending} />}
      {results.tasks.length === 0 ? (
        <p className="text-haze">You have no results for this night.</p>
      ) : (
        <section aria-label="Your results" className="space-y-4">
          <h2 className="text-2xl font-semibold">Your results</h2>
          <ul className="space-y-4">
            {results.tasks.map((task) => (
              <li key={task.id}>
                <ProvenanceCard task={task} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

function Batch({ night }: { night: PublicNight }) {
  const txHref = night.anchorTx ? anchorHref(night.explorerUrl, night.anchorTx) : null;
  const started = night.startedAt ? formatUtc(night.startedAt) : null;
  const finished = night.finishedAt ? formatUtc(night.finishedAt) : null;
  return (
    <section aria-label="Anchored batch" className="surface-card max-w-3xl space-y-4">
      <h2 className="text-2xl font-semibold">Anchored batch</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <StatTile label="Results in the batch" value={String(night.itemCount)} />
        <StatTile label="Status" value={nightStatusLabel(night.status)} />
      </div>
      <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-[12rem_1fr] sm:gap-x-6">
        <dt className="text-haze">Merkle root</dt>
        <dd className="break-all">{night.merkleRoot ?? "Not recorded"}</dd>
        <dt className="text-haze">Manifest root</dt>
        <dd className="break-all">{night.manifestRoot ?? "Not recorded"}</dd>
        <dt className="text-haze">Anchor transaction</dt>
        <dd className="break-all">
          {night.anchorTx ? (
            txHref ? (
              <a href={txHref} target="_blank" rel="noreferrer">
                {night.anchorTx}
              </a>
            ) : (
              night.anchorTx
            )
          ) : (
            "Not anchored yet"
          )}
        </dd>
        {started && (
          <>
            <dt className="text-haze">Started</dt>
            <dd>{started}</dd>
          </>
        )}
        {finished && (
          <>
            <dt className="text-haze">Finished</dt>
            <dd>{finished}</dd>
          </>
        )}
      </dl>
    </section>
  );
}

function Spending({ spending }: { spending: NightSpending }) {
  return (
    <section aria-label="Credit and deposit" className="surface-card max-w-xl space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">Credit and deposit</h2>
        <p className="mt-1 text-sm text-haze">Taken from the Router usage history for this run.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile label="Credits spent" value={spending.creditUsed === null ? "Not recorded" : formatAmount(spending.creditUsed, spending.currency)} />
        <StatTile label="Deposit spent" value={spending.depositUsed === null ? "Not recorded" : formatAmount(spending.depositUsed, spending.currency)} />
        <StatTile label="Accounted cost" value={formatAmount(spending.spentUsdMicro, "usd")} />
      </div>
    </section>
  );
}

function ProvenanceCard({ task }: { task: NightTaskResult }) {
  const title = TYPE_LABEL[task.type];
  const prompt = task.prompt && task.prompt.length > 80 ? `${task.prompt.slice(0, 80)}…` : task.prompt;
  return (
    <article aria-labelledby={`task-${task.id}`} className="surface-card surface-card-hover space-y-4">
      <div>
        <h3 id={`task-${task.id}`} className="text-xl font-semibold">
          {title}
        </h3>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-sm text-haze">
          <StatusBadge tone={TASK_TONE[task.status]}>{TASK_STATUS[task.status] ?? task.status}</StatusBadge>
          {prompt ? <span>{`“${prompt}”`}</span> : null}
        </p>
      </div>
      {task.error && (
        <p role="alert" className="surface-card-warn rounded-xl bg-white/70 py-2 pl-3">
          {task.error}
        </p>
      )}
      <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-[12rem_1fr] sm:gap-x-6">
        <dt className="text-haze">Model</dt>
        <dd>{task.chosenModel ?? "Not recorded"}</dd>
        <dt className="text-haze">Cost</dt>
        <dd>{task.actualCostUsdMicro === null ? "Not reported" : formatAmount(task.actualCostUsdMicro, "usd")}</dd>
        <dt className="text-haze">Ciphertext root</dt>
        <dd className="break-all">{task.outputRoot ?? "Not recorded"}</dd>
      </dl>
      <TaskOutput taskId={task.id} enabled={task.status === "DONE" && task.outputRoot !== null} />
      {task.steps.length === 0 ? (
        <p className="text-haze">No request was recorded for this task.</p>
      ) : (
        <ol className="space-y-4 border-t border-haze/20 pt-4">
          {task.steps.map((step, index) => (
            <li key={step.requestId ?? `${step.step}-${index}`} className="space-y-2">
              <p className="font-semibold">{stepLabel(step.step)}</p>
              <dl className="grid grid-cols-1 gap-y-2 sm:grid-cols-[12rem_1fr] sm:gap-x-6">
                <dt className="text-haze">Request id</dt>
                <dd className="break-all">{step.requestId ?? "Not recorded"}</dd>
                <dt className="text-haze">Model</dt>
                <dd>{step.model}</dd>
                <dt className="text-haze">Trust level</dt>
                <dd>{trustLabel(step.trust)}</dd>
                <dt className="text-haze">TEE</dt>
                <dd>{teeVerdict(step.teeVerified)}</dd>
                <dt className="text-haze">Cost</dt>
                <dd>{step.costUsdMicro === null ? "Not reported" : formatAmount(step.costUsdMicro, "usd")}</dd>
              </dl>
              {step.requestId && (
                <p>
                  <a href={verifyHref(step.requestId)}>Verify this result</a>
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </article>
  );
}
