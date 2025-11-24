<script setup lang="ts">
	import { ref, watch, computed } from 'vue'
	import { useNsdbModel } from '~~/nsdb/composables/useNsdbModels'

	type Column = {
		key: string
		label: string
		format?: (value: any, row: any) => string
	}

	type NsdbTableClasses = {
		wrapper: string
		headerWrapper: string
		headerTitle: string
		headerSubtitle: string
		error: string
		tableContainer: string
		table: string
		thead: string
		theadRow: string
		th: string
		actionsTh: string
		loadingCell: string
		emptyCell: string
		bodyRow: string
		td: string
		actionsTd: string
		deleteButton: string
		footer: string
	}

	const defaultClasses: NsdbTableClasses = {
		wrapper: 'w-full space-y-3',
		headerWrapper: 'flex items-center justify-between',
		headerTitle: 'text-lg font-semibold capitalize mb-2',
		headerSubtitle: 'text-sm opacity-70',
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
		footer: 'w-full flex justify-end items-center mt-2',
	}

	const props = defineProps<{
		model: string
		columns?: Column[]
		pageSize?: number
		classes?: Partial<NsdbTableClasses>
		unstyled?: boolean
	}>()

	const loading = ref(false)
	const error = ref<string | null>(null)

	const nsdbModel = useNsdbModel(props.model, { store: false })

	// données brutes, dans l'ordre d'origine
	const rows = computed(() => nsdbModel.items.value)

	// 🔽 état de tri
	const sortState = ref<{
		key: string | null
		direction: 'asc' | 'desc' | null
	}>({
		key: null,
		direction: null,
	})

	const classes = computed<NsdbTableClasses>(() => {
		if (props.unstyled) {
			// on renvoie toutes les clés vides pour laisser 100% la main
			return Object.keys(defaultClasses).reduce((acc, key) => {
				// @ts-expect-error: key est bien une clé de NsdbTableClasses
				acc[key] = ''
				return acc
			}, {} as NsdbTableClasses)
		}

		return {
			...defaultClasses,
			...(props.classes ?? {}),
		}
	})

	async function load() {
		loading.value = true
		error.value = null
		try {
			await nsdbModel.all()
		} catch (e: any) {
			error.value = e?.message ?? 'Erreur de chargement'
		} finally {
			loading.value = false
		}
	}

	watch(() => props.model, load, { immediate: true })

	const effectiveColumns = computed<Column[]>(() => {
		if (props.columns && props.columns.length > 0) return props.columns
		const first = rows.value[0]
		if (!first) return []
		return Object.keys(first).map(key => ({ key, label: key }))
	})

	// 🔽 toggle 3-états : none -> asc -> desc -> none
	function toggleSort(column: Column) {
		if (sortState.value.key !== column.key) {
			sortState.value = { key: column.key, direction: 'asc' }
			return
		}

		if (sortState.value.direction === 'asc') {
			sortState.value = { key: column.key, direction: 'desc' }
			return
		}

		// était 'desc' → on revient à l'origine (pas de tri)
		sortState.value = { key: null, direction: null }
	}

	// 🔽 rows triées (ou brutes si pas de tri)
	const sortedRows = computed(() => {
		const base = [...rows.value]

		const key = sortState.value.key
		const direction = sortState.value.direction

		if (!key || !direction) {
			return base
		}

		return base.sort((a, b) => {
			const av = a[key]
			const bv = b[key]

			// on convertit en string pour un tri "alpha" générique
			const astr = av == null ? '' : String(av).toLowerCase()
			const bstr = bv == null ? '' : String(bv).toLowerCase()

			const cmp = astr.localeCompare(bstr)
			return direction === 'asc' ? cmp : -cmp
		})
	})
</script>

<template>
	<div :class="classes.wrapper">
		<!-- HEADER -->
		<div :class="classes.headerWrapper">
			<slot
				name="header"
				:model="props.model"
				:rows="rows"
				:loading="loading"
				:error="error"
				:columns="effectiveColumns"
			>
				<!-- Default header -->
				<div>
					<h3 :class="classes.headerTitle">
						{{ props.model }}
					</h3>
					<div
						v-if="rows.length"
						:class="classes.headerSubtitle"
					>
						{{ rows.length }} éléments
					</div>
				</div>
			</slot>
		</div>

		<!-- ERROR -->
		<slot
			name="error"
			v-if="error"
			:error="error"
		>
			<div :class="classes.error">
				{{ error }}
			</div>
		</slot>

		<!-- TABLE -->
		<div :class="classes.tableContainer">
			<table :class="classes.table">
				<thead :class="classes.thead">
					<slot name="thead" :columns="effectiveColumns">
						<tr :class="classes.theadRow">
							<th
								v-for="column in effectiveColumns"
								:key="column.key"
								:class="classes.th"
								@click="toggleSort(column)"
							>
								<slot
									name="th"
									:column="column"
									:sort-key="sortState.key"
									:sort-direction="sortState.direction"
									:toggle-sort="() => toggleSort(column)"
								>
									{{ column.label }}
									<!-- petit indicateur basique par défaut -->
									<span v-if="sortState.key === column.key">
										<span v-if="sortState.direction === 'asc'">▲</span>
										<span v-else-if="sortState.direction === 'desc'">▼</span>
									</span>
								</slot>
							</th>

							<th :class="classes.actionsTh">
								Actions
							</th>
						</tr>
					</slot>
				</thead>

				<tbody>
					<!-- LOADING -->
					<template v-if="loading">
						<slot name="loading" :columns="effectiveColumns">
							<tr>
								<td
									:colspan="effectiveColumns.length || 1"
									:class="classes.loadingCell"
								>
									Chargement…
								</td>
							</tr>
						</slot>
					</template>

					<!-- EMPTY -->
					<template v-else-if="sortedRows.length === 0">
						<slot name="empty" :columns="effectiveColumns">
							<tr>
								<td
									:colspan="effectiveColumns.length || 1"
									:class="classes.emptyCell"
								>
									Aucun résultat
								</td>
							</tr>
						</slot>
					</template>

					<!-- BODY -->
					<template v-else>
						<!-- Slot "body" = contrôle total sur les lignes -->
						<slot
							name="body"
							:rows="sortedRows"
							:columns="effectiveColumns"
						>
							<!-- Fallback par défaut -->
							<tr
								v-for="row in sortedRows"
								:key="row.id ?? JSON.stringify(row)"
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
										:value="column.format ? column.format(row[column.key], row) : (row[column.key] ?? 'Inconnu')"
									>
										{{ column.format ? column.format(row[column.key], row) : row[column.key] ?? 'Inconnu' }}
									</slot>
								</td>

								<td :class="classes.actionsTd">
									<button
										@click="nsdbModel.remove(row.id)"
										:class="classes.deleteButton"
										type="button"
									>
										<Icon
											name="mdi:trash"
											class="w-4 h-4 text-red-500"
										/>
									</button>
								</td>
							</tr>
						</slot>
					</template>
				</tbody>
			</table>
		</div>

		<!-- FOOTER -->
		<div :class="classes.footer">
			<slot
				name="footer"
				:rows="rows"
				:columns="effectiveColumns"
				:model="props.model"
			>
				<div
					v-if="rows.length"
					class="text-sm opacity-70"
				>
					{{ rows.length }} éléments
				</div>
			</slot>
		</div>
	</div>
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
