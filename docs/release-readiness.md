# NSDB 1.0 release-candidate readiness

Validated on 2026-09-03 for repository version `1.0.0-rc.1`. No package was
published.

## External consumers

All three consumers are copied to independent `/tmp/nsdb-release-consumers-*`
directories, install the actual `.tgz`, declare their peers, generate artifacts,
then run Nuxt typecheck and production build. Installed realpaths and package
versions are asserted; repository and private package paths are rejected.

| Consumer | Purpose | NSDB config | Explicit NSDB imports | Glue/workarounds |
| --- | --- | --- | ---: | --- |
| Minimal | `todos` CRUD, `NsdbList`, `NsdbForm`, default module config | type path + one table include | 0 | none |
| Relational/store | authors/posts/tags/messages/categories, typed includes, shared store, Realtime contract | type path + table allowlist | 1 type-only | none; join-table mutation remains explicit by design |
| Direct/Storage | independent direct handle, generic components, low-level SQL and avatar upload slot | type path + one table include | 2 advanced APIs | one field slot; no Storage/Postgres transaction is claimed |

The typechecks took approximately five seconds each on the validation machine.
No consumer uses `link:`, a workspace, a repository path, an NSDB/data cast, a
manual same-model store refresh, a Tailwind package-source glob, or a private
import.

## Bugs found by clean consumption

1. A source-distributed `module.ts` imported `node:fs` but `@types/node` was not
   a direct package dependency. Rich consumers hid the missing type. The package
   now declares it and the minimal consumer proves typecheck/build.
2. The advertised dependency floor was broader than the tested Nuxt/Pinia/Vue
   combination. The peer floor is now the actually built matrix: Nuxt 4.2.1,
   `@pinia/nuxt` 0.11.2, Pinia 3 and Vue 3.5.24.
3. `NsdbList` warned about non-text columns while silently inferring search
   fields, even on nominal renders. Inferred columns are now filtered silently;
   only an explicitly invalid search column warns.
4. Generated models still imported the removed plural schema subpath. The model
   template and regenerated Example now use the singular public path.
5. `NsdbList` started its automatic request during SSR setup. A fast server-side
   error or result could therefore render a different initial branch than the
   hydrating browser. Automatic loading now starts on client mount; an E2E
   console assertion protects against hydration warnings and page errors.
6. Yarn's development `link:` can hoist a linked package dependency into the
   Example tree. CI now installs the linked Example first and repairs/validates
   the package dependency tree second; release evidence still comes from the
   independent npm tarball consumers.
7. Resolving different Vue patch versions in the linked Example and package
   trees produced a Nitro symlink loop in a stale `.output`. A clean rebuild is
   green. The release proof comes from isolated tarball consumers, which resolve
   one Vue 3.5.24; the linked Example can still contain Nuxt's nested Vue 3.5.42
   and is not used as package-isolation evidence.

## Packaging and styling

The package remains a Nuxt source-module distribution. Thirteen explicit export
paths are public. Negative resolution covers runtime internals, helpers, scripts,
templates, nested components and former filename aliases.

Generic components require no Tailwind integration for behavior or semantic HTML.
The Example's private `node_modules/.../runtime/**/*.vue` scan was removed.
Applications style through normal CSS, component `classes`, `unstyled` where
available, and slots. NSDB does not promise a bundled design system.

## Release gates

### RC blockers

None found after the full package, consumer and local-Supabase/browser suites.

### 1.0 blockers

- Run the same release suite against the exact commit/tag intended for publish.
- Review the RC in at least one existing application and confirm the documented
  alias migration before promoting the identical public surface to `1.0.0`.

### Explicit non-blockers

- composite-primary-key generated CRUD, because generation fails explicitly and
  the low-level API remains available;
- automatic many-to-many form mutation;
- automatic Storage/Postgres transactions;
- rich JSON/array editors, a higher relation DSL, offline queues, optimistic
  mutation engines, automatic dependency graphs, and axe/WCAG certification.

These are absent or explicit advanced integration points; none changes the
correctness of the frozen common API.

## Freeze candidate

The candidate contract is the exact model surface in `public-api.md`, the four
Nuxt module options, table/column exposure contracts, `NsdbList`/`NsdbForm`
props/events/slots documented there, and the two low-level escape hatches.
Breaking changes after RC require a release-blocking correctness, security,
typing or packaging defect.

## RC Validation — 1.0.0-rc.1

Validation performed on 2026-09-03. No package was published.

### Artifact

- package commit: `e9ae7523b6fd1b0b70c3cfca42b4ea516169fbc1`;
- package version: `1.0.0-rc.1`;
- tarball: `lucashw68-nsdb-1.0.0-rc.1.tgz`;
- SHA-256: `41e8405d2da082c609ecca65ad20b59815ec9e85b34a48a2eef561e474592849`;
- npm shasum: `6c9d86b6f13155250fc615ab7e1eb047aadacc45`;
- package size: 60,278 bytes compressed, 238,740 bytes unpacked, 48 files;
- validation runtime: Node 22.21.0, npm 10.9.4, Yarn 1.22.22 and Supabase CLI 2.39.2.

`npm pack --dry-run --json` and the installed artifact report the same metadata.
The tarball exposes 13 deliberate package subpaths. Negative import assertions
cover runtime internals, helpers, scripts, templates, nested components and
removed aliases.

### Full suite

| Gate | Exact result |
| --- | --- |
| Package typecheck | pass |
| Node/generator tests | 11/11 files pass |
| Runtime/model/store/component/type tests | 77/77 pass |
| Fresh tarball consumers | minimal, relational/store and direct/Storage pass install, generation, typecheck and build |
| Module fixtures | all component/store/prefix combinations pass; the deliberate auto-import collision fails with the expected actionable error |
| Example typecheck | pass |
| Example production build | pass after removing a stale `.output`; external font-provider requests were unavailable in the sandbox but did not fail the build |
| PostgreSQL/Supabase integration | 6/6 pass: catalog introspection, relations, Auth/RLS, two-client Realtime and Storage |
| Playwright Chromium | 3/3 pass: CRUD/Storage/identity, pre-hydration quarantine and generic component/RLS behavior |
| Generation determinism | two byte-identical runs against the same allowlisted local schema |
| Composite-key behavior | explicit generation failure, as documented; no incorrect model is emitted |
| Package diff checks | `git diff --check` pass and `Nsdb/` worktree clean |

The isolated npm consumers resolve the tarball physically inside their own
`node_modules`, never through a link or workspace. The tested minimal tree has
one Vue 3.5.24 and one Pinia 3.0.3. The direct/Storage consumer also compiles
with `@nuxtjs/supabase` 2.0.9. Its module warns that the default Nuxt 4
`app/types` location is absent because NSDB's generated database type is at the
configured root path; this is a consumer configuration warning, not an NSDB
runtime warning, and the generated public types still compile.

### Existing application migration

Three existing applications were inspected without modifying their original
working trees.

- **Agorion**, commit `2cd42c749e2d734926b9ad56fdbf55aa0bcd68d0`, was copied to an isolated
  directory and its development `file:` dependency was replaced by the exact
  RC tarball. It contained no removed NSDB alias. Its 23 Node suites, Nuxt
  typecheck and production build pass. The built server returns HTTP 200 for
  `/` and `/api/health`, with no NSDB warning or error.
- **NewMysic**, based on commit `151b01eca4972d02f02ae3b76322d2893a8d752b`, exposed 16 genuinely removed
  calls in its current application state. The temporary migration was
  mechanical (`find` to `fetch`, `show` to `getById`, positional `all` to the
  options object, and property helpers to `where`/custom-key calls). It found a
  real compatibility bug with the typed client from `@nuxtjs/supabase` 2.0.9.
  The package fix is covered by the Supabase-2 consumer. NewMysic itself cannot
  be certified green because its source working tree already contains extensive
  unrelated deleted/incomplete application code and baseline type errors.
- **LecturoMetre**, clean HEAD `c36c3db3f2561a667e5dfffc53b0534ec35214c2`, required the previously
  undocumented `model.get(id)` to `model.getById(id)` rename. Regeneration and
  migration were successful in the temporary copy, but unrelated baseline
  application errors prevent a green whole-app typecheck. The migration table
  now records this older generated-model alias, plus `all`, `edit` and `delete`.

No application was patched to deep-import NSDB, copy helpers, weaken generated
types or access package internals.

### Bugs discovered and fixed

1. A fresh npm resolver rejected the advertised Pinia floor because
   `@pinia/nuxt` 0.11.2 requires Pinia 3.0.3. The peer and fixture floor are now
   3.0.3, protected by package-quality and clean-consumer tests.
2. `generate:all --db-url ...` was polluted by an ambient
   `SUPABASE_PROJECT_ID`, causing Supabase CLI to ignore the explicit local
   database. Explicit database generation now removes that variable only for
   the child CLI process; two regression tests cover set and absent values.
3. The typed client returned by `@nuxtjs/supabase` 2.0.9 rejected the low-level
   API's dynamic table string at compile time. A cast is now localized to that
   deliberate low-level boundary; generated model Row/Insert/Update types remain
   strict.
4. Example's Yarn tree hoisted `entities` 4 while Nuxt's compiler requested the
   version-7 `./decode` export. Declaring `entities` 7 in Example removes the
   runtime 500 and the browser suite passes. This is an Example dependency-tree
   correction, not a package API change.

### API freeze

The proposed frozen model contract remains unchanged:

```ts
const model = useXxx({ store: true })

model.items
model.totalCount
model.loading
model.error
model.stale

await model.fetch(options?)
await model.refresh(options?)
model.invalidate()

await model.getById(id, select?)
model.createDraft()

await model.create(data)
await model.update(id, data)
await model.remove(id)

model.subscribe()
await model.unsubscribe()
```

`schema`, `fields` and `editableKeys` remain advanced stable metadata. Core
query syntax remains `where`, `search`/`searchColumns`, `orderBy`/
`orderDirection`, `limit`/`offset` and `include`. `select`,
`orderForeignTable`, `merge` and `staleTimeMs` remain advanced options.
Direct mode is local/non-shared; `{ store: true }` provides shared cached state.
The component core remains `NsdbList`/`NsdbForm`, the `store` prop, documented
field/cell/full-render slots, `refresh()` on the list ref, and the form's
`created`, `updated`, `saved` and `error` events.

### RC blockers

One release-process blocker remains: only `Nsdb/` is a valid Git repository in
the supplied checkout. The root `.git` is an empty directory, so `Example/`,
`docs/`, Supabase migrations and the CI workflow cannot be tied to the package
SHA or proven clean by Git. The package artifact itself is reproducible from a
clean commit, but the claim that the *full* validation ran on one exact tagged
repository state is not yet provable. Repair or clarify the repository topology
and commit these release fixtures/documents before tagging.

### 1.0 blockers

- Resolve the same validation-provenance blocker before the RC tag.
- Obtain one green whole-application validation that exercises generated CRUD
  aliases in an existing application, or explicitly accept Agorion's green
  package/module migration plus the mechanically proven NewMysic/LecturoMetre
  migrations as sufficient pilot evidence. This is a release-confidence gate,
  not an API defect.

No security, data-coherence, public-API, tarball, type or NSDB runtime blocker
was found.

### Non-blockers

Composite-PK CRUD, an automatic many-to-many editor, Storage/Postgres
transactions, rich JSON/array editors, an advanced relation DSL, offline or
optimistic engines, and complete WCAG certification remain explicitly outside
the 1.0 contract. External font metadata availability and dependency-age
warnings observed during the sandboxed Example build are also not NSDB release
blockers.

### Release recommendation

**NOT READY FOR RC TAG yet.** The code/package candidate and its exact tarball
are technically green, and the frozen API did not require a change. The sole RC
tag blocker is provenance: the release-supporting Example, docs, migrations and
CI are not tracked by the valid `Nsdb/` Git repository in this checkout. Once
that topology is repaired and the unchanged suite is replayed on the resulting
commit, the package evidence supports **READY FOR RC**.

After a manual RC publication, keep the contract feature-frozen, install the RC
in pilot applications, accept only correctness/security/typing/packaging fixes,
issue an RC successor only if required, and promote to 1.0 when no fundamental
issue remains.
