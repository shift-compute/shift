# Phase 0 results

Summary of the verification spike (plan §21). Every result below comes from a real call against the 0G Router, 0G Storage or 0G Chain; raw evidence is in `docs/spike/` (`SPIKE_RESULTS.json`, `models.json`, `STORAGE_RESULTS.json`, `openapi-excerpt.md`). Nothing is mocked.

Run date: November 5, 2026 (UTC). Legend: ✅ verified · ⏳ blocked, needs an external input · ❓ not checked yet.

## Environment used

| Component | Network | Endpoint |
|---|---|---|
| 0G Router (inference, keys, account) | Mainnet | `https://router-api.0g.ai/v1` |
| 0G Chain (`ShiftLedger`) | Galileo testnet, chain ID 16602 | `https://evmrpc-testnet.0g.ai` |
| 0G Storage | Galileo testnet, turbo indexer | `https://indexer-storage-testnet-turbo.0g.ai` |
| Explorer | Galileo testnet | `https://chainscan-galileo.0g.ai` |

The Router stays on mainnet because iAI and builder credits live there. Chain and Storage run on the testnet by project decision; this must be stated in the README.

## Results

| ID | Check | Result | What we learned |
|---|---|---|---|
| U1 | Credits visible as `credit_balance` | ✅ | `GET /v1/account/balance` returns `credit_balance`, `deposit_balance`, `pending_charge`, `total_balance` and `currency` (`"0g"` for this account). The team account balance is 0, so no spending could be observed. |
| U2 | Key creation fields | ✅ | `POST /v1/api-keys` accepts `trust_mode` and `credit_limit` (a **string**, in 0G units; a JSON number is rejected with `invalid_json`). The response includes `key_id`, `key` (the only usable secret, shown once), `key_preview` (truncated, not usable), `used`, `currency`. |
| U3 | Inference spends credit, not deposit | ⏳ | A chat call returned `402 insufficient_balance` because the account has no balance. Re-run `pnpm smoke` once credits arrive. |
| U4 | Immediate revocation | ✅ | `DELETE /v1/api-keys/:id` returns 200; the next call with that key returns `401`. |
| U5 | `GET /v1/account` | ✅ | Returns `address`, `created_at`, `onboarded_at`, `og_mode_available`. It does not return the currency: read it from `/v1/account/balance`. |
| U6 | Model catalog | ✅ | 124 models, 9 with `TeeML`: `0gm-1.0-35b-a3b`, `0gm-1.0-35b-a3b-sia`, `glm-5.3`, `laya`, `vela-2.0-9b`, `whisper-large-v3`, `z-image-turbo` and two embedding models. Prices come in `pricing_usd` (per token; images per image). |
| U7 | `/v1/decisions` schema | ✅ | `questions` is an object keyed by question name; each question needs `type` (`choice`, `score` or `noul`), `instructions` and `criteria` (a label → description map or a list of labels). The response has `answers.<name>.probabilities` and `choice`. `laya` is priced at 0. |
| U8 | `x_0g_trace` with `verify_tee` | ⏳ | Same blocker as U3 (402 on the chat call). |
| U9 | 0G Storage upload/download | ✅ | Package is `@0gfoundation/0g-ts-sdk`. A 60-byte JSON was uploaded and downloaded back with proof verification; SHA-256 matched. Root hash `0x35eb71f233c5020c97ddacd04435d0021a696633c5d1b6278a7fd296d135d589`. |
| U10 | Chain ID, RPC, deploy | ✅ | Chain ID 16602. `ShiftLedger` is deployed at `0xA3B6664b487FC01c4264977c9B92058A89C31Ed7` with the operator wallet as owner. `forge test`: 7 passed, including TS ↔ Solidity leaf-hash parity. |
| U11 | Submission deadline | ❓ | Needs a look at the ETHGlobal dashboard. The plan quotes November 8, 09:00 IST from one source. |
| U12 | 0G allows delegated use of iAI credits | ❓ | Needs a direct answer from 0G (Gathin, booth). |

## Decisions

1. **Primary mode is budget mode until U3 passes.** U1 shows credits are visible, but we have not seen an inference call paid from `credit_balance`. Per the plan's fallback rule, budget mode stays primary and iAI mode is built behind the same optimizer; switch the default once U3 is confirmed.
2. **Double spending cap is available.** The key limit exists (`credit_limit`), so the optimizer's own accounting is a second cap, not the only one.
3. **Units.** The team account settles in 0G, so `credit_limit` and balances are in 0G units, while the catalog prices are in USD. The plan's micro-USD internal unit needs a verified 0G ↔ USD rate before the optimizer is built (F3.1). Until then, do not assume a rate.
4. **Decision-model calls use the verified schema** (U7). Plan §10.2 and §12.2 were updated. Laya is free; Vela has a small per-token price.
5. **Testnet for chain and storage** (see Environment). The README must say so plainly.
6. **Network resilience.** The local network produces intermittent DNS and connect timeouts. The scripts retry only errors that occur before a request is sent (`UND_ERR_CONNECT_TIMEOUT`, `ENOTFOUND`, `EAI_AGAIN`), so retries never duplicate keys or charges.

## Still open before relying on iAI mode

- Obtain Router credits for the team account, then re-run `pnpm smoke` to close U3 and U8 (and optionally `SMOKE_IMAGE=1` and `SMOKE_AUDIO_FILE` for image and audio traces).
- Confirm U11 and U12.
