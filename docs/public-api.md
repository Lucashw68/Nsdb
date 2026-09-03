# NSDB public API

This is the API freeze candidate validated by `1.0.0-rc.1`. The generated table model is the recommended API; stores and raw Supabase adapters use progressive disclosure.

## Generated table model

```ts
const playlists = usePlaylists({ store: true })
```

### State

| Member | Purpose |
| --- | --- |
| `items` | Reactive rows for the current collection. |
| `totalCount` | Exact count when known, otherwise `null`. |
| `loading` | Current fetch state. |
| `error` | Last relevant error, otherwise `null`. |
| `stale` | Whether visible rows require revalidation. |
| `schema` | Generated client-safe table metadata. |
| `fields` | Exposed schema keys; advanced UI metadata. |
| `editableKeys` | Editable schema keys; advanced UI metadata. |

### Operations

| Signature | Return and behavior |
| --- | --- |
| `fetch(options?)` | `Promise<Row[]>`; exact fresh store cache may satisfy it. |
| `refresh(options?)` | `Promise<Row[]>`; always queries Supabase. |
| `invalidate()` | `void`; keeps identity-safe rows and marks them stale. |
| `getById(id, select?)` | `Promise<Row \| null>` by generated primary key. |
| `create(insert)` | `Promise<Row \| null>` with the server-returned row. |
| `update(id, update)` | `Promise<Row \| null>` with the server-returned row. |
| `remove(id)` | `Promise<void>` after server confirmation. |
| `subscribe()` | `void`; idempotently requests client-side Realtime. |
| `unsubscribe()` | `void \| Promise<void>`; idempotently closes Realtime. |
| `createDraft()` | Schema-derived draft for advanced form integrations. |

Every async model operation rejects with the original Supabase/runtime error. `error` additionally exposes reactive failure state, without discarding Supabase `code`, `message`, `details`, or `hint`. Mutations update local state only after server success.

## Query API

`fetch()` and `refresh()` accept one `ModelQuery` object:

```ts
await playlists.fetch({
	where: {
		active: true,
		provider: { op: 'in', value: ['spotify', 'local'] },
	},
	search: 'rock',
	searchColumns: ['title', 'provider'],
	orderBy: 'created_at',
	orderDirection: 'desc',
	limit: 20,
	offset: 0,
	include: ['owner'],
})
```

- `where` is the canonical filter property. Operators: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `ilike`, `in`.
- `search` uses `searchColumns`; generated types protect obvious invalid search/order columns.
- `orderBy` plus `orderDirection` is the canonical sort syntax.
- `limit` and `offset` are the canonical pagination syntax.
- `include` is the canonical generated-relation syntax.
- Raw `select` and `orderForeignTable` are advanced PostgREST escape hatches.
- `merge` and `staleTimeMs` are advanced store-cache controls.

## Direct and store modes

`usePlaylists()` creates an independent direct handle. `usePlaylists({ store: true })` delegates to the generated Pinia store, sharing state, cache and Realtime. Components make the same explicit choice through the `store` prop. The Nuxt `withStores` option controls auto-import of advanced store factories; it does not silently change model behavior.

Generated stores are ADVANCED. Application code should normally call the generated model rather than `fetchFromSupabase()` or internal mutation helpers.

## Components

### `NsdbList`

Core props are `model`, `store`, `query`, `columns`, `searchable`, `searchColumns`, `pageSize`, `filters`, `sortBy`, and `sortDirection`. Styling/rendering props are `classes`, `unstyled`, `variant`, pagination display options, search value/placeholder/debounce.

Stable slots: default controller, `header`, `toolbar`, `error`, `loading`, `empty`, `cards`, `card`, `thead`, `th`, `body`, `cell`, `footer`, and `pagination`. The controller and component ref expose `refresh()`.

### `NsdbForm`

Props: `model`, `id`, `initialValues`, `labels`, `hideFields`, `store`, and `validate`. Events are emitted in `created|updated`, then `saved` order; failures emit only `error`. Stable slots are `header`, `error`, `fields`, `field-<column>`, and `actions`.

The nested relation selector is an implementation detail, not a globally registered component.

Components remain functional semantic HTML without Tailwind or a package-source scan. Applications own visual styling through normal CSS, `classes`, `unstyled`, and slots; internal runtime paths are not a styling API.

## Low-level escape hatches

`useSupabaseApi()` is ADVANCED and returns discriminated response objects instead of throwing. Its names are `all`, `getById`, `create`, `update`, `remove`, `upsert`, `count`, and `findOne`.

`useSupabaseApiStorage()` is ADVANCED and preserves Storage terminology: `list`, `upload`, `update`, `download`, `remove`, URL helpers, move/copy, and bucket administration. `joinPath` and `normalizePath` remain advanced path helpers because the real consumer uses them; they are not Nuxt auto-imports.

## Package boundaries

The package has 13 explicit export paths. `runtime/*`, `helpers/*`, `scripts/*`, templates, nested components, and former plural filename aliases are not importable subpaths. Nuxt auto-imports five runtime composables, two advanced store factories when enabled, and generated `use<Table>()` hooks.

The CLI supports `init`, `clear`, seven individual `generate:*` steps and `generate:all`. Run `nsdb --help` for the stable command list.

## Version trajectory

The repository is prepared as `1.0.0-rc.1`; this work does not publish a package. Three isolated tarball consumers validate the freeze candidate. ADVANCED APIs remain supported but are not the first-level DX contract.
