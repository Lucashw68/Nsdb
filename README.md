# NSDB

**Nuxt Supabase Data Bridge**

NSDB is a typed data layer for Nuxt and Supabase. It generates the repetitive client-side CRUD layer from database types and PostgreSQL metadata while keeping Supabase responsible for data, Auth, Row Level Security (RLS), and Storage.

`1.0.0-rc.2` is the current release candidate. It has not been published to npm.

## Why NSDB?

NSDB keeps common table operations short and typed without hiding Supabase. It provides generated table models, optional Pinia-backed state and caching, Realtime lifecycle helpers, relation metadata, and generic `NsdbList` and `NsdbForm` components. Direct access through `useSupabaseApi()`, `useSupabaseApiStorage()`, and Supabase JS remains available for advanced cases.

## Quick example

```ts
const entries = useExampleTable({ store: true })

await entries.fetch()

const entry = await entries.create({
  title: 'My entry',
})

await entries.update(entry, {
  title: 'Renamed',
})

await entries.remove(entry)
```

Generic CRUD UI uses the same generated model registry:

```vue
<NsdbList model="exampleTable" />
<NsdbForm model="exampleTable" />
```

Async model operations reject on Supabase failure, so callers can use normal `try/catch`. RLS remains the authorization boundary; generated exposure metadata is not a security policy.

## Repository structure

- [`Nsdb/`](./Nsdb/) — the Nuxt module, CLI, runtime, generated-code templates, and package tests.
- [`Example/`](./Example/) — the interactive NSDB Playground.
- [`website/`](./website/) — the official public documentation source.
- [`supabase/`](./supabase/) — the reproducible local database, Auth, RLS, Realtime, and Storage fixtures.
- [`.github/`](./.github/) — continuous integration and documentation deployment workflows.

There is no root package-manager workspace. Run package commands from the relevant subdirectory.

## Getting started

The complete installation, configuration, generation, and API guides live in [`website/content/`](./website/content/). Until `1.0.0-rc.2` is published, use the repository playground to evaluate the current code instead of assuming npm availability.

Repository development requires Node.js 22.14 or newer. The package and playground use Yarn 1.22; the documentation site uses npm. Local integration and browser tests also require a Docker-compatible container runtime for the Supabase CLI.

## Playground

`Example/` runs against the repository's disposable local Supabase stack. From a fresh clone:

```bash
cd Nsdb
yarn install --frozen-lockfile

cd ../Example
yarn install --frozen-lockfile
yarn supabase:start
yarn nsdb:local
yarn dev:local
```

Open <http://127.0.0.1:3000>. See the [Playground README](./Example/README.md) for reset, validation, and shutdown commands. The Alice and Bob accounts are local-only fixtures used to demonstrate RLS isolation.

## Documentation site

```bash
cd website
npm ci --legacy-peer-deps
npm run dev
```

The static site is validated with `npm run typecheck` and `npm run generate`. A public Pages URL will be documented after deployment is confirmed.

## Development and testing

The main validation entry points are:

```bash
cd Nsdb
yarn typecheck
yarn test
yarn test:consumer

cd ../Example
yarn typecheck
yarn build

cd ../website
npm run typecheck
npm run generate
```

The packed-consumer suite installs the real package tarball in isolated Nuxt fixtures. Local Supabase integration and Playwright commands are documented in the [Playground README](./Example/README.md). Contributor expectations and generated-file rules are in [CONTRIBUTING.md](./CONTRIBUTING.md).

## Security

Do not place service-role keys, registry tokens, or production credentials in browser code, generated files, fixtures, or logs. See [SECURITY.md](./SECURITY.md) for the reporting process and project security boundaries.

## License

NSDB is available under the [MIT License](./LICENSE).
