import { spendingSettingsSchema, toUserUpdate } from "@shift/core";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "../../../lib/server";
import { getCurrentUser } from "../../../lib/session";
import { userView } from "../../../lib/user-view";

export const runtime = "nodejs";

/** Changes how Shift spends: iAI (credits only) or budget mode, the nightly cap, and donating leftovers. */
export async function PATCH(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const parsed = spendingSettingsSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "invalid_settings", problems: parsed.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`) }, { status: 400 });
  }

  const updated = await getDb().user.update({ where: { id: user.id }, data: toUserUpdate(parsed.data) });
  return NextResponse.json(userView(updated));
}
