import type { ReactNode } from "react";
import { Entrance, RevealLine } from "../landing/motion";

/**
 * Inner-page head in the home's voice: a pill eyebrow, a heavy display title
 * whose words rise in, and a lead that follows. Content below reveals on scroll.
 */
export function PageIntro({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <header className="pb-4 pt-2 sm:pt-6">
      <Entrance>
        <p className="inline-flex items-center gap-2 rounded-full bg-surface/80 px-3 py-1 text-sm text-muted shadow-sm ring-1 ring-skycard">
          <span className="status-dot" aria-hidden="true" />
          {eyebrow}
        </p>
      </Entrance>
      <h1 className="mt-5 max-w-4xl text-balance text-4xl font-semibold leading-[1.04] tracking-[-0.05em] sm:text-6xl">
        <RevealLine text={title} />
      </h1>
      {children ? (
        <Entrance delay={0.36}>
          <div className="mt-4 max-w-2xl text-lg text-muted">{children}</div>
        </Entrance>
      ) : null}
    </header>
  );
}
