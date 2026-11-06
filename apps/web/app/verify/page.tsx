import type { Metadata } from "next";
import { Verifier } from "../../components/verify/Verifier";

export const metadata: Metadata = {
  title: "Verify a result · Shift",
  description: "Check a Shift request id against the Merkle leaf and the ShiftLedger contract on 0G Chain.",
};

export default async function VerifyPage({ searchParams }: { searchParams: Promise<{ rid?: string | string[] }> }) {
  const query = await searchParams;
  const rid = Array.isArray(query.rid) ? (query.rid[0] ?? "") : (query.rid ?? "");

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Verify a result</h1>
      <p className="max-w-2xl text-haze">
        Paste a request id, or open a link that already has one. This page recomputes the leaf and asks ShiftLedger whether that leaf sits in the anchored batch.
      </p>
      <Verifier initialRequestId={rid} />
    </div>
  );
}
