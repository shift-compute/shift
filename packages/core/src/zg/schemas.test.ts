import { describe, expect, it } from "vitest";
import { balanceSchema, fundsSchema, usageHistorySchema } from "./schemas";

// Bodies captured from the real Router in Phase 0.
describe("schemas against real captures", () => {
  it("parses /account/funds including the payment layer", () => {
    const body = {
      address: "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f",
      currency: "0g",
      total: "0",
      router: { deposit: "0", credit: "0", pending_charge: "0", subtotal: "0" },
      payment_layer: { balance: "0", shared_across_products: true, queried_at: "2026-11-05T16:31:21Z" },
    };
    const r = fundsSchema.parse(body);
    expect(r.router?.credit).toBe("0");
    expect(r.payment_layer?.balance).toBe("0");
  });

  it("parses /account/balance", () => {
    const r = balanceSchema.parse({ address: "0xdb", currency: "0g", deposit_balance: "0", credit_balance: "0", pending_charge: "0", total_balance: "0", balance: "0" });
    expect(r.currency).toBe("0g");
  });

  it("parses a usage history row with credit and deposit usage", () => {
    const r = usageHistorySchema.parse({ object: "list", data: [{ id: 1, request_id: "b76621be-1b38-46e6-a119-f927627a8017", model_id: "convaiinnovations/laya", cost: "0", credit_used: "0", deposit_used: "0" }] });
    expect(r.data[0]?.credit_used).toBe("0");
  });
});
