# Deploying Shift on Railway

The public app is [https://shift-production-b890.up.railway.app](https://shift-production-b890.up.railway.app).

Railway project `shift`:

- Service `Shift` runs the web app and the nightly worker in one container.
- Postgres sits beside that service.
- A volume is mounted at `/data` (`UPLOAD_DIR=/data/uploads`).

They share `UPLOAD_DIR`, and a Railway volume cannot be attached to two services, so they are not split.
`scripts/start-prod.sh` applies the migrations, runs `pnpm seed:commons`, then starts both processes. If the seed fails, the container exits before either process starts. If either process exits, the container exits and Railway restarts it. `railway.json` sets `deploy.startCommand` to that script, so a dashboard start command does not replace it.

Checked against that URL on 2026-11-06:

- `GET /` returned 200 and the L5c5 landing (`/brand/l5c5-lockup.png`).
- `GET /api/session` returned `{"connected":false}`.
- `GET /api/commons` returned `{"items":[],"donors":[],"totalDonatedUsdMicro":"0"}`.

That empty `items` list is the public commons board. Production boots run `pnpm seed:commons` after migrations; `PENDING` rows still do not appear on `/api/commons` (it lists accepted and rejected rows only). No funded inference run is recorded (F3.12 and F4.7 stay open).

Setting the `url` text record of `tryshift.eth` to this URL is still an operator step in the ENS app. This file does not record that record as set.

Files: `Dockerfile`, `railway.json`, `.dockerignore`, `scripts/start-prod.sh`.

## Steps

1. Railway → **New project** → **Deploy from GitHub repo** → `shift-compute/shift`. Railway reads `railway.json` and builds the `Dockerfile`.
2. In the same project: **New** → **Database** → **PostgreSQL**.
3. On the Shift service: **Volumes** → add a volume mounted at `/data`. Set `UPLOAD_DIR=/data/uploads`. Without the volume, uploads vanish on every deploy.
4. On the Shift service: **Variables**. Add the variables below. Reference the database with `${{Postgres.DATABASE_URL}}`.
5. **Settings** → **Networking** → **Generate domain**. The generated domain is `https://shift-production-b890.up.railway.app`. Set `PUBLIC_APP_URL` to that URL, then redeploy.
6. Open `/` and `/api/session`. The second must return `{"connected":false}`. That is what the live URL returned on 2026-11-06.
7. In the ENS app, set the `url` record of `tryshift.eth` to the public URL. That record is not recorded as set.

## Variables

Values for secrets are never written in this repo. Generate them once and paste them into Railway only.

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `SHIFT_MASTER_KEY` | `openssl rand -base64 32`. Losing it makes every stored `mk-` key unreadable. |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `PUBLIC_APP_URL` | `https://shift-production-b890.up.railway.app` |
| `UPLOAD_DIR` | `/data/uploads` |
| `ZG_ROUTER_BASE_URL` | `https://router-api.0g.ai/v1` |
| `ZG_CHAIN_ID` | `16602` |
| `ZG_CHAIN_RPC_URL` | `https://evmrpc-testnet.0g.ai` |
| `ZG_STORAGE_INDEXER_URL` | `https://indexer-storage-testnet-turbo.0g.ai` |
| `ZG_EXPLORER_URL` | `https://chainscan-galileo.0g.ai` |
| `LEDGER_CONTRACT_ADDRESS` | `0xA3B6664b487FC01c4264977c9B92058A89C31Ed7` |
| `OPERATOR_PRIVATE_KEY` | the dedicated operator wallet. It needs Galileo gas (faucet `https://faucet.0g.ai`). |
| `NIGHT_START_UTC` | `23:00` |
| `NIGHT_HARD_STOP_UTC` | `23:50` |
| `SAFETY_MARGIN_PCT` | `10` |
| `MAX_CONCURRENCY` | `3` |
| `COMMONS_GATE_THRESHOLD` | `0.75` |
| `ENS_RPC_URL` | optional; defaults to a public Ethereum mainnet RPC |

Do not set the `ZG_MK_KEY` or `SMOKE_*` variables: they are for the Phase 0 scripts only.

## Before the first night

- The worker runs a real batch inside its night window and spends the users' credits. Do not connect a real account until you mean it.
- The commons queue is seeded on every container start (`pnpm seed:commons` after migrations; see `scripts/seed-commons.ts`). A re-run inserts missing `sourceRef`s, updates `PENDING` rows, and leaves other statuses alone. It does not spend Router credits. `PENDING` rows stay off `/api/commons`.
- Check the logs for `tick` lines after 23:00 UTC. A FAILED night is not retried by design.

## What was checked

The image was not built on the machine that wrote the Dockerfile (Docker Desktop was not running). On that machine, `pnpm --filter @shift/web build` succeeded with no `.env`, `prisma generate` succeeded with an empty `DATABASE_URL`, and `bash -n scripts/start-prod.sh` passed. Railway built the image. The live checks at the top of this file are the public proof the service is up. They do not include a funded inference run. `bash -n` does not execute `pnpm seed:commons`; that command runs on each production boot after migrations, and `PENDING` rows stay off `/api/commons`.

## Operator checklist

Do these by hand. This file does not record them as done.

1. Disable the Postgres public TCP proxy. The app should use the private Railway database URL. Container boots already run `pnpm seed:commons`.
2. Turn on 2FA for the Railway account that owns the project.
3. Fund the operator wallet with the minimum Galileo gas it needs for storage uploads and `anchorNight`. Do not leave a large balance there.
4. Connect only team accounts. Do not paste a personal `mk-` into the demo.
5. After the demo, revoke that `mk-` in the 0G console (Settings → Management Keys). Disconnect in the app as well. Disconnect deletes the ciphertext; the console revoke is what kills the key.
