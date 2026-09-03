<template>
	<div class="p-8">
		<span id="float-nav">
			<NuxtLink to="/">↩ Retour</NuxtLink>
		</span>

		<h1 class="text-2xl font-bold mb-4">📦 Stores</h1>

		<div class="mb-4 flex flex-wrap items-center gap-3">
			<button class="rounded border px-3 py-2" :disabled="store.loading" @click="loadFromCache">
				Cache
			</button>
			<button class="rounded border px-3 py-2" :disabled="store.loading" @click="refreshFromSupabase">
				Refresh Supabase
			</button>
			<span class="text-sm opacity-70">
				{{ store.cachedCount }} en cache
				<span v-if="store.totalCount != null"> / {{ store.totalCount }} total</span>
			</span>
			<span v-if="store.lastFetchedAt" class="text-sm opacity-70">
				Dernier fetch: {{ new Date(store.lastFetchedAt).toLocaleTimeString() }}
			</span>
		</div>

		<p v-if="store.loading">Chargement...</p>
		<p v-else-if="store.error" class="text-red-500">
			{{ store.error.message ?? store.error }}
		</p>

		<ul v-else-if="playlists.length > 0">
			<li v-for="playlist in playlists" :key="playlist.id" class="mb-2">
				<div class="playlist-card">
					<div>Titre: {{ playlist.title }}</div>
					<div class="text-xs opacity-70">Provider: {{ playlist.provider ?? 'n/a' }}</div>
				</div>
			</li>
		</ul>

		<p v-else>Aucune playlist.</p>
	</div>
</template>

<script setup lang="ts">
import { usePlaylists } from '~~/nsdb/models/playlists'
import { usePlaylistStore } from '~~/stores/usePlaylistStore'

const playlistsModel = usePlaylists({ store: true })
const store = usePlaylistStore()

const playlists = computed(() => playlistsModel.items.value)

async function loadFromCache() {
	await playlistsModel.fetch({
		limit: 10,
		orderBy: 'created_at',
		orderDirection: 'desc',
	})
}

async function refreshFromSupabase() {
	await playlistsModel.refresh({
		limit: 10,
		orderBy: 'created_at',
		orderDirection: 'desc',
	})
}

onMounted(async () => {
	await loadFromCache()
	store.subscribe()
})
</script>

<style>
#float-nav {
	position: absolute;
	top: 1rem;
	left: 3rem;
	font-size: 2rem;
}

.playlist-card {
	padding: 1rem;
	border: 1px solid #ccc;
	border-radius: 0.5rem;
	background-color: #5d5d5d;
	transition: background-color 0.3s, box-shadow 0.3s;
}
</style>
