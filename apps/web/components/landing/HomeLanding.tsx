import type { ReactNode } from "react";
import { Logo } from "../brand/Logo";
import { AmbientField } from "./AmbientField";
import { Hero } from "./Hero";
import { Lift, Reveal } from "./motion";
import { RunningOn0G, ZeroGMark } from "./RunningOn0G";

export function HomeLanding() {
  return (
    <div>
      <AmbientField />
      <Hero />

      <Section id="problem" title="Gone at midnight.">
        <Reveal delay={0.08}>
          <p className="mt-6 max-w-2xl text-lg text-muted">
            Queue by day. Shift spends credits that would expire at 00:00 UTC. iAI mode leaves the deposit alone. Budget mode stops at your nightly cap.
          </p>
        </Reveal>
      </Section>

      <Section id="why" title="Why 0G">
        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          <Reveal className="h-full" delay={0.08}>
            <Lift className="h-full">
              <div className="h-full rounded-3xl bg-surface/90 px-6 py-7 ring-1 ring-ink/10">
                <h3 className="text-2xl font-medium tracking-[-0.03em]">A daily cutoff</h3>
                <p className="mt-3 text-muted">
                  Compute credits reset at 00:00 UTC. Shift spends what would otherwise disappear, on work already queued.
                </p>
              </div>
            </Lift>
          </Reveal>
          <Reveal className="h-full" delay={0.18}>
            <Lift className="h-full">
              <div className="h-full rounded-3xl bg-surface/90 px-6 py-7 ring-1 ring-ink/10">
                <h3 className="text-2xl font-medium tracking-[-0.03em]">Proof on-chain</h3>
                <p className="mt-3 text-muted">
                  A finished night anchors a Merkle root in ShiftLedger on Galileo, chain 16602. Verify checks the leaf in your browser.
                </p>
              </div>
            </Lift>
          </Reveal>
        </div>
      </Section>

      <RunningOn0G />

      <Reveal>
        <footer className="border-t border-ink/10 py-12">
          <div className="flex flex-col gap-10 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <a href="/" className="site-logo inline-flex no-underline">
                <Logo className="h-10 w-auto" />
              </a>
              <p className="mt-4 max-w-xs text-sm text-muted">Built for ETHGlobal Mumbai.</p>
              <p className="mt-4 inline-flex items-center gap-2.5 rounded-full bg-surface/90 py-1 pl-1 pr-3.5 text-sm text-ink ring-1 ring-ink/10">
                <ZeroGMark className="h-6 w-6 rounded-full shadow-none" />
                Running on 0G
              </p>
            </div>
            <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-2 text-sm">
              <a href="/queue" className="quiet-link">
                Queue
              </a>
              <a href="https://github.com/shift-compute/shift" className="quiet-link">
                Repository
              </a>
              <a href="/commons" className="quiet-link">
                Commons
              </a>
              <a href="https://ethglobal.com/events/mumbai" className="quiet-link">
                ETHGlobal Mumbai
              </a>
              <a href="/verify" className="quiet-link">
                Verify
              </a>
              <a href="https://chainscan-galileo.0g.ai/address/0xA3B6664b487FC01c4264977c9B92058A89C31Ed7" className="quiet-link">
                ShiftLedger on Galileo
              </a>
              <a href="/connect" className="quiet-link">
                Connect
              </a>
            </nav>
          </div>
        </footer>
      </Reveal>
    </div>
  );
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  const titleId = `${id}-title`;
  return (
    <section id={id} aria-labelledby={titleId} className="border-t border-ink/10 py-16 sm:py-20">
      <Reveal>
        <h2 id={titleId} className="max-w-3xl text-3xl font-semibold tracking-[-0.04em] sm:text-5xl">
          {title}
        </h2>
      </Reveal>
      {children}
    </section>
  );
}
