import { AccountPanel } from "../components/home/AccountPanel";
import { Countdown } from "../components/home/Countdown";

export default function HomePage() {
  return (
    <div className="space-y-12">
      <section className="max-w-2xl">
        <h1 className="text-4xl font-semibold">Make every credit count before the cutoff.</h1>
        <p className="mt-4 text-lg text-haze">
          Shift turns the 0G compute credits that would expire at 00:00 UTC into useful work, with proof of where each result came from.
        </p>
      </section>
      <Countdown />
      <AccountPanel />
    </div>
  );
}
