import { describe, expect, it } from "vitest";
import { describeRunNowFailure, eligibilityCopy, estimateCopy, openTaskCount, presentRunNowSuccess, runGate, RUN_NOW_TIMEOUT_MS } from "./run-now-state";

const preview = {
  qualityFloor: 1 as const,
  complexity: "at_run_time" as const,
  budgetMicro: "200000",
  spentEstimateMicro: "22300",
  remainingMicro: "177700",
  assignments: [],
  deferred: [],
};

describe("runGate", () => {
  it("starts only when queued or deferred work is loaded and no start is in flight", () => {
    expect(runGate({ pending: false, openCount: 3, queueFailed: false, previewPhase: "ready" })).toEqual({ action: "start" });
    expect(runGate({ pending: true, openCount: 3, queueFailed: false, previewPhase: "ready" })).toEqual({ action: "ignore" });
    expect(runGate({ pending: false, openCount: null, queueFailed: false, previewPhase: "loading" })).toEqual({ action: "wait" });
    expect(runGate({ pending: false, openCount: null, queueFailed: true, previewPhase: "unavailable" })).toEqual({ action: "wait" });
  });

  it("refuses an empty queue and a dead management key", () => {
    expect(runGate({ pending: false, openCount: 0, queueFailed: false, previewPhase: "empty" }).action).toBe("blocked");
    expect(runGate({ pending: false, openCount: 2, queueFailed: false, previewPhase: "reconnect" }).action).toBe("blocked");
  });

  it("counts queued and deferred tasks, not finished ones", () => {
    expect(openTaskCount(null)).toBeNull();
    expect(openTaskCount([{ status: "QUEUED" }, { status: "DEFERRED" }, { status: "DONE" }, { status: "FAILED" }])).toBe(2);
  });
});

describe("estimateCopy", () => {
  it("shows the cap, the estimate, and the remainder in USD", () => {
    expect(estimateCopy({ phase: "ready", preview })).toBe(
      "Tonight's cap is 0.2 USD. Estimated spend is 0.0223 USD. Left for the commons queue is 0.1777 USD.",
    );
    expect(estimateCopy({ phase: "loading" })).toBeNull();
  });

  it("tells the person how many tasks can run", () => {
    expect(eligibilityCopy(3, false)).toContain("3 tasks are waiting");
    expect(eligibilityCopy(0, false)).toContain("Nothing is queued");
    expect(eligibilityCopy(null, true)).toContain("stays off");
  });
});

describe("describeRunNowFailure", () => {
  it("covers 401, 409, 429, 503, timeout, and a lost response without a retry", () => {
    const cases = [
      describeRunNowFailure({ status: 401, body: { error: "not_signed_in" } }),
      describeRunNowFailure({ status: 409, body: { error: "not_connected", message: "Connect again." } }),
      describeRunNowFailure({ status: 409, body: { error: "no_queued_work", message: "Add a task." } }),
      describeRunNowFailure({ status: 429, body: { error: "rate_limited", retryAfterSeconds: 125, message: "Wait." }, retryAfterHeader: "125" }),
      describeRunNowFailure({ status: 503, body: { error: "storage_unconfigured", message: "No signer." } }),
      describeRunNowFailure({ status: 500, body: { error: "internal_error" } }),
      describeRunNowFailure({ status: "timeout", body: null }),
      describeRunNowFailure({ status: "network", body: null }),
    ];
    expect(cases.map((item) => item.kind)).toEqual(["signed_out", "reconnect", "no_work", "rate_limited", "storage", "failed", "timeout", "lost"]);
    expect(cases.every((item) => item.retry === false)).toBe(true);
    expect(cases.find((item) => item.kind === "rate_limited")?.retryAfterSeconds).toBe(125);
    expect(cases.find((item) => item.kind === "rate_limited")?.detail).toContain("125");
    expect(cases.find((item) => item.kind === "timeout")?.detail).toContain("will not send another run");
    expect(RUN_NOW_TIMEOUT_MS).toBe(300_000);
  });

  it("hides a message that contains a key", () => {
    const failure = describeRunNowFailure({ status: 500, body: { error: "internal_error", message: "saw mk-0123456789abcdef" } });
    expect(failure.detail).not.toContain("mk-");
    expect(failure.retry).toBe(false);
  });
});

describe("presentRunNowSuccess", () => {
  const nightId = "1793959200";

  it("links the night and each finished request, and names a partial failure", () => {
    const view = presentRunNowSuccess({
      nightId,
      status: "DONE",
      runId: "run-1",
      error: null,
      tasks: [
        { id: "doc", type: "DOC_ANALYSIS", status: "DONE", error: null, chosenModel: "glm", outputRoot: "0xabc", requestIds: ["req-doc-1234", "mk-0123456789abcdef"] },
        { id: "audio", type: "AUDIO_SUMMARY", status: "FAILED", error: "insufficient_balance", chosenModel: null, outputRoot: null, requestIds: ["req-audio-9"] },
        { id: "image", type: "IMAGE_FROM_PROMPT", status: "DEFERRED", error: null, chosenModel: null, outputRoot: null },
      ],
    });
    expect(view?.headline).toBe("Some tasks failed");
    expect(view?.partial).toBe(true);
    expect(view?.retry).toBe(false);
    expect(view?.nightHref).toBe(`/nights/${nightId}`);
    expect(view?.tasks[0]?.verify).toEqual([{ requestId: "req-doc-1234", href: "/verify?rid=req-doc-1234" }]);
    expect(view?.tasks[1]?.verify).toEqual([]);
    expect(view?.tasks[1]?.error).toBe("insufficient_balance");
    expect(view?.tasks[2]?.statusLabel).toBe("Moved to the next night");
    expect(JSON.stringify(view)).not.toContain("mk-");
  });

  it("does not call a skipped or fully failed shift a success", () => {
    expect(presentRunNowSuccess({ nightId, status: "SKIPPED", runId: "run-1", error: "No queued tasks.", tasks: [] })?.headline).toBe("This shift did not run");
    expect(
      presentRunNowSuccess({
        nightId,
        status: "FAILED",
        runId: "run-1",
        error: "The hard stop was already reached.",
        tasks: [{ id: "doc", type: "DOC_ANALYSIS", status: "FAILED", error: "insufficient_balance", chosenModel: null, outputRoot: null, requestIds: [] }],
      })?.headline,
    ).toBe("This shift failed");
  });

  it("rejects a body that is not a night summary", () => {
    expect(presentRunNowSuccess({ status: "DONE" })).toBeNull();
    expect(presentRunNowSuccess(null)).toBeNull();
  });
});
