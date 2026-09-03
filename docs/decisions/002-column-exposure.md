# ADR 002 — Column exposure is a generated client policy

## Context

Generic schemas and components previously surfaced every column of every exposed table.

## Decision

Column policies live at `tables.columns.<table>.<column>`. `selectable` controls generated row/default select exposure; `editable` controls mutation types and forms; `hidden` controls automatic UI only; `serverOnly` removes the column from client-generated schema/model artifacts and implies all three restrictions.

## Alternatives

Separate column arrays are shorter for one rule but harder to understand when rules overlap. Four independent booleans without validation were rejected.

## Consequences

Defaults remain compatible. Contradictory `serverOnly` policies fail validation. This is client-surface minimization, never an authorization boundary; RLS remains mandatory.
