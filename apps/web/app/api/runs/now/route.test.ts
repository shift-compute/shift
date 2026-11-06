import { beforeEach, describe, expect, it, vi } from "vitest";

const { getCurrentUser } = vi.hoisted(() => ({ getCurrentUser: vi.fn() }));

vi.mock("server-only", () => ({}));
vi.mock("../../../../lib/session", () => ({ getCurrentUser }));

import { POST } from "./route";

describe("POST /api/runs/now", () => {
  beforeEach(() => {
    getCurrentUser.mockReset();
  });

  it("returns 401 when the session cookie is missing", async () => {
    getCurrentUser.mockResolvedValue(null);
    const res = await POST();
    expect(res.status).toBe(401);
    expect(await res.json()).toEqual({ error: "not_signed_in" });
  });
});
