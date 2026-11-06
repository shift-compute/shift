#!/usr/bin/env bash
# Production entrypoint: apply migrations, then run the nightly worker and the web app side by side.
# If either process exits, the container exits too, so the platform restarts both.
set -euo pipefail

pnpm db:deploy

pnpm --filter @shift/worker start &
worker=$!
pnpm --filter @shift/web start -p "${PORT:-3000}" -H 0.0.0.0 &
web=$!

trap 'kill "$worker" "$web" 2>/dev/null || true' TERM INT

wait -n "$worker" "$web" || true
echo "A Shift process exited; stopping the container." >&2
kill "$worker" "$web" 2>/dev/null || true
exit 1
