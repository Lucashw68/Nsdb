# Get Started — Installer NSDB dans un projet Nuxt 4

Ce guide décrit l'installation complète de NSDB dans une app Nuxt 4 existante.

NSDB est un module Nuxt qui facilite l'utilisation de Supabase dans Nuxt avec :

- génération des types Supabase
- génération de schemas NSDB par table
- génération de modèles/composables typés
- composants `NsdbList` et `NsdbForm`
- stores Pinia optionnels
- helpers pour Supabase Database et Storage

---

## 1. Prérequis

Vous devez avoir :

- une app Nuxt 4
- un projet Supabase
- des tables Supabase existantes
- les RLS Supabase prévues pour sécuriser les accès
- Node.js et un package manager (`npm`, `pnpm` ou `yarn`)

Si vous utilisez Supabase Auth, le module recommandé côté Nuxt est `@nuxtjs/supabase`.

---

## 2. Installer les dépendances

Avec npm :

```bash
npm install @lucashw68/nsdb @nuxtjs/supabase @pinia/nuxt pinia
npm install -D supabase
```

Avec pnpm :

```bash
pnpm add @lucashw68/nsdb @nuxtjs/supabase @pinia/nuxt pinia
pnpm add -D supabase
```

Avec yarn :

```bash
yarn add @lucashw68/nsdb @nuxtjs/supabase @pinia/nuxt pinia
yarn add -D supabase
```

Pour activer la persistance locale des stores :

```bash
npm install pinia-plugin-persistedstate
```

---

## 3. Configurer Nuxt

Ajoutez NSDB, Pinia et Supabase dans `nuxt.config.ts`.

```ts
export default defineNuxtConfig({
	modules: [
		'@lucashw68/nsdb',
		'@pinia/nuxt',
		'@nuxtjs/supabase',
		'pinia-plugin-persistedstate/nuxt',
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
			exclude: ['/', '/public'],
		},
	},
})
```

Si vous n'utilisez pas les stores persistés, retirez simplement :

```ts
'pinia-plugin-persistedstate/nuxt'
```

---

## 4. Ajouter les variables d'environnement

Créez ou complétez `.env`.

```bash
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_PROJECT_ID=your-project-id
# Self-hosted uniquement, pour générer les types sans project id :
SUPABASE_DB_URL=postgresql://postgres:password@localhost:5432/postgres
```

`SUPABASE_URL` et `SUPABASE_KEY` sont utilisés par `@nuxtjs/supabase`.

`SUPABASE_PROJECT_ID` est utilisé par NSDB pour générer les types Supabase avec le CLI Supabase.

Si votre projet Supabase est déjà lié localement avec le Supabase CLI, vous pouvez utiliser `--linked` et ne pas renseigner `SUPABASE_PROJECT_ID`.

Si vous utilisez Supabase en self-hosted, vous pouvez utiliser `SUPABASE_DB_URL` à la place de `SUPABASE_PROJECT_ID`.

---

## 5. Initialiser NSDB

Depuis la racine de votre projet Nuxt :

```bash
npx @lucashw68/nsdb init
```

Avec yarn :

```bash
yarn nsdb init
```

Options disponibles :

```bash
nsdb init --linked
nsdb init --schema private
nsdb init --project-id your-project-id
nsdb init --self-hosted
nsdb init --db-url postgresql://postgres:password@localhost:5432/postgres
nsdb init --force
```

Exemples :

```bash
npx @lucashw68/nsdb init --schema public --project-id abcdefghijkl
```

```bash
npx @lucashw68/nsdb init --linked --schema public
```

Instance Supabase self-hosted :

```bash
npx @lucashw68/nsdb init --self-hosted --schema public
```

ou avec une URL Postgres explicite :

```bash
npx @lucashw68/nsdb init --db-url postgresql://postgres:password@localhost:5432/postgres
```

`nsdb init` crée :

- `nsdb.config.ts`
- `.env.example` si absent
- les dossiers `types`, `nsdb/schemas`, `nsdb/models`, `nsdb/composables`, `stores`
- les scripts `nsdb:*` dans `package.json`

Les fichiers existants ne sont pas écrasés sauf si vous utilisez `--force`.

---

## 6. Vérifier `nsdb.config.ts`

Exemple standard :

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

Si le projet Supabase est lié localement :

```ts
import type { NsdbConfig } from '@lucashw68/nsdb/types/config'

export default {
	supabase: {
		schema: 'public',
		linked: true,
	},
} satisfies NsdbConfig
```

Pour une instance Supabase self-hosted sans project id :

```ts
import type { NsdbConfig } from '@lucashw68/nsdb/types/config'

export default {
	supabase: {
		schema: 'public',
		dbUrl: process.env.SUPABASE_DB_URL,
		linked: false,
	},
} satisfies NsdbConfig
```

---

## 7. Générer les fichiers NSDB

Lancez :

```bash
npm run nsdb:all
```

Avec yarn :

```bash
yarn nsdb:all
```

Cette commande génère :

| Étape | Sortie | Rôle |
|-------|--------|------|
| Types | `types/database.types.ts` | Types Supabase |
| Enums | `nsdb/enums.ts` | Enums du schema |
| Schemas | `nsdb/schemas/*` | Schemas UI par table |
| Models | `nsdb/models/*` | Modèles typés par table |
| Stores | `stores/*` | Stores Pinia optionnels |
| Composable | `nsdb/composables/useNsdbModels.ts` | Accès générique aux modèles |

Vous pouvez aussi lancer une étape précise :

```bash
npm run nsdb:types
npm run nsdb:schemas
npm run nsdb:models
npm run nsdb:stores
```

Pour regénérer les stores en écrasant les stores existants :

```bash
npx @lucashw68/nsdb generate:stores --force
```

---

## 8. Configurer les RLS Supabase

NSDB ne remplace pas les RLS. Les droits doivent rester côté Supabase.

Exemple avec :

- `profiles.id = auth.users.id`
- `playlists.profile_id -> profiles.id`

```sql
alter table profiles enable row level security;
alter table playlists enable row level security;

create policy "Users can read own profile"
on profiles
for select
to authenticated
using (id = auth.uid());

create policy "Users can update own profile"
on profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

create policy "Users can read own playlists"
on playlists
for select
to authenticated
using (profile_id = auth.uid());

create policy "Users can create own playlists"
on playlists
for insert
to authenticated
with check (profile_id = auth.uid());

create policy "Users can update own playlists"
on playlists
for update
to authenticated
using (profile_id = auth.uid())
with check (profile_id = auth.uid());

create policy "Users can delete own playlists"
on playlists
for delete
to authenticated
using (profile_id = auth.uid());
```

Si votre schema utilise `profiles.user_id` au lieu de `profiles.id = auth.uid()`, adaptez les conditions avec une sous-requête vers `profiles`.

---

## 9. Ajouter un trigger `profile_id`

Si vos tables métier ont une colonne `profile_id`, vous pouvez éviter de l'envoyer depuis le client.

Fonction générique :

```sql
create or replace function public.set_profile_id()
returns trigger as $$
begin
	if new.profile_id is null then
		new.profile_id := (select auth.uid());
	end if;

	return new;
end;
$$
language plpgsql
security definer
set search_path = '';
```

Trigger pour `playlists` :

```sql
drop trigger if exists set_profile_id on public.playlists;

create trigger set_profile_id
before insert on public.playlists
for each row
execute function public.set_profile_id();
```

Vous pouvez réutiliser la même fonction sur chaque table qui possède `profile_id`.

---

## 10. Utiliser un modèle généré

Après génération, NSDB expose des modèles par table.

Exemple avec `playlists` :

```vue
<script setup lang="ts">
const playlists = usePlaylistsModel()

await playlists.fetch({
	orderBy: 'created_at',
	orderDirection: 'desc',
	limit: 20,
})

const created = await playlists.create({
	title: 'Ma playlist',
})

if (created?.id) {
	await playlists.update(created.id, {
		title: 'Titre modifie',
	})
}
</script>
```

API principale d'un modèle :

```ts
items
totalCount
fetch
find
getById
create
update
remove
sync
```

---

## 11. Utiliser `NsdbList`

```vue
<template>
	<NsdbList
		model="playlists"
		:columns="columns"
		:page-size="10"
		searchable
		:search-columns="['title', 'provider']"
		:query="{
			orderBy: 'created_at',
			orderDirection: 'desc'
		}"
	/>
</template>

<script setup lang="ts">
const columns = [
	{ key: 'title', label: 'Titre' },
	{ key: 'provider', label: 'Provider' },
	{ key: 'created_at', label: 'Créée le' },
]
</script>
```

Avec relation Supabase :

```vue
<NsdbList
	model="playlists"
	:columns="[
		{ key: 'title', label: 'Titre' },
		{ key: 'profile.username', label: 'Auteur' }
	]"
	:query="{
		select: '*, profile:profiles!playlists_profile_id_fkey(*)'
	}"
/>
```

---

## 12. Utiliser `NsdbForm`

```vue
<template>
	<NsdbForm
		model="playlists"
		:hide-fields="['id', 'profile_id', 'created_at', 'updated_at']"
		@created="onCreated"
		@error="onError"
	/>
</template>

<script setup lang="ts">
function onCreated(row: unknown) {
	console.log('created', row)
}

function onError(error: unknown) {
	console.error(error)
}
</script>
```

Mode édition :

```vue
<NsdbForm
	model="playlists"
	:id="playlistId"
	:hide-fields="['id', 'profile_id', 'created_at', 'updated_at']"
/>
```

---

## 13. Utiliser les stores optionnels

Les stores sont utiles si vous voulez :

- conserver des données localement
- limiter certains appels Supabase
- centraliser l'état d'une table
- utiliser `pinia-plugin-persistedstate`

```vue
<script setup lang="ts">
const playlistsStore = usePlaylistsStore()

await playlistsStore.fetchFromSupabase({
	limit: 20,
	staleTimeMs: 60_000,
})

const playlist = playlistsStore.getById('playlist-id')

await playlistsStore.create({
	title: 'Depuis le store',
})
</script>
```

Les stores générés sont vidés automatiquement quand l'utilisateur Supabase change.

Pour un store public non lié à l'utilisateur :

```ts
export const usePublicCategoriesStore = createDbStore<Category>('categories', {
	key: 'id',
	orderBy: 'name',
	defaultSort: 'asc',
	scopeToUser: false,
})
```

---

## 14. Utiliser Supabase Storage

```vue
<script setup lang="ts">
const storage = useSupabaseApiStorage()

await storage.upload('avatars', 'users/me.png', file, {
	upsert: true,
	contentType: file.type,
})

const publicUrl = storage.getPublicUrl('avatars', 'users/me.png')
const signedUrl = await storage.createSignedUrl('avatars', 'users/me.png', 300)

await storage.remove('avatars', 'users/me.png')
</script>
```

---

## 15. Vérifier l'installation

Lancez le serveur Nuxt :

```bash
npm run dev
```

Puis vérifiez :

- les fichiers `types/database.types.ts` et `nsdb/models/*` existent
- les composables générés sont auto-importés
- `NsdbList` affiche bien des données
- les créations passent sans envoyer `profile_id` si le trigger est actif
- les RLS bloquent les accès non autorisés

Pour vérifier le typage :

```bash
npx nuxi typecheck
```

---

## 16. Checklist rapide

- [ ] Installer `@lucashw68/nsdb`
- [ ] Installer `@nuxtjs/supabase`
- [ ] Installer Pinia
- [ ] Ajouter les modules dans `nuxt.config.ts`
- [ ] Ajouter `.env`
- [ ] Lancer `npx @lucashw68/nsdb init`
- [ ] Vérifier `nsdb.config.ts`
- [ ] Lancer `npm run nsdb:all`
- [ ] Ajouter RLS Supabase
- [ ] Ajouter triggers `profile_id` si nécessaire
- [ ] Tester `NsdbList`
- [ ] Tester `NsdbForm`
- [ ] Tester création/update/delete avec un utilisateur connecté
