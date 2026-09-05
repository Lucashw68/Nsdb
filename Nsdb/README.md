# NSDB — Nuxt Supabase Data Bridge

NSDB transforme les types d'une base Supabase en modèles Nuxt typés, stores Pinia optionnels et composants CRUD génériques. Supabase reste la source de vérité pour les données, Auth et RLS.

## Quick start

Prérequis validés pour la RC : Node 22.14+, Nuxt 4.2.1+, Vue 3.5.24+, `@nuxtjs/supabase` 1.6.1 ou 2.x, `@pinia/nuxt` 0.11.2+, Pinia 3.0.3+, un projet Supabase et ses policies RLS. Le CLI Supabase est requis pour générer les types ; une URL PostgreSQL directe est recommandée pour les métadonnées exactes.

```bash
npm install @lucashw68/nsdb @nuxtjs/supabase @pinia/nuxt pinia
npm install --save-dev supabase
npx nsdb init
npx nsdb generate:all
```

```ts
// nuxt.config.ts
export default defineNuxtConfig({
	modules: ['@lucashw68/nsdb', '@pinia/nuxt', '@nuxtjs/supabase'],
})
```

```ts
const playlists = usePlaylists()

await playlists.fetch()
const playlist = await playlists.create({ title: 'Nouvelle playlist' })

await playlists.update(playlist, { title: 'Renommée' })
await playlists.remove(playlist)
```

```vue
<NsdbList model="playlists" />
<NsdbForm model="playlists" />
```

Le guide d'installation complet est dans [GET_STARTED.md](./GET_STARTED.md).

## Modèles générés

Le modèle est l'API recommandée. Les opérations asynchrones rejettent leur Promise en cas d'erreur et `error` expose également la dernière erreur réactive.

```ts
const playlists = usePlaylists({ store: true })

await playlists.fetch()
await playlists.refresh()
playlists.invalidate()

await playlists.create({ title: 'Rock' })
await playlists.update(id, { title: 'Jazz' })
await playlists.remove(id)

playlists.subscribe()
await playlists.unsubscribe()
```

`update()` et `remove()` acceptent soit la valeur de clé primaire, soit une ligne du même modèle. Lorsque la ligne est déjà disponible, NSDB en extrait la clé primaire générée sans envoyer le reste de la ligne dans la mutation.

`{ store: true }` active l'état partagé, le TTL et éventuellement la persistance. Sans store, chaque handle possède sa collection et contacte Supabase à chaque `fetch()`.

## Requêtes

`fetch(options)` est l'unique syntaxe canonique pour les listes filtrées :

```ts
await playlists.fetch({
	where: {
		active: true,
		created_at: { op: 'gte', value: '2026-01-01' },
	},
	search: 'rock',
	searchColumns: ['title', 'provider'],
	orderBy: 'created_at',
	orderDirection: 'desc',
	limit: 20,
	offset: 0,
})
```

Relations courantes :

```ts
const posts = await usePosts().fetch({ include: ['author', 'tags'] })
```

`select` et `orderForeignTable` restent disponibles comme échappatoires PostgREST avancées.

## Composants

```vue
<NsdbList model="playlists" searchable :search-columns="['title']" :page-size="20">
	<template #cell="{ column, row, value }">
		<strong v-if="column.key === 'title'">{{ row.title }}</strong>
		<span v-else>{{ value }}</span>
	</template>
</NsdbList>
```

```vue
<NsdbForm model="playlists" @saved="onSaved">
	<template #field-cover_url="{ value, update }">
		<MyUploader :model-value="value" @update:model-value="update" />
	</template>
</NsdbForm>
```

Les slots permettent de remplacer le rendu sans introduire un framework UI.

## API bas niveau

Pour les cas qui dépassent les modèles générés :

```ts
const api = useSupabaseApi()
const result = await api.all('playlists', { where: { active: true }, limit: 20 })
const row = await api.getById('playlists', id)
await api.remove('playlists', id)
```

Cette couche renvoie des objets discriminés `{ success, data, error, count }` au lieu de rejeter les erreurs Supabase.

Storage conserve son vocabulaire métier :

```ts
const storage = useSupabaseApiStorage()
await storage.upload('avatars', 'users/me.png', file)
const signed = await storage.createSignedUrl('avatars', 'users/me.png', 300)
await storage.remove('avatars', 'users/me.png')
```

## Configuration et sécurité

La configuration minimale générée par `nsdb init` suffit pour un projet standard. Les options avancées couvrent les chemins, la génération distante, les tables exposées et les politiques de colonnes.

```ts
import type { NsdbConfig } from '@lucashw68/nsdb/types'

export default {
	supabase: { schema: 'public', linked: true },
	tables: {
		include: ['playlists'],
		columns: { playlists: { internal_note: { serverOnly: true } } },
	},
} satisfies NsdbConfig
```

Les règles `serverOnly`, `hidden` et `editable` réduisent la surface client ; elles ne remplacent jamais les policies RLS.

## Documentation

- [Documentation NSDB](https://lucashw68.github.io/Nsdb/)
- [API publique canonique](https://lucashw68.github.io/Nsdb/docs/reference/public-api)
- [Migration vers l'API stable](https://lucashw68.github.io/Nsdb/docs/migration/migrating-to-1)
- [Contrat cache et Realtime](https://lucashw68.github.io/Nsdb/docs/core/cache-and-freshness)
- [Sécurité et RLS](https://lucashw68.github.io/Nsdb/docs/supabase/authentication)

NSDB `1.0.0-rc.1` est une Release Candidate publiée sous le dist-tag npm `next`. Consultez le guide de migration avant de l'adopter.
