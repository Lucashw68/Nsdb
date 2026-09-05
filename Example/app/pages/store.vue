<script setup lang="ts">
const user = useSupabaseUser()
const consumerA = usePlaylists({ store: true })
const consumerB = usePlaylists({ store: true })
const action = useDemoAction()
const newTitle = ref('')
const editTitle = ref('')
const selectedId = ref<string | null>(null)
const selected = computed(() => consumerB.items.value.find(row => row.id === selectedId.value) ?? null)
const busy = computed(() => action.state.value === 'loading')

function selectForEdit(row: (typeof consumerB.items.value)[number]) {
	selectedId.value = row.id
	editTitle.value = row.title
}

async function refresh() {
	if (!user.value) { consumerA.invalidate(); return }
	action.loading('Consumer A is loading the shared store…')
	try {
		await consumerA.refresh({ orderBy: 'created_at', orderDirection: 'asc' })
		action.success(`Both consumers now show ${consumerA.items.value.length} rows.`)
	} catch (cause) { action.fail(cause, 'Could not load the shared store') }
}

async function createFromB() {
	if (!newTitle.value.trim()) return
	action.loading('Consumer B is creating a row…')
	try {
		const row = await consumerB.create({ title: newTitle.value.trim() })
		newTitle.value = ''
		action.success(`Consumer B created “${row.title}”; Consumer A changed immediately.`)
	} catch (cause) { action.fail(cause, 'Create failed') }
}

async function updateFromB() {
	if (!selected.value || !editTitle.value.trim()) return
	action.loading('Consumer B is updating the shared row…')
	try {
		const row = await consumerB.update(selected.value, { title: editTitle.value.trim() })
		if (!row) throw new Error('Supabase returned no updated row.')
		action.success(`Consumer B saved “${row.title}”; Consumer A already shows it.`)
	} catch (cause) { action.fail(cause, 'Update failed') }
}

watch(() => user.value?.id, () => { selectedId.value = null; void refresh() }, { immediate: true })

const snippet = `// Consumer A
const playlists = usePlaylists({ store: true })
await playlists.fetch()

// Consumer B — same Pinia-backed collection
const samePlaylists = usePlaylists({ store: true })
await samePlaylists.create({ title })`
</script>

<template>
	<DemoShell title="🗄️ Shared Store" description="Both panels consume the same Pinia-backed NSDB store. Mutate the collection in Consumer B and watch Consumer A update immediately—Realtime is not used on this page." docs-path="/docs/core/direct-vs-store" docs-label="Read about direct and store modes">
		<IdentityContext />
		<p v-if="!user" class="muted">Choose Alice or Bob to load that identity’s shared collection.</p>
		<div class="store-bridge" aria-hidden="true"><span>same browser</span><strong>ONE SHARED STORE</strong><span>no Realtime</span></div>
		<div class="consumer-grid">
			<section id="consumer-a" class="consumer-card" aria-labelledby="consumer-a-title">
				<p class="consumer-label">CONSUMER A · VIEWER</p><h2 id="consumer-a-title">Shared collection</h2>
				<p class="count">{{ consumerA.items.value.length }} rows</p>
				<ul class="result-list"><li v-for="row in consumerA.items.value" :key="row.id" class="result-row"><span>{{ row.title }}</span></li></ul>
				<p v-if="user && !busy && !consumerA.items.value.length" class="muted">No rows yet.</p>
			</section>
			<section id="consumer-b" class="consumer-card" aria-labelledby="consumer-b-title">
				<p class="consumer-label">CONSUMER B · EDITOR</p><h2 id="consumer-b-title">Actions on the same collection</h2>
				<form class="editor-form" @submit.prevent="createFromB"><label class="field"><span>New playlist title</span><input v-model="newTitle" placeholder="Shared through Pinia" :disabled="!user || busy" /></label><button id="store-create" class="primary-action" :disabled="!user || busy || !newTitle.trim()">{{ busy && action.label.value.includes('creating') ? 'Creating…' : 'Create in B' }}</button></form>
				<ul class="result-list"><li v-for="row in consumerB.items.value" :key="row.id" class="result-row" :data-selected="row.id === selectedId"><button class="row-select" type="button" @click="selectForEdit(row)">{{ row.title }} <small>{{ row.id === selectedId ? 'Selected' : 'Edit' }}</small></button></li></ul>
				<form v-if="selected" class="editor-form selected-editor" @submit.prevent="updateFromB"><label class="field"><span>Update selected title</span><input v-model="editTitle" :disabled="busy" /></label><button id="store-save" class="primary-action" :disabled="busy || !editTitle.trim()">{{ busy && action.label.value.includes('updating') ? 'Saving…' : 'Save in B' }}</button></form>
			</section>
		</div>
		<DemoStatus :state="action.state.value" :message="action.label.value" :error="action.error.value" />
		<p class="compare"><NuxtLink to="/realtime">Now compare with a remote Realtime event →</NuxtLink></p>
		<template #code><CodeSnippet title="Two consumers, one store" :code="snippet" /></template>
	</DemoShell>
</template>

<style scoped>
.store-bridge { display: flex; justify-content: center; gap: .8rem; align-items: center; margin: 1rem 0; color: var(--muted); font-size: .75rem; }
.store-bridge strong { padding: .35rem .7rem; border: 1px solid #7c3aed; border-radius: 999px; color: #d8b4fe; }
.consumer-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.consumer-card { min-width: 0; padding: 1.15rem; border: 1px solid var(--border); border-radius: .7rem; background: #0b1220; }
.consumer-card h2 { margin: 0; font-size: 1.15rem; }
.consumer-label { margin: 0 0 .35rem; color: var(--accent); font-size: .72rem; letter-spacing: .1em; }
.count { color: var(--muted); }
.editor-form { display: grid; gap: .65rem; margin: 1rem 0; }
.selected-editor { padding-top: .8rem; border-top: 1px solid var(--border); }
.row-select { display: flex; justify-content: space-between; width: 100%; padding: 0; border: 0; background: transparent; text-align: left; }
.row-select small { color: var(--muted); }
.primary-action { background: #7c3aed; border-color: #a78bfa; }
.compare a { color: var(--accent); }
@media (max-width: 760px) { .consumer-grid { grid-template-columns: 1fr; } .store-bridge { flex-wrap: wrap; } }
</style>
