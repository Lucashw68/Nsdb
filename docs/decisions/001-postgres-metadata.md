# ADR 001 — PostgreSQL metadata is authoritative

## Context

Supabase TypeScript types cannot distinguish nullability from defaults, name arbitrary primary keys, or fully describe identity/generated columns and inverse relations.

## Decision

`generate:metadata` queries `pg_catalog` through a configured direct database URL and emits deterministic `nsdb/database.metadata.json`. Generators use it for PK, unique/FK constraints, SQL types, defaults, nullability, enum, identity and generated status. Missing DB access produces a warning and preserves the compatibility fallback.

## Alternatives

Name conventions were rejected as incorrect. Parsing TypeScript alone is retained only as a degraded fallback. A custom metadata DSL would duplicate PostgreSQL.

## Consequences

Exact generation needs database connectivity in CI/development. `GENERATED ALWAYS` is non-insertable; `BY DEFAULT` remains insertable. Composite-PK CRUD fails explicitly until it has a typed key API.
