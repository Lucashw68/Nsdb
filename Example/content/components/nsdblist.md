# NsdbList - Documentation

`NsdbList` affiche un modèle Supabase généré par NSDB avec une API pensée pour être plug and play dans Nuxt.

Le composant gère côté serveur:

- recherche texte avec `search` / `searchColumns`
- tri avec `sortBy` / `sortDirection`
- pagination avec `pageSize`, `limit` et `offset`
- filtres avec `filters` ou `query.where`
- rendu libre via slots

---

# 1. Basic Usage

```vue
<NsdbList model="profiles" />
```

Sans configuration, le composant charge le modèle, déduit les colonnes depuis la première ligne et affiche une table par défaut.

---

# 2. Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `model` | `string` | required | Nom du modèle NSDB / table Supabase |
| `columns` | `Column[]` | auto | Colonnes affichées |
| `pageSize` | `number` | `query.limit` ou `100` | Taille de page côté serveur |
| `query` | `ListOptions` | `{}` | Requête Supabase NSDB complète |
| `filters` | `WhereClause` | none | Filtres serveur fusionnés avec `query.where` |
| `sortBy` | `string` | `query.orderBy` | Colonne de tri initiale |
| `sortDirection` | `'asc' \| 'desc'` | `asc` | Direction du tri initial |
| `searchable` | `boolean` | `false` | Affiche le champ de recherche par défaut |
| `search` | `string` | none | Recherche contrôlée depuis le parent |
| `searchColumns` | `string[]` | colonnes visibles | Colonnes utilisées pour le `ilike` serveur |
| `variant` | `'table' \| 'cards'` | `table` | Rendu par défaut |
| `unstyled` | `boolean` | `false` | Retire les classes par défaut |
| `classes` | `Partial<NsdbTableClasses>` | none | Remplace les classes par défaut |

```ts
type Column = {
	key: string
	label: string
	format?: (value: any, row: any) => string
}
```

---

# 3. Server Query

`NsdbList` construit une requête unique envoyée au modèle:

```ts
{
	select,
	where,
	orderBy,
	orderDirection,
	orderForeignTable,
	limit,
	offset,
	search,
	searchColumns,
}
```

Exemple:

```vue
<NsdbList
	model="playlists"
	:page-size="10"
	searchable
	:search-columns="['title']"
	sort-by="created_at"
	sort-direction="desc"
/>
```

Avec filtres serveur:

```vue
<NsdbList
	model="songs"
	:filters="{
		title: { op: 'ilike', value: '%mix%' },
		item_count: { op: 'gte', value: 3 }
	}"
/>
```

Opérateurs disponibles: `eq`, `neq`, `gt`, `gte`, `lt`, `lte`, `ilike`, `in`.

---

# 4. Sorting

Le tri est un tri serveur. Cliquer sur un header passe par:

```txt
none -> asc -> desc -> none
```

L'état exposé aux slots:

```ts
{
	key: string | null
	direction: 'asc' | 'desc' | null
}
```

---

# 5. Slots

| Slot | Description |
|------|-------------|
| default | Remplace tout le rendu |
| `header` | Remplace l'en-tête |
| `toolbar` | Remplace la barre de recherche / actions |
| `error` | Remplace l'erreur |
| `thead` | Remplace le `<thead>` |
| `th` | Remplace une cellule de header |
| `loading` | Remplace l'état de chargement |
| `empty` | Remplace l'état vide |
| `body` | Remplace le rendu des lignes |
| `cell` | Remplace une cellule |
| `cards` | Remplace la grille cards |
| `card` | Remplace une card |
| `footer` | Remplace le footer / pagination |

Les slots exposent notamment:

```ts
rows
rawRows
columns
loading
error
query
filters
sortState
setSort
search
searchColumns
setSearch
currentPage
pageSize
limit
offset
totalCount
totalPages
goToPage
prevPage
nextPage
firstPage
lastPage
deleteRow
refresh
```

---

# 6. Custom Cell

```vue
<NsdbList model="songs">
	<template #cell="{ row, column, value }">
		<span v-if="column.key === 'created_at'">
			{{ new Date(value).toLocaleDateString() }}
		</span>
		<strong v-else-if="column.key === 'title'">
			{{ row.title }}
		</strong>
		<span v-else>{{ value }}</span>
	</template>
</NsdbList>
```

---

# 7. Custom Toolbar

```vue
<NsdbList model="playlists" searchable>
	<template #toolbar="{ search, setSearch, refresh, query }">
		<div class="flex gap-2">
			<input
				:value="search"
				type="search"
				class="border px-3 py-2"
				@input="setSearch($event.target.value)"
			/>
			<button type="button" class="border px-3 py-2" @click="refresh">
				Refresh
			</button>
			<pre class="text-xs">{{ query }}</pre>
		</div>
	</template>
</NsdbList>
```

---

# 8. Full Custom Rendering

```vue
<NsdbList model="profiles" v-slot="{ rows, loading, error, refresh }">
	<button type="button" @click="refresh">Refresh</button>

	<p v-if="loading">Loading...</p>
	<p v-else-if="error">{{ error }}</p>

	<ul v-else>
		<li v-for="profile in rows" :key="profile.id">
			{{ profile.username }}
		</li>
	</ul>
</NsdbList>
```

---

# 9. Cards

```vue
<NsdbList model="songs" variant="cards">
	<template #card="{ row }">
		<article class="border p-4">
			<h3>{{ row.title }}</h3>
			<p>{{ row.playlist?.title }}</p>
		</article>
	</template>
</NsdbList>
```

---

# 10. Summary

`NsdbList` fournit maintenant une base maintenable pour les listes Supabase dans Nuxt: logique serveur centralisée, rendu personnalisable et API simple pour les cas standards.
