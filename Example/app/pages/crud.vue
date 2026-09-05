<script setup lang="ts">
const user = useSupabaseUser()
const playlists = usePlaylists()
const action = useDemoAction()
const createTitle = ref('')
const editTitle = ref('')
const selectedId = ref<string | null>(null)
const rows = computed(() => playlists.items.value)
const selected = computed(() => rows.value.find(row => row.id === selectedId.value) ?? null)
const busy = computed(() => action.state.value === 'loading')

function selectRow(row: (typeof rows.value)[number]) {
	selectedId.value = row.id
	editTitle.value = row.title
	action.reset()
}

async function refresh() {
	if (!user.value) { playlists.invalidate(); return }
	action.loading('Loading playlists…')
	try {
		await playlists.refresh({ orderBy: 'created_at', orderDirection: 'asc' })
		action.success(`Loaded ${rows.value.length} playlist${rows.value.length === 1 ? '' : 's'}.`)
	} catch (cause) { action.fail(cause, 'Could not load playlists') }
}

async function create() {
	const title = createTitle.value.trim()
	if (!title) return
	action.loading('Creating playlist…')
	try {
		const row = await playlists.create({ title })
		createTitle.value = ''
		selectRow(row)
		action.success(`Created “${row.title}”. It is now selected below.`)
	} catch (cause) { action.fail(cause, 'Create failed') }
}

async function update() {
	if (!selected.value || !editTitle.value.trim()) return
	action.loading('Saving changes…')
	try {
		const row = await playlists.update(selected.value, { title: editTitle.value.trim() })
		if (!row) throw new Error('Supabase returned no updated row.')
		editTitle.value = row.title
		action.success(`Updated “${row.title}”.`)
	} catch (cause) { action.fail(cause, 'Update failed') }
}

async function remove() {
	if (!selected.value) return
	const deletedTitle = selected.value.title
	action.loading('Deleting playlist…')
	try {
		await playlists.remove(selected.value)
		selectedId.value = null
		editTitle.value = ''
		action.success(`Deleted “${deletedTitle}”.`)
	} catch (cause) { action.fail(cause, 'Delete failed') }
}

watch(() => user.value?.id, () => { void refresh() }, { immediate: true })

const snippet = `const playlists = usePlaylists()

await playlists.fetch()
const playlist = await playlists.create({ title })
await playlists.update(playlist, { title: editedTitle })
await playlists.remove(playlist)`
</script>

<template>
	<DemoShell title="📦 Basic CRUD" description="Create a real playlist, select it, edit its title, then delete it. Every mutation uses the generated model and is protected by local Supabase RLS." docs-path="/docs/core/crud" docs-label="Read the CRUD guide">
		<IdentityContext />
		<p v-if="!user" class="muted">Choose Alice or Bob in the header to unlock this protected scenario.</p>
		<section class="crud-step" aria-labelledby="create-title">
			<div><span class="step-number">1</span><h2 id="create-title">Create</h2></div>
			<form class="controls" @submit.prevent="create">
				<label class="field"><span>New playlist title</span><input v-model="createTitle" placeholder="e.g. Release soundtrack" :disabled="!user || busy" /></label>
				<button id="crud-create" class="primary-action" :disabled="!user || !createTitle.trim() || busy">{{ busy && action.label.value.includes('Creating') ? 'Creating…' : 'Create playlist' }}</button>
				<button type="button" :disabled="!user || busy" @click="refresh">{{ busy && action.label.value.includes('Loading') ? 'Loading…' : 'Refresh' }}</button>
			</form>
		</section>
		<section class="crud-step" aria-labelledby="select-title">
			<div><span class="step-number">2</span><h2 id="select-title">Select a playlist</h2></div>
			<ul id="crud-rows" class="result-list" :aria-busy="busy">
				<li v-for="row in rows" :key="row.id" class="result-row" :data-selected="row.id === selectedId">
					<button class="row-select" type="button" :aria-pressed="row.id === selectedId" @click="selectRow(row)"><span>{{ row.title }}</span><small>{{ row.id === selectedId ? 'Selected' : 'Select' }}</small></button>
				</li>
			</ul>
			<p v-if="user && !busy && !rows.length" class="muted">No playlists yet. Create the first one above.</p>
		</section>
		<section v-if="selected" class="crud-step editor" aria-labelledby="edit-title">
			<div><span class="step-number">3</span><h2 id="edit-title">Edit or delete selected row</h2></div>
			<p class="muted">Current value: <strong>{{ selected.title }}</strong></p>
			<form class="controls" @submit.prevent="update">
				<label class="field"><span>New title</span><input v-model="editTitle" :disabled="busy" /></label>
				<button id="crud-save" class="primary-action" :disabled="busy || !editTitle.trim()">{{ busy && action.label.value.includes('Saving') ? 'Saving…' : 'Save changes' }}</button>
				<button id="crud-delete" class="danger-action" type="button" :disabled="busy" @click="remove">{{ busy && action.label.value.includes('Deleting') ? 'Deleting…' : 'Delete' }}</button>
			</form>
		</section>
		<DemoStatus :state="action.state.value" :message="action.label.value" :error="action.error.value" />
		<template #code><CodeSnippet title="The real model calls" :code="snippet" /></template>
	</DemoShell>
</template>

<style scoped>
.crud-step { margin-top: 1.4rem; }
.crud-step > div:first-child { display: flex; gap: .6rem; align-items: center; }
.crud-step h2 { margin: 0; font-size: 1rem; }
.step-number { display: grid; place-items: center; width: 1.7rem; height: 1.7rem; border-radius: 50%; background: #7c3aed; font-weight: 700; }
.controls { margin: .8rem 0 0; }
.field { flex: 1 1 280px; }
.row-select { display: flex; justify-content: space-between; width: 100%; border: 0; background: transparent; padding: 0; text-align: left; }
.row-select small { color: var(--muted); }
[data-selected='true'] .row-select small { color: #d8b4fe; font-weight: 700; }
.editor { padding: 1rem; border: 1px solid #7e22ce; border-radius: .65rem; background: rgba(88, 28, 135, .12); }
.primary-action { background: #7c3aed; border-color: #a78bfa; }
.danger-action { border-color: #b91c1c; color: #fecaca; }
</style>
