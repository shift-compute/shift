import type { Metadata } from "next";
import { Reveal } from "../../components/landing/motion";
import { InnerPage } from "../../components/ui/InnerPage";
import { PageIntro } from "../../components/ui/PageIntro";
import { CommonsBoard } from "../../components/commons/CommonsBoard";

export const metadata: Metadata = {
  title: "Commons · Shift",
  description: "Accepted and rejected translations of public Ethereum documentation, and the compute each account donated.",
};

export default function CommonsPage() {
  return (
    <InnerPage>
      <PageIntro eyebrow="Funded by leftovers" title="Commons.">
        Leftover compute translates public Ethereum documentation into Hindi and Marathi. A translation is kept when the decision model says both versions match the source. Rejected ones stay on this page so the filter is visible.
      </PageIntro>
      <Reveal delay={0.45}>
        <CommonsBoard />
      </Reveal>
    </InnerPage>
  );
}
