# 🧬 NSDB — Nuxt Supabase Data Bridge  
*(a.k.a. Nuxt Supabase Database Layer)*

[![npm version](https://img.shields.io/npm/v/@lucashw68/nsdb.svg?color=42b883)](https://www.npmjs.com/package/@lucashw68/nsdb)
[![license](https://img.shields.io/npm/l/@lucashw68/nsdb.svg?color=42b883)](./LICENSE)
![typescript](https://img.shields.io/badge/TypeScript-Ready-3178C6?logo=typescript)
![nuxt](https://img.shields.io/badge/Nuxt_3-Layer-00DC82?logo=nuxt.js)
![bundle size](https://img.shields.io/bundlephobia/minzip/@lucashw68/nsdb?label=minzip&color=42b883)

> **NSDB** est un **Layer/Module Nuxt 3** qui connecte automatiquement ta base **Supabase** à des **stores Pinia typés**, avec synchronisation en temps réel, persistance locale, et API unifiée (`useModel`, `useEntitiesStore`).

---

## ⚙️ Installation

### 1. Depuis npm

```bash
npm install @lucashw68/nsdb
# ou
pnpm add @lucashw68/nsdb
# ou
yarn add @lucashw68/nsdb
```

### 2. Ajouter le module dans ton projet Nuxt

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@lucashw68/nsdb'],
  nsdb: {
    withStores: true // optionnel : auto-importer les stores générés
  }
})
```

### 3. Variables d’environnement `.env`

```bash
SUPABASE_PROJECT_ID=ton_project_id
```

---

## 🧾 Prérequis

- Supabase configuré  
- Supabase CLI installé (`npm install -g supabase`)  
- Nuxt 3 + Pinia installés  

---

## 🛠️ Scripts de génération

Ajoute ceci à ton `package.json` :

```json
{
  "scripts": {
    "generate:types": "tsx scripts/generate-types.ts",
    "generate:models": "tsx scripts/generate-models.ts",
    "generate:stores": "tsx scripts/generate-stores.ts",
    "generate:all": "npm run generate:types && npm run generate:models && npm run generate:stores"
  }
}
```

| Étape | Commande | Fichier généré | Description |
|-------|-----------|----------------|--------------|
| 1️⃣ | `npm run generate:types` | `types/database.types.ts` | Génère les types depuis Supabase |
| 2️⃣ | `npm run generate:models` | `types/models.ts` | Crée `ModelTypes` + `modelMap` |
| 3️⃣ | `npm run generate:stores` | `stores/entities/useXStore.ts` | Génère les stores Pinia typés |
| 4️⃣ | `npm run generate:all` | — | Enchaîne les 3 étapes |

> ⚙️ Les stores ne sont jamais écrasés.  
> Chaque projet garde le contrôle sur ses modèles et extensions.

---

## 🧩 Utilisation

### Accès générique via `useModel`
```ts
const playlists = useModel('playlists')

await playlists.fetch()
playlists.create({ title: 'My Playlist' })
```

> 🔁 Typage automatique basé sur `ModelTypes`.

---

### Accès global à tous les stores via `useEntitiesStore`
```ts
const { playlists, songs, samples } = useEntitiesStore()

await playlists.fetch()
samples.items.value.forEach(sample => console.log(sample))
```

---

### API des stores typés
```ts
{
  items,       // données locales (ref)
  getById,     // recherche par id
  create,      // insertion
  update,      // modification
  remove,      // suppression
  fetch,       // récupération depuis Supabase
  sync         // synchronisation offline/online
}
```

---

## 📁 Structure générée

```
types/
  ├── database.types.ts   ← généré via Supabase CLI
  └── models.ts           ← généré par NSDB (ModelTypes + modelMap)
stores/entities/
  ├── usePlaylistStore.ts ← généré automatiquement
  └── useSongStore.ts
```

---

## 🧱 Architecture interne

```
runtime/
├── composables/
│   ├── useModel.ts
│   ├── useEntitiesStore.ts
│   └── useSupabaseModels.ts
├── stores/
│   ├── createDbStore.ts
│   └── createSingletonDbStore.ts
scripts/
├── generate-types.ts
├── generate-models.ts
└── generate-stores.ts
```

---

## 🧪 Exemple d’intégration

Un projet de démonstration complet est disponible dans :

```
examples/test-app/
```

---

## 📦 Publication

Si tu veux publier le module sur npm :

```bash
npm publish --access public
```

Et dans ton `package.json`, expose les types :

```json
"types": "./types/index.d.ts"
```

---

## ✨ Roadmap

- [x] Génération automatique des types Supabase  
- [x] Création de `ModelTypes` + `modelMap`  
- [x] Génération automatique de stores typés  
- [x] Accès via `useModel` et `useEntitiesStore`  
- [ ] Support des stores singletons (`createSingletonDbStore`)  
- [ ] Hooks (`onCreate`, `onUpdate`, `onDelete`)  
- [ ] Gestion offline + resynchronisation automatique  
- [ ] Publication NPM automatisée  

---

## 🧰 Makefile

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

---

## 🤝 Contribution

1. Clone le dépôt  
2. Crée un projet de test dans `examples/`  
3. Propose une PR 💚  

---

## 📄 Licence

MIT License © 2025 [@lucashw68](https://github.com/lucashw68)