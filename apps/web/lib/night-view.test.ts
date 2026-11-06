import { describe, expect, it } from "vitest";
import { nightResponseSchema } from "./night-response";
import { NIGHT_RUN_SPEND_SELECT, NIGHT_TASK_SELECT, nightResultsBody, type NightResultsInput, type NightRow, type NightTaskRow } from "./night-view";

const MK = "mk-supersecretkey";
const SK = "sk-inferencekeyvalue";

const night: NightRow = {
  id: 20261106n,
  status: "DONE",
  merkleRoot: "0x" + "ab".repeat(32),
  manifestRoot: "0x" + "cd".repeat(32),
  anchorTx: "0x" + "ef".repeat(32),
  itemCount: 2,
  startedAt: new Date("2026-11-06T23:00:00.000Z"),
  finishedAt: new Date("2026-11-06T23:40:00.000Z"),
};

function task(over: Partial<NightTaskRow> = {}): NightTaskRow {
  return {
    id: "task-1",
    type: "AUDIO_SUMMARY",
    status: "DONE",
    prompt: null,
    chosenModel: "glm-5.3",
    outputRoot: "0x" + "11".repeat(32),
    actualCostUsdMicro: 40n,
    error: null,
    steps: [
      {
        step: "transcribe",
        model: "whisper-large-v3",
        trust: "private",
        requestId: "req-stt",
        trace: { tee_verified: true, provider_identity: SK },
        costUsdMicro: "30",
        apiKey: MK,
      },
      { step: "summarize", model: "glm-5.3", trust: "private", requestId: "req-sum", costUsdMicro: "10" },
      { step: "classify", model: "laya", trust: "private", requestId: "req-cls", trace: { tee_verified: "yes" } },
      { step: "image", model: "z-image-turbo", trust: "verified", requestId: SK, trace: { tee_verified: false } },
      { step: "keep", model: "mask-large", trust: "standard", requestId: "task-1", costUsdMicro: "1" },
      { step: "drop-me" },
    ],
    ...over,
  };
}

function input(over: Partial<NightResultsInput> = {}): NightResultsInput {
  return {
    night,
    signedIn: true,
    explorerUrl: "https://chainscan-galileo.0g.ai/",
    currency: "0g",
    run: { spentUsdMicro: 40n, creditUsed: "1000000000000000000", depositUsed: "0" },
    tasks: [task()],
    ...over,
  };
}

describe("nightResultsBody", () => {
  it("keeps request ids, trust and the TEE tri-state, and drops the raw trace", () => {
    const body = nightResultsBody(input());
    expect(nightResponseSchema.safeParse(body).success).toBe(true);
    expect(body.night).toMatchObject({
      id: "20261106",
      merkleRoot: night.merkleRoot,
      manifestRoot: night.manifestRoot,
      anchorTx: night.anchorTx,
      explorerUrl: "https://chainscan-galileo.0g.ai",
    });
    expect(body.results?.tasks[0]?.steps).toEqual([
      {
        step: "transcribe",
        model: "whisper-large-v3",
        trust: "private",
        requestId: "req-stt",
        teeVerified: true,
        costUsdMicro: "30",
      },
      {
        step: "summarize",
        model: "glm-5.3",
        trust: "private",
        requestId: "req-sum",
        teeVerified: null,
        costUsdMicro: "10",
      },
      {
        step: "classify",
        model: "laya",
        trust: "private",
        requestId: "req-cls",
        teeVerified: null,
        costUsdMicro: null,
      },
      {
        step: "image",
        model: "z-image-turbo",
        trust: "verified",
        requestId: null,
        teeVerified: false,
        costUsdMicro: null,
      },
      {
        step: "keep",
        model: "mask-large",
        trust: "standard",
        requestId: "task-1",
        teeVerified: null,
        costUsdMicro: "1",
      },
    ]);
    const encoded = JSON.stringify(body);
    expect(encoded).not.toContain(MK);
    expect(encoded).not.toContain(SK);
    expect(encoded).not.toMatch(/\b(?:mk|sk)-/);
    expect(encoded).not.toContain("provider_identity");
    expect(encoded).not.toContain("apiKey");
  });

  it("returns the credit and deposit split only when the run recorded one", () => {
    expect(nightResultsBody(input()).results?.spending).toEqual({
      currency: "0g",
      creditUsed: "1000000000000000000",
      depositUsed: "0",
      spentUsdMicro: "40",
    });
    const missingDeposit = nightResultsBody(input({ run: { spentUsdMicro: 5n, creditUsed: "9", depositUsed: null } }));
    expect(missingDeposit.results?.spending).toMatchObject({ creditUsed: "9", depositUsed: null, spentUsdMicro: "5" });
    const unsplit = nightResultsBody(input({ run: { spentUsdMicro: 5n, creditUsed: null, depositUsed: "not-a-number" } }));
    expect(unsplit.results?.spending).toBeNull();
    expect(nightResultsBody(input({ run: null })).results?.spending).toBeNull();
  });

  it("omits personal results when nobody is signed in, even if rows were passed in", () => {
    const body = nightResultsBody(input({ signedIn: false, tasks: [task({ id: "task-should-stay-hidden", prompt: MK })] }));
    expect(body.signedIn).toBe(false);
    expect(body).not.toHaveProperty("results");
    expect(JSON.stringify(body)).not.toContain("task-should-stay-hidden");
    expect(JSON.stringify(body)).not.toContain("mk-");
  });

  it("strips a key pasted into a prompt and a storage root that is not a hash", () => {
    const body = nightResultsBody(
      input({
        tasks: [task({ prompt: `see ${MK} please`, error: `failed ${SK} then mk-[REDACTED]`, outputRoot: SK, steps: "not-steps" })],
      }),
    );
    expect(body.results?.tasks[0]).toMatchObject({
      prompt: "see [redacted] please",
      error: "failed [redacted] then [redacted]",
      outputRoot: null,
      steps: [],
    });
    expect(JSON.stringify(body)).not.toMatch(/\b(?:mk|sk)-/);
  });

  it("selects provenance steps and leaves vault columns and the ephemeral key unread", () => {
    expect(NIGHT_TASK_SELECT).toMatchObject({ steps: true });
    expect(NIGHT_TASK_SELECT).not.toHaveProperty("inputPath");
    expect(NIGHT_RUN_SPEND_SELECT).not.toHaveProperty("ephemeralKeyId");
    expect(NIGHT_RUN_SPEND_SELECT).not.toHaveProperty("balanceBefore");
    expect(NIGHT_RUN_SPEND_SELECT).not.toHaveProperty("balanceAfter");
  });
});
