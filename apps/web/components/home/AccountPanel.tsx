"use client";

import { useEffect, useState } from "react";
import { formatAmount } from "../../lib/format";

interface AccountView {
  currency: string;
  credit: string;
  deposit: string;
}

type State =
  | { phase: "loading" }
  | { phase: "signed_out" }
  | { phase: "reconnect" }
  | { phase: "unavailable" }
  | { phase: "ready"; account: AccountView; mode: string };

const MODE_TEXT: Record<string, string> = {
  IAI_CREDITS_ONLY: "Spending only credits that are about to expire",
  BUDGET: "Spending up to your nightly budget",
};

export function AccountPanel() {
  const [state, setState] = useState<State>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [accountRes, sessionRes] = await Promise.all([fetch("/api/account"), fetch("/api/session")]);
        if (cancelled) return;
        if (accountRes.status === 401) return setState({ phase: "signed_out" });
        if (accountRes.status === 409) return setState({ phase: "reconnect" });
        if (!accountRes.ok) return setState({ phase: "unavailable" });
        const a = (await accountRes.json()) as { currency: string; balance: { credit: string; deposit: string } };
        const s = (await sessionRes.json().catch(() => ({}))) as { mode?: string };
        setState({ phase: "ready", account: { currency: a.currency, credit: a.balance.credit, deposit: a.balance.deposit }, mode: s.mode ?? "" });
      } catch {
        if (!cancelled) setState({ phase: "unavailable" });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  switch (state.phase) {
    case "loading":
      return (
        <p className="text-haze" aria-live="polite">
          Reading your balance…
        </p>
      );
    case "signed_out":
      return (
        <p>
          <a href="/connect" className="inline-block rounded-md bg-sodium px-5 py-2 font-semibold text-sky no-underline">
            Connect your 0G account
          </a>
        </p>
      );
    case "reconnect":
      return (
        <p>
          Your management key is no longer stored. <a href="/connect">Connect again</a> to keep using Shift.
        </p>
      );
    case "unavailable":
      return <p className="border-l-4 border-sodium pl-3">We could not read your balance right now. Try again in a moment.</p>;
    case "ready":
      return (
        <dl className="grid max-w-md grid-cols-[auto_1fr] gap-x-6 gap-y-2">
          <dt className="text-haze">Credits that expire at the reset</dt>
          <dd className="font-semibold text-light">{formatAmount(state.account.credit, state.account.currency)}</dd>
          <dt className="text-haze">Deposit (never used by iAI mode)</dt>
          <dd>{formatAmount(state.account.deposit, state.account.currency)}</dd>
          {MODE_TEXT[state.mode] && (
            <>
              <dt className="text-haze">Mode</dt>
              <dd>{MODE_TEXT[state.mode]}</dd>
            </>
          )}
        </dl>
      );
  }
}
