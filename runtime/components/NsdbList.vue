<script setup lang="ts">
import { ref, watch, computed, onBeforeUnmount, onMounted, useId } from 'vue'
import { useSupabaseUser } from '#imports'
import { useNsdbModel } from '#build/nsdb/registry'
import * as nsdbSchemas from '#build/nsdb/schemas'
import type { Column, NsdbTableClasses, OrderDirection, SortState, WhereClause } from '@lucashw68/nsdb/types/list'

const defaultClasses: NsdbTableClasses = {
	wrapper: 'w-full space-y-3',
	headerWrapper: 'flex items-center justify-between',
	headerTitle: 'text-lg font-semibold capitalize mb-2',
	headerSubtitle: 'text-sm opacity-70',
	toolbar: 'flex flex-col md:flex-row md:items-center gap-2',
	searchInput: 'border text-black rounded px-3 py-2 w-full md:max-w-xs text-sm',
	error: 'text-sm text-red-600',
	tableContainer: 'border w-full overflow-x-auto',
	table: 'nsdb-table w-full text-sm',
	thead: 'bg-gray-50',
	theadRow: 'border-2 border-white',
	th: 'text-left text-black px-4 py-2 font-bold hover:cursor-pointer hover:text-purple-500 hover:bg-gray-200 hover:rounded-lg',
	actionsTh: 'text-black',
	loadingCell: 'px-4 py-6 text-center',
	emptyCell: 'px-4 py-6 text-center',
	bodyRow: 'border-t hover:bg-gray-400 hover:cursor-pointer',
	td: 'py-2 px-4 text-center border-2 border-white',
	actionsTd: 'flex items-center gap-2 py-2 px-4 justify-center',
	deleteButton: 'flex items-center rounded-full hover:bg-gray-600 px-2 py-1',
	footer: 'w-full flex flex-col md:flex-row md:justify-between md:items-center gap-2 mt-2',
	pagination: 'flex flex-wrap items-center gap-2',
	pageButton: 'px-3 py-1 rounded border text-sm',
	pageButtonActive: 'font-bold',
	pageButtonDisabled: 'opacity-40 cursor-not-allowed',
}

const props = defineProps<{
	model: string
	columns?: Column[]
	pageSize?: number
	query?: {
		select?: string
		where?: WhereClause
		orderBy?: string
		orderDirection?: OrderDirection
		orderForeignTable?: string
		limit?: number
		offset?: number
		search?: string
		searchColumns?: string[]
	}
	filters?: WhereClause
	sortBy?: string
	sortDirection?: OrderDirection
	classes?: Partial<NsdbTableClasses>
	unstyled?: boolean
	variant?: 'table' | 'cards'
	pageWindow?: number
	showFirstLast?: boolean
	showPageNumbers?: boolean
	searchable?: boolean
	search?: string
	searchColumns?: string[]
	searchPlaceholder?: string
	searchDebounceMs?: number
	store?: boolean
}>()

const loading = ref(false)
const error = ref<string | null>(null)

type NsdbListModel = {
	primaryKey?: string
	items: { value?: Array<Record<string, any>> }
	totalCount?: { value?: number | null }
	fetch: (query?: Record<string, any>) => Promise<Array<Record<string, any>>>
	remove?: (id: string | number) => Promise<void> | void
}

const nsdbModel = computed(() =>
	useNsdbModel(props.model, { store: props.store ?? false }) as unknown as NsdbListModel
)
const supabaseUser = useSupabaseUser()
const rows = computed(() => nsdbModel.value.items.value ?? [])
const totalCount = computed<number | null>(() => {
	return (nsdbModel.value as any)?.totalCount?.value ?? null
})

const currentPage = ref(1)

const pageSize = computed<number | undefined>(() => {
	if (props.pageSize != null) return props.pageSize
	return undefined
})

const effectiveLimit = computed<number>(() => {
	const baseQuery = props.query ?? {}
	return pageSize.value ?? baseQuery.limit ?? 100
})

const effectiveOffset = computed<number>(() => {
	const baseQuery = props.query ?? {}
	return baseQuery.offset ?? (currentPage.value - 1) * effectiveLimit.value
})

const totalPages = computed<number | null>(() => {
	if (!pageSize.value) return null
	if (totalCount.value == null) return null
	return Math.max(1, Math.ceil(totalCount.value / pageSize.value))
})

const classes = computed<NsdbTableClasses>(() => {
	if (props.unstyled) {
		return Object.keys(defaultClasses).reduce((acc, key) => {
			acc[key as keyof NsdbTableClasses] = ''
			return acc
		}, {} as NsdbTableClasses)
	}

	return {
		...defaultClasses,
		...(props.classes ?? {}),
	}
})

const canGoPrev = computed(() => currentPage.value > 1)

const canGoNext = computed(() => {
	if (totalPages.value != null) return currentPage.value < totalPages.value
	if (!pageSize.value) return rows.value.length > 0
	return rows.value.length === pageSize.value
})

const pageWindow = computed(() => props.pageWindow ?? 2)
const showFirstLast = computed(() => props.showFirstLast ?? true)
const showPageNumbers = computed(() => props.showPageNumbers ?? true)
const searchTerm = ref(props.search ?? '')
const debouncedSearchTerm = ref(props.search ?? '')
let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null
let loadSequence = 0
let isMounted = false
const deletingRows = ref(new Set<string | number>())
const searchInputId = `nsdb-list-${useId().replace(/[^a-zA-Z0-9_-]/g, '')}-search`

const pageItems = computed<(number | '...')[]>(() => {
	if (!showPageNumbers.value) return []
	if (totalPages.value == null) return []

	const tp = totalPages.value
	const cp = currentPage.value
	const w = Math.max(0, pageWindow.value)

	if (tp <= 1) return [1]
	if (tp <= 2 + 2 * w + 2) {
		return Array.from({ length: tp }, (_, i) => i + 1)
	}

	const items: (number | '...')[] = []
	const start = Math.max(2, cp - w)
	const end = Math.min(tp - 1, cp + w)

	items.push(1)

	if (start > 2) items.push('...')
	for (let p = start; p <= end; p++) items.push(p)
	if (end < tp - 1) items.push('...')

	items.push(tp)
	return items
})

const effectiveColumns = computed<Column[]>(() => {
	if (props.columns && props.columns.length > 0) {
		props.columns.forEach(column => {
			if (typeof column.key !== 'string') {
				console.warn('[NsdbList] column.key should be a string, got:', column.key)
			}
		})
		return props.columns
	}
	const schema = modelSchema.value
	if (schema) {
		return Object.entries(schema)
			.filter(([, field]) => field?.selectable !== false && !field?.hidden && !field?.serverOnly)
			.map(([key, field]) => ({ key, label: field?.label ?? key }))
	}

	const first = rows.value[0]
	if (!first) return []
	return Object.keys(first).map(key => ({ key, label: key }))
})

function toPascalCase(value: string) {
	return value
		.split(/[^a-zA-Z0-9]/)
		.filter(Boolean)
		.map(part => part.charAt(0).toUpperCase() + part.slice(1))
		.join('')
}

const modelSchema = computed<Record<string, any> | null>(() => {
	const schemaExportName = `${toPascalCase(props.model)}Schema`
	return (nsdbSchemas as Record<string, any>)[schemaExportName] ?? null
})

function isTextSearchColumn(columnKey: string, warn = false) {
	const schema = modelSchema.value
	if (!schema) return true
	if (columnKey.includes('.')) return true

	const field = schema[columnKey]
	if (!field) return true

	const isTextField = field.type === 'text' || field.type === 'textarea'
	if (!isTextField && warn) {
		console.warn(
			`[NsdbList] "${columnKey}" ignored from searchColumns on "${props.model}" because its schema type is "${field.type}". Use filters for non-text columns.`
		)
	}

	return isTextField
}

function isSortableColumn(columnKey: string) {
	if (columnKey.includes('.')) {
		console.warn(
			`[NsdbList] "${columnKey}" cannot be sorted automatically because it is a relation path. Configure query.orderBy/orderForeignTable manually if needed.`
		)
		return false
	}

	return true
}

const effectiveSearchColumns = computed(() => {
	if (props.searchColumns?.length) {
		return props.searchColumns.filter(column => isTextSearchColumn(column, true))
	}

	if (props.query?.searchColumns?.length) {
		return props.query.searchColumns.filter(column => isTextSearchColumn(column, true))
	}

	return effectiveColumns.value
		.map(column => column.key)
		.filter(columnKey => !columnKey.includes('.'))
		.filter(column => isTextSearchColumn(column))
})

const effectiveSearch = computed(() => {
	const localSearch = debouncedSearchTerm.value.trim()
	if (localSearch) return localSearch
	return props.query?.search ?? ''
})

function setSearchTerm(value: string) {
	searchTerm.value = value
}

const sortState = ref<SortState>({
	key: props.sortBy ?? null,
	direction: props.sortBy ? props.sortDirection ?? 'asc' : null,
})

async function setSort(key: string | null, direction: OrderDirection | null = 'asc') {
	if (key && !isSortableColumn(key)) return

	sortState.value = { key, direction: key ? direction : null }
	currentPage.value = 1
	await load()
}

function sortAriaValue(column: Column) {
	if (sortState.value.key !== column.key || !sortState.value.direction) return 'none'
	return sortState.value.direction === 'asc' ? 'ascending' : 'descending'
}

async function toggleSort(column: Column) {
	if (sortState.value.key !== column.key) {
		await setSort(column.key, 'asc')
		return
	}

	if (sortState.value.direction === 'asc') {
		await setSort(column.key, 'desc')
		return
	}

	await setSort(null, null)
}

function getDeep(row: any, path: unknown) {
	if (!row || path == null) return null

	if (Array.isArray(path)) {
		let current: any = row
		for (const part of path) {
			if (current == null) return null
			current = current[part as keyof typeof current]
		}
		return current
	}

	if (typeof path !== 'string') {
		console.warn('[NsdbList.getDeep] path is not a string:', path, 'typeof =', typeof path)
		return null
	}

	const segments = path.split('.')
	let current: any = row
	for (const segment of segments) {
		if (current == null) return null
		current = current[segment as keyof typeof current]
	}
	return current
}

const effectiveWhere = computed<WhereClause | undefined>(() => {
	const mergedWhere = {
		...(props.query?.where ?? {}),
		...(props.filters ?? {}),
	}

	return Object.keys(mergedWhere).length > 0 ? mergedWhere : undefined
})

const serverQuery = computed(() => {
	const baseQuery = props.query ?? {}

	// Requête unique consommée par le modèle: recherche, filtres, tri et pagination restent côté Supabase.
	return {
		...baseQuery,
		where: effectiveWhere.value,
		orderBy: sortState.value.key ?? props.sortBy ?? baseQuery.orderBy,
		orderDirection: sortState.value.direction ?? props.sortDirection ?? baseQuery.orderDirection,
		limit: effectiveLimit.value,
		offset: effectiveOffset.value,
		search: effectiveSearch.value || undefined,
		searchColumns: effectiveSearchColumns.value,
	}
})

const displayRows = computed(() => rows.value)
const hasRows = computed(() => displayRows.value.length > 0)
const isEmpty = computed(() => !loading.value && !error.value && !hasRows.value)
const emptyMessage = computed(() => effectiveSearch.value ? 'Aucun résultat pour cette recherche' : 'Aucune donnée')
const paginationSlotProps = computed(() => ({
	currentPage: currentPage.value,
	pageSize: effectiveLimit.value,
	limit: effectiveLimit.value,
	offset: effectiveOffset.value,
	totalCount: totalCount.value,
	totalPages: totalPages.value,
	canGoPrev: canGoPrev.value,
	canGoNext: canGoNext.value,
	pageItems: pageItems.value,
	showFirstLast: showFirstLast.value,
	showPageNumbers: showPageNumbers.value,
	goToPage,
	firstPage: handleFirstPage,
	lastPage: handleLastPage,
	prevPage: handlePrevPage,
	nextPage: handleNextPage,
}))

async function load() {
	const requestId = ++loadSequence
	loading.value = true
	error.value = null

	try {
		if (typeof (nsdbModel.value as any).fetch === 'function') {
			await (nsdbModel.value as any).fetch(serverQuery.value)
		} else {
			console.warn('[NsdbList] No fetch() found on nsdbModel for', props.model)
		}
	} catch (e: any) {
		if (requestId !== loadSequence) return
		error.value = e?.message ?? 'Erreur de chargement'
	} finally {
		if (requestId === loadSequence) loading.value = false
	}
}

defineExpose({ refresh: load })

async function goToPage(page: number) {
	const tp = totalPages.value
	let target = page

	if (target < 1) target = 1
	if (tp != null && target > tp) target = tp

	if (target === currentPage.value) return
	currentPage.value = target
	await load()
}

async function handlePrevPage() {
	if (!canGoPrev.value) return
	await goToPage(currentPage.value - 1)
}

async function handleNextPage() {
	if (!canGoNext.value) return
	await goToPage(currentPage.value + 1)
}

async function handleFirstPage() {
	await goToPage(1)
}

async function handleLastPage() {
	if (totalPages.value == null) return
	await goToPage(totalPages.value)
}

watch(
	() => [
		props.model,
		props.pageSize,
		props.query,
		props.filters,
		props.searchColumns,
	],
	() => {
		currentPage.value = 1
		if (isMounted) void load()
	},
	{ deep: true }
)

watch(
	() => [props.sortBy, props.sortDirection] as const,
	([sortBy, sortDirection]) => {
		sortState.value = {
			key: sortBy ?? null,
			direction: sortBy ? sortDirection ?? 'asc' : null,
		}
		currentPage.value = 1
		if (isMounted) void load()
	}
)

watch(
	() => props.search,
	(searchValue) => {
		searchTerm.value = searchValue ?? ''
	}
)

watch(
	() => supabaseUser.value?.id ?? null,
	() => {
		// Quarantine rendered rows synchronously across logout/account switches.
		const modelItems = nsdbModel.value.items
		if (modelItems && 'value' in modelItems) modelItems.value = []
		currentPage.value = 1
		if (isMounted) void load()
	},
	{ flush: 'sync' },
)

watch(
	searchTerm,
	(searchValue) => {
		if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout)

		searchDebounceTimeout = setTimeout(() => {
			debouncedSearchTerm.value = searchValue
			currentPage.value = 1
			if (isMounted) void load()
		}, props.searchDebounceMs ?? 300)
	}
)

onMounted(() => {
	isMounted = true
	void load()
})

onBeforeUnmount(() => {
	isMounted = false
	if (searchDebounceTimeout) clearTimeout(searchDebounceTimeout)
	loadSequence++
})

async function handleDelete(row: any) {
	const id = row?.[nsdbModel.value.primaryKey ?? 'id']
	if (id == null) return
	if (deletingRows.value.has(id)) return

	try {
		deletingRows.value.add(id)
		if (typeof (nsdbModel.value as any).remove === 'function') {
			await (nsdbModel.value as any).remove(id)
		} else {
			console.warn('[NsdbList] No remove() method found on nsdbModel for', props.model)
			return
		}

		if (totalPages.value != null && currentPage.value > totalPages.value) {
			currentPage.value = totalPages.value
		}

		await load()
	} catch (e: any) {
		console.error('[NsdbList] Error while deleting row:', e)
		error.value = e?.message ?? 'Erreur de suppression'
	} finally {
		deletingRows.value.delete(id)
	}
}

function displayValue(value: unknown) {
	if (value == null || value === '') return 'Inconnu'
	if (Array.isArray(value)) return value.length === 0 ? '—' : `${value.length} élément${value.length > 1 ? 's' : ''}`
	if (typeof value === 'object') {
		const record = value as Record<string, unknown>
		for (const key of ['label', 'name', 'title']) {
			if (record[key] != null) return String(record[key])
		}
		return '1 élément'
	}
	if (typeof value === 'boolean') return value ? 'Oui' : 'Non'
	return String(value)
}

function rowKey(row: Record<string, any>) {
	return row?.[nsdbModel.value.primaryKey ?? 'id'] ?? JSON.stringify(row)
}
</script>

<template>
	<slot
		:model="props.model"
		:rows="displayRows"
		:raw-rows="rows"
		:has-rows="hasRows"
		:is-empty="isEmpty"
		:columns="effectiveColumns"
		:loading="loading"
		:error="error"
		:query="serverQuery"
		:filters="effectiveWhere"
		:sort-state="sortState"
		:set-sort="setSort"
		:current-page="currentPage"
		:page-size="effectiveLimit"
		:limit="effectiveLimit"
		:offset="effectiveOffset"
		:total-count="totalCount"
		:total-pages="totalPages"
		:can-go-prev="canGoPrev"
		:can-go-next="canGoNext"
		:page-items="pageItems"
		:show-first-last="showFirstLast"
		:show-page-numbers="showPageNumbers"
		:pagination="paginationSlotProps"
		:go-to-page="goToPage"
		:first-page="handleFirstPage"
		:last-page="handleLastPage"
		:prev-page="handlePrevPage"
		:next-page="handleNextPage"
		:delete-row="handleDelete"
		:search="searchTerm"
		:search-columns="effectiveSearchColumns"
		:set-search="setSearchTerm"
		:refresh="load"
	>
		<div :class="classes.wrapper" :aria-busy="loading ? 'true' : 'false'">
			<div :class="classes.headerWrapper">
				<slot
					name="header"
					:model="props.model"
					:rows="rows"
					:has-rows="hasRows"
					:is-empty="isEmpty"
					:loading="loading"
					:error="error"
					:query="serverQuery"
					:filters="effectiveWhere"
					:sort-state="sortState"
					:columns="effectiveColumns"
					:current-page="currentPage"
					:total-count="totalCount"
					:total-pages="totalPages"
				>
					<div>
						<h3 :class="classes.headerTitle">
							{{ props.model }}
						</h3>
						<div v-if="totalCount != null" :class="classes.headerSubtitle">
							{{ totalCount }} éléments
							<span v-if="totalPages"> - page {{ currentPage }} / {{ totalPages }}</span>
						</div>
						<div v-else-if="rows.length" :class="classes.headerSubtitle">
							{{ rows.length }} éléments (page {{ currentPage }})
						</div>
					</div>
				</slot>
			</div>

			<slot
				name="toolbar"
				:search="searchTerm"
				:search-columns="effectiveSearchColumns"
				:set-search="setSearchTerm"
				:query="serverQuery"
				:filters="effectiveWhere"
				:sort-state="sortState"
				:set-sort="setSort"
				:refresh="load"
			>
				<div v-if="props.searchable" :class="classes.toolbar">
					<label :for="searchInputId" class="sr-only">Rechercher dans {{ props.model }}</label>
					<input
						:id="searchInputId"
						v-model="searchTerm"
						type="search"
						:class="classes.searchInput"
						:placeholder="props.searchPlaceholder ?? 'Rechercher...'"
						:disabled="loading"
					/>
				</div>
			</slot>

			<slot name="error" v-if="error" :error="error">
				<div :class="classes.error" role="alert" aria-live="polite">
					{{ error }}
				</div>
			</slot>

			<div v-if="props.variant === 'cards'">
				<template v-if="loading">
					<slot name="loading" :columns="effectiveColumns">
						<div :class="classes.loadingCell">Chargement...</div>
					</slot>
				</template>

				<template v-else-if="!error && displayRows.length === 0">
					<slot
						name="empty"
						:model="props.model"
						:rows="displayRows"
						:raw-rows="rows"
						:columns="effectiveColumns"
						:loading="loading"
						:error="error"
						:query="serverQuery"
						:filters="effectiveWhere"
						:search="searchTerm"
						:search-columns="effectiveSearchColumns"
						:refresh="load"
					>
						<div :class="classes.emptyCell">
							{{ emptyMessage }}
						</div>
					</slot>
				</template>

				<template v-else>
					<slot name="cards" :rows="displayRows" :columns="effectiveColumns" :query="serverQuery">
						<div class="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-3">
							<div
								v-for="row in displayRows"
								:key="rowKey(row)"
								class="border rounded-lg p-4 shadow-sm bg-white"
							>
								<slot name="card" :row="row" :columns="effectiveColumns">
									<div
										v-for="column in effectiveColumns"
										:key="column.key"
										class="text-sm text-black mb-1"
									>
										<span class="font-semibold mr-1">{{ column.label }}:</span>
										<span>
											{{
												column.format
													? column.format(getDeep(row, column.key), row)
											: displayValue(getDeep(row, column.key))
											}}
										</span>
									</div>

									<button
										type="button"
										class="mt-2 text-xs text-red-500 underline"
										@click="handleDelete(row)"
									>
										Supprimer
									</button>
								</slot>
							</div>
						</div>
					</slot>
				</template>
			</div>

			<div v-else :class="classes.tableContainer">
				<table :class="classes.table">
					<thead :class="classes.thead">
						<slot name="thead" :columns="effectiveColumns">
							<tr :class="classes.theadRow">
								<th
									v-for="column in effectiveColumns"
									:key="column.key"
									:class="classes.th"
									:aria-sort="sortAriaValue(column)"
								>
									<slot
										name="th"
										:column="column"
										:sort-key="sortState.key"
										:sort-direction="sortState.direction"
										:sort-state="sortState"
										:set-sort="setSort"
										:toggle-sort="() => toggleSort(column)"
									>
										<button
											type="button"
											class="w-full text-left"
											:aria-label="`Trier par ${column.label}`"
											@click="toggleSort(column)"
										>
											{{ column.label }}
											<span v-if="sortState.key === column.key" aria-hidden="true">
												<span v-if="sortState.direction === 'asc'">▲</span>
												<span v-else-if="sortState.direction === 'desc'">▼</span>
											</span>
										</button>
									</slot>
								</th>

								<th :class="classes.actionsTh">Actions</th>
							</tr>
						</slot>
					</thead>

					<tbody>
						<template v-if="loading">
							<slot name="loading" :columns="effectiveColumns">
								<tr>
									<td :colspan="effectiveColumns.length + 1" :class="classes.loadingCell">
										Chargement...
									</td>
								</tr>
							</slot>
						</template>

						<template v-else-if="!error && displayRows.length === 0">
							<slot
								name="empty"
								:model="props.model"
								:rows="displayRows"
								:raw-rows="rows"
								:columns="effectiveColumns"
								:loading="loading"
								:error="error"
								:query="serverQuery"
								:filters="effectiveWhere"
								:search="searchTerm"
								:search-columns="effectiveSearchColumns"
								:refresh="load"
							>
								<tr>
									<td :colspan="effectiveColumns.length + 1" :class="classes.emptyCell">
										{{ emptyMessage }}
									</td>
								</tr>
							</slot>
						</template>

						<template v-else>
							<slot name="body" :rows="displayRows" :columns="effectiveColumns" :query="serverQuery">
								<tr
									v-for="row in displayRows"
									:key="rowKey(row)"
									:class="classes.bodyRow"
								>
									<td
										v-for="column in effectiveColumns"
										:key="column.key"
										:class="classes.td"
									>
										<slot
											name="cell"
											:row="row"
											:column="column"
											:value="
												column.format
													? column.format(getDeep(row, column.key), row)
											: displayValue(getDeep(row, column.key))
											"
										>
											{{
												column.format
													? column.format(getDeep(row, column.key), row)
											: displayValue(getDeep(row, column.key))
											}}
										</slot>
									</td>

									<td :class="classes.actionsTd">
										<button
											type="button"
											aria-label="Supprimer la ligne"
											:disabled="deletingRows.has(row?.[nsdbModel.primaryKey ?? 'id'])"
											@click="handleDelete(row)"
											:class="classes.deleteButton"
										>
											<Icon name="mdi:trash" class="w-4 h-4 text-red-500" />
										</button>
									</td>
								</tr>
							</slot>
						</template>
					</tbody>
				</table>
			</div>

			<div :class="classes.footer">
				<slot
					name="footer"
					:rows="displayRows"
					:columns="effectiveColumns"
					:model="props.model"
					:query="serverQuery"
					:filters="effectiveWhere"
					:sort-state="sortState"
					:set-sort="setSort"
					:current-page="currentPage"
					:page-size="effectiveLimit"
					:limit="effectiveLimit"
					:offset="effectiveOffset"
					:total-count="totalCount"
					:total-pages="totalPages"
					:can-go-prev="canGoPrev"
					:can-go-next="canGoNext"
					:go-to-page="goToPage"
					:first-page="handleFirstPage"
					:last-page="handleLastPage"
					:prev-page="handlePrevPage"
					:next-page="handleNextPage"
					:page-items="pageItems"
					:show-first-last="showFirstLast"
					:show-page-numbers="showPageNumbers"
					:pagination="paginationSlotProps"
				>
					<div class="text-sm opacity-70">
						Page {{ currentPage }}
						<span v-if="totalPages"> / {{ totalPages }}</span>
						<span v-if="totalCount != null"> - {{ totalCount }} éléments</span>
					</div>

					<slot
						name="pagination"
						:rows="displayRows"
						:model="props.model"
						:loading="loading"
						:current-page="currentPage"
						:page-size="effectiveLimit"
						:limit="effectiveLimit"
						:offset="effectiveOffset"
						:total-count="totalCount"
						:total-pages="totalPages"
						:can-go-prev="canGoPrev"
						:can-go-next="canGoNext"
						:page-items="pageItems"
						:show-first-last="showFirstLast"
						:show-page-numbers="showPageNumbers"
						:go-to-page="goToPage"
						:first-page="handleFirstPage"
						:last-page="handleLastPage"
						:prev-page="handlePrevPage"
						:next-page="handleNextPage"
						:pagination="paginationSlotProps"
					>
						<div :class="classes.pagination">
							<button
								v-if="showFirstLast && totalPages"
								type="button"
								:class="[classes.pageButton, (!canGoPrev || loading) && classes.pageButtonDisabled]"
								:disabled="!canGoPrev || loading"
								@click="handleFirstPage"
							>
								Première
							</button>

							<button
								type="button"
								:class="[classes.pageButton, (!canGoPrev || loading) && classes.pageButtonDisabled]"
								:disabled="!canGoPrev || loading"
								@click="handlePrevPage"
							>
								Précédent
							</button>

							<template v-if="showPageNumbers && totalPages">
								<template v-for="it in pageItems" :key="String(it) + '-' + currentPage">
									<span v-if="it === '...'" class="px-2 opacity-60">...</span>
									<button
										v-else
										type="button"
										:class="[
											classes.pageButton,
											it === currentPage && classes.pageButtonActive,
											loading && classes.pageButtonDisabled
										]"
										:disabled="loading"
										@click="goToPage(it)"
									>
										{{ it }}
									</button>
								</template>
							</template>

							<button
								type="button"
								:class="[classes.pageButton, (!canGoNext || loading) && classes.pageButtonDisabled]"
								:disabled="!canGoNext || loading"
								@click="handleNextPage"
							>
								Suivant
							</button>

							<button
								v-if="showFirstLast && totalPages"
								type="button"
								:class="[classes.pageButton, (!canGoNext || loading) && classes.pageButtonDisabled]"
								:disabled="!canGoNext || loading"
								@click="handleLastPage"
							>
								Dernière
							</button>
						</div>
					</slot>
				</slot>
			</div>
		</div>
	</slot>
</template>

<style scoped>
@reference "tailwindcss";

.nsdb-table {
	width: 100% !important;
	max-width: 100%;
	table-layout: auto;
	width: -webkit-fill-available;
	width: -moz-available;
	width: stretch;
	max-width: 100%;
}
</style>
