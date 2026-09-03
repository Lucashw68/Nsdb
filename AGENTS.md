# NSDB Integration Guide for Agents

This file is for coding agents integrating NSDB into another Nuxt project.
It is not a contributor guide for developing NSDB itself.

NSDB connects a Nuxt app to Supabase with generated types, schemas, models, optional Pinia stores, ready-to-use components, and Storage helpers.

## When to Use NSDB

Use NSDB when the target project is a Nuxt app using Supabase and needs:

- typed access to Supabase tables
- generated CRUD model composables
- optional Pinia stores for local/cache usage
- server-side list search, sort, pagination, and filters
- quick CRUD UI with `NsdbList` and `NsdbForm`
- simple Supabase Storage helpers

## Required Packages

Install in the target Nuxt project:

```bash
yarn add @lucashw68/nsdb @nuxtjs/supabase @pinia/nuxt pinia
yarn add -D supabase
```

If persisted stores are wanted:

```bash
yarn add pinia-plugin-persistedstate
```

## Environment

Add the Supabase values in the target project's `.env`:

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_PROJECT_ID=your-project-id
```

Never commit Supabase service role keys.

## Nuxt Configuration

Add NSDB, Supabase, and Pinia to `nuxt.config.ts`:

```ts
export default defineNuxtConfig({
	modules: [
		'@lucashw68/nsdb',
		'@pinia/nuxt',
		'@nuxtjs/supabase',
	],

	nsdb: {
		withComponents: true,
		componentsPrefix: 'Nsdb',
		withStores: true,
	},

	supabase: {
		redirectOptions: {
			login: '/',
			callback: '/confirm',
			exclude: ['/', '/public-page'],
		},
	},
})
```

If using persisted stores:

```ts
export default defineNuxtConfig({
	modules: [
		'@lucashw68/nsdb',
		'@pinia/nuxt',
		'@nuxtjs/supabase',
		'pinia-plugin-persistedstate/nuxt',
	],

	piniaPluginPersistedstate: {
		storage: 'localStorage',
	},
})
```

If a public test/demo page should be accessible without authentication, add it to `supabase.redirectOptions.exclude`.

## NSDB Config

Create `nsdb.config.ts` at the target project root:

```ts
import type { NsdbConfig } from '@lucashw68/nsdb/types/config'

export default {
	supabase: {
		schema: 'public',
		projectId: process.env.SUPABASE_PROJECT_ID,
		linked: false,
	},
	paths: {
		types: 'types/database.types.ts',
		enums: 'nsdb/enums.ts',
		schemas: 'nsdb/schemas',
		models: 'nsdb/models',
		composables: 'nsdb/composables',
		stores: 'stores',
	},
	imports: {
		databaseTypes: '~~/types/database.types',
	},
} satisfies NsdbConfig
```

If Supabase CLI is linked locally:

```ts
import type { NsdbConfig } from '@lucashw68/nsdb/types/config'

export default {
	supabase: {
		schema: 'public',
		linked: true,
	},
} satisfies NsdbConfig
```

## Package Scripts

Add scripts to the target project's `package.json`:

```json
{
	"scripts": {
		"nsdb:types": "nsdb generate:types",
		"nsdb:enums": "nsdb generate:enums",
		"nsdb:schemas": "nsdb generate:schemas",
		"nsdb:models": "nsdb generate:models",
		"nsdb:composables": "nsdb generate:composables",
		"nsdb:stores": "nsdb generate:stores",
		"nsdb:all": "nsdb generate:all"
	}
}
```

Run:

```bash
yarn nsdb:all
```

Expected generated structure:

```txt
types/
  database.types.ts

nsdb/
  enums.ts
  schemas/
  models/
    index.ts
  composables/
    useNsdbModels.ts

stores/
  useXStore.ts
```

## Generated Model Usage

Generated models are auto-imported by Nuxt.

Example for a `playlists` table:

```vue
<script setup lang="ts">
const playlists = usePlaylists()

await playlists.fetch({
	select: '*',
	orderBy: 'created_at',
	orderDirection: 'desc',
	limit: 20,
	offset: 0,
})

const created = await playlists.create({
	title: 'New playlist',
})

const row = await playlists.getById(created.id)

await playlists.update(created.id, {
	title: 'Updated playlist',
})

await playlists.remove(created.id)
</script>
```

Canonical model API:

```ts
items
totalCount
schema
fields
editableKeys
fetch
refresh
invalidate
getById
create
update
remove
subscribe
unsubscribe
```

`createDraft()` is an advanced form helper. The former `new`, `find`, `sync`,
`fetch({ force: true })`, and `NsdbList.reload()` aliases are not available in
the 1.0 release candidate.

Do not use removed compatibility aliases on models:

```ts
all
list
get
add
edit
patch
delete
```

## Server Query Options

Use `fetch` with one server-side query object:

```ts
await playlists.fetch({
	select: '*, profile:profiles!playlists_profile_id_fkey(*)',
	where: {
		provider: 'spotify',
		created_at: { op: 'gte', value: '2026-01-01' },
	},
	search: 'rock',
	searchColumns: ['title', 'provider'],
	orderBy: 'created_at',
	orderDirection: 'desc',
	limit: 10,
	offset: 0,
})
```

Supported `where` operators:

```ts
'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'in'
```

Only use text columns in `searchColumns`. PostgREST `ilike` does not work on uuid, numeric, boolean, or date columns without explicit casts.

## Use `NsdbList`

`NsdbList` provides server-side search, sort, pagination, filters, and free slots.

```vue
<template>
	<NsdbList
		model="playlists"
		:columns="columns"
		:page-size="10"
		searchable
		:search-columns="['title', 'provider']"
		:query="{
			select: '*, profile:profiles!playlists_profile_id_fkey(*)',
			orderBy: 'created_at',
			orderDirection: 'desc'
		}"
	/>
</template>

<script setup lang="ts">
const columns = [
	{ key: 'title', label: 'Title' },
	{ key: 'provider', label: 'Provider' },
	{ key: 'profile.username', label: 'User' },
]
</script>
```

Custom cell:

```vue
<NsdbList model="playlists" :columns="columns" :page-size="10">
	<template #cell="{ column, value, row }">
		<strong v-if="column.key === 'title'">{{ row.title }}</strong>
		<span v-else>{{ value }}</span>
	</template>
</NsdbList>
```

Full custom rendering:

```vue
<NsdbList model="playlists" :page-size="6" searchable>
	<template #default="{ rows, loading, currentPage, totalPages, prevPage, nextPage }">
		<p v-if="loading">Loading...</p>

		<div>
			<article v-for="row in rows" :key="row.id">
				<h2>{{ row.title }}</h2>
			</article>
		</div>

		<button @click="prevPage">Prev</button>
		<span>{{ currentPage }} / {{ totalPages }}</span>
		<button @click="nextPage">Next</button>
	</template>
</NsdbList>
```

## Use `NsdbForm`

`NsdbForm` builds a form from generated NSDB schemas.

Create mode:

```vue
<NsdbForm
	model="playlists"
	:hide-fields="['id', 'created_at']"
	@created="handleCreated"
	@error="handleError"
/>
```

Edit mode:

```vue
<NsdbForm
	model="playlists"
	:id="playlistId"
	@updated="handleUpdated"
/>
```

Events:

```ts
saved
created
updated
error
```

## Optional Stores

Generated stores are optional. Use them when the app needs local state, persistence, or a cache to limit repeated Supabase calls.

```vue
<script setup lang="ts">
const playlistsStore = usePlaylistsStore()

await playlistsStore.fetchFromSupabase({
	limit: 20,
	staleTimeMs: 60_000,
})

const row = playlistsStore.getById('playlist-id')

await playlistsStore.create({ title: 'From store' })
await playlistsStore.update('playlist-id', { title: 'Updated' })
await playlistsStore.remove('playlist-id')
</script>
```

If stores are generated after models, regenerate models so model handles can bind to stores:

```bash
yarn nsdb:stores
yarn nsdb:models
```

`yarn nsdb:all` already handles this order.

## Supabase Storage

Use `useSupabaseApiStorage` for Storage operations:

```vue
<script setup lang="ts">
const storage = useSupabaseApiStorage()

const files = await storage.list('avatars', {
	path: 'users',
	orderBy: 'name',
	orderDirection: 'asc',
})

await storage.upload('avatars', 'users/me.png', file, {
	upsert: true,
	contentType: file.type,
})

const publicUrl = storage.getPublicUrl('avatars', 'users/me.png')
const signedUrl = await storage.createSignedUrl('avatars', 'users/me.png', 300)
const downloaded = await storage.download('avatars', 'users/me.png')

await storage.remove('avatars', 'users/me.png')
</script>
```

Storage methods:

```ts
list
upload
update
download
remove
getPublicUrl
createSignedUrl
createSignedUrls
createSignedUploadUrl
uploadToSignedUrl
move
copy
listBuckets
getBucket
createBucket
updateBucket
deleteBucket
emptyBucket
```

## Direct API

For lower-level access, use `useSupabaseApi`:

```ts
const api = useSupabaseApi()

const list = await api.all('playlists', {
	select: '*',
	limit: 10,
})

const one = await api.getById('playlists', 'id')
const created = await api.create('playlists', { title: 'New' })
await api.update('playlists', created.data.id, { title: 'Updated' })
await api.remove('playlists', created.data.id)
```

This direct API is separate from generated model handles and still uses its own method names.

## Verification Checklist

After integration, run:

```bash
yarn nsdb:all
yarn nuxt typecheck
yarn build
```

Then verify:

- `types/database.types.ts` exists
- `nsdb/models/index.ts` exists
- `nsdb/composables/useNsdbModels.ts` exists
- Nuxt auto-imports generated model composables
- routes using `NsdbList` are excluded from Supabase auth redirects if they should be public
- RLS policies allow the expected Supabase operations

## Common Issues

If `No operator matches the given name and argument types` appears, a search probably targets a non-text column. Restrict `searchColumns` to text fields.

If a page does not display and uses `@nuxtjs/supabase`, check `supabase.redirectOptions.exclude`.

If a generated model does not use a store, regenerate stores then models:

```bash
yarn nsdb:stores
yarn nsdb:models
```

If Pinia reports no active Pinia, ensure `@pinia/nuxt` is installed and listed in `modules`.

If generated files import `useNsdbModels.ts`, make sure `nsdb/composables/useNsdbModels.ts` exists.

## User Profiles, RLS, and Ownership

Prefer a Supabase-first security model:

- Auth lives in Supabase Auth and `@nuxtjs/supabase`.
- Ownership checks live in RLS policies.
- Automatic `profile_id` or `user_id` assignment lives in SQL defaults or triggers.
- NSDB should only simplify Nuxt-side data access.

Recommended schema shape:

```txt
auth.users.id
  -> profiles.user_id
  -> playlists.profile_id
  -> projects.profile_id
```

Example read policy:

```sql
create policy "Users can read own playlists"
on playlists
for select
using (
	profile_id in (
		select id from profiles
		where user_id = auth.uid()
	)
);
```

Example trigger to avoid sending `profile_id` from the client:

```sql
create or replace function set_profile_id()
returns trigger as $$
begin
	if new.profile_id is null then
		select id into new.profile_id
		from profiles
		where user_id = auth.uid()
		limit 1;
	end if;

	return new;
end;
$$ language plpgsql security definer;

create trigger set_playlist_profile_id
before insert on playlists
for each row
execute function set_profile_id();
```

Then Nuxt can create without trusting client-provided ownership fields:

```ts
await playlists.create({
	title: 'My playlist',
})
```

Use `useNsdbProfile()` only for UI convenience:

```ts
const { profile, profileId, refresh, ensureProfile } = useNsdbProfile({
	table: 'profiles',
	userColumn: 'user_id',
	idColumn: 'id',
	createIfMissing: true,
	defaults: user => ({
		user_id: user.id,
		email: user.email,
	}),
})
```

Generated stores reset automatically when the Supabase user changes. This prevents persisted data from one account from leaking into another account's local cache. For public/reference stores, set `scopeToUser: false` in the generated store.
