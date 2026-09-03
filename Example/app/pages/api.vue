<template>
	<div class="p-8">
		<span id="float-nav">
			<NuxtLink to="/" class="text-purple-500">↩ Retour</NuxtLink>
		</span>

		<h1 class="text-4xl font-bold mb-4 mt-4">📦 CRUD with API</h1>

		<div class="grid grid-cols-2">
			<div>
				<p class="text-2xl font-blue-500 mt-8">
					<button @click="createPlaylist()" class="w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
						Create
					</button>

					<span class="ml-4">| Random playlist</span>
				</p>

				<p class="text-2xl font-blue-500 mt-8">
					<button @click="readPlaylist()" class="w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
						Read
					</button>

					<span class="ml-4">| </span>
					<input v-model="inputID" type="text" placeholder="Playlist ID" class="p-1 rounded text-md text-black" />
				</p>

				<p class="text-2xl font-blue-500 mt-8">
					<button @click="updatePlaylist()" class="w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
						Update
					</button>

					<span class="ml-4">| </span>
					<input v-model="inputID" type="text" placeholder="Playlist ID" class="p-1 rounded text-md text-black" />
				</p>

				<p class="text-2xl font-blue-500 mt-8">
					<button @click="deletePlaylist()" class="w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
						Delete
					</button>

					<span class="ml-4">| </span>
					<input v-model="inputID" type="text" placeholder="Playlist ID" class="p-1 rounded text-md text-black" />
				</p>
			</div>

			<div v-if="playlists" class="text-sm bg-gray-800 px-4 py-2 rounded-xl h-full">
				<span class="text-gray-500">result :</span>

				<div class="overflow-y">
					{{ result }}
				</div>
			</div>
		</div>


		<h1 class="text-4xl font-bold mt-12 mb-8">
			<span>📋 Liste | </span>
			<button @click="getPlaylists()" class="text-sm w-48 bg-blue-500 hover:bg-blue-400 text-white font-bold py-1 px-2 border-b-4 border-blue-700 hover:border-blue-500 rounded">
				Refresh
			</button>
		</h1>

		<ul v-if="Array.isArray(playlists) && playlists.length > 0">
			<li v-for="playlist in playlists" :key="playlist.id" class="mb-2">
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
	import type { Tables } from "~~/types/database.types";

	const api = useSupabaseApi();
	type PlaylistRow = Tables<"playlists">;
	const playlists = ref<PlaylistRow[]>([]);

	const result = ref<any>(null);
	const inputID = ref<string>("");

	onMounted(async () => {
		getPlaylists();
	});

	const createPlaylist = async () => {
		const { data, error } = await api.create("playlists", {
			title: "New Playlist " + Math.floor(Math.random() * 1000),
			profile_id: "06cc776b-4f42-40f6-9c33-707bf13d247a"
		});
		if (error) {
			console.error("Erreur lors de la création de la playlist :", error);
		} else {
			result.value = data;
			playlists.value.push(data as PlaylistRow);
		}
	};

	const readPlaylist = async () => {
		const id = inputID.value;
		const { data, error } = await api.getById("playlists", id);
		if (error) {
			console.error("Erreur lors de la lecture de la playlist :", error);
		} else {
			result.value = data;
		}
	};

	const updatePlaylist = async () => {
		const id = inputID.value;
		const { data, error } = await api.update("playlists", id, {
			title: "Updated Playlist " + Math.floor(Math.random() * 1000)
		});
		if (error) {
			console.error("Erreur lors de la mise à jour de la playlist :", error);
		} else {
			result.value = data;
		}
	};

	const deletePlaylist = async () => {
		const id = inputID.value;
		const { data, error } = await api.remove("playlists", id);
		if (error) {
			console.error("Erreur lors de la suppression de la playlist :", error);
		} else {
			result.value = data;
			playlists.value = playlists.value.filter(p => p.id !== id);
		}
	};

	const getPlaylists = async () => {
		const { data, error } = await api.all("playlists");
		if (error) {
			console.error("Erreur lors du rechargement des playlists :", error);
		} else {
			playlists.value = Array.isArray(data) ? data as PlaylistRow[] : [];
		}
	};
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
