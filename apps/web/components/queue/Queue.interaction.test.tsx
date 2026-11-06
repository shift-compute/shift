/**
 * @vitest-environment happy-dom
 *
 * Reloads the real queue. Fetch is mocked. No Router and no production call.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Queue } from "./Queue";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const alice = {
  id: "alice-task",
  type: "DOC_ANALYSIS",
  status: "FAILED",
  priority: 2,
  prompt: null,
  inputBytes: 89,
  createdAt: "2026-11-06T22:49:35.000Z",
  nightId: "1794004512",
  error: "alice stored failure",
  requestIds: ["req-alice-doc-1"],
  actualCostUsdMicro: "1000",
};

const bob = {
  id: "bob-task",
  type: "IMAGE_FROM_PROMPT",
  status: "FAILED",
  priority: 2,
  prompt: "bob prompt",
  inputBytes: null,
  createdAt: "2026-11-06T22:50:00.000Z",
  nightId: "111",
  error: "bob-only-failure",
  requestIds: ["req-bob-only-9999"],
  actualCostUsdMicro: "5",
};

function tasksResponse(tasks: unknown[]): Response {
  return new Response(JSON.stringify({ tasks }), { status: 200, headers: { "content-type": "application/json" } });
}

function previewResponse(): Response {
  return new Response(JSON.stringify({ error: "empty_queue", message: "Nothing is waiting for tonight." }), { status: 409, headers: { "content-type": "application/json" } });
}

describe("queue receipts across a remount", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;
  const calls: Array<{ url: string; method: string }> = [];
  let tasks: unknown[] = [alice];

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    root = undefined;
    host = undefined;
    calls.length = 0;
    tasks = [alice];
    vi.unstubAllGlobals();
  });

  async function mount() {
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<Queue />);
    });
    await act(async () => {
      await Promise.resolve();
    });
  }

  function installFetch() {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? "GET";
        calls.push({ url: String(url), method });
        if (method !== "GET") return new Response("no", { status: 500 });
        if (String(url) === "/api/tasks") return tasksResponse(tasks);
        if (String(url) === "/api/plan/preview") return previewResponse();
        return new Response("missing", { status: 404 });
      }),
    );
  }

  it("shows the stored night, error, cost and verify link after unmounting and mounting again", async () => {
    installFetch();
    await mount();
    expect(host?.textContent).toContain("alice stored failure");
    expect(host?.textContent).toContain("View night 1794004512");
    expect(host?.querySelector('a[href="/nights/1794004512"]')).toBeTruthy();
    expect(host?.querySelector('a[href="/verify?rid=req-alice-doc-1"]')).toBeTruthy();
    expect(host?.textContent).toContain("0.001 USD");
    expect(host?.textContent).not.toContain("bob-only-failure");
    expect(host?.textContent).not.toContain("req-bob-only-9999");

    act(() => root?.unmount());
    host?.remove();
    tasks = [bob];
    await mount();

    expect(host?.textContent).toContain("bob-only-failure");
    expect(host?.textContent).toContain("View night 111");
    expect(host?.textContent).not.toContain("alice stored failure");
    expect(host?.textContent).not.toContain("req-alice-doc-1");
    expect(host?.textContent).not.toContain("1794004512");
    expect(calls.every((call) => call.method === "GET")).toBe(true);
    expect(calls.some((call) => call.url === "/api/runs/now")).toBe(false);
  });
});
