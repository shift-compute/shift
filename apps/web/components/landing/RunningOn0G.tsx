import { ZERO_G_LOGO } from "./logos";
import { Lift, Reveal } from "./motion";

const LEDGER = "https://chainscan-galileo.0g.ai/address/0xA3B6664b487FC01c4264977c9B92058A89C31Ed7";

const PIECES = [
  {
    n: "01",
    title: "0G Compute Router",
    body: "Every task is a Router call on your account: chat, decisions, speech-to-text, images. Request ids stay on the receipt.",
  },
  {
    n: "02",
    title: "0G Storage",
    body: "Outputs and the night manifest upload to the turbo indexer. The root is what the ledger anchors.",
  },
  {
    n: "03",
    title: "0G Chain",
    body: "ShiftLedger on Galileo, chain 16602, holds one Merkle root per finished night.",
  },
  {
    n: "04",
    title: "Private mode",
    body: "Private tasks plan on TeeML models, the ones the Router marks verifiable.",
  },
] as const;

const BELT = ["0G Compute", "0G Storage", "0G Chain", "Galileo 16602", "TeeML", "Router decisions", "Merkle roots", "00:00 UTC"] as const;

/** Closing band: Shift is built on 0G end to end, under 0G's own mark. */
export function RunningOn0G() {
  return (
    <section id="on-0g" aria-labelledby="on-0g-title" className="border-t border-ink/10 py-16 sm:py-20">
      <Reveal className="flex flex-col items-center text-center">
        <ZeroGMark className="h-16 w-16 sm:h-20 sm:w-20" />
        <p className="mt-6 inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-sm text-muted shadow-sm ring-1 ring-skycard">
          <span className="status-dot" aria-hidden="true" />
          Built for 0G · Build with 0G PC
        </p>
        <h2 id="on-0g-title" className="mt-5 max-w-3xl text-balance text-4xl font-semibold tracking-[-0.045em] sm:text-6xl">
          Running on 0G.
        </h2>
        <p className="mt-4 max-w-xl text-lg text-muted">
          Compute, storage and the proof all live on 0G. Shift only decides what to run before the reset.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <Marquee />
      </Reveal>

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {PIECES.map((piece, index) => (
          <Reveal key={piece.title} className="h-full" delay={0.08 * index}>
            <Lift className="h-full">
              <article className="h-full rounded-3xl bg-surface/90 px-6 py-7 ring-1 ring-ink/10">
                <span className="font-mono text-sm text-teal tabular-nums" aria-hidden="true">
                  {piece.n}
                </span>
                <h3 className="mt-4 text-xl font-medium tracking-[-0.03em]">{piece.title}</h3>
                <p className="mt-2 text-sm text-muted">{piece.body}</p>
              </article>
            </Lift>
          </Reveal>
        ))}
      </div>

      <Reveal className="mt-8 text-center text-sm">
        <a href={LEDGER} className="quiet-link">
          ShiftLedger on Galileo →
        </a>
      </Reveal>
    </section>
  );
}

/** The official 0G logo file, clipped to the page's rounded square. */
export function ZeroGMark({ className }: { className?: string }) {
  return (
    <img
      src={ZERO_G_LOGO.src}
      alt="0G"
      width={400}
      height={400}
      className={`rounded-[28%] shadow-[0_18px_40px_rgb(15_23_42/0.18)] ${className ?? ""}`}
    />
  );
}

/** The stack as a slow belt. Two copies make the loop seamless; the second is hidden from readers. */
function Marquee() {
  const row = (hidden: boolean) => (
    <ul className="flex shrink-0 items-center gap-3 pr-3" aria-hidden={hidden || undefined}>
      {BELT.map((label) => (
        <li key={label} className="flex items-center gap-2.5 rounded-full bg-surface/90 py-1.5 pl-1.5 pr-4 text-sm text-ink ring-1 ring-ink/10">
          <img src={ZERO_G_LOGO.src} alt="" width={28} height={28} className="h-7 w-7 rounded-full" />
          {label}
        </li>
      ))}
    </ul>
  );
  return (
    <div className="marquee mt-12 overflow-hidden">
      <div className="marquee-track flex w-max">
        {row(false)}
        {row(true)}
      </div>
    </div>
  );
}
