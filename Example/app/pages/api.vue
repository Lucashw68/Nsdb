<script setup lang="ts">
import type { Tables } from '~~/types/database.types'

type Playlist = Tables<'playlists'>
const api = useSupabaseApi()
const user = useSupabaseUser()
const action = useDemoAction()
const rows = shallowRef<Playlist[]>([])
const createTitle = ref('')
const editTitle = ref('')
const selectedId = ref<string | null>(null)
const lastResult = ref('No request yet.')
const selected = computed<Playlist | null>(() => rows.value.find(row => row.id === selectedId.value) ?? null)
const busy = computed(() => action.state.value === 'loading')

function selectRow(row: Playlist) { selectedId.value = row.id; editTitle.value = row.title }

async function load(showStatus = true) {
	if (!user.value) { rows.value = []; return }
	if (showStatus) action.loading('Reading rows through the direct API…')
	try {
		const response = await api.all<Playlist>('playlists', { orderBy: 'created_at', orderDirection: 'asc' })
		if (!response.success) throw response.error
		const data = response.data ?? []
		rows.value = data
		lastResult.value = `Read returned ${data.length} row${data.length === 1 ? '' : 's'}.`
		if (showStatus) action.success(lastResult.value)
	} catch (cause) { action.fail(cause, 'Read failed') }
}

async function create() {
	if (!user.value || !createTitle.value.trim()) return
	action.loading('Creating through the direct API…')
	try {
		const response = await api.create<Playlist>('playlists', { title: createTitle.value.trim(), user_id: user.value.id })
		if (!response.success || !response.data) throw response.error ?? new Error('Supabase returned no row.')
		createTitle.value = ''
		await load(false)
		selectRow(response.data)
		lastResult.value = `Create returned “${response.data.title}”.`
		action.success(lastResult.value)
	} catch (cause) { action.fail(cause, 'Create failed') }
}

async function update() {
	if (!selected.value || !editTitle.value.trim()) return
	action.loading('Updating through the direct API…')
	try {
		const response = await api.update<Playlist>('playlists', selected.value.id, { title: editTitle.value.trim() })
		if (!response.success) throw response.error
		await load(false)
		lastResult.value = `Update returned ${Array.isArray(response.data) ? response.data.length : 1} changed row.`
		action.success(lastResult.value)
	} catch (cause) { action.fail(cause, 'Update failed') }
}

async function remove() {
	if (!selected.value) return
	const title = selected.value.title
	action.loading('Deleting through the direct API…')
	try {
		const response = await api.remove('playlists', selected.value.id)
		if (!response.success) throw response.error
		selectedId.value = null
		editTitle.value = ''
		await load(false)
		lastResult.value = `Delete completed for “${title}”.`
		action.success(lastResult.value)
	} catch (cause) { action.fail(cause, 'Delete failed') }
}

watch(() => user.value?.id, () => { selectedId.value = null; void load() }, { immediate: true })

const snippet = `const api = useSupabaseApi()

const rows = await api.all('playlists')
const created = await api.create('playlists', payload)
await api.update('playlists', created.data.id, changes)
await api.remove('playlists', created.data.id)`
</script>

<template>
	<DemoShell title="🎯 Direct API" description="Talk directly to Supabase through NSDB’s low-level escape hatch. This page performs the full CRUD cycle without a generated model or shared store." docs-path="/docs/advanced/low-level-api" docs-label="Read the low-level API guide">
		<IdentityContext />
		<p v-if="!user" class="muted">Choose Alice or Bob to satisfy the table’s real RLS policy.</p>
		<form class="controls" @submit.prevent="create">
			<label class="field"><span>New playlist title</span><input v-model="createTitle" placeholder="Direct API playlist" :disabled="!user || busy" /></label>
			<button id="api-create" class="primary-action" :disabled="!user || busy || !createTitle.trim()">{{ busy && action.label.value.includes('Creating') ? 'Creating…' : 'Create' }}</button>
			<button type="button" :disabled="!user || busy" @click="load()">{{ busy && action.label.value.includes('Reading') ? 'Reading…' : 'Read rows' }}</button>
		</form>
		<div class="api-layout">
			<section aria-labelledby="api-collection-title">
				<h2 id="api-collection-title">Current collection</h2>
				<ul id="api-rows" class="result-list"><li v-for="row in rows" :key="row.id" class="result-row" :data-selected="row.id === selectedId"><button class="row-select" type="button" :aria-pressed="row.id === selectedId" @click="selectRow(row)">{{ row.title }} <small>{{ row.id === selectedId ? 'Selected' : 'Select' }}</small></button></li></ul>
				<p v-if="user && !busy && !rows.length" class="muted">The API returned an empty collection.</p>
			</section>
			<section class="result-card" aria-labelledby="api-result-title">
				<h2 id="api-result-title">Last result</h2><p id="api-result">{{ lastResult }}</p>
				<form v-if="selected" @submit.prevent="update"><label class="field"><span>Edit selected title</span><input v-model="editTitle" :disabled="busy" /></label><div class="controls"><button id="api-save" class="primary-action" :disabled="busy || !editTitle.trim()">{{ busy && action.label.value.includes('Updating') ? 'Updating…' : 'Update' }}</button><button id="api-delete" class="danger-action" type="button" :disabled="busy" @click="remove">{{ busy && action.label.value.includes('Deleting') ? 'Deleting…' : 'Delete' }}</button></div></form>
			</section>
		</div>
		<DemoStatus :state="action.state.value" :message="action.label.value" :error="action.error.value" />
		<p class="compare-link"><NuxtLink to="/crud">Compare with the generated model →</NuxtLink></p>
		<template #code><CodeSnippet title="The real response-object calls" :code="snippet" /></template>
	</DemoShell>
</template>

<style scoped>
.api-layout { display: grid; grid-template-columns: minmax(0, 1.2fr) minmax(260px, .8fr); gap: 1rem; }
.api-layout h2 { font-size: 1rem; }
.result-card { align-self: start; padding: 1rem; border: 1px solid var(--border); border-radius: .65rem; background: #0b1220; }
.row-select { display: flex; justify-content: space-between; width: 100%; border: 0; background: transparent; padding: 0; text-align: left; }
.row-select small { color: var(--muted); }
.primary-action { background: #7c3aed; border-color: #a78bfa; }
.danger-action { border-color: #b91c1c; color: #fecaca; }
.compare-link a { color: var(--accent); }
@media (max-width: 760px) { .api-layout { grid-template-columns: 1fr; } }
</style>
