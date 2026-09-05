# Contributing to NSDB

Thank you for helping improve NSDB. The project favors a small, readable Vue-facing API, strict generated types, explicit Supabase boundaries, and reproducible tests.

## Repository layout

- `Nsdb/` contains the publishable Nuxt module and CLI package.
- `Example/` is the local-first interactive playground and browser integration app.
- `website/` is the official documentation source.
- `supabase/` contains disposable local migrations and seed data used by the playground and integration tests.

There is no root package-manager workspace. Run commands from `Nsdb/`, `Example/`, or `website/` as shown below.

## Prerequisites

- Node.js 22.14 or newer
- Yarn 1.22 for `Nsdb/` and `Example/`
- npm for `website/`
- a Docker-compatible container runtime for local Supabase integration and Playwright tests

Install dependencies without changing lockfiles:

```bash
cd Nsdb
yarn install --frozen-lockfile

cd ../Example
yarn install --frozen-lockfile

cd ../website
npm ci --legacy-peer-deps
```

## Generated files

Generated database types, metadata, schemas, models, stores, and registries must be deterministic. Keep query and CRUD business logic in the generic runtime, not in every generated table file.

- Do not hand-edit generated output when a generator or template change is required.
- Respect configured output paths.
- Never add timestamps or machine-specific absolute paths to generated files.
- Cleanup may remove only files carrying NSDB ownership markers or listed in its generated manifest.
- Unmarked user files must survive generation and `nsdb clear`.

When generation changes, run it twice against the same input and verify that the second run produces no diff.

## Tests

Run the smallest relevant tests while working, then the applicable public integration gates before opening a pull request:

```bash
cd Nsdb
yarn typecheck
yarn test
yarn test:consumer
```

```bash
cd Example
yarn typecheck
yarn build
```

For local Supabase, Auth/RLS, Realtime, Storage, and browser behavior:

```bash
cd Example
yarn supabase:start
yarn nsdb:local
yarn test:integration
yarn test:e2e
yarn supabase:stop
```

For documentation changes:

```bash
cd website
npm run typecheck
npm run generate
```

## Pull requests

- Add a behavior-focused regression test for every bug fix.
- Add a consumer-level test when package exports, Nuxt integration, generated contracts, or component-facing behavior changes.
- Do not weaken types or assertions to hide an incompatibility.
- Keep generated output and fixtures in sync with generator changes.
- Update the website and `Nsdb/CHANGELOG.md` when user-facing behavior changes.
- Explain breaking changes, user benefit, migration steps, and compatibility impact. Avoid breaking the public API for naming preference alone.
- Use only the committed local Supabase environment for integration tests; never use a production project.

Before submitting, run `git diff --check` and confirm that no `.env`, `.npmrc`, credential, build output, trace, tarball, or local Supabase runtime state is staged.

## Security

Supabase Auth and RLS remain authoritative for authentication and authorization. Client exposure settings reduce accidental surface area but never replace policies. Review [SECURITY.md](./SECURITY.md) before reporting a security issue or changing persistence, identity scoping, Storage, generated mutation payloads, or remote-generation behavior.
