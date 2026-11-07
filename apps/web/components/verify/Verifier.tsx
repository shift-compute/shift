"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { formatAmount } from "../../lib/format";
import { anchorHref, formatUtc, teeVerdict, trustLabel } from "../../lib/night-response";
import { blockHref, chainDetail, chainTitle, createLedgerReader, settleChainCheck, type ChainVerdict } from "../../lib/verify-chain";
import { checkStoredProof, type LocalProofCheck } from "../../lib/verify-proof";
import { readVerify, safeHttpUrl, type VerifyPanel, type VerifyResponse } from "../../lib/verify-response";

const VALUE_LABELS = [
  "Request id hash",
  "Owner",
  "Task id hash",
  "Output root",
  "Model hash",
  "Trust tier",
  "Cost (micro-USD)",
  "Commons",
] as const;

type ChainState = ChainVerdict | { status: "loading" } | { status: "idle" };

export function Verifier({ initialRequestId }: { initialRequestId: string }) {
  const router = useRouter();
  const requestId = initialRequestId.trim();
  const [draft, setDraft] = useState(initialRequestId);
  const [attempt, setAttempt] = useState(0);
  const [panel, setPanel] = useState<VerifyPanel | { phase: "loading" }>(requestId ? { phase: "loading" } : { phase: "empty" });
  const [chain, setChain] = useState<ChainState>({ status: "idle" });

  useEffect(() => {
    setDraft(initialRequestId);
  }, [initialRequestId]);

  useEffect(() => {
    if (!requestId) {
      setPanel({ phase: "empty" });
      setChain({ status: "idle" });
      return;
    }
    let cancelled = false;
    setPanel({ phase: "loading" });
    setChain({ status: "idle" });
    (async () => {
      const res = await fetch(`/api/verify/${encodeURIComponent(requestId)}`, { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      setPanel(await readVerify(res));
    })();
    return () => {
      cancelled = true;
    };
  }, [requestId, attempt]);

  const local = useMemo(() => (panel.phase === "ready" ? checkStoredProof(panel.body) : null), [panel]);

  useEffect(() => {
    if (panel.phase !== "ready" || !local?.leafHash) {
      if (panel.phase === "ready" && local && !local.leafHash) setChain({ status: "unavailable", blockNumber: null, anchoredAt: null, chainRoot: null, contractAccepted: null });
      return;
    }
    const leafHash = local.leafHash;
    let cancelled = false;
    setChain({ status: "loading" });
    (async () => {
      try {
        const reader = createLedgerReader({
          chainId: panel.body.chainId,
          rpcUrl: panel.body.rpcUrl,
          contractAddress: panel.body.contractAddress,
        });
        const verdict = await settleChainCheck(reader, {
          nightId: BigInt(panel.body.nightId),
          leaf: leafHash,
          proof: panel.body.proof,
          storedRoot: panel.body.merkleRoot,
          anchorTx: panel.body.anchorTx,
        });
        if (!cancelled) setChain(verdict);
      } catch {
        if (!cancelled) setChain({ status: "unavailable", blockNumber: null, anchoredAt: null, chainRoot: null, contractAccepted: null });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [panel, local]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const next = draft.trim();
    if (next.length === 0) return;
    if (next === requestId) setAttempt((value) => value + 1);
    router.push(`/verify?rid=${encodeURIComponent(next)}`);
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="surface-card max-w-3xl">
        <label htmlFor="request-id" className="block text-haze">
          Request id
        </label>
        <div className="mt-1 flex flex-col gap-3 sm:flex-row">
          <input
            id="request-id"
            name="rid"
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            autoComplete="off"
            spellCheck={false}
            placeholder="Paste a request id"
            className="field-input min-w-0 flex-1 font-mono"
          />
          <button type="submit" disabled={draft.trim().length === 0} className="btn-solid">
            Verify
          </button>
        </div>
      </form>

      <div aria-live="polite">
        {panel.phase === "loading" && <p className="text-haze">Loading this result…</p>}
        {panel.phase === "empty" && <p className="text-haze">Paste a request id to verify it against the anchored batch.</p>}
        {panel.phase === "invalid" && <p className="surface-card-warn rounded-xl bg-white/70 py-2 pl-3">That request id is not valid.</p>}
        {panel.phase === "not_found" && (
          <p className="text-haze">No anchored result uses this request id. Results show up here after a night is anchored.</p>
        )}
        {panel.phase === "unavailable" && (
          <div className="space-y-3">
            <p className="surface-card-warn rounded-xl bg-white/70 py-2 pl-3">We could not load this result. Try again in a moment.</p>
            <button type="button" onClick={() => setAttempt((value) => value + 1)} className="btn-quiet">
              Try again
            </button>
          </div>
        )}
        {panel.phase === "ready" && local && <Result body={panel.body} local={local} chain={chain} onRetry={() => setAttempt((value) => value + 1)} />}
      </div>
    </div>
  );
}

function Result({ body, local, chain, onRetry }: { body: VerifyResponse; local: LocalProofCheck; chain: ChainState; onRetry: () => void }) {
  const outputHref = safeHttpUrl(body.outputUrl);
  const manifestHref = safeHttpUrl(body.manifestUrl);
  const txHref = body.anchorTx ? anchorHref(body.explorerUrl, body.anchorTx) : null;
  const anchored = chain.status === "loading" || chain.status === "idle" ? null : anchoredLabel(chain.anchoredAt);
  return (
    <div className="max-w-3xl space-y-8">
      <ChainPanel chain={chain} body={body} onRetry={onRetry} />
      <LocalPanel local={local} hasRoot={body.merkleRoot !== null} />
      <section aria-label="Result" className="surface-card surface-card-hover space-y-4">
        <h2 className="text-2xl font-semibold">Result</h2>
        <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-[12rem_1fr] sm:gap-x-6">
          <dt className="text-haze">Model</dt>
          <dd>{body.model ?? "Not recorded"}</dd>
          <dt className="text-haze">Trust level</dt>
          <dd>{trustLabel(body.trace.tier)}</dd>
          <dt className="text-haze">TEE</dt>
          <dd>{teeVerdict(body.trace.tee_verified)}</dd>
          <dt className="text-haze">Provider</dt>
          <dd className="break-all">{body.trace.provider ?? "Not recorded"}</dd>
          <dt className="text-haze">Provider identity</dt>
          <dd className="break-all">{body.trace.provider_identity ?? "Not recorded"}</dd>
          <dt className="text-haze">Ciphertext on 0G Storage</dt>
          <dd className="break-all">
            {outputHref ? (
              <a href={outputHref} target="_blank" rel="noreferrer">
                {body.outputRoot}
              </a>
            ) : (
              body.outputRoot
            )}
            <span className="mt-1 block text-sm text-haze">This link is the ciphertext. The signed-in owner reads the result on the night page. Commons files are not stored here.</span>
          </dd>
          <dt className="text-haze">Night</dt>
          <dd>
            <a href={`/nights/${body.nightId}`}>{body.nightId}</a>
          </dd>
          <dt className="text-haze">Manifest root</dt>
          <dd className="break-all">
            {body.manifestRoot ? (
              manifestHref ? (
                <a href={manifestHref} target="_blank" rel="noreferrer">
                  {body.manifestRoot}
                </a>
              ) : (
                body.manifestRoot
              )
            ) : (
              "Not recorded"
            )}
          </dd>
          <dt className="text-haze">Anchor transaction</dt>
          <dd className="break-all">
            {body.anchorTx ? (
              txHref ? (
                <a href={txHref} target="_blank" rel="noreferrer">
                  {body.anchorTx}
                </a>
              ) : (
                body.anchorTx
              )
            ) : (
              "Not recorded"
            )}
          </dd>
          {anchored && (
            <>
              <dt className="text-haze">Anchored at</dt>
              <dd>{anchored}</dd>
            </>
          )}
          <dt className="text-haze">Contract</dt>
          <dd className="break-all">
            <a href={`${body.explorerUrl}/address/${body.contractAddress}`} target="_blank" rel="noreferrer">
              {body.contractAddress}
            </a>
            <span className="text-haze"> · chain {body.chainId}</span>
          </dd>
        </dl>
      </section>
      <section aria-label="Leaf values" className="surface-card space-y-4">
        <h2 className="text-2xl font-semibold">Leaf values</h2>
        <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-[12rem_1fr] sm:gap-x-6">
          {VALUE_LABELS.map((label, index) => (
            <LeafField key={label} label={label} value={body.values[index] ?? ""} />
          ))}
        </dl>
      </section>
      <section aria-label="Merkle proof" className="surface-card space-y-3">
        <h2 className="text-2xl font-semibold">Merkle proof</h2>
        {body.proof.length === 0 ? (
          <p className="text-haze">This leaf is the whole tree, so the proof is empty.</p>
        ) : (
          <ol className="list-decimal space-y-2 pl-5">
            {body.proof.map((node, index) => (
              <li key={`${node}-${index}`} className="break-all font-mono text-sm">
                {node}
              </li>
            ))}
          </ol>
        )}
        <p className="break-all text-sm text-haze">Stored Merkle root {body.merkleRoot ?? "not recorded"}</p>
      </section>
    </div>
  );
}

function LeafField({ label, value }: { label: (typeof VALUE_LABELS)[number]; value: string }) {
  let shown = value;
  if (label === "Cost (micro-USD)") shown = formatAmount(value, "usd");
  if (label === "Commons") shown = value === "true" ? "Yes" : "No";
  if (label === "Trust tier") shown = `${value} · ${trustLabel(value === "0" ? "standard" : value === "1" ? "verified" : "private")}`;
  return (
    <>
      <dt className="text-haze">{label}</dt>
      <dd className="break-all font-mono text-sm">{shown}</dd>
    </>
  );
}

function LocalPanel({ local, hasRoot }: { local: LocalProofCheck; hasRoot: boolean }) {
  const hash =
    local.leafHash === null
      ? "These leaf values could not be hashed."
      : local.hashMatches
        ? "The leaf hash matches the values above."
        : "The stored leaf hash differs from the hash of these values.";
  const proof =
    local.leafHash === null
      ? null
      : !hasRoot
        ? "No Merkle root is stored for this night, so the proof was not checked against one."
        : local.proofMatches
          ? "The proof connects this leaf to the stored Merkle root."
          : "The proof does not reach the stored Merkle root.";
  return (
    <section aria-label="Leaf hash" className="surface-card surface-card-hover space-y-2">
      <h2 className="text-2xl font-semibold">Checked in this browser</h2>
      <p>{hash}</p>
      {proof && <p>{proof}</p>}
      {local.leafHash && <p className="break-all text-sm text-haze">Recomputed leaf hash {local.leafHash}</p>}
    </section>
  );
}

function ChainPanel({ chain, body, onRetry }: { chain: ChainState; body: VerifyResponse; onRetry: () => void }) {
  if (chain.status === "idle" || chain.status === "loading") {
    return <p className="text-haze">Reading ShiftLedger on 0G Chain…</p>;
  }
  const confirmed = chain.status === "confirmed";
  return (
    <section aria-label="On-chain check" className={`surface-card space-y-3 ${confirmed ? "" : "surface-card-warn"}`}>
      <h2 className={`text-2xl font-semibold ${confirmed ? "text-light" : ""}`}>{chainTitle(chain)}</h2>
      <p className="text-haze">{chainDetail(chain)}</p>
      {chain.chainRoot && <p className="break-all text-sm">On-chain root {chain.chainRoot}</p>}
      <div className="flex flex-wrap gap-4">
        {chain.blockNumber !== null && (
          <a href={blockHref(body.explorerUrl, chain.blockNumber)} target="_blank" rel="noreferrer">
            View block {chain.blockNumber.toString()}
          </a>
        )}
        {chain.status === "unavailable" && (
          <button type="button" onClick={onRetry} className="btn-quiet">
            Try again
          </button>
        )}
      </div>
    </section>
  );
}

function anchoredLabel(seconds: bigint | null): string | null {
  if (seconds === null || seconds <= 0n) return null;
  const ms = seconds * 1000n;
  if (ms > BigInt(Number.MAX_SAFE_INTEGER)) return null;
  return formatUtc(new Date(Number(ms)).toISOString());
}
