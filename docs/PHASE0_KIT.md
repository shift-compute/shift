# Shift — Phase 0 kit

> This file lives at `docs/PHASE0_KIT.md`. Run all commands from the repo root.

First step of the plan (`SHIFT_PLAN.md`, section 21): verify the Plan A assumptions with **real** calls before building on top of them, and have the `ShiftLedger` contract ready.

## What is included

| File | Purpose |
|---|---|
| `scripts/smoke.ts` | Real checks U1–U8 against the 0G Router (balance, catalog, ephemeral key, inference with `verify_tee`, usage history, decisions, revocation). Always revokes the key, even if something fails. |
| `scripts/inspect-openapi.ts` | Extracts the exact schemas from the official OpenAPI spec (per-key limit field, `/v1/decisions`, etc.). |
| `scripts/merkle-vector.ts` | Generates the TypeScript Merkle leaf test vector. |
| `contracts/src/ShiftLedger.sol` | Final anchoring and donations contract. |
| `contracts/test/ShiftLedger.t.sol` | 7 tests, including the **TS ↔ Solidity parity** test for the leaf hash (already passing). |
| `contracts/script/Deploy.s.sol` | Deployment to 0G Chain. |
| `docs/spike/merkle-vector.json` | Vector used by the parity test. |

All scripts compile with strict TypeScript and the contract tests pass (`7 passed`).

## Steps

### 1. Install
```bash
npm install
cp .env.example .env
```

### 2. Team management key
At `https://pc.0g.ai` → Settings → Management Keys → preset **Custom** → tick `account:read`, `keys:create`, `keys:manage`. Paste it into `ZG_MK_KEY` in `.env`. The account needs credits: ask for them in the 0G builders Telegram.

### 3. OpenAPI (before the key check)
Download the specification from `https://0gfoundation.github.io/0g-router/` ("Download OpenAPI specification" button; the raw file is `openapi.yaml` next to the page), save it as `docs/spike/openapi.yaml` (or `.json`) and run:
```bash
npm run inspect-openapi -- docs/spike/openapi.yaml
```
Review `docs/spike/openapi-excerpt.md`. Put the real per-key limit field name in `SMOKE_KEY_LIMIT_FIELD` and a small value in `SMOKE_KEY_LIMIT_VALUE` (in the unit the spec indicates).

### 4. Real check
```bash
npm run smoke
```
- Console summary with ✅ / ❌ per check.
- Full results without secrets in `docs/spike/SPIKE_RESULTS.json` and the catalog in `docs/spike/models.json`.
- Spend: one 5-token chat call and one decision call. Image and audio only if you enable `SMOKE_IMAGE=1` or `SMOKE_AUDIO_FILE`.
- If **U4** (revocation) fails, revoke the key by hand at pc.0g.ai → API Keys.

### 5. Contracts
```bash
cd contracts
git clone --depth 1 --branch v1.9.4 https://github.com/foundry-rs/forge-std lib/forge-std
forge test
```
If `forge` cannot download the compiler, download the `solc-static-linux` v0.8.24 binary from the `ethereum/solidity` releases and use `forge test --use /path/to/solc`.

Deployment (once U10 confirms chain ID and RPC):
```bash
forge script script/Deploy.s.sol --rpc-url zg_mainnet --broadcast --private-key $OPERATOR_PRIVATE_KEY
```
Save the address in `LEDGER_CONTRACT_ADDRESS`.

## How to read the results

| Result | What to decide |
|---|---|
| U1 ✅ and U3 ✅ with `credit_used` | iAI mode confirmed: the budget uses only `credit_balance`. |
| U1 or U3 ❌ | Fallback: budget mode as the primary mode (plan, section 21). |
| U2 ✅ with a limit field | Double cap active (key + optimizer). |
| U2 ✅ without a limit field | Own spend control, reading the balance every 5 calls. |
| U4 ❌ | Blocker: do not launch until revocation is resolved. |
| U7 ❌ | Use the error body and the OpenAPI excerpt to fix the schema; if unresolved, fall back to strict-JSON chat. |

Copy the summary to `docs/SPIKE_RESULTS.md` and share it with the team: that starts Phase 1.
