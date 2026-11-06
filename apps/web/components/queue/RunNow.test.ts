import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RunNowPanel } from "./RunNow";
import type { PresentedRun, RunNowFailure } from "./run-now-state";

function panel(props: {
  eligibility: string;
  estimate: string | null;
  pending: boolean;
  canStart: boolean;
  notice: { kind: "idle" } | { kind: "pending" } | { kind: "failure"; failure: RunNowFailure } | { kind: "result"; result: PresentedRun };
}): string {
  return renderToStaticMarkup(createElement(RunNowPanel, { ...props, onRun: () => undefined }));
}

const failure = (over: Partial<RunNowFailure> & Pick<RunNowFailure, "kind" | "title" | "detail">): RunNowFailure => ({ retry: false, ambiguous: false, ...over });

describe("RunNowPanel", () => {
  it("shows a disabled run action when nothing is queued", () => {
    const html = panel({
      eligibility: "Nothing is queued or deferred. Add a task before running. This does not spend credits.",
      estimate: null,
      pending: false,
      canStart: false,
      notice: { kind: "idle" },
    });
    expect(html).toContain("Run tonight");
    expect(html).toContain("shift now");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("Nothing is queued");
  });

  it("shows the cap and an enabled action when work is waiting", () => {
    const html = panel({
      eligibility: "3 tasks are waiting.",
      estimate: "Tonight's cap is 0.2 USD. Estimated spend is 0.0223 USD. Left for the commons queue is 0.1777 USD.",
      pending: false,
      canStart: true,
      notice: { kind: "idle" },
    });
    expect(html).toContain("3 tasks are waiting");
    expect(html).toContain("0.2 USD");
    expect(html).toContain("0.0223 USD");
    expect(html).toContain("0.1777 USD");
    expect(html).not.toContain("disabled=\"\"");
  });

  it("locks the button while a start is pending and does not offer a second run", () => {
    const html = panel({
      eligibility: "3 tasks are waiting.",
      estimate: null,
      pending: true,
      canStart: false,
      notice: { kind: "pending" },
    });
    expect(html).toContain("Running tonight");
    expect(html).toContain("will not start a second run");
    expect(html).toContain("disabled=\"\"");
    expect(html).toContain("aria-busy=\"true\"");
  });

  it("shows an unknown outcome without promising that the run did not spend", () => {
    const html = panel({
      eligibility: "The last response was not a clear result. Credits may already have been spent.",
      estimate: null,
      pending: false,
      canStart: false,
      notice: {
        kind: "failure",
        failure: failure({
          kind: "unknown",
          title: "This page does not know if the shift started",
          detail: "Credits may already have been spent, up to the cap saved on the account for this run. This page will not send another run.",
          ambiguous: true,
        }),
      },
    });
    expect(html).toContain("does not know if the shift started");
    expect(html).toContain("may already have been spent");
    expect(html).toContain("will not send another run");
    expect(html).toContain("disabled=\"\"");
    expect(html.toLowerCase()).not.toContain("did not start");
  });

  it("renders rate-limit, storage, and timeout errors", () => {
    for (const item of [
      failure({ kind: "rate_limited", title: "Run now is limited to once every 10 minutes", detail: "Wait 125 seconds.", retryAfterSeconds: 125 }),
      failure({ kind: "storage", title: "Run now cannot upload outputs", detail: "The storage signer is not configured." }),
      failure({ kind: "timeout", title: "The request timed out", detail: "This page will not send another run." }),
      failure({ kind: "signed_out", title: "Connect your 0G account", detail: "Run now only starts for the signed-in account." }),
    ]) {
      const html = panel({
        eligibility: "3 tasks are waiting.",
        estimate: null,
        pending: false,
        canStart: true,
        notice: { kind: "failure", failure: item },
      });
      expect(html).toContain(item.title);
      expect(html).toContain("role=\"alert\"");
    }
  });

  it("links the night and a finished result, and keeps a failed task visible", () => {
    const html = panel({
      eligibility: "3 tasks are waiting.",
      estimate: null,
      pending: false,
      canStart: false,
      notice: {
        kind: "result",
        result: {
          headline: "Some tasks failed",
          detail: "Some tasks finished and some failed.",
          nightId: "1793959200",
          nightHref: "/nights/1793959200",
          partial: true,
          retry: false,
          tasks: [
            { id: "doc", label: "Analyze a document", status: "DONE", statusLabel: "Done", error: null, verify: [{ requestId: "req-doc-1234", href: "/verify?rid=req-doc-1234" }] },
            { id: "audio", label: "Summarize audio", status: "FAILED", statusLabel: "Failed", error: "insufficient_balance", verify: [] },
          ],
        },
      },
    });
    expect(html).toContain("Some tasks failed");
    expect(html).toContain('href="/nights/1793959200"');
    expect(html).toContain('href="/verify?rid=req-doc-1234"');
    expect(html).toContain("insufficient_balance");
    expect(html).not.toContain("mk-");
  });
});
