"use client";

import { useEffect, useState } from "react";
import { z } from "zod";
import { ensAppUrl } from "../../lib/ens";
import { safeHttpUrl } from "../../lib/verify-response";

const identitySchema = z.object({
  name: z.string(),
  address: z.string().nullable(),
  primaryName: z.boolean(),
  url: z.string().nullable(),
  github: z.string().nullable(),
  ledgerRecord: z.string().nullable(),
  ledger: z.enum(["matches", "differs", "not_published", "unavailable"]),
});
type Identity = z.infer<typeof identitySchema>;

const LEDGER_TEXT: Record<Identity["ledger"], string> = {
  matches: "The ledger contract this site reads is the one the name publishes.",
  differs: "The name publishes a different ledger than the one this site reads.",
  not_published: "The name does not publish a ledger contract yet.",
  unavailable: "The ledger record could not be read right now.",
};

/** Live ENS read of the team's name on Ethereum mainnet, with the published ledger cross-checked against the one in use. */
export function EnsIdentity() {
  const [state, setState] = useState<{ phase: "loading" } | { phase: "failed" } | { phase: "ready"; identity: Identity }>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/identity", { cache: "no-store" }).catch(() => null);
      const parsed = res?.ok ? identitySchema.safeParse(await res.json().catch(() => null)) : null;
      if (!cancelled) setState(parsed?.success ? { phase: "ready", identity: parsed.data } : { phase: "failed" });
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.phase === "loading") return <p className="text-sm text-haze">Reading tryshift.eth from Ethereum mainnet…</p>;
  if (state.phase === "failed") return <p className="text-sm text-haze">The ENS name could not be read right now.</p>;

  const { identity } = state;
  const url = safeHttpUrl(identity.url);
  return (
    <section aria-label="Shift identity on ENS" className="space-y-1 rounded-2xl border border-ink/10 bg-surface p-4 text-sm shadow-sm">
      <p>
        <a href={ensAppUrl(identity.name)} target="_blank" rel="noreferrer" className="font-semibold">
          {identity.name}
        </a>{" "}
        <span className="text-haze">on Ethereum mainnet</span>
      </p>
      <p className="text-haze">
        {identity.address ? (
          <>
            Resolves to <code>{identity.address}</code>
            {identity.primaryName ? " (its primary name)." : "."}
          </>
        ) : (
          "The name did not resolve to an address."
        )}
      </p>
      <p className="text-haze">{LEDGER_TEXT[identity.ledger]}</p>
      {identity.ledgerRecord && identity.ledger !== "unavailable" ? (
        <p className="text-haze">
          Record <code>shift.ledger</code>: <code>{identity.ledgerRecord}</code>
        </p>
      ) : null}
      {url ? (
        <p>
          <a href={url} target="_blank" rel="noreferrer">
            {url}
          </a>
        </p>
      ) : null}
    </section>
  );
}
