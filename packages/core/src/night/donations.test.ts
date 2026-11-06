import { getAddress } from "ethers";
import { describe, expect, it, vi } from "vitest";
import type { PrismaClient } from "../db/client";
import { createLedgerClient, type LedgerDonations } from "../zg/ledger";
import { aggregateDonations, prismaDonationStore, recordNightDonations, type DonationStore, type NightDonation } from "./donations";

const NIGHT = 20261106n;
const ALICE = "0x1111111111111111111111111111111111111111";
const BOB = "0x2222222222222222222222222222222222222222";
const TX = `0x${"ab".repeat(32)}` as `0x${string}`;
const CONTRACT = "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7";

function store(rows: NightDonation[], existing: string | null = null) {
  const saved: string[] = [];
  const donationStore: DonationStore = {
    donationsTx: async () => existing,
    positiveDonations: async () => rows,
    saveDonationsTx: async (_nightId, donationsTx) => {
      saved.push(donationsTx);
    },
  };
  return { donationStore, saved };
}

describe("aggregateDonations", () => {
  it("sums one address, drops non-positive amounts, and sorts by address", () => {
    const aggregated = aggregateDonations([
      { address: `0x${BOB.slice(2).toUpperCase()}`, amountUsdMicro: 4n },
      { address: ALICE, amountUsdMicro: 0n },
      { address: `0x${"2".repeat(40)}`, amountUsdMicro: 5n },
      { address: ALICE, amountUsdMicro: 7n },
      { address: BOB, amountUsdMicro: -1n },
    ]);
    expect(aggregated.donors).toEqual([getAddress(ALICE), getAddress(BOB)]);
    expect(aggregated.amounts).toEqual([7n, 9n]);
  });

  it("rejects an address that is not 20 bytes and a total that does not fit in uint64", () => {
    expect(() => aggregateDonations([{ address: "0x1234", amountUsdMicro: 1n }])).toThrow(/20-byte/);
    expect(() => aggregateDonations([{ address: ALICE, amountUsdMicro: 1n << 64n }])).toThrow(/uint64/);
  });
});

describe("recordNightDonations", () => {
  it("does not call the contract when the night has no positive donation", async () => {
    const fake = store([
      { address: ALICE, amountUsdMicro: 0n },
      { address: BOB, amountUsdMicro: -3n },
    ]);
    const ledger = {
      readNight: vi.fn(async () => {
        throw new Error("readNight must not be called");
      }),
      recordDonations: vi.fn(async () => {
        throw new Error("recordDonations must not be called");
      }),
    };

    await expect(recordNightDonations({ nightId: NIGHT, store: fake.donationStore, ledger })).resolves.toEqual({
      recorded: false,
      reason: "empty",
    });
    expect(ledger.readNight).not.toHaveBeenCalled();
    expect(ledger.recordDonations).not.toHaveBeenCalled();
    expect(fake.saved).toEqual([]);
  });

  it("sends the aggregated totals and stores the transaction", async () => {
    const fake = store([
      { address: BOB, amountUsdMicro: 4n },
      { address: ALICE, amountUsdMicro: 7n },
    ]);
    const seen: LedgerDonations[] = [];
    const result = await recordNightDonations({
      nightId: NIGHT,
      store: fake.donationStore,
      justAnchored: true,
      ledger: {
        readNight: async () => ({ anchored: true, donationsRecorded: false }),
        recordDonations: async (input) => {
          seen.push(input);
          return { txHash: TX };
        },
      },
    });

    expect(result).toEqual({ recorded: true, donationsTx: TX, donorCount: 2 });
    expect(seen).toEqual([{ nightId: NIGHT, donors: [getAddress(ALICE), getAddress(BOB)], amounts: [7n, 4n] }]);
    expect(fake.saved).toEqual([TX]);
  });

  it("does not send again when the transaction is already stored or the contract already recorded donations", async () => {
    const stored = store([{ address: ALICE, amountUsdMicro: 7n }], TX);
    const storedLedger = {
      readNight: vi.fn(async () => {
        throw new Error("readNight must not be called");
      }),
      recordDonations: vi.fn(async () => {
        throw new Error("recordDonations must not be called");
      }),
    };
    await expect(recordNightDonations({ nightId: NIGHT, store: stored.donationStore, ledger: storedLedger })).resolves.toEqual({
      recorded: false,
      reason: "already_stored",
    });
    expect(storedLedger.readNight).not.toHaveBeenCalled();
    expect(storedLedger.recordDonations).not.toHaveBeenCalled();

    const onChain = store([{ address: ALICE, amountUsdMicro: 7n }]);
    const calls: string[] = [];
    await expect(
      recordNightDonations({
        nightId: NIGHT,
        store: onChain.donationStore,
        ledger: {
          readNight: async () => {
            calls.push("read");
            return { anchored: true, donationsRecorded: true };
          },
          recordDonations: async () => {
            throw new Error("recordDonations must not be called");
          },
        },
      }),
    ).resolves.toEqual({ recorded: false, reason: "already_on_chain" });
    expect(calls).toEqual(["read"]);
    expect(onChain.saved).toEqual([]);
  });

  it("leaves a positive donation in the database when the night is not anchored", async () => {
    const fake = store([{ address: ALICE, amountUsdMicro: 7n }]);
    const result = await recordNightDonations({
      nightId: NIGHT,
      store: fake.donationStore,
      ledger: {
        readNight: async () => ({ anchored: false, donationsRecorded: false }),
        recordDonations: async () => {
          throw new Error("recordDonations must not be called");
        },
      },
    });
    expect(result).toEqual({ recorded: false, reason: "not_anchored" });
    expect(fake.saved).toEqual([]);
  });

  it("fails when this run anchored the night and the contract still reports it unanchored", async () => {
    const fake = store([{ address: ALICE, amountUsdMicro: 7n }]);
    await expect(
      recordNightDonations({
        nightId: NIGHT,
        store: fake.donationStore,
        justAnchored: true,
        ledger: {
          readNight: async () => ({ anchored: false, donationsRecorded: false }),
          recordDonations: async () => {
            throw new Error("recordDonations must not be called");
          },
        },
      }),
    ).rejects.toThrow(/not anchored/);
    expect(fake.saved).toEqual([]);
  });

  it("does not store a transaction when the chain call fails", async () => {
    const fake = store([{ address: ALICE, amountUsdMicro: 7n }]);
    await expect(
      recordNightDonations({
        nightId: NIGHT,
        store: fake.donationStore,
        ledger: {
          readNight: async () => ({ anchored: true, donationsRecorded: false }),
          recordDonations: async () => {
            throw new Error("DonationsAlreadyRecorded");
          },
        },
      }),
    ).rejects.toThrow(/DonationsAlreadyRecorded/);
    expect(fake.saved).toEqual([]);
  });
});

describe("prismaDonationStore", () => {
  it("reads positive totals and writes donationsTx", async () => {
    const findUnique = vi.fn().mockResolvedValue({ donationsTx: null });
    const findMany = vi.fn().mockResolvedValue([{ donatedUsdMicro: 12n, user: { accountAddress: ALICE } }]);
    const update = vi.fn().mockResolvedValue({});
    const db = { night: { findUnique, update }, nightRun: { findMany } } as unknown as PrismaClient;
    const donations = prismaDonationStore(db);

    await expect(donations.donationsTx(NIGHT)).resolves.toBeNull();
    await expect(donations.positiveDonations(NIGHT)).resolves.toEqual([{ address: ALICE, amountUsdMicro: 12n }]);
    await donations.saveDonationsTx(NIGHT, TX);

    expect(findUnique).toHaveBeenCalledWith({ where: { id: NIGHT }, select: { donationsTx: true } });
    expect(findMany).toHaveBeenCalledWith({
      where: { nightId: NIGHT, donatedUsdMicro: { gt: 0 } },
      orderBy: { userId: "asc" },
      select: { donatedUsdMicro: true, user: { select: { accountAddress: true } } },
    });
    expect(update).toHaveBeenCalledWith({ where: { id: NIGHT }, data: { donationsTx: TX } });
  });
});

describe("createLedgerClient recordDonations guard", () => {
  const client = createLedgerClient({
    rpcUrl: "http://127.0.0.1:1",
    chainId: 16602,
    address: CONTRACT,
    privateKey: `0x${"11".repeat(32)}`,
  });

  it("rejects an empty list, a length mismatch, and a non-positive amount before any RPC call", async () => {
    await expect(client.recordDonations({ nightId: NIGHT, donors: [], amounts: [] })).rejects.toThrow(/empty list/);
    await expect(client.recordDonations({ nightId: NIGHT, donors: [ALICE], amounts: [] })).rejects.toThrow(/empty list/);
    await expect(client.recordDonations({ nightId: NIGHT, donors: [ALICE, BOB], amounts: [1n] })).rejects.toThrow(/same length/);
    await expect(client.recordDonations({ nightId: NIGHT, donors: [ALICE], amounts: [0n] })).rejects.toThrow(/positive/);
    await expect(client.recordDonations({ nightId: NIGHT, donors: [ALICE], amounts: [1n << 64n] })).rejects.toThrow(/uint64/);
    await expect(client.recordDonations({ nightId: NIGHT, donors: ["0x1234"], amounts: [1n] })).rejects.toThrow(/20-byte/);
  });
});
