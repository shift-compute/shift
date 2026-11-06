import { InnerPage } from "../../components/ui/InnerPage";
import { ConnectWizard } from "../../components/connect/ConnectWizard";
import type { SessionProp } from "../../components/connect/session-state";
import { consoleUrlFor } from "../../lib/console-url";
import { getConfig } from "../../lib/server";
import { getCurrentUser } from "../../lib/session";
import { userView } from "../../lib/user-view";

// Reads the session and the environment at request time, so it must not be prerendered.
export const dynamic = "force-dynamic";

export const metadata = { title: "Connect your 0G account · Shift" };

export default async function ConnectPage() {
  const consoleUrl = consoleUrlFor(getConfig().ZG_ROUTER_BASE_URL);
  const user = await getCurrentUser();
  const session: SessionProp = user ? userView(user) : { connected: false };
  const key = session.connected
    ? `${session.account?.address ?? ""}:${session.mode ?? ""}:${session.nightlyBudgetUsdMicro ?? ""}:${String(session.donateLeftover)}`
    : "signed-out";
  return (
    <InnerPage>
      <h1 className="text-4xl font-semibold">Connect your 0G account</h1>
      <p className="mt-3 mb-10 max-w-2xl text-lg text-haze">
        0G has no sign-in for third-party apps, so you give Shift a management key with the smallest set of permissions that works.
      </p>
      <ConnectWizard key={key} consoleUrl={consoleUrl} session={session} />
    </InnerPage>
  );
}
