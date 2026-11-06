import { getAddress } from "ethers";
import type { PrismaClient } from "../db/client";
import type { LedgerDonations, LedgerNight, LedgerReceipt } from "../zg/ledger";

const MAX_UINT64 = (1n << 64n) - 1n;

export class DonationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DonationError";
  }
}

export interface NightDonation {
  /** 0G account address of the donor. */
  address: string;
  amountUsdMicro: bigint;
}

export interface DonationStore {
  /** `Night.donationsTx`, or null when this night has not stored a donation transaction. */
  donationsTx(nightId: bigint): Promise<string | null>;
  /** Night runs whose `donatedUsdMicro` is positive. One row per user. */
  positiveDonations(nightId: bigint): Promise<NightDonation[]>;
  saveDonationsTx(nightId: bigint, donationsTx: string): Promise<void>;
}

/** The two ledger calls `recordNightDonations` makes. Tests pass a fake and do not broadcast. */
export interface DonationLedger {
  readNight(nightId: bigint): Promise<LedgerNight>;
  recordDonations(input: LedgerDonations): Promise<LedgerReceipt>;
}

export type DonationRecordResult =
  | { recorded: false; reason: "empty" | "already_stored" | "already_on_chain" | "not_anchored" }
  | { recorded: true; donationsTx: `0x${string}`; donorCount: number };

/**
 * Sums positive micro-USD by donor address.
 * Zero and negative amounts are dropped. Addresses are checksummed. Order is lowercase hex, so the call is stable.
 * Two rows for one address become one entry: the contract adds every entry and then locks the night.
 */
export function aggregateDonations(rows: readonly NightDonation[]): { donors: `0x${string}`[]; amounts: bigint[] } {
  const totals = new Map<string, bigint>();
  for (const row of rows) {
    if (row.amountUsdMicro <= 0n) continue;
    let address: string;
    try {
      address = getAddress(row.address);
    } catch {
      throw new DonationError("Donor address must be a 0x-prefixed 20-byte address.");
    }
    const next = (totals.get(address) ?? 0n) + row.amountUsdMicro;
    if (next > MAX_UINT64) throw new DonationError("A donation does not fit in uint64 micro-USD.");
    totals.set(address, next);
  }
  const donors = [...totals.keys()].sort((a, b) => {
    const left = a.toLowerCase();
    const right = b.toLowerCase();
    return left < right ? -1 : left > right ? 1 : 0;
  });
  return { donors: donors as `0x${string}`[], amounts: donors.map((donor) => totals.get(donor) ?? 0n) };
}

/**
 * Records this night's compute donations on ShiftLedger (plan §14.4 step 5).
 * Sends nothing when every amount is zero, when `donationsTx` is already stored, or when the contract
 * already has `donationsRecorded` set. An empty call would lock that flag.
 * The contract reverts with `NotAnchored` until `anchorNight` has landed, so an unanchored night stays in the database.
 */
export async function recordNightDonations(deps: {
  nightId: bigint;
  store: DonationStore;
  ledger: DonationLedger;
  /** True when this process just confirmed `anchorNight`. A following read that still says unanchored is a failure. */
  justAnchored?: boolean;
  log?: (message: string) => void;
}): Promise<DonationRecordResult> {
  const log = deps.log ?? (() => undefined);
  const existing = await deps.store.donationsTx(deps.nightId);
  if (existing && existing.length > 0) {
    log(`night ${deps.nightId}: donations already stored in ${existing}`);
    return { recorded: false, reason: "already_stored" };
  }

  const aggregated = aggregateDonations(await deps.store.positiveDonations(deps.nightId));
  if (aggregated.donors.length === 0) {
    log(`night ${deps.nightId}: no positive donations, recordDonations not sent`);
    return { recorded: false, reason: "empty" };
  }

  const night = await deps.ledger.readNight(deps.nightId);
  if (night.donationsRecorded) {
    log(`night ${deps.nightId}: donations already recorded on-chain, recordDonations not sent`);
    return { recorded: false, reason: "already_on_chain" };
  }
  if (!night.anchored) {
    if (deps.justAnchored) {
      throw new DonationError(`Night ${deps.nightId} was anchored in this run but the contract still reports it as not anchored.`);
    }
    log(`night ${deps.nightId}: ${aggregated.donors.length} donation(s) stay in the database; the night is not anchored, so recordDonations was not sent`);
    return { recorded: false, reason: "not_anchored" };
  }

  const receipt = await deps.ledger.recordDonations({
    nightId: deps.nightId,
    donors: aggregated.donors,
    amounts: aggregated.amounts,
  });
  await deps.store.saveDonationsTx(deps.nightId, receipt.txHash);
  log(`night ${deps.nightId}: recorded ${aggregated.donors.length} donation(s) in ${receipt.txHash}`);
  return { recorded: true, donationsTx: receipt.txHash, donorCount: aggregated.donors.length };
}

/** Prisma backing. The night row already exists: the lock or the manual run created it. */
export function prismaDonationStore(db: PrismaClient): DonationStore {
  return {
    async donationsTx(nightId) {
      const night = await db.night.findUnique({ where: { id: nightId }, select: { donationsTx: true } });
      return night?.donationsTx ?? null;
    },

    async positiveDonations(nightId) {
      const runs = await db.nightRun.findMany({
        where: { nightId, donatedUsdMicro: { gt: 0 } },
        orderBy: { userId: "asc" },
        select: { donatedUsdMicro: true, user: { select: { accountAddress: true } } },
      });
      return runs.map((run) => ({ address: run.user.accountAddress, amountUsdMicro: run.donatedUsdMicro }));
    },

    async saveDonationsTx(nightId, donationsTx) {
      await db.night.update({ where: { id: nightId }, data: { donationsTx } });
    },
  };
}
