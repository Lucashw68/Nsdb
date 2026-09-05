<script setup lang="ts">
const config = useRuntimeConfig()
const { user, busy: authBusy, error: authError, useLocalAccount } = usePlaygroundAuth()
const records = useComponentRecords({ store: true })
const selectedId = ref<string | null>(null)
const formRevision = ref(0)
const action = useDemoAction()
const hydrated = ref(false)

onMounted(() => {
	hydrated.value = true
})

const hiddenFormFields = ['id', 'metadata', 'tags', 'event_date', 'notes', 'priority', 'published', 'status']
const listColumns = [
	{ key: 'title', label: 'Title' },
	{ key: 'status', label: 'Status' },
	{ key: 'priority', label: 'Priority' },
	{ key: 'published', label: 'Published' },
]
const listClasses = {
	wrapper: 'playground-list',
	headerWrapper: 'playground-list-header',
	headerTitle: 'playground-list-title',
	headerSubtitle: 'playground-list-subtitle',
	toolbar: 'playground-list-toolbar',
	searchInput: 'playground-search',
	error: 'playground-list-error',
	tableContainer: 'playground-table-container',
	table: 'playground-table',
	thead: 'playground-table-head',
	theadRow: 'playground-table-head-row',
	th: 'playground-table-heading',
	actionsTh: 'playground-table-actions-heading',
	loadingCell: 'playground-table-message',
	emptyCell: 'playground-table-message',
	bodyRow: 'playground-table-row',
	td: 'playground-table-cell',
	actionsTd: 'playground-table-actions',
	deleteButton: 'playground-delete-button',
	footer: 'playground-list-footer',
	pagination: 'playground-pagination',
	pageButton: 'playground-page-button',
	pageButtonActive: 'playground-page-button-active',
	pageButtonDisabled: 'playground-page-button-disabled',
}

const selectedTitle = computed(() => (
	records.items.value.find(row => row.id === selectedId.value)?.title ?? ''
))

function startCreate() {
	selectedId.value = null
	action.reset()
	formRevision.value += 1
}

function startEdit(row: Record<string, unknown>) {
	if (typeof row.id !== 'string') return
	selectedId.value = row.id
	action.reset()
}

function saved(row: { title: string }) {
	action.success(selectedId.value
		? `“${row.title}” was updated.`
		: `“${row.title}” was created.`)
	selectedId.value = null
	formRevision.value += 1
}

function failed(cause: unknown) {
	action.fail(cause, 'Form submission failed')
}

const listSnippet = `<NsdbList
  model="component_records"
  store
  searchable
  :columns="columns"
  :search-columns="['title', 'notes']"
/>`

const formSnippet = `<NsdbForm
  model="component_records"
  store
  :hide-fields="demoOnlyFields"
  @saved="handleSaved"
/>`
</script>

<template>
	<DemoShell
		title="👁️ NsdbList & NsdbForm"
		description="Create, edit, search and remove real rows through NSDB's generic components. The demo keeps the useful defaults and customizes only the fields and columns that matter here."
		docs-path="/docs/components/nsdb-list"
		docs-label="Read the NsdbList guide"
	>
		<section v-if="!user" class="auth-gate" aria-labelledby="components-auth-title" :data-ready="hydrated">
			<div class="auth-gate-icon" aria-hidden="true">🔐</div>
			<div>
				<h2 id="components-auth-title">Choose a demo identity first</h2>
				<p>Alice and Bob each have their own records. Pick one to unlock this RLS-protected CRUD workspace.</p>
				<div v-if="config.public.playgroundEnvironment === 'local'" class="auth-gate-actions">
					<button type="button" :disabled="authBusy || !hydrated" @click="useLocalAccount('alice')">Continue as Alice</button>
					<button type="button" :disabled="authBusy || !hydrated" @click="useLocalAccount('bob')">Continue as Bob</button>
				</div>
				<p v-if="authError" class="auth-gate-error" role="alert">{{ authError }}</p>
			</div>
		</section>

		<div v-else class="component-workspace" data-components-ready>
			<header class="workspace-header">
				<div>
					<p class="workspace-eyebrow">SIGNED IN AS</p>
					<strong>{{ user.email }}</strong>
				</div>
				<button type="button" @click="startCreate">+ New record</button>
			</header>

			<div class="component-demo-grid">
				<section class="form-card" aria-labelledby="record-form-title">
					<p class="panel-kicker">{{ selectedId ? 'EDITING' : 'CREATE' }}</p>
					<h2 id="record-form-title">{{ selectedId ? selectedTitle || 'Selected record' : 'New component record' }}</h2>
					<p class="panel-help">
						{{ selectedId ? 'Change the title below, then save.' : 'This focused demo asks only for a title; Supabase supplies the server defaults.' }}
					</p>

					<NsdbForm
						:key="`${user.id}-${selectedId ?? 'create'}-${formRevision}`"
						:id="selectedId"
						model="component_records"
						store
						:hide-fields="hiddenFormFields"
						@saved="saved"
						@error="failed"
					>
						<template #header />
						<template #actions="{ mode, saving, canSubmit }">
							<div class="form-actions">
								<button class="primary-action" type="submit" :disabled="saving || !canSubmit">
									{{ saving ? 'Saving…' : mode === 'create' ? 'Create record' : 'Save changes' }}
								</button>
								<button v-if="mode === 'edit'" type="button" @click="startCreate">Cancel</button>
							</div>
						</template>
					</NsdbForm>
					<DemoStatus :state="action.state.value" :message="action.label.value" :error="action.error.value" />
				</section>

				<section class="list-card" aria-labelledby="record-list-title">
					<p class="panel-kicker">SHARED STORE</p>
					<h2 id="record-list-title">Your records</h2>
					<p class="panel-help">Select a title to edit it. Mutations from the form appear here without a manual refresh.</p>

					<NsdbList
						model="component_records"
						store
						searchable
						:columns="listColumns"
						:classes="listClasses"
						:search-columns="['title', 'notes']"
						:page-size="5"
						search-placeholder="Search your records"
					>
						<template #header />
						<template #cell="{ row, column, value }">
							<button
								v-if="column.key === 'title'"
								type="button"
								class="edit-record-button"
								:aria-label="`Edit ${value}`"
								@click="startEdit(row)"
							>
								{{ value }}
							</button>
							<span v-else-if="column.key === 'published'" class="status-dot" :data-active="row.published">
								{{ row.published ? 'Yes' : 'No' }}
							</span>
							<span v-else>{{ value || '—' }}</span>
						</template>
						<template #empty>
							<tr><td :colspan="listColumns.length + 1" class="playground-table-message">No records yet. Create the first one.</td></tr>
						</template>
					</NsdbList>
				</section>
			</div>

		</div>

		<template #code>
			<div class="demo-grid">
				<CodeSnippet title="A focused generic list" :code="listSnippet" />
				<CodeSnippet title="A focused generic form" :code="formSnippet" />
			</div>
			<DocumentationLink path="/docs/components/nsdb-form" label="Read the NsdbForm guide" />
		</template>
	</DemoShell>
</template>

<style scoped>
.auth-gate { display: flex; align-items: center; gap: 1rem; min-height: 180px; padding: clamp(1.25rem, 4vw, 2.5rem); border: 1px dashed #4b5563; border-radius: .75rem; background: rgba(17, 24, 39, .55); }
.auth-gate-icon { font-size: 2rem; }
.auth-gate h2, .auth-gate p { margin: 0; }
.auth-gate p { max-width: 680px; margin-top: .55rem; color: var(--muted); line-height: 1.55; }
.auth-gate-actions { display: flex; flex-wrap: wrap; gap: .65rem; margin-top: 1rem; }
.auth-gate-error { color: #fca5a5 !important; }
.component-workspace { display: grid; gap: 1.25rem; }
.workspace-header { display: flex; justify-content: space-between; align-items: center; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border); }
.workspace-eyebrow, .panel-kicker { margin: 0 0 .35rem; color: var(--accent); font-size: .72rem; font-weight: 700; letter-spacing: .12em; }
.component-demo-grid { display: grid; grid-template-columns: minmax(260px, .72fr) minmax(0, 1.28fr); gap: 1.25rem; align-items: start; }
.form-card, .list-card { min-width: 0; border: 1px solid var(--border); border-radius: .75rem; background: #0b1220; padding: 1.25rem; }
.form-card h2, .list-card h2 { margin: 0; font-size: 1.25rem; }
.panel-help { min-height: 2.8em; margin: .45rem 0 1.25rem; color: var(--muted); font-size: .85rem; line-height: 1.45; }
.form-card :deep(form) { display: grid; gap: 1rem; }
.form-card :deep(form > div) { display: grid; gap: .4rem; }
.form-card :deep(input:not([type='checkbox'])), .form-card :deep(select), .form-card :deep(textarea) { width: 100%; border-color: #4b5563; background: #030712; color: #f9fafb; caret-color: #f9fafb; }
.form-card :deep(input::placeholder), .form-card :deep(textarea::placeholder) { color: #6b7280; opacity: 1; }
.form-card :deep(input:focus-visible), .form-card :deep(select:focus-visible), .form-card :deep(textarea:focus-visible) { border-color: #c084fc; outline: 3px solid rgba(192, 132, 252, .45); outline-offset: 2px; }
.form-card :deep(input:disabled), .form-card :deep(select:disabled), .form-card :deep(textarea:disabled), .form-card :deep(input[readonly]), .form-card :deep(textarea[readonly]) { background: #1f2937; color: #9ca3af; }
.form-card :deep(textarea) { min-height: 90px; resize: vertical; }
.form-actions { display: flex !important; flex-direction: row !important; flex-wrap: wrap; margin-top: .25rem; }
.primary-action { background: #7c3aed; border-color: #8b5cf6; }
.edit-record-button { padding: 0; border: 0; background: transparent; color: #d8b4fe; text-align: left; text-decoration: underline; text-underline-offset: 3px; }
.status-dot { display: inline-flex; align-items: center; gap: .35rem; }
.status-dot::before { content: ''; width: .5rem; height: .5rem; border-radius: 50%; background: #6b7280; }
.status-dot[data-active='true']::before { background: #34d399; }
:deep(.playground-list) { min-width: 0; }
:deep(.playground-list-toolbar) { display: flex; margin-bottom: 1rem; }
:deep(.playground-search) { width: min(100%, 360px); }
:deep(.playground-table-container) { width: 100%; overflow-x: auto; border: 1px solid var(--border); border-radius: .6rem; }
:deep(.playground-table) { width: 100%; min-width: 560px; border-collapse: collapse; }
:deep(.playground-table-head) { background: #172033; }
:deep(.playground-table-heading), :deep(.playground-table-actions-heading) { padding: .7rem .8rem; color: #d1d5db; font-size: .75rem; text-align: left; }
:deep(.playground-table-heading button) { padding: 0; border: 0; background: transparent; color: inherit; font-weight: 700; }
:deep(.playground-table-row) { border-top: 1px solid var(--border); }
:deep(.playground-table-row:hover) { background: rgba(55, 65, 81, .25); }
:deep(.playground-table-cell), :deep(.playground-table-actions), :deep(.playground-table-message) { padding: .75rem .8rem; text-align: left; }
:deep(.playground-table-actions) { width: 1%; white-space: nowrap; }
:deep(.playground-delete-button) { display: inline-flex; align-items: center; justify-content: center; color: #fca5a5; }
:deep(.playground-list-footer) { display: flex; justify-content: space-between; gap: .75rem; margin-top: .8rem; color: var(--muted); font-size: .8rem; }
:deep(.playground-pagination) { display: flex; gap: .35rem; }
:deep(.playground-page-button) { padding: .35rem .6rem; }
:deep(.playground-page-button-active) { border-color: var(--accent); }
:deep(.playground-page-button-disabled) { opacity: .45; }
:deep(.playground-list-error) { color: #fca5a5; }
@media (max-width: 900px) { .component-demo-grid { grid-template-columns: 1fr; } }
@media (max-width: 560px) { .workspace-header { align-items: flex-start; flex-direction: column; } .form-card, .list-card { padding: 1rem; } }
</style>
