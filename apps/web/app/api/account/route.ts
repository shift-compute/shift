import { RouterError } from "@shift/core";
import { NextResponse } from "next/server";
import { getRouter } from "../../../lib/server";
import { getCurrentUser } from "../../../lib/session";
import { openUserKey } from "../../../lib/user-key";

export const runtime = "nodejs";

/** Live balance of the signed-in user's 0G account, read with their management key. Returns numbers only. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const mk = await openUserKey(user);
  if (!mk) return NextResponse.json({ error: "not_connected" }, { status: 409 });

  try {
    const router = getRouter();
    const [balance, funds] = await Promise.all([router.getBalance(mk), router.getFunds(mk)]);
    return NextResponse.json({
      address: balance.data.address,
      currency: balance.data.currency,
      balance: {
        credit: balance.data.credit_balance,
        deposit: balance.data.deposit_balance,
        pendingCharge: balance.data.pending_charge,
        total: balance.data.total_balance,
      },
      funds: { total: funds.data.total, paymentLayer: funds.data.payment_layer?.balance ?? null },
    });
  } catch (err) {
    if (err instanceof RouterError) {
      // A revoked or invalid key means the connection is dead and the user must reconnect.
      if (err.kind === "invalid_api_key" || err.kind === "api_key_revoked") return NextResponse.json({ error: "connection_invalid" }, { status: 401 });
      return NextResponse.json({ error: "router_unavailable", kind: err.kind }, { status: 502 });
    }
    console.error("account failed:", err instanceof Error ? err.name : "unknown error");
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
