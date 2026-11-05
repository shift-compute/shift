import type { RouterClient, TrustMode } from "../zg/router";
import type { Trace } from "../zg/schemas";

/** One real Router call made while running a task. Every one is stored on `Task.steps` as evidence. */
export interface StepRecord {
  step: string;
  model: string;
  requestId?: string;
  trace?: Trace;
  /** Cost reported by the Router for this call, when it reports one. */
  costUsdMicro?: string;
}

export interface OutputFile {
  name: string;
  mime: string;
  bytes: Uint8Array;
}

export interface ExecutorResult<T> {
  /** The structured result shown to the user and stored on 0G Storage as JSON. */
  result: T;
  files: OutputFile[];
  steps: StepRecord[];
}

/** Which model handles which kind of call. The optimizer picks these per task. */
export interface ExecutorModels {
  chat: string;
  transcribe?: string;
  image?: string;
}

export interface ExecutorContext {
  router: RouterClient;
  /** The ephemeral inference key for this user and night. Never log it. */
  sk: string;
  models: ExecutorModels;
  trustMode: TrustMode;
  taskId: string;
  /** Attempt counter, part of `X-Client-Request-Id` so abandoned requests can be traced. */
  attempt: number;
}

/** `X-Client-Request-Id = <taskId>-<attempt>-<step>` (plan §11). */
export function clientRequestId(ctx: Pick<ExecutorContext, "taskId" | "attempt">, step: string): string {
  return `${ctx.taskId}-${ctx.attempt}-${step}`;
}
