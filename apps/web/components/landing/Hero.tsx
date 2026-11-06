"use client";

import { AccountPanel } from "../home/AccountPanel";
import { Countdown, ResetPhase } from "../home/Countdown";
import { HomeNightStrip } from "../home/HomeNightStrip";
import { DEFAULT_NIGHT_HARD_STOP_UTC, DEFAULT_NIGHT_START_UTC } from "../../lib/countdown";
import { ResetBar } from "./ResetBar";
import { Entrance, Lift, MotionLink, RevealLine } from "./motion";

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

const FACTS = [
  { value: DEFAULT_NIGHT_START_UTC, label: "Window opens, UTC" },
  { value: DEFAULT_NIGHT_HARD_STOP_UTC, label: "Hard stop, UTC" },
  { value: "16602", label: "Galileo chain" },
] as const;

const PRIMARY = "inline-flex items-center justify-center rounded-full bg-teal px-5 py-2.5 font-semibold text-paper no-underline shadow-sm shadow-teal/25 transition-colors duration-200 hover:bg-ink";
const QUIET = "inline-flex items-center justify-center rounded-full bg-surface/90 px-5 py-2.5 font-semibold text-ink no-underline shadow-sm ring-1 ring-ink/10 transition-colors duration-200 hover:bg-skycard/60";

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="pb-4 pt-4 sm:pt-8">
      <Entrance className="flex justify-center">
        <p className="inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-sm text-muted shadow-sm ring-1 ring-ink/10">
          <span className="status-dot" aria-hidden="true" />
          Credits reset at 00:00 UTC
        </p>
      </Entrance>

      <h1 id="hero-title" className="mx-auto mt-5 max-w-4xl text-balance text-center text-[2.35rem] font-medium leading-[1.02] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
        <RevealLine text="Unused 0G credits." className="font-normal text-ink/80" />
        <RevealLine text="Spent before they expire." />
      </h1>

      <Entrance delay={0.42}>
        <p className="mx-auto mt-5 max-w-2xl text-center text-lg text-muted">
          Every night at 00:00 UTC, unused 0G credits expire. Shift spends them on queued AI tasks with an optimizer powered by 0G decision models, donates leftovers to public-good translations, and anchors provenance on 0G Chain.
        </p>
      </Entrance>

      <Entrance delay={0.52} className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <MotionLink href="/connect" className={PRIMARY}>
          Connect 0G
        </MotionLink>
        <MotionLink href="/queue" className={QUIET}>
          Run tonight&apos;s shift
        </MotionLink>
      </Entrance>

      <Entrance delay={0.58} className="mx-auto mt-9 max-w-3xl text-center">
        <Countdown showPhase={false} />
      </Entrance>

      <Entrance delay={0.68}>
        <dl className="mx-auto mt-6 grid max-w-xl grid-cols-3 gap-4 text-center">
          {FACTS.map((fact) => (
            <div key={fact.label} className="flex flex-col-reverse">
              <dt className="mt-1 text-sm text-muted">{fact.label}</dt>
              <dd className="font-mono text-xl font-medium tabular-nums text-ink sm:text-2xl">{fact.value}</dd>
            </div>
          ))}
        </dl>
        <div className="mt-4">
          <ResetPhase />
        </div>
      </Entrance>

      <Entrance delay={0.78} className="mt-8 grid items-start gap-4 lg:grid-cols-2">
        <Lift className="h-full">
          <article id="how" aria-labelledby="how-title" className="h-full rounded-3xl bg-skycard/35 px-6 py-7 ring-1 ring-ink/10 sm:px-8">
            <h2 id="how-title" className="text-2xl font-medium tracking-[-0.03em]">
              How a night works
            </h2>
            <div className="mt-5">
              <ResetBar />
            </div>
            <ol className="mt-2 divide-y divide-ink/10">
              {STEPS.map((step) => (
                <li key={step.title} className="grid grid-cols-[3.25rem_1fr] gap-3 py-5">
                  <span className="font-mono text-sm text-teal tabular-nums" aria-hidden="true">
                    {step.n}
                  </span>
                  <div>
                    <h3 className="text-lg font-medium">{step.title}</h3>
                    <p className="mt-1 text-sm text-muted">{step.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </article>
        </Lift>

        <Lift className="h-full">
          <article id="tonight" aria-labelledby="tonight-title" className="h-full rounded-3xl bg-surface/95 px-6 py-7 shadow-[0_24px_60px_rgb(15_23_42/0.07)] ring-1 ring-ink/10 sm:px-8">
            <h2 id="tonight-title" className="text-2xl font-medium tracking-[-0.03em]">
              Tonight, from your account
            </h2>
            <p className="mt-3 text-sm text-muted">
              The night strip and the balance are read from your 0G account. Signed out, this panel asks you to connect and leaves the strip empty.
            </p>
            <div className="mt-6 space-y-8">
              <HomeNightStrip />
              <AccountPanel />
            </div>
          </article>
        </Lift>
      </Entrance>
    </section>
  );
}
