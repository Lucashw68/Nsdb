# ADR 006 — One current collection with bounded snapshots and opt-in realtime

## Context

The existing store mixed filtered and paginated results by default, could return a query cache without restoring visible state, and allowed stale fetches to undo mutations. Realtime patched every collection without understanding its active query and could not be unsubscribed safely.

## Decision

Each model/store exposes one current collection. Store fetches cache at most 20 exact, stable query snapshots for TTL reuse; direct fetches always use the network. Replacement is the default and `merge: true` is explicit advanced behavior. `refresh` forces the current query and `invalidate` retains rows but clears freshness. Realtime uses `subscribe`/`unsubscribe` only.

Server-confirmed mutations and realtime events advance a local revision. Fetch responses apply only when both their request order and starting revision are still current. Mutations patch simple collections pessimistically and invalidate ambiguous collections. Filtered/relation realtime events invalidate rather than emulate PostgREST. Subscriptions are optional, idempotent, client-only, identity-bound and refresh after reconnect.

## Alternatives

- A normalized multi-query entity graph was rejected as a query-library rewrite.
- A single global cache was rejected because query parameters are not interchangeable.
- Always refetching after every mutation was rejected because the common unfiltered case is locally knowable.
- Optimistic mutations were rejected because rollback and RLS failures complicate the simple contract.
- Locally interpreting all filters and embedded relations was rejected as incomplete and misleading.

## Consequences

The common API stays small: `fetch`, `refresh`, `invalidate`, `subscribe`, `unsubscribe`. Cached query variants are bounded. Complex views can remain visible while explicitly stale. Cross-model invalidation stays application-controlled. The historical `sync` alias was removed in `1.0.0-rc.1`.
