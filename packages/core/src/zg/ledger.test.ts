import { Interface, id } from "ethers";
import { describe, expect, it } from "vitest";
import { SHIFT_LEDGER_ABI } from "./ledger";

describe("ShiftLedger ABI fragment", () => {
  it("encodes anchorNight in the contract's argument order", () => {
    const iface = new Interface([...SHIFT_LEDGER_ABI]);
    const fragment = iface.getFunction("anchorNight");
    expect(fragment?.selector).toBe(id("anchorNight(uint64,bytes32,bytes32,uint32)").slice(0, 10));

    const root = `0x${"ab".repeat(32)}`;
    const manifestRoot = `0x${"cd".repeat(32)}`;
    const data = iface.encodeFunctionData("anchorNight", [20261106n, root, manifestRoot, 2]);
    const decoded = iface.decodeFunctionData("anchorNight", data);
    expect(decoded[0]).toBe(20261106n);
    expect(decoded[1]).toBe(root);
    expect(decoded[2]).toBe(manifestRoot);
    expect(decoded[3]).toBe(2n);
    expect(iface.getFunction("recordDonations")).toBeNull();
  });
});
