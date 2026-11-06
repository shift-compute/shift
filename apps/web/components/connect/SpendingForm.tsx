"use client";

import { useState, type FormEvent } from "react";
import { DEFAULT_DONATE_LEFTOVER, buildSettingsPayload, type Mode } from "./settings";

type Status = { kind: "idle" } | { kind: "saving" } | { kind: "saved" } | { kind: "error"; message: string };

const OPTIONS: Array<{ value: Mode; title: string; body: string }> = [
  { value: "IAI_CREDITS_ONLY", title: "Only credits that are about to expire", body: "Shift spends your leftover daily credits and never touches your deposit." },
  { value: "BUDGET", title: "A nightly budget", body: "Shift spends up to a cap you set each night, in US dollars." },
];

export function SpendingForm() {
  const [mode, setMode] = useState<Mode>("IAI_CREDITS_ONLY");
  const [budget, setBudget] = useState("");
  const [donate, setDonate] = useState(DEFAULT_DONATE_LEFTOVER);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    const built = buildSettingsPayload({ mode, budgetText: budget, donateLeftover: donate });
    if (!built.ok) return setStatus({ kind: "error", message: built.message });
    setStatus({ kind: "saving" });
    try {
      const res = await fetch("/api/settings", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(built.payload) });
      setStatus(res.ok ? { kind: "saved" } : { kind: "error", message: "Your choice was not saved. Try again." });
    } catch {
      setStatus({ kind: "error", message: "Could not reach the server. Try again." });
    }
  }

  return (
    <form onSubmit={onSubmit} className="mt-10 max-w-xl">
      <fieldset>
        <legend className="text-lg font-semibold">How should Shift spend?</legend>
        <div className="mt-3 space-y-3">
          {OPTIONS.map((o) => (
            <label key={o.value} className="flex cursor-pointer gap-3">
              <input type="radio" name="mode" value={o.value} checked={mode === o.value} onChange={() => setMode(o.value)} className="mt-1.5 accent-sodium" />
              <span>
                <span className="block font-semibold">{o.title}</span>
                <span className="block text-haze">{o.body}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {mode === "BUDGET" && (
        <div className="mt-4">
          <label htmlFor="budget" className="block text-haze">Nightly cap (US dollars)</label>
          <input
            id="budget"
            inputMode="decimal"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            placeholder="2.50"
            className="mt-1 w-40 rounded-full border border-ink/15 bg-surface px-4 py-2 text-ink placeholder:text-muted/70"
          />
        </div>
      )}

      <label className="mt-5 flex cursor-pointer gap-3">
        <input type="checkbox" checked={donate} onChange={(e) => setDonate(e.target.checked)} className="mt-1.5 accent-sodium" />
        <span>
          <span className="block font-semibold">Donate what is left to the commons</span>
          <span className="block text-haze">Unused budget translates Ethereum docs into Hindi and Marathi, and every donation is recorded.</span>
        </span>
      </label>

      <button type="submit" disabled={status.kind === "saving"} className="mt-6 rounded-full bg-teal px-5 py-2 font-semibold text-paper shadow-sm transition-colors duration-200 hover:bg-ink disabled:opacity-50">
        {status.kind === "saving" ? "Saving…" : "Save"}
      </button>
      <div aria-live="polite" className="mt-3">
        {status.kind === "saved" && <p className="text-light">Saved. Shift will use this tonight.</p>}
        {status.kind === "error" && <p role="alert" className="border-l-4 border-teal pl-3">{status.message}</p>}
      </div>
    </form>
  );
}
