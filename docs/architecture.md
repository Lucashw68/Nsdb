# NSDB architecture

## Current repository

NSDB is not currently a package-manager workspace. It consists of the publishable source-module package in `Nsdb/`, the linked local-first Nuxt 4 playground in `Example/`, the public documentation in `website/`, and isolated consumer fixtures installed from `npm pack` under `Nsdb/tests/fixtures/`.

### Build-time and generation flow

```text
PostgreSQL `pg_catalog` + Supabase CLI
  -> nsdb/database.metadata.json
  -> Example/types/database.types.ts
  -> ts-morph generators
  -> Example/nsdb/enums.ts
  -> Example/nsdb/schemas/*.ts
  -> Example/nsdb/models/*.ts
  -> Example/stores/*.ts (optional)
  -> Example/nsdb/composables/useNsdbModels.ts
```

`Nsdb/cli/index.js` dispatches `init`, `clear`, and generation commands. Generation reads the Supabase-generated `Database` alias through ts-morph. Schemas and models are generated per table; runtime query logic remains generic, which is directionally sound.

Both `generate:all` entry points generate types, metadata, deterministic schemas/models/stores and the registry in the same dependency order. Metadata is required for exact SQL semantics; when no direct database URL is configured the compatibility path warns and uses the less precise generated TypeScript information.

### Nuxt module

`Nsdb/module.ts`:

- installs the `#nsdb` runtime alias;
- optionally registers components with a configurable prefix;
- auto-imports runtime composables and optional store factories;
- attempts to create `#build/nsdb/models` and `#build/nsdb/schemas` proxies.

The module creates `#build/nsdb/{models,schemas,registry}` proxies for generated app barrels, registers optional components/stores, and auto-imports generated model hooks. A same-name application composable is rejected explicitly; `autoImportModels: false` is the deterministic explicit-import escape hatch.

### Runtime data flow

```text
NsdbList / NsdbForm
  -> generated useNsdbModel(string) registry
  -> generated table model
  -> useNsdbSchema + useSupabaseModel
  -> optional createDbStore OR useSupabaseApi
  -> @nuxtjs/supabase client
  -> PostgREST / Realtime
```

`useSupabaseApi` provides response-object CRUD/query methods. `useSupabaseModel` exposes the simpler table API and owns reactive `items`/`totalCount` in direct mode. Generated models bind schemas and optionally stores. `createDbStore` adds caching, realtime, mutation synchronization, and persisted-state configuration.

`useSupabaseApiStorage` wraps Storage operations with the same response-object style and local path normalization/search.

### Freshness boundary

Each handle represents one current collection. Direct handles always fetch from Supabase; Pinia stores may restore one of at most 20 exact, identity-scoped query snapshots during its TTL. Stable recursive query keys prevent property-order cache misses. `refresh()` bypasses TTL, while `invalidate()` keeps safe rows visible and marks the collection stale.

Server-confirmed mutations and realtime events advance a private collection revision. A fetch begun against an older revision cannot overwrite them. Simple current collections are patched and sorted locally; filtered, paginated-offset or relation-embedded collections are invalidated rather than interpreted as PostgREST expressions in the browser. Realtime is opt-in, client-only and identity-bound. See `data-freshness-audit.md` and ADR 006.

### Existing public surface

- Nuxt module: package root export.
- Components: `NsdbList` and `NsdbForm`; the nested relation selector is internal.
- Runtime composables: `useSupabaseApi`, `useSupabaseApiStorage`, `useSupabaseModel`, `useNsdbSchema`, and `useNsdbProfile`; singular package paths match their symbols.
- Store factories: `createDbStore`, `createSingletonStore`.
- Generated hooks: `usePlaylists()`-style table models and `useNsdbModel(name)` registry.
- CLI: `init`, `clear`, `generate:*`, `generate:all`.

Nuxt auto-imports use an explicit allowlist rather than directory-wide export discovery. Package exports similarly block `runtime/*`, generator helpers, nested components, and removed plural aliases. The internal relation selector and Storage configuration helpers are not public surfaces. See `public-api.md` and ADR 007.

## Target architecture

Keep the current layered design, but make the boundaries explicit:

```text
Supabase schema and policies
  -> generated Database types
  -> compact generated table metadata + typed bindings
  -> generic runtime model
  -> optional, secure cache adapter
  -> generated named composable / generic registry
  -> generic Vue components
```

The target does not require a rewrite. It requires these boundary corrections:

1. One canonical table manifest drives schemas, models, stores, registry, exposure, and Nuxt registration.
2. Generated table functions use `Row`, `Insert`, and `Update` separately.
3. Components resolve public registries through module-provided aliases/injection, never hard-coded consumer paths.
4. Model operations throw consistently; low-level response APIs remain available.
5. Store persistence is off by default and explicit user scoping is part of persisted state.
6. Exposure metadata distinguishes selectable, editable, readonly, hidden, and server-only fields without claiming to replace RLS.
7. Relation metadata identifies constraints, direction, alias, cardinality and join tables; `include: ['author']` covers common selects while raw Supabase `select` stays available.
8. Generator outputs are deterministic, remove only marked stale outputs, and obey configured paths.

## Generated versus generic

Generate:

- Supabase types (via official CLI);
- stable enum values;
- table/column/relation metadata that cannot be inferred safely at runtime;
- thin typed named composables;
- a table registry/manifest;
- optional thin store declarations.

Keep generic:

- query construction and error normalization;
- CRUD state transitions;
- cache/TTL/session handling;
- Storage behavior;
- list/form rendering and validation;
- Nuxt registration logic.

This retains debuggability and tree-shaking without duplicating runtime logic per table.

## Constraints and open decisions

- Exact metadata requires direct PostgreSQL access during generation. Generated TypeScript alone remains a compatibility fallback and cannot recover every SQL semantic.
- Exposure is compatibility-preserving by default; security-sensitive projects should use a table allowlist and `serverOnly` column policies.

Generic component behavior is metadata-driven without adding a UI framework. Generated fields distinguish `insertable` from `updatable`, retain PostgreSQL `databaseType` and default metadata, and let `NsdbForm` omit server-owned defaults rather than reproducing SQL in the browser. Native controls cover scalar/date/enum/simple-FK cases; JSON/arrays have a conservative validated fallback; specialized fields remain replaceable through slots. `NsdbList` is both a semantic default table and a headless controller through its full slot. Store-backed List/Form instances share successful same-model mutations; direct instances still use explicit `refresh()` for external mutations. See `component-audit.md`, `data-freshness-audit.md`, ADR 005 and ADR 006.
- Model promises reject the original Supabase/runtime error and low-level APIs preserve it in `error`; NSDB deliberately does not wrap away `code`, `message`, `details`, or `hint`, nor add a second throwing mode.
- Composite foreign keys are represented; generated CRUD intentionally rejects tables whose primary key is absent or composite until a typed key-object API is designed.
