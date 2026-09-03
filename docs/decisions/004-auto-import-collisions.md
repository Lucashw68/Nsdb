# ADR 004 — Auto-import collisions fail explicitly

## Context

A generated `usePlaylists` and an application composable of the same name otherwise depend on Nuxt import ordering.

## Decision

NSDB detects a generated-model collision during `nuxt prepare` and throws an actionable error. Advanced consumers set `autoImportModels: false` and explicitly import generated models.

## Alternatives

Silent precedence was rejected as unpredictable. A mandatory prefix would tax every common call site.

## Consequences

The simple API stays prefix-free. Collisions require one explicit configuration choice and are covered by the packed consumer fixture.
