import { describe, expect, it } from "vitest";
import { anchorHref, calendarNight, formatUtc, nightHeading, readNight, teeVerdict, trustLabel, verifyHref } from "./night-response";

function jsonRes(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

const night = {
  id: "20261106",
  status: "DONE",
  merkleRoot: "0x" + "ab".repeat(32),
  manifestRoot: null,
  anchorTx: "0x" + "cd".repeat(32),
  explorerUrl: "https://chainscan-galileo.0g.ai",
  itemCount: 1,
  startedAt: "2026-11-06T23:00:00.000Z",
  finishedAt: "2026-11-06T23:40:00.000Z",
};

const task = {
  id: "t1",
  type: "DOC_ANALYSIS",
  status: "DONE",
  prompt: null,
  chosenModel: "glm-5.3",
  outputRoot: "0x" + "11".repeat(32),
  actualCostUsdMicro: "40",
  error: null,
  steps: [
    {
      step: "analyze",
      model: "glm-5.3",
      trust: "private",
      requestId: "req-1",
      teeVerified: null,
      costUsdMicro: "40",
    },
  ],
};

describe("readNight", () => {
  it("maps a missing response, an invalid id, a missing night and a recorded night", async () => {
    await expect(readNight(null)).resolves.toEqual({ phase: "unavailable" });
    await expect(readNight(jsonRes(404, { error: "invalid_night" }))).resolves.toEqual({ phase: "invalid" });
    await expect(readNight(jsonRes(500, { error: "internal_error" }))).resolves.toEqual({ phase: "unavailable" });
    await expect(readNight(jsonRes(200, { night: null, signedIn: false }))).resolves.toEqual({ phase: "empty" });
    await expect(readNight(jsonRes(200, { night, signedIn: true, results: { tasks: [task], spending: null } }))).resolves.toMatchObject({
      phase: "ready",
      signedIn: true,
    });
  });

  it("refuses personal results on a public response, and a signed-in night with none", async () => {
    const leaked = await readNight(jsonRes(200, { night, signedIn: false, results: { tasks: [task], spending: null } }));
    expect(leaked.phase).toBe("unavailable");
    const bare = await readNight(jsonRes(200, { night, signedIn: true }));
    expect(bare.phase).toBe("unavailable");
  });
});

describe("provenance copy", () => {
  it("treats a missing TEE verdict as different from a failed one", () => {
    expect(teeVerdict(null)).toBe("No TEE verdict. That is not a failure.");
    expect(teeVerdict(false)).toBe("TEE attestation failed");
    expect(teeVerdict(true)).toBe("TEE attestation verified");
  });

  it("names trust tiers and points each request id at the verifier", () => {
    expect(trustLabel("private")).toBe("Private (TeeML)");
    expect(trustLabel("verified")).toBe("Verified (TeeTLS)");
    expect(trustLabel("standard")).toBe("Standard");
    expect(trustLabel(null)).toBe("Trust level not recorded");
    expect(verifyHref("req 1")).toBe("/verify?rid=req%201");
  });

  it("links an anchor transaction on the explorer and ignores a value that is not a hash", () => {
    const tx = "0x" + "ab".repeat(32);
    expect(anchorHref("https://chainscan-galileo.0g.ai/", tx)).toBe(`https://chainscan-galileo.0g.ai/tx/${tx}`);
    expect(anchorHref("https://chainscan-galileo.0g.ai", "not-a-tx")).toBeNull();
  });

  it("heads a calendar night with its UTC date and leaves a manual id numeric", () => {
    expect(calendarNight("20261106")).toBe("6 November 2026");
    expect(calendarNight("20261340")).toBeNull();
    expect(nightHeading("20261106")).toBe("Night of 6 November 2026");
    expect(nightHeading("1762394400")).toBe("Night 1762394400");
    expect(formatUtc("2026-11-06T23:05:00.000Z")).toBe("2026-11-06 23:05 UTC");
  });
});
