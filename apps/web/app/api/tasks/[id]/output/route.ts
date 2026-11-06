import { openStoredTaskOutput, OutputSealError } from "@shift/core";
import { NextResponse, type NextRequest } from "next/server";
import { StorageKeyError } from "../../../../../lib/operator-key";
import { getConfig, getDb, getStorage } from "../../../../../lib/server";
import { getCurrentUser } from "../../../../../lib/session";

export const runtime = "nodejs";

function json(body: unknown, status = 200): NextResponse {
  return NextResponse.json(body, { status, headers: { "Cache-Control": "private, no-store" } });
}

/**
 * Downloads this task's 0G Storage root, decrypts it, and returns the result.
 * The row must belong to the signed-in user. Anyone else gets 404, including a caller who only knows the root.
 * The indexer file stays ciphertext; this response is the plaintext and is not cached.
 */
export async function GET(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return json({ error: "not_signed_in" }, 401);
  const { id } = await ctx.params;
  if (!id || id.length > 200) return json({ error: "not_found" }, 404);

  try {
    const task = await getDb().task.findFirst({
      where: { id, userId: user.id },
      select: { id: true, outputRoot: true },
    });
    if (!task?.outputRoot) return json({ error: "not_found" }, 404);

    const storage = await getStorage();
    const opened = await openStoredTaskOutput(storage, task.outputRoot, {
      masterKey: getConfig().SHIFT_MASTER_KEY,
      accountAddress: user.accountAddress,
    });
    if (opened.taskId !== task.id) return json({ error: "not_found" }, 404);
    return json(opened);
  } catch (err) {
    if (err instanceof OutputSealError) return json({ error: "cannot_decrypt" }, 403);
    if (err instanceof StorageKeyError) return json({ error: "storage_unconfigured" }, 503);
    console.error("task output:", err instanceof Error ? err.name : "unknown error");
    return json({ error: "internal_error" }, 500);
  }
}
