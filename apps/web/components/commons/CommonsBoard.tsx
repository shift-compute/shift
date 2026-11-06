"use client";

import { useEffect, useState } from "react";
import { formatAmount } from "../../lib/format";
import {
  commonsStatusLabel,
  formatProbability,
  languageLabel,
  modelsLabel,
  readCommons,
  type CommonsDonor,
  type CommonsItemPublic,
  type CommonsPanel,
  type CommonsResponse,
} from "../../lib/commons-response";

export function CommonsBoard() {
  const [panel, setPanel] = useState<CommonsPanel | { phase: "loading" }>({ phase: "loading" });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch("/api/commons", { cache: "no-store" }).catch(() => null);
      if (cancelled) return;
      const next = await readCommons(res);
      if (!cancelled) setPanel(next);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (panel.phase === "loading") {
    return (
      <p className="text-haze" aria-live="polite">
        Loading the commons queue…
      </p>
    );
  }
  if (panel.phase === "unavailable") {
    return <p className="border-l-4 border-sodium pl-3">We could not load the commons queue. Try again in a moment.</p>;
  }
  if (panel.phase === "empty") {
    return (
      <p className="text-haze">
        No translation has been accepted or rejected yet, and no donation has been recorded. Both show up here after a night spends leftover compute on this queue.
      </p>
    );
  }

  const accepted = panel.data.items.filter((item) => item.status === "ACCEPTED");
  const rejected = panel.data.items.filter((item) => item.status === "REJECTED");
  return (
    <div className="space-y-10">
      <Donors donors={panel.data.donors} total={panel.data.totalDonatedUsdMicro} />
      <ItemList
        title="Accepted"
        empty="None accepted yet."
        items={accepted}
        note="Accepted when the decision model was confident that both translations match the source."
      />
      <ItemList
        title="Rejected"
        empty="None rejected yet."
        items={rejected}
        note="Rejected translations stay visible. They are the proof that the filter turned something down."
      />
    </div>
  );
}

function Donors({ donors, total }: { donors: CommonsDonor[]; total: CommonsResponse["totalDonatedUsdMicro"] }) {
  return (
    <section aria-label="Donated compute" className="max-w-3xl space-y-4 rounded-md bg-night p-5">
      <div>
        <h2 className="text-2xl font-semibold">Donated compute</h2>
        <p className="mt-1 text-sm text-haze">Total leftover compute recorded for each 0G account.</p>
      </div>
      {donors.length === 0 ? (
        <p className="text-haze">No donation has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <caption className="sr-only">Compute donated to the commons queue, by 0G account</caption>
            <thead>
              <tr className="text-haze">
                <th scope="col" className="pb-2 font-normal">
                  Account
                </th>
                <th scope="col" className="pb-2 text-right font-normal">
                  Donated
                </th>
              </tr>
            </thead>
            <tbody>
              {donors.map((donor) => (
                <tr key={donor.address} className="border-t border-haze/20">
                  <th scope="row" className="break-all py-2 pr-4 font-normal">
                    {donor.address}
                  </th>
                  <td className="py-2 text-right whitespace-nowrap">{formatAmount(donor.donatedUsdMicro, "usd")}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t border-haze/20 font-semibold text-light">
                <th scope="row" className="py-2 pr-4 text-left font-semibold">
                  Total
                </th>
                <td className="py-2 text-right whitespace-nowrap">{formatAmount(total, "usd")}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </section>
  );
}

function ItemList({ title, empty, items, note }: { title: string; empty: string; items: CommonsItemPublic[]; note: string }) {
  return (
    <section aria-label={title} className="space-y-4">
      <div>
        <h2 className="text-2xl font-semibold">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-haze">{note}</p>
      </div>
      {items.length === 0 ? (
        <p className="text-haze">{empty}</p>
      ) : (
        <ul className="space-y-4">
          {items.map((item) => (
            <li key={item.id}>
              <TranslationCard item={item} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TranslationCard({ item }: { item: CommonsItemPublic }) {
  const title = `${languageLabel(item.targetLang)} · ${commonsStatusLabel(item.status)}`;
  const rejected = item.status === "REJECTED";
  return (
    <article aria-labelledby={`commons-${item.id}`} className={`space-y-4 rounded-md bg-night p-5 ${rejected ? "border-l-4 border-sodium" : ""}`}>
      <h3 id={`commons-${item.id}`} className={`text-xl font-semibold ${rejected ? "" : "text-light"}`}>
        {title}
      </h3>
      <dl className="grid grid-cols-1 gap-y-3 sm:grid-cols-[12rem_1fr] sm:gap-x-6">
        <dt className="text-haze">Source</dt>
        <dd lang="en">{item.sourceExcerpt.length === 0 ? "Not recorded" : item.sourceExcerpt}</dd>
        <dt className="text-haze">Translation</dt>
        <dd lang={item.targetLang}>{item.translationA ?? "Not recorded"}</dd>
        <dt className="text-haze">Models</dt>
        <dd>{modelsLabel(item)}</dd>
        <dt className="text-haze">Filter probability</dt>
        <dd>{item.gateProbability === null ? "Not recorded" : formatProbability(item.gateProbability)}</dd>
        <dt className="text-haze">0G Storage root</dt>
        <dd className="break-all">{item.outputRoot ?? "Not stored"}</dd>
      </dl>
    </article>
  );
}
