import { NextResponse } from "next/server";
import { createEnsReader, ENS_DEFAULT_RPC, readIdentity, type EnsIdentity } from "../../../lib/ens";
import { getConfig } from "../../../lib/server";

export const runtime = "nodejs";

const TTL_MS = 5 * 60_000;
let cached: { at: number; key: string; identity: EnsIdentity } | undefined;

/**
 * The team's ENS name as read live from Ethereum mainnet, cross-checked with the configured ShiftLedger.
 * Public and read-only. The result is cached for five minutes so the page does not hit the RPC on every view.
 */
export async function GET() {
  try {
    const config = getConfig();
    const ledger = { chainId: config.ZG_CHAIN_ID, address: config.LEDGER_CONTRACT_ADDRESS };
    const key = `${ledger.chainId}:${ledger.address.toLowerCase()}`;
    if (cached && cached.key === key && Date.now() - cached.at < TTL_MS) return NextResponse.json(cached.identity);

    const rpc = process.env["ENS_RPC_URL"] || ENS_DEFAULT_RPC;
    const identity = await readIdentity(createEnsReader(rpc), ledger);
    // A name that did not resolve may be an RPC hiccup: do not cache it for five minutes.
    if (identity.address) cached = { at: Date.now(), key, identity };
    return NextResponse.json(identity, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    console.error("identity:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json({ error: "internal_error" }, { status: 500, headers: { "Cache-Control": "no-store" } });
  }
}
