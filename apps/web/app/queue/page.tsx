import { Reveal } from "../../components/landing/motion";
import { InnerPage } from "../../components/ui/InnerPage";
import { PageIntro } from "../../components/ui/PageIntro";
import { Queue } from "../../components/queue/Queue";

export const metadata = { title: "Queue · Shift" };

export default function QueuePage() {
  return (
    <InnerPage>
      <PageIntro eyebrow="Runs at 23:00 UTC" title="Tonight's queue.">
        Tasks wait here until the nightly run. Tonight&apos;s estimate uses live prices and does not run anything.
      </PageIntro>
      <Reveal delay={0.45}>
        <Queue />
      </Reveal>
    </InnerPage>
  );
}
