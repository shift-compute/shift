import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/familjen-grotesk";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import { Logo } from "../components/brand/Logo";
import "../styles/globals.css";

const NAV = [
  { href: "/queue", label: "Queue" },
  { href: "/commons", label: "Commons" },
  { href: "/verify", label: "Verify" },
] as const;

export const metadata: Metadata = {
  title: "Shift",
  description: "AI compute that was going to be wasted, turned into public goods with verifiable provenance.",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/brand/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/brand/favicon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/brand/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-ink/10 bg-paper">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
            <a href="/" className="inline-flex shrink-0 no-underline">
              <Logo className="h-8 w-auto sm:h-9" />
            </a>
            <div className="flex flex-wrap items-center justify-end gap-x-5 gap-y-2">
              <nav aria-label="Primary" className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
                {NAV.map((item) => (
                  <a key={item.href} href={item.href} className="text-muted no-underline hover:text-ink">
                    {item.label}
                  </a>
                ))}
              </nav>
              <span className="text-sm text-muted">0G Galileo testnet</span>
              <a href="/connect" className="inline-flex items-center rounded-full bg-teal px-4 py-1.5 text-sm font-semibold text-paper no-underline shadow-sm shadow-teal/20 transition-colors duration-200 hover:bg-ink">
                Connect 0G
              </a>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="border-t border-ink/10">
          <div className="mx-auto max-w-6xl px-6 py-4 text-sm text-muted">
            <a href="https://app.ens.domains/tryshift.eth" target="_blank" rel="noreferrer">
              tryshift.eth
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
