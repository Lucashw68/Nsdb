# ADR 003 — Constraint-centric relation aliases

## Context

Table-name-only relations overwrite multiple FKs and cannot describe inverse, self, many-to-many or composite relationships safely.

## Decision

Metadata keeps constraint names, ordered columns, direction, nullability and stable aliases. Common queries use `fetch({ include: ['author'] })`. FK column names produce forward aliases (`sender_id` -> `sender`); inverse aliases remain distinct; self relations use `parent`/`children`; classic two-FK constrained join tables add many-to-many aliases. Raw `select` remains available.

## Alternatives

A nested query DSL was rejected as unnecessary complexity. Raw PostgREST-only syntax was rejected for common-case DX and typing.

## Consequences

Simple through advanced relation results are typed by selected aliases. Payload join tables are not hidden. Composite FKs are represented; composite-PK generated CRUD is explicitly unsupported.
