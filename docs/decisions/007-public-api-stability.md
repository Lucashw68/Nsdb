# ADR 007 — Stable API uses one vocabulary and explicit package boundaries

## Context

NSDB exposed a good generated-model API alongside historical synonyms (`sync`, `find`, `new`, `reload`, `show`, `destroy`), plural filenames for singular factories, and directory-scanned auto-imports that made unrelated exports global.

## Decision

The model vocabulary is `fetch`, `refresh`, `invalidate`, `getById`, `create`, `update`, `remove`, `subscribe`, and `unsubscribe`. `fetch(options)` uses `where`, search, ordering, `limit`/`offset`, and `include`. `createDraft` is the explicit advanced draft helper.

Historical callable aliases and plural package subpaths were removed in `1.0.0-rc.1`. Nuxt runtime auto-imports and npm exports use explicit allowlists. Generic relation internals and generator configuration helpers are private. Storage path helpers remain advanced because the real consumer demonstrably uses them.

## Alternatives

- Keeping every alias indefinitely was rejected because it makes documentation and support ambiguous.
- Removing all aliases immediately was rejected because migrations are mechanical and can use a short compatibility window.
- Adding a fluent query DSL was rejected because one options object remains clearer in Vue components.
- Making store mode implicit was rejected because cache, sharing and persistence are observable semantics.

## Consequences

Common CRUD syntax does not change. Consumers use canonical type and factory entry points. Contract tests compile the canonical API from three installed tarball consumers and assert that removed aliases and private paths cannot resolve.
