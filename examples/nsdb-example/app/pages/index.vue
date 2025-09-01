<template>
	<div>
		<h1>
			Example NSDB
		</h1>

		<div class="w-full">
			<NuxtLink to="api" />
		</div>

		<!-- <div class="p-8">
			<h1 class="text-2xl font-bold mb-4">📦 Liste des playlists</h1>
			<ul v-if="playlists.length > 0">
				<li v-for="playlist in playlists" :key="playlist.id" class="mb-2">
					{{ playlist.name }}
				</li>
			</ul>
			<p v-else>Aucune playlist.</p>
		</div> -->
	</div>
</template>

<script setup lang="ts">
// import { usePlaylistsStore } from '../../stores/entities/usePlaylistsStore'

// const store = usePlaylistsStore()
// const { items: playlists, fetch } = store

// await fetch()
</script>
