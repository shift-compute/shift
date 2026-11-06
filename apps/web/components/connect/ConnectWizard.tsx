"use client";

import { useState, type FormEvent } from "react";
import { describeConnectError, shortAddress, type ConnectErrorBody, type ErrorMessage } from "./messages";
import { SpendingForm } from "./SpendingForm";

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
      <section aria-live="polite" className="max-w-xl">
        <h2 className="text-2xl font-semibold text-light">Account connected</h2>
        <p className="mt-2 text-haze">Shift can now read your balance and create short-lived, capped keys. It will not show your management key again.</p>
        <dl className="mt-6 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-haze">Account</dt>
          <dd className="font-mono">{shortAddress(a.address)}</dd>
          <dt className="text-haze">Credit balance</dt>
          <dd>{a.creditBalance} {a.currency}</dd>
          <dt className="text-haze">Deposit balance</dt>
          <dd>{a.depositBalance} {a.currency}</dd>
        </dl>
        <SpendingForm />
      </section>
    );
  }

  const submitting = state.phase === "submitting";
  return (
    <div className="max-w-2xl">
      <ol className="space-y-5">
        {STEPS.map((s, i) => (
          <li key={s.title} className="grid grid-cols-[2rem_1fr] gap-3">
            <span aria-hidden className="font-display text-2xl font-semibold text-teal">{i + 1}</span>
            <div>
              <h2 className="text-lg font-semibold">{s.title}</h2>
              <p className="mt-1 text-haze">{s.body(consoleUrl)}</p>
            </div>
          </li>
        ))}
        <li className="grid grid-cols-[2rem_1fr] gap-3">
          <span aria-hidden className="font-display text-2xl font-semibold text-teal">4</span>
          <div>
            <h2 className="text-lg font-semibold">Paste it here</h2>
            <form onSubmit={onSubmit} className="mt-2">
              <label htmlFor="mk" className="block text-haze">Management key</label>
              <div className="mt-1 flex gap-2">
                <input
                  id="mk"
                  name="mk"
                  type={visible ? "text" : "password"}
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="mk-…"
                  required
                  className="min-w-0 flex-1 rounded-full border border-ink/15 bg-surface px-4 py-2 font-mono text-ink placeholder:text-muted/70"
                />
                <button type="button" onClick={() => setVisible((v) => !v)} className="rounded-md border border-haze/40 px-3 text-haze" aria-pressed={visible}>
                  {visible ? "Hide" : "Show"}
                </button>
              </div>
              <p className="mt-2 text-sm text-haze">Stored encrypted on the server. It can only read your balance and create or revoke keys; it cannot run models or spend credit.</p>
              <button type="submit" disabled={submitting || key.length === 0} className="mt-4 rounded-full bg-teal px-5 py-2 font-semibold text-paper shadow-sm transition-colors duration-200 hover:bg-ink disabled:opacity-50">
                {submitting ? "Checking permissions…" : "Connect your 0G account"}
              </button>
            </form>
            <div aria-live="polite">
              {state.phase === "error" && (
                <div role="alert" className="mt-5 border-l-4 border-teal pl-4">
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
          </div>
        </li>
      </ol>
    </div>
  );
}
