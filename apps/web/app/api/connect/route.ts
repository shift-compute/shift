import { connectAccount, createRateLimiter, RouterError, sweepOrphanedKeys } from "@shift/core";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getConfig, getDb, getRouter } from "../../../lib/server";
import { getCurrentUser, getSession } from "../../../lib/session";
import { openUserKey } from "../../../lib/user-key";

export const runtime = "nodejs";

// 5 attempts per minute per IP (plan §19.5).
const limiter = createRateLimiter(5, 60_000);
const body = z.object({ mk: z.string().min(1).max(512) });

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

/**
 * Connects a 0G account with the user's management key.
 * The key is validated, encrypted and stored; it is never logged and never returned.
 */
export async function POST(req: NextRequest) {
  const limit = limiter.check(clientIp(req));
  if (!limit.allowed) {
    return NextResponse.json({ error: "rate_limited", retryAfterSeconds: limit.retryAfterSeconds }, { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } });
  }

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "invalid_request" }, { status: 400 });

  try {
    const result = await connectAccount(getRouter(), parsed.data.mk.trim(), getConfig().SHIFT_MASTER_KEY);

    if (!result.ok) {
      if (result.reason === "missing_scopes") {
        return NextResponse.json({ error: "missing_scopes", missingScopes: result.missingScopes, leftoverKeyId: result.leftoverKeyId ?? null }, { status: 403 });
      }
      const status = result.reason === "invalid_format" ? 400 : 401;
      return NextResponse.json({ error: result.reason === "invalid_format" ? "invalid_key_format" : "invalid_key" }, { status });
    }

    const { account, sealed } = result;
    const secret = { mkCiphertext: sealed.ciphertext, mkIv: sealed.iv, mkAuthTag: sealed.authTag, mkConnectedAt: new Date(), currency: account.currency };
    const user = await getDb().user.upsert({
      where: { accountAddress: account.address.toLowerCase() },
      create: { accountAddress: account.address.toLowerCase(), ...secret },
      update: secret,
    });

    const session = await getSession();
    session.userId = user.id;
    await session.save();

    return NextResponse.json({
      connected: true,
      userId: user.id,
      account: { address: account.address, currency: account.currency, creditBalance: account.creditBalance, depositBalance: account.depositBalance },
      mode: user.mode,
    });
  } catch (err) {
    if (err instanceof RouterError) {
      // Router or network trouble: say so, but never echo upstream details that could carry anything sensitive.
      return NextResponse.json({ error: "router_unavailable", kind: err.kind }, { status: 502 });
    }
    console.error("connect failed:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}

/**
 * Disconnects the signed-in user: revokes any ephemeral key still alive (it cannot be revoked once the management key is gone),
 * deletes the encrypted management key and ends the session. The user is reminded to revoke the key in the 0G console too.
 */
export async function DELETE() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const db = getDb();
  const mk = openUserKey(user);
  let unrevokedKeyIds: string[] = [];
  if (mk) {
    const alive = await db.nightRun.findMany({ where: { userId: user.id, ephemeralKeyId: { not: null }, keyRevokedAt: null } });
    const report = await sweepOrphanedKeys(
      getRouter(),
      alive.map((r) => ({ keyId: r.ephemeralKeyId as string, mk, createdAt: r.keyCreatedAt ?? new Date(0) })),
      { minAgeMs: 0 },
    );
    if (report.revoked.length > 0) {
      await db.nightRun.updateMany({ where: { userId: user.id, ephemeralKeyId: { in: report.revoked } }, data: { keyRevokedAt: new Date() } });
    }
    unrevokedKeyIds = report.failed.map((f) => f.keyId);
  }

  await db.user.update({ where: { id: user.id }, data: { mkCiphertext: null, mkIv: null, mkAuthTag: null, mkConnectedAt: null } });
  (await getSession()).destroy();

  return NextResponse.json({
    disconnected: true,
    unrevokedKeyIds,
    reminder: "Shift no longer stores your management key. Revoke it under Settings → Management Keys in the 0G console to finish.",
  });
}
