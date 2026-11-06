import { PrismaClient } from "../db/client";
import type { CommonsGateItem, CommonsStore, CommonsTranslationPatch } from "./commons";
import type { ConnectedUser, OpenTask, PipelineStore, RunPatch, TaskPatch } from "./store";

type TaskData = NonNullable<Parameters<PrismaClient["task"]["update"]>[0]["data"]>;
type RunData = NonNullable<Parameters<PrismaClient["nightRun"]["update"]>[0]["data"]>;

function asJson<T>(value: unknown): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function bytes(value: Uint8Array): Buffer {
  return Buffer.from(value);
}

/** Prisma backing for the night pipeline. Creates the Night row if a manual run reaches a user before the lock does. */
export function prismaPipelineStore(db: PrismaClient): PipelineStore {
  return {
    async eligibleUsers() {
      const users = await db.user.findMany({
        where: {
          mkCiphertext: { not: null },
          mkIv: { not: null },
          mkAuthTag: { not: null },
          OR: [{ donateLeftover: true }, { tasks: { some: { status: { in: ["QUEUED", "DEFERRED"] } } } }],
        },
        orderBy: { id: "asc" },
      });
      const connected: ConnectedUser[] = [];
      for (const user of users) {
        if (!user.mkCiphertext || !user.mkIv || !user.mkAuthTag) continue;
        connected.push({
          id: user.id,
          accountAddress: user.accountAddress,
          mode: user.mode,
          nightlyBudgetUsdMicro: user.nightlyBudgetUsdMicro,
          donateLeftover: user.donateLeftover,
          mkCiphertext: bytes(user.mkCiphertext),
          mkIv: bytes(user.mkIv),
          mkAuthTag: bytes(user.mkAuthTag),
        });
      }
      return connected;
    },

    async openTasks(userId) {
      const tasks = await db.task.findMany({
        where: { userId, status: { in: ["QUEUED", "DEFERRED"] } },
        orderBy: { createdAt: "asc" },
      });
      return tasks.map((task): OpenTask => ({
        id: task.id,
        type: task.type,
        priority: task.priority,
        createdAt: task.createdAt,
        inputPath: task.inputPath,
        inputMeta: task.inputMeta,
        prompt: task.prompt,
      }));
    },

    async findRun(nightId, userId) {
      const run = await db.nightRun.findUnique({ where: { nightId_userId: { nightId, userId } } });
      if (!run) return null;
      return { id: run.id, status: run.status, ephemeralKeyId: run.ephemeralKeyId, keyRevokedAt: run.keyRevokedAt };
    },

    async findRunningRun(userId) {
      const run = await db.nightRun.findFirst({
        where: { userId, status: "RUNNING" },
        select: { id: true, nightId: true },
      });
      return run ? { id: run.id, nightId: run.nightId } : null;
    },

    async createRun(nightId, userId) {
      // One RUNNING row per user. Two processes (run now and the worker) take this lock before inserting.
      return db.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`shift-user:${userId}`}))`;
        const running = await tx.nightRun.findFirst({
          where: { userId, status: "RUNNING" },
          select: { id: true, nightId: true },
        });
        if (running) return { id: running.id, busy: true };
        await tx.night.upsert({ where: { id: nightId }, create: { id: nightId }, update: {} });
        const same = await tx.nightRun.findUnique({ where: { nightId_userId: { nightId, userId } }, select: { id: true } });
        if (same) return { id: same.id, busy: true };
        const run = await tx.nightRun.create({ data: { nightId, userId, status: "RUNNING" }, select: { id: true } });
        return { id: run.id };
      });
    },

    async updateRun(id, patch) {
      await db.nightRun.update({ where: { id }, data: runData(patch) });
    },

    async updateTask(id, patch) {
      await db.task.update({ where: { id }, data: taskData(patch) });
    },

    async saveManagementKey(userId, sealed) {
      await db.user.update({
        where: { id: userId },
        data: { mkCiphertext: sealed.ciphertext, mkIv: sealed.iv, mkAuthTag: sealed.authTag },
      });
    },
  };
}

/** Prisma backing for commons translations. Claim is conditional so two nights cannot take the same PENDING row. */
export function prismaCommonsStore(db: PrismaClient): CommonsStore {
  return {
    async pendingItems() {
      return db.commonsItem.findMany({
        where: { status: "PENDING" },
        orderBy: { id: "asc" },
        select: { id: true, sourceText: true, targetLang: true },
      });
    },

    async claim(id, donor) {
      const updated = await db.commonsItem.updateMany({
        where: { id, status: "PENDING" },
        data: { status: "RUNNING", donorUserId: donor.userId, nightId: donor.nightId },
      });
      return updated.count === 1;
    },

    async runningItems(userId) {
      const rows = await db.commonsItem.findMany({
        where: { status: "RUNNING", donorUserId: userId },
        orderBy: { id: "asc" },
        select: {
          id: true,
          sourceText: true,
          translationA: true,
          translationB: true,
          modelA: true,
          modelB: true,
          requestIds: true,
          costUsdMicro: true,
          gateModel: true,
          gateProbability: true,
        },
      });
      const ready: CommonsGateItem[] = [];
      for (const row of rows) {
        if (!row.translationA?.trim() || !row.translationB?.trim() || !row.modelA || !row.modelB) continue;
        ready.push({
          id: row.id,
          sourceText: row.sourceText,
          translationA: row.translationA,
          translationB: row.translationB,
          modelA: row.modelA,
          modelB: row.modelB,
          requestIds: row.requestIds,
          costUsdMicro: row.costUsdMicro,
          gateModel: row.gateModel,
          gateProbability: row.gateProbability,
        });
      }
      return ready;
    },

    async save(id, patch) {
      await db.commonsItem.update({ where: { id }, data: commonsData(patch) });
    },
  };
}

function commonsData(patch: CommonsTranslationPatch): NonNullable<Parameters<PrismaClient["commonsItem"]["update"]>[0]["data"]> {
  return {
    status: patch.status,
    ...(patch.translationA !== undefined ? { translationA: patch.translationA } : {}),
    ...(patch.translationB !== undefined ? { translationB: patch.translationB } : {}),
    ...(patch.modelA !== undefined ? { modelA: patch.modelA } : {}),
    ...(patch.modelB !== undefined ? { modelB: patch.modelB } : {}),
    ...(patch.requestIds !== undefined ? { requestIds: patch.requestIds } : {}),
    ...(patch.costUsdMicro !== undefined ? { costUsdMicro: patch.costUsdMicro } : {}),
    ...(patch.donorUserId !== undefined ? { donorUserId: patch.donorUserId } : {}),
    ...(patch.nightId !== undefined ? { nightId: patch.nightId } : {}),
    ...(patch.gateModel !== undefined ? { gateModel: patch.gateModel } : {}),
    ...(patch.gateProbability !== undefined ? { gateProbability: patch.gateProbability } : {}),
    ...(patch.outputRoot !== undefined ? { outputRoot: patch.outputRoot } : {}),
  };
}

function runData(patch: RunPatch): RunData {
  const data: RunData = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.error !== undefined) data.error = patch.error;
  if (patch.ephemeralKeyId !== undefined) data.ephemeralKeyId = patch.ephemeralKeyId;
  if (patch.keyCreatedAt !== undefined) data.keyCreatedAt = patch.keyCreatedAt;
  if (patch.keyRevokedAt !== undefined) data.keyRevokedAt = patch.keyRevokedAt;
  if (patch.balanceBefore !== undefined) data.balanceBefore = asJson(patch.balanceBefore);
  if (patch.balanceAfter !== undefined) data.balanceAfter = asJson(patch.balanceAfter);
  if (patch.budgetUsdMicro !== undefined) data.budgetUsdMicro = patch.budgetUsdMicro;
  if (patch.spentUsdMicro !== undefined) data.spentUsdMicro = patch.spentUsdMicro;
  if (patch.donatedUsdMicro !== undefined) data.donatedUsdMicro = patch.donatedUsdMicro;
  if (patch.creditUsed !== undefined) data.creditUsed = patch.creditUsed;
  if (patch.depositUsed !== undefined) data.depositUsed = patch.depositUsed;
  return data;
}

function taskData(patch: TaskPatch): TaskData {
  const data: TaskData = {};
  if (patch.status !== undefined) data.status = patch.status;
  if (patch.nightId !== undefined) data.nightId = patch.nightId;
  if (patch.complexity !== undefined) data.complexity = patch.complexity;
  if (patch.chosenModel !== undefined) data.chosenModel = patch.chosenModel;
  if (patch.estCostUsdMicro !== undefined) data.estCostUsdMicro = patch.estCostUsdMicro;
  if (patch.actualCostUsdMicro !== undefined) data.actualCostUsdMicro = patch.actualCostUsdMicro;
  if (patch.steps !== undefined) data.steps = asJson(patch.steps) as TaskData["steps"];
  if (patch.outputRoot !== undefined) data.outputRoot = patch.outputRoot;
  if (patch.outputTx !== undefined) data.outputTx = patch.outputTx;
  if (patch.error !== undefined) data.error = patch.error;
  return data;
}
