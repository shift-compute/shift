import type { ReactNode } from "react";
import { Logo } from "../brand/Logo";
import { AmbientField } from "./AmbientField";
import { Hero } from "./Hero";
import { Lift, Reveal } from "./motion";

export function HomeLanding() {
  return (
    <div>
      <AmbientField />
      <Hero />

      <Reveal>
        <Section id="problem" title="A balance left at midnight is gone.">
          <p className="mt-6 max-w-2xl text-lg text-muted">
            During the day you queue the work. Before midnight, Shift spends the credits that would expire on that queue. In iAI mode the deposit stays untouched. Budget mode spends only up to the nightly cap you set.
          </p>
        </Section>
      </Reveal>

      <Reveal>
        <Section id="why" title="Why this runs on 0G">
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Lift className="h-full">
              <div className="h-full rounded-3xl bg-surface/90 px-6 py-7 ring-1 ring-ink/10">
                <h3 className="text-2xl font-medium tracking-[-0.03em]">Credits with a cutoff</h3>
                <p className="mt-3 text-muted">
                  0G compute credits reset at 00:00 UTC. Shift is built around that cutoff: spend what would expire, on work already in the queue.
                </p>
              </div>
            </Lift>
            <Lift className="h-full">
              <div className="h-full rounded-3xl bg-surface/90 px-6 py-7 ring-1 ring-ink/10">
                <h3 className="text-2xl font-medium tracking-[-0.03em]">Origin on 0G Chain</h3>
                <p className="mt-3 text-muted">
                  A completed night anchors a Merkle root in ShiftLedger. The verify page recomputes a leaf in the browser and checks it against the contract. This deployment is the Galileo testnet, chain ID 16602.
                </p>
              </div>
            </Lift>
          </div>
        </Section>
      </Reveal>

      <footer className="border-t border-ink/10 py-12">
        <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <a href="/" className="inline-flex no-underline">
              <Logo className="h-10 w-auto" />
            </a>
            <p className="mt-4 max-w-xs text-sm text-muted">Built for ETHGlobal Mumbai.</p>
          </div>
          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
            <a href="/queue" className="text-muted no-underline hover:text-ink hover:underline">
              Queue
            </a>
            <a href="https://github.com/shift-compute/shift" className="text-muted no-underline hover:text-ink hover:underline">
              Repository
            </a>
            <a href="/commons" className="text-muted no-underline hover:text-ink hover:underline">
              Commons
            </a>
            <a href="https://ethglobal.com/events/mumbai" className="text-muted no-underline hover:text-ink hover:underline">
              ETHGlobal Mumbai
            </a>
            <a href="/verify" className="text-muted no-underline hover:text-ink hover:underline">
              Verify
            </a>
            <a href="https://chainscan-galileo.0g.ai/address/0xA3B6664b487FC01c4264977c9B92058A89C31Ed7" className="text-muted no-underline hover:text-ink hover:underline">
              ShiftLedger on Galileo
            </a>
            <a href="/connect" className="text-muted no-underline hover:text-ink hover:underline">
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
    <section id={id} aria-labelledby={titleId} className="border-t border-ink/10 py-16 sm:py-20">
      <h2 id={titleId} className="max-w-3xl text-3xl font-medium tracking-[-0.03em] sm:text-4xl">
        {title}
      </h2>
      {children}
    </section>
  );
}
