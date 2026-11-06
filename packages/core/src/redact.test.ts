import { describe, expect, it } from "vitest";
import { redact, redactString } from "./redact";

const MK = "mk-0123456789abcdefghijklmnopqrstuv";
const SK = "sk-abcdefghijklmnopqrstuvwxyz012345";

/** A token still looks like a key when a letter or digit follows the hyphen. `mk-[REDACTED]` does not. */
const LIVE_SECRET = /(mk|sk)-[A-Za-z0-9]/;

describe("redactString", () => {
  it("replaces every mk- and sk- token, including several in one error message", () => {
    const message = new Error(`Router rejected ${SK} after retry with ${MK}`).message;
    const safe = redactString(`tick error: ${message}`);
    expect(safe).toBe("tick error: Router rejected sk-[REDACTED] after retry with mk-[REDACTED]");
    expect(safe).not.toMatch(LIVE_SECRET);
    expect(safe).not.toContain(MK);
    expect(safe).not.toContain(SK);
  });

  it("leaves ordinary text and request ids alone", () => {
    const text = "model whisper-large-v3 request 3976195e-1879-4a65-bfb7-82e6ddd910ab";
    expect(redactString(text)).toBe(text);
  });
});

describe("redact", () => {
  it("strips mk- and sk- tokens from nested fields, arrays and error messages", () => {
    const logged = {
      msg: `sweep error: ${new Error(`invalid key ${MK}`).message}`,
      status: 401,
      requestId: "3976195e-1879-4a65-bfb7-82e6ddd910ab",
      note: null,
      headers: { Authorization: `Bearer ${SK}` },
      error: {
        message: `bad key ${SK} and also ${MK}`,
        metadata: { raw: `upstream echoed ${MK}` },
        attempts: [`retry ${SK}`, { note: `still ${MK}` }],
      },
    };

    const safe = redact(logged);
    const text = JSON.stringify(safe);

    expect(text).not.toMatch(LIVE_SECRET);
    expect(text).not.toContain(MK);
    expect(text).not.toContain(SK);
    expect(safe.headers.Authorization).toBe("[REDACTED]");
    expect(safe.error.message).toBe("bad key sk-[REDACTED] and also mk-[REDACTED]");
    expect(safe.error.metadata.raw).toBe("upstream echoed mk-[REDACTED]");
    expect(safe.error.attempts).toEqual(["retry sk-[REDACTED]", { note: "still mk-[REDACTED]" }]);
    expect(safe.requestId).toBe(logged.requestId);
    expect(safe.status).toBe(401);
    expect(safe.note).toBeNull();
    // The input is what a logger still holds; redaction must return a copy.
    expect(logged.headers.Authorization).toContain(SK);
    expect(logged.error.message).toContain(SK);
  });

  it("redacts authorization and secret fields even when the value is nested", () => {
    const safe = redact({
      authorization: { scheme: "Bearer", token: SK },
      api_key: MK,
      nested: { "X-Authorization": `Bearer ${MK}` },
    });
    expect(JSON.stringify(safe)).not.toMatch(LIVE_SECRET);
    expect(safe.authorization).toEqual({ scheme: "Bearer", token: "sk-[REDACTED]" });
    expect(safe.api_key).toBe("[REDACTED]");
    expect(safe.nested["X-Authorization"]).toBe("[REDACTED]");
  });
});
