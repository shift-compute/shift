import { z } from "zod";

const bytes32 = z.string().regex(/^0x[0-9a-fA-F]{64}$/);
const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/);
const uint64 = z.string().regex(/^(0|[1-9]\d*)$/).refine((value) => BigInt(value) <= (1n << 64n) - 1n);
const tierName = z.enum(["standard", "verified", "private"]);

/**
 * `GET /api/verify/[requestId]` (plan §15).
 * `trace.tier` is the trust tier packed into the leaf (0 standard, 1 verified, 2 private).
 * The Router's `x_0g_trace` object has no tier field; the other three trace fields are copied from it.
 * `tee_verified` is null when the trace carried no boolean verdict.
 */
export const verifyResponseSchema = z
  .object({
    requestId: z.string().min(1).max(200),
    nightId: z.string().regex(/^[1-9]\d*$/),
    manifestRoot: bytes32.nullable(),
    merkleRoot: bytes32.nullable(),
    anchorTx: bytes32.nullable(),
    outputRoot: bytes32,
    /** Indexer download of the output (`/file?root=`). Null when the indexer URL is not an http(s) URL. */
    outputUrl: z.string().min(1).nullable(),
    manifestUrl: z.string().min(1).nullable(),
    values: z.tuple([bytes32, address, bytes32, bytes32, bytes32, z.enum(["0", "1", "2"]), uint64, z.enum(["true", "false"])]),
    proof: z.array(bytes32),
    leafHash: bytes32,
    model: z.string().min(1).max(200).nullable(),
    trace: z.object({
      provider: z.string().min(1).max(200).nullable(),
      provider_identity: z.string().min(1).max(200).nullable(),
      tee_verified: z.boolean().nullable(),
      tier: tierName,
    }),
    chainId: z.number().int().positive(),
    rpcUrl: z.string().min(1),
    contractAddress: address,
    explorerUrl: z.string().min(1),
  })
  .superRefine((body, ctx) => {
    if (body.outputRoot.toLowerCase() !== body.values[3].toLowerCase()) {
      ctx.addIssue({ code: "custom", message: "outputRoot is the storage root packed into the leaf." });
    }
    const tierCode = { standard: "0", verified: "1", private: "2" } as const;
    if (body.values[5] !== tierCode[body.trace.tier]) {
      ctx.addIssue({ code: "custom", message: "tier matches the uint8 packed into the leaf." });
    }
  });

export type VerifyResponse = z.infer<typeof verifyResponseSchema>;

export type VerifyPanel =
  | { phase: "empty" }
  | { phase: "invalid" }
  | { phase: "not_found" }
  | { phase: "unavailable" }
  | { phase: "ready"; body: VerifyResponse };

/** Turns the verify response into the panel state. A bad body never throws into the page. */
export async function readVerify(res: Response | null): Promise<VerifyPanel> {
  if (!res) return { phase: "unavailable" };
  if (res.status === 404) {
    const body: unknown = await res.json().catch(() => null);
    if (body && typeof body === "object" && "error" in body && body.error === "invalid_request") return { phase: "invalid" };
    return { phase: "not_found" };
  }
  if (!res.ok) return { phase: "unavailable" };
  const body: unknown = await res.json().catch(() => null);
  const parsed = verifyResponseSchema.safeParse(body);
  if (!parsed.success) return { phase: "unavailable" };
  return { phase: "ready", body: parsed.data };
}

/** An http(s) URL is safe to put in an href. Anything else is not linked. */
export function safeHttpUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}
