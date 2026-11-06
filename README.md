# Shift

**Shift rescues 0G compute credits that would expire at 00:00 UTC and turns them into useful work, a public commons, and verifiable provenance.**

During the day you queue audio summaries, document analyses, and image prompts. Before the cutoff, Shift reads your 0G balance, mints a short-lived capped key, and spends that balance on the cheapest model that still meets the quality bar. Whatever is left goes to a public queue: English excerpts from ethereum.org, translated into Hindi and Marathi, kept only when a decision model accepts them. Each completed personal inference is a Merkle leaf. The night's root is anchored on 0G Chain so anyone can check who owns a result and which model produced it.

> Without 0G, there are no expiring daily credits to rescue, no TEE-verified receipts proving which model produced each result, and no on-chain record of who donated compute to the commons.

Built for ETHGlobal Mumbai 2026 (0G "Build with 0G PC", and the general finalist track). Submission deadline: **Saturday 7 November 2026, 09:00 IST**. Late submissions are not accepted.

| | |
|---|---|
| Network for the contract and storage | **0G Galileo testnet, chain ID 16602.** This project has no mainnet (chain ID 16661) deployment. |
| ShiftLedger | [`0xA3B6664b487FC01c4264977c9B92058A89C31Ed7`](https://chainscan-galileo.0g.ai/address/0xA3B6664b487FC01c4264977c9B92058A89C31Ed7) |
| Live demo | [https://shift-production-b890.up.railway.app](https://shift-production-b890.up.railway.app) — Railway project `shift`, service `Shift`, Postgres, volume at `/data`. A local run is still documented below. |
| Demo video | Not recorded. No URL in this file. Placeholder and shot list: [Submission](#submission). Script: [plan §24](docs/SHIFT_PLAN.md). |
| Real inference runs | Four manual nights are anchored on Galileo. Ids, roots, and transactions were read from `ShiftLedger.nights` on 2026-11-06: [Verifiable evidence](#anchored-nights). This file does not copy Router request ids. F3.12 in `PROGRESS.md` is still the open write-up. F4.7 (the 7 November window) is still open. |
| Status log | [`PROGRESS.md`](PROGRESS.md) · Phase 0 write-up: [`docs/SPIKE_RESULTS.md`](docs/SPIKE_RESULTS.md) |

## How a night works

1. **Connect** (`/connect`). You paste a 0G management key (`mk-`) with `account:read`, `keys:create`, and `keys:manage`. Shift encrypts it at rest (AES-256-GCM, bound to your account address). The browser never receives the key again.
2. **Queue** (`/queue`). Add an audio file, a document, or an image prompt. Tonight's preview prices the live catalog and your live balance. It does not create a key and does not call inference.
3. **Run.** The worker opens the window at 23:00 UTC and hard-stops at 23:50 UTC (04:30–05:20 IST). On `/queue`, **Run tonight's shift now** calls `POST /api/runs/now` (no body, once every 10 minutes) and uses that same pipeline. Shift creates an ephemeral `sk-` capped to the night's budget, calls the 0G Router, uploads outputs to 0G Storage, and revokes the key before it returns. A sweeper revokes keys left alive for more than two hours. The button does not retry a start.
4. **Commons** (`/commons`). Leftover budget, when you donate it, pays for two private translations and a decision-model gate.
5. **Anchor.** Personal steps that finished with a request id become Merkle leaves. `ShiftLedger.anchorNight` stores the root and the manifest's storage root. Positive donations are written with `recordDonations` only after that anchor.
6. **Verify** (`/verify?rid=`). Anyone can recompute the leaf in the browser and ask the contract. The storage link is the ciphertext of a personal output.

Two spending modes share that pipeline. **Budget mode** is the primary one: a nightly USD cap, and the deposit may be spent up to that cap. **iAI mode** spends `credit_balance` minus a safety margin and does not touch the deposit. iAI mode stays secondary until 0G confirms that delegated use of iAI credits is allowed (Phase 0 check U12 is still open).

**TODO (plan §19.8, unanswered).** Ask 0G whether using credits through a delegated management key is allowed, and whether donating the leftover to the commons is allowed. Do not treat silence as a yes.

## Privacy

Personal files and the result JSON are encrypted before they are uploaded to 0G Storage (AES-256-GCM, a per-account key from HKDF of `SHIFT_MASTER_KEY` and the account address). The Merkle leaf and the `/verify` link point at that ciphertext. The signed-in owner reads the plaintext from `GET /api/tasks/[id]/output`. **The operator can decrypt**, because the master key is in the service environment. Commons outputs stay public JSON on purpose. Roots written before this sealing change can still be plaintext; this page does not re-download the nights below and does not claim those bytes are ciphertext. Details and the threat model: [`SECURITY.md`](SECURITY.md).

## How Shift uses 0G

- **Private Computer (Router).** Chat, audio, and image models, plus account, balance, and key APIs. Trust tiers are standard, verified (TeeTLS), and private (TeeML). An ephemeral key is pinned to the tier the plan chose. If the catalog has no TeeML model that can run the task, private mode defers the task. It does not silently drop to a weaker tier.
- **Decision models.** One `/v1/decisions` call classifies each text task (simple / standard / complex) and sets the quality floor. A second call is the commons gate. Model ids come from the live catalog. Nothing is hard-coded. If that catalog has no decision model, classification plans `standard` and does not call the Router, and commons rows stay `RUNNING`.
- **0G Storage.** Task outputs and `NightManifest.json` go to the Galileo turbo indexer (`https://indexer-storage-testnet-turbo.0g.ai`) via `@0gfoundation/0g-ts-sdk`. The operator wallet pays gas. Personal outputs are ciphertext. Commons outputs are public. Phase 0 uploaded and downloaded one probe file; that proof is in [Verifiable evidence](#verifiable-evidence). The four anchored nights below each have a manifest root on the contract.
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

`anchorNight` and `recordDonations` are owner-only. `verifyLeaf(nightId, proof, leaf)` is a public view. An empty root returns false. The deploy transaction in this table created the contract. It is not an anchor. Four nights are anchored; their transactions were read from Galileo on 2026-11-06 and are listed under [Anchored nights](#anchored-nights). The Phase 0 storage upload has its own transaction in [Verifiable evidence](#verifiable-evidence).

`forge test`: 7 passed in Phase 0, including TypeScript ↔ Solidity leaf-hash parity (`docs/spike/merkle-vector.json`).

## Verifier

Open `/verify?rid=<request id>` on the live app ([https://shift-production-b890.up.railway.app/verify](https://shift-production-b890.up.railway.app/verify)), or paste an id on [`/verify`](apps/web/app/verify/page.tsx). The same page is at `http://localhost:3000/verify` after `pnpm dev`.

1. `GET /api/verify/[requestId]` returns the packed leaf, the proof, the night id, the manifest root, the output's storage root, and the trace fields safe to show (provider, provider identity, `tee_verified`, trust tier). Vault columns, billing, and raw secrets are not copied. An unknown id is 404.
2. **In the browser**, the page recomputes the leaf hash (the same bytes as OpenZeppelin `StandardMerkleTree`) and checks the proof against the stored root.
3. It then reads `nights(nightId)` and calls **`verifyLeaf`** on ShiftLedger through viem and the public Galileo RPC (`LEDGER_CONTRACT_ADDRESS`).

A missing `tee_verified` is shown as "no verdict". It is not treated as a failed attestation. The page links the manifest root. It does not download that file to re-check the batch without the database.

There is no request id to paste today. A read of `nights(1)` on Galileo during the build returned the zero night, and `verifyLeaf` returned false for it. That was a read of an empty slot. The links that already exist, and the waiting request-id row, are in [Verifiable evidence](#verifiable-evidence).

## Commons

Sources are 200 excerpts (20–120 words) from [ethereum.org](https://ethereum.org/), commit `c362ca84b53659a924d360ac02ca5a99987cacb3` of `ethereum-org-website`. Non-code content is **CC BY 4.0**. Attribution, the terms quote, and what was edited are in [`data/commons/NOTICE.md`](data/commons/NOTICE.md). The website repository's MIT license covers code, and no code from that repository is included. `pnpm seed:commons` loads the rows (100 Hindi, 100 Marathi).

For each item the donor can afford:

1. **Two different private chat models** translate the same English paragraph (Hindi or Marathi). Ids are picked from the catalog (higher quality, then cheaper). They are not hard-coded.
2. A **decision model** is asked whether both translations carry the source meaning. Translation A is `ACCEPTED` only when `P(yes)` is at least `COMMONS_GATE_THRESHOLD` (default **0.75**). Otherwise the row is `REJECTED` and both texts stay visible.
3. An accepted row is uploaded as CommonsOutput JSON (source, translation A, both translation models, the gate model, request ids, probability).

`/commons` lists accepted and rejected rows and the donated micro-USD per 0G account. Pending and in-progress rows stay off the page. The page is empty until a real pair passes the gate. On the live app, `GET /api/commons` currently returns `"items": []`. Production boots run `pnpm seed:commons` after migrations. A seed inserts `PENDING` rows, which this page does not list, so the board stays empty until a funded pair is accepted or rejected.

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

Generate `SHIFT_MASTER_KEY` with `openssl rand -base64 32` and pick a `SESSION_SECRET` of at least 32 characters. Put the operator wallet in `OPERATOR_PRIVATE_KEY` (a dedicated testnet key; faucet at https://faucet.0g.ai). That key pays for storage uploads and `anchorNight`. The web config object does not include it, and it never reaches the browser. Plan §19.7 says only the worker should hold it. **Run now uses it too**: `POST /api/runs/now` reads `OPERATOR_PRIVATE_KEY` in the web process so a manual night can upload and anchor. The nightly worker reads the same variable. Do not commit `.env`. Optional `SHIFT_MASTER_KEY_PREV` is only for a rotation; see [`SECURITY.md`](SECURITY.md).

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

## Verifiable evidence

These links are records that already exist: the deployed contract, its deploy transaction, the Phase 0 storage upload, and four `anchorNight` transactions read from Galileo on 2026-11-06. This file does not copy Router request ids. F3.12 in [`PROGRESS.md`](PROGRESS.md) is still the open write-up of a funded run. F4.7 (7 November 2026, 04:30–05:20 IST) has not been recorded here. This section does not claim a current Router balance.

### ShiftLedger

0G Galileo testnet, chain ID 16602. Source: [`contracts/src/ShiftLedger.sol`](contracts/src/ShiftLedger.sol). Owner: `0x3E7E6733f1E0Fbb55035d6791a77e596ab11aD07` (operator wallet). Public RPC: `https://evmrpc-testnet.0g.ai`.

| | |
|---|---|
| Contract page | [`0xA3B6664b487FC01c4264977c9B92058A89C31Ed7`](https://chainscan-galileo.0g.ai/address/0xA3B6664b487FC01c4264977c9B92058A89C31Ed7) |
| Deploy transaction (F0.6) | [`0x4a2bd7c707056195ef102420a6e3e3ebed0442e2399d91eef49bdd495d0f7117`](https://chainscan-galileo.0g.ai/tx/0x4a2bd7c707056195ef102420a6e3e3ebed0442e2399d91eef49bdd495d0f7117) |

The deploy transaction created the contract. It is not an `anchorNight` call.

### Anchored nights

Read on 2026-11-06 from `nights(uint64)` and the `NightAnchored` logs on `0xA3B6664b487FC01c4264977c9B92058A89C31Ed7` (Galileo, chain ID 16602). These are manual night ids (unix seconds), not `YYYYMMDD`. Request ids are not in this table.

| Night ID | Anchored (UTC) | Items | Anchor transaction | Merkle root | Manifest root |
|---|---|---|---|---|---|
| 1793985613 | 2026-11-06 17:22:06 | 9 | [`0xe98b9b69…8c25`](https://chainscan-galileo.0g.ai/tx/0xe98b9b6966669491fea77ed51ebee94715f262e3280e982998eb1be39a4a8c25) | `0x336c9af6c39705862223c51a50922e801de4bd725d145003cf7698fbc820a7b4` | `0xafb58afe874fb9358902cfac0458e48e81c6cb69b69dd2ade5dc8fa1741adf3a` |
| 1793985870 | 2026-11-06 17:25:46 | 3 | [`0x49692625…19bd`](https://chainscan-galileo.0g.ai/tx/0x496926250ade1c14a002299f2c7c88af7401f5f77af6732b9bf8c4c3ec2d19bd) | `0x6eccca30c98c6415f9ffae400af20812905c0e4c720a620bcff02e325dbbb966` | `0xe69e5b6b7006b5d749f373958834721170e5364bb9b7f6c956a7b6d53921e88e` |
| 1793986070 | 2026-11-06 17:29:33 | 3 | [`0xd5e43623…4bc1`](https://chainscan-galileo.0g.ai/tx/0xd5e43623327ac75de4b98dea94116f5c87671fbeacda3757aa872c5065614bc1) | `0x573d006b1795529af3960cbaa4caf26affd27d02c877027cc446d32ccc330ffc` | `0xad2b488b94fcbd63468832fdbc079c31dd4d871e1f29fee482b988430dc9b39a` |
| 1793986691 | 2026-11-06 17:42:35 | 3 | [`0x78716f2e…9130`](https://chainscan-galileo.0g.ai/tx/0x78716f2e3091de359bf68803c19ed21010a0f85af90d1c32bc1db0b434729130) | `0x36876fdf415fd3e03aa40930138d43292c38f407ae9e4c87b7f05bf1aad435ab` | `0x7152136a4f29beeba56cc39a20c548124e1181398e7a170bbb1ba236df41e456` |

`donationsRecorded` is false on the first three. On 1793986691 it is true. `DonationRecorded` in the same window is [`0xf9ffd467…46cb`](https://chainscan-galileo.0g.ai/tx/0xf9ffd467e511a682bc93e91a715fabccd2d2268b4c77d73cbd46b4014ccc46cb) (2026-11-06 17:42:50 UTC, 15799 micro-USD, donor `0xDbdcB1F11b6b8ea7ae2B5735954f251306D6F88F`). No other donation log was read for these four ids.

### 0G Storage

Indexer used by the web app, the worker, and the Phase 0 check (`ZG_STORAGE_INDEXER_URL`): `https://indexer-storage-testnet-turbo.0g.ai`.

The upload proof is [`docs/spike/STORAGE_RESULTS.json`](docs/spike/STORAGE_RESULTS.json) (U9, 2026-11-05T18:39:04Z). SHA-256 of the download matched the upload (`matched: true`).

| | |
|---|---|
| Root | `0x35eb71f233c5020c97ddacd04435d0021a696633c5d1b6278a7fd296d135d589` |
| Indexer file | [`/file?root=0x35eb71f2…d589`](https://indexer-storage-testnet-turbo.0g.ai/file?root=0x35eb71f233c5020c97ddacd04435d0021a696633c5d1b6278a7fd296d135d589) |
| Storage transaction | [`0xdd4c935f2dd3b2a0048f558b3e904fe855c9987be6f9c5ff90b0129d72a7afc6`](https://chainscan-galileo.0g.ai/tx/0xdd4c935f2dd3b2a0048f558b3e904fe855c9987be6f9c5ff90b0129d72a7afc6) |

That object is a 60-byte probe (`{"app":"shift","check":"U9",...}`). The verifier builds output and manifest links with the same pattern, `{indexer}/file?root={root}`. The probe is not `NightManifest.json` and not an inference output. The manifest roots in [Anchored nights](#anchored-nights) are the night manifests. A personal output link is ciphertext for results stored after sealing; this file does not re-download those roots.

### How a judge checks a request id

The path is `/verify?rid=<request id>` on the live app, [https://shift-production-b890.up.railway.app/verify?rid=](https://shift-production-b890.up.railway.app/verify). The same path works locally (`pnpm dev`, then `http://localhost:3000/verify?rid=`). After a funded run, copy a request id from the table below:

1. Open `/verify?rid=` with that id, or paste the id on `/verify`.
2. The page loads `GET /api/verify/[requestId]`: packed leaf, Merkle proof, night id, manifest root, output storage root, and the trace fields safe to show.
3. The browser recomputes the leaf (same bytes as OpenZeppelin `StandardMerkleTree`) and checks the proof against the stored root.
4. It reads `nights(nightId)` and calls `verifyLeaf` on ShiftLedger at `0xA3B6664b487FC01c4264977c9B92058A89C31Ed7` through viem and the public Galileo RPC.
5. When the response includes a storage root, the output and the manifest are the turbo indexer `/file?root=` links.

An unknown id is 404. A missing `tee_verified` is "no verdict". There is no request id to open today. A read of `nights(1)` during the build returned the zero night, and `verifyLeaf` returned false for that empty slot.

### Request IDs

Request ids are not copied here. Anchor transactions for the four nights are in [Anchored nights](#anchored-nights). A row is added only when a request id is taken from that same run, not invented.

| Date (UTC) | Night ID | Sample request IDs | Anchor tx | Manifest root |
|---|---|---|---|---|
| — | — | Not copied into this file. See the anchored-night table for transactions. | — | — |

## Submission

ETHGlobal Mumbai 2026, Jio World Convention Centre. Hacking started Thursday 5 November 2026, 21:00 IST. **Submission closes Saturday 7 November 2026, 09:00 IST.** Late submissions are not accepted ([event details](https://ethglobal.com/events/mumbai/info/details), [start page](https://ethglobal.com/events/mumbai/info/start)).

| Field | What to submit |
|---|---|
| Name | Shift |
| Short description | The opening paragraph of this README. |
| Repository | https://github.com/shift-compute/shift |
| Network | **0G Galileo testnet, chain ID 16602**, for ShiftLedger and for 0G Storage. This project has no mainnet (chain ID 16661) deployment. |
| Contract | [`0xA3B6664b487FC01c4264977c9B92058A89C31Ed7`](https://chainscan-galileo.0g.ai/address/0xA3B6664b487FC01c4264977c9B92058A89C31Ed7) |
| Live demo | [https://shift-production-b890.up.railway.app](https://shift-production-b890.up.railway.app) |
| Demo video | **Placeholder.** No URL is published below. Paste the link into the [demo video](#demo-video) line after a teammate records the cut. |
| Sponsor prize named in the plan | 0G **"Build with 0G PC"** — $5,000 (1st $2,500 / 2nd $1,500 / 3rd $1,000). See [plan §2](docs/SHIFT_PLAN.md). |

Every project also goes through ETHGlobal's general finalist review. The form allows up to three sponsor prizes. The plan names one extra prize, Arkiv, only if Appendix A shipped. It did not (F5.2 is open). No other sponsor prize is written down in this repo, so this file leaves the other slots empty.

### How to demo

Same path on [https://shift-production-b890.up.railway.app](https://shift-production-b890.up.railway.app) and on `http://localhost:3000` after `pnpm dev`:

1. **Connect** — `/connect`. Paste an `mk-` with `account:read`, `keys:create`, and `keys:manage`. A reload keeps the signed-in account and the saved budget. It does not ask for the key again. USD balances from the Router are micro-USD (`USD × 1e6`) and the page shows them in dollars.
2. **Queue** — `/queue`. Add an audio summary, a document analysis, and an image prompt. Tonight's plan, the night strip, and **Run tonight's shift now** are on this page. The preview does not spend credits. The button stays off when nothing is queued or deferred.
3. **Run** — **Run tonight's shift now** on `/queue` (`POST /api/runs/now`), or leave the worker up for 23:00–23:50 UTC (04:30–05:20 IST). Both call the same pipeline. The button stays off until the preview has loaded. The cap saved on the account applies to each run, not once per day. A 0 Router balance stops at HTTP 402 `insufficient_balance`. Shift records that failure and does not fill in a result. The page does not send a second start on its own. A 5xx response, HTTP 408, HTTP 499, or a result the page cannot read does not mean credits were not spent: the queue is reloaded and no further POST is sent. Finished and failed tasks keep their night link, stored error, reported cost and verify links after a reload. Anchor and donation lines appear on the night page only after that run stores them.
4. **Night** — `/nights/[id]`. Night strip, provenance cards, and the anchored batch.
5. **Verify** — `/verify?rid=<request id>` from **Verify this result** on a card. The browser recomputes the leaf and calls `verifyLeaf` on ShiftLedger.
6. **Commons** — `/commons`. Accepted and rejected translations, with the filter probability on each card.

### Demo video

**Video URL:** _placeholder — record the cut, then paste the URL on this line._

That line is the whole link. A judge who opens the file today finds no video address. Keep the cut under 3 minutes ([plan §24](docs/SHIFT_PLAN.md), 0G deliverable). Record the narration in a human voice from the team. Text-to-speech and AI voices stay out of this hack. Film a real **Run now** when credits exist, and keep a completed real cycle as backup. While the balance is 0, show the 402 and the empty commons and verify states. Leave request ids, storage roots, and accepted translations out of the cut unless a real run wrote them.

Shot list to film against. Times follow plan §24. The frames are the surfaces that exist in the app now: the night strip, provenance on the night page, verify, and commons accept/reject.

| Time | Shot | What should be on screen |
|---|---|---|
| 0:00–0:20 | Home `/` | Countdown to 00:00 UTC (05:30 IST) and the night strip. Cue: unused 0G credits expire at 00:00 UTC, by design. |
| 0:20–0:45 | `/connect` | The scoped `mk-` wizard. Cue: no third-party OAuth, so Shift reads balances and mints short-lived capped keys. |
| 0:45–1:15 | `/queue` | Three tasks, the plan preview, the night strip (block width is cost; the remainder is labeled for the commons), and **Run tonight's shift now**. Cue: decision models set the quality bar, and the optimizer takes the cheapest model that still clears it. |
| 1:15–1:55 | Run tonight's shift now | The button on `/queue`. A real Router run: the balance moving and results appearing, with a link to the night and to verify. Cue: 0G Private Computer; the key is created, capped, used, and revoked. A failed task stays failed. |
| 1:55–2:15 | `/nights/[id]` | Night strip for that night (the end label is **First light** when the night is `DONE`). Provenance card: model, cost, 0G Storage root, then each step's request id, model, trust level, TEE verdict, and **Verify this result**. Anchored batch: Merkle root, manifest root, anchor transaction — only the values this run stored. |
| 2:15–2:35 | `/commons` | One **Accepted** card and one **Rejected** card (Hindi or Marathi), filter probability visible, rejected text still on the card. Cue: leftovers translate Ethereum docs, and the decision model keeps a row only when both translations match the source. An empty board is the honest frame until a funded pair finishes; say that on camera. |
| 2:35–2:50 | `/verify?rid=` | The request id from the night above. The page checks the proof in the browser, then `verifyLeaf` on Galileo. Cue: anyone can see which model produced it, who owns it, and who donated the compute. |
| 2:50–3:00 | Close | Cue: without 0G these credits do not exist, and these results have no proof of origin. |

## For judges

**Live demo URL (F6.1).** [https://shift-production-b890.up.railway.app](https://shift-production-b890.up.railway.app). Railway project `shift`: service `Shift` (web and worker in one container), Postgres, and a volume mounted at `/data`. Checked 2026-11-06: `/` returns the landing, `/api/session` returns `{"connected":false}`, and `/api/commons` returns no items. Production commons seeding has not been run. There is still no request id to verify (F3.12).

**Demo video.** The placeholder and the shot list are in [Submission](#submission). This README has no video URL.

**Request ids, anchor transactions, and manifest roots.** [Verifiable evidence](#verifiable-evidence): the Galileo contract page, the F0.6 deploy transaction, the turbo indexer, the Phase 0 storage proof, and a request-id table with one waiting row. The waiting row is not a sample id.

Walkthrough that matches the code today:

- Home countdown and night strip render without a session.
- Connect needs a real `mk-` from [pc.0g.ai](https://pc.0g.ai) (or the testnet console if `ZG_ROUTER_BASE_URL` contains `testnet`). Minimum scopes: `account:read`, `keys:create`, `keys:manage`. The connect probe creates and revokes a throwaway key. The Router rejects a `credit_limit` below 0.0001 0G. After that, `/connect` reads the session: the account, the nightly cap, and the donation choice stay on the page across a reload. Credit and deposit figures for a USD account are micro-USD integers from the Router, shown in dollars.
- The queue preview shows models and micro-USD estimates from the live catalog. It does not classify complexity (that call spends credits) and it does not execute. **Run tonight's shift now** is on this page. It POSTs once, shows the cap and the estimate, and lists each task's outcome. It does not retry. A funded run is still F3.12: this button has not been clicked against production for this write-up.
- `/commons` explains the gate and shows an empty board until a translation is accepted or rejected.
- `/verify` is ready. It has nothing to verify until a leaf exists.

The nightly window aimed at for the submission is **7 November 2026, 04:30–05:20 IST**. That run has no row. F4.7 stays open for the same reason as F3.12: 0 Router credits.

## What was actually checked

Phase 0 (5 November 2026, UTC), from real calls. Detail in [`docs/SPIKE_RESULTS.md`](docs/SPIKE_RESULTS.md).

| Check | Result |
|---|---|
| Balance fields (`credit_balance`, `deposit_balance`) | Returned. Both were 0. |
| Create and revoke an ephemeral key (`credit_limit`, `trust_mode`) | Worked. Revocation is immediate (next call is 401). |
| Inference spends credit, and `x_0g_trace` / `verify_tee` | Not observed. Chat returned 402 `insufficient_balance`. |
| Catalog at ~16:30 UTC | 124 models, 9 TeeML, including decision models `laya` and `vela-2.0-9b`, `whisper-large-v3`, `z-image-turbo`. |
| `/v1/decisions` shape | Verified once, against that catalog. |
| 0G Storage upload and download on Galileo | SHA-256 matched. Root `0x35eb71f233c5020c97ddacd04435d0021a696633c5d1b6278a7fd296d135d589`, indexer file linked from [Verifiable evidence](#verifiable-evidence). Raw proof: [`docs/spike/STORAGE_RESULTS.json`](docs/spike/STORAGE_RESULTS.json). This is a 60-byte probe file. |
| ShiftLedger deploy | The transaction in the contract table. `owner()` is the operator wallet. |

Later the same day, `GET /v1/models` returned **79 models, no `verifiability` field, and none of the TeeML ids above**, with or without a key. A decision call to `laya` then returned `404 model_not_found`. The committed `docs/spike/models.json` is the earlier 124-model catalog. Whether the smaller catalog is an outage or a permanent change is an open question for 0G. The loader accepts the smaller body: missing `verifiability` becomes trust `standard`. Private mode then has no model to plan, the decision step is skipped, and the commons queue does not accept items to paper over the gap.

## Limitations

- **F3.12 and F4.7 are still open in `PROGRESS.md`.** Galileo already has four anchored manual nights, listed above. This file does not copy their request ids and does not record the 7 November window. U3 and U8 were not re-run for this page.
- **Galileo for the contract and for storage.** Mainnet chain ID 16661 is not where ShiftLedger lives. Say so if you cite the address.
- **TeeML catalog variance.** Private mode, Whisper audio, and the decision-model gate depend on models that the Router sometimes omits. When they are missing, the night defers or waits. It does not swap in a standard model under a private key (the Router would return 503).
- **U12 / plan §19.8 is unanswered.** TODO: ask 0G whether delegated use of iAI credits is allowed, and whether donating the leftover is allowed. Budget mode stays primary. Do not treat silence as a yes.
- **Commons work is off the Merkle tree** (see above). One `recordDonations` transaction is in [Anchored nights](#anchored-nights) (night 1793986691). A commons-only night still would not show up there.
- **The verifier trusts the database for the proof bytes**, then checks those bytes on-chain. It does not yet rebuild the batch from the storage manifest alone.
- **The app is live.** [https://shift-production-b890.up.railway.app](https://shift-production-b890.up.railway.app) (F6.1). The demo video is not recorded: [Submission](#submission) holds the placeholder and the shot list, and this file has no video URL. The request-id table does not list ids. `/api/commons` on that host returned an empty item list when deploy was checked. Seeding that database is a separate operator step, and this file does not claim it was run.

## How we used AI

AI coding assistants, including Claude Code (working rules in [`CLAUDE.md`](CLAUDE.md)), wrote application code, tests, and docs from [`docs/SHIFT_PLAN.md`](docs/SHIFT_PLAN.md), one `PROGRESS.md` item at a time. They were required to keep external input validated, to keep `mk-` and `sk-` keys out of the browser and out of logs, and to avoid inventing Router responses, balances, request ids, transactions, or storage roots. When a call could not be made, the item stayed open or was marked blocked. Phase 0 numbers in this file come from those real calls, not from a model.

## Team

- [Sebastián Ceciliano Piedra](https://github.com/Cbiux)
- [Psybre](https://github.com/Psybre)

Telegram and X handles are not stored in this repository. Put the team's real handles on the ETHGlobal form. They are not invented here.

## License

Code: MIT — [`LICENSE`](LICENSE).

Commons source texts: CC BY 4.0, Ethereum documentation by ethereum.org contributors, non-code content licensed by Stiftung Ethereum (Ethereum Foundation). See [`data/commons/NOTICE.md`](data/commons/NOTICE.md).
