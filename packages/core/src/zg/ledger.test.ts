import { Interface, id } from "ethers";
import { describe, expect, it } from "vitest";
import { SHIFT_LEDGER_ABI } from "./ledger";

describe("ShiftLedger ABI fragment", () => {
  it("encodes anchorNight and recordDonations in the contract's argument order", () => {
    const iface = new Interface([...SHIFT_LEDGER_ABI]);
    const anchor = iface.getFunction("anchorNight");
    expect(anchor?.selector).toBe(id("anchorNight(uint64,bytes32,bytes32,uint32)").slice(0, 10));

    const root = `0x${"ab".repeat(32)}`;
    const manifestRoot = `0x${"cd".repeat(32)}`;
    const anchored = iface.encodeFunctionData("anchorNight", [20261106n, root, manifestRoot, 2]);
    const decodedAnchor = iface.decodeFunctionData("anchorNight", anchored);
    expect(decodedAnchor[0]).toBe(20261106n);
    expect(decodedAnchor[1]).toBe(root);
    expect(decodedAnchor[2]).toBe(manifestRoot);
    expect(decodedAnchor[3]).toBe(2n);

    const donations = iface.getFunction("recordDonations");
    expect(donations?.selector).toBe(id("recordDonations(uint64,address[],uint64[])").slice(0, 10));
    const alice = "0x1111111111111111111111111111111111111111";
    const bob = "0x2222222222222222222222222222222222222222";
    const data = iface.encodeFunctionData("recordDonations", [20261106n, [bob, alice], [4n, 7n]]);
    const decoded = iface.decodeFunctionData("recordDonations", data);
    expect(decoded[0]).toBe(20261106n);
    expect(decoded[1]).toEqual([bob, alice]);
    expect(decoded[2]).toEqual([4n, 7n]);
  });
});
