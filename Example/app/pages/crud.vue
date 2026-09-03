<template>
	<div class="p-8">
		<span id="float-nav">
			<NuxtLink to="/" class="text-purple-500">↩ Retour</NuxtLink>
		</span>

		<h1 class="text-4xl font-bold mb-4 mt-4">📦 CRUD with Models</h1>

		<div class="grid grid-cols-2 gap-6">
			<div>
				<p class="text-2xl font-blue-500 mt-8">
					<button @click="createPlaylist" class="w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
						Create
					</button>
					<span class="ml-4">| Random playlist</span>
				</p>

				<p class="text-2xl font-blue-500 mt-8">
					<button @click="readPlaylist" class="w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
						Read
					</button>
					<span class="ml-4">| </span>
					<input v-model="inputID" type="text" placeholder="Playlist ID" class="p-1 rounded text-md text-black" />
				</p>

				<p class="text-2xl font-blue-500 mt-8">
					<button @click="updatePlaylist" class="w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
						Update
					</button>
					<span class="ml-4">| </span>
					<input v-model="inputID" type="text" placeholder="Playlist ID" class="p-1 rounded text-md text-black" />
				</p>

				<p class="text-2xl font-blue-500 mt-8">
					<button @click="deletePlaylist" class="w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
						Delete
					</button>
					<span class="ml-4">| </span>
					<input v-model="inputID" type="text" placeholder="Playlist ID" class="p-1 rounded text-md text-black" />
				</p>
			</div>

			<div v-if="result" class="text-sm bg-gray-800 px-4 py-2 rounded-xl h-full">
				<span class="text-gray-500">result :</span>
				<pre class="overflow-y mt-2 whitespace-pre-wrap">{{ result }}</pre>
			</div>
		</div>

		<h1 class="text-4xl font-bold mt-12 mb-8">
			<span>📋 Liste | </span>
			<button @click="refresh" class="text-sm w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
				Refresh
			</button>
		</h1>

		<!-- <div class="text-xs text-gray-400 mb-2">Debug: {{ JSON.stringify(list) }}</div> -->

		<ul v-if="list.length">
			<li v-for="playlist in list" :key="playlist.id" class="mb-2">
				<div @click="inputID = playlist.id" class="text-sm bg-gray-800 px-4 py-2 rounded-xl">
					<p>Id: {{ playlist.id }}</p>
					<p>Titre: {{ playlist.title }}</p>
				</div>
			</li>
		</ul>
		<p v-else>Aucune playlist.</p>
	</div>
</template>

<script setup lang="ts">
	import { ref, onMounted, computed } from 'vue'
	import { usePlaylists, type PlaylistsRow } from '~~/nsdb/models/playlists'

	const playlists = usePlaylists({ store: false })
	const list = computed(() => playlists.items.value)

	const inputID = ref<string>('')
	const result = ref<any>(null)

	onMounted(async () => {
		await playlists.fetch()
	})

	const refresh = async () => {
		result.value = await playlists.fetch()
	}

	const createPlaylist = async () => {
		try {
			const row = await playlists.create({
				title: 'New Playlist ' + Math.floor(Math.random() * 1000),
				profile_id: '06cc776b-4f42-40f6-9c33-707bf13d247a'
			})
			result.value = row
			if (row) playlists.items.value.push(row)
		} catch (e) {
			console.error('Erreur lors de la création de la playlist :', e)
		}
	}

	const readPlaylist = async () => {
		try {
			const row = await playlists.getById(inputID.value)
			result.value = row
		} catch (e) {
			console.error('Erreur lors de la lecture de la playlist :', e)
		}
	}

	const updatePlaylist = async () => {
		try {
			const row = await playlists.update(inputID.value, {
				title: 'Updated Playlist ' + Math.floor(Math.random() * 1000)
			})
			result.value = row
			if (row) {
				const idx = playlists.items.value.findIndex((p: PlaylistsRow) => p.id === inputID.value)
				if (idx !== -1) playlists.items.value[idx] = row
			}
		} catch (e) {
			console.error('Erreur lors de la mise à jour de la playlist :', e)
		}
	}

	const deletePlaylist = async () => {
		try {
			await playlists.remove(inputID.value)
			result.value = `Playlist with ID ${inputID.value} deleted.`
			playlists.items.value = playlists.items.value.filter((p: PlaylistsRow) => p.id !== inputID.value)
		} catch (e) {
			console.error('Erreur lors de la suppression de la playlist :', e)
		}
	}
</script>

<style>
#float-nav {
	position: absolute;
	top: 1rem;
	left: 3rem;
	font-size: 2rem;
}
.playlist-card {
	padding-top: 0.1rem !important;
	padding-bottom: 0.1rem !important;
	padding-left: 1rem;
	padding-right: 1rem;
	border: 1px solid #ccc;
	border-radius: 0.5rem;
	background-color: #5d5d5d;
	transition: background-color 0.3s, box-shadow 0.3s;
}
</style>
