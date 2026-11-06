import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@fontsource/geist-sans/latin-400.css";
import "@fontsource/geist-sans/latin-500.css";
import "@fontsource/geist-sans/latin-600.css";
import "@fontsource/geist-mono/latin-400.css";
import "@fontsource/geist-mono/latin-500.css";
import { SiteHeader } from "../components/site/SiteHeader";
import "../styles/globals.css";

export const metadata: Metadata = {
  title: "Shift",
  description: "Spend 0G credits before they expire at 00:00 UTC. Provenance on 0G Chain.",
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
        <SiteHeader />
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
        <footer className="border-t border-ink/10">
          <div className="mx-auto max-w-6xl px-6 py-4 text-sm text-muted">
            <a className="quiet-link" href="https://app.ens.domains/tryshift.eth" target="_blank" rel="noreferrer">
              tryshift.eth
            </a>
          </div>
        </footer>
      </body>
    </html>
  );
}
