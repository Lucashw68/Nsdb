<template>
	<div class="p-8">
		<h1 class="text-2xl font-bold mb-4">📦 Liste des playlists</h1>
		<ul v-if="playlists.length > 0">
			<li v-for="playlist in playlists" :key="playlist.id" class="mb-2">
				{{ playlist.name }}
			</li>
		</ul>
		<p v-else>Aucune playlist.</p>
	</div>
</template>

<script setup lang="ts">
const api = useSupabaseApi()
const playlists = ref<Array<{ id: number; name: string }>>([])

onMounted(async () => {
	const { data, error } = await api.all('playlists')
	if (error) {
		console.error('Erreur lors du chargement des playlists :', error)
	} else {
		playlists.value = data || []
	}
})
</script>
