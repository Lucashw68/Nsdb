# 📦 NSDB — Nuxt Supabase Database Layer

Un layer Nuxt 3 pour gérer automatiquement modèles, stores, et accès Supabase.

---

## 🚀 Installation

1. **Ajoute le layer dans ton projet Nuxt :**

```bash
# Si tu utilises un chemin local :
pnpm add -D ../nsdb
# ou
yarn add -D ../nsdb
# ou
npm install --save-dev ../nsdb
```


2. **Ajoute le layer dans `nuxt.config.ts` :**

```ts
export default defineNuxtConfig({
	layers: ['../nsdb'],
})
```

3. **Configure les variables d'environnement dans `.env` :**

```SUPABASE_PROJECT_ID=ton_project_id```

---

## 🔧 Génération des types et modèles

```bash
{
  "scripts": {
    "generate:types": "tsx scripts/generate-types.ts",
    "generate:models": "tsx scripts/generate-models.ts",
    "generate:stores": "tsx scripts/generate-stores.ts",
    "generate:all": "npm run generate:types && npm run generate:models && npm run generate:stores"
  }
}
```

## 🛠️ Utilisation dans l'app

### Accès générique à un modèle :

```ts
const { items, create, update, remove } = useSupabaseModel('playlists')
```

### Ou via tous les modèles en une fois :

```ts
const { songs, playlists } = useSupabaseModels()
songs.create(...)
```

## 📁 Structure générée

```bash
types/
  ├── database.types.ts  ← généré par Supabase CLI
  └── models.ts          ← généré par le layer (modelMap + ModelTypes)
stores/entities/
  └── useXStore.ts       ← généré automatiquement par modèle
```

## 📚 Exemples

Un projet d’exemple est disponible dans :

```bash
examples/test-app
```

## Makefile

### Commit, tag, push and publish (with default commit message)
```bash
make deploy
```

### Custom commit message
```bash
make deploy MESSAGE="add example app"
```

### Bump minor version instead of patch
```bash
make deploy VERSION_TYPE=minor MESSAGE="new features"
```

## 📄 Licence

MIT License