import { describe, expect, it } from "vitest";
import { buildSettingsPayload } from "./settings";
import { microToBudgetInput, presentAccountBalances, presentConnectBalances, readSession } from "./session-state";

const connected = {
  connected: true,
  account: { address: "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f", currency: "usd" },
  mode: "BUDGET",
  donateLeftover: true,
  nightlyBudgetUsdMicro: "200000",
};

describe("readSession", () => {
  it("hydrates a saved budget and donation from the session", () => {
    const screen = readSession(connected);
    expect(screen).toEqual({
      phase: "connected",
      address: connected.account.address,
      currency: "usd",
      settings: { mode: "BUDGET", budgetText: "0.2", donateLeftover: true },
    });
    expect(JSON.stringify(screen)).not.toContain("mk-");
  });

  it("keeps a disconnected row on the paste form, and a broken body off it", () => {
    expect(readSession({ ...connected, connected: false }).phase).toBe("signed_out");
    expect(readSession({ connected: false }).phase).toBe("signed_out");
    expect(readSession(null).phase).toBe("unreadable");
    expect(readSession({ connected: true, account: connected.account }).phase).toBe("unreadable");
  });

  it("round-trips the saved cap back into the settings payload", () => {
    const text = microToBudgetInput("200000");
    expect(text).toBe("0.2");
    expect(buildSettingsPayload({ mode: "BUDGET", budgetText: text, donateLeftover: true })).toEqual({
      ok: true,
      payload: { mode: "BUDGET", nightlyBudgetUsd: 0.2, donateLeftover: true },
    });
    expect(microToBudgetInput("10000")).toBe("0.01");
    expect(microToBudgetInput(null)).toBe("");
  });
});

describe("balance formatting", () => {
  it("formats the observed USD credit integer as micro-USD", () => {
    expect(presentAccountBalances({ currency: "usd", balance: { credit: "4865042", deposit: "0" } })).toEqual({
      credit: "4.865042 USD",
      deposit: "0 USD",
    });
    expect(presentConnectBalances({ currency: "usd", creditBalance: "4865042", depositBalance: "0" })).toEqual({
      credit: "4.865042 USD",
      deposit: "0 USD",
    });
  });

  it("leaves a 0G integer in wei units", () => {
    expect(presentConnectBalances({ currency: "0g", creditBalance: "1000000000000000000", depositBalance: "0" })).toEqual({
      credit: "1 0G",
      deposit: "0 0G",
    });
    expect(presentAccountBalances(null)).toBeNull();
  });
});
