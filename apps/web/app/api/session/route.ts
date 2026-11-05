import { NextResponse } from "next/server";
import { getCurrentUser } from "../../../lib/session";
import { userView } from "../../../lib/user-view";

export const runtime = "nodejs";

/** Who is signed in. Never includes the management key or anything derived from it. */
export async function GET() {
  const user = await getCurrentUser();
  return NextResponse.json(user ? userView(user) : { connected: false });
}
