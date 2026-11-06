import { NextResponse } from "next/server";
import { COMMONS_DONATION_SELECT, COMMONS_ITEM_SELECT, COMMONS_LIST_LIMIT, commonsBody } from "../../../lib/commons-view";
import { getDb } from "../../../lib/server";

export const runtime = "nodejs";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Accepted and rejected commons translations, plus donation totals (plan §17, §18.1).
 * Public. The management key, the ephemeral key and the vault ciphertext are never selected.
 */
export async function GET(): Promise<NextResponse> {
  try {
    const db = getDb();
    const [items, donations] = await Promise.all([
      db.commonsItem.findMany({
        where: { status: { in: ["ACCEPTED", "REJECTED"] } },
        orderBy: { updatedAt: "desc" },
        take: COMMONS_LIST_LIMIT,
        select: COMMONS_ITEM_SELECT,
      }),
      db.nightRun.findMany({
        where: { donatedUsdMicro: { gt: 0 } },
        select: COMMONS_DONATION_SELECT,
      }),
    ]);
    return json(commonsBody({ items, donations }));
  } catch (err) {
    console.error("commons:", err instanceof Error ? err.name : "unknown error");
    return json({ error: "internal_error" }, 500);
  }
}
