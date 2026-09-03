# NSDB consolidation roadmap

This roadmap is based on the code audited on 2026-09-01, not only on README claims. Status values are **open**, **in progress**, or **done**. A priority describes risk, not implementation order inside an already protected change.

## P0 — data safety, security, and truthful failures

### P0.1 Secure Pinia persistence and identity isolation — done

- **Problem:** resolved: persistence is opt-in, hydrated rows are synchronously quarantined, and they become readable only after the restored Supabase identity exactly matches their persisted owner.
- **Impact:** cross-account client-side data disclosure.
- **Solution:** default persistence off; introduce an explicit persistence policy with scope identity, hydration quarantine, logout cleanup, and safe public-store opt-out.
- **Layers/files:** store runtime, generated store template, module/plugin integration, docs.
- **Tests:** deferred-session unit fixture plus Chromium pre-hydration scenarios persisted A -> anonymous/A/B and unknown -> B; a mutation observer proves no transient DOM disclosure.
- **Regression risk:** existing apps relying on implicit persistence need a migration note.
- **Decision:** ADR for persistence configuration and backwards-compatible warning period.

### P0.2 Make cleanup ownership-safe — done

- **Problem:** resolved with generated ownership markers, config-aware targets, stale cleanup and dry-run; unmarked user files are preserved by tests.
- **Impact:** irreversible source deletion.
- **Solution:** generated-file marker/manifest, config-aware targets, dry-run, and deletion restricted to proven generated files.
- **Layers/files:** CLI, IO helpers, every generator.
- **Tests:** user files survive; configured paths; missing/stale manifest; dry-run.
- **Regression risk:** legacy generated files without markers need a conservative migration path.

### P0.3 Propagate model/store failures — done

- **Problem:** resolved: model/store operations reject failures, the store retains reactive error state, and `NsdbList` no longer combines error and empty states.
- **Impact:** silent data loss perception and unsafe caller decisions.
- **Solution:** model/store async operations reject consistently while retaining reactive error state; lower API response objects remain compatible.
- **Layers/files:** `useSupabaseModels.ts`, `createDbStore.ts`, components.
- **Tests:** every operation failure, empty success, component error states.
- **Regression risk:** callers depending on swallowed failures must migrate to `try/catch`.

## P1 — required before a stable public contract

### P1.1 Supabase type compatibility and typed mutations — done for generated models

- **Problem:** resolved at the public generated-model boundary with distinct exposed `Row`, `Insert`, `Update` and relation-result types. The intentionally low-level query adapter still localizes Supabase builder compatibility casts.
- **Impact:** readonly/unknown columns compile; future Supabase types may break at consumer build time.
- **Solution:** generic database/table contracts, localized compatibility adapter, generated Row/Insert/Update types, type fixtures against supported Supabase versions.
- **Layers/files:** API/model runtime, templates, generated models, package exports.
- **Tests:** positive and `@ts-expect-error` fixtures for required, nullable, enum, generated, readonly, relations.
- **Regression risk:** stricter types reveal invalid existing calls.

### P1.2 Fix Nuxt registration and generated path conventions — done

- **Problem:** module proxies look for files while generators emit directory barrels; components hard-code default consumer paths; generated hooks are not intentionally auto-imported.
- **Impact:** custom paths do not work and an apparently valid consumer can compile with empty proxies or fail at runtime.
- **Solution:** one generated manifest/registry alias; resolve configured paths once; register generated composables explicitly; remove consumer-path imports from runtime components.
- **Layers/files:** module, generators, component imports, config.
- **Tests:** packed external consumer covers all component/store flag combinations, default/custom prefix, registry proxies, deterministic collision failure and explicit-import opt-out.
- **Regression risk:** Nuxt alias/import collision behavior across supported versions.

### P1.3 Deterministic, complete, safe generation — done

- **Problem:** enum output embeds the current timestamp; outputs are not pruned safely; package and CLI `generate:all` ordering differ; stores discover model files.
- **Impact:** no-op generation creates diffs, removed tables leave artifacts, model/store binding differs by command entry point.
- **Solution:** stable headers/order; shared orchestration; direct table manifest input; marker-based stale cleanup.
- **Layers/files:** all scripts, CLI, templates.
- **Tests:** rich fixtures, individual commands, twice-run byte equality, removed tables, existing custom files.
- **Regression risk:** regenerated output diffs need review/migration.

### P1.4 Table and column exposure — done

- **Problem:** every public-schema table and every row column generates client models/schema/form metadata.
- **Impact:** accidental client surface and noisy/unsafe generic UI.
- **Solution:** validated include/exclude and `tables.columns.<table>.<column>` policies compile into schemas, model types, default selects and generic components. `serverOnly` is omitted from client artifacts.
- **Layers/files:** config types/loader, generators, schema runtime, components.
- **Tests:** precedence/invalid config, excluded artifacts/imports, mutation payload filtering, consumer types.
- **Regression risk:** secure defaults versus compatibility needs an ADR.

### P1.5 Correct metadata inference — done for PostgreSQL-backed generation

- **Problem:** TS `string` cannot reveal timestamp/uuid semantics; optional Insert cannot distinguish nullable/default; readonly is name-based; `id` is assumed as PK.
- **Impact:** incorrect fields, validation, defaults, and CRUD keys.
- **Solution:** `generate:metadata` queries `pg_catalog` and records ordered PK/unique/FK constraints, SQL type, nullability, default expression, enum, identity kind and generated kind. Generation falls back conservatively when metadata is absent.
- **Layers/files:** type/schema generation, entities, models/forms.
- **Tests:** all requested scalar/default/generated/composite fixtures.
- **Limitation:** generation needs a direct `supabase.dbUrl`/`SUPABASE_DB_URL`; project-id-only remote generation currently skips metadata with a warning.

### P1.6 Relations and relation typing — done for the 1.x common contract

- **Problem:** simple, inverse, multiple-target, self and classic many-to-many relations are now constraint-centric, queryable with typed aliases and tested against PostgREST. Composite FKs are represented and queried correctly, but generated CRUD for composite primary keys remains explicitly unsupported.
- **Impact:** wrong selects/forms and untyped relation results.
- **Solution:** constraint-centric metadata with stable aliases; fix inline model resolution; add typed common relation selection while retaining raw select.
- **Layers/files:** generator, entity types, schema runtime, models, relation/form/list components.
- **Tests:** catalog/query/type fixtures plus real PostgREST cover simple, duplicate-target, optional self, inverse, many-to-many and composite FKs.
- **Regression risk:** PostgREST alias compatibility and payload size.
- **1.x boundary:** composite foreign keys are represented and queried; generated
  CRUD for composite primary keys fails explicitly and is a documented advanced
  non-blocker with the low-level API as escape hatch.

### P1.7 Component runtime coverage — done for the generic CRUD contract

- **Problem:** resolved: both components now re-resolve dynamic models, distinguish lifecycle/error/empty states, enforce metadata in mutation payloads and render semantic native controls.
- **Impact:** high regression risk and misleading model-switch behavior.
- **Solution:** public component harness plus a real RLS-backed browser fixture; mode-specific field capabilities, default/null normalization, stale-response guards, field/controller slots and accessible native controls.
- **Layers/files:** Vue components and component tests.
- **Tests:** 25 public component tests plus Chromium CRUD/RLS/keyboard/identity coverage. See `component-audit.md` for intentional many-to-many, file and axe limits.
- **Regression risk:** slots/classes are public in practice and need snapshots/assertions chosen carefully.

### P1.8 Real local Supabase, RLS, and Storage tests — done

- **Problem:** resolved at the integration baseline: committed local migrations, Auth/RLS/PostgREST relation scenarios, private Storage policies and file/bucket lifecycle tests are reproducible without production.
- **Impact:** mocks cannot validate PostgREST syntax, RLS, Auth, or Storage behavior.
- **Solution:** reproducible local stack with dedicated schema/users/policies/buckets; test helpers use local-only credentials.
- **Layers/files:** new `supabase/`, integration suites, scripts.
- **Tests:** CRUD/query, Auth/RLS isolation, Storage operation/error matrix.
- **Regression risk:** Docker/CLI availability and CI duration.

### P1.9 Real consumer build and E2E — done

- **Problem:** resolved with both the linked executable Example and a temporary external consumer that installs only the produced `.tgz`.
- **Impact:** missing exports/types and package-only failures escape detection.
- **Solution:** pack/install workflow or isolated workspace fixture, Example typecheck/build, Playwright against local Supabase.
- **Layers/files:** package scripts, Example, Playwright, CI.
- **Tests:** CRUD UI, search/filter, Storage, user switching.
- **Regression risk:** test runtime and deterministic cleanup.

### P1.10 Stabilize API and error/naming conventions — done for the 1.x candidate contract

- **Problem:** overlapping `all/fetch/find`, `show/getById/findOne`, `destroy/remove`, plural/singular filenames and response strategies.
- **Impact:** learning cost and difficult documentation/typing.
- **Solution:** one generated-model vocabulary and query object are canonical; ambiguous aliases and plural package paths were removed in the RC. Low-level response objects remain an intentional advanced contract.
- **Layers/files:** runtime, generated API, docs, examples.
- **Tests:** source absence assertions, generated type contracts, explicit auto-import allowlist and packed-consumer allowed/forbidden imports.
- **Regression risk:** real application usage is not fully inventoried.

## P2 — important DX and architecture

### P2.1 Auto-import collision policy — done

- **Problem:** runtime, generated hooks, app composables, and other modules can share names; collisions are untested.
- **Solution:** generated-model collisions fail `nuxt prepare` with an actionable message. `autoImportModels: false` enables deterministic explicit imports.
- **Tests:** collision fixtures across models/stores/composables and components prefix.

### P2.2 Simplify query surface — done for the model API

- **Problem:** positional and object signatures plus property-specific methods duplicate concepts.
- **Solution:** generated models expose only `fetch({ where, search, orderBy, limit, offset, include })`; `find`/`force`, redundant low-level helpers and positional `all` are removed.
- **Tests:** canonical behavior plus compile/source assertions for removed options and methods.

### P2.3 Split oversized components by behavior — open

- **Problem:** list/form combine model resolution, query state, rendering variants, validation, and relation orchestration.
- **Solution:** after coverage, extract pure composables/state machines only where it reduces complexity; preserve component public surface.
- **Tests:** contract tests before/after; no snapshot-only refactor.

### P2.4 Cache concurrency and invalidation — done

- **Problem:** property-order-sensitive cache keys, merge-by-default, stale cached snapshots and old fetches could corrupt the current collection after mutations/realtime.
- **Solution:** stable exact-query keys, replace-by-default, 20-entry snapshot bound, in-flight deduplication, public `refresh`/`invalidate`/`stale`, pessimistic mutation coherence and a private collection revision. Complex views invalidate instead of emulating PostgREST.
- **Tests:** controlled TTL, cache restoration/eviction, overlapping queries, fetch-versus-create/update/delete/realtime, shared consumers, reconnect, identity cleanup and SSR subscription guard.

### P2.5 Documentation as executable examples — done for RC

- **Problem:** documentation described behavior not guaranteed by tests and included obsolete Nuxt 3/layer terminology.
- **Solution:** concise package README and public API reference use the same CRUD/query calls compiled by three tarball fixtures; the historical Nuxt 3/layer page was replaced with the current Nuxt 4 contract and List examples use only `refresh`.
- **Tests:** compile documentation snippets where practical.

### P2.6 Package distribution quality — done for source-module distribution

- **Problem:** package exports source TS/Vue and has no explicit build/artifact validation; peer versions are inconsistent with Example.
- **Solution:** retain source-module distribution, declare runtime dependencies/peers accurately, and install the real tarball in an isolated Nuxt app for generation, typecheck and production build.
- **Tests:** `npm pack` content plus isolated install/typecheck/build.

### P2.7 Execute the pre-1.0 removal release — done in `1.0.0-rc.1`

- **Problem:** resolved: all aliases listed in `migration-to-stable-api.md`, including plural export paths and positional low-level lists, are removed.
- **Solution:** the repository version is prepared as `1.0.0-rc.1`; no package was published. The migration guide records mechanical replacements.
- **Tests:** package source assertions, compile-time negative calls and tarball negative export resolution protect the removal.

### P2.8 Eliminate consumer CSS source scanning — done for functional components

- **Problem:** resolved: the Example and all packed consumers no longer scan package internals.
- **Solution:** NSDB guarantees semantic, functional markup without Tailwind and leaves appearance to application CSS, `classes`, `unstyled` and slots. NSDB remains a CRUD bridge, not a design system.
- **Tests:** minimal and direct component tarball consumers typecheck/build with no Tailwind dependency or internal glob; Example also builds after removing the glob.

### P2.9 Unify release provenance — done for `1.0.0-rc.1`

- **Problem:** the package history lived in `Nsdb/`, while the validated Example, documentation, Supabase migrations and CI were outside that Git provenance.
- **Solution:** attach the existing package history to a repository rooted above `Nsdb/` with a non-squashed subtree merge. The package history and tags remain reachable without rewriting, and all release evidence is now tracked by one root commit.
- **Tests:** clean-tree generation, package suites, exact tarball consumers, Example, local Supabase/RLS/Storage/Realtime, Playwright and Agorion are replayed from the root candidate.

## P3 — future capabilities and optimization

### P3.1 Higher-level relation DSL — open

Only after metadata and typing stabilize, evaluate `relations: ['profile']` against raw `select`. Do not hide uncommon PostgREST features.

### P3.2 Generated metadata consolidation — open

Measure generated size, tree-shaking, startup, and debugging before replacing per-table thin files with one manifest. Adopt only with net benefit.

### P3.3 Composite keys and advanced Postgres support — open

Add explicit key objects and composite constraints if demanded by fixtures/users. Until then fail clearly rather than silently using `id`.

### P3.4 Performance budgets — open

After correctness, establish bundle/generated-size and query-count budgets; optimize component rendering and relation payloads with measurements.

## Delivery sequence

1. Land contributor docs and baseline characterization.
2. Protect against P0 persistence leakage and destructive cleanup with regression tests.
3. Make generation deterministic and unify orchestration.
4. Establish runtime/model/store/component/type test harnesses; correct failure contracts incrementally.
5. Repair module/path registration and prove a real consumer artifact build.
6. Add local Supabase schema, RLS/Auth/Storage integration, then browser E2E.
7. Stabilize exposure, metadata, mutation types, relations, and public naming through ADRs/migrations.
8. Consider P2/P3 simplification only with measurements and protected contracts.
