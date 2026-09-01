# santevie

## Getting started

```bash
npm install
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
