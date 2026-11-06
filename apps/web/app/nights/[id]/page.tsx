import { notFound } from "next/navigation";
import { InnerPage } from "../../../components/ui/InnerPage";
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
      <h1 className="text-3xl font-semibold">{nightHeading(id)}</h1>
      <p className="max-w-2xl text-haze">Results from this shift, with the request ids and storage roots that tie each one to the anchored batch.</p>
      <NightResults nightId={id} />
    </InnerPage>
  );
}
