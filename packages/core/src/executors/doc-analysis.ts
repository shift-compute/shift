import { z } from "zod";
import type { DocText } from "./doc-text";
import { chatText, parseModelJson } from "./json-output";
import { recordStep } from "./step";
import { clientRequestId, type ExecutorContext, type ExecutorResult } from "./types";

export const docAnalysisSchema = z.object({
  summary: z.string().min(1),
  actionItems: z.array(z.string()).default([]),
  risks: z.array(z.string()).default([]),
});

export interface DocAnalysisResult {
  summary: string;
  actionItems: string[];
  risks: string[];
  /** True when the document was longer than what was sent to the model. */
  truncated: boolean;
  chars: number;
}

const SYSTEM_PROMPT =
  'You analyze documents. Reply with only a JSON object: {"summary": string, "actionItems": string[], "risks": string[]}. ' +
  "The summary is at most 150 words. actionItems are concrete next steps; risks are problems or open questions. " +
  "Use empty arrays when there are none. Write in the language of the document.";

/** One chat call over text already extracted on the server (see doc-text.ts). */
export async function runDocAnalysis(ctx: ExecutorContext, doc: DocText): Promise<ExecutorResult<DocAnalysisResult>> {
  const chat = await ctx.router.chat(
    ctx.sk,
    {
      model: ctx.models.chat,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: doc.text },
      ],
    },
    { trustMode: ctx.trustMode, clientRequestId: clientRequestId(ctx, "analyze") },
  );
  const parsed = parseModelJson(docAnalysisSchema, chatText(chat.data));
  return {
    result: { ...parsed, truncated: doc.truncated, chars: doc.chars },
    files: [],
    steps: [recordStep("analyze", ctx.models.chat, chat, ctx.trustMode)],
  };
}
