import type { RouterResponse, TrustMode } from "../zg/router";
import type { StepRecord } from "./types";

/** Turns a Router response into the evidence stored for the step: request ID, trace, reported cost and trust tier. */
export function recordStep(
  step: string,
  model: string,
  res: Pick<RouterResponse<unknown>, "requestId" | "trace">,
  trust: TrustMode,
): StepRecord {
  const cost = res.trace?.billing?.total_cost_usd_micro;
  return {
    step,
    model,
    trust,
    ...(res.requestId ? { requestId: res.requestId } : {}),
    ...(res.trace ? { trace: res.trace } : {}),
    ...(cost !== undefined ? { costUsdMicro: String(cost) } : {}),
  };
}
