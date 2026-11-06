import { describe, expect, it, vi } from "vitest";
import { imageFrom, runImageFromPrompt } from "./image-from-prompt";
import { ExecutorOutputError } from "./json-output";
import type { ExecutorContext } from "./types";

const PNG_B64 = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]).toString("base64");

describe("imageFrom", () => {
  it("decodes png, jpeg and webp by their magic bytes", () => {
    expect(imageFrom({ data: [{ b64_json: PNG_B64 }] })).toMatchObject({ mime: "image/png", ext: "png" });
    expect(imageFrom({ data: [{ b64_json: Buffer.from([0xff, 0xd8, 0xff]).toString("base64") }] })).toMatchObject({ mime: "image/jpeg" });
    const webp = Buffer.concat([Buffer.from("RIFF"), Buffer.alloc(4), Buffer.from("WEBP")]).toString("base64");
    expect(imageFrom({ data: [{ b64_json: webp }] })).toMatchObject({ mime: "image/webp" });
  });

  it("rejects missing data and non-image bytes", () => {
    expect(() => imageFrom({ data: [] })).toThrow(/no image data/);
    expect(() => imageFrom(null)).toThrow(/no image data/);
    expect(() => imageFrom({ data: [{ b64_json: Buffer.from("hello world").toString("base64") }] })).toThrow(/not an image/);
  });
});

describe("runImageFromPrompt", () => {
  const make = (generateImage: ReturnType<typeof vi.fn>, models: ExecutorContext["models"]) => {
    const chat = vi.fn().mockResolvedValue({ data: { choices: [{ message: { content: '{"prompt":"A lighthouse at dusk, warm light, oil painting"}' } }] }, status: 200, requestId: "req-chat" });
    const ctx: ExecutorContext = { router: { chat, generateImage } as unknown as ExecutorContext["router"], sk: "sk-x", models, trustMode: "private", taskId: "t3", attempt: 1 };
    return { ctx, chat };
  };

  it("refines the idea, generates the image and returns it as a file", async () => {
    const generateImage = vi.fn().mockResolvedValue({ data: { data: [{ b64_json: PNG_B64 }] }, status: 200, requestId: "req-img" });
    const { ctx, chat } = make(generateImage, { chat: "chat-m", image: "img-m" });
    const out = await runImageFromPrompt(ctx, "a lighthouse");

    expect(out.result).toEqual({ prompt: "a lighthouse", revisedPrompt: "A lighthouse at dusk, warm light, oil painting", imageFile: "image.png" });
    expect(out.files).toHaveLength(1);
    expect(out.files[0]).toMatchObject({ name: "image.png", mime: "image/png" });
    expect(out.steps.map((s) => [s.step, s.model, s.requestId])).toEqual([
      ["refine", "chat-m", "req-chat"],
      ["image", "img-m", "req-img"],
    ]);
    expect(generateImage.mock.calls[0]![1]).toMatchObject({ model: "img-m", prompt: "A lighthouse at dusk, warm light, oil painting", response_format: "b64_json" });
    expect(chat.mock.calls[0]![1].max_tokens).toBe(200);
    expect(generateImage.mock.calls[0]![2]).toEqual({ trustMode: "private", clientRequestId: "t3-1-image" });
  });

  it("needs an image model and spends nothing without one", async () => {
    const generateImage = vi.fn();
    const { ctx, chat } = make(generateImage, { chat: "chat-m" });
    await expect(runImageFromPrompt(ctx, "x y z")).rejects.toThrow(/image model/);
    expect(chat).not.toHaveBeenCalled();
  });

  it("reads a Router image response and ignores a sibling url", async () => {
    const generateImage = vi.fn().mockResolvedValue({
      data: { created: 1677652288, data: [{ b64_json: PNG_B64, revised_prompt: "unused", url: "https://example.invalid/a.png" }] },
      status: 200,
      requestId: "req-img",
    });
    const { ctx } = make(generateImage, { chat: "chat-m", image: "img-m" });
    const out = await runImageFromPrompt(ctx, "a lighthouse");
    expect(out.result.imageFile).toBe("image.png");
    expect(out.files[0]).toMatchObject({ mime: "image/png" });
    expect(Buffer.from(out.files[0]!.bytes).subarray(0, 4)).toEqual(Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  });

  it("rejects partial image bodies and a refine step that is not a prompt", async () => {
    const leaked = "sk-abcdefghijklmnopqrstuvwxyz012345";
    const generateImage = vi.fn().mockResolvedValue({ data: { created: 1677652288, data: [{ url: "https://example.invalid/a.png" }] }, status: 200, requestId: "req-img" });
    const { ctx } = make(generateImage, { chat: "chat-m", image: "img-m" });
    await expect(runImageFromPrompt(ctx, "a lighthouse")).rejects.toBeInstanceOf(ExecutorOutputError);

    generateImage.mockResolvedValue({ data: { created: 1677652288 }, status: 200 });
    await expect(runImageFromPrompt(ctx, "a lighthouse")).rejects.toThrow(/no image data/);

    generateImage.mockClear();
    ctx.router.chat = vi.fn().mockResolvedValue({
      data: { id: "chatcmpl-1", object: "chat.completion", choices: [{ message: { content: `{"prompt":"no"} key ${leaked}` } }] },
      status: 200,
    }) as unknown as ExecutorContext["router"]["chat"];
    try {
      await runImageFromPrompt(ctx, "a lighthouse");
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ExecutorOutputError);
      expect(String(err)).not.toContain(leaked);
    }
    expect(generateImage).not.toHaveBeenCalled();

    ctx.router.chat = vi.fn().mockResolvedValue({ data: { choices: [{ finish_reason: "length" }] }, status: 200 }) as unknown as ExecutorContext["router"]["chat"];
    await expect(runImageFromPrompt(ctx, "a lighthouse")).rejects.toBeInstanceOf(ExecutorOutputError);
    expect(generateImage).not.toHaveBeenCalled();
  });
});
