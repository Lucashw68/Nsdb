# Component contract and Phase 2 audit

This document records the behavior verified from the implementation and tests on 2026-09-02. It is not a design-system specification: NSDB owns generic CRUD behavior and semantic HTML, while applications own visual design and business-specific UI.

## `NsdbForm`

The minimal API remains `<NsdbForm model="playlists" />`. The model and schema are resolved through the generated registry and are re-resolved when `model`, `id`, `initialValues`, store mode, or Supabase identity changes.

- Create and edit use distinct `insertable` and `updatable` capabilities. Readonly existing values may be displayed in edit mode but never enter mutation payloads.
- `hidden` is absent from automatic UI but may remain in an explicit payload; `serverOnly` is absent from client-generated metadata and is filtered defensively.
- Untouched PostgreSQL defaults are `undefined` and omitted. NSDB does not reproduce expressions such as `now()` in the browser.
- Empty nullable controls become `null`; untouched optional/defaulted values remain `undefined`; an intentional text value remains a string. Empty numbers are never coerced to zero.
- JSON and arrays use a plain textarea fallback, validate JSON before mutation, and can be replaced by `#field-<column>`. Arrays must decode to a JSON array.
- Required, enum, relation, and obvious type constraints use native HTML plus the schema. The optional `validate` prop adds small application rules without introducing a validation DSL.
- Double submission is ignored while saving. Successful event order is `created|updated`, then `saved`; failures emit `error`, retain values, and can be retried.
- Field slots receive `field`, `fieldKey`, `value`, `update`, `error`, `mode`, and `disabled`.
- Labels/IDs/names are associated, validation uses `aria-invalid`/`aria-describedby`, the global error is live, and focus moves to the first invalid native control.

Forward single-column foreign keys render one selector per constraint/column, including multiple foreign keys to the same table and nullable/self references. Numeric keys are normalized back to numbers. Inline creation remains opt-in metadata (`allowInlineCreate`) and creates the child before the parent.

Many-to-many relations do not generate an automatic multi-select. The join table remains explicit and applications should use a field/full-form slot or a dedicated component. This avoids hiding multi-step, non-transactional mutations behind surprising UI.

`file` is only a custom field hook today; NSDB does not claim an automatic Storage+row transaction. Use a field slot and `useSupabaseApiStorage()`. Cross-service rollback/orphan cleanup remains application policy.

## `NsdbList`

The minimal API remains `<NsdbList model="playlists" />`. Inferred columns honor `selectable`, `hidden`, and `serverOnly`; explicit columns, cell/card/body/full-render slots remain available.

Automatic component loading starts on client mount so SSR output and the first
hydration render remain structurally identical. Applications that want an SSR
data fetch use the generated model from `useAsyncData`; the transferred
store-backed state is then available to the component without a server-side
component request racing hydration.

- Loading, errors, no data, and no search result are distinct states.
- Search is debounced, resets pagination, and only infers textual search columns. Filters, ordering, offset, and limit remain server-side.
- A latest-request-wins token protects direct model state from out-of-order search responses.
- Model and identity changes quarantine old rows before fetching the new scope.
- Sorting uses a native button; search has an associated label; pagination uses native labeled buttons; the table retains `table/thead/tbody/th/td` semantics.
- Object relations render a conservative label/name/title fallback or a neutral count, never `[object Object]`. Applications should use a cell formatter/slot when no human label is known.
- Delete is guarded against duplicate clicks, exposes Supabase/RLS errors, and refreshes on success.
- `refresh()` is exposed on the component ref and controller slots. Store-backed List/Form instances resolve the same Pinia collection, so successful same-model mutations render without a manual refresh. Independent direct instances still require refresh or opt-in realtime for external mutations.

## Torture coverage and limits

Vitest exercises create/update capabilities, defaults, null/empty/undefined, JSON, relations, inline creation, custom validation, dynamic models/items, stale responses, double submit, slots, semantic labels, focus, sorting, deletion errors, inferred columns, neutral relation rendering, and identity changes. Chromium exercises the standard generated UI against local PostgREST/Auth/RLS, including anonymous denial, unique violation/retry, keyboard submit, A-to-B isolation, and delete.

Automated axe scanning is not installed. Semantic assertions and keyboard E2E protect the fundamentals, but NSDB does not claim WCAG conformance. Slotted application content remains the application’s responsibility.
