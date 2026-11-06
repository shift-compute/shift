import { notFound } from "next/navigation";
import { Reveal } from "../../../components/landing/motion";
import { InnerPage } from "../../../components/ui/InnerPage";
import { PageIntro } from "../../../components/ui/PageIntro";
import { NightResults } from "../../../components/nights/NightResults";
import { nightHeading } from "../../../lib/night-response";
import { parseNightId } from "../../../lib/night-id";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!parseNightId(id)) return { title: "Night · Shift" };
  return { title: `${nightHeading(id)} · Shift` };
}

export default async function NightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!parseNightId(id)) notFound();

  return (
    <InnerPage>
      <PageIntro eyebrow="Night results" title={nightHeading(id)}>
        Results from this shift, with the request ids and storage roots that tie each one to the anchored batch.
      </PageIntro>
      <Reveal delay={0.45}>
        <NightResults nightId={id} />
      </Reveal>
    </InnerPage>
  );
}
