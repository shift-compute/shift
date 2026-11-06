import { RouterError, VaultError, previewTonight, prismaPipelineStore } from "@shift/core";
import { NextResponse } from "next/server";
import { previewCatalogCache } from "../../../../lib/preview-cache";
import { getConfig, getDb, getRouter } from "../../../../lib/server";
import { getCurrentUser } from "../../../../lib/session";
import { openUserKey } from "../../../../lib/user-key";

export const runtime = "nodejs";

const STATUS = {
  empty_queue: 409,
  no_rate: 409,
  below_minimum: 409,
  missing_cap: 409,
  unreadable_balance: 502,
  unsupported_currency: 422,
} as const;

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
}

/**
 * Tonight's estimate (plan §10.4, §17). Live balance and catalog prices, then the same optimizer as the night.
 * Does not create a key, classify complexity, or execute a task. The management key is used only to read the balance.
 */
export async function GET() {
  const user = await getCurrentUser();
  if (!user) return json({ error: "not_signed_in" }, 401);

  let mk: string | null;
  try {
    mk = openUserKey(user);
  } catch (err) {
    // A ciphertext that will not open is a dead connection. A config failure is not.
    if (err instanceof VaultError) return json({ error: "connection_invalid" }, 401);
    console.error("plan preview key:", err instanceof Error ? err.name : "unknown error");
    return json({ error: "internal_error" }, 500);
  }
  if (!mk) return json({ error: "connection_invalid" }, 401);

  const tasks = await prismaPipelineStore(getDb()).openTasks(user.id);
  if (tasks.length === 0) return json({ error: "empty_queue", message: "Nothing is waiting for tonight." }, STATUS.empty_queue);

  try {
    const outcome = await previewTonight({
      tasks,
      account: { mode: user.mode, nightlyBudgetUsdMicro: user.nightlyBudgetUsdMicro },
      mk,
      router: getRouter(),
      marginPct: getConfig().SAFETY_MARGIN_PCT,
      catalogCache: previewCatalogCache,
      nowMs: Date.now(),
    });
    if (!outcome.ok) return json({ error: outcome.error, message: outcome.message }, STATUS[outcome.error]);
    return json(outcome.preview);
  } catch (err) {
    if (err instanceof RouterError) {
      if (err.kind === "invalid_api_key" || err.kind === "api_key_revoked") return json({ error: "connection_invalid" }, 401);
      return json({ error: "router_unavailable", kind: err.kind }, 502);
    }
    console.error("plan preview failed:", err instanceof Error ? err.name : "unknown error");
    return json({ error: "internal_error" }, 500);
  }
}
