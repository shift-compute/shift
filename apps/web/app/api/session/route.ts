import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/session";

export const runtime = "nodejs";

/** Who is signed in. Never includes the management key or anything derived from it. */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ connected: false });
  return NextResponse.json({
    connected: user.mkCiphertext !== null,
    account: { address: user.accountAddress, currency: user.currency },
    mode: user.mode,
    donateLeftover: user.donateLeftover,
    nightlyBudgetUsdMicro: user.nightlyBudgetUsdMicro === null ? null : user.nightlyBudgetUsdMicro.toString(),
  });
}
