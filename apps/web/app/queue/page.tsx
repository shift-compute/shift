import { InnerPage } from "../../components/ui/InnerPage";
import { Queue } from "../../components/queue/Queue";

export const metadata = { title: "Queue · Shift" };

export default function QueuePage() {
  return (
    <InnerPage>
      <h1 className="text-3xl font-semibold">Tonight's queue</h1>
      <p className="max-w-2xl text-haze">Tasks wait here until you run the shift from this page, or until the nightly window. The estimate uses live prices and does not run anything.</p>
      <Queue />
    </InnerPage>
  );
}
