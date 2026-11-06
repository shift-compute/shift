import { z } from "zod";

/** Plan §12.1: a commons source paragraph stays at or under this many words. */
export const COMMONS_MAX_WORDS = 120;
/** Fragments shorter than this are headings and link lines, not translation jobs. */
export const COMMONS_MIN_WORDS = 20;
export const COMMONS_CORPUS_SIZE = 200;

export type CommonsTargetLang = "hi" | "mr";

export type CommonsSeedRow = {
  sourceRef: string;
  sourceText: string;
  targetLang: CommonsTargetLang;
};

export type CommonsExisting = {
  sourceRef: string;
  sourceText: string;
  targetLang: string;
  status: string;
};

export type CommonsSeedPlan = {
  insert: CommonsSeedRow[];
  update: CommonsSeedRow[];
  unchanged: number;
  /** Rows that already left PENDING. A re-run does not overwrite them. */
  protected: number;
};

const pageUrl = z.string().regex(/^https:\/\/ethereum\.org\/en\/[a-z0-9\-/]+\/$/, "must be an ethereum.org page URL");

const paragraphSchema = z
  .object({
    sourceRef: z.string().regex(/^https:\/\/ethereum\.org\/en\/[a-z0-9\-/]+\/#p\d{3}$/, "must be a page URL plus #pNNN"),
    pageUrl,
    repoPath: z.string().regex(/^public\/content\/.+\.md$/, "must be a content markdown path"),
    sourceText: z.string(),
  })
  .superRefine((paragraph, ctx) => {
    if (!paragraph.sourceRef.startsWith(`${paragraph.pageUrl}#p`)) {
      ctx.addIssue({ code: "custom", path: ["sourceRef"], message: "must start with pageUrl" });
    }
    const words = wordCount(paragraph.sourceText);
    if (words < COMMONS_MIN_WORDS || words > COMMONS_MAX_WORDS) {
      ctx.addIssue({
        code: "custom",
        path: ["sourceText"],
        message: `must be ${COMMONS_MIN_WORDS}–${COMMONS_MAX_WORDS} words (got ${words})`,
      });
    }
  });

export const commonsCorpusSchema = z
  .object({
    license: z.literal("CC-BY-4.0"),
    licenseUrl: z.literal("https://creativecommons.org/licenses/by/4.0/"),
    attribution: z.string().min(1),
    termsUrl: z.literal("https://ethereum.org/en/terms-of-use/"),
    sourceRepo: z.literal("https://github.com/ethereum/ethereum-org-website"),
    sourceRevision: z.string().regex(/^[0-9a-f]{40}$/),
    paragraphs: z.array(paragraphSchema).length(COMMONS_CORPUS_SIZE),
  })
  .superRefine((corpus, ctx) => {
    const seen = new Set<string>();
    corpus.paragraphs.forEach((paragraph, index) => {
      if (seen.has(paragraph.sourceRef)) {
        ctx.addIssue({ code: "custom", path: ["paragraphs", index, "sourceRef"], message: "duplicate sourceRef" });
      }
      seen.add(paragraph.sourceRef);
    });
  });

export type CommonsCorpus = z.infer<typeof commonsCorpusSchema>;

export class CommonsCorpusError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CommonsCorpusError";
  }
}

/** Words separated by whitespace. Punctuation stays attached to its word. */
export function wordCount(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  return trimmed.split(/\s+/).length;
}

/** Even indexes translate to Hindi, odd indexes to Marathi. The split follows corpus order. */
export function targetLangForIndex(index: number): CommonsTargetLang {
  return index % 2 === 0 ? "hi" : "mr";
}

export function loadCommonsCorpus(raw: unknown): CommonsCorpus {
  const result = commonsCorpusSchema.safeParse(raw);
  if (!result.success) {
    const detail = result.error.issues
      .slice(0, 8)
      .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
      .join("; ");
    throw new CommonsCorpusError(`Invalid commons corpus: ${detail}`);
  }
  return result.data;
}

export function assignCommonsTargets(paragraphs: readonly { sourceRef: string; sourceText: string }[]): CommonsSeedRow[] {
  return paragraphs.map((paragraph, index) => ({
    sourceRef: paragraph.sourceRef,
    sourceText: paragraph.sourceText,
    targetLang: targetLangForIndex(index),
  }));
}

/**
 * Inserts sourceRefs that are not in the table yet.
 * Updates a row only while it is still PENDING.
 * Does not delete rows, and does not touch a translation that has already started.
 */
export function planCommonsSeed(desired: readonly CommonsSeedRow[], existing: readonly CommonsExisting[]): CommonsSeedPlan {
  const wanted = new Set<string>();
  for (const row of desired) {
    if (wanted.has(row.sourceRef)) throw new Error(`Commons seed corpus has a duplicate sourceRef: ${row.sourceRef}`);
    wanted.add(row.sourceRef);
  }

  const byRef = new Map<string, CommonsExisting>();
  for (const row of existing) {
    if (byRef.has(row.sourceRef)) throw new Error(`Commons seed found duplicate sourceRef rows: ${row.sourceRef}`);
    byRef.set(row.sourceRef, row);
  }

  const insert: CommonsSeedRow[] = [];
  const update: CommonsSeedRow[] = [];
  let unchanged = 0;
  let protectedRows = 0;
  for (const row of desired) {
    const found = byRef.get(row.sourceRef);
    if (!found) {
      insert.push(row);
      continue;
    }
    if (found.status !== "PENDING") {
      protectedRows += 1;
      continue;
    }
    if (found.sourceText !== row.sourceText || found.targetLang !== row.targetLang) update.push(row);
    else unchanged += 1;
  }
  return { insert, update, unchanged, protected: protectedRows };
}

const databaseUrlSchema = z.string().regex(/^postgres(ql)?:\/\//);

/** Reads DATABASE_URL. The error never includes the value, which may carry a password. */
export function requireDatabaseUrl(env: Record<string, string | undefined>): string {
  const parsed = databaseUrlSchema.safeParse(env.DATABASE_URL);
  if (!parsed.success) throw new Error("DATABASE_URL must be a postgresql:// URL");
  return parsed.data;
}
