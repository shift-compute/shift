# Shift

**Shift rescues 0G compute credits that would expire at 00:00 UTC and turns them into useful work, a public commons, and verifiable provenance.**

During the day you queue audio summaries, document analyses, and image prompts. Before the cutoff, Shift reads your 0G balance, mints a short-lived capped key, and spends that balance on the cheapest model that still meets the quality bar. Whatever is left goes to a public queue: English excerpts from ethereum.org, translated into Hindi and Marathi, kept only when a decision model accepts them. Each completed personal inference is a Merkle leaf. The night's root is anchored on 0G Chain so anyone can check who owns a result and which model produced it.

> Without 0G, there are no expiring daily credits to rescue, no TEE-verified receipts proving which model produced each result, and no on-chain record of who donated compute to the commons.

Built for ETHGlobal Mumbai 2026 (0G "Build with 0G PC", and the general finalist track). Submission deadline: **Saturday 7 November 2026, 09:00 IST**. Late submissions are not accepted.

| | |
|---|---|
| Network for the contract and storage | **0G Galileo testnet, chain ID 16602.** This project has no mainnet (chain ID 16661) deployment. |
| ShiftLedger | [`0xA3B6664b487FC01c4264977c9B92058A89C31Ed7`](https://chainscan-galileo.0g.ai/address/0xA3B6664b487FC01c4264977c9B92058A89C31Ed7) |
| Live demo | Not deployed yet. The URL lands here in F6.1. Until then, run it locally (below). |
| Demo video | Not recorded yet. The link lands here in F6.4. The 3-minute script is [plan §24](docs/SHIFT_PLAN.md). |
| Real inference runs | **None recorded.** The team account still has `credit_balance` 0 and `deposit_balance` 0. F3.12 and F4.7 stay open. The request-id table below is empty on purpose. |
| Status log | [`PROGRESS.md`](PROGRESS.md) · Phase 0 write-up: [`docs/SPIKE_RESULTS.md`](docs/SPIKE_RESULTS.md) |

## How a night works

1. **Connect** (`/connect`). You paste a 0G management key (`mk-`) with `account:read`, `keys:create`, and `keys:manage`. Shift encrypts it at rest (AES-256-GCM, bound to your account address). The browser never receives the key again.
2. **Queue** (`/queue`). Add an audio file, a document, or an image prompt. Tonight's preview prices the live catalog and your live balance. It does not create a key and does not call inference.
3. **Run.** The worker opens the window at 23:00 UTC and hard-stops at 23:50 UTC (04:30–05:20 IST). **Run tonight's shift now** (`POST /api/runs/now`) uses that same pipeline. Shift creates an ephemeral `sk-` capped to the night's budget, calls the 0G Router, uploads outputs to 0G Storage, and revokes the key before it returns. A sweeper revokes keys left alive for more than two hours.
4. **Commons** (`/commons`). Leftover budget, when you donate it, pays for two private translations and a decision-model gate.
5. **Anchor.** Personal steps that finished with a request id become Merkle leaves. `ShiftLedger.anchorNight` stores the root and the manifest's storage root. Positive donations are written with `recordDonations` only after that anchor.
6. **Verify** (`/verify?rid=`). Anyone can recompute the leaf in the browser and ask the contract.

Two spending modes share that pipeline. **Budget mode** is the primary one: a nightly USD cap, and the deposit may be spent up to that cap. **iAI mode** spends `credit_balance` minus a safety margin and does not touch the deposit. iAI mode stays secondary until 0G confirms that delegated use of iAI credits is allowed (Phase 0 check U12 is still open) and until a paid call shows credits moving (U3 is blocked on a 0 balance).

## How Shift uses 0G

- **Private Computer (Router).** Chat, audio, and image models, plus account, balance, and key APIs. Trust tiers are standard, verified (TeeTLS), and private (TeeML). An ephemeral key is pinned to the tier the plan chose. If the catalog has no TeeML model that can run the task, private mode defers the task. It does not silently drop to a weaker tier.
- **Decision models.** One `/v1/decisions` call classifies each text task (simple / standard / complex) and sets the quality floor. A second call is the commons gate. Model ids come from the live catalog. Nothing is hard-coded. If that catalog has no decision model, classification plans `standard` and does not call the Router, and commons rows stay `RUNNING`.
- **0G Storage.** Task outputs and `NightManifest.json` go to the Galileo turbo indexer (`https://indexer-storage-testnet-turbo.0g.ai`) via `@0gfoundation/0g-ts-sdk`. The operator wallet pays gas. Phase 0 uploaded and downloaded one file on that indexer; the root is in [What was actually checked](#what-was-actually-checked). No night manifest has been uploaded, because no night has run.
- **0G Chain.** `ShiftLedger` anchors attribution (who owns the result, which model, what it cost, whether it was commons work) and records donated micro-USD. 0G already attests each model call. This contract does not redo that proof.

The example Router base URL is the mainnet Router, `https://router-api.0g.ai/v1`, because that is where the team account was read. `.env.example` also lists the testnet Router. Chain id `ZG_CHAIN_ID` is **16602**.

## Architecture

```
Browser (no mk- / sk- keys, session cookie only)
        │
        ▼
apps/web          Next.js 15 — pages, route handlers, plan preview, verifier
        │
        │  PostgreSQL (Prisma)
        ▼
apps/worker       cron 23:00–23:50 UTC, sweeper, anchor, recordDonations
        │
        └── both call packages/core
              router client · vault · optimizer · executors
              merkle leaves · storage · chain
                    │              │              │
                    ▼              ▼              ▼
              0G Router      0G Storage     ShiftLedger
              (account in    Galileo        Galileo 16602
               .env)         indexer        0xA3B6…1Ed7
```

`packages/core` is the only place shared by the web app and the worker. The browser does not import it. Layout: [`docs/STRUCTURE.md`](docs/STRUCTURE.md).

## Contract

| | |
|---|---|
| Contract | ShiftLedger |
| Network | 0G Galileo testnet |
| Chain ID | 16602 |
| RPC | `https://evmrpc-testnet.0g.ai` |
| Address | [`0xA3B6664b487FC01c4264977c9B92058A89C31Ed7`](https://chainscan-galileo.0g.ai/address/0xA3B6664b487FC01c4264977c9B92058A89C31Ed7) |
| Deploy transaction | [`0x4a2bd7c707056195ef102420a6e3e3ebed0442e2399d91eef49bdd495d0f7117`](https://chainscan-galileo.0g.ai/tx/0x4a2bd7c707056195ef102420a6e3e3ebed0442e2399d91eef49bdd495d0f7117) |
| Owner | `0x3E7E6733f1E0Fbb55035d6791a77e596ab11aD07` (operator wallet) |
| Source | [`contracts/src/ShiftLedger.sol`](contracts/src/ShiftLedger.sol) |

`anchorNight` and `recordDonations` are owner-only. `verifyLeaf(nightId, proof, leaf)` is a public view. An empty root returns false. No night has been anchored, so there is no anchor transaction and no manifest root to list yet. Those links are added in F6.3 only after a real batch.

`forge test`: 7 passed in Phase 0, including TypeScript ↔ Solidity leaf-hash parity (`docs/spike/merkle-vector.json`).

## Verifier

Open `/verify?rid=<request id>` or paste an id on [`/verify`](apps/web/app/verify/page.tsx).

1. `GET /api/verify/[requestId]` returns the packed leaf, the proof, the night id, the manifest root, the output's storage root, and the trace fields safe to show (provider, provider identity, `tee_verified`, trust tier). Vault columns, billing, and raw secrets are not copied. An unknown id is 404.
2. **In the browser**, the page recomputes the leaf hash (the same bytes as OpenZeppelin `StandardMerkleTree`) and checks the proof against the stored root.
3. It then reads `nights(nightId)` and calls **`verifyLeaf`** on ShiftLedger through viem and the public Galileo RPC (`LEDGER_CONTRACT_ADDRESS`).

A missing `tee_verified` is shown as "no verdict". It is not treated as a failed attestation. The page links the manifest root. It does not download that file to re-check the batch without the database.

There is no request id to paste today. A read of `nights(1)` on Galileo during the build returned the zero night, and `verifyLeaf` returned false for it. That was a read of an empty slot, not a completed Shift run.

## Commons

Sources are 200 excerpts (20–120 words) from [ethereum.org](https://ethereum.org/), commit `c362ca84b53659a924d360ac02ca5a99987cacb3` of `ethereum-org-website`. Non-code content is **CC BY 4.0**. Attribution, the terms quote, and what was edited are in [`data/commons/NOTICE.md`](data/commons/NOTICE.md). The website repository's MIT license covers code, and no code from that repository is included. `pnpm seed:commons` loads the rows (100 Hindi, 100 Marathi).

For each item the donor can afford:

1. **Two different private chat models** translate the same English paragraph (Hindi or Marathi). Ids are picked from the catalog (higher quality, then cheaper). They are not hard-coded.
2. A **decision model** is asked whether both translations carry the source meaning. Translation A is `ACCEPTED` only when `P(yes)` is at least `COMMONS_GATE_THRESHOLD` (default **0.75**). Otherwise the row is `REJECTED` and both texts stay visible.
3. An accepted row is uploaded as CommonsOutput JSON (source, translation A, both translation models, the gate model, request ids, probability).

`/commons` lists accepted and rejected rows and the donated micro-USD per 0G account. Pending and in-progress rows stay off the page. The page is empty until a real pair passes the gate.

Commons rows are **not** in the Merkle tree. A row stores one aggregate cost and a flat list of request ids, and a rejected row has no storage root. A leaf would have to invent the per-request cost or root, which the anchor refuses to do. Personal leaves stay `isCommons: false`. Donation totals on `/commons` are summed from the database. The contract's `totalDonatedUsdMicro` only includes nights that were anchored before `recordDonations`, so a public RPC read would hide a commons-only night.

If the catalog has fewer than two private chat models, or no decision model, the queue waits. Rows are not marked accepted to fill the page.

## Run it locally

Node 20 or 22, pnpm 11.8.0 (`packageManager` in `package.json`), and PostgreSQL 16. Foundry is only needed for `pnpm test:contracts` (`contracts/lib/forge-std` is already in the repo).

```bash
pnpm install
cp .env.example .env
pnpm db:migrate
pnpm seed:commons
pnpm dev
```

The web app listens on `http://localhost:3000` (`PUBLIC_APP_URL`). In another shell, the nightly worker:

```bash
pnpm --filter @shift/worker dev
```

Generate `SHIFT_MASTER_KEY` with `openssl rand -base64 32` and pick a `SESSION_SECRET` of at least 32 characters. Put the operator wallet in `OPERATOR_PRIVATE_KEY` (a dedicated testnet key; faucet at https://faucet.0g.ai). That key pays for storage uploads and `anchorNight`. The web config object does not include it. Only the run-now route and the worker read it, and it never reaches the browser. Do not commit `.env`.

Public values already filled in [`.env.example`](.env.example):

| Variable | Hackathon value |
|---|---|
| `ZG_CHAIN_ID` | `16602` |
| `ZG_CHAIN_RPC_URL` | `https://evmrpc-testnet.0g.ai` |
| `ZG_STORAGE_INDEXER_URL` | `https://indexer-storage-testnet-turbo.0g.ai` |
| `ZG_EXPLORER_URL` | `https://chainscan-galileo.0g.ai` |
| `LEDGER_CONTRACT_ADDRESS` | `0xA3B6664b487FC01c4264977c9B92058A89C31Ed7` |
| `ZG_ROUTER_BASE_URL` | `https://router-api.0g.ai/v1` (testnet Router URL is commented in the example) |
| `NIGHT_START_UTC` / `NIGHT_HARD_STOP_UTC` | `23:00` / `23:50` |
| `COMMONS_GATE_THRESHOLD` | `0.75` |

`ZG_MK_KEY` is only for the Phase 0 scripts (`pnpm smoke`, `pnpm storage-check`). The app takes the management key through `/connect`, not from that variable.

Pages: `/` (countdown to 00:00 UTC and the night strip), `/connect`, `/queue` (plan preview), `/nights/[id]`, `/commons`, `/verify`.

Checks that do not spend Router credits:

```bash
pnpm typecheck
pnpm test
pnpm test:contracts
```

`pnpm smoke` and **Run tonight's shift now** call the real Router. With a 0 balance the inference checks return HTTP 402 `insufficient_balance` and the pipeline stops. Shift does not fill in a fake response, request id, or transaction. Phase 0 steps: [`docs/PHASE0_KIT.md`](docs/PHASE0_KIT.md).

## For judges

**Live demo URL (F6.1).** Not deployed. This line will be replaced with the real URL. There is no preview link to try yet.

**Demo video (F6.4).** Not recorded. This line will be replaced with a link under 3 minutes. Please treat a missing video as missing, not as an unlisted URL.

**Request ids, anchor transactions, and manifest roots (F6.3).** No end-to-end run has been recorded. The table is empty. Rows will be added only from a real night or a real "Run now", with the Router request id, the anchor transaction, and the manifest root copied from that run.

| Date (UTC) | Night ID | Tasks | Request IDs | Anchor tx | Manifest root |
|---|---|---|---|---|---|
| | | | | | |

Walkthrough that matches the code today:

- Home countdown and night strip render without a session.
- Connect needs a real `mk-` from [pc.0g.ai](https://pc.0g.ai) (or the testnet console if `ZG_ROUTER_BASE_URL` contains `testnet`). Minimum scopes: `account:read`, `keys:create`, `keys:manage`. The connect probe creates and revokes a throwaway key. The Router rejects a `credit_limit` below 0.0001 0G.
- The queue preview shows models and micro-USD estimates from the live catalog. It does not classify complexity (that call spends credits) and it does not execute.
- `/commons` explains the gate and shows an empty board until a translation is accepted or rejected.
- `/verify` is ready. It has nothing to verify until a leaf exists.

The nightly window aimed at for the submission is **7 November 2026, 04:30–05:20 IST**. That run is not in the table. F4.7 stays open for the same reason as F3.12: 0 Router credits.

## What was actually checked

Phase 0 (5 November 2026, UTC), from real calls. Detail in [`docs/SPIKE_RESULTS.md`](docs/SPIKE_RESULTS.md).

| Check | Result |
|---|---|
| Balance fields (`credit_balance`, `deposit_balance`) | Returned. Both were 0. |
| Create and revoke an ephemeral key (`credit_limit`, `trust_mode`) | Worked. Revocation is immediate (next call is 401). |
| Inference spends credit, and `x_0g_trace` / `verify_tee` | Not observed. Chat returned 402 `insufficient_balance`. |
| Catalog at ~16:30 UTC | 124 models, 9 TeeML, including decision models `laya` and `vela-2.0-9b`, `whisper-large-v3`, `z-image-turbo`. |
| `/v1/decisions` shape | Verified once, against that catalog. |
| 0G Storage upload and download on Galileo | SHA-256 matched. Root `0x35eb71f233c5020c97ddacd04435d0021a696633c5d1b6278a7fd296d135d589`. This is a 60-byte probe file, not a night manifest and not an inference output. |
| ShiftLedger deploy | The transaction in the contract table. `owner()` is the operator wallet. |

Later the same day, `GET /v1/models` returned **79 models, no `verifiability` field, and none of the TeeML ids above**, with or without a key. A decision call to `laya` then returned `404 model_not_found`. The committed `docs/spike/models.json` is the earlier 124-model catalog. Whether the smaller catalog is an outage or a permanent change is an open question for 0G. The loader accepts the smaller body: missing `verifiability` becomes trust `standard`. Private mode then has no model to plan, the decision step is skipped, and the commons queue does not accept items to paper over the gap.

## Limitations

- **No paid run yet.** U3, U8, the H20 checkpoint (F3.12), and the 7 November nightly run (F4.7) are blocked on a 0 Router balance. Please do not read the UI as if those runs happened.
- **Galileo for the contract and for storage.** Mainnet chain ID 16661 is not where ShiftLedger lives. Say so if you cite the address.
- **TeeML catalog variance.** Private mode, Whisper audio, and the decision-model gate depend on models that the Router sometimes omits. When they are missing, the night defers or waits. It does not swap in a standard model under a private key (the Router would return 503).
- **U12 is unanswered.** Budget mode is primary until 0G confirms delegated iAI credit use.
- **Commons work is off the Merkle tree** (see above). Donations on the contract exist only after an anchored night with a positive amount. No such transaction exists yet.
- **The verifier trusts the database for the proof bytes**, then checks those bytes on-chain. It does not yet rebuild the batch from the storage manifest alone.
- **Deploy, request-id table, and video** are F6.1, F6.3, and F6.4. This README does not invent them.

## How we used AI

AI coding assistants, including Claude Code (working rules in [`CLAUDE.md`](CLAUDE.md)), wrote application code, tests, and docs from [`docs/SHIFT_PLAN.md`](docs/SHIFT_PLAN.md), one `PROGRESS.md` item at a time. They were required to keep external input validated, to keep `mk-` and `sk-` keys out of the browser and out of logs, and to avoid inventing Router responses, balances, request ids, transactions, or storage roots. When a call could not be made, the item stayed open or was marked blocked. Phase 0 numbers in this file come from those real calls, not from a model.

## Team

- [Sebastián Ceciliano Piedra](https://github.com/Cbiux)
- [Psybre](https://github.com/Psybre)

Telegram and X handles go in the submission form with F6.4. They are not invented here.

## License

Code: MIT — [`LICENSE`](LICENSE).

Commons source texts: CC BY 4.0, Ethereum documentation by ethereum.org contributors, non-code content licensed by Stiftung Ethereum (Ethereum Foundation). See [`data/commons/NOTICE.md`](data/commons/NOTICE.md).
