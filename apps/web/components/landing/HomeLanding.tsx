import type { ReactNode } from "react";
import { Logo } from "../brand/Logo";
import { AccountPanel } from "../home/AccountPanel";
import { Countdown } from "../home/Countdown";
import { HomeNightStrip } from "../home/HomeNightStrip";
import { ResetBar } from "./ResetBar";

const STEPS = [
  {
    n: "01",
    title: "Queue",
    body: "Add an audio summary, a document analysis, or an image prompt. Tasks wait until the nightly window. The preview prices the live catalog and does not run anything.",
  },
  {
    n: "02",
    title: "Optimize overnight",
    body: "From 23:00 to 23:50 UTC, the optimizer fits that queue to the credits about to expire. Decision models set the quality floor when the live catalog includes them.",
  },
  {
    n: "03",
    title: "Donate leftovers",
    body: "Leftovers you donate pay for public-good translations. Provenance for the night is anchored on 0G Chain.",
  },
] as const;

const PRIMARY = "inline-flex items-center justify-center rounded-md bg-sodium px-5 py-2.5 font-semibold text-sky no-underline transition-colors duration-200 hover:bg-light";
const QUIET = "inline-flex items-center justify-center rounded-md px-5 py-2.5 font-semibold text-paper no-underline ring-1 ring-inset ring-haze/50 transition-colors duration-200 hover:bg-night";

export function HomeLanding() {
  return (
    <div>
      <section aria-labelledby="hero-title" className="pb-16 sm:pb-20">
        <Logo className="h-14 w-auto sm:h-16" alt="" />
        <h1 id="hero-title" className="mt-8 max-w-4xl text-4xl font-semibold sm:text-5xl">
          AI compute that was going to be wasted, turned into public goods with verifiable provenance.
        </h1>
        <p className="mt-6 max-w-2xl text-lg text-haze">
          Every night at 00:00 UTC, unused 0G credits expire. Shift spends them on queued AI tasks with an optimizer powered by 0G decision models, donates leftovers to public-good translations, and anchors provenance on 0G Chain.
        </p>
        <div className="mt-8 flex flex-wrap gap-3">
          <a href="/connect" className={PRIMARY}>
            Connect 0G
          </a>
          <a href="/queue" className={QUIET}>
            Run tonight's shift
          </a>
        </div>
        <div className="mt-12 max-w-xl">
          <ResetBar />
        </div>
      </section>

      <Section id="problem" title="Unused 0G credits expire at 00:00 UTC.">
        <p className="mt-6 max-w-2xl text-lg text-haze">
          A balance left untouched at the reset is gone. During the day you queue the work. Before midnight, Shift spends the credits that would expire on that queue. In iAI mode the deposit stays untouched. Budget mode spends only up to the nightly cap you set.
        </p>
      </Section>

      <Section id="how" title="How a night works">
        <ol className="mt-4 divide-y divide-haze/20">
          {STEPS.map((step) => (
            <li key={step.title} className="grid gap-2 py-8 sm:grid-cols-[5.5rem_1fr] sm:gap-8">
              <span className="font-display text-2xl text-sodium tabular-nums" aria-hidden="true">
                {step.n}
              </span>
              <div>
                <h3 className="text-2xl font-semibold">{step.title}</h3>
                <p className="mt-2 max-w-2xl text-haze">{step.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section id="tonight" title="Tonight, from your account">
        <p className="mt-6 max-w-2xl text-lg text-haze">
          The countdown is the real time until 00:00 UTC. The night strip and the balance are read from your 0G account. Signed out, this panel asks you to connect and leaves the strip empty.
        </p>
        <div className="mt-10 space-y-10 rounded-md bg-night px-6 py-8 sm:px-10 sm:py-10">
          <Countdown />
          <HomeNightStrip />
          <AccountPanel />
        </div>
      </Section>

      <Section id="why" title="Why 0G">
        <div className="mt-10 grid gap-12 sm:grid-cols-2">
          <div>
            <h3 className="text-2xl font-semibold">Credits with a cutoff</h3>
            <p className="mt-3 text-haze">
              0G compute credits reset at 00:00 UTC. Shift is built around that cutoff: spend what would expire, on work already in the queue.
            </p>
          </div>
          <div>
            <h3 className="text-2xl font-semibold">Origin on 0G Chain</h3>
            <p className="mt-3 text-haze">
              A completed night anchors a Merkle root in ShiftLedger. The verify page recomputes a leaf in the browser and checks it against the contract. This deployment is the Galileo testnet, chain ID 16602.
            </p>
          </div>
        </div>
      </Section>

      <footer className="border-t border-haze/20 py-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <a href="/" className="inline-flex no-underline">
              <Logo className="h-10 w-auto" />
            </a>
            <p className="mt-4 max-w-xs text-sm text-haze">Built for ETHGlobal Mumbai.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <a href="/queue" className="text-haze no-underline hover:text-paper hover:underline">
              Queue
            </a>
            <a href="https://github.com/shift-compute/shift" className="text-haze no-underline hover:text-paper hover:underline">
              Repository
            </a>
            <a href="/commons" className="text-haze no-underline hover:text-paper hover:underline">
              Commons
            </a>
            <a href="https://ethglobal.com/events/mumbai" className="text-haze no-underline hover:text-paper hover:underline">
              ETHGlobal Mumbai
            </a>
            <a href="/verify" className="text-haze no-underline hover:text-paper hover:underline">
              Verify
            </a>
            <a href="https://chainscan-galileo.0g.ai/address/0xA3B6664b487FC01c4264977c9B92058A89C31Ed7" className="text-haze no-underline hover:text-paper hover:underline">
              ShiftLedger on Galileo
            </a>
            <a href="/connect" className="text-haze no-underline hover:text-paper hover:underline">
              Connect
            </a>
          </nav>
        </div>
      </footer>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const titleId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className="reveal border-t border-haze/20 py-16 sm:py-20">
      <h2 id={titleId} className="max-w-3xl text-3xl font-semibold sm:text-4xl">
        {title}
      </h2>
      {children}
    </section>
  );
}
