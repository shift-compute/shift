import { describe, expect, it } from "vitest";
import { createRateLimiter } from "./rate-limit";

describe("createRateLimiter", () => {
  it("allows up to the limit and then blocks with a retry hint", () => {
    let t = 1_000_000;
    const limiter = createRateLimiter(3, 60_000, () => t);
    expect(limiter.check("ip").allowed).toBe(true);
    t += 1000;
    expect(limiter.check("ip").allowed).toBe(true);
    t += 1000;
    expect(limiter.check("ip").allowed).toBe(true);
    t += 1000;
    const blocked = limiter.check("ip");
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBe(57);
  });

  it("allows again once the oldest hit leaves the window", () => {
    let t = 0;
    const limiter = createRateLimiter(2, 10_000, () => t);
    limiter.check("a");
    limiter.check("a");
    expect(limiter.check("a").allowed).toBe(false);
    t = 10_001;
    expect(limiter.check("a").allowed).toBe(true);
  });

  it("counts each key separately and does not count blocked attempts", () => {
    let t = 0;
    const limiter = createRateLimiter(1, 10_000, () => t);
    expect(limiter.check("a").allowed).toBe(true);
    expect(limiter.check("b").allowed).toBe(true);
    for (let i = 0; i < 5; i++) limiter.check("a");
    t = 10_001;
    expect(limiter.check("a").allowed).toBe(true);
  });
});
