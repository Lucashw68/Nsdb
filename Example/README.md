# NSDB Playground

`Example/` is the interactive playground for NSDB. It demonstrates real CRUD,
shared stores, Realtime, generic components, relations, Auth/RLS and Storage.
The complete documentation lives in [`website/`](../website/README.md).

Each page is a short interactive scenario backed by local Supabase. Shared
Store and Realtime are separate demonstrations so the source of each update is
always visible.

The reference environment is the disposable Supabase stack at the repository
root. No personal project, VPS, account or bucket is required.

## Requirements

- Node 22.14 or newer;
- Yarn 1.22;
- Docker-compatible container runtime for Supabase CLI.

## Start from a clone

```bash
cd Example
yarn install
yarn supabase:start
yarn nsdb:local
yarn dev:local
```

Open <http://127.0.0.1:3000>. The `dev:local` and `nsdb:local` commands read the
local URL, anonymous key and database URL from `supabase status`; they never
fall back to a remote project.

Use the **Alice** and **Bob** buttons in the playground header. These local-only
development accounts and their sample rows come from the deterministic seed and
make the RLS boundary visible immediately.

## Reset the demo

Stop the development server, then run:

```bash
yarn supabase:reset
```

This reapplies the versioned migrations and deterministic seed to the local
stack only. The playground contains no browser-side database reset action.

When finished:

```bash
yarn supabase:stop
```

## Optional custom Supabase

Copy `.env.example` and set `SUPABASE_URL` and `SUPABASE_KEY`, then use
`yarn dev`. This mode is explicit: local helper commands always use the local
CLI stack, and missing custom configuration never falls back to a personal
project. The custom project must provide the same public schema, RLS policies
and `nsdb-private` bucket as the versioned local migrations.

Set `NUXT_PUBLIC_NSDB_DOCS_URL` when the documentation website is not running
at <http://localhost:3001>.

## Validation

```bash
yarn typecheck
yarn build
yarn test:integration
yarn test:e2e
```

Playwright derives its credentials from the local Supabase CLI and exercises
the public NSDB APIs through Chromium.
