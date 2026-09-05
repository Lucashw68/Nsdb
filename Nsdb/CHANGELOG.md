# Changelog

## 1.0.0-rc.1 — release candidate

- freezes the generated model vocabulary around `fetch`, `refresh`,
  `invalidate`, `getById`, `create`, `update`, `remove`, `subscribe`, and
  `unsubscribe`;
- accepts either a generated primary-key value or a complete model row as the
  target of `update` and `remove`, without copying row fields into mutations;
- removes the pre-1.0 aliases documented in the migration guide;
- ships typed PostgreSQL metadata, column exposure and relation aliases;
- stabilizes optional identity-scoped Pinia caching and opt-in Realtime;
- stabilizes the metadata-driven `NsdbList` and `NsdbForm` contracts;
- prevents `NsdbList` automatic loading from producing SSR hydration races;
- keeps explicit `--db-url` generation independent from a remote project ID
  loaded through `.env`;
- validates the dynamic low-level API with `@nuxtjs/supabase` 2.x typed clients;
- declares the Nuxt 4.2.1 / Vue 3.5.24 release-candidate compatibility floor;
- validates the source package through three independent Nuxt tarball
  consumers, local Supabase/Auth/RLS/Storage/Realtime and Chromium.

No package has been published by this repository change.
