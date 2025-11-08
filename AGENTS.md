# Repository Guidelines

## Project Structure & Module Organization
`module.ts` is the Nuxt entry point exported to consumers. All runtime code bundled with the module lives under `runtime/` (`composables/` for hooks, `stores/` for Pinia factories). CLI glue is in `cli/index.js`, while codegen utilities sit in `scripts/`. Hand-maintained typings live in `types/`; generated Supabase typings should be stored in `types/database.types.ts`.

## Build, Test, and Development Commands
Run `npm run generate:all` after updating your Supabase schema to refresh types, models, stores, and entities; it chains the individual generation scripts. When iterating on a single layer, use `npm run generate:models`, `npm run generate:stores`, or `npm run generate:entities`. `npm run generate:types` requires the Supabase CLI (`supabase gen types typescript --project-id <id>`) and writes to `types/database.types.ts`. The CLI mirror is available through `node cli/index.js generate:stores` (replace the suffix with any supported command). Use `npm run clear` to wipe previously generated artifacts before re-seeding.

## Coding Style & Naming Conventions
Target Node `>=22.14.0` and TypeScript 5 ESM modules. Prefer 2-space indentation in new code, but match the surrounding file (legacy runtime files currently use tabs). Name composables with a `use` prefix, Pinia factories as `create*Store`, and exported types/entities in PascalCase. Keep files and directories lowercase with hyphen separators. Run your editor’s TypeScript formatter or Prettier profile before committing.

## Testing Guidelines
No automated tests exist yet; exercise new work by linking the module into a Nuxt 3 sandbox app (`npm/yarn link`) and verifying CRUD flows against Supabase. After running generation scripts, ensure the generated stores hydrate correctly by checking Pinia hydration and offline persistence. New reusable utilities should include focused tests under a future `tests/` directory named `<feature>.spec.ts`.

## Commit & Pull Request Guidelines
The history shows short, version-oriented commits—follow suit with imperative, scoped messages (`fix: ensure singleton store reuse`). Bundle generated output with the code changes that produced it, and mention any files created by scripts. Pull requests should describe the Supabase schema baseline, list commands executed (`npm run generate:all`), and note breaking changes or migration steps. Link issues when available and include screenshots for UI-facing demos.

## Security & Configuration Tips
Keep Supabase keys and JWT secrets out of the repo; prefer `.env.example` placeholders. Document required `NUXT_PUBLIC_` variables only when they are safe for the client. After testing, clear local caches (`npm run clear`) so persisted Pinia state and generated files are not accidentally published.
