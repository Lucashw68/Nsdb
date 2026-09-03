# Data freshness audit and contract

This audit records the runtime behavior found before Phase 3 and the contract selected for consolidation.

## Behavior found

Direct models always queried the network. A latest-request token protected one fetch from another, but successful create/update/remove did not update that model instance's `items`; a fetch started before a mutation could still replace newer local truth.

Stores had a per-query TTL map, but query signatures depended on object property order. A cache hit returned cached rows without restoring them to `items`. Network results used `merge: true` by default, so unrelated filters and pages accumulated in the visible collection. Mutations patched `items` but left fresh cache entries able to restore obsolete rows. `totalCount` and cache freshness were not invalidated.

Realtime was opt-in through the ambiguously named `sync()`. INSERT/UPDATE/DELETE patched the current collection regardless of its query, duplicate subscription was guarded, but there was no public unsubscribe, logout cleanup, reconnect policy, filtered-query policy, or stale-fetch protection.

## Selected contract

NSDB keeps one visible collection per direct model instance or Pinia store. It does not implement an unbounded normalized query cache.

- Direct `fetch()` always queries Supabase. Store `fetch()` may reuse an identity-scoped snapshot for the exact normalized query while its TTL is valid.
- Query keys recursively sort object keys. A bounded store keeps at most 20 query snapshots; the most recently used entries survive.
- A successful cache hit restores its snapshot into the visible collection. Results replace `items` by default. Historical `merge: true` explicitly accumulates pages/items.
- `refresh(query?)` always queries Supabase, using the current query when omitted.
- `invalidate()` keeps safe rows visible, marks them stale, clears query snapshots, and invalidates an exact count.
- `stale` is public because it is the only reliable representation for a visible but potentially incomplete/incorrect filtered or paginated collection.
- Realtime uses only the explicit `subscribe()` and `unsubscribe()` vocabulary; the former `sync()` alias was removed in `1.0.0-rc.1`.

Mutations are pessimistic: Supabase succeeds first, then the returned server row updates local state. Create/update/remove advance an internal revision and invalidate cached snapshots, so an older fetch cannot undo them. Direct instances synchronize only themselves. Store-backed model instances share Pinia state and therefore observe the same mutations.

For the current simple, unfiltered first-page query, mutations update/sort the visible collection and maintain a known count where possible. For filtered, relation, offset, or otherwise ambiguous queries, create/update retain the last known collection and mark it stale; delete safely removes a known row. `totalCount` becomes unknown. NSDB does not implement a local PostgREST interpreter.

Realtime is explicitly enabled with `subscribe()` and stopped with `unsubscribe()`. Duplicate calls are idempotent. Simple collections deduplicate INSERT and replace UPDATE by primary key; DELETE removes a known row. Complex/filtered collections are invalidated rather than locally re-evaluated. Realtime events advance the same revision as mutations, so stale fetches cannot overwrite them. Identity changes close the old channel before clearing data; an explicitly requested subscription may reopen in the new authenticated scope. A reconnect invalidates and refreshes the current query to cover missed events. No channel is opened during SSR.

RLS remains the authorization boundary. The local stack suppresses cross-user INSERT/UPDATE values, but can broadcast a DELETE carrying only its primary key after the row no longer exists for a SELECT-policy check. NSDB never turns that event into row data; it only removes an already-known matching key.

## Direct versus store

| Behavior | Direct | Store |
| --- | --- | --- |
| `fetch()` cache | none; network | exact normalized query + TTL |
| shared instances | no | yes, through Pinia |
| mutation synchronization | current instance | all consumers of the store |
| persistence | no | optional, identity-scoped |
| `refresh` / `invalidate` | yes | yes |
| realtime | opt-in, current instance | opt-in, shared channel |
| identity isolation | instance rows clear on identity change | synchronous persisted-state quarantine |

## Deliberate limits

NSDB does not infer cross-model dependencies, maintain embedded relation graphs, queue offline mutations, poll, or evaluate arbitrary PostgREST filters locally. Applications explicitly invalidate the affected model when a business mutation makes another model stale.

## Recommended Nuxt usage

```ts
const playlists = usePlaylists({ store: true })

await playlists.fetch()       // exact fresh snapshot may satisfy this
await playlists.refresh()     // always contacts Supabase
playlists.invalidate()        // keep rows visible, mark stale

await playlists.update(id, { title: 'Renamed' })
// playlists.items is already coherent for the simple current collection

playlists.subscribe()         // client-only and opt-in
await playlists.unsubscribe()
```

Use `await playlists.fetch()` during client-only setup. In an async Nuxt page/SSR setup, call the same method from `useAsyncData`; the transferred Pinia state can then be reused by a store fetch while its TTL is valid. NSDB does not wrap `useAsyncData` and opens no realtime channel on the server.
