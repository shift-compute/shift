import type { StepRecord } from "../executors/types";

/** A connected user the night may run. The ciphertext is still sealed; only `runUser` decrypts it, and only in memory. */
export interface ConnectedUser {
  id: string;
  accountAddress: string;
  mode: "IAI_CREDITS_ONLY" | "BUDGET";
  nightlyBudgetUsdMicro: bigint | null;
  donateLeftover: boolean;
  mkCiphertext: Buffer;
  mkIv: Buffer;
  mkAuthTag: Buffer;
}

export interface OpenTask {
  id: string;
  type: string;
  priority: number;
  createdAt: Date;
  inputPath: string | null;
  inputMeta: unknown;
  prompt: string | null;
}

export interface ExistingRun {
  id: string;
  status: string;
  ephemeralKeyId: string | null;
  keyRevokedAt: Date | null;
}

export interface RunPatch {
  status?: string;
  error?: string | null;
  ephemeralKeyId?: string;
  keyCreatedAt?: Date;
  keyRevokedAt?: Date;
  balanceBefore?: unknown;
  balanceAfter?: unknown;
  budgetUsdMicro?: bigint | null;
  spentUsdMicro?: bigint;
  donatedUsdMicro?: bigint;
  creditUsed?: string | null;
  depositUsed?: string | null;
}

export interface TaskPatch {
  status?: "QUEUED" | "PLANNED" | "RUNNING" | "DONE" | "FAILED" | "DEFERRED" | "CANCELLED";
  nightId?: bigint;
  complexity?: string | null;
  chosenModel?: string | null;
  estCostUsdMicro?: bigint | null;
  actualCostUsdMicro?: bigint | null;
  steps?: StepRecord[];
  outputRoot?: string | null;
  outputTx?: string | null;
  error?: string | null;
}

/**
 * The database operations the night pipeline needs. Production uses Prisma; tests use an in-memory store.
 * Neither implementation invents Router results.
 */
export interface PipelineStore {
  /** Connected users with queued work, or with leftover donation on. Stable order, so nights are repeatable. */
  eligibleUsers(): Promise<ConnectedUser[]>;
  /** QUEUED and DEFERRED tasks. DEFERRED is last night's "not tonight", and tonight tries it again. */
  openTasks(userId: string): Promise<OpenTask[]>;
  findRun(nightId: bigint, userId: string): Promise<ExistingRun | null>;
  /** A RUNNING night run for this user, on any night. Null when the user is idle. */
  findRunningRun(userId: string): Promise<{ id: string; nightId: bigint } | null>;
  /**
   * Creates the RUNNING row. `busy` means another RUNNING row won the race, and the caller must not start a second key.
   */
  createRun(nightId: bigint, userId: string): Promise<{ id: string; busy?: boolean }>;
  updateRun(id: string, patch: RunPatch): Promise<void>;
  updateTask(id: string, patch: TaskPatch): Promise<void>;
  /** Writes a management key that was re-sealed under the current master key. */
  saveManagementKey?(userId: string, sealed: { ciphertext: Buffer; iv: Buffer; authTag: Buffer }): Promise<void>;
}
