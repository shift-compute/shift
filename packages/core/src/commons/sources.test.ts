import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  COMMONS_CORPUS_SIZE,
  COMMONS_MAX_WORDS,
  COMMONS_MIN_WORDS,
  CommonsCorpusError,
  assignCommonsTargets,
  loadCommonsCorpus,
  planCommonsSeed,
  requireDatabaseUrl,
  wordCount,
  type CommonsSeedRow,
} from "./sources";

const corpusPath = new URL("../../../../data/commons/paragraphs.json", import.meta.url);
const corpus = loadCommonsCorpus(JSON.parse(readFileSync(corpusPath, "utf8")));

function row(sourceRef: string, sourceText = "alpha", targetLang: "hi" | "mr" = "hi"): CommonsSeedRow {
  return { sourceRef, sourceText, targetLang };
}

describe("commons corpus", () => {
  it("loads 200 CC BY 4.0 ethereum.org excerpts within the word limit", () => {
    expect(corpus.license).toBe("CC-BY-4.0");
    expect(corpus.sourceRevision).toBe("c362ca84b53659a924d360ac02ca5a99987cacb3");
    expect(corpus.paragraphs).toHaveLength(COMMONS_CORPUS_SIZE);
    const refs = new Set(corpus.paragraphs.map((paragraph) => paragraph.sourceRef));
    expect(refs.size).toBe(COMMONS_CORPUS_SIZE);
    for (const paragraph of corpus.paragraphs) {
      const words = wordCount(paragraph.sourceText);
      expect(words).toBeGreaterThanOrEqual(COMMONS_MIN_WORDS);
      expect(words).toBeLessThanOrEqual(COMMONS_MAX_WORDS);
      expect(paragraph.sourceRef.startsWith(`${paragraph.pageUrl}#p`)).toBe(true);
    }
  });

  it("rejects a paragraph over 120 words and a corpus that drops the license", () => {
    const raw = JSON.parse(readFileSync(corpusPath, "utf8")) as { paragraphs: { sourceText: string }[]; license: string };
    raw.paragraphs[0]!.sourceText = `${"word ".repeat(COMMONS_MAX_WORDS + 1).trim()}.`;
    expect(() => loadCommonsCorpus(raw)).toThrow(CommonsCorpusError);
    expect(() => loadCommonsCorpus(raw)).toThrow(/120/);
    raw.paragraphs[0]!.sourceText = corpus.paragraphs[0]!.sourceText;
    raw.license = "MIT";
    expect(() => loadCommonsCorpus(raw)).toThrow(CommonsCorpusError);
  });

  it("splits the queue evenly between Hindi and Marathi in corpus order", () => {
    const assigned = assignCommonsTargets(corpus.paragraphs);
    expect(assigned[0]?.targetLang).toBe("hi");
    expect(assigned[1]?.targetLang).toBe("mr");
    expect(assigned.filter((item) => item.targetLang === "hi")).toHaveLength(100);
    expect(assigned.filter((item) => item.targetLang === "mr")).toHaveLength(100);
  });
});

describe("planCommonsSeed", () => {
  const desired = [row("https://ethereum.org/en/eth/#p001", "one", "hi"), row("https://ethereum.org/en/eth/#p002", "two", "mr")];

  it("inserts every row when the table is empty", () => {
    expect(planCommonsSeed(desired, [])).toEqual({ insert: desired, update: [], unchanged: 0, protected: 0 });
  });

  it("leaves a matching pending row in place and updates a pending row whose text changed", () => {
    const plan = planCommonsSeed(desired, [
      { sourceRef: desired[0]!.sourceRef, sourceText: "one", targetLang: "hi", status: "PENDING" },
      { sourceRef: desired[1]!.sourceRef, sourceText: "old", targetLang: "mr", status: "PENDING" },
    ]);
    expect(plan.insert).toEqual([]);
    expect(plan.update).toEqual([desired[1]]);
    expect(plan.unchanged).toBe(1);
    expect(plan.protected).toBe(0);
  });

  it("does not overwrite a row that has left the pending queue", () => {
    const plan = planCommonsSeed(desired, [
      { sourceRef: desired[0]!.sourceRef, sourceText: "translated", targetLang: "hi", status: "ACCEPTED" },
      { sourceRef: desired[1]!.sourceRef, sourceText: "two", targetLang: "mr", status: "RUNNING" },
    ]);
    expect(plan.insert).toEqual([]);
    expect(plan.update).toEqual([]);
    expect(plan.protected).toBe(2);
  });

  it("fails when the table already has two rows for one sourceRef", () => {
    const existing = [
      { sourceRef: desired[0]!.sourceRef, sourceText: "one", targetLang: "hi", status: "PENDING" },
      { sourceRef: desired[0]!.sourceRef, sourceText: "one", targetLang: "hi", status: "PENDING" },
    ];
    expect(() => planCommonsSeed(desired, existing)).toThrow(/duplicate sourceRef/);
  });
});

describe("requireDatabaseUrl", () => {
  it("accepts a postgres URL and refuses anything else without echoing it", () => {
    expect(requireDatabaseUrl({ DATABASE_URL: "postgresql://user:secret@localhost:5432/shift" })).toBe(
      "postgresql://user:secret@localhost:5432/shift",
    );
    expect(() => requireDatabaseUrl({ DATABASE_URL: "mysql://secret" })).toThrow(/^DATABASE_URL must be a postgresql:\/\/ URL$/);
    expect(() => requireDatabaseUrl({})).toThrow(/DATABASE_URL/);
  });
});
