"use client";

import { useState, type FormEvent } from "react";
import { describeConnectError, shortAddress, type ConnectErrorBody, type ErrorMessage } from "./messages";
import { SpendingForm } from "./SpendingForm";
import { StatTile } from "../ui/StatTile";
import { StepCard, type StepState } from "../ui/StepCard";

interface Connected {
  address: string;
  currency: string;
  creditBalance: string;
  depositBalance: string;
}

type State = { phase: "idle" } | { phase: "submitting" } | { phase: "error"; message: ErrorMessage } | { phase: "done"; account: Connected };

const STEPS = [
  { title: "Open the 0G console", body: (url: string) => <>Go to <a href={`${url}`} target="_blank" rel="noreferrer">{url.replace("https://", "")}</a>, sign in, and open <strong>Settings → Management Keys</strong>.</> },
  { title: "Create a key with three permissions", body: () => <>Choose the <strong>Custom</strong> preset and tick only <strong>Read account</strong>, <strong>Create keys</strong> and <strong>Revoke / update</strong>. Name it <code>shift</code>. Leave <strong>List keys</strong> unticked.</> },
  { title: "Copy the key", body: () => <>The console shows it only once. It starts with <code>mk-</code>.</> },
] as const;

export function ConnectWizard({ consoleUrl }: { consoleUrl: string }) {
  const [state, setState] = useState<State>({ phase: "idle" });
  const [key, setKey] = useState("");
  const [visible, setVisible] = useState(false);
  const [current, setCurrent] = useState(0);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setState({ phase: "submitting" });
    try {
      const res = await fetch("/api/connect", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ mk: key }) });
      const body = (await res.json().catch(() => null)) as (ConnectErrorBody & { account?: Connected }) | null;
      if (res.ok && body?.account) {
        setKey(""); // the key must not outlive the request in the page
        setState({ phase: "done", account: body.account });
      } else {
        setState({ phase: "error", message: describeConnectError(res.status, body) });
      }
    } catch {
      setState({ phase: "error", message: describeConnectError(502, { error: "router_unavailable" }) });
    }
  }

  if (state.phase === "done") {
    const a = state.account;
    return (
      <section aria-live="polite" className="surface-card max-w-xl">
        <h2 className="text-2xl font-semibold text-light">Account connected</h2>
        <p className="mt-2 text-haze">Shift can now read your balance and create short-lived, capped keys. It will not show your management key again.</p>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-haze">Account</dt>
          <dd className="font-mono">{shortAddress(a.address)}</dd>
        </dl>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <StatTile label="Credit balance" value={`${a.creditBalance} ${a.currency}`} />
          <StatTile label="Deposit balance" value={`${a.depositBalance} ${a.currency}`} />
        </div>
        <SpendingForm />
      </section>
    );
  }

  const submitting = state.phase === "submitting";
  const stateOf = (i: number): StepState => (i < current ? "done" : i === current ? "current" : "upcoming");
  // Local progress only: clicking the current step completes it, clicking any other step jumps back or ahead to it.
  const select = (i: number) => setCurrent(i === current && i < STEPS.length ? i + 1 : i);
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <ol className="space-y-5">
        {STEPS.map((s, i) => (
          <StepCard key={s.title} index={i + 1} title={s.title} state={stateOf(i)} onSelect={() => select(i)}>
            <p className="mt-1 text-haze">{s.body(consoleUrl)}</p>
          </StepCard>
        ))}
        <StepCard index={4} title="Paste it here" state={stateOf(STEPS.length)} last onSelect={() => setCurrent(STEPS.length)}>
          <form onSubmit={onSubmit} className="mt-2">
            <label htmlFor="mk" className="block text-haze">Management key</label>
            <div className="mt-1 flex gap-2">
              <input
                id="mk"
                name="mk"
                type={visible ? "text" : "password"}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onFocus={() => setCurrent(STEPS.length)}
                autoComplete="off"
                spellCheck={false}
                placeholder="mk-…"
                required
                aria-describedby="mk-help"
                className="field-input min-w-0 flex-1 font-mono"
              />
              <button type="button" onClick={() => setVisible((v) => !v)} className="btn-quiet" aria-pressed={visible}>
                {visible ? "Hide" : "Show"}
              </button>
            </div>
            <button type="submit" disabled={submitting || key.length === 0} className="btn-solid mt-4">
              {submitting ? "Checking permissions…" : "Connect your 0G account"}
            </button>
          </form>
          <div aria-live="polite">
            {state.phase === "error" && (
              <div role="alert" className="surface-card-warn mt-5 rounded-xl bg-white/70 py-2 pl-4">
                <p className="font-semibold">{state.message.title}</p>
                <p className="mt-1 text-haze">{state.message.detail}</p>
                {state.message.missingScopes && (
                  <ul className="mt-2 list-disc pl-5 text-haze">
                    {state.message.missingScopes.map((s) => <li key={s}>{s}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        </StepCard>
      </ol>
      <aside className="surface-card lg:sticky lg:top-24">
        <p id="mk-help" className="text-haze">Stored encrypted on the server. It can only read your balance and create or revoke keys; it cannot run models or spend credit.</p>
      </aside>
    </div>
  );
}
