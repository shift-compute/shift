import { NextResponse, type NextRequest } from "next/server";
import { parseNightId } from "../../../../lib/night-id";
import { nightResultsBody, NIGHT_PUBLIC_SELECT, NIGHT_RUN_SPEND_SELECT, NIGHT_TASK_SELECT } from "../../../../lib/night-view";
import { getConfig, getDb } from "../../../../lib/server";
import { getCurrentUser } from "../../../../lib/session";

export const runtime = "nodejs";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * One night (plan §17, §18.1). The merkle root, manifest root and anchor transaction are public.
 * Task steps and the credit/deposit split belong to the signed-in user only.
 * The management key, the ephemeral key and the vault ciphertext are never selected.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const nightId = parseNightId(id);
  if (!nightId) return json({ error: "invalid_night" }, 404);

  try {
    const user = await getCurrentUser();
    const db = getDb();
    const night = await db.night.findUnique({ where: { id: nightId }, select: NIGHT_PUBLIC_SELECT });
    if (!night) return json({ night: null, signedIn: user !== null });
    if (!user) {
      return json(nightResultsBody({ night, signedIn: false, explorerUrl: explorerUrl(), currency: "", run: null, tasks: [] }));
    }

    const [run, tasks] = await Promise.all([
      db.nightRun.findUnique({ where: { nightId_userId: { nightId, userId: user.id } }, select: NIGHT_RUN_SPEND_SELECT }),
      db.task.findMany({ where: { userId: user.id, nightId }, orderBy: { createdAt: "asc" }, select: NIGHT_TASK_SELECT }),
    ]);
    return json(
      nightResultsBody({
        night,
        signedIn: true,
        explorerUrl: explorerUrl(),
        currency: user.currency,
        run,
        tasks,
      }),
    );
  } catch (err) {
    console.error("night results:", err instanceof Error ? err.name : "unknown error");
    return json({ error: "internal_error" }, 500);
  }
}

function explorerUrl(): string {
  return getConfig().ZG_EXPLORER_URL;
}
