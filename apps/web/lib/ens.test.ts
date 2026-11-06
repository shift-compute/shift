import { describe, expect, it } from "vitest";
import { compareLedger, ensAppUrl, parseLedgerRecord, readIdentity, type EnsReader } from "./ens";

const LEDGER = { chainId: 16602, address: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7" };
const WALLET = "0x8fe18C629957ec75E6135C4125c71a72F670d177";

function reader(over: Partial<EnsReader> & { records?: Record<string, string | null> } = {}): EnsReader {
  const records = over.records ?? {};
  return {
    address: over.address ?? (async () => WALLET),
    name: over.name ?? (async () => "tryshift.eth"),
    text: over.text ?? (async (_name, key) => records[key] ?? null),
  };
}

describe("parseLedgerRecord", () => {
  it("accepts eip155:<chain>:<address> and lowercases the address", () => {
    expect(parseLedgerRecord(`eip155:16602:${LEDGER.address}`)).toEqual({ chainId: 16602, address: LEDGER.address.toLowerCase() });
  });

  it("rejects anything else", () => {
    for (const bad of [null, "", "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7", "eip155:0:0xA3B6664b487FC01c4264977c9B92058A89C31Ed7", "eip155:16602:0x123", "eip155:abc:0xA3B6664b487FC01c4264977c9B92058A89C31Ed7"]) {
      expect(parseLedgerRecord(bad)).toBeNull();
    }
  });
});

describe("compareLedger", () => {
  it("matches the same chain and address regardless of case", () => {
    expect(compareLedger(`eip155:16602:${LEDGER.address.toLowerCase()}`, LEDGER)).toBe("matches");
  });

  it("differs on another chain, another address or a malformed record", () => {
    expect(compareLedger(`eip155:16661:${LEDGER.address}`, LEDGER)).toBe("differs");
    expect(compareLedger(`eip155:16602:${WALLET}`, LEDGER)).toBe("differs");
    expect(compareLedger("not a record", LEDGER)).toBe("differs");
  });

  it("is not_published when the record is empty or missing", () => {
    expect(compareLedger(null, LEDGER)).toBe("not_published");
    expect(compareLedger("  ", LEDGER)).toBe("not_published");
  });
});

describe("readIdentity", () => {
  it("reads the address, primary name and published records", async () => {
    const identity = await readIdentity(
      reader({ records: { "shift.ledger": `eip155:16602:${LEDGER.address}`, url: "https://tryshift.example", "com.github": "shift-compute/shift" } }),
      LEDGER,
    );
    expect(identity).toMatchObject({ name: "tryshift.eth", address: WALLET, primaryName: true, url: "https://tryshift.example", github: "shift-compute/shift", ledger: "matches" });
  });

  it("reports not_published while the ledger record is empty", async () => {
    expect((await readIdentity(reader(), LEDGER)).ledger).toBe("not_published");
  });

  it("is not the primary name when the reverse record points elsewhere", async () => {
    expect((await readIdentity(reader({ name: async () => "other.eth" }), LEDGER)).primaryName).toBe(false);
    expect((await readIdentity(reader({ name: async () => null }), LEDGER)).primaryName).toBe(false);
  });

  it("keeps working when one read fails, and never guesses the ledger status", async () => {
    const identity = await readIdentity(
      reader({
        address: async () => {
          throw new Error("rpc down");
        },
        text: async (_name, key) => {
          if (key === "shift.ledger") throw new Error("rpc down");
          return key === "url" ? "https://tryshift.example" : null;
        },
      }),
      LEDGER,
    );
    expect(identity).toMatchObject({ address: null, primaryName: false, url: "https://tryshift.example", ledger: "unavailable" });
  });

  it("does not look up a reverse name when the name does not resolve", async () => {
    let reverseCalls = 0;
    const identity = await readIdentity(
      reader({
        address: async () => null,
        name: async () => {
          reverseCalls += 1;
          return "tryshift.eth";
        },
      }),
      LEDGER,
    );
    expect(reverseCalls).toBe(0);
    expect(identity).toMatchObject({ address: null, primaryName: false });
  });
});

describe("ensAppUrl", () => {
  it("links to the ENS app page of the name", () => {
    expect(ensAppUrl("tryshift.eth")).toBe("https://app.ens.domains/tryshift.eth");
  });
});
