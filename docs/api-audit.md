# Public API audit

This inventory records the `1.0.0-rc.1` freeze candidate. PUBLIC is the normal supported path, ADVANCED is supported but deliberately secondary, REMOVED identifies migration-only names, and INTERNAL must not be consumed externally.

## Generated model

| Surface | Classification | Decision |
| --- | --- | --- |
| `items`, `totalCount`, `loading`, `error`, `stale` | PUBLIC | Stable reactive state. |
| `schema` | PUBLIC | Client-safe generated metadata used by application UI and components. |
| `fields`, `editableKeys` | ADVANCED | Metadata convenience, not required for CRUD. |
| `fetch`, `refresh`, `invalidate` | PUBLIC | Stable freshness vocabulary. |
| `getById`, `create`, `update`, `remove` | PUBLIC | Stable CRUD vocabulary. |
| `subscribe`, `unsubscribe` | PUBLIC | Stable opt-in Realtime lifecycle. |
| `createDraft` | ADVANCED | Explicit schema-derived draft for custom forms. |
| `sync`, `find`, `new`, `fetch({ force: true })` | REMOVED | Replaced by `subscribe`, `fetch`, `createDraft`, and `refresh`. |

Model methods throw/reject on Supabase errors and keep a reactive `error`. `fetch`/`refresh` return rows, create/update return the server row or `null`, remove returns `Promise<void>`, and freshness/subscription intent methods return no data.

## Query surface

The single canonical query object is:

```ts
await playlists.fetch({
	where: { active: true },
	search: 'rock',
	searchColumns: ['title'],
	orderBy: 'created_at',
	orderDirection: 'desc',
	limit: 20,
	offset: 0,
	include: ['owner'],
})
```

`where`, `search`/`searchColumns`, `orderBy`/`orderDirection`, `limit`/`offset`, and `include` are canonical. Raw `select`, relation ordering, `merge`, and per-request TTL are advanced. There is no `filters` alias at model level; `NsdbList.filters` is a component convenience merged into `query.where`.

Generated types restrict obvious invalid `orderBy` and `searchColumns` keys to exposed row columns. Arbitrary raw `where` strings remain an advanced PostgREST-compatible surface; runtime components restrict inferred fields through generated exposure metadata.

## Low-level database API

| Surface | Classification | Decision |
| --- | --- | --- |
| `all`, `getById`, `create`, `update`, `remove`, `upsert`, `count`, `findOne` | ADVANCED | Supported response-object escape hatch. |
| `show`, `destroy`, `find`, `allByProperty`, `showByProperty`, `updateByProperty`, `deleteByProperty` | REMOVED | Canonical duplicates removed for the RC. |
| positional arguments after `api.all(resource, select, ...)` | REMOVED | The options object is the only list signature. |

The low-level API intentionally returns `{ success, data, error, count }`; it does not share the throwing model contract. This distinction is deliberate progressive disclosure, not accidental inconsistency.

Canonical low-level list calls do not assume that a table has an `id` column. Ordering is applied only when `orderBy` is explicit; generated models continue to provide their introspected primary key as the default order.

## Storage API

`useSupabaseApiStorage` is ADVANCED. Public operations are file list/upload/update/download/remove, public and signed URLs/uploads, move/copy, bucket administration, `joinPath`, and `normalizePath`. The real Example uses both path helpers, so removing them would add consumer code without clarifying the API. Lower normalization/search helpers are available as named advanced exports but are not Nuxt auto-imported.

## Nuxt module and auto-imports

Module options are PUBLIC: `withComponents`, `componentsPrefix`, `withStores`, and `autoImportModels`. Defaults remain `true`, `Nsdb`, `true`, and `true`. Store selection stays explicit at the handle/component call site; `withStores` only controls the two advanced store-factory auto-imports.

Runtime auto-imports are explicitly allowlisted:

- PUBLIC/ADVANCED composables: `useSupabaseApi`, `useSupabaseApiStorage`, `useSupabaseModel`, `useNsdbSchema`, `useNsdbProfile`;
- ADVANCED factories when enabled: `createDbStore`, `createSingletonStore`;
- one generated `use<Table>()` per exposed table when enabled.

Helpers exported from those files are no longer accidentally global. Generated-hook collisions fail explicitly and `autoImportModels: false` enables explicit imports.

## Components

`NsdbList` and `NsdbForm` are PUBLIC. `NsdbRelationSelect` is INTERNAL and not globally registered. `NsdbList.refresh()` is the only refresh controller. Form events `created|updated` then `saved`, and `error` on failure, are stable. Slot conventions are listed in `public-api.md` and `component-audit.md`.

## Package exports

There are 13 explicit package subpaths. They include the module root, two low-level APIs, singular runtime factories, public types, and store factories. Former plural filename aliases are blocked. Existing specific type paths remain supported entries.

`helpers/config`, `runtime/*`, `scripts/*`, nested components and utility files are INTERNAL and blocked by the package export map. The tarball consumer asserts both allowed and forbidden resolution.

## CLI and configuration

PUBLIC CLI commands: `init`, `clear`, `generate:types`, `generate:metadata`, `generate:enums`, `generate:schemas`, `generate:models`, `generate:stores`, `generate:composables`, and `generate:all`. Empty invocation and `--help` print the command inventory.

Essential generator configuration is `supabase.schema` plus one type-generation source (`projectId`, `linked`, `dbUrl`, or remote settings). Paths, imports, exposure, templates and overwrite policy are ADVANCED. Reliable defaults allow standard projects to omit paths/templates/imports.

Generated model hooks preserve the table name and apply deterministic PascalCase: `profile` -> `useProfile`, `playlists` -> `usePlaylists`, `user_profiles` -> `useUserProfiles`, `api_keys` -> `useApiKeys`. Store factories retain the historical best-effort singular form (`usePlaylistStore`) and are advanced; changing that real-consumer convention provides insufficient benefit for this phase. Relation aliases remain constraint-driven per ADR 003.

## Quantitative surface

| Area | Count |
| --- | ---: |
| npm export paths | 13 |
| runtime auto-imports | 5, or 7 with store factories |
| generated model canonical state/method members | 18 total: 8 state/metadata + 10 operations |
| `NsdbList` props | 20 |
| `NsdbList` stable slot families | 14 |
| `NsdbForm` props | 7 |
| `NsdbForm` events | 4 |
| `NsdbForm` stable slot families | 5 |
| Nuxt module options | 4 |
| CLI commands | 10 |

See `migration-to-stable-api.md` for every compatibility change and ADR 007 for the boundary decision.
