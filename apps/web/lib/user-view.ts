import type { User } from "@shift/core";

/** The public view of a user: everything the UI needs and nothing derived from the management key. */
export function userView(user: User) {
  return {
    connected: user.mkCiphertext !== null,
    account: { address: user.accountAddress, currency: user.currency },
    mode: user.mode,
    donateLeftover: user.donateLeftover,
    nightlyBudgetUsdMicro: user.nightlyBudgetUsdMicro === null ? null : user.nightlyBudgetUsdMicro.toString(),
  };
}
