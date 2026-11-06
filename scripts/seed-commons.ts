/**
 * Loads the CC BY 4.0 ethereum.org excerpts in data/commons/ into CommonsItem.
 * Safe to re-run: missing sourceRefs are inserted, PENDING rows are updated,
 * and a row that has left PENDING is left alone. Nothing is deleted.
 * No Router call and no chain transaction.
 */
import { readFileSync } from "node:fs";
import {
  assignCommonsTargets,
  loadCommonsCorpus,
  planCommonsSeed,
  requireDatabaseUrl,
  type CommonsSeedRow,
} from "../packages/core/src/commons/sources";
import { createDb, type PrismaClient } from "../packages/core/src/db/client";
import { loadDotEnv } from "./lib/env";

loadDotEnv();

const corpusPath = new URL("../data/commons/paragraphs.json", import.meta.url);

async function seed(db: PrismaClient, desired: readonly CommonsSeedRow[]): Promise<void> {
  const existing = await db.commonsItem.findMany({
    where: { sourceRef: { in: desired.map((row) => row.sourceRef) } },
    select: { sourceRef: true, sourceText: true, targetLang: true, status: true },
  });
  const plan = planCommonsSeed(desired, existing);
  const now = new Date();
  await db.$transaction(async (tx) => {
    if (plan.insert.length > 0) {
      await tx.commonsItem.createMany({
        data: plan.insert.map((row) => ({
          sourceRef: row.sourceRef,
          sourceText: row.sourceText,
          targetLang: row.targetLang,
          status: "PENDING",
          requestIds: [],
          updatedAt: now,
        })),
      });
    }
    for (const row of plan.update) {
      const result = await tx.commonsItem.updateMany({
        where: { sourceRef: row.sourceRef, status: "PENDING" },
        data: { sourceText: row.sourceText, targetLang: row.targetLang },
      });
      if (result.count !== 1) {
        throw new Error(`Commons seed expected to update one PENDING row for ${row.sourceRef}, updated ${result.count}`);
      }
    }
  });
  console.log(
    `Commons seed: inserted ${plan.insert.length}, updated ${plan.update.length}, unchanged ${plan.unchanged}, left non-pending ${plan.protected}.`,
  );
}

function publicError(err: unknown): string {
  const message = err instanceof Error ? err.message : "Commons seed failed";
  return message.replace(/postgres(?:ql)?:\/\/\S+/gi, "postgresql://***");
}

async function main(): Promise<void> {
  const databaseUrl = requireDatabaseUrl(process.env);
  const corpus = loadCommonsCorpus(JSON.parse(readFileSync(corpusPath, "utf8")));
  const desired = assignCommonsTargets(corpus.paragraphs);
  const db = createDb(databaseUrl);
  try {
    await seed(db, desired);
  } finally {
    await db.$disconnect();
  }
}

main().catch((err: unknown) => {
  console.error(publicError(err));
  process.exit(1);
});
