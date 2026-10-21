# BananenMan

A `discord.js` v14 bot (TypeScript), backed by Postgres via Prisma.

## Prerequisites

- Node.js 22+
- Docker + Docker Compose (recommended way to run this — see below)

## Environment

Copy `example.env` to `.env` and fill in real values:

```
BOT_TOKEN=...
CLIENT_ID=...
POSTGRES_USER=...
POSTGRES_PASSWORD=...
POSTGRES_DB=...
DATABASE_URL=...   # see the comments in example.env for the Docker vs. local-dev value
```

`.env` is validated on startup (`src/Base/env.ts`) — if anything required is missing or
invalid, the bot prints exactly what's wrong and exits instead of starting in a broken state.

## Running with Docker (recommended)

```
docker compose up -d --build
```

This starts three services:
- `postgres` — the database (published on host port `5433`, since `5432` is often already
  taken; connect a client like pgAdmin to `localhost:5433`)
- `postgres-backup` — takes a daily Postgres dump into `./backups/` (14 daily / 4 weekly /
  3 monthly kept)
- `discord-bot` — applies any pending Prisma migrations, then starts the bot

Both `postgres` and `discord-bot` restart automatically (`restart: unless-stopped`) if they
crash or the host reboots.

To pick up code changes, rebuild: `docker compose up -d --build discord-bot`.

## Run server (local test)

Useful for fast iteration; you still need a reachable Postgres (e.g. `docker compose up -d postgres`).

```
docker compose -f server.yaml up -d --build
```

## Running locally (without Docker)

Useful for fast iteration; you still need a reachable Postgres (e.g. `docker compose up -d postgres`).

```
npm install
npm run dev          # runs the bot directly via tsx, no build step
```

## Database migrations

- `npm run migrate:dev` — create/apply a migration while changing `prisma/schema.prisma` locally
- `npm run migrate:deploy` — apply pending migrations without generating a new one (this is
  what the Docker container runs automatically on every start)
- `npm run prisma:studio` — browse the database in a GUI

## Tests

```
npm run test
```

## Building for production (without Docker)

```
npm run build   # compiles to dist/
npm run bot     # runs the compiled build: node dist/Base/app.js
```
