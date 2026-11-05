/** The 0G Private Computer console that matches the Router in use: testnet and mainnet have separate accounts and keys. */
export function consoleUrlFor(routerBaseUrl: string): string {
  return /testnet/i.test(routerBaseUrl) ? "https://pc.testnet.0g.ai" : "https://pc.0g.ai";
}
