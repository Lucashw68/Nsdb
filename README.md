# 🧬 NSDB — Nuxt Supabase Data Bridge
*(a.k.a. Nuxt Supabase Database Layer)*

[![npm version](https://img.shields.io/npm/v/@lucashw68/nsdb.svg?color=42b883)](https://www.npmjs.com/package/@lucashw68/nsdb)
![license](https://img.shields.io/npm/l/@lucashw68/nsdb.svg?color=42b883)
![typescript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript)
![nuxt](https://img.shields.io/badge/Nuxt-Module-00DC82?logo=nuxt.js)
![supabase](https://img.shields.io/badge/Supabase-Ready-3ECF8E?logo=supabase)
![bundle size](https://img.shields.io/bundlephobia/minzip/@lucashw68/nsdb?label=minzip&color=42b883)

> **NSDB** est un **module Nuxt** qui facilite le couplage entre une app Nuxt et **Supabase**.
> Il genere des types, schemas, modeles, composables et stores Pinia optionnels pour obtenir une couche data simple, typed-friendly et au maximum plug and play.

NSDB fournit :

- des types Supabase generes depuis votre schema
- des schemas NSDB exploitables par l'UI
- des modeles typés par table
- des composables auto-importes dans Nuxt
- des stores Pinia optionnels avec cache local
- des composants prêts a utiliser (`NsdbList`, `NsdbForm`)
- une API unifiee pour Supabase Database et Supabase Storage
- une integration compatible avec `@nuxtjs/supabase`, auth Supabase et RLS

Guide d'installation complet pour Nuxt 4 : [GET_STARTED.md](./GET_STARTED.md)

---

## ⚙️ Installation

### 1. Installer le package

```bash
npm install @lucashw68/nsdb @nuxtjs/supabase @pinia/nuxt pinia
# ou
pnpm add @lucashw68/nsdb @nuxtjs/supabase @pinia/nuxt pinia
# ou
yarn add @lucashw68/nsdb @nuxtjs/supabase @pinia/nuxt pinia
```

### 2. Installer les outils de generation

```bash
npm install -D supabase
# ou
pnpm add -D supabase
# ou
yarn add -D supabase
```

### 3. Persistance locale des stores

Optionnel, uniquement si vous voulez conserver certains stores hors ligne :

```bash
npm install pinia-plugin-persistedstate
# ou
pnpm add pinia-plugin-persistedstate
# ou
yarn add pinia-plugin-persistedstate
```

---

## 🧾 Prérequis

- Un projet Supabase configure
- `@nuxtjs/supabase` configure dans Nuxt
- Supabase CLI disponible dans le projet
- Pinia si vous utilisez les stores générés
- Des RLS Supabase correctement définies pour sécuriser les accès

---

## 🧩 Configuration Nuxt

```ts
// nuxt.config.ts
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
			exclude: ['/', '/public-page'],
		},
	},
})
```

Variables d'environnement :

```bash
# .env
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_KEY=your-anon-key
SUPABASE_PROJECT_ID=your-project-id
# Self-hosted uniquement, pour générer les types sans project id :
SUPABASE_DB_URL=postgresql://postgres:password@localhost:5432/postgres
```

`SUPABASE_URL` et `SUPABASE_KEY` sont lus par `@nuxtjs/supabase`.
`SUPABASE_PROJECT_ID` est utilisé par NSDB pour générer les types via le CLI Supabase.
`SUPABASE_DB_URL` peut remplacer `SUPABASE_PROJECT_ID` pour une instance Supabase self-hosted.

---

## 🧬 `nsdb.config.ts`

Vous pouvez initialiser un projet avec :

```bash
npx @lucashw68/nsdb init
# ou
yarn nsdb init
```

Options utiles :

```bash
nsdb init --linked
nsdb init --schema private
nsdb init --project-id your-project-id
nsdb init --self-hosted
nsdb init --db-url postgresql://postgres:password@localhost:5432/postgres
nsdb init --force
```

`nsdb init` crée :

- `nsdb.config.ts`
- `.env.example` si absent
- les dossiers `types`, `nsdb/schemas`, `nsdb/models`, `nsdb/composables`, `stores`
- les scripts `nsdb:*` dans `package.json` sans écraser les scripts existants

Ajoutez un fichier `nsdb.config.ts` à la racine du projet Nuxt :

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

Si votre projet Supabase est déjà lié localement :

```ts
import type { NsdbConfig } from '@lucashw68/nsdb/types/config'

export default {
	supabase: {
		schema: 'public',
		linked: true,
	},
} satisfies NsdbConfig
```

Si vous utilisez une instance Supabase self-hosted sans project id :

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

## 🛠️ Scripts de génération

Ajoutez ceci à votre `package.json` :

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

Puis lancez :

```bash
npm run nsdb:all
# ou
yarn nsdb:all
```

| Étape | Commande | Fichier généré | Description |
|-------|----------|----------------|-------------|
| 1 | `nsdb generate:types` | `types/database.types.ts` | Genere les types depuis Supabase |
| 2 | `nsdb generate:enums` | `nsdb/enums.ts` | Expose les enums du schema |
| 3 | `nsdb generate:schemas` | `nsdb/schemas/*` | Genere les schemas UI par table |
| 4 | `nsdb generate:models` | `nsdb/models/*` | Genere les modeles typés |
| 5 | `nsdb generate:stores` | `stores/*` | Genere les stores Pinia optionnels |
| 6 | `nsdb generate:composables` | `nsdb/composables/useNsdbModels.ts` | Genere l'accès générique aux modeles |
| 7 | `nsdb generate:all` | — | Enchaîne toute la generation |

> Les stores existants ne sont pas écrasés par défaut.
> Utilisez `nsdb generate:stores --force` pour regénérer les stores.

---

## 📁 Structure générée

```txt
types/
  database.types.ts

nsdb/
  enums.ts
  schemas/
    playlists.ts
  models/
    playlists.ts
    index.ts
  composables/
    useNsdbModels.ts

stores/
  usePlaylistsStore.ts
```

---

## 🧱 Architecture interne

```txt
runtime/
├── components/
│   ├── NsdbForm.vue
│   └── NsdbList.vue
├── composables/
│   ├── useNsdbProfile.ts
│   ├── useNsdbSchemas.ts
│   ├── useSupabaseApi.ts
│   ├── useSupabaseApiStorage.ts
│   └── useSupabaseModels.ts
└── stores/
    ├── createDbStore.ts
    └── createSingletonDbStore.ts

scripts/
├── generate-types.js
├── generate-enums.js
├── generate-schemas.js
├── generate-models.js
├── generate-composables.js
└── generate-stores.js
```

---

## 🧩 Utilisation

### Accès typé via modèle généré

```vue
<script setup lang="ts">
const playlists = usePlaylistsModel()

await playlists.fetch({
	select: '*, profile:profiles!playlists_profile_id_fkey(*)',
	orderBy: 'created_at',
	orderDirection: 'desc',
	limit: 20,
	offset: 0,
})

const created = await playlists.create({
	title: 'Nouvelle playlist',
})

if (created?.id) {
	await playlists.update(created.id, {
		title: 'Playlist modifiee',
	})
}
</script>
```

### Accès générique

```ts
const playlists = useNsdbModel('playlists')

await playlists.fetch()
await playlists.create({ title: 'My Playlist' })
```

### API d'un modèle

```ts
{
	items,        // Ref<T[]>
	totalCount,   // Ref<number | null>
	schema,       // schema NSDB généré
	fields,       // champs exploitables par l'UI
	editableKeys, // champs éditables
	new,          // fabrique d'objet vide
	fetch,        // liste serveur
	find,         // liste filtrée
	getById,      // lecture par id
	create,       // insertion
	update,       // modification
	remove,       // suppression
	sync,         // realtime/cache selon store
}
```

---

## 🔎 Requêtes serveur

`fetch` et `find` acceptent recherche, tri, pagination et filtres côté serveur :

```ts
await playlists.fetch({
	select: '*',
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

Opérateurs disponibles :

```ts
'eq' | 'neq' | 'gt' | 'gte' | 'lt' | 'lte' | 'ilike' | 'in'
```

Pour la recherche texte, utilisez uniquement des colonnes texte dans `searchColumns`.
Supabase/PostgREST ne peut pas appliquer `ilike` sur des colonnes numériques ou uuid.

Tri relationnel :

```ts
await playlists.fetch({
	select: '*, profile:profiles!playlists_profile_id_fkey(*)',
	orderBy: 'username',
	orderForeignTable: 'profile',
	orderDirection: 'asc',
})
```

---

## 📋 `NsdbList`

`NsdbList` affiche une table ou un rendu libre, avec recherche, tri, pagination et filtres côté serveur.

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
	{ key: 'title', label: 'Titre' },
	{ key: 'provider', label: 'Provider' },
	{ key: 'profile.username', label: 'Auteur' },
]
</script>
```

### Slot cellule

```vue
<NsdbList model="playlists" :columns="columns" :page-size="10">
	<template #cell="{ column, value, row }">
		<strong v-if="column.key === 'title'">{{ row.title }}</strong>
		<span v-else>{{ value }}</span>
	</template>
</NsdbList>
```

### Rendu libre complet

```vue
<NsdbList model="playlists" :page-size="6" searchable>
	<template #default="{ rows, loading, currentPage, totalPages, nextPage, prevPage }">
		<p v-if="loading">Chargement...</p>

		<div class="grid gap-4 md:grid-cols-3">
			<article v-for="row in rows" :key="row.id">
				<h2>{{ row.title }}</h2>
			</article>
		</div>

		<button @click="prevPage">Precedent</button>
		<span>{{ currentPage }} / {{ totalPages }}</span>
		<button @click="nextPage">Suivant</button>
	</template>
</NsdbList>
```

---

## 🧾 `NsdbForm`

`NsdbForm` genere un formulaire à partir du schema NSDB généré.

```vue
<template>
	<NsdbForm
		model="playlists"
		:hide-fields="['id', 'created_at']"
		@created="onCreated"
		@updated="onUpdated"
		@error="onError"
	/>
</template>

<script setup lang="ts">
function onCreated(row: unknown) {
	console.log('created', row)
}

function onUpdated(row: unknown) {
	console.log('updated', row)
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
	:initial-values="{ title: 'Titre par defaut' }"
/>
```

Relations `belongsTo` :

```vue
<NsdbForm
	model="playlists"
	:initial-values="{
		'profile.username': 'lucas'
	}"
/>
```

---

## 🧠 Stores Pinia optionnels

Les stores sont optionnels. Ils sont utiles pour :

- garder des données disponibles localement
- limiter certains appels Supabase grâce au cache
- centraliser l'état d'une table
- utiliser la persistance avec `pinia-plugin-persistedstate`

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

await playlistsStore.update('playlist-id', {
	title: 'Modifie',
})

await playlistsStore.remove('playlist-id')
</script>
```

Pour regénérer un modèle après ajout d'un store :

```bash
npm run nsdb:stores
npm run nsdb:models
```

Les stores générés sont automatiquement vidés quand l'utilisateur Supabase change.
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

## 🔐 Auth, profils et RLS

NSDB utilise `useSupabaseClient()` sous le capot.
Les appels passent donc par la session courante de `@nuxtjs/supabase` et les policies RLS Supabase s'appliquent normalement.

Le modèle recommandé :

- `auth.users` gère l'utilisateur connecté
- `profiles` relie l'utilisateur auth au profil applicatif
- les tables métier référencent `profiles.id` ou `auth.users.id`
- les triggers/defaults remplissent `profile_id` ou `user_id`
- les RLS vérifient que l'utilisateur a le droit d'agir

### Templates RLS pour une table utilisateur

```sql
-- Exemple attendu :
-- profiles.id est égal à auth.users.id
-- playlists.profile_id référence profiles.id

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
using (
	profile_id in (
		select id from profiles
		where id = auth.uid()
	)
);

create policy "Users can create own playlists"
on playlists
for insert
to authenticated
with check (
	profile_id in (
		select id from profiles
		where id = auth.uid()
	)
);

create policy "Users can update own playlists"
on playlists
for update
to authenticated
using (
	profile_id in (
		select id from profiles
		where id = auth.uid()
	)
)
with check (
	profile_id in (
		select id from profiles
		where id = auth.uid()
	)
);

create policy "Users can delete own playlists"
on playlists
for delete
to authenticated
using (
	profile_id in (
		select id from profiles
		where id = auth.uid()
	)
);
```

Variante si une table métier référence directement `auth.users.id` avec une colonne `user_id` :

```sql
alter table playlists enable row level security;

create policy "Users can read own playlists"
on playlists
for select
to authenticated
using (user_id = auth.uid());

create policy "Users can create own playlists"
on playlists
for insert
to authenticated
with check (user_id = auth.uid());

create policy "Users can update own playlists"
on playlists
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

create policy "Users can delete own playlists"
on playlists
for delete
to authenticated
using (user_id = auth.uid());
```

Trigger générique pour éviter d'envoyer `profile_id` depuis le client :

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

-- PLAYLISTS
drop trigger if exists set_profile_id on public.playlists;

create trigger set_profile_id
before insert on public.playlists
for each row
execute function public.set_profile_id();
```

La même fonction peut être réutilisée sur chaque table qui possède une colonne `profile_id`.
Il suffit d'ajouter un trigger par table.

Côté Nuxt :

```ts
const playlists = usePlaylistsModel()

await playlists.create({
	title: 'Ma playlist',
})
```

`useNsdbProfile()` est un helper de confort pour l'UI. Il ne remplace pas les RLS.

```ts
const {
	user,
	profile,
	profileId,
	loading,
	error,
	refresh,
	ensureProfile,
} = useNsdbProfile()
```

Configuration possible :

```ts
const profileState = useNsdbProfile({
	table: 'profiles',
	userColumn: 'id',
	idColumn: 'id',
	createIfMissing: true,
	defaults: user => ({
		id: user.id,
		email: user.email,
	}),
})
```

---

## 🗄️ API directe Supabase

`useSupabaseApi` donne accès à une API plus proche de Supabase, avec réponses normalisées.

```vue
<script setup lang="ts">
const api = useSupabaseApi()

const list = await api.all('playlists', {
	select: '*',
	orderBy: 'created_at',
	orderDirection: 'desc',
	limit: 10,
})

const one = await api.show('playlists', 'playlist-id')

const created = await api.create('playlists', {
	title: 'Nouvelle playlist',
})

if (created.data?.id) {
	await api.update('playlists', created.data.id, {
		title: 'Titre modifie',
	})

	await api.destroy('playlists', created.data.id)
}
</script>
```

---

## 🪣 Supabase Storage

`useSupabaseApiStorage` simplifie les operations courantes sur Supabase Storage.

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
const blob = await storage.download('avatars', 'users/me.png')

await storage.remove('avatars', 'users/me.png')
</script>
```

Méthodes disponibles :

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
joinPath
normalizePath
```

---

## 🧪 Exemple d'intégration

Le dépôt contient une app Nuxt de test dans :

```txt
../Example
```

Elle sert à valider :

- les composants `NsdbList` et `NsdbForm`
- la recherche, le tri, les filtres et la pagination serveur
- l'API directe Supabase
- Supabase Storage
- les stores optionnels
- l'integration auth/profil/RLS

---

## 🧰 Makefile

### Checks

```bash
make check
```

### Déploiement standard

```bash
make deploy
```

### Avec message personnalisé

```bash
make deploy MESSAGE="add example app"
```

### Version mineure

```bash
make deploy VERSION_TYPE=minor MESSAGE="new features"
```

`make deploy` lance :

1. `npm run check`
2. `npm test`
3. `git add --all`
4. `git commit`
5. `npm version`
6. `git push origin main --follow-tags`
7. `npm publish`

---

## 📦 Publication

Avant publication, `prepublishOnly` execute automatiquement :

```bash
npm run check
npm test
```

Publication manuelle :

```bash
npm publish
```

---

## ✨ Roadmap

- [x] Génération automatique des types Supabase
- [x] Génération des enums
- [x] Génération des schemas UI
- [x] Génération des modeles typés
- [x] Génération des composables par table
- [x] Génération de stores Pinia optionnels
- [x] Recherche, tri, pagination et filtres serveur dans `NsdbList`
- [x] Slots pour rendu libre dans `NsdbList`
- [x] API Supabase Storage
- [x] Helper `useNsdbProfile`
- [x] Support `nsdb.config.ts`
- [x] Checks et tests avant publication
- [ ] Tests composant sur `NsdbList` et `NsdbForm`
- [ ] Documentation interactive dans l'app `Example`
- [ ] Strategie offline plus avancee avec file de resynchronisation
- [ ] Typage public plus strict pour les schemas et modeles générés

---

## 🤝 Contribution

1. Clonez le dépôt
2. Travaillez dans `Nsdb`
3. Validez dans `Example`
4. Lancez `npm test` et `yarn typecheck`
5. Proposez une PR

---

## 📄 Licence

MIT License © 2025 [@lucashw68](https://github.com/lucashw68)
