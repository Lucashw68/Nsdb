# Example playground audit

## Before

`Example/` mixed an interactive app, three Nuxt Content reference pages, test-only
routes and generated artifacts from a personal Supabase schema. Public pages used
historical `songs`, `samples`, `gears`, profile UUIDs and a `samples` bucket that
did not exist in the repository's local migrations. Its ordinary generation
scripts could also load an ambient remote project ID.

## Classification

| Previous area | Decision |
| --- | --- |
| Home demonstration menu | keep and restyle as the playground launcher |
| Direct API, model CRUD, store, components, RLS and Storage | simplify around the local schema |
| Nuxt Content component/module pages and `/bootstrap` | remove duplicate; `website/` already owns these guides |
| `/e2e` and `/persistence` | retain as unlinked test-only fixtures |
| `songs`, `samples`, `gears` generated models/stores | remove as personal-schema artifacts |
| `playlists`, `component_records`, relation fixtures | regenerate from local PostgreSQL metadata |

## After

The public playground demonstrates CRUD, direct mode, shared stores, Realtime,
generic components, typed relations, Auth/RLS and Storage. Every page contains
one interactive area, a short faithful snippet and a configurable link to the
matching `website/` route. Local commands derive all Supabase coordinates from
`supabase status`; custom Supabase use is explicit through environment variables.

The browser never exposes a database-reset operation. `yarn supabase:reset` is
the documented local-only recovery path.

## UX scenario audit

Every public page was checked against the same seven questions. “Code matches”
means the snippet uses the same public NSDB surface as the interactive action.

| Scenario | Purpose obvious | Actor obvious | Action obvious | Result obvious | Errors visible | Code matches | Docs link |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Basic CRUD | yes | yes | yes | yes | yes | yes | yes |
| Direct API | yes | yes | yes | yes | yes | yes | yes |
| Shared Store | yes | yes | yes | yes | yes | yes | yes |
| Realtime | yes | yes | yes | yes | yes | yes | yes |
| NsdbList / NsdbForm | yes | yes | yes | yes | yes | yes | yes |
| Relations | yes | yes | yes | yes | yes | yes | yes |
| Auth / RLS | yes | yes | yes | yes | yes | yes | yes |
| Storage | yes | yes | yes | yes | yes | yes | yes |

The public Playwright suite additionally checks nominal console noise, the
NsdbForm computed foreground/background/focus styles, and document overflow at
desktop and mobile widths. Expected Supabase errors have a narrow test-only
allowlist after their user-visible message and diagnostic code are asserted.
