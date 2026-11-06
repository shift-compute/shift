import { Reveal } from "../../components/landing/motion";
import { InnerPage } from "../../components/ui/InnerPage";
import { PageIntro } from "../../components/ui/PageIntro";
import { Queue } from "../../components/queue/Queue";

export const metadata = { title: "Queue · Shift" };

export default function QueuePage() {
  return (
    <InnerPage>
      <PageIntro eyebrow="Run now or at 23:00 UTC" title="Tonight's queue.">
        Tasks wait here until you run the shift from this page, or until the nightly window. The estimate uses live prices and does not run anything.
      </PageIntro>
      <Reveal delay={0.45}>
        <Queue />
      </Reveal>
    </InnerPage>
  );
}
