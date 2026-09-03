# NSDB dans Nuxt 4

Cette application consomme NSDB comme une application Nuxt 4 normale. Elle sert
de documentation exécutable pour les modèles générés, les stores optionnels et
les composants CRUD.

## Installation

```bash
npm install @lucashw68/nsdb @nuxtjs/supabase @pinia/nuxt pinia
npm install --save-dev supabase
npx nsdb init
npx nsdb generate:all
```

```ts
export default defineNuxtConfig({
	modules: ['@lucashw68/nsdb', '@pinia/nuxt', '@nuxtjs/supabase'],
})
```

Une génération exacte nécessite une connexion PostgreSQL directe. Sans cette
connexion, NSDB utilise les types produits par la CLI Supabase et affiche les
limites du fallback.

## API recommandée

```ts
const playlists = usePlaylists({ store: true })

await playlists.fetch()
await playlists.create({ title: 'Nouvelle playlist' })
await playlists.update(id, { title: 'Renommée' })
await playlists.remove(id)
```

```vue
<NsdbList model="playlists" store />
<NsdbForm model="playlists" store />
```

Supabase Auth et les policies RLS restent responsables des autorisations. Les
options d’exposition NSDB contrôlent uniquement les artefacts et l’UI client.

La référence complète est `docs/public-api.md` à la racine du repository.
