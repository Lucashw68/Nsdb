# NSDB Contributor Guide

This file is the reference for agents and contributors working on this repository. The repository contains `Nsdb/`, the published Nuxt module and CLI package; `Example/`, the local-first interactive playground; `website/`, the public documentation; and `Nsdb/tests/fixtures/consumer/`, the isolated app installed from the real package tarball.

## Vision

NSDB (Nuxt Supabase Data Bridge) must make Supabase in Nuxt as simple, natural, and understandable as possible. A developer with a Supabase table should be able to generate the useful metadata and immediately read and mutate rows from a Vue component without understanding NSDB internals.

Every user-facing change must answer this question positively:

> Does this API make Supabase usage in a Vue component easier to write, read, and understand?

Keep direct access through `useSupabaseApi` and Supabase JS available. NSDB is a bridge, not a replacement for Supabase, Auth, Postgres, PostgREST, Storage, or RLS.

## Priorities

Apply these priorities in order:

1. user API simplicity;
2. readability;
3. predictability;
4. type safety;
5. security;
6. robustness;
7. testability;
8. performance;
9. extensibility.

Do not trade away the first four for marginal optimization or a more abstract design.

## Repository map

- `Nsdb/module.ts`: Nuxt module registration, runtime aliases, imports, and components.
- `Nsdb/runtime/`: generic runtime composables, Pinia store factories, and Vue components.
- `Nsdb/scripts/`, `Nsdb/cli/`, `Nsdb/helpers/`: generation CLI and its implementation.
- `Nsdb/templates/`: small generated model, schema, and model-registry templates.
- `Nsdb/types/`: public configuration and runtime contracts.
- `Nsdb/tests/`: package tests. New test levels may use subdirectories and fixtures.
- `Nsdb/tests/fixtures/consumer/`: external-package contract fixture; it must know NSDB only through the installed `.tgz`.
- `Example/`: local-first Nuxt playground and browser-integration app. It demonstrates public APIs with short contextual snippets; exhaustive teaching belongs in `website/`.
- `website/`: official public documentation and API guides.
- `docs/`: contributor architecture, roadmap, API audit, security, and testing strategy.

There is currently no root package manager workspace. Run package commands from `Nsdb/` or `Example/` unless a root orchestrator is deliberately added.

## Layer responsibilities

```text
Supabase
  -> generated database types
  -> generated NSDB schemas/metadata
  -> generated thin model handles
  -> optional Pinia stores
  -> composables
  -> Vue components
```

- **Supabase** is the source of truth for schema, data, Auth, authorization, RLS, and Storage policies.
- **Types** describe Supabase `Row`, `Insert`, `Update`, enums, and relationships. They must not be weakened to `any` to hide incompatibilities.
- **Schemas/metadata** describe UI and query behavior: exposed, selectable, editable, readonly, hidden, defaults known to NSDB, and relations. Metadata is not an authorization boundary.
- **Models** expose the small canonical CRUD API and bind table types/metadata to the generic runtime. Generated models should contain no duplicated query logic.
- **Stores** are optional client cache/state. Persistence is opt-in and user-scoped data must never survive an identity change.
- **Composables** are the preferred component-facing API and the lower-level escape hatch.
- **Components** consume public model contracts. They must not import consumer-private paths or require knowledge of generated internals.

Each layer must provide identifiable value. Merge, internalize, or remove a layer that only forwards calls without improving DX, typing, security, or testability.

## Public API and internals

Treat package exports, generated composables/models, module options, CLI commands, `NsdbList`, and `NsdbForm` props/events/slots as public. Runtime helpers not exported from `package.json` and generator implementation details are internal.

The canonical generated model surface is:

```ts
items
totalCount
schema
fields
editableKeys
fetch
refresh
invalidate
getById
create
update
remove
subscribe
unsubscribe
```

`createDraft` is an advanced schema helper. The former `new`, `find`, `sync`,
`fetch({ force: true })`, and component `reload` aliases were removed for the
1.0 release candidate. See `docs/public-api.md` and ADR 007.

Prefer short generated metadata and typed bindings backed by generic runtime code over large generated implementations. Generated output must be deterministic and stale generated files must be handled safely.

## Generated code rules

- Generate only what an external Nuxt consumer needs: database types, enums, metadata, typed table bindings, optional store declarations, and a registry when generic components need one.
- Never place business logic in every generated table file.
- Respect configured output paths in generators, module registration, components, and cleanup.
- Table and column exposure must be explicit or deliberately defaulted and documented.
- Generated files must have stable ordering and stable content. Do not include timestamps or machine-specific absolute paths.
- Running `nsdb generate:all` twice against the same input must produce byte-identical output.
- Cleanup must only remove files proven to be generated by NSDB. Never delete conventionally named user files.

## User-facing syntax

Optimize frequent operations for this shape:

```ts
const playlists = usePlaylists()

await playlists.fetch()
await playlists.getById(id)
await playlists.create({ title: 'New playlist' })
await playlists.update(id, { title: 'Renamed' })
await playlists.remove(id)
```

Complex queries may use one readable options object. Do not add aliases for the same operation without a migration reason. Relations should not require PostgREST syntax for common cases, but explicit `select` remains available as an escape hatch.

## Error behavior

Async model/store operations must reject on Supabase failure so callers can use `try/catch`. Reactive `error` state may additionally expose the last failure. Do not silently convert failures to empty results or `null`, because those values also represent valid database outcomes. Lower-level response-object APIs may retain `{ success, data, error }` only when consistently documented.

## Security

- Never use a service-role key in browser code, generated files, fixtures committed to the repository, or logs.
- RLS remains mandatory for authorization. Client table/column exposure only reduces accidental disclosure and bundle metadata.
- Persistence is opt-in. Persisted user data must include a verified user scope and be cleared before another identity can observe it.
- Test anonymous, user A, and user B access against local Supabase.
- Generated forms must exclude readonly, hidden, and server-only fields from mutation payloads.
- Prefer database defaults/triggers for ownership columns instead of trusting client-provided owner IDs.

See `docs/security.md` for current risks and the target controls.

## Backward compatibility

Do not break an existing API for naming preference alone. A breaking change needs:

- evidence of user benefit;
- a documented before/after;
- a migration path or compatibility period where practical;
- tests for both the new behavior and any promised compatibility;
- a changelog/release note before publication.

## Testing

Every fix or feature needs behavior-focused tests at the lowest useful layer and at least one consumer-level test when public integration changes.

For a bug:

1. add a failing regression test;
2. implement the smallest correction;
3. run the targeted test;
4. run the relevant package/consumer suite;
5. keep the test permanently.

Required test layers are described in `docs/testing-strategy.md`: unit, generator fixtures/determinism, runtime API/models/stores/Storage, Vue components, TypeScript contracts, Nuxt module fixtures, real consumer typecheck/build, local Supabase/RLS/Storage integration, and Playwright E2E.

Never weaken an assertion merely to accommodate incorrect behavior. Integration tests must use local disposable Supabase, never production.

## Refactoring

Make incremental, reviewable changes. A significant refactor must demonstrably provide at least one of:

- simpler user API;
- less duplicated code;
- stronger types;
- better security;
- better testability;
- removal of inconsistent behavior;
- a net reduction in complexity.

Record important tradeoffs in `docs/decisions/`. Avoid mass rewrites while P0/P1 behavior lacks tests.

## Verification before handoff

Run the smallest relevant set while iterating, then report every applicable result explicitly:

```bash
cd Nsdb && yarn typecheck && yarn test
cd Nsdb && yarn test:consumer
cd Example && yarn typecheck && yarn build
```

Also run generator determinism, component/type fixtures, Supabase integration, RLS, Storage, and E2E commands when those areas change. If infrastructure is unavailable, state that the test was not run and why; never present it as passing.
