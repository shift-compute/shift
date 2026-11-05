import { checkUpload, imagePromptSchema, priorityEnum, TASK_TYPES, type TaskTypeName } from "@shift/core";
import { NextResponse, type NextRequest } from "next/server";
import { getDb } from "../../../lib/server";
import { getCurrentUser } from "../../../lib/session";
import { taskView } from "../../../lib/task-view";
import { deleteUpload, saveUpload } from "../../../lib/uploads";

export const runtime = "nodejs";

/** A user can hold this many open tasks; it bounds disk use and the night's planning work. */
const MAX_OPEN_TASKS = 50;
const OPEN = ["QUEUED", "PLANNED", "DEFERRED"] as const;

export async function GET() {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });
  const tasks = await getDb().task.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  return NextResponse.json({ tasks: tasks.map(taskView) });
}

/** Adds a task. Audio and documents arrive as multipart form data; image tasks carry a text prompt. */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "not_signed_in" }, { status: 401 });

  const form = await req.formData().catch(() => null);
  if (!form) return NextResponse.json({ error: "invalid_form" }, { status: 400 });

  const type = form.get("type");
  if (typeof type !== "string" || !(TASK_TYPES as readonly string[]).includes(type)) {
    return NextResponse.json({ error: "invalid_type", message: `type must be one of ${TASK_TYPES.join(", ")}.` }, { status: 400 });
  }
  const taskType = type as TaskTypeName;

  const db = getDb();
  const open = await db.task.count({ where: { userId: user.id, status: { in: [...OPEN] } } });
  if (open >= MAX_OPEN_TASKS) {
    return NextResponse.json({ error: "queue_full", message: `You already have ${MAX_OPEN_TASKS} tasks waiting.` }, { status: 429 });
  }

  if (taskType === "IMAGE_FROM_PROMPT") {
    const parsed = imagePromptSchema.safeParse({ prompt: form.get("prompt"), priority: form.get("priority") ?? undefined });
    if (!parsed.success) {
      return NextResponse.json({ error: "invalid_task", problems: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`) }, { status: 400 });
    }
    const task = await db.task.create({ data: { userId: user.id, type: taskType, prompt: parsed.data.prompt, priority: parsed.data.priority } });
    return NextResponse.json(taskView(task), { status: 201 });
  }

  const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "missing_file", message: "Attach a file." }, { status: 400 });
  const priority = priorityEnum.default(2).safeParse(form.get("priority") ?? undefined);
  if (!priority.success) return NextResponse.json({ error: "invalid_priority", message: "Priority must be 1, 2 or 3." }, { status: 400 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkUpload(taskType, file.name, bytes);
  if (!check.ok) return NextResponse.json({ error: check.error, message: check.message }, { status: check.error === "file_too_large" ? 413 : 400 });

  const inputPath = await saveUpload(user.id, check.ext, bytes);
  try {
    const task = await db.task.create({
      data: { userId: user.id, type: taskType, priority: priority.data, inputPath, inputMeta: { bytes: bytes.byteLength, mime: check.mime } },
    });
    return NextResponse.json(taskView(task), { status: 201 });
  } catch (err) {
    await deleteUpload(inputPath).catch(() => undefined);
    throw err;
  }
}
