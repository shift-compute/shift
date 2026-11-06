import { getAddress } from "ethers";
import { describe, expect, it } from "vitest";
import type { StepRecord } from "../executors/types";
import { encodeLeaf, keccakUtf8, leafFromStep, MerkleLeafError, TRUST_TIER } from "./leaf";

const OWNER = "0x1111111111111111111111111111111111111111";
const OUTPUT = `0x${"ab".repeat(32)}`;

const input = {
  requestId: "req-test-1",
  owner: OWNER,
  taskId: "task-1",
  outputRoot: OUTPUT,
  modelId: "0gm-1.0-35b-a3b",
  trust: "private" as const,
  costUsdMicro: 1234n,
  isCommons: false,
};

const step: StepRecord = {
  step: "analyze",
  model: "0gm-1.0-35b-a3b",
  requestId: "req-test-1",
  trace: { tee_verified: true },
  costUsdMicro: "1234",
};

describe("encodeLeaf", () => {
  it("hashes request, task and model as UTF-8 and keeps the storage root", () => {
    const leaf = encodeLeaf(input);
    expect(leaf[0]).toBe(keccakUtf8("req-test-1"));
    expect(leaf[2]).toBe(keccakUtf8("task-1"));
    expect(leaf[3]).toBe(OUTPUT);
    expect(leaf[4]).toBe(keccakUtf8("0gm-1.0-35b-a3b"));
    expect(leaf[5]).toBe(TRUST_TIER.private);
    expect(leaf[6]).toBe(1234n);
    expect(leaf[7]).toBe(false);
  });

  it("maps trust names to the uint8 tiers", () => {
    expect(encodeLeaf({ ...input, trust: "standard" })[5]).toBe(0);
    expect(encodeLeaf({ ...input, trust: "verified" })[5]).toBe(1);
    expect(encodeLeaf({ ...input, trust: "private" })[5]).toBe(2);
  });

  it("accepts a checksummed owner and stores it in lowercase", () => {
    const mixed = "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f";
    const checksummed = getAddress(mixed);
    expect(checksummed).not.toBe(mixed);
    const fromChecksum = encodeLeaf({ ...input, owner: checksummed });
    const fromLower = encodeLeaf({ ...input, owner: mixed });
    expect(fromChecksum[1]).toBe(mixed);
    expect(fromChecksum).toEqual(fromLower);
  });

  it("rejects a bad checksum, a short root, an empty id and a cost that is not a uint64", () => {
    const checksummed = getAddress("0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f");
    const flipped = checksummed[2] === checksummed[2]!.toLowerCase() ? checksummed[2]!.toUpperCase() : checksummed[2]!.toLowerCase();
    const badChecksum = checksummed.slice(0, 2) + flipped + checksummed.slice(3);
    expect(() => encodeLeaf({ ...input, owner: badChecksum })).toThrow(MerkleLeafError);
    expect(() => encodeLeaf({ ...input, owner: "0x1234" })).toThrow(MerkleLeafError);
    expect(() => encodeLeaf({ ...input, outputRoot: "0xab" })).toThrow(MerkleLeafError);
    expect(() => encodeLeaf({ ...input, requestId: "" })).toThrow(MerkleLeafError);
    expect(() => encodeLeaf({ ...input, modelId: "" })).toThrow(MerkleLeafError);
    expect(() => encodeLeaf({ ...input, taskId: "" })).toThrow(MerkleLeafError);
    expect(() => encodeLeaf({ ...input, costUsdMicro: -1n })).toThrow(MerkleLeafError);
    expect(() => encodeLeaf({ ...input, costUsdMicro: 1n << 64n })).toThrow(MerkleLeafError);
    expect(() => encodeLeaf({ ...input, trust: "public" as "private" })).toThrow(MerkleLeafError);
  });

  it("accepts a zero cost and the maximum uint64", () => {
    expect(encodeLeaf({ ...input, costUsdMicro: 0n })[6]).toBe(0n);
    expect(encodeLeaf({ ...input, costUsdMicro: (1n << 64n) - 1n })[6]).toBe((1n << 64n) - 1n);
  });
});

describe("leafFromStep", () => {
  it("packs a completed step with the task's owner, output and trust", () => {
    const fromStep = leafFromStep(step, { owner: OWNER, taskId: "task-1", outputRoot: OUTPUT, trust: "private" });
    expect(fromStep).toEqual(encodeLeaf(input));
    expect(fromStep[7]).toBe(false);
  });

  it("sets the commons flag when the caller says the step is a donation", () => {
    const leaf = leafFromStep(step, {
      owner: OWNER,
      taskId: "commons-1",
      outputRoot: OUTPUT,
      trust: "verified",
      isCommons: true,
    });
    expect(leaf[2]).toBe(keccakUtf8("commons-1"));
    expect(leaf[5]).toBe(1);
    expect(leaf[7]).toBe(true);
  });

  it("refuses a step that has no request id, model or reported cost", () => {
    const context = { owner: OWNER, taskId: "task-1", outputRoot: OUTPUT, trust: "private" as const };
    expect(() => leafFromStep({ step: "analyze", model: "m" }, context)).toThrow(MerkleLeafError);
    expect(() => leafFromStep({ step: "analyze", model: "m", requestId: "req" }, context)).toThrow(MerkleLeafError);
    expect(() => leafFromStep({ ...step, costUsdMicro: "12.5" }, context)).toThrow(MerkleLeafError);
    expect(() => leafFromStep({ ...step, model: "" }, context)).toThrow(MerkleLeafError);
  });
});
