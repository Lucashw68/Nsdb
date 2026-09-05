<script setup lang="ts">
type StoredFile = { name: string; metadata?: { size?: number; mimetype?: string } | null }
const user = useSupabaseUser()
const storage = useSupabaseApiStorage()
const action = useDemoAction()
const selectedFile = ref<File | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const files = ref<StoredFile[]>([])
const bucket = 'nsdb-private'
const directory = computed(() => user.value ? `${user.value.id}/playground` : '')
const busy = computed(() => action.state.value === 'loading')

function formatBytes(bytes = 0) { return new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(bytes) + 'B' }
function chooseFile(event: Event) { selectedFile.value = (event.target as HTMLInputElement).files?.[0] ?? null; action.reset() }

async function list(showStatus = true) {
	if (!user.value) { files.value = []; return }
	if (showStatus) action.loading('Loading files…')
	try {
		const response = await storage.list<StoredFile>(bucket, { path: directory.value, orderBy: 'name', orderDirection: 'asc' })
		if (!response.success) throw response.error
		files.value = response.data.filter(file => file.name !== '.emptyFolderPlaceholder')
		if (showStatus) action.success(`Loaded ${files.value.length} file${files.value.length === 1 ? '' : 's'}.`)
	} catch (cause) { action.fail(cause, 'File listing failed') }
}

async function upload() {
	if (!selectedFile.value || !user.value) return
	const file = selectedFile.value
	action.loading(`Uploading ${file.name}…`)
	try {
		const path = storage.joinPath(directory.value, file.name)
		const response = await storage.upload(bucket, path, file, { contentType: file.type || undefined })
		if (!response.success) throw response.error
		await list(false)
		action.success(`Uploaded ${file.name} successfully.`)
	} catch (cause) { action.fail(cause, 'Upload failed') }
}

async function remove(file: StoredFile) {
	action.loading(`Deleting ${file.name}…`)
	try {
		const response = await storage.remove(bucket, storage.joinPath(directory.value, file.name))
		if (!response.success) throw response.error
		await list(false)
		if (selectedFile.value?.name === file.name) { selectedFile.value = null; if (fileInput.value) fileInput.value.value = '' }
		action.success(`Deleted ${file.name}.`)
	} catch (cause) { action.fail(cause, 'Delete failed') }
}

watch(() => user.value?.id, () => { selectedFile.value = null; action.reset(); void list(false) }, { immediate: true })

const snippet = `const storage = useSupabaseApiStorage()
const path = storage.joinPath(user.id, 'playground', file.name)

await storage.upload('nsdb-private', path, file)
await storage.list('nsdb-private', { path: directory })
await storage.remove('nsdb-private', path)`
</script>

<template>
	<DemoShell title="🗂️ Storage" description="Select a file, upload it to your identity-scoped local bucket, see it appear, then delete it. Every Storage response is checked and failures stay visible beside the action." docs-path="/docs/supabase/storage" docs-label="Read the Storage guide">
		<IdentityContext />
		<p v-if="!user" class="muted">Choose Alice or Bob to obtain an RLS-protected folder.</p>
		<div class="bucket-context"><span>Bucket</span><strong>{{ bucket }}</strong><span>Folder</span><code>{{ directory || 'authenticate first' }}</code></div>
		<section class="upload-card" aria-labelledby="upload-title">
			<div><p class="stage-label">1 · SELECT</p><h2 id="upload-title">Choose a local file</h2></div>
			<input ref="fileInput" aria-label="File to upload" type="file" :disabled="!user || busy" @change="chooseFile" />
			<div v-if="selectedFile" class="selected-file"><strong>{{ selectedFile.name }}</strong><span>{{ formatBytes(selectedFile.size) }}</span><span>{{ selectedFile.type || 'unknown type' }}</span></div>
			<button id="storage-upload" class="primary-action" :disabled="!user || !selectedFile || busy" @click="upload">{{ busy && action.label.value.startsWith('Uploading') ? 'Uploading…' : '2 · Upload file' }}</button>
			<DemoStatus :state="action.state.value" :message="action.label.value" :error="action.error.value" />
		</section>
		<section class="files-card" aria-labelledby="files-title">
			<div class="files-heading"><div><p class="stage-label">3 · RESULT</p><h2 id="files-title">Files in this folder</h2></div><button :disabled="!user || busy" @click="list()">{{ busy && action.label.value === 'Loading files…' ? 'Refreshing…' : 'Refresh' }}</button></div>
			<ul id="storage-files" class="result-list"><li v-for="file in files" :key="file.name" class="result-row"><div><strong>{{ file.name }}</strong><small>{{ formatBytes(file.metadata?.size) }} · {{ file.metadata?.mimetype || 'file' }}</small></div><button class="danger-action" :aria-label="`Delete ${file.name}`" :disabled="busy" @click="remove(file)">{{ busy && action.label.value.includes(file.name) ? 'Deleting…' : 'Delete' }}</button></li></ul>
			<p v-if="user && !busy && !files.length" class="muted">No files in this folder yet.</p>
		</section>
		<template #code><CodeSnippet title="The real Storage calls" :code="snippet" /></template>
	</DemoShell>
</template>

<style scoped>
.bucket-context { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: .25rem .7rem; margin: 1rem 0; padding: .7rem 1rem; border: 1px solid var(--border); border-radius: .55rem; font-size: .8rem; }
.bucket-context span { color: var(--muted); } .bucket-context code { overflow-wrap: anywhere; color: #c4b5fd; }
.upload-card, .files-card { margin-top: 1rem; padding: 1.1rem; border: 1px solid var(--border); border-radius: .7rem; background: #0b1220; }
.upload-card { display: grid; gap: .9rem; }
.upload-card input[type='file'] { width: 100%; min-width: 0; }
.upload-card h2, .files-card h2 { margin: .2rem 0; font-size: 1.15rem; }
.stage-label { margin: 0; color: var(--accent); font-size: .72rem; font-weight: 700; letter-spacing: .12em; }
.selected-file { display: flex; flex-wrap: wrap; gap: .5rem 1rem; padding: .75rem; border: 1px solid #047857; border-radius: .55rem; background: rgba(6, 95, 70, .14); }
.selected-file span, .result-row small { display: block; color: var(--muted); font-size: .78rem; }
.files-heading { display: flex; justify-content: space-between; gap: 1rem; align-items: center; }
.primary-action { justify-self: start; background: #7c3aed; border-color: #a78bfa; }
.danger-action { border-color: #b91c1c; color: #fecaca; }
</style>
