import { NextResponse, type NextRequest } from "next/server";
import { parseRequestId, VERIFY_LEAF_SELECT, VERIFY_TASK_SELECT, verifyBody } from "../../../../lib/verify-view";
import { getConfig, getDb } from "../../../../lib/server";

export const runtime = "nodejs";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Public verification data for one Router request id (plan §15, §17).
 * No session. The management key, the ephemeral key and the raw trace are not selected.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ requestId: string }> }) {
  const { requestId: raw } = await ctx.params;
  const requestId = parseRequestId(raw);
  if (!requestId) return json({ error: "invalid_request" }, 404);

  try {
    const db = getDb();
    const leaf = await db.merkleLeaf.findUnique({ where: { requestId }, select: VERIFY_LEAF_SELECT });
    if (!leaf) return json({ error: "not_found" }, 404);
    const tasks = await db.task.findMany({ where: { nightId: leaf.nightId }, select: VERIFY_TASK_SELECT });
    const config = getConfig();
    const body = verifyBody({
      requestId,
      leaf,
      tasks,
      chain: {
        chainId: config.ZG_CHAIN_ID,
        rpcUrl: config.ZG_CHAIN_RPC_URL,
        contractAddress: config.LEDGER_CONTRACT_ADDRESS,
        explorerUrl: config.ZG_EXPLORER_URL,
        storageIndexerUrl: config.ZG_STORAGE_INDEXER_URL,
      },
    });
    if (!body) return json({ error: "internal_error" }, 500);
    return json(body);
  } catch (err) {
    console.error("verify:", err instanceof Error ? err.name : "unknown error");
    return json({ error: "internal_error" }, 500);
  }
}
