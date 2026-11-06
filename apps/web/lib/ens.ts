import { createPublicClient, getAddress, http, isAddress } from "viem";
import { mainnet } from "viem/chains";
import { normalize } from "viem/ens";

/** Name the team registered for the hackathon. ENS lives on Ethereum mainnet, not on 0G. */
export const ENS_NAME = "tryshift.eth";
export const ENS_DEFAULT_RPC = "https://ethereum-rpc.publicnode.com";
/** Custom text record the team sets on the name: `eip155:<chainId>:<ShiftLedger address>`. */
export const LEDGER_RECORD_KEY = "shift.ledger";

/** What the page needs from ENS. Tests pass a fake; the server uses `createEnsReader`. */
export interface EnsReader {
  address(name: string): Promise<string | null>;
  name(address: string): Promise<string | null>;
  text(name: string, key: string): Promise<string | null>;
}

export type LedgerLinkStatus = "matches" | "differs" | "not_published" | "unavailable";

export interface EnsIdentity {
  name: string;
  /** Address the name resolves to on mainnet. Null when the name did not resolve or the RPC failed. */
  address: string | null;
  /** True when the address's primary (reverse) name is this name. */
  primaryName: boolean;
  url: string | null;
  github: string | null;
  /** Raw `shift.ledger` record, shown as published. */
  ledgerRecord: string | null;
  ledger: LedgerLinkStatus;
}

export interface LedgerRef {
  chainId: number;
  address: string;
}

/** Uses the Universal Resolver, which reads the current ENS registry (ENS v2 names included). */
export function createEnsReader(rpcUrl: string = ENS_DEFAULT_RPC): EnsReader {
  const client = createPublicClient({ chain: mainnet, transport: http(rpcUrl) });
  return {
    async address(name) {
      return (await client.getEnsAddress({ name: normalize(name) })) ?? null;
    },
    async name(address) {
      return (await client.getEnsName({ address: getAddress(address) })) ?? null;
    },
    async text(name, key) {
      return (await client.getEnsText({ name: normalize(name), key })) ?? null;
    },
  };
}

/** Parses `eip155:<chainId>:<address>`. Anything else is not a ledger reference. */
export function parseLedgerRecord(value: string | null): LedgerRef | null {
  const match = /^eip155:(\d+):(0x[0-9a-fA-F]{40})$/.exec((value ?? "").trim());
  if (!match) return null;
  const chainId = Number(match[1]);
  if (!Number.isSafeInteger(chainId) || chainId <= 0 || !isAddress(match[2]!, { strict: false })) return null;
  return { chainId, address: match[2]!.toLowerCase() };
}

export function compareLedger(record: string | null, actual: LedgerRef): LedgerLinkStatus {
  if (record === null || record.trim() === "") return "not_published";
  const ref = parseLedgerRecord(record);
  if (!ref) return "differs";
  return ref.chainId === actual.chainId && ref.address === actual.address.toLowerCase() ? "matches" : "differs";
}

async function attempt<T>(read: () => Promise<T | null>): Promise<{ ok: boolean; value: T | null }> {
  try {
    return { ok: true, value: await read() };
  } catch {
    return { ok: false, value: null };
  }
}

/**
 * Reads the team's ENS name. Every read is independent: one failed call leaves that field null and the
 * others intact. If the address read fails, the ledger status is `unavailable` instead of a guess.
 */
export async function readIdentity(reader: EnsReader, ledger: LedgerRef, name: string = ENS_NAME): Promise<EnsIdentity> {
  const [address, record, url, github] = await Promise.all([
    attempt(() => reader.address(name)),
    attempt(() => reader.text(name, LEDGER_RECORD_KEY)),
    attempt(() => reader.text(name, "url")),
    attempt(() => reader.text(name, "com.github")),
  ]);
  const reverse = address.value ? await attempt(() => reader.name(address.value!)) : { ok: true, value: null };
  return {
    name,
    address: address.value,
    primaryName: reverse.value?.toLowerCase() === name.toLowerCase(),
    url: url.value,
    github: github.value,
    ledgerRecord: record.value,
    ledger: record.ok ? compareLedger(record.value, ledger) : "unavailable",
  };
}

export function ensAppUrl(name: string): string {
  return `https://app.ens.domains/${encodeURIComponent(name)}`;
}
