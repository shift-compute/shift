"use client";

import { useEffect, useState } from "react";
import { Logo } from "../brand/Logo";
import { MotionLink } from "../landing/motion";

const NAV = [
  { href: "/queue", label: "Queue" },
  { href: "/commons", label: "Commons" },
  { href: "/verify", label: "Verify" },
] as const;

/**
 * Sticky bar for every page. Scroll and a fine pointer deepen the blur and
 * the edge; links and the lockup pick up a soft hover. Wrap stays so the
 * row can break on a narrow screen.
 */
export function SiteHeader() {
  const [raised, setRaised] = useState(false);

  useEffect(() => {
    const onScroll = () => setRaised(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={raised ? "site-header is-raised" : "site-header"}>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-3.5">
        <a href="/" className="site-logo shrink-0 no-underline">
          <span className="lockup-enter shift-enter inline-flex">
            <Logo className="h-8 w-auto sm:h-9" />
          </span>
        </a>
        <div className="flex flex-wrap items-center justify-end gap-x-4 gap-y-2">
          <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
            {NAV.map((item) => (
              <a key={item.href} href={item.href} className="site-nav-link">
                {item.label}
              </a>
            ))}
          </nav>
          <a
            href="https://chainscan-galileo.0g.ai"
            target="_blank"
            rel="noreferrer"
            className="network-pill"
            title="0G Galileo testnet, chain 16602"
          >
            <img src="/brand/0g-logo.png" alt="0G" width={20} height={20} className="h-5 w-5 rounded-full" />
            Galileo testnet
          </a>
          <MotionLink href="/connect" className="cta cta-primary cta-sm">
            Connect 0G
          </MotionLink>
        </div>
      </div>
    </header>
  );
}
