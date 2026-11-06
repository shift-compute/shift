# One container runs the web app and the nightly worker. They share UPLOAD_DIR, and a Railway volume
# cannot be shared between two services, so the two processes live together (scripts/start-prod.sh).
FROM node:22-bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*
RUN corepack enable && corepack prepare pnpm@11.8.0 --activate

WORKDIR /app
COPY . .
RUN sed -i 's/\r$//' scripts/start-prod.sh
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @shift/web build

EXPOSE 3000
CMD ["bash", "scripts/start-prod.sh"]
