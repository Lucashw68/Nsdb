# ADR 005 — Generic component metadata semantics

## Context

Generic CRUD previously treated `Insert` and `Update` as the same shape, sent browser `null` values over database defaults, coerced empty numbers to zero, and rendered interactive table headers without native controls. Rich automatic editors for JSON, arrays, files, and many-to-many relations would add substantial magic.

## Decision

Generated field metadata carries independent `insertable` and `updatable` capabilities plus PostgreSQL type/default information. `NsdbForm` omits untouched server defaults, preserves the `null`/`undefined`/empty-string distinction, uses conservative native controls, and offers `#field-<column>` for specialized rendering. JSON/arrays get a validated text fallback. File/Storage and many-to-many editing require explicit application UI. Standard controls provide semantic labels and keyboard behavior by default.

`NsdbList` uses latest-request-wins state, native sort buttons, conservative relation formatting, visible mutation errors, and an explicit `refresh()` escape hatch. Auth identity changes synchronously quarantine rendered model data.

## Alternatives

- A generated form DSL or external form/table framework was rejected because every simple consumer would pay its configuration and dependency cost.
- Reproducing SQL defaults in JavaScript was rejected because PostgreSQL remains the source of truth.
- Automatic many-to-many and Storage transactions were rejected because their mutation/rollback semantics are application-specific.
- Silently formatting arbitrary relation objects was rejected because guessing a human label is unreliable.

## Consequences

`<NsdbForm model="playlists" />` and `<NsdbList model="playlists" />` remain the common API. Advanced fields require small, explicit slots. Existing generated schemas remain compatible through conservative fallbacks, while regeneration with PostgreSQL metadata enables more accurate controls and payloads.
