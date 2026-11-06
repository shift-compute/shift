/**
 * @vitest-environment happy-dom
 *
 * Drives the real Run now button. Fetch is mocked. No Router and no production call.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { RunNow } from "./RunNow";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const preview = {
  phase: "ready" as const,
  preview: {
    qualityFloor: 1 as const,
    complexity: "at_run_time" as const,
    budgetMicro: "200000",
    spentEstimateMicro: "22300",
    remainingMicro: "177700",
    assignments: [],
    deferred: [],
  },
};

const tasks = [{ status: "QUEUED" }, { status: "QUEUED" }, { status: "DEFERRED" }];

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("Run now button", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;
  const calls: Array<{ url: string; method: string }> = [];

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    calls.length = 0;
    vi.unstubAllGlobals();
  });

  async function render(onFinished: () => void) {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<RunNow tasks={tasks} queueFailed={false} preview={preview} onFinished={onFinished} />);
    });
  }

  function runButton(): HTMLButtonElement {
    const button = [...(host?.querySelectorAll("button") ?? [])].find((item) => item.textContent?.includes("Run tonight"));
    if (!(button instanceof HTMLButtonElement)) throw new Error("Run now button was not rendered");
    return button;
  }

  async function clickRun() {
    await act(async () => {
      runButton().click();
    });
  }

  function installFetch(status: number) {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), method: init?.method ?? "GET" });
        return json(status, { error: "proxy" });
      }),
    );
  }

  it.each([499, 408])("holds after a received HTTP %s, reloads once, and does not POST again", async (status) => {
    installFetch(status);
    const finished = vi.fn();
    await render(finished);
    expect(runButton().disabled).toBe(false);

    await clickRun();

    expect(calls).toEqual([{ url: "/api/runs/now", method: "POST" }]);
    expect(finished).toHaveBeenCalledTimes(1);
    expect(host?.textContent).toContain("does not know if the shift started");
    expect(host?.textContent).toContain("may already have been spent");
    expect(host?.textContent).toContain("will not send another run");
    expect(runButton().disabled).toBe(true);

    await clickRun();
    expect(calls).toEqual([{ url: "/api/runs/now", method: "POST" }]);
    expect(finished).toHaveBeenCalledTimes(1);
    expect(calls.some((call) => call.method === "GET")).toBe(false);
  });

  it("does not hold a known pre-run 409, and does not reload", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url: String(url), method: init?.method ?? "GET" });
        return json(409, { error: "no_queued_work", message: "Add a task." });
      }),
    );
    const finished = vi.fn();
    await render(finished);
    await clickRun();
    expect(calls).toEqual([{ url: "/api/runs/now", method: "POST" }]);
    expect(finished).not.toHaveBeenCalled();
    expect(host?.textContent).toContain("Nothing is waiting");
    expect(host?.textContent).toContain("Add a task.");
    expect(host?.textContent).not.toContain("may already have been spent");
    expect(runButton().disabled).toBe(false);
  });
});
