import { z } from "zod";
import { chatText, ExecutorOutputError, parseModelJson } from "./json-output";
import { recordStep } from "./step";
import { clientRequestId, type ExecutorContext, type ExecutorResult } from "./types";

export const audioSummarySchema = z.object({
  summary: z.string().min(1),
  keyPoints: z.array(z.string()).default([]),
});

export interface AudioSummaryResult {
  transcript: string;
  summary: string;
  keyPoints: string[];
}

export interface AudioInput {
  bytes: Uint8Array;
  fileName: string;
  mime: string;
}

const SYSTEM_PROMPT =
  'You summarize transcripts. Reply with only a JSON object: {"summary": string, "keyPoints": string[]}. ' +
  "The summary is at most 120 words. keyPoints has 3 to 7 short items. Write in the language of the transcript.";

/** Reads the transcript out of a transcription response; verbose_json and json both carry `text`. */
export function transcriptFrom(data: unknown): string {
  const text = (data as { text?: unknown } | null)?.text;
  if (typeof text !== "string" || text.trim().length === 0) throw new ExecutorOutputError("The transcription came back empty.");
  return text.trim();
}

/** Step 1: speech to text. Step 2: summary and key points from the transcript. */
export async function runAudioSummary(ctx: ExecutorContext, input: AudioInput): Promise<ExecutorResult<AudioSummaryResult>> {
  const sttModel = ctx.models.transcribe;
  if (!sttModel) throw new ExecutorOutputError("No transcription model was chosen for this task.");

  const form = new FormData();
  form.set("model", sttModel);
  form.set("response_format", "verbose_json");
  form.set("file", new Blob([input.bytes as BlobPart], { type: input.mime }), input.fileName);
  const stt = await ctx.router.transcribe(ctx.sk, form, { trustMode: ctx.trustMode, clientRequestId: clientRequestId(ctx, "transcribe") });
  const transcript = transcriptFrom(stt.data);

  const chat = await ctx.router.chat(
    ctx.sk,
    {
      model: ctx.models.chat,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: transcript },
      ],
    },
    { trustMode: ctx.trustMode, clientRequestId: clientRequestId(ctx, "summarize") },
  );
  const parsed = parseModelJson(audioSummarySchema, chatText(chat.data));

  return {
    result: { transcript, summary: parsed.summary, keyPoints: parsed.keyPoints },
    files: [],
    steps: [recordStep("transcribe", sttModel, stt), recordStep("summarize", ctx.models.chat, chat)],
  };
}
