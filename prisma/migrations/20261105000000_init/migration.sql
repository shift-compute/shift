-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Mode" AS ENUM ('IAI_CREDITS_ONLY', 'BUDGET');

-- CreateEnum
CREATE TYPE "TaskType" AS ENUM ('AUDIO_SUMMARY', 'DOC_ANALYSIS', 'IMAGE_FROM_PROMPT');

-- CreateEnum
CREATE TYPE "TaskStatus" AS ENUM ('QUEUED', 'PLANNED', 'RUNNING', 'DONE', 'FAILED', 'DEFERRED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NightStatus" AS ENUM ('PENDING', 'RUNNING', 'ANCHORING', 'DONE', 'FAILED');

-- CreateEnum
CREATE TYPE "CommonsStatus" AS ENUM ('PENDING', 'RUNNING', 'ACCEPTED', 'REJECTED', 'FAILED');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "accountAddress" TEXT NOT NULL,
    "currency" TEXT NOT NULL,
    "mode" "Mode" NOT NULL DEFAULT 'IAI_CREDITS_ONLY',
    "nightlyBudgetUsdMicro" BIGINT,
    "donateLeftover" BOOLEAN NOT NULL DEFAULT true,
    "mkCiphertext" BYTEA,
    "mkIv" BYTEA,
    "mkAuthTag" BYTEA,
    "mkConnectedAt" TIMESTAMP(3),
    "encPublicKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Task" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "TaskType" NOT NULL,
    "status" "TaskStatus" NOT NULL DEFAULT 'QUEUED',
    "priority" INTEGER NOT NULL DEFAULT 2,
    "inputPath" TEXT,
    "inputMeta" JSONB,
    "prompt" TEXT,
    "nightId" BIGINT,
    "complexity" TEXT,
    "chosenModel" TEXT,
    "estCostUsdMicro" BIGINT,
    "actualCostUsdMicro" BIGINT,
    "steps" JSONB,
    "outputRoot" TEXT,
    "outputTx" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Task_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Night" (
    "id" BIGINT NOT NULL,
    "status" "NightStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "merkleRoot" TEXT,
    "manifestRoot" TEXT,
    "anchorTx" TEXT,
    "donationsTx" TEXT,
    "itemCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Night_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NightRun" (
    "id" TEXT NOT NULL,
    "nightId" BIGINT NOT NULL,
    "userId" TEXT NOT NULL,
    "ephemeralKeyId" TEXT,
    "keyCreatedAt" TIMESTAMP(3),
    "keyRevokedAt" TIMESTAMP(3),
    "balanceBefore" JSONB,
    "balanceAfter" JSONB,
    "budgetUsdMicro" BIGINT,
    "spentUsdMicro" BIGINT NOT NULL DEFAULT 0,
    "donatedUsdMicro" BIGINT NOT NULL DEFAULT 0,
    "creditUsed" TEXT,
    "depositUsed" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "error" TEXT,

    CONSTRAINT "NightRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommonsItem" (
    "id" TEXT NOT NULL,
    "sourceRef" TEXT NOT NULL,
    "sourceText" TEXT NOT NULL,
    "targetLang" TEXT NOT NULL,
    "status" "CommonsStatus" NOT NULL DEFAULT 'PENDING',
    "translationA" TEXT,
    "translationB" TEXT,
    "modelA" TEXT,
    "modelB" TEXT,
    "gateModel" TEXT,
    "gateProbability" DOUBLE PRECISION,
    "requestIds" TEXT[],
    "outputRoot" TEXT,
    "donorUserId" TEXT,
    "nightId" BIGINT,
    "costUsdMicro" BIGINT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommonsItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MerkleLeaf" (
    "id" TEXT NOT NULL,
    "nightId" BIGINT NOT NULL,
    "requestId" TEXT NOT NULL,
    "values" JSONB NOT NULL,
    "leafHash" TEXT NOT NULL,
    "proof" JSONB NOT NULL,

    CONSTRAINT "MerkleLeaf_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_accountAddress_key" ON "User"("accountAddress");

-- CreateIndex
CREATE INDEX "Task_userId_status_idx" ON "Task"("userId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "NightRun_nightId_userId_key" ON "NightRun"("nightId", "userId");

-- CreateIndex
CREATE INDEX "CommonsItem_status_idx" ON "CommonsItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "MerkleLeaf_requestId_key" ON "MerkleLeaf"("requestId");

-- CreateIndex
CREATE INDEX "MerkleLeaf_nightId_idx" ON "MerkleLeaf"("nightId");

-- AddForeignKey
ALTER TABLE "Task" ADD CONSTRAINT "Task_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightRun" ADD CONSTRAINT "NightRun_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "Night"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NightRun" ADD CONSTRAINT "NightRun_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MerkleLeaf" ADD CONSTRAINT "MerkleLeaf_nightId_fkey" FOREIGN KEY ("nightId") REFERENCES "Night"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

