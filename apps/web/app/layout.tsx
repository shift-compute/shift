import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource-variable/familjen-grotesk";
import "@fontsource/atkinson-hyperlegible/400.css";
import "@fontsource/atkinson-hyperlegible/700.css";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Shift",
  description: "Shift turns the 0G compute credits that would expire at 00:00 UTC into useful, verifiable work.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen">
        <header className="border-b border-night">
          <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-6 gap-y-3 px-6 py-4">
            <a href="/" className="font-display text-xl font-semibold text-paper no-underline">
              Shift
            </a>
            <nav className="flex flex-wrap items-center gap-x-5 gap-y-1 text-sm">
              <a href="/queue">Queue</a>
              <a href="/commons">Commons</a>
              <a href="/verify">Verify</a>
              <a href="/connect">Connect</a>
              <span className="text-haze">0G Galileo testnet</span>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-5xl px-6 py-10">{children}</main>
      </body>
    </html>
  );
}
