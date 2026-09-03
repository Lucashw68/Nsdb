# Testing strategy

## Objective

Tests protect observable NSDB behavior from the perspective of a package consumer. The suite is layered so fast deterministic checks run on every change and local infrastructure checks cover Postgres, PostgREST, Auth, RLS, Storage, Nuxt, and a browser without contacting production.

## Test matrix

| Layer | Scope | Tool/command target | CI cadence |
| --- | --- | --- | --- |
| Unit | arguments, config merge/validation, naming, paths, query normalization, filters, cache signatures, Storage paths | Node test runner, `Nsdb/tests/unit` | every push |
| Generators | schema fixtures, enums, required/nullable/readonly/default metadata, relations, exposure, clear, stable output | Node tests invoking CLI in temporary projects | every push |
| Runtime | `useSupabaseApi`, models with/without stores, errors, empty/partial/concurrent results | Vitest or Node tests with an injected test client | every push |
| Stores | cache/TTL, refresh, merge/replace, CRUD, realtime, reset, persistence, user switching | Vitest + Pinia | every push |
| Components | public props/events/slots and DOM behavior for `NsdbList`/`NsdbForm` | Vitest + Vue Test Utils + Nuxt test utils | every push |
| Types | legal `Row`/`Insert`/`Update`, rejected unknown/readonly columns, enums, nullable values, relations | `vue-tsc`/`tsc` fixture assertions | every push |
| Nuxt module | component flags/prefix, store flag, aliases, generated proxies, collisions | minimal Nuxt fixtures | every push |
| Consumer | package resolution, generation, `nuxt typecheck`, `nuxt build` | linked `Example/` plus isolated `.tgz` consumer | every push |
| Supabase integration | real CRUD/query/count/pagination/search/relations | local Supabase CLI | integration job |
| RLS/Auth | anonymous, user A, user B isolation and denied writes | local Supabase Auth + PostgREST | integration job |
| Storage | buckets/files/paths/URLs/permissions and failure cases | local Supabase Storage | integration job |
| Browser E2E | login, list, create, edit, search/filter, delete, storage, identity switch | Playwright + Example + local Supabase | integration job |

## Generator fixture schema

A committed generated-type fixture must include:

- a simple table;
- nullable and required fields;
- insert defaults/optional fields;
- enum, uuid, numeric, boolean, timestamps, json/jsonb, and arrays;
- generated/readonly columns;
- one FK, two FKs to the same table, optional FK, self-reference;
- inverse, one-to-one, many-to-many join table;
- composite constraints where supported, and explicit unsupported assertions otherwise.

Each generator command gets an isolated output assertion. `generate:all` runs twice and compares a recursive content digest. A removed table fixture verifies safe stale-file cleanup. User-created files in output directories must survive `clear` and regeneration.

## Runtime behavior contracts

`useSupabaseApi` tests must observe the constructed requests and response semantics for all CRUD operations, `upsert`, property operations, count, filters/operators, primitive-array behavior, search escaping, select/relations, ordering, offset/limit, and invalid ranges. Chain mocks are allowed for fast contract tests, but do not replace local PostgREST integration.

Models test `items`, `totalCount`, `schema`, `fields`, `editableKeys`, `createDraft`, `fetch`, `refresh`, `invalidate`, `getById`, `create`, `update`, `remove`, `subscribe`, and `unsubscribe`, in direct and store modes. Empty results are distinct from failures. Failures reject. Concurrent requests have an explicit latest-request/revision policy.

Three packed consumers compile the canonical `createDraft`, freshness, CRUD, relation, component, store and Storage APIs using only package exports. Package-quality and type tests assert that removed aliases are absent. Forbidden runtime/helper/template/script/component and former alias imports must fail package resolution.

Store tests use fake time for TTL. They cover stable query-specific cache entries, cache restoration and the 20-snapshot bound, replace-by-default/explicit merge, in-flight deduplication, mutation invalidation, deterministic fetch-versus-mutation/realtime races, reconnect, subscriptions and unsubscribe, persisted hydration, logout, and the critical sequence A fetch -> logout -> B login. B must never observe A's rows, including during initial hydration.

Storage tests cover every exported method plus blank bucket/path, repeated separators, whitespace, nested paths, names with spaces, missing objects/buckets, insufficient rights, and local search pagination semantics.

## Component contracts

Test components from their public surface, with a registry provided the same way as in a consumer Nuxt app.

`NsdbList`: loading, success, empty, error, search debounce, filters, sort cycle, pagination boundaries, inferred/explicit columns, relation paths, formatter, cell/default/card/pagination slots, refresh, delete, and model changes if supported.

`NsdbForm`: create/edit, initial values, rapid ID/model changes, distinct insert/update capabilities, required/nullable/default/readonly/hidden fields, enum, booleans, date/datetime, JSON/array fallback, duplicate-target/numeric relation selects, inline relation creation, custom validation, double submit, retry, slots, focus and event order. File/Storage and many-to-many editing remain explicit-slot integration points.

## Local Supabase environment

Add a dedicated `supabase/` directory at repository root with reproducible migrations and seed data. Use only local anon/test credentials emitted by `supabase start`. Tests create users through local Auth APIs or an integration-only server helper. Never load a production `.env`.

Required RLS scenarios:

- anonymous access is denied where required;
- user A can create/read/update/delete A-owned rows;
- user A cannot read or mutate B-owned rows;
- user B sees no A data after a browser/store identity transition;
- server-side defaults/triggers set ownership when configured.

Storage policies repeat the same ownership scenarios for nested object paths.

## E2E and consumer build

The Example app consumes public package exports only. `Nsdb/yarn test:consumer` packs NSDB, creates three temporary apps outside the repository (minimal CRUD, relational/store, direct/Storage), installs the `.tgz` with declared peers, verifies installed realpaths/version, runs generation, Nuxt typecheck/build, the module option matrix, collision behavior and negative exports.

Playwright starts the Example app against local Supabase and performs stable, uniquely named CRUD and Storage scenarios. Tests clean up only their own records/objects and remain rerunnable.

## CI staging

Recommended jobs:

1. `quality`: package typecheck, unit, generator, runtime, store, component, and type tests;
2. `consumer`: package artifact, Example generation/typecheck/build;
3. `supabase`: local stack, integration, RLS, Storage;
4. `e2e`: local stack + built Example + Playwright.

Cache dependencies and Supabase images. Parallelize jobs after the package artifact is built. Always upload failing browser traces and local service logs. Never suppress a red job; quarantine only with an owner, reason, and expiry.

## Current baseline (2026-09-03)

- `Nsdb/yarn test`: passes: 11 Node suites plus 6 Vitest files / 77 runtime tests. Coverage includes deterministic generators, database-driven UI metadata, exposure, relation catalogs/selects, latest-request and mutation-race model state, bounded TTL caches, SSR snapshot reuse, direct/store realtime lifecycle, canonical/legacy API names, queries, Storage and 26 public list/form behaviors.
- `Nsdb/yarn typecheck`: passes. Generated model fixtures also compile valid `Insert`/`Update` payloads and reject unknown/readonly fields with `@ts-expect-error` assertions.
- `Nsdb/yarn test:consumer`: passes three real tarball installs, public-only imports, forbidden/removed import resolution, generated type assertions, typecheck, build, module matrix, collision handling and README `init` smoke. Typical isolated typechecks complete in about five seconds.
- `Example/yarn typecheck` and `Example/yarn build`: pass against the linked package.
- `Example/yarn test:integration`: passes six real local-Supabase scenarios, including two-client Realtime INSERT/UPDATE/DELETE and the observed cross-identity DELETE-key limitation, in addition to introspection, relation topology, Auth/RLS and Storage.
- `Example/yarn test:e2e`: covers three Chromium scenarios, including store-backed Form -> List coherence, second-client realtime rendering, keyboard submit, real RLS/unique failures, persisted-state quarantine, rendered A-to-B isolation, and an assertion that the nominal journey emits no browser warning, error, page exception or hydration mismatch.
- CI separates package quality, linked consumer, packed consumer and local-Supabase browser integration. Remaining depth gaps include automated axe scanning, Storage-backed form fields, many-to-many form mutation UI and composite-primary-key CRUD.
