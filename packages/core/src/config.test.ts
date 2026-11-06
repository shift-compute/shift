import { describe, expect, it } from "vitest";
import { ConfigError, loadWebConfig, loadWorkerConfig } from "./config";

const SECRET_KEY = "0x" + "ab".repeat(32);
const MASTER = Buffer.alloc(32, 7).toString("base64");

const base = {
  DATABASE_URL: "postgresql://user:pw@localhost:5432/shift",
  SHIFT_MASTER_KEY: MASTER,
  ZG_ROUTER_BASE_URL: "https://router-api.0g.ai/v1",
  ZG_CHAIN_ID: "16602",
  ZG_CHAIN_RPC_URL: "https://evmrpc-testnet.0g.ai",
  ZG_EXPLORER_URL: "https://chainscan-galileo.0g.ai",
  ZG_STORAGE_INDEXER_URL: "https://indexer-storage-testnet-turbo.0g.ai",
  LEDGER_CONTRACT_ADDRESS: "0xA3B6664b487FC01c4264977c9B92058A89C31Ed7",
};
const web = { ...base, SESSION_SECRET: "s".repeat(32), PUBLIC_APP_URL: "https://shift.example" };
const worker = { ...base, OPERATOR_PRIVATE_KEY: SECRET_KEY };

describe("loadWorkerConfig", () => {
  it("parses a valid environment and applies defaults", () => {
    const c = loadWorkerConfig(worker);
    expect(c.ZG_CHAIN_ID).toBe(16602);
    expect(c.NIGHT_START_UTC).toBe("23:00");
    expect(c.NIGHT_HARD_STOP_UTC).toBe("23:50");
    expect(c.SAFETY_MARGIN_PCT).toBe(10);
    expect(c.MAX_CONCURRENCY).toBe(3);
    expect(c.COMMONS_GATE_THRESHOLD).toBe(0.75);
    expect(c.UPLOAD_DIR).toBe("./uploads");
  });

  it("treats empty strings as missing", () => {
    expect(() => loadWorkerConfig({ ...worker, OPERATOR_PRIVATE_KEY: "" })).toThrow(ConfigError);
    expect(loadWorkerConfig({ ...worker, MAX_CONCURRENCY: "" }).MAX_CONCURRENCY).toBe(3);
  });

  it("reports every problem at once, by variable name", () => {
    try {
      loadWorkerConfig({ ...worker, DATABASE_URL: "mysql://x", ZG_CHAIN_ID: "abc", LEDGER_CONTRACT_ADDRESS: "0x123" });
      expect.unreachable();
    } catch (err) {
      const problems = (err as ConfigError).problems.join("\n");
      expect(problems).toContain("DATABASE_URL");
      expect(problems).toContain("ZG_CHAIN_ID");
      expect(problems).toContain("LEDGER_CONTRACT_ADDRESS");
    }
  });

  it("never echoes secret values in the error", () => {
    const badKey = "0xnot-a-key-" + "q".repeat(20);
    try {
      loadWorkerConfig({ ...worker, OPERATOR_PRIVATE_KEY: badKey, SHIFT_MASTER_KEY: "supersecret" });
      expect.unreachable();
    } catch (err) {
      const text = String(err);
      expect(text).toContain("OPERATOR_PRIVATE_KEY");
      expect(text).not.toContain(badKey);
      expect(text).not.toContain("supersecret");
    }
  });

  it("requires a master key of exactly 32 bytes", () => {
    expect(() => loadWorkerConfig({ ...worker, SHIFT_MASTER_KEY: Buffer.alloc(16).toString("base64") })).toThrow(ConfigError);
  });

  it("accepts an optional previous master key and rejects a short one without echoing it", () => {
    const prev = Buffer.alloc(32, 3).toString("base64");
    expect(loadWorkerConfig(worker).SHIFT_MASTER_KEY_PREV).toBeUndefined();
    expect(loadWebConfig(web).SHIFT_MASTER_KEY_PREV).toBeUndefined();
    expect(loadWorkerConfig({ ...worker, SHIFT_MASTER_KEY_PREV: prev }).SHIFT_MASTER_KEY_PREV).toBe(prev);
    expect(loadWorkerConfig({ ...worker, SHIFT_MASTER_KEY_PREV: "" }).SHIFT_MASTER_KEY_PREV).toBeUndefined();
    const bad = Buffer.alloc(16, 3).toString("base64");
    try {
      loadWorkerConfig({ ...worker, SHIFT_MASTER_KEY_PREV: bad });
      expect.unreachable();
    } catch (err) {
      expect(err).toBeInstanceOf(ConfigError);
      expect(String(err)).toContain("SHIFT_MASTER_KEY_PREV");
      expect(String(err)).not.toContain(bad);
    }
  });

  it("requires the hard stop to be after the start", () => {
    expect(() => loadWorkerConfig({ ...worker, NIGHT_START_UTC: "23:30", NIGHT_HARD_STOP_UTC: "23:10" })).toThrow(ConfigError);
    expect(() => loadWorkerConfig({ ...worker, NIGHT_START_UTC: "25:00" })).toThrow(ConfigError);
  });

  it("bounds the safety margin and the gate threshold", () => {
    expect(() => loadWorkerConfig({ ...worker, SAFETY_MARGIN_PCT: "80" })).toThrow(ConfigError);
    expect(() => loadWorkerConfig({ ...worker, COMMONS_GATE_THRESHOLD: "1.5" })).toThrow(ConfigError);
  });
});

describe("loadWebConfig", () => {
  it("parses a valid environment and the same night knobs the worker uses", () => {
    const c = loadWebConfig(web);
    expect(c.PUBLIC_APP_URL).toBe("https://shift.example");
    expect(c.NIGHT_HARD_STOP_UTC).toBe("23:50");
    expect(c.SAFETY_MARGIN_PCT).toBe(10);
    expect(c.MAX_CONCURRENCY).toBe(3);
    expect(c.COMMONS_GATE_THRESHOLD).toBe(0.75);
  });

  it("does not expose the operator private key to the web app", () => {
    const c = loadWebConfig({ ...web, OPERATOR_PRIVATE_KEY: SECRET_KEY });
    expect(c).not.toHaveProperty("OPERATOR_PRIVATE_KEY");
    expect(JSON.stringify(c)).not.toContain(SECRET_KEY);
  });

  it("requires a session secret of at least 32 characters", () => {
    expect(() => loadWebConfig({ ...web, SESSION_SECRET: "short" })).toThrow(ConfigError);
  });
});
