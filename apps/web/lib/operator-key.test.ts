import { describe, expect, it } from "vitest";
import { readOperatorKey, StorageKeyError } from "./operator-key";

describe("readOperatorKey", () => {
  it("returns a 32-byte hex key and refuses anything else without echoing it", () => {
    const key = "0x" + "ab".repeat(32);
    expect(readOperatorKey({ OPERATOR_PRIVATE_KEY: key })).toBe(key);

    const bad = "0xnot-a-key";
    try {
      readOperatorKey({ OPERATOR_PRIVATE_KEY: bad });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(StorageKeyError);
      expect(String(err)).not.toContain(bad);
      expect(String(err)).toContain("OPERATOR_PRIVATE_KEY");
    }
    expect(() => readOperatorKey({})).toThrow(StorageKeyError);
  });
});
