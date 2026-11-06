import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConnectedPanel, ConnectWizard } from "./ConnectWizard";

const session = {
  connected: true,
  account: { address: "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f", currency: "usd" },
  mode: "BUDGET" as const,
  donateLeftover: true,
  nightlyBudgetUsdMicro: "200000",
};

describe("ConnectWizard session", () => {
  it("renders the saved account instead of the management-key form", () => {
    const html = renderToStaticMarkup(createElement(ConnectWizard, { consoleUrl: "https://pc.0g.ai", session }));
    expect(html).toContain("Account connected");
    expect(html).toContain("0xdbdc…f88f");
    expect(html).toContain("value=\"0.2\"");
    expect(html).toContain("Reading your balance");
    expect(html).toContain("type=\"checkbox\" class=\"mt-1.5 accent-teal\" checked=\"\"");
    expect(html).not.toContain("id=\"mk\"");
    expect(html).not.toContain("4865042");
    expect(html).not.toContain("mk-");
  });

  it("shows the paste form only when the session is signed out", () => {
    const html = renderToStaticMarkup(createElement(ConnectWizard, { consoleUrl: "https://pc.0g.ai", session: { connected: false } }));
    expect(html).toContain("id=\"mk\"");
    expect(html).not.toContain("Account connected");
  });

  it("does not fall back to the paste form when the session body is unreadable", () => {
    const html = renderToStaticMarkup(createElement(ConnectWizard, { consoleUrl: "https://pc.0g.ai", session: { connected: true } }));
    expect(html).toContain("We could not read your session");
    expect(html).not.toContain("id=\"mk\"");
  });
});

describe("ConnectedPanel", () => {
  it("shows formatted USD balances and the saved donation", () => {
    const html = renderToStaticMarkup(
      createElement(ConnectedPanel, {
        address: "0xdbdcb1f11b6b8ea7ae2b5735954f251306d6f88f",
        balance: { phase: "ready", credit: "4.865042 USD", deposit: "0 USD" },
        settings: { mode: "BUDGET", budgetText: "0.2", donateLeftover: true },
      }),
    );
    expect(html).toContain("4.865042 USD");
    expect(html).toContain("0 USD");
    expect(html).not.toContain("4865042");
    expect(html).toContain("value=\"0.2\"");
    expect(html).toContain("type=\"checkbox\" class=\"mt-1.5 accent-teal\" checked=\"\"");
  });
});
