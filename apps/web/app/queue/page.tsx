import { Queue } from "../../components/queue/Queue";

export const metadata = { title: "Queue · Shift" };

export default function QueuePage() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Tonight's queue</h1>
      <p className="max-w-2xl text-haze">Tasks wait here until the nightly run. Tonight's estimate uses live prices and does not run anything.</p>
      <Queue />
    </div>
  );
}
