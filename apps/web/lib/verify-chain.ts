import { createPublicClient, defineChain, getAddress, http, type Hex, type PublicClient } from "viem";

/**
 * Read-only ShiftLedger surface used by the browser verifier (plan §15).
 * `nights` and `verifyLeaf` match `contracts/src/ShiftLedger.sol`.
 * The worker anchors with ethers; this page reads with viem and does not send a transaction.
 */
export const LEDGER_READ_ABI = [
  {
    type: "function",
    name: "nights",
    stateMutability: "view",
    inputs: [{ name: "nightId", type: "uint64" }],
    outputs: [
      { name: "root", type: "bytes32" },
      { name: "manifestRoot", type: "bytes32" },
      { name: "itemCount", type: "uint32" },
      { name: "anchoredAt", type: "uint64" },
      { name: "donationsRecorded", type: "bool" },
    ],
  },
  {
    type: "function",
    name: "verifyLeaf",
    stateMutability: "view",
    inputs: [
      { name: "nightId", type: "uint64" },
      { name: "proof", type: "bytes32[]" },
      { name: "leaf", type: "bytes32" },
    ],
    outputs: [{ name: "ok", type: "bool" }],
  },
] as const;

const ZERO_ROOT = `0x${"0".repeat(64)}` as Hex;
const BYTES32 = /^0x[0-9a-fA-F]{64}$/;

export interface ChainNight {
  root: Hex;
  manifestRoot: Hex;
  itemCount: number;
  anchoredAt: bigint;
  donationsRecorded: boolean;
}

/** What the page needs from a public RPC. Tests pass a fake; the browser uses `createLedgerReader`. */
export interface LedgerReader {
  readNight(nightId: bigint): Promise<ChainNight>;
  verifyLeaf(nightId: bigint, proof: readonly Hex[], leaf: Hex): Promise<boolean>;
  /** Block of the anchor transaction, when the night row stored one. */
  anchorBlock(txHash: Hex): Promise<bigint>;
}

export interface ChainCheckInput {
  nightId: bigint;
  /** Leaf hash recomputed in the browser, not the hash stored in the database. */
  leaf: Hex;
  proof: readonly string[];
  storedRoot: string | null;
  anchorTx: string | null;
}

export interface ChainVerdict {
  status: "confirmed" | "rejected" | "not_anchored" | "root_mismatch" | "unavailable";
  blockNumber: bigint | null;
  anchoredAt: bigint | null;
  chainRoot: Hex | null;
  /** `verifyLeaf` on the recomputed hash. Null when the RPC could not be read. */
  contractAccepted: boolean | null;
}

export function createLedgerReader(options: { chainId: number; rpcUrl: string; contractAddress: string }): LedgerReader {
  const address = getAddress(options.contractAddress);
  const chain = defineChain({
    id: options.chainId,
    name: "0G",
    nativeCurrency: { name: "0G", symbol: "0G", decimals: 18 },
    rpcUrls: { default: { http: [options.rpcUrl] } },
  });
  const client = createPublicClient({ chain, transport: http(options.rpcUrl, { timeout: 10_000 }) });
  return readerFromClient(client, address);
}

/**
 * Reads `nights(nightId)` and `verifyLeaf` on the public RPC.
 * A failed call is `unavailable`: the page still shows the leaf, and it does not invent a verdict.
 */
export async function checkOnChain(reader: LedgerReader, input: ChainCheckInput): Promise<ChainVerdict> {
  const proof = asProof(input.proof);
  const leaf = asBytes32(input.leaf);
  if (!proof || !leaf) return unavailable();
  try {
    const night = await reader.readNight(input.nightId);
    const contractAccepted = await reader.verifyLeaf(input.nightId, proof, leaf);
    const blockNumber = await readBlock(reader, input.anchorTx);
    return verdictFrom(night, contractAccepted, blockNumber, input.storedRoot);
  } catch {
    return unavailable();
  }
}

export function chainTitle(verdict: ChainVerdict): string {
  switch (verdict.status) {
    case "confirmed":
      return verdict.blockNumber === null
        ? "This result belongs to the anchored batch."
        : `This result belongs to the batch anchored in block ${verdict.blockNumber.toString()}.`;
    case "rejected":
      return "The contract did not accept this leaf for that night.";
    case "not_anchored":
      return "This night has no root on the contract yet.";
    case "root_mismatch":
      return "The root stored by Shift differs from the root on the contract.";
    case "unavailable":
      return "The chain check could not be read.";
  }
}

export function chainDetail(verdict: ChainVerdict): string {
  switch (verdict.status) {
    case "confirmed":
      return "ShiftLedger.verifyLeaf accepted the leaf hash recomputed in this browser.";
    case "rejected":
      return "The recomputed leaf hash and this proof do not match the root on ShiftLedger.";
    case "not_anchored":
      return "verifyLeaf stays false until the night is anchored.";
    case "root_mismatch":
      return "The on-chain root is the one ShiftLedger stored for this night.";
    case "unavailable":
      return "The public RPC did not answer. The leaf hash and the proof were still checked in this browser.";
  }
}

export function blockHref(explorerUrl: string, blockNumber: bigint): string {
  return `${explorerUrl.replace(/\/+$/, "")}/block/${blockNumber.toString()}`;
}

function readerFromClient(client: PublicClient, address: Hex): LedgerReader {
  return {
    async readNight(nightId) {
      const night = await client.readContract({ address, abi: LEDGER_READ_ABI, functionName: "nights", args: [nightId] });
      return {
        root: night[0],
        manifestRoot: night[1],
        itemCount: night[2],
        anchoredAt: night[3],
        donationsRecorded: night[4],
      };
    },
    async verifyLeaf(nightId, proof, leaf) {
      return client.readContract({
        address,
        abi: LEDGER_READ_ABI,
        functionName: "verifyLeaf",
        args: [nightId, [...proof], leaf],
      });
    },
    async anchorBlock(txHash) {
      const receipt = await client.getTransactionReceipt({ hash: txHash });
      return receipt.blockNumber;
    },
  };
}

function verdictFrom(night: ChainNight, contractAccepted: boolean, blockNumber: bigint | null, storedRoot: string | null): ChainVerdict {
  const chainRoot = night.root.toLowerCase() as Hex;
  const base = { blockNumber, anchoredAt: night.anchoredAt, chainRoot, contractAccepted };
  if (chainRoot === ZERO_ROOT || night.anchoredAt === 0n) return { ...base, status: "not_anchored" };
  if (storedRoot && storedRoot.toLowerCase() !== chainRoot) return { ...base, status: "root_mismatch" };
  return { ...base, status: contractAccepted ? "confirmed" : "rejected" };
}

async function readBlock(reader: LedgerReader, anchorTx: string | null): Promise<bigint | null> {
  const hash = asBytes32(anchorTx);
  if (!hash) return null;
  try {
    return await reader.anchorBlock(hash);
  } catch {
    return null;
  }
}

function asProof(proof: readonly string[]): Hex[] | null {
  const hashes: Hex[] = [];
  for (const item of proof) {
    const hash = asBytes32(item);
    if (!hash) return null;
    hashes.push(hash);
  }
  return hashes;
}

function asBytes32(value: string | null): Hex | null {
  if (!value || !BYTES32.test(value)) return null;
  return value.toLowerCase() as Hex;
}

/** Outer bound for the browser's contract read. A hung RPC must not stay on "loading". */
export const CHAIN_READ_TIMEOUT_MS = 12_000;

/** Same verdicts as {@link checkOnChain}. A read that does not settle becomes `unavailable`, not a confirmation. */
export async function settleChainCheck(reader: LedgerReader, input: ChainCheckInput, timeoutMs = CHAIN_READ_TIMEOUT_MS): Promise<ChainVerdict> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<ChainVerdict>((resolve) => {
    timer = setTimeout(() => resolve(unavailable()), timeoutMs);
  });
  try {
    return await Promise.race([checkOnChain(reader, input), timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function unavailable(): ChainVerdict {
  return { status: "unavailable", blockNumber: null, anchoredAt: null, chainRoot: null, contractAccepted: null };
}
