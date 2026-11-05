import { ConnectWizard } from "../../components/connect/ConnectWizard";
import { consoleUrlFor } from "../../lib/console-url";
import { getConfig } from "../../lib/server";

// Reads the environment at request time, so it must not be prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Connect your 0G account · Shift" };

export default function ConnectPage() {
  const consoleUrl = consoleUrlFor(getConfig().ZG_ROUTER_BASE_URL);
  return (
    <>
      <h1 className="text-4xl font-semibold">Connect your 0G account</h1>
      <p className="mt-3 mb-10 max-w-2xl text-lg text-haze">
        0G has no sign-in for third-party apps, so you give Shift a management key with the smallest set of permissions that works.
      </p>
      <ConnectWizard consoleUrl={consoleUrl} />
    </>
  );
}
