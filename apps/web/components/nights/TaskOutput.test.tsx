/**
 * @vitest-environment happy-dom
 *
 * The result request is mocked and never reaches 0G Storage or the Router.
 */
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { TaskOutput } from "./TaskOutput";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

describe("TaskOutput", () => {
  let root: Root | undefined;
  let host: HTMLDivElement | undefined;

  afterEach(() => {
    act(() => root?.unmount());
    host?.remove();
    vi.unstubAllGlobals();
  });

  it("stops loading when the output request does not settle, and does not send another request", async () => {
    let calls = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: string, init?: RequestInit) => {
        calls += 1;
        return new Promise((_resolve, reject) => {
          init?.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
        });
      }),
    );
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
    await act(async () => {
      root?.render(<TaskOutput taskId="task-1" enabled timeoutMs={30} />);
    });
    expect(host.textContent).toContain("Loading your result");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50));
    });
    expect(host.textContent).toContain("did not finish");
    expect(host.textContent).not.toContain("Loading your result");
    expect(calls).toBe(1);
  });
});
