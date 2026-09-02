# santevie

## Getting started

```bash
npm install
docker compose up -d
cp .env.example .env.local
npm run dev
```

## Scripts

| Script                 | Purpose                        |
| ---------------------- | ------------------------------ |
| `npm run dev`          | Start the dev server           |
| `npm run build`        | Production build               |
| `npm run lint`         | ESLint                         |
| `npm run lint:fix`     | ESLint with autofix            |
| `npm run format`       | Prettier write                 |
| `npm run format:check` | Prettier check (used in CI)    |
| `npm run typecheck`    | `next typegen && tsc --noEmit` |
| `npm run test`         | Vitest                         |

## Local infrastructure

`docker-compose.yml` runs the services the app depends on locally:

- **postgres** — Postgres 16, exposed on `localhost:5432` (user/password/db: `santevie`).
- **minio** — an S3-compatible object store standing in for Cloudflare R2 in local dev, exposed on
  `localhost:9000` (S3 API) and `localhost:9001` (web console, login `santevie` /
  `santevie123`).
- **minio-init** — a one-shot job that creates the `santevie-local` bucket on first startup, then
  exits.

Setup steps:

1. Install Docker Desktop (or another Docker Engine + Compose v2) if you don't have it.
2. From the repo root, start the services: `docker compose up -d`
3. Check they're healthy: `docker compose ps` (postgres and minio should show `healthy`).
4. Copy the env template: `cp .env.example .env.local` — the defaults already match the
   docker-compose credentials, so no edits are needed for local dev.
5. Optional: open the MinIO console at http://localhost:9001 to browse the `santevie-local`
   bucket.
6. Stop the services when done: `docker compose down` (add `-v` to also wipe the Postgres/MinIO
   volumes and start clean next time).

In staging/production, point `S3_ENDPOINT` and the S3 credentials at a real Cloudflare R2 bucket
(see the commented block in `.env.example`) — R2 speaks the same S3 API as MinIO, so no app code
changes are needed.

## CI

`.github/workflows/ci.yml` runs on every pull request (and on push to `main`):

- **lint** — ESLint + Prettier check
- **typecheck** — `tsc --noEmit`
- **test** — Vitest
- **preview-deploy** — builds and deploys a Vercel preview, then comments the URL on the PR (PRs only, after the checks above pass)

### Preview deploy setup

The `preview-deploy` job needs a Vercel project linked to this repo and three repo secrets
(Settings → Secrets and variables → Actions):

1. `npx vercel login` then `npx vercel link` locally to create/link the Vercel project — this
   writes `.vercel/project.json` with your `orgId` and `projectId` (don't commit `.vercel/`, it's
   already gitignored).
2. Create a token at https://vercel.com/account/tokens → add as secret `VERCEL_TOKEN`.
3. Copy `orgId` from `.vercel/project.json` → add as secret `VERCEL_ORG_ID`.
4. Copy `projectId` from `.vercel/project.json` → add as secret `VERCEL_PROJECT_ID`.

Alternatively, connect the repo through the Vercel dashboard (Import Project) — Vercel then posts
PR previews itself and the `preview-deploy` job can be removed.
