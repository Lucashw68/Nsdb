<template>
	<main id="e2e-app" :data-ready="ready" class="mx-auto max-w-3xl space-y-6 p-8">
		<h1 class="text-3xl font-bold">NSDB local E2E</h1>

		<section class="space-y-2 rounded border p-4">
			<h2 class="font-semibold">Auth</h2>
			<input id="email" v-model="email" aria-label="Email" type="email" placeholder="Email" class="border p-2 text-black" />
			<input id="password" v-model="password" aria-label="Password" type="password" placeholder="Password" class="border p-2 text-black" />
			<button id="signup" class="border px-3 py-2" @click="signup">Sign up</button>
			<button id="login" class="border px-3 py-2" @click="login">Login</button>
			<button id="logout" class="border px-3 py-2" @click="logout">Logout</button>
			<p id="auth-state">{{ user ? `authenticated:${user.id}` : 'anonymous' }}</p>
		</section>

		<section class="space-y-2 rounded border p-4">
			<h2 class="font-semibold">Playlists through generated NSDB model/store</h2>
			<input id="playlist-title" v-model="title" placeholder="Playlist title" class="border p-2 text-black" />
			<button id="create-playlist" class="border px-3 py-2" @click="createPlaylist">Create</button>
			<input id="playlist-search" v-model="search" placeholder="Search" class="border p-2 text-black" />
			<button id="refresh-playlists" class="border px-3 py-2" @click="refreshPlaylists">Refresh</button>
			<ul id="playlists">
				<li v-for="playlist in visiblePlaylists" :key="playlist.id" :data-playlist-id="playlist.id">
					<span>{{ playlist.title }}</span>
					<button :data-edit="playlist.id" @click="renamePlaylist(playlist.id)">Rename</button>
					<button :data-delete="playlist.id" @click="deletePlaylist(playlist.id)">Delete</button>
				</li>
			</ul>
		</section>

		<section class="space-y-2 rounded border p-4">
			<h2 class="font-semibold">Storage through NSDB</h2>
			<button id="upload-file" class="border px-3 py-2" @click="uploadFile">Upload</button>
			<button id="move-file" class="border px-3 py-2" @click="moveFile">Move</button>
			<button id="remove-file" class="border px-3 py-2" @click="removeFile">Remove</button>
			<p id="storage-path">{{ storagePath }}</p>
		</section>

		<section id="generic-components" class="space-y-4 rounded border p-4">
			<h2 class="font-semibold">Plug-and-play components through RLS</h2>
			<NsdbForm :id="selectedComponentId" model="component_records" store @saved="handleComponentSaved" @error="captureComponentError" />
			<NsdbList
				ref="componentList"
				model="component_records"
				store
				searchable
				:search-columns="['title', 'notes']"
				:page-size="5"
			>
				<template #cell="{ row, column, value }">
					<button v-if="column.key === 'title'" type="button" @click="selectedComponentId = row.id">{{ value }}</button>
					<span v-else>{{ value }}</span>
				</template>
			</NsdbList>
			<p id="component-error" class="text-red-600" role="alert">{{ componentError }}</p>
		</section>

		<p id="e2e-error" class="text-red-600">{{ error }}</p>
	</main>
</template>

<script setup lang="ts">
const supabase = useSupabaseClient()
const user = useSupabaseUser()
const playlists = usePlaylists({ store: true })
const componentRecords = useComponentRecords({ store: true })
const storage = useSupabaseApiStorage()

const email = ref('')
const password = ref('')
const title = ref('')
const search = ref('')
const error = ref('')
const storagePath = ref('')
const componentError = ref('')
const componentList = ref<{ refresh: () => Promise<void> } | null>(null)
const selectedComponentId = ref<string | null>(null)
const ready = ref(false)

onMounted(() => {
	ready.value = true
	componentRecords.subscribe()
})
onBeforeUnmount(() => componentRecords.unsubscribe())

const visiblePlaylists = computed(() => playlists.items.value)

async function run(operation: () => Promise<void>) {
	error.value = ''
	try {
		await operation()
	} catch (operationError: any) {
		error.value = operationError?.message ?? String(operationError)
	}
}

async function signup() {
	await run(async () => {
		const { error: authError } = await supabase.auth.signUp({ email: email.value, password: password.value })
		if (authError) throw authError
		await refreshPlaylists()
		await refreshComponents()
	})
}

async function login() {
	await run(async () => {
		const { error: authError } = await supabase.auth.signInWithPassword({ email: email.value, password: password.value })
		if (authError) throw authError
		await refreshPlaylists()
		await refreshComponents()
	})
}

function captureComponentError(operationError: any) {
	componentError.value = operationError?.message ?? String(operationError)
}

async function refreshComponents() {
	componentError.value = ''
	await componentList.value?.refresh()
}

async function handleComponentSaved() {
	if (selectedComponentId.value) selectedComponentId.value = null
}

async function logout() {
	await run(async () => {
		const { error: authError } = await supabase.auth.signOut()
		if (authError) throw authError
	})
}

async function refreshPlaylists() {
	await run(async () => {
		await playlists.refresh({
			select: '*',
			search: search.value || undefined,
			searchColumns: ['title'],
			orderBy: 'created_at',
			orderDirection: 'asc',
			merge: false,
		})
	})
}

async function createPlaylist() {
	await run(async () => {
		await playlists.create({ title: title.value })
		title.value = ''
	})
}

async function renamePlaylist(id: string) {
	await run(async () => {
		await playlists.update(id, { title: 'Renamed playlist' })
	})
}

async function deletePlaylist(id: string) {
	await run(async () => {
		await playlists.remove(id)
	})
}

async function uploadFile() {
	await run(async () => {
		if (!user.value) throw new Error('Authentication required')
		storagePath.value = `${user.value.id}/e2e/file with spaces.txt`
		const response = await storage.upload('nsdb-private', storagePath.value, new Blob(['NSDB E2E']), {
			contentType: 'text/plain',
			upsert: true,
		})
		if (!response.success) throw response.error
	})
}

async function moveFile() {
	await run(async () => {
		if (!user.value) throw new Error('Authentication required')
		const nextPath = `${user.value.id}/e2e/moved file.txt`
		const response = await storage.move('nsdb-private', storagePath.value, nextPath)
		if (!response.success) throw response.error
		storagePath.value = nextPath
	})
}

async function removeFile() {
	await run(async () => {
		const response = await storage.remove('nsdb-private', storagePath.value)
		if (!response.success) throw response.error
		storagePath.value = ''
	})
}
</script>
