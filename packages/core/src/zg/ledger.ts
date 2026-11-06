import { Contract, JsonRpcProvider, Wallet } from "ethers";
import { redactString } from "../redact";

/**
 * Write fragment of `contracts/src/ShiftLedger.sol`.
 * The worker calls `anchorNight` only. `recordDonations` is omitted on purpose: the contract
 * sets `donationsRecorded` even for an empty list, which would stop F4 from recording real donations.
 * Argument order matches the Solidity signature `anchorNight(uint64,bytes32,bytes32,uint32)`.
 */
export const SHIFT_LEDGER_ABI = [
  "function anchorNight(uint64 nightId, bytes32 root, bytes32 manifestRoot, uint32 itemCount)",
  "error AlreadyAnchored(uint64 nightId)",
  "error EmptyRoot()",
  "error NotAnchored(uint64 nightId)",
  "error DonationsAlreadyRecorded(uint64 nightId)",
  "error LengthMismatch()",
] as const;

export interface LedgerAnchor {
  nightId: bigint;
  root: `0x${string}`;
  manifestRoot: `0x${string}`;
  itemCount: number;
}

export interface LedgerReceipt {
  txHash: `0x${string}`;
}

/** The one chain call the night makes. Tests pass a fake; nothing in the test suite broadcasts. */
export interface LedgerClient {
  anchorNight(input: LedgerAnchor): Promise<LedgerReceipt>;
}

export interface LedgerOptions {
  rpcUrl: string;
  chainId: number;
  /** Deployed ShiftLedger. Galileo: see PROGRESS.md F0.6. */
  address: string;
  /** Operator key. Pays gas. Never log it. */
  privateKey: string;
}

export class LedgerError extends Error {
  constructor(message: string) {
    super(redactString(message));
    this.name = "LedgerError";
  }
}

/**
 * Signs `anchorNight` with the operator key and waits for one confirmation.
 * Constructing the client does not contact the RPC. The chain id is read before the transaction is sent.
 */
export function createLedgerClient(options: LedgerOptions): LedgerClient {
  const provider = new JsonRpcProvider(options.rpcUrl, options.chainId, { staticNetwork: true });
  const wallet = new Wallet(options.privateKey, provider);
  const contract = new Contract(options.address, [...SHIFT_LEDGER_ABI], wallet);

  return {
    async anchorNight(input) {
      if (!Number.isInteger(input.itemCount) || input.itemCount < 1 || input.itemCount > 0xffffffff) {
        throw new LedgerError("itemCount must be a positive integer that fits in uint32.");
      }
      const reported = await provider.send("eth_chainId", []);
      if (BigInt(reported) !== BigInt(options.chainId)) {
        throw new LedgerError(`RPC reported chain ${String(reported)}, expected ${options.chainId}.`);
      }
      try {
        const tx = await contract.getFunction("anchorNight")(input.nightId, input.root, input.manifestRoot, input.itemCount);
        const receipt = await tx.wait();
        const hash = receipt?.hash;
        if (!receipt || receipt.status !== 1 || typeof hash !== "string" || !/^0x[0-9a-fA-F]{64}$/.test(hash)) {
          throw new LedgerError("anchorNight was not confirmed.");
        }
        return { txHash: hash.toLowerCase() as `0x${string}` };
      } catch (err) {
        if (err instanceof LedgerError) throw err;
        throw new LedgerError(err instanceof Error ? err.message : "anchorNight failed");
      }
    },
  };
}
