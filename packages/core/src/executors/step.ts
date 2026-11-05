import type { RouterResponse } from "../zg/router";
import type { StepRecord } from "./types";

/** Turns a Router response into the evidence stored for the step: request ID, trace and reported cost. */
export function recordStep(step: string, model: string, res: Pick<RouterResponse<unknown>, "requestId" | "trace">): StepRecord {
  const cost = res.trace?.billing?.total_cost_usd_micro;
  return {
    step,
    model,
    ...(res.requestId ? { requestId: res.requestId } : {}),
    ...(res.trace ? { trace: res.trace } : {}),
    ...(cost !== undefined ? { costUsdMicro: String(cost) } : {}),
  };
}
