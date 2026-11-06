# Shift — Full documentation and implementation plan

> Project for **ETHGlobal Mumbai 2026** (in person, November 5–7, 2026, Jio World Centre).
> Main prize: **0G — "Build with 0G PC"** + iAI bonus. Secondary goal: ETHGlobal top 10 finalists.
> Access to user credits: **Plan A — delegation with a management key (`mk-`) and ephemeral `sk-` keys.**

---

## 0. Instructions for the AI that will code this

Read this whole document before writing code. Mandatory rules:

1. **Zero mocked execution.** 0G's DevRel (Gathin, November 5 workshop) said explicitly that they do not want "mock execution": if something does not work, it should stay that way, but real. Never generate fake responses, invented balances, fictitious request IDs or simulated transactions. There is no "demo mode" with fake data.
2. **Certainty labels.** Every technical fact in this document is marked as:
   - **[VERIFIED]**: confirmed in official 0G documentation or reviewed sources.
   - **[VERIFY]**: very likely but unconfirmed; it must be checked in Phase 0 before building on top of it. If the check fails, use the indicated fallback.
3. **Source of truth for the 0G API:** the Router's OpenAPI specification (`https://0gfoundation.github.io/0g-router/`, "Download OpenAPI specification" button). Download it at the start and generate types with `openapi-typescript`. If anything in this document contradicts the specification, **the specification wins**.
4. **Never send `sk-` or `mk-` keys to the browser.** All key usage happens on the server.
5. **Tidy commits: between 50 and 90 across the whole project.** One commit per `PROGRESS.md` item, no giant commits and no hundreds of tiny ones. Full rules in section 27 and in `CLAUDE.md`.
6. **Strict TypeScript** across the project (`"strict": true`). Validate all external input with `zod`.
7. **Repo order:** every file goes where `docs/STRUCTURE.md` says, and `PROGRESS.md` is updated in the same commit as the work it describes.

---

## 1. Product summary

**Shift turns the daily 0G AI credits that would be lost every night into useful, verifiable work: first for the user and, with whatever is left, for a public good.**

### Problem
- iAI credits renew at **00:00 UTC** and **unused credits expire without accumulating** [VERIFIED — official iAI blog].
- Each staked iAI receives **1.271 credits/day** (declared value > $1/day) [VERIFIED].
- Almost nobody uses their full quota every day → wasted value → holding iAI looks less valuable.

### Solution (user flow)
1. **During the day**, the user leaves tasks in a queue (audio to transcribe and summarize, a document to analyze, an idea to turn into an image).
2. **Before the cutoff** (window 23:00–23:50 UTC = 04:30–05:20 IST), an **optimizer** splits the leftover balance across the tasks, choosing for each the cheapest model that meets the required quality, using **0G's decision models** (Laya / Vela).
3. **Whatever is left** is donated to a **commons queue** (translating public Ethereum documentation into Hindi and Marathi), with **dual-model quality control**.
4. **Verifiable provenance:** every result stores its request ID and 0G trace; the nightly batch is anchored on **0G Chain** as a layer of **attribution and curation** (which result belongs to which user, how much each person donated, what entered the dataset), complementing 0G's native inference proof.

### Key adjustment (implicitly requested by 0G)
iAI is a **bonus**, not the main criterion (Gathin). That is why Shift works with **any 0G Private Computer account**:
- **iAI mode:** spends only the leftover `credit_balance` (credits that are about to expire).
- **Budget mode:** the user sets a nightly cap in USD; spending goes up to that cap.

### "What breaks if you remove 0G" sentence (0G submission requirement)
> "Without 0G, there are no expiring daily credits to rescue, no TEE-verified receipts proving which model produced each result, and no on-chain record of who donated compute to the commons."

---

## 2. Hackathon context and evaluation criteria

### Target prize: 0G "Build with 0G PC" — $5,000 (1st $2,500 / 2nd $1,500 / 3rd $1,000) [VERIFIED]
**Must show** (text of 0G's brief):
- Inference on **0G Private Computer in the main flow, with request IDs**.
- A working app that the judge can try, with a clear reason to come back tomorrow.
- One sentence about what breaks if 0G is removed.
- **iAI bonus:** a user connecting their 0G account and their credit balance dropping while they use the app.

**They do not want:** generic chat wrappers; apps where the AI can be removed without anyone noticing.

**0G deliverables** [VERIFIED]:
- Name and short description.
- Public GitHub repo (README + setup instructions).
- Demo video **under 3 minutes** + live demo link.
- Deployed contract addresses.
- Team member names and contact (Telegram and X).

### Tips from 0G's DevRel (workshop, Nov 5)
- Build something with **depth** in the use of AI: use the complexity of the stack, **the decision models**, or use the full flow **more efficiently** than other apps. → This is exactly our optimizer.
- Their own use case for decision models: choosing between a quick answer and deep thinking depending on the task. → The same thing our optimizer does.
- **Share request IDs / receipts as proof** of 0G Compute usage.
- Mainnet credits for building: ask in the **0G builders Telegram group** at ETHGlobal.

### ETHGlobal finalists
- All projects go through general evaluation. To stand out: demonstrable real execution (real nightly cycles with transactions and request IDs), polished interface, a pitch broader than a single sponsor: *"AI compute that was going to be wasted, turned into public goods with verifiable provenance"*.

### Dates
- Real credit cutoffs during the event: **00:00 UTC = 05:30 IST** on November 6, 7 and 8.
- **Goal:** a complete real nightly cycle at the **November 7 cutoff (window 04:30–05:20 IST)**. That window ends before the submission deadline. A cycle on November 8 would be after it.
- Submission deadline: **Saturday 7 November 2026, 09:00 IST**. ETHGlobal does not accept late submissions ([event details](https://ethglobal.com/events/mumbai/info/details) and [start page](https://ethglobal.com/events/mumbai/info/start)).

---

## 3. Scope (MoSCoW)

### Must (core, nothing ships without it)
- M1. 0G account connection with an `mk-` key (Plan A), permission validation and balance reading.
- M2. Ephemeral `sk-` key lifecycle: create → use → revoke, with a spending limit.
- M3. Task queue with 3 types: `AUDIO_SUMMARY`, `DOC_ANALYSIS`, `IMAGE_FROM_PROMPT`.
- M4. Budget optimizer with complexity classification via a decision model.
- M5. Real nightly worker (window 23:00–23:50 UTC) + a "Run now" button that runs **the same real pipeline**.
- M6. Results uploaded to **0G Storage**; trace (`x_0g_trace`, `X-Request-ID`) stored per task.
- M7. `ShiftLedger` contract on 0G Chain + the nightly batch's Merkle tree anchored.
- M8. Public verification page.
- M9. Spending panel: how much was paid with credit vs deposit (if the API exposes it).

### Should
- S1. Commons queue (EN→HI/MR translation) with dual-model quality control + decision model.
- S2. On-chain donation record per user + donors table.

### Could (only if the core is ready by hour 20)
- C1. Encryption of personal results with the browser's public key (sealed box).
- C2. Arkiv integration for the ephemeral queue (see Appendix A).
- C3. Custody of `mk-` keys inside a TEE (dstack / Phala Cloud).

### Won't (out of scope)
- iAI vault (token custody), mobile app, sealed E2EE (`_e2ee`), languages beyond HI/MR, payments.

---

## 4. Architecture

```
                         ┌──────────────────────────────────────────┐
                         │                 Browser                  │
                         │ Next.js UI (no keys, session only)       │
                         └───────────────┬──────────────────────────┘
                                         │ HTTPS (session cookie)
                         ┌───────────────▼──────────────────────────┐
                         │        apps/web  (Next.js 15, API)       │
                         │ - mk- onboarding (encrypts and stores)   │
                         │ - Task CRUD, uploads                     │
                         │ - Plan preview (real prices)             │
                         │ - Verifier (reads contract + proofs)     │
                         └───────┬───────────────────┬──────────────┘
                                 │ Postgres (Prisma) │
                         ┌───────▼───────────────────▼──────────────┐
                         │        apps/worker (Node, cron)          │
                         │ 1. Reads balance (mk-)                   │
                         │ 2. Creates ephemeral sk- with a cap      │
                         │ 3. Optimizes (decision models)           │
                         │ 4. Runs tasks → 0G Router                │
                         │ 5. Commons queue + quality control       │
                         │ 6. Uploads results → 0G Storage          │
                         │ 7. Revokes sk-                           │
                         │ 8. Merkle + anchor → 0G Chain            │
                         └───┬──────────────┬──────────────┬────────┘
                             │              │              │
             ┌───────────────▼───┐  ┌───────▼───────┐  ┌───▼──────────────┐
             │ 0G Router (PC)    │  │ 0G Storage    │  │ 0G Chain (EVM)   │
             │ router-api.0g.ai  │  │ (TS SDK)      │  │ ShiftLedger      │
             │ chat/audio/image/ │  │ root hashes   │  │ roots + donations│
             │ decisions/account │  │               │  │                  │
             └───────────────────┘  └───────────────┘  └──────────────────┘
```

**Important design decision:** 0G already settles a proof for every model interaction (stated in the workshop). **We do not duplicate that proof.** Our Merkle tree anchors **attribution and curation**: membership of each result in the user's batch, donated amounts and approval for the commons queue. The verifier links each result to its native 0G request ID.

---

## 5. Technical stack

| Layer | Technology | Notes |
|---|---|---|
| Monorepo | pnpm workspaces | `apps/web`, `apps/worker`, `packages/core`, `contracts` |
| Language | Strict TypeScript 5.x | Node 20 LTS or 22 LTS |
| Frontend + API | Next.js 15 (App Router), React 19 | Route handlers for the internal API |
| Styling | Tailwind CSS 4 + shadcn/ui | See section 18 for visual direction |
| Wallet (optional) | wagmi v2 + viem v2 + RainbowKit + `siwe` | Only for wallet sign-in; no payments are signed |
| Session | `iron-session` | Encrypted cookie, httpOnly, sameSite=lax |
| Database | PostgreSQL 16 + Prisma ORM | Railway or Neon |
| Validation | `zod` | All external input |
| 0G Router client | `openai` SDK (Router baseURL) + typed `fetch` | Non-standard endpoints (`/v1/decisions`, `/v1/account/*`, `/v1/api-keys`) via fetch + OpenAPI types |
| API types | `openapi-typescript` | Generated from the official spec |
| Worker | Node + `node-cron` + `p-limit` | A single process, lock in the DB |
| PDF | `pdf-parse` | Extract text from documents |
| Merkle | `@openzeppelin/merkle-tree` (StandardMerkleTree) | Compatible with OZ `MerkleProof` |
| Contracts | Foundry (forge) + OpenZeppelin Contracts v5 | Solidity ^0.8.24 |
| 0G Storage | Official 0G Storage TypeScript SDK + `ethers` v6 | Exact package name [VERIFY in docs.0g.ai/…/storage/sdk] |
| Encryption at rest | `node:crypto` AES-256-GCM | For `mk-` keys |
| Result encryption (Could) | `libsodium-wrappers` (crypto_box_seal) | Private key only in the browser |
| Logs | `pino` with secret redaction | Redact `authorization`, `mk-`, `sk-` |
| Tests | `vitest` + `forge test` | |
| Hosting | Railway (web + worker + Postgres) | A persistent process is needed for the worker; Vercel does not work for the worker |

> Pin exact versions in the lockfile. Do not use ranges without a lockfile.

---

## 6. Repository structure

> The repo starts with the Phase 0 kit (`scripts/`, `contracts/`, `docs/`) and becomes this monorepo in item F1.1 of `PROGRESS.md`. The detail of what goes in each folder, and the placement rules, are in `docs/STRUCTURE.md`.

```
shift/
├── apps/
│   ├── web/                         # Next.js (UI + internal API)
│   │   ├── app/
│   │   │   ├── page.tsx             # Home: countdown to the cutoff + status
│   │   │   ├── connect/page.tsx     # mk- connection wizard
│   │   │   ├── queue/page.tsx       # Task queue + plan preview
│   │   │   ├── nights/[id]/page.tsx # Results of a night
│   │   │   ├── commons/page.tsx     # Commons dataset + donors
│   │   │   ├── verify/page.tsx      # Public verifier
│   │   │   └── api/
│   │   │       ├── session/route.ts
│   │   │       ├── connect/route.ts         # POST mk-, DELETE disconnect
│   │   │       ├── account/route.ts         # current balance (via mk-)
│   │   │       ├── tasks/route.ts           # GET/POST
│   │   │       ├── tasks/[id]/route.ts      # GET/DELETE
│   │   │       ├── plan/preview/route.ts    # real estimate with real prices
│   │   │       ├── runs/now/route.ts        # triggers the real pipeline for the user
│   │   │       ├── nights/[id]/route.ts
│   │   │       ├── commons/route.ts
│   │   │       └── verify/[requestId]/route.ts
│   │   └── lib/ (session, auth, ui helpers)
│   └── worker/
│       └── src/
│           ├── index.ts             # cron + lock
│           ├── pipeline/runNight.ts # per-night orchestration
│           ├── pipeline/runUser.ts
│           ├── pipeline/commons.ts
│           ├── pipeline/anchor.ts
│           └── sweeper.ts           # revokes orphaned keys
├── packages/
│   └── core/
│       └── src/
│           ├── zg/router.ts         # 0G Router client (sk- and mk-)
│           ├── zg/types.ts          # generated from OpenAPI
│           ├── zg/models.ts         # catalog, prices, tiers
│           ├── zg/decisions.ts      # /v1/decisions
│           ├── zg/storage.ts        # 0G Storage upload/download
│           ├── zg/chain.ts          # viem client + contract
│           ├── optimizer/           # cost estimation + allocation
│           ├── tasks/               # executors per type
│           ├── crypto/vault.ts      # AES-256-GCM for mk-
│           ├── merkle/              # leaf construction and proofs
│           └── config.ts            # env validated with zod
├── contracts/
│   ├── src/ShiftLedger.sol
│   ├── test/ShiftLedger.t.sol
│   └── script/Deploy.s.sol
├── prisma/schema.prisma
├── scripts/
│   ├── smoke.ts                     # Phase 0: assumption verification
│   └── seed-commons.ts              # loads the commons queue source texts
├── data/commons/                    # source texts (compatible license)
├── docs/ (this file)
└── README.md
```

---

## 7. 0G Router integration (Private Computer)

### 7.1 Base URLs [VERIFIED]
| Network | UI | API |
|---|---|---|
| Mainnet | `https://pc.0g.ai` | `https://router-api.0g.ai/v1` |
| Testnet | `https://pc.testnet.0g.ai` | `https://router-api-testnet.integratenetwork.work/v1` |

Mainnet and testnet have separate balances and keys. **We use mainnet**, because iAI credits and 0G builder credits are mainnet.

### 7.2 Authentication [VERIFIED]
| Type | Prefix | Purpose |
|---|---|---|
| API key | `sk-` | Inference (`/v1/chat/completions`, etc.). Charged against the balance. **Cannot** read `/v1/account/*`. |
| Management key | `mk-` | Account administration: read balance/usage, list/create/revoke `sk-`. **Not charged. Cannot run inference.** |

Both go in `Authorization: Bearer <key>`. There is no OAuth or "Sign in with 0G" for third parties.

**`mk-` permissions (scopes)** [VERIFIED]:
| Action | Endpoint | Scope |
|---|---|---|
| Read balance / usage / history | `GET /v1/account/*` | `account:read` |
| List `sk-` | `GET /v1/api-keys` | `keys:read` |
| Create `sk-` | `POST /v1/api-keys` | `keys:create` |
| Edit / revoke `sk-` | `PATCH` / `DELETE /v1/api-keys/:id` | `keys:manage` |
| Manage other `mk-` | `/v1/management-keys/*` | Impossible with `mk-` (requires a wallet session) |

**Scopes we ask the user for:** `account:read`, `keys:create`, `keys:manage` ("Custom" mode at pc.0g.ai → Settings → Management Keys). We do not ask for `keys:read`: we store the `id` of every key we create and revoke by id.

### 7.3 Endpoints we use
| Use | Method and path | Key | Status |
|---|---|---|---|
| Account data (address, currency) | `GET /v1/account` | `mk-` | Endpoint [VERIFIED]; exact fields [VERIFY] |
| Router ledger balance | `GET /v1/account/balance` | `mk-` | [VERIFIED]: returns `deposit_balance + credit_balance` (and `pending_charge`) |
| Combined balance for display | `GET /v1/account/funds` | `mk-` | [VERIFIED] |
| Usage history | `GET /v1/account/usage/history` | `mk-` | [VERIFIED]; per-request `credit_used` / `deposit_used` documented for USD accounts [VERIFY for 0G accounts] |
| Create ephemeral key | `POST /v1/api-keys` | `mk-` | [VERIFIED] accepts `"trust_mode": "private"`; name of the credit limit field [VERIFY] |
| Revoke key | `DELETE /v1/api-keys/:id` | `mk-` | [VERIFIED] |
| Catalog and prices | `GET /v1/models` | none/`sk-` | [VERIFIED] (includes `pricing`, `pricing_usd`, `e2ee`, capabilities) |
| Chat | `POST /v1/chat/completions` | `sk-` | [VERIFIED], OpenAI-compatible |
| Transcription | `POST /v1/audio/transcriptions` | `sk-` | [VERIFIED]; use `response_format: json` or `verbose_json`; **no** `stream`, **no** `text/srt/vtt` |
| Image | `POST /v1/images/generations` | `sk-` | [VERIFIED]; respect `image_capabilities` (`max_n`, sizes) |
| Decisions | `POST /v1/decisions` | `sk-` | Endpoint [VERIFIED]; shape: `model`, `state`, `questions` with typed answers `choice` / `score` / `noul` and calibrated probabilities [VERIFY exact schema] |

### 7.4 Important headers and fields
- `X-0G-Provider-Trust-Mode: private | verified | standard` [VERIFIED]. If no provider exists for that level: **`503 no_provider_for_trust_mode`**, it never silently downgrades.
- Body `verify_tee: true` → the trace reports `tee_verified` [VERIFIED]. Interpretation: `true` = signature verified; `false` = bad attestation; **absent = no verdict (not a failure)**.
- Response: **`X-Request-ID`** header (the Router's official id, the same as `x_0g_trace.request_id` and the usage history) [VERIFIED]. **Always store it.**
- Response: **`x_0g_trace`** object with `request_id`, `provider`, `provider_identity`, `tee_verified` (if requested) and `billing` (`input_cost`, `output_cost`, `total_cost`, `currency` = `"0g"` (wei) or `"usd"` (micro-USD), and `total_cost_usd_micro` [beta]) [VERIFIED].
- Request header **`X-Client-Request-Id`** (≤ 512 ASCII) to track abandoned requests [VERIFIED, beta]. Use our task's attempt id.
- **An abandoned request is still charged** [VERIFIED]: do not cancel blindly; always record.

### 7.5 Errors to handle
| Code | Meaning | Action |
|---|---|---|
| `402 insufficient_balance` | Not enough balance for the request | Stop the user's batch |
| `402 pay_no_balance` / `pay_insufficient_spendable` / `pay_debt_threshold` | Balance variants (USD accounts) | Stop |
| `429 credit_limit_exceeded` | The ephemeral key hit its cap | **Normal end of the budget**: stop and move on to revoking |
| `429 fair_share_exceeded` / `429` with `Retry-After` | Provider capacity | Retry after `Retry-After`, max. 3 times |
| `401 api_key_revoked` | Key revoked | Expected after revoking |
| `403 insufficient_scope` | Missing permission on `mk-` | Show the user which scope is missing |
| `503 no_provider_for_trust_mode` | No provider at that level | Switch to another model of the same type at that level |
| `503 vault_unavailable` / `pay_gate_unavailable` | Balance read failed | Retry with backoff |
| `400 model_not_capable` / `model_format_mismatch` | Model cannot serve that operation | Exclude the model and replan |

### 7.6 Balance model [VERIFIED]
- `/v1/account/balance` = Router ledger (`deposit_balance + credit_balance`), **excludes** the shared vault (Payment Layer) on 0G accounts.
- USD accounts: amounts in micro-USD. 0G accounts: in wei.
- Promotional credit that is **expired or from another 0G service does not count** as spendable.
- **Our internal unit: micro-USD.** Convert using `x_0g_trace.billing.total_cost_usd_micro` for real costs and the catalog's `pricing_usd` for estimates. If the account is in 0G, convert the balance with the catalog's implied rate [VERIFY] or work in wei for that account (the optimizer accepts both units through an adapter).

### 7.7 Models with enclave privacy (TeeML) — October 2026 [VERIFIED, may change]
| Model | Type |
|---|---|
| 0GM-1.0-35B-A3B | chat (end-to-end encryption available) |
| GLM-5.3 | chat |
| Laya | decision model (context 512 tokens English / 1024 multilingual) |
| Vela 2.0 9B | decision model (context ~16k) |
| Whisper Large v3 | speech to text |
| Z-Image-Turbo | text to image |
| Qwen3 Embedding 0.6B / 8B | embeddings |

**Exact model IDs are read from `GET /v1/models` at runtime; they are never hand-written.** Filter by `verifiability: "TeeML"` for private.

---

## 8. Plan A — Delegation with a management key (full specification)

### 8.1 Onboarding (once per user)
1. The user opens `/connect`. A 4-step wizard is shown with a direct link to `https://pc.0g.ai` → **Settings → Management Keys**.
2. Exact on-screen instructions:
   - Create a key with the **Custom** preset.
   - Tick **only**: `account:read`, `keys:create`, `keys:manage`.
   - Suggested name: `shift`.
   - Copy the key (it is shown only once).
3. The user pastes the key. The server:
   1. Validates the format (`^mk-` + minimum length).
   2. Calls `GET /v1/account` and `GET /v1/account/balance`. On `403 insufficient_scope`, it responds which scope is missing.
   3. **Tests `keys:create` and `keys:manage` without spending:** creates an `sk-` named `shift-probe-<ts>` and revokes it immediately. If it fails, it says which scope is missing.
   4. Encrypts the `mk-` with AES-256-GCM (server master key) and stores `ciphertext`, `iv`, `authTag`. It is **never** stored in plaintext, never logged, never returned to the browser.
   5. Stores `accountAddress`, `currency` and the initial balance.
4. The user chooses the mode: **iAI (credits only)** or **Budget (USD cap)**.
5. **"Disconnect"** button: deletes the encrypted `mk-` and reminds the user to revoke it at pc.0g.ai.

### 8.2 Ephemeral key lifecycle (every night, per user)
```
read balance (mk-)
  → compute budget = spendable − safety margin
  → if budget < useful minimum: skip user
  → create sk- {name: "shift-<YYYYMMDD>-<runId>", trust_mode: "private",
               <limit field>: budget}                    // [VERIFY field name]
  → store keyId + createdAt in NightRun (BEFORE using it)
  → run tasks with sk- (optimizer)
  → finally: DELETE /v1/api-keys/:keyId  → store revokedAt
  → read usage history and final balance → compute creditUsed / depositUsed
```

### 8.3 Security invariants (non-negotiable)
1. **Budget in iAI mode = `credit_balance` − 10 %** (configurable margin). Never include `deposit_balance`.
2. **Double cap:** limit on the key itself (if the API supports it) **and** the optimizer's own accounting, which stops execution before reaching the budget.
3. **Every created key is revoked** in a `finally` block. In addition, a **sweeper** every 10 minutes revokes any key with `revokedAt = null` older than 2 hours.
4. Hard window: nothing runs after **23:50 UTC**.
5. After every request the real cost (`x_0g_trace.billing`) is accumulated. If real spend exceeds the estimate by > 20 %, replan.
6. If the API does **not** allow a per-key limit (U2 fallback): in iAI mode, read `/v1/account/balance` every 5 requests and stop when `credit_balance` ≤ margin. Document this honestly in the README.

### 8.4 "Credits only" proof
- After the batch: `GET /v1/account/usage/history` filtered by the batch's request IDs. Show `credit_used` vs `deposit_used` per request and in totals in the UI.
- If the history does not include that split for 0G accounts (U3 fallback): show `credit_balance` before and after, and `deposit_balance` before and after.

---

## 9. Nightly pipeline (worker)

### 9.1 Scheduling
- `node-cron` checks every minute. Execution window: `NIGHT_START_UTC` (default `23:00`) to `NIGHT_HARD_STOP_UTC` (default `23:50`).
- `nightId` = UTC date in `YYYYMMDD` format of the day that ends at that cutoff.
- **Lock** in the DB (`Night.status = RUNNING` with `UPDATE ... WHERE status = 'PENDING'`) so that only one instance runs.
- **"Run now"** button (`POST /api/runs/now`): runs the real `runUser()` for the current user with `nightId = "manual-<timestamp>"`. Same code, same real calls, same anchoring (in a manual batch). **It is not a simulation.**

### 9.2 `runNight(nightId)`
1. Select connected users with `QUEUED` tasks or with donation mode active.
2. For each user (sequential across users, internal concurrency `MAX_CONCURRENCY = 3`): `runUser(user, nightId)`.
3. `anchorNight(nightId)`: build the Merkle tree with all of the batch's leaves, upload the manifest to 0G Storage, call `anchorNight` and `recordDonations` on the contract.
4. Mark `Night.status = DONE`.

### 9.3 `runUser(user, nightId)`
1. Decrypt `mk-` in memory (never to disk).
2. Read balance → budget (section 8).
3. Create the ephemeral `sk-` (record it in `NightRun`).
4. Load the catalog `GET /v1/models` (10-minute cache).
5. **Plan** with the optimizer (section 10).
6. **Execute** the plan's tasks: for each task → executor by type (section 11) → upload the output to 0G Storage → store trace and real cost → create the Merkle leaf.
7. With the remaining budget → **commons queue** (section 12), attributing the cost as the user's donation.
8. `finally`: revoke `sk-`, wipe `mk-` from memory, read usage history, store the summary in `NightRun`.

### 9.4 Fault tolerance
- A task that fails stays `FAILED` with the real error; it is **not retried indefinitely** (max. 2 retries, only for `429`/`5xx`).
- If the worker crashes mid-batch, on restart the sweeper revokes the key and `RUNNING` tasks go back to `QUEUED` if they have no request ID.

---

## 10. Budget optimizer

### 10.1 Inputs
- `budget` (micro-USD), `deadline` (23:50 UTC), list of tasks (`type`, `priority 1–3`, input size).
- Catalog filtered by type and trust level (prefer `private`; if the type has no private model, `verified`).
- **Relative quality** table per model (config in `packages/core/optimizer/quality.ts`, editable): e.g. chat → `0GM-1.0 = 2`, `GLM-5.3 = 3`. Reasonable initial values; document that they are heuristic.

### 10.2 Complexity classification with a decision model
For each text task, one call to `POST /v1/decisions` with Vela (or Laya if the text fits in 512 tokens):
```json
{
  "model": "<Vela id from /v1/models>",
  "state": "<short task description + first ~1500 characters of the input>",
  "questions": {
    "complexity": {
      "type": "choice",
      "instructions": "How much reasoning does this task need?",
      "criteria": { "simple": "a quick answer is enough",
                    "standard": "some reasoning is needed",
                    "complex": "deep multi-step reasoning is needed" }
    }
  }
}
```
[VERIFIED in Phase 0 (F0.3) with a real call: `questions` is an object keyed by question name; each needs `type` (`choice` | `score` | `noul`), `instructions` and `criteria`. The response is `answers.<name>.probabilities` plus `choice`.] Mapping: `simple → minimum quality 1`, `standard → 2`, `complex → 3`. If the maximum probability < 0.5, use `standard`. The cost of this call is deducted from the budget.

> This replicates what Gathin described in the workshop: using decision models to choose between a quick answer and deep reasoning.

### 10.3 Cost estimation per option (task × model)
- **Chat:** `tokens_in ≈ ceil(chars / 4)`; `tokens_out` by type (summary 400, analysis 700). `cost = tokens_in × pricing_usd.prompt + tokens_out × pricing_usd.completion`.
- **Transcription:** `duration (s) × price per second` from the catalog [VERIFY Whisper price unit]. Duration read from the file at upload (`music-metadata`).
- **Image:** price per image of the size tier (`pricing_usd.variants`) or per tokens if the model charges per tokens.
- **Decision:** catalog price.
- Safety factor: multiply the estimate × 1.15.

### 10.4 Allocation (multiple-choice knapsack, greedy)
```
options(t) = valid models for t with quality ≥ minQuality(t), sorted by cost
plan = {}
remaining = budget
// Step 1: cheap base, by priority
for t in tasks sorted by (priority desc, createdAt asc):
    o = cheapest option of t
    if o.cost ≤ remaining: plan[t] = o; remaining -= o.cost
    else: t is left for the next night (status DEFERRED)
// Step 2: upgrades by best (Δquality × priority_weight) / Δcost
while an upgrade exists with Δcost ≤ remaining:
    pick the upgrade with the highest ratio; apply it; remaining -= Δcost
// Step 3: reserve commons-queue margin
commonsBudget = remaining
```
- **Replanning:** after each executed task, if `real_cost > 1.2 × estimated`, recompute with the real remaining budget.
- **Preview:** `/api/plan/preview` runs the same optimizer with **real** balance and prices and shows it as "tonight's estimate". It is a real calculation, not a simulated execution.

---

## 11. Task types (MVP)

| Type | Input | Steps (real calls) | Output |
|---|---|---|---|
| `AUDIO_SUMMARY` | audio ≤ 10 MB (mp3, m4a, wav) | 1) `/v1/audio/transcriptions` (Whisper, `verbose_json`) 2) `/v1/chat/completions`: summary + key points | JSON `{transcript, summary, keyPoints[]}` |
| `DOC_ANALYSIS` | PDF/TXT/MD ≤ 5 MB | 1) extract text (`pdf-parse`) on the server 2) chat: summary, actions, risks | JSON `{summary, actionItems[], risks[]}` |
| `IMAGE_FROM_PROMPT` | text (idea) | 1) chat: improve prompt 2) `/v1/images/generations` (`b64_json`) | PNG + JSON `{prompt, revisedPrompt}` |

Common rules:
- All calls with `X-0G-Provider-Trust-Mode` according to the chosen level, `verify_tee: true` in the chat/image/audio body when the endpoint accepts it [VERIFY per endpoint], and `X-Client-Request-Id = <taskId>-<attempt>-<step>`.
- Store **every** `X-Request-ID` and `x_0g_trace` of each step in `Task.steps[]`.
- System prompts in English; output in the user's language if detected.
- Input files: stored on a persistent volume (`UPLOAD_DIR`) until processed; deleted 24 h later.

---

## 12. Commons queue with quality control

### 12.1 Source
- Short paragraphs (≤ 120 words) of public Ethereum documentation under a compatible license. Suggested option: ethereum.org content (public repo) [VERIFY license before using it and cite it in the README].
- `scripts/seed-commons.ts` loads ~200 paragraphs into `CommonsItem` with `status = PENDING`, target language `hi` or `mr`.

### 12.2 Process per item (with the donor user's remaining budget)
1. **Translation A:** chat with model A (e.g. 0GM-1.0, private).
2. **Translation B:** chat with a different model B (e.g. GLM-5.3, private).
3. **Quality gate:** `POST /v1/decisions` with a multilingual decision model:
   - `state`: source text + translation A + translation B (short enough to fit the context; multilingual Laya ≈ 1024 tokens; if it does not fit, use Vela 2.0 9B).
   - `choice` question (`instructions`: "Do translation A and translation B convey the same meaning as the source?", `criteria`: `["yes", "no"]`; see the verified schema in section 10.2).
4. Accept **translation A** if `P(yes) ≥ 0.75`; otherwise `REJECTED` with the probability recorded. Rejected items are also shown (proof that the filter works).
5. Upload the accepted item (source, translation, models, request IDs, probability) to 0G Storage.
6. Add the real cost of the 3 steps to the user's donation for that night.

---

## 13. 0G Storage

- Use the official 0G Storage TypeScript SDK (see `docs.0g.ai` → Building on 0G → 0G Storage → SDK). Package name, indexer URL and network [VERIFY in Phase 0].
- **What is uploaded:**
  - Per task: a `TaskOutput` JSON (output + metadata + request IDs + traces) and, if applicable, the image.
  - Per accepted commons item: `CommonsOutput` JSON.
  - Per night: `NightManifest.json` with all leaves, their data and Merkle proofs.
- Store the **root hash** (bytes32) and the transaction hash of every upload.
- The account that pays for uploads is the operator wallet (`OPERATOR_PRIVATE_KEY`) with 0G for gas.
- Fallback if Storage mainnet gives problems: use Storage testnet and declare it in the README (without hiding it).

---

## 14. `ShiftLedger` contract and Merkle tree

### 14.1 Network
| Network | Chain ID | RPC | Explorer |
|---|---|---|---|
| 0G Mainnet | `16661` [VERIFY] | `https://evmrpc.0g.ai` [VERIFY] | `https://chainscan.0g.ai` [VERIFIED] |
| 0G Galileo Testnet | [VERIFY in docs] | `https://evmrpc-testnet.0g.ai` [VERIFY] | testnet explorer [VERIFY] |

- **Deploy on mainnet** (gas is minimal and it is consistent with using mainnet credits). Fallback: Galileo testnet (faucet `https://faucet.0g.ai` [VERIFIED]), declared in the README.
- The operator wallet needs some 0G for gas (ask the 0G team or buy a minimal amount).

### 14.2 Tree leaves (one per inference request)
Use `StandardMerkleTree` from `@openzeppelin/merkle-tree` with this exact encoding:

```ts
const LEAF_TYPES = [
  "bytes32", // requestIdHash   = keccak256(utf8(X-Request-ID))
  "address", // owner           = address of the user's 0G account (or donor in the commons queue)
  "bytes32", // taskIdHash      = keccak256(utf8(taskId or commonsItemId))
  "bytes32", // outputRoot      = 0G Storage root hash of the output
  "bytes32", // modelHash       = keccak256(utf8(modelId))
  "uint8",   // trustTier       = 0 standard, 1 verified, 2 private
  "uint64",  // costUsdMicro    = real cost in micro-USD
  "bool",    // isCommons
] as const;
```
`StandardMerkleTree` double-hashes: `leaf = keccak256(bytes.concat(keccak256(abi.encode(values...))))`. The contract verifies with `MerkleProof.verify` over that `leaf`. **Write a test that compares the hash computed in TS with the one computed in Solidity.**

### 14.3 Contract code
```solidity
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MerkleProof} from "@openzeppelin/contracts/utils/cryptography/MerkleProof.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title ShiftLedger
/// @notice Anchors Shift nightly batches (attribution + curation) and records compute donations.
/// 0G already settles a proof per model interaction; this contract adds WHO each result belongs to,
/// WHO donated compute to the commons, and WHICH commons results passed the quality gate.
contract ShiftLedger is Ownable {
    struct Night {
        bytes32 root;          // Merkle root of all inference leaves in the batch
        bytes32 manifestRoot;  // 0G Storage root hash of NightManifest.json
        uint32 itemCount;
        uint64 anchoredAt;
        bool donationsRecorded;
    }

    /// nightId: YYYYMMDD for scheduled nights, unix seconds for manual runs.
    mapping(uint64 => Night) public nights;
    mapping(uint64 => mapping(address => uint64)) public donatedUsdMicro;
    mapping(address => uint64) public totalDonatedUsdMicro;

    event NightAnchored(uint64 indexed nightId, bytes32 root, bytes32 manifestRoot, uint32 itemCount);
    event DonationRecorded(uint64 indexed nightId, address indexed donor, uint64 amountUsdMicro);

    error AlreadyAnchored(uint64 nightId);
    error NotAnchored(uint64 nightId);
    error DonationsAlreadyRecorded(uint64 nightId);
    error LengthMismatch();

    constructor(address operator) Ownable(operator) {}

    function anchorNight(uint64 nightId, bytes32 root, bytes32 manifestRoot, uint32 itemCount)
        external
        onlyOwner
    {
        if (nights[nightId].anchoredAt != 0) revert AlreadyAnchored(nightId);
        nights[nightId] = Night(root, manifestRoot, itemCount, uint64(block.timestamp), false);
        emit NightAnchored(nightId, root, manifestRoot, itemCount);
    }

    function recordDonations(uint64 nightId, address[] calldata donors, uint64[] calldata amounts)
        external
        onlyOwner
    {
        Night storage n = nights[nightId];
        if (n.anchoredAt == 0) revert NotAnchored(nightId);
        if (n.donationsRecorded) revert DonationsAlreadyRecorded(nightId);
        if (donors.length != amounts.length) revert LengthMismatch();
        n.donationsRecorded = true;
        for (uint256 i = 0; i < donors.length; i++) {
            donatedUsdMicro[nightId][donors[i]] += amounts[i];
            totalDonatedUsdMicro[donors[i]] += amounts[i];
            emit DonationRecorded(nightId, donors[i], amounts[i]);
        }
    }

    function verifyLeaf(uint64 nightId, bytes32[] calldata proof, bytes32 leaf) external view returns (bool) {
        bytes32 root = nights[nightId].root;
        if (root == bytes32(0)) return false;
        return MerkleProof.verify(proof, root, leaf);
    }
}
```

> **Final contract version:** the one in the Phase 0 kit (`contracts/src/ShiftLedger.sol`), which adds the `EmptyRoot` validation and the `leafHash` function for the TS ↔ Solidity parity test (7 tests passing). If it differs from this block, the kit's version wins.

### 14.4 `anchorNight` in the worker
1. Gather all the batch's leaves (tasks + commons queue).
2. Build `StandardMerkleTree.of(values, LEAF_TYPES)`; store the root and each leaf's proof in the DB.
3. Generate `NightManifest.json` (`nightId`, `root`, leaves with values and proofs, human-readable metadata) → upload to 0G Storage → `manifestRoot`.
4. `anchorNight(nightId, root, manifestRoot, count)` → wait for the receipt → store `anchorTx`.
5. `recordDonations(nightId, donors, amounts)` → store `donationsTx`.
6. If the batch is empty, do not anchor.

---

## 15. Public verifier (`/verify`)
1. The user pastes a **request ID** (or opens `/verify?rid=...`).
2. `GET /api/verify/[requestId]` returns: leaf values, proof, `nightId`, `manifestRoot`, the stored `x_0g_trace` (provider, `provider_identity`, `tee_verified`, tier), and the output's 0G Storage root.
3. **In the browser** (do not trust our server for the verdict):
   - Recompute the leaf hash with `StandardMerkleTree.leafHash` / `verify`.
   - Read `nights(nightId)` and call `verifyLeaf` on 0G Chain via public RPC with `viem`.
4. Show: ✔ belongs to the batch anchored in block X (chainscan link), model, trust level, `tee_verified` result (with its correct meaning: absent ≠ failure), and a link to the output in 0G Storage.
5. Optional button: "Verify from the manifest": downloads the manifest from 0G Storage by `manifestRoot` and verifies without using our database.

---

## 16. Database (Prisma)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Mode { IAI_CREDITS_ONLY BUDGET }
enum TaskType { AUDIO_SUMMARY DOC_ANALYSIS IMAGE_FROM_PROMPT }
enum TaskStatus { QUEUED PLANNED RUNNING DONE FAILED DEFERRED CANCELLED }
enum NightStatus { PENDING RUNNING ANCHORING DONE FAILED }
enum CommonsStatus { PENDING RUNNING ACCEPTED REJECTED FAILED }

model User {
  id               String   @id @default(cuid())
  accountAddress   String   @unique          // 0G account address (from GET /v1/account)
  currency         String                    // "usd" | "0g"
  mode             Mode     @default(IAI_CREDITS_ONLY)
  nightlyBudgetUsdMicro BigInt?              // BUDGET mode only
  donateLeftover   Boolean  @default(true)
  mkCiphertext     Bytes?
  mkIv             Bytes?
  mkAuthTag        Bytes?
  mkConnectedAt    DateTime?
  encPublicKey     String?                   // Could: browser public key (base64)
  createdAt        DateTime @default(now())
  tasks            Task[]
  runs             NightRun[]
}

model Task {
  id            String     @id @default(cuid())
  userId        String
  user          User       @relation(fields: [userId], references: [id])
  type          TaskType
  status        TaskStatus @default(QUEUED)
  priority      Int        @default(2)       // 1 low, 2 normal, 3 high
  inputPath     String?                      // file in UPLOAD_DIR
  inputMeta     Json?                        // {bytes, durationSec, mime, chars}
  prompt        String?
  nightId       BigInt?
  complexity    String?                      // simple | standard | complex
  chosenModel   String?
  estCostUsdMicro    BigInt?
  actualCostUsdMicro BigInt?
  steps         Json?                        // [{step, model, requestId, trace, costUsdMicro}]
  outputRoot    String?                      // 0G Storage root hash
  outputTx      String?
  error         String?
  createdAt     DateTime   @default(now())
  updatedAt     DateTime   @updatedAt
  @@index([userId, status])
}

model Night {
  id            BigInt      @id            // YYYYMMDD or unix seconds (manual)
  status        NightStatus @default(PENDING)
  startedAt     DateTime?
  finishedAt    DateTime?
  merkleRoot    String?
  manifestRoot  String?
  anchorTx      String?
  donationsTx   String?
  itemCount     Int         @default(0)
  runs          NightRun[]
  leaves        MerkleLeaf[]
}

model NightRun {
  id               String   @id @default(cuid())
  nightId          BigInt
  night            Night    @relation(fields: [nightId], references: [id])
  userId           String
  user             User     @relation(fields: [userId], references: [id])
  ephemeralKeyId   String?
  keyCreatedAt     DateTime?
  keyRevokedAt     DateTime?
  balanceBefore    Json?
  balanceAfter     Json?
  budgetUsdMicro   BigInt?
  spentUsdMicro    BigInt   @default(0)
  donatedUsdMicro  BigInt   @default(0)
  creditUsed       String?
  depositUsed      String?
  status           String   @default("PENDING")
  error            String?
  @@unique([nightId, userId])
}

model CommonsItem {
  id              String        @id @default(cuid())
  sourceRef       String                     // URL/file + paragraph
  sourceText      String
  targetLang      String                     // "hi" | "mr"
  status          CommonsStatus @default(PENDING)
  translationA    String?
  translationB    String?
  modelA          String?
  modelB          String?
  gateModel       String?
  gateProbability Float?
  requestIds      String[]
  outputRoot      String?
  donorUserId     String?
  nightId         BigInt?
  costUsdMicro    BigInt?
  updatedAt       DateTime      @updatedAt
}

model MerkleLeaf {
  id          String  @id @default(cuid())
  nightId     BigInt
  night       Night   @relation(fields: [nightId], references: [id])
  requestId   String  @unique
  values      Json                           // values in LEAF_TYPES order
  leafHash    String
  proof       Json                           // bytes32[]
}
```

---

## 17. Internal API (Next.js route handlers)

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/connect` | none | Receives `mk-`, validates (section 8.1), creates `User` and session |
| DELETE | `/api/connect` | session | Deletes the encrypted `mk-` |
| GET | `/api/session` | session | Current user, mode, connection status |
| GET | `/api/account` | session | Current balance via `mk-` (`balance` + `funds`) |
| PATCH | `/api/settings` | session | Mode, budget, donate leftover |
| GET/POST | `/api/tasks` | session | List / create task (multipart for files) |
| DELETE | `/api/tasks/[id]` | session | Cancel a queued task |
| GET | `/api/plan/preview` | session | Optimizer with real balance and prices (does not execute) |
| POST | `/api/runs/now` | session | Runs the real pipeline now (rate limit: 1 per 10 min) |
| GET | `/api/nights/[id]` | session/partially public | User's results + public batch data |
| GET | `/api/commons` | public | Accepted/rejected items + donors (from the contract) |
| GET | `/api/verify/[requestId]` | public | Verification data (section 15) |
| GET | `/api/outputs/[taskId]` | session | Downloads the output from 0G Storage |

Session: `iron-session` cookie with `userId`. **Identity = the 0G account of the `mk-`.** Signing in again = pasting the `mk-` again (validated against the stored `accountAddress`). SIWE with a wallet is optional and only if the address matches the 0G account's.

---

## 18. Frontend

### 18.1 Pages
1. **Home (`/`)**: live countdown to the next 00:00 UTC (with IST time), tonight's spendable balance, queue status and a "Connect your 0G account" button.
2. **Connect (`/connect`)**: 4-step wizard (section 8.1) with screenshots or clear pointers to where "Management Keys" is in pc.0g.ai.
3. **Queue (`/queue`)**: add tasks (upload audio/document, write an image idea, priority), task list and **plan preview** for tonight (chosen model, detected complexity, estimated cost, what is left for the commons queue).
4. **Night (`/nights/[id]`)**: results with their **provenance card** (request IDs, model, trust level, `tee_verified`, cost, 0G Storage root, link to the verifier) and the credit vs deposit spending summary.
5. **Commons (`/commons`)**: accepted and rejected translations with the filter's probability, total donated per user (read from the contract).
6. **Verify (`/verify`)**: section 15.

**Interface language: English** (international judges). Text in sentence case, clear verbs: "Connect your 0G account", "Add task", "Run tonight's shift now", "Verify a result".

### 18.2 Visual direction
Concept: **an early-morning shift in Mumbai**: a 4 AM sky and sodium streetlight glow, brightening toward sunrise when the batch finishes.

| Token | Hex | Use |
|---|---|---|
| Sky 4 AM | `#1D2550` | Background |
| Late night | `#28316B` | Surfaces |
| Sodium | `#F3A33C` | Primary action, budget |
| First light | `#F7D9C4` | Completed states, sunrise |
| Haze | `#C9D1E8` | Secondary text |
| Paper | `#F6F7FB` | Primary text |

- Typography: **Familjen Grotesk** (headings) + **Atkinson Hyperlegible** (text and numbers), with system fallbacks.
- **Signature element (the one place for boldness):** the "night strip": a horizontal bar from now until 00:00 UTC where each task is a block whose width is proportional to its cost; during execution the budget is consumed from left to right and the background goes from Sky 4 AM to First light when finished. Everything else, restrained.
- No all-caps tracked labels, no identical cards with generic shadows, no entrance animations on every section. Accessible: visible focus, `prefers-reduced-motion` respected, responsive down to mobile.

---

## 19. Security
1. `mk-` encrypted with AES-256-GCM (`SHIFT_MASTER_KEY`, 32 random bytes in base64), a unique 12-byte IV per encryption. Decrypted only in the memory of the worker or the handler that needs it.
2. No key (`mk-`, `sk-`) in logs, API responses, error messages or the browser. `pino` with `redact: ["req.headers.authorization", "*.mk", "*.sk", "*.apiKey"]` and a regex filter `/(mk|sk)-[A-Za-z0-9_-]+/g → "[REDACTED]"`.
3. Ephemeral `sk-` keys: cap, `private` tier, identifiable name, revocation in `finally` + sweeper.
4. Uploads: validate MIME type and size; random file names; never execute files.
5. Rate limits: `/api/connect` 5/min per IP; `/api/runs/now` 1 per 10 min per user.
6. CORS closed to our own domain. Cookies `httpOnly`, `secure`, `sameSite=lax`.
7. `OPERATOR_PRIVATE_KEY` only in the worker. The web app only reads the chain.
8. **iAI terms:** confirm with 0G (Gathin, booth) that using credits through delegated keys and donating the leftover is allowed. Document the answer.

---

## 20. Environment variables

| Variable | Example / value | Used by |
|---|---|---|
| `DATABASE_URL` | `postgresql://...` | web, worker |
| `SESSION_SECRET` | 32+ random characters | web |
| `SHIFT_MASTER_KEY` | base64 of 32 bytes | web, worker |
| `ZG_ROUTER_BASE_URL` | `https://router-api.0g.ai/v1` | core |
| `ZG_CHAIN_ID` | `16661` [VERIFY] | core |
| `ZG_CHAIN_RPC_URL` | `https://evmrpc.0g.ai` [VERIFY] | core |
| `ZG_EXPLORER_URL` | `https://chainscan.0g.ai` | web |
| `LEDGER_CONTRACT_ADDRESS` | `0x...` (after deploying) | core |
| `OPERATOR_PRIVATE_KEY` | `0x...` (worker only) | worker |
| `ZG_STORAGE_INDEXER_URL` | [VERIFY in the Storage docs] | worker, web |
| `NIGHT_START_UTC` | `23:00` | worker |
| `NIGHT_HARD_STOP_UTC` | `23:50` | worker |
| `SAFETY_MARGIN_PCT` | `10` | worker |
| `MAX_CONCURRENCY` | `3` | worker |
| `UPLOAD_DIR` | `/data/uploads` (persistent volume) | web, worker |
| `COMMONS_GATE_THRESHOLD` | `0.75` | worker |
| `PUBLIC_APP_URL` | `https://shift-...` | web |

Validate all of them with `zod` at startup; if any is missing, the process does not start.

---

## 21. Phase 0 — Verification spike (first 2 hours, MANDATORY)

Create `scripts/smoke.ts` that runs these **real** checks with the team account (with credits requested in the 0G builders Telegram). Record results in `docs/SPIKE_RESULTS.md`.

| ID | What to verify | How | Fallback if it fails |
|---|---|---|---|
| U1 | Credits show up in `credit_balance` | `GET /v1/account/balance` with `mk-` (`account:read`) | Use `/v1/account/funds`; if credits are not distinguishable, offer only **budget mode** and explain it |
| U2 | Fields of `POST /v1/api-keys`: credit limit and `trust_mode` | Read OpenAPI + create a real key | No per-key limit → own spend control (section 8.3, point 6) |
| U3 | Inference with the new `sk-` consumes credit, not deposit | 1 minimal chat + `GET /v1/account/usage/history` (`credit_used`/`deposit_used`) | Compare balances before/after |
| U4 | Immediate revocation | `DELETE /v1/api-keys/:id` → next call `401 api_key_revoked` | — (critical; if it fails, do not launch) |
| U5 | `GET /v1/account` returns address and currency | Real call | Use the root/identifier it returns; if there is no address, identity = hash of the `mk-` |
| U6 | Catalog: TeeML model IDs, prices, units (Whisper per second, images per tier) | `GET /v1/models` | Adjust the estimator |
| U7 | `/v1/decisions` schema and Laya/Vela IDs | OpenAPI + real call | If it fails: complexity classification with a cheap chat in strict JSON (still real; document it) |
| U8 | `x_0g_trace` with `verify_tee: true` on chat, image and audio | Real calls | If an endpoint does not accept `verify_tee`, omit it only there |
| U9 | 0G Storage: package, indexer, upload and download, root format | Upload and download a JSON | Storage testnet, declared |
| U10 | Mainnet chain ID and RPC; deploy a test contract | `cast chain-id`, `forge create` | Galileo testnet, declared |
| U11 | Submission date and deadline time | ETHGlobal dashboard | — |
| U12 | 0G's permission for delegated use of iAI credits | Ask Gathin at the booth | If they say no: budget mode as the primary mode |

**Rule:** nothing that depends on an assumption is built before its check passes or has a decided fallback.

---

## 22. Work plan by phases and hours

Assumption: a team of 3 people, ~24 effective hours each. **H0 = the moment coding starts.**

| Phase | Hours | Person A (backend / 0G) | Person B (contracts / storage) | Person C (frontend / demo) |
|---|---|---|---|---|
| F0 Spike | H0–H2 | `smoke.ts` U1–U8, U12 | U9–U10, monorepo scaffold, Foundry | Ask for credits on Telegram, Next.js scaffold, visual direction |
| F1 Connection | H2–H8 | Router client (`packages/core/zg`), `mk-` onboarding, AES vault, `sk-` lifecycle | Contract + forge tests + deploy | `/connect`, `/` with countdown, session |
| F2 Execution | H8–H14 | Executors for the 3 types, worker + cron + lock, sweeper | 0G Storage client, output uploads, TS Merkle + parity test with Solidity | `/queue` with uploads and plan preview |
| F3 Optimizer and anchoring | H14–H20 | Optimizer + decisions + replanning | `anchorNight`, manifest, `recordDonations`, `/api/verify` | `/nights/[id]` with provenance cards, `/verify` |
| **Checkpoint H20** | — | **The whole core (M1–M9) working end to end with a real "Run now" execution anchored on 0G Chain.** If not, the whole team closes the core; S and C are cancelled. | | |
| F4 Commons | H20–H26 | Commons queue + quality gate | Text seed (license), donations on the contract | `/commons`, animated night strip |
| Real cycle | window 04:30–05:20 IST on Nov 7 | Monitor the real nightly batch | Verify anchoring on chainscan | Screenshots and recording for the video |
| F5 Extras | H26–H30 | (Could) C1 encryption / C3 TEE | (Could) Appendix A Arkiv | Polish, mobile, accessibility |
| F6 Delivery | last 4–6 h | README, request ID table | Addresses and links | Video < 3 min, pitch, submission |

**Cut order if behind schedule:** C1 → C2 → C3 → S2 → dual-model gate (keep one model + decision) → full S1. **Never cut:** optimizer, key lifecycle, anchoring on 0G Chain, verifier.

---

## 23. Tests

1. **Unit (`vitest`)**
   - Optimizer: budget 0, exact budget, deferred tasks, greedy upgrades, replanning on drift.
   - Cost estimator with fixed example prices.
   - AES-GCM vault: encrypt/decrypt, tampered auth tag → error.
   - Merkle: tree with 1 and N leaves; **parity** of the `leafHash` TS vs Solidity (shared fixed vector).
   - Log redaction: no `mk-`/`sk-` string survives.
2. **Contracts (`forge test`)**: owner only, double anchoring reverts, duplicate donations revert, `verifyLeaf` true/false with the TS vector.
3. **Real integration (`scripts/smoke.ts` and `scripts/e2e.ts`)**: with the team account: connect → 1 task of each type → "Run now" → verify at `/verify`. Minimal cost.
4. **Manual checklist before the real cycle**: worker running, server clock in UTC, operator with gas, sweeper active, logs without secrets.

---

## 24. Demo script (3 minutes)

| Time | What is shown | What is said |
|---|---|---|
| 0:00–0:20 | Home: countdown to the cutoff | "Every night at 00:00 UTC, unused 0G compute credits expire. By design." |
| 0:20–0:45 | Connect an account with a minimum-permission `mk-` | "No OAuth exists for third-party apps, so we built scoped delegation: Shift can read balances and mint short-lived capped keys, nothing else." |
| 0:45–1:15 | Queue with 3 tasks + plan preview | "0G's decision models classify each task, and our optimizer picks the cheapest model that meets the quality bar — fast answers for simple tasks, deep reasoning for hard ones." |
| 1:15–1:55 | "Run tonight's shift now": **real** execution, balance dropping, results appearing | "This is a real run on 0G Private Computer, in TEE-sealed models. The key is created, capped, used, and revoked." |
| 1:55–2:25 | Commons queue: one accepted and one rejected translation | "What's left goes to the commons: Ethereum docs in Hindi and Marathi, accepted only when two models agree according to 0G's decision model." |
| 2:25–2:50 | Verifier with a request ID from the **real nightly cycle** of Nov 7 | "Anyone can verify which model produced it, who it belongs to, and who donated the compute — anchored on 0G Chain, stored on 0G Storage." |
| 2:50–3:00 | Close | "Without 0G, these credits don't exist and these results have no proof of origin. Shift makes every iAI credit count." |

Record the video with a real cycle already completed as a backup, but run a real "Run now" live.

---

## 25. Submission checklist

**README.md** must include:
- [ ] What Shift is (2 paragraphs) and the "what breaks without 0G" sentence.
- [ ] How it uses 0G: Private Computer (models, trust levels), decision models, 0G Storage, 0G Chain (contract address).
- [ ] **Table of real request IDs** from the nightly cycles (date, task, model, request ID, link to the verifier).
- [ ] `ShiftLedger` address and anchoring transactions (chainscan links).
- [ ] Manifest root hashes on 0G Storage.
- [ ] Architecture (diagram from section 4).
- [ ] Step-by-step local installation and environment variables.
- [ ] Honest limitations (Phase 0 results, fallbacks used).
- [ ] How AI was used to code (ETHGlobal rule).
- [ ] License of the code (MIT) and of the commons queue texts.

**ETHGlobal / 0G form:**
- [ ] Name and short description.
- [ ] Public repo with a steady commit history.
- [ ] Demo video < 3 min.
- [ ] Live demo link.
- [ ] Contract addresses.
- [ ] Team members with Telegram and X.
- [ ] Selected prizes: 0G (Build with 0G PC) + up to 2 more (Arkiv if Appendix A was done).

---

## 26. Risks and mitigations

| Risk | Probability | Mitigation |
|---|---|---|
| iAI credits not distinguishable or not usable via the Router | Medium | U1/U3 in Phase 0; budget mode as a real fallback |
| `POST /v1/api-keys` without a per-key limit | Medium | Own spend control + balance read every 5 calls |
| Different `/v1/decisions` schema | Medium | Read OpenAPI first; fallback with strict-JSON chat |
| Private provider saturated (`429`, `503`) | Medium | Retries with `Retry-After`; alternative model of the same type |
| 0G Storage slow or down | Low-medium | Retries; testnet declared as a fallback |
| Worker down during the nightly window | Low | Log alerts, sweeper, real manual run as a backup |
| A judge sees the Merkle tree as redundant | Medium | Explain: attribution + curation, not inference proof (section 4) |
| `mk-` leak | Low | Encryption at rest, log redaction, minimum scopes, revocable by the user |
| iAI terms do not allow the use | Low | Confirm with 0G (U12); budget mode |
| Insufficient time | Medium | H20 checkpoint and cut order |

---

## Appendix A — Optional Arkiv integration (only if the core is ready at H20)

- **Idea:** the pending-task queue as Arkiv entities that **expire at the next 00:00 UTC**, just like the credits. 0G still stores everything permanent (outputs, manifest, anchoring).
- **Requirements of the "Build on Arkiv (from scratch)" prize** [VERIFIED on the prizes page]: write to the current Arkiv testnet with `@arkiv-network/sdk` or JSON-RPC; at least one user-visible feature that **reads** from Arkiv; README with the wallets that wrote entities and an executable query; files `/arkiv/schema.md`, `/arkiv/friction.md`, `/arkiv/reach.md`, `/arkiv/why-arkiv.md`, `/arkiv/how-you-use-arkiv.md`; repo with an open license; declare AI usage.
- **Minimal implementation:** when a task is created, create an entity `{taskId, owner, type, priority}` expiring at the next cutoff; the `/queue` page reads the queue from Arkiv; the worker marks the entity as processed.
- **Time budget:** a fixed 6 h window. If it is not working by then, remove it without touching the core.

---

## Appendix B — Base prompts

**AUDIO_SUMMARY (summary):**
```
System: You summarize transcripts. Respond ONLY with JSON:
{"summary": string (max 120 words), "keyPoints": string[] (max 6)}.
Write in the same language as the transcript.
User: <transcript>
```

**DOC_ANALYSIS:**
```
System: You analyze documents. Respond ONLY with JSON:
{"summary": string (max 150 words), "actionItems": string[], "risks": string[]}.
Write in the same language as the document. Do not invent facts that are not in the text.
User: <document text, truncated to the model's context budget>
```

**IMAGE_FROM_PROMPT (improve prompt):**
```
System: Rewrite the user's idea into one detailed image prompt (max 60 words).
No real people, no logos, no copyrighted characters. Respond ONLY with the prompt.
User: <idea>
```

**Translation (commons queue):**
```
System: Translate the text from English to <Hindi|Marathi>. Keep technical terms
(Ethereum, smart contract, gas, wallet) in their common usage. Respond ONLY with the translation.
User: <source paragraph>
```

Validate every JSON output with `zod`; if parsing fails, 1 retry with the error message; if it fails again, the task stays `FAILED` (real, without inventing content).

---

## Appendix C — Glossary and references

- **iAI (Infinite AI):** a 0G asset; when staked it gives 1.271 credits/day, which renew at 00:00 UTC without accumulating.
- **`mk-` / `sk-`:** management / inference keys of the 0G Router.
- **TeeML / private:** the model runs inside a TEE enclave; neither 0G nor the provider sees the inference.
- **verified:** the response came from the real model (route attestation); **standard:** no verification.
- **`x_0g_trace`:** per-response trace with request ID, provider and costs.
- **Decision models (Laya, Vela):** they answer typed questions with probabilities, not text.

**Official references**
- 0G Router (overview): `https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/overview`
- Authentication (`mk-`/`sk-`, scopes): `https://docs.0g.ai/developer-hub/building-on-0g/compute-network/router/authentication`
- Router API + OpenAPI + changelog: `https://0gfoundation.github.io/0g-router/`
- Privacy and trust levels: `https://0g.ai/blog/data-privacy-on-0g-private-computer`
- iAI: `https://0g.ai/blog/introducing-infinite-ai` and `https://0g.ai/blog/infinite-ai-technical-breakdown`
- Compute Finance: `https://0g.ai/blog/compute-finance`
- ETHGlobal Mumbai prizes: `https://ethglobal.com/events/mumbai/prizes`
- General 0G docs (Storage, Chain): `https://docs.0g.ai`
- 0G workshop at ETHGlobal Mumbai (Gathin T): `https://www.youtube.com/live/by9Rm-Vh1qY`

---

## 27. Repository order, tracking and commits

The ETHGlobal presentation includes the repo: judges see the structure, the README and the commit history. These rules are mandatory.

### 27.1 Order files (included in the kit)
| File | Purpose | Language |
|---|---|---|
| `CLAUDE.md` | Working rules that Claude Code reads automatically on every task | English |
| `PROGRESS.md` | Living list: done, next, Phase 0 results, real runs, decisions, blockers | English |
| `docs/STRUCTURE.md` | Current structure and monorepo target; where each file goes | English |
| `README.md` | Public README for judges; filled in during F6 only with real data | English |
| `docs/PHASE0_KIT.md` | How to run the Phase 0 kit | English |
| `LICENSE` | MIT | English |

**Every file in the repo is written in English** (code, comments, docs, this plan). Chat with the user may be in any language, but nothing Spanish is committed.

No other markdown files are created in the root; sections are added to the existing ones.

### 27.2 Flow per item
1. Take the next unchecked item in `PROGRESS.md`.
2. Implement only that item and its tests.
3. Run typecheck, tests and `forge test` if contracts change.
4. Tick the item in `PROGRESS.md` (with a note if anything changed versus the plan) **in the same commit**.
5. Commit + push. Brief summary to the user.

### 27.3 Commit rules
- **Target: 50–90 commits across the whole project** (`PROGRESS.md` plans ~58 plus a few `fix:` commits).
- **One commit = one item** of `PROGRESS.md` that builds and passes tests; large items are split into 2–3 commits.
- **Size guide:** 50–400 lines of hand-written code per commit (lockfiles, generated types and assets do not count).
- **No noise:** fixes to a not-yet-pushed commit go in with `git commit --amend`; fixes to already-pushed work go in a single `fix:`.
- **Conventional Commits format in English**, imperative, ≤ 72 characters: `feat(core): add budget optimizer with greedy upgrades`. Types: `feat`, `fix`, `test`, `docs`, `chore`, `refactor`. Scopes: `core`, `web`, `worker`, `contracts`, `db`, `scripts`, `spike`.
- **No AI attribution lines** in commits or PRs; AI usage is declared once in the README ("How we used AI"), as ETHGlobal asks.
- **Steady rhythm** throughout the hackathon; never accumulate hours of work in a single commit. Do not rewrite already-pushed history unless the user asks.
