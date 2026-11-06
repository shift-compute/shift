import type { Metadata } from "next";
import { CommonsBoard } from "../../components/commons/CommonsBoard";

export const metadata: Metadata = {
  title: "Commons · Shift",
  description: "Accepted and rejected translations of public Ethereum documentation, and the compute each account donated.",
};

export default function CommonsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Commons</h1>
      <p className="max-w-2xl text-haze">
        Leftover compute translates public Ethereum documentation into Hindi and Marathi. A translation is kept when the decision model says both versions match the source. Rejected ones stay on this page so the filter is visible.
      </p>
      <CommonsBoard />
    </div>
  );
}
