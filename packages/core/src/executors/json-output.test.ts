import { describe, expect, it } from "vitest";
import { z } from "zod";
import { chatText, ExecutorOutputError, extractJsonObject, parseModelJson } from "./json-output";

describe("extractJsonObject", () => {
  it("reads plain JSON, fenced JSON and JSON inside prose", () => {
    expect(extractJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(extractJsonObject('Here you go:\n```json\n{"a":{"b":2}}\n```\nDone.')).toEqual({ a: { b: 2 } });
    expect(extractJsonObject('Sure! {"a":"x"} Hope it helps.')).toEqual({ a: "x" });
  });

  it("fails clearly when there is no usable object", () => {
    expect(() => extractJsonObject("no json here")).toThrow(ExecutorOutputError);
    expect(() => extractJsonObject("{broken")).toThrow(/JSON object/);
    expect(() => extractJsonObject("{a: 1}")).toThrow(/could not be parsed/);
  });
});

describe("parseModelJson", () => {
  const schema = z.object({ summary: z.string(), keyPoints: z.array(z.string()) });

  it("returns typed data", () => {
    expect(parseModelJson(schema, '{"summary":"s","keyPoints":["a"]}')).toEqual({ summary: "s", keyPoints: ["a"] });
  });

  it("names the missing fields", () => {
    expect(() => parseModelJson(schema, '{"summary":"s"}')).toThrow(/keyPoints/);
  });
});

describe("chatText", () => {
  it("returns the first message and rejects empty answers", () => {
    expect(chatText({ choices: [{ message: { content: "hi" } }] })).toBe("hi");
    expect(() => chatText({ choices: [{ message: { content: null } }] })).toThrow(/empty/);
    expect(() => chatText({ choices: [] })).toThrow(/empty/);
  });
});
