# Security model

## Boundary

Supabase Auth and RLS enforce access. NSDB table/column exposure, forms, schemas, and stores are client-side controls and cannot authorize a request. Every protected table and Storage bucket still needs tested server-side policies.

## P0 protections implemented

### Store identity isolation

`createDbStore` disables persistence by default, records `scopeOwnerId`, synchronously quarantines hydrated rows before rendering, and reveals them only after `getUser()` authenticates the same non-null owner. Unit and Chromium tests cover A -> anonymous/A/B and an initially unknown identity -> B; a mutation observer detects transient DOM disclosure.

Current contract:

- persistence defaults to false;
- user-scoped persistence stores the owner identity alongside rows;
- hydration remains quarantined until the current identity is known and matches;
- logout clears in-memory and persisted user data;
- A -> logout -> B is covered in unit and browser tests.

### Generated cleanup ownership

`nsdb clear` and stale-file cleanup now operate only on files carrying the NSDB generated marker, honor configured paths and support dry-run. Regression tests prove that unmarked user files survive.

Current contract:

- generated files carry an NSDB marker and/or a manifest;
- cleanup honors configured paths;
- only manifest-owned or marker-owned files are removed;
- user files survive regression tests.

## Other findings

- Tables are restricted with validated `include`/`exclude`; per-column policies are configured under `tables.columns.<table>.<column>`.
- PK, defaults, nullability, generated and identity status come from `pg_catalog` metadata when configured.
- Forms/lists honor `hidden`; generated mutations honor `editable`; default selects honor `selectable`; `serverOnly` is omitted from client schemas/model types/registry-driven UI.
- Generic list/form/relation controls observe Supabase identity changes, quarantine previously rendered values/options synchronously, then reload in the new RLS scope. This is defense in depth; RLS remains mandatory.
- Store and direct-model caches advance an identity-local revision. Identity mismatch clears visible rows and closes the old realtime channel before TTL reuse or reconnect logic can run. A requested store subscription may reopen only in the new identity scope; SSR never opens a channel.
- Local two-identity tests confirm that Realtime RLS suppresses another user's INSERT/UPDATE row values. Supabase may still broadcast a DELETE containing only its replica/primary key because the deleted row can no longer be checked by a SELECT policy. NSDB only removes that key if already present and exposes no deleted row values, but applications must not treat opaque client-side identifiers as secrets.
- Search/filter/select accept raw column strings. This is an advanced capability, but generated/default UI paths should restrict them to exposed selectable columns.
- The Example config reads an anon key only; no committed service-role key was found. Local integration helpers must keep service credentials server-side and test-only.
- Remote type generation executes configured shell fragments over SSH. Treat configuration as trusted developer input, validate identifiers, and document the boundary.

## Exposure configuration

The generated client policy defined by ADR 002 uses this shape:

```ts
tables: {
  include: ['profiles'],
  columns: {
    profiles: {
      email: { editable: false },
      avatar_url: { hidden: true },
      internal_note: { serverOnly: true },
    },
  },
}
```

Global include/exclude convenience may compile into the same table manifest. Contradictory settings must fail configuration validation rather than rely on precedence magic.

Column semantics:

- `selectable`: may appear in generated default selects and list metadata;
- `editable`: allowed in generated create/update UI payloads;
- `readonly`: selectable but never sent by generic mutations/forms;
- `hidden`: excluded from generic UI but usable explicitly in code if selectable;
- `serverOnly`: shorthand for non-selectable, non-editable and hidden; omitted from client-generated schema/model bindings.

These are least-exposure/DX controls, not RLS.

## Required local policy tests

Use disposable local users and rows:

1. anonymous protected reads/writes fail;
2. A creates and reads A-owned data;
3. A cannot read/update/delete B-owned data;
4. B never observes A data after store hydration or identity switch;
5. Storage object paths enforce equivalent ownership;
6. public/reference tables explicitly opt out of user scoping and have matching policies.
