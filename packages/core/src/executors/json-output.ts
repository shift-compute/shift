import type { z } from "zod";

export class ExecutorOutputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExecutorOutputError";
  }
}

/** Models often wrap JSON in a code fence or add a sentence around it. Pulls out the first JSON object. */
export function extractJsonObject(text: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  const candidate = fenced?.[1] ?? text;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ExecutorOutputError("The model did not return a JSON object.");
  try {
    return JSON.parse(candidate.slice(start, end + 1));
  } catch {
    throw new ExecutorOutputError("The model returned JSON that could not be parsed.");
  }
}

/** Parses a chat reply into the shape a task promises, or fails with a message that names what was wrong. */
export function parseModelJson<S extends z.ZodType>(schema: S, text: string): z.infer<S> {
  const checked = schema.safeParse(extractJsonObject(text));
  if (!checked.success) {
    throw new ExecutorOutputError(`The model's answer was missing fields: ${checked.error.issues.map((i) => i.path.join(".") || "(root)").join(", ")}.`);
  }
  return checked.data;
}

export function chatText(reply: { choices: Array<{ message: { content?: string | null | undefined } }> }): string {
  const content = reply.choices[0]?.message.content;
  if (!content) throw new ExecutorOutputError("The model returned an empty answer.");
  return content;
}
