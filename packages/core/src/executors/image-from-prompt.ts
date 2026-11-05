import { z } from "zod";
import { chatText, ExecutorOutputError, parseModelJson } from "./json-output";
import { recordStep } from "./step";
import { clientRequestId, type ExecutorContext, type ExecutorResult } from "./types";

const revisedSchema = z.object({ prompt: z.string().min(3).max(1500) });

export interface ImageResult {
  prompt: string;
  revisedPrompt: string;
  imageFile: string;
}

const SYSTEM_PROMPT =
  'You write prompts for an image generation model. Reply with only a JSON object: {"prompt": string}. ' +
  "Keep the user's idea, add concrete visual detail (subject, setting, light, style), at most 80 words, in English.";

/** Decodes the first image of an OpenAI-style response (`data[0].b64_json`) and identifies its format by magic bytes. */
export function imageFrom(data: unknown): { bytes: Uint8Array; mime: string; ext: string } {
  const b64 = (data as { data?: Array<{ b64_json?: unknown }> } | null)?.data?.[0]?.b64_json;
  if (typeof b64 !== "string" || b64.length === 0) throw new ExecutorOutputError("The image model returned no image data.");
  const bytes = new Uint8Array(Buffer.from(b64, "base64"));
  const at = (i: number) => bytes[i];
  if (at(0) === 0x89 && at(1) === 0x50 && at(2) === 0x4e && at(3) === 0x47) return { bytes, mime: "image/png", ext: "png" };
  if (at(0) === 0xff && at(1) === 0xd8) return { bytes, mime: "image/jpeg", ext: "jpg" };
  if (at(0) === 0x52 && at(1) === 0x49 && at(2) === 0x46 && at(3) === 0x46 && at(8) === 0x57) return { bytes, mime: "image/webp", ext: "webp" };
  throw new ExecutorOutputError("The image model returned data that is not an image.");
}

/** Step 1: expand the idea into a good prompt. Step 2: generate the image. */
export async function runImageFromPrompt(ctx: ExecutorContext, idea: string): Promise<ExecutorResult<ImageResult>> {
  const imageModel = ctx.models.image;
  if (!imageModel) throw new ExecutorOutputError("No image model was chosen for this task.");

  const chat = await ctx.router.chat(
    ctx.sk,
    {
      model: ctx.models.chat,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: idea },
      ],
    },
    { trustMode: ctx.trustMode, clientRequestId: clientRequestId(ctx, "refine") },
  );
  const revisedPrompt = parseModelJson(revisedSchema, chatText(chat.data)).prompt;

  const image = await ctx.router.generateImage(
    ctx.sk,
    { model: imageModel, prompt: revisedPrompt, n: 1, response_format: "b64_json" },
    { trustMode: ctx.trustMode, clientRequestId: clientRequestId(ctx, "image") },
  );
  const picture = imageFrom(image.data);
  const imageFile = `image.${picture.ext}`;

  return {
    result: { prompt: idea, revisedPrompt, imageFile },
    files: [{ name: imageFile, mime: picture.mime, bytes: picture.bytes }],
    steps: [recordStep("refine", ctx.models.chat, chat), recordStep("image", imageModel, image)],
  };
}
