import { stripStateLabel, type NightStripModel, type StripBlockState } from "../../lib/night-strip";

/**
 * Signature element (plan §18.2): the night from now until 00:00 UTC.
 * Task width follows cost. Spent budget advances from the left, and a finished night is First light.
 * Motion is a width transition plus the spent edge; `prefers-reduced-motion` removes both.
 */
export function NightStrip({ model, busy = false }: { model: NightStripModel; busy?: boolean }) {
  const finished = model.tone === "finished";
  const consumed = finished ? 100 : model.consumedBps / 100;
  return (
    <section aria-label="Night strip" aria-busy={busy} className="space-y-3">
      <p className="max-w-2xl text-haze">{model.caption}</p>
      <div className="flex justify-between text-sm text-haze">
        <span>{model.startLabel}</span>
        <span>{model.endLabel}</span>
      </div>
      <div className="relative h-20 overflow-hidden rounded-md bg-sky ring-1 ring-inset ring-haze/50 sm:h-28" aria-hidden="true">
        <div className="absolute inset-y-0 left-0 bg-light transition-[width] duration-700 ease-out motion-reduce:transition-none" style={{ width: `${consumed}%` }} />
        <div className="relative flex h-full items-end gap-1 px-1.5 pt-6 pb-1.5 sm:px-2 sm:pt-8 sm:pb-2">
          {model.segments.map((segment) => (
            <div
              key={segment.id}
              title={`${segment.label}. ${stripStateLabel(segment.state)}. ${segment.costLabel}`}
              className={`flex h-12 min-w-0 items-center overflow-hidden rounded-sm sm:h-14 ${blockClass(segment.state)}`}
              style={segment.shareBps > 0 ? { flexGrow: segment.shareBps, flexBasis: 0 } : { flexGrow: 0, flexBasis: "0.5rem" }}
            >
              <span className="truncate px-2 text-xs font-semibold sm:text-sm">{segment.label}</span>
            </div>
          ))}
          {model.segments.length > 0 && model.remainderBps > 0 && (
            <div className="flex min-w-0 items-center justify-center overflow-hidden" style={{ flexGrow: model.remainderBps, flexBasis: 0 }}>
              {model.remainderBps >= 1800 && (
                <span className={`truncate px-2 text-xs sm:text-sm ${finished ? "text-sky" : "text-haze"}`}>Left for the commons</span>
              )}
            </div>
          )}
        </div>
        {model.tone === "running" && (
          <div
            className="night-edge pointer-events-none absolute inset-y-0 z-10 w-1 -translate-x-1/2 bg-paper motion-reduce:animate-none"
            style={{ left: `${consumed}%` }}
          />
        )}
      </div>
      {model.segments.length > 0 && (
        <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm text-haze">
          {model.segments.map((segment) => (
            <li key={segment.id}>
              {segment.label}
              <span className="sr-only">, {stripStateLabel(segment.state)}</span>
              <span aria-hidden="true"> · </span>
              {segment.costLabel}
            </li>
          ))}
        </ul>
      )}
      {model.segments.length > 0 && model.remainderBps >= 100 && <p className="sr-only">Left for the commons.</p>}
    </section>
  );
}

function blockClass(state: StripBlockState): string {
  switch (state) {
    case "done":
      return "bg-night text-paper";
    case "failed":
      return "bg-transparent text-haze ring-1 ring-inset ring-haze";
    case "running":
      return "bg-sodium text-sky ring-2 ring-paper";
    default:
      return "bg-sodium/80 text-sky";
  }
}
