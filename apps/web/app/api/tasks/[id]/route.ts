import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "../../../../lib/server";
import { getCurrentUser } from "../../../../lib/session";
import { taskView } from "../../../../lib/task-view";
import { deleteUpload } from "../../../../lib/uploads";

export const runtime = "nodejs";

/** Cancels a task that has not started yet. Running or finished tasks are left alone. */
export async function DELETE(_req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const { id } = await ctx.params;

  const db = getDb();
  // The status check lives in the update itself so a worker picking the task up at the same moment wins cleanly.
  const result = await db.task.updateMany({
    where: { id, userId: user.id, status: { in: ["QUEUED", "PLANNED", "DEFERRED"] } },
    data: { status: "CANCELLED" },
  });
  if (result.count === 0) {
    const exists = await db.task.findFirst({ where: { id, userId: user.id }, select: { status: true } });
    if (!exists) return NextResponse.json({ error: "not_found" }, { status: 404 });
    return NextResponse.json({ error: "not_cancellable", message: `This task is ${exists.status.toLowerCase()}.` }, { status: 409 });
  }

  const task = await db.task.findUniqueOrThrow({ where: { id } });
  if (task.inputPath) await deleteUpload(task.inputPath).catch(() => undefined);
  return NextResponse.json(taskView(task));
}
