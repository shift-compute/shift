import { Contract, JsonRpcProvider, Wallet, getAddress } from "ethers";
import { redactString } from "../redact";

/**
 * Write fragment of `contracts/src/ShiftLedger.sol`.
 * The worker calls `anchorNight`, then `recordDonations` when the night has a positive donation.
 * An empty donation list is rejected here: the contract sets `donationsRecorded` even when `donors` is empty,
 * which would block a later real amount.
 * Argument order matches the Solidity signatures.
 */
export const SHIFT_LEDGER_ABI = [
  "function anchorNight(uint64 nightId, bytes32 root, bytes32 manifestRoot, uint32 itemCount)",
  "function recordDonations(uint64 nightId, address[] donors, uint64[] amounts)",
  "function nights(uint64 nightId) view returns (bytes32 root, bytes32 manifestRoot, uint32 itemCount, uint64 anchoredAt, bool donationsRecorded)",
  "error AlreadyAnchored(uint64 nightId)",
  "error EmptyRoot()",
  "error NotAnchored(uint64 nightId)",
  "error DonationsAlreadyRecorded(uint64 nightId)",
  "error LengthMismatch()",
] as const;

const MAX_UINT64 = (1n << 64n) - 1n;
const TX_HASH = /^0x[0-9a-fA-F]{64}$/;

export interface LedgerAnchor {
  nightId: bigint;
  root: `0x${string}`;
  manifestRoot: `0x${string}`;
  itemCount: number;
}

export interface LedgerDonations {
  nightId: bigint;
  donors: readonly string[];
  amounts: readonly bigint[];
}

export interface LedgerReceipt {
  txHash: `0x${string}`;
}

/** What `nights(nightId)` tells the worker before it sends `recordDonations`. */
export interface LedgerNight {
  /** `anchoredAt != 0`. `recordDonations` reverts with `NotAnchored` until this is true. */
  anchored: boolean;
  donationsRecorded: boolean;
}

/** Chain calls for one night. Tests pass a fake. The test suite does not broadcast. */
export interface LedgerClient {
  anchorNight(input: LedgerAnchor): Promise<LedgerReceipt>;
  readNight(nightId: bigint): Promise<LedgerNight>;
  recordDonations(input: LedgerDonations): Promise<LedgerReceipt>;
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
 * Signs `anchorNight` and `recordDonations` with the operator key and waits for one confirmation.
 * Constructing the client does not contact the RPC. The chain id is read before a transaction or a night read is sent.
 * `recordDonations` rejects an empty list before any RPC call.
 */
export function createLedgerClient(options: LedgerOptions): LedgerClient {
  const provider = new JsonRpcProvider(options.rpcUrl, options.chainId, { staticNetwork: true });
  const wallet = new Wallet(options.privateKey, provider);
  const contract = new Contract(options.address, [...SHIFT_LEDGER_ABI], wallet);

  async function assertChain(): Promise<void> {
    const reported = await provider.send("eth_chainId", []);
    if (BigInt(reported) !== BigInt(options.chainId)) {
      throw new LedgerError(`RPC reported chain ${String(reported)}, expected ${options.chainId}.`);
    }
  }

  async function confirmed(tx: { wait: () => Promise<{ hash?: string; status?: number } | null> }, label: string): Promise<LedgerReceipt> {
    const receipt = await tx.wait();
    const hash = receipt?.hash;
    if (!receipt || receipt.status !== 1 || typeof hash !== "string" || !TX_HASH.test(hash)) {
      throw new LedgerError(`${label} was not confirmed.`);
    }
    return { txHash: hash.toLowerCase() as `0x${string}` };
  }

  return {
    async anchorNight(input) {
      if (!Number.isInteger(input.itemCount) || input.itemCount < 1 || input.itemCount > 0xffffffff) {
        throw new LedgerError("itemCount must be a positive integer that fits in uint32.");
      }
      try {
        await assertChain();
        const tx = await contract.getFunction("anchorNight")(input.nightId, input.root, input.manifestRoot, input.itemCount);
        return await confirmed(tx, "anchorNight");
      } catch (err) {
        if (err instanceof LedgerError) throw err;
        throw new LedgerError(err instanceof Error ? err.message : "anchorNight failed");
      }
    },

    async readNight(nightId) {
      try {
        await assertChain();
        const night = await contract.getFunction("nights")(nightId);
        const anchoredAt = BigInt(night.anchoredAt ?? night[3]);
        return { anchored: anchoredAt !== 0n, donationsRecorded: Boolean(night.donationsRecorded ?? night[4]) };
      } catch (err) {
        if (err instanceof LedgerError) throw err;
        throw new LedgerError(err instanceof Error ? err.message : "nights read failed");
      }
    },

    async recordDonations(input) {
      assertDonationInput(input);
      try {
        await assertChain();
        const tx = await contract.getFunction("recordDonations")(input.nightId, [...input.donors], [...input.amounts]);
        return await confirmed(tx, "recordDonations");
      } catch (err) {
        if (err instanceof LedgerError) throw err;
        throw new LedgerError(err instanceof Error ? err.message : "recordDonations failed");
      }
    },
  };
}

/** Rejects a call that would set `donationsRecorded` without a positive amount, before the RPC is contacted. */
function assertDonationInput(input: LedgerDonations): void {
  if (input.donors.length === 0 || input.amounts.length === 0) {
    throw new LedgerError("recordDonations requires at least one donation. An empty list would set donationsRecorded.");
  }
  if (input.donors.length !== input.amounts.length) {
    throw new LedgerError("Donors and amounts must be the same length.");
  }
  for (const amount of input.amounts) {
    if (amount <= 0n || amount > MAX_UINT64) {
      throw new LedgerError("Each donation must be a positive micro-USD amount that fits in uint64.");
    }
  }
  for (const donor of input.donors) {
    try {
      getAddress(donor);
    } catch {
      throw new LedgerError("Each donor must be a 0x-prefixed 20-byte address.");
    }
  }
}
