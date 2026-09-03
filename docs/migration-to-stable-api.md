# Migration to the stable NSDB API

The compatibility window ended with `1.0.0-rc.1`. The following aliases are removed; each migration is mechanical.

| Removed | Use | Reason | Removed in |
| --- | --- | --- | --- |
| `model.sync()` | `model.subscribe()` | `sync` did not identify Realtime. | `1.0.0-rc.1` |
| `model.fetch({ force: true })` | `model.refresh()` | One explicit verb for a forced network read. | `1.0.0-rc.1` |
| `model.find({ where })` | `model.fetch({ where })` | Both returned the same collection. | `1.0.0-rc.1` |
| `model.new()` | `model.createDraft()` | Explain that this creates a local schema draft. | `1.0.0-rc.1` |
| `model.all(options)` | `model.fetch(options)` | Generated models expose one collection-loading verb. | `1.0.0-rc.1` |
| `model.get(id)` | `model.getById(id)` | Make primary-key lookup explicit. | `1.0.0-rc.1` |
| `model.edit(id, data)` | `model.update(id, data)` | Match canonical CRUD vocabulary. | `1.0.0-rc.1` |
| `model.delete(id)` | `model.remove(id)` | One deletion verb for generated row models. | `1.0.0-rc.1` |
| `listRef.reload()` | `listRef.refresh()` | Match model freshness terminology. | `1.0.0-rc.1` |
| `api.show(resource, id)` | `api.getById(resource, id)` | Match model vocabulary. | `1.0.0-rc.1` |
| `api.destroy(resource, id)` | `api.remove(resource, id)` | One deletion verb for rows. | `1.0.0-rc.1` |
| `api.find(resource, options)` | `api.all(resource, options)` | Duplicate list behavior. | `1.0.0-rc.1` |
| `api.allByProperty(resource, key, value)` | `api.all(resource, { where: { [key]: value } })` | `where` is the filter syntax. | `1.0.0-rc.1` |
| `api.showByProperty(resource, key, value)` | `api.getById(resource, value, { key })` | Single-row lookup supports custom keys. | `1.0.0-rc.1` |
| `api.updateByProperty(resource, key, value, data)` | `api.update(resource, value, data, { key })` | Update supports custom keys. | `1.0.0-rc.1` |
| `api.deleteByProperty(resource, key, value)` | `api.remove(resource, value, { key })` | Explicit custom key. | `1.0.0-rc.1` |
| positional `api.all(resource, select, ...)` | `api.all(resource, options)` | One query object. | `1.0.0-rc.1` |
| `@lucashw68/nsdb/useSupabaseModels` | `@lucashw68/nsdb/useSupabaseModel` | Filename matches singular factory. | `1.0.0-rc.1` |
| `@lucashw68/nsdb/useNsdbSchemas` | `@lucashw68/nsdb/useNsdbSchema` | Filename matches singular factory. | `1.0.0-rc.1` |
| `@lucashw68/nsdb/createSingletonDbStore` | `@lucashw68/nsdb/createSingletonStore` | Filename matches symbol. | `1.0.0-rc.1` |

Earlier breaking cleanup retained by the RC:

- `@lucashw68/nsdb/helpers/config` is no longer exported; generator configuration helpers are internal.
- `normalizeBucketOptions` is now an internal Storage implementation detail. Pass bucket options directly to `createBucket()` or `updateBucket()`.
- `NsdbRelationSelect` is no longer globally registered; customize relations through `NsdbForm`'s `field-<column>` slot.
- Low-level `api.all(resource, {})` no longer invents `orderBy: 'id'`. Add an explicit `orderBy` when deterministic ordering is required. Generated models already order by their introspected primary key.

Canonical CRUD calls need no behavioral migration. Regenerate models after installing the RC so generated files no longer contain removed aliases. Promise rejection and reactive `error` behavior remain unchanged.
