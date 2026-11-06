import { Reveal } from "../../components/landing/motion";
import { InnerPage } from "../../components/ui/InnerPage";
import { PageIntro } from "../../components/ui/PageIntro";
import { ConnectWizard } from "../../components/connect/ConnectWizard";
import { consoleUrlFor } from "../../lib/console-url";
import { getConfig } from "../../lib/server";

// Reads the environment at request time, so it must not be prerendered at build time.
export const dynamic = "force-dynamic";

export const metadata = { title: "Connect your 0G account · Shift" };

export default function ConnectPage() {
  const consoleUrl = consoleUrlFor(getConfig().ZG_ROUTER_BASE_URL);
  return (
    <InnerPage>
      <PageIntro eyebrow="Four steps" title="Connect your 0G account.">
        0G has no sign-in for third-party apps, so you give Shift a management key with the smallest set of permissions that works.
      </PageIntro>
      <Reveal delay={0.45} className="pt-4">
        <ConnectWizard consoleUrl={consoleUrl} />
      </Reveal>
    </InnerPage>
  );
}
