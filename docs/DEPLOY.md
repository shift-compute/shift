# Deploying Shift on Railway

One Railway service runs the web app and the nightly worker in the same container, next to a Railway Postgres.
They share `UPLOAD_DIR`, and a Railway volume cannot be attached to two services, so they are not split.
`scripts/start-prod.sh` applies the migrations, then starts both processes. If either exits, the container exits and Railway restarts it.

Files: `Dockerfile`, `railway.json`, `.dockerignore`, `scripts/start-prod.sh`.

## Steps

1. Railway → **New project** → **Deploy from GitHub repo** → `shift-compute/shift`. Railway reads `railway.json` and builds the `Dockerfile`.
2. In the same project: **New** → **Database** → **PostgreSQL**.
3. On the Shift service: **Volumes** → add a volume mounted at `/data`. Set `UPLOAD_DIR=/data/uploads`. Without the volume, uploads vanish on every deploy.
4. On the Shift service: **Variables**. Add the variables below. Reference the database with `${{Postgres.DATABASE_URL}}`.
5. **Settings** → **Networking** → **Generate domain**. Set `PUBLIC_APP_URL` to that URL, then redeploy.
6. Open `/` and `/api/session`. The second must return `{"connected":false}`.
7. In the ENS app, set the `url` record of `tryshift.eth` to the public URL.

## Variables

Values for secrets are never written in this repo. Generate them once and paste them into Railway only.

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `SHIFT_MASTER_KEY` | `openssl rand -base64 32`. Losing it makes every stored `mk-` key unreadable. |
| `SESSION_SECRET` | `openssl rand -base64 48` |
| `PUBLIC_APP_URL` | the generated Railway URL |
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
- Seed the commons queue once: `pnpm seed:commons` against the production `DATABASE_URL` (see `scripts/seed-commons.ts`).
- Check the logs for `tick` lines after 23:00 UTC. A FAILED night is not retried by design.

## Not tested

The image was written but not built on the machine that wrote it (Docker Desktop was not running). What was checked instead: `pnpm --filter @shift/web build` succeeds with no `.env`, `prisma generate` succeeds with an empty `DATABASE_URL`, and `bash -n scripts/start-prod.sh` passes. The first Railway build is the first real test of the `Dockerfile`.
