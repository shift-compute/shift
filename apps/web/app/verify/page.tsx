import type { Metadata } from "next";
import { Reveal } from "../../components/landing/motion";
import { InnerPage } from "../../components/ui/InnerPage";
import { PageIntro } from "../../components/ui/PageIntro";
import { EnsIdentity } from "../../components/identity/EnsIdentity";
import { Verifier } from "../../components/verify/Verifier";

export const metadata: Metadata = {
  title: "Verify a result · Shift",
  description: "Check a Shift request id against the Merkle leaf and the ShiftLedger contract on 0G Chain.",
};

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ rid?: string | string[] }> }) {
  const query = await searchParams;
  const rid = Array.isArray(query.rid) ? (query.rid[0] ?? "") : (query.rid ?? "");

  return (
    <InnerPage>
      <PageIntro eyebrow="ShiftLedger on 0G Chain" title="Verify a result.">
        Paste a request id, or open a link that already has one. This page recomputes the leaf and asks ShiftLedger whether that leaf sits in the anchored batch.
      </PageIntro>
      <Reveal delay={0.45}>
        <Verifier initialRequestId={rid} />
      </Reveal>
      <Reveal>
        <EnsIdentity />
      </Reveal>
    </InnerPage>
  );
}
