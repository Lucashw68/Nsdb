<script setup lang="ts">
/**
 * Props simples :
 * - model: nom de table (clé côté nsdb/models)
 * - columns: [{ key, label, format? }]
 * - pageSize: nb d'éléments par page
 * - query: options passées à fetch() (orderBy, filters, etc.)
 */
type Column = { key: string; label: string; format?: (value: any, row: any) => string }

const props = defineProps<{
	model: string
	columns: Column[]
	pageSize?: number
	query?: Record<string, any>
}>()

const page = ref(1)
const loading = ref(false)
const rows = ref<any[]>([])
const total = ref<number | null>(null)
const error = ref<string | null>(null)

// composable runtime du module
const { useModel } = useSupabaseModels()
const model = useModel(props.model) // expose .fetch(), .items? selon ton impl.

async function load() {
	loading.value = true
	error.value = null
	try {
		const { items, count } = await model.fetch({
			page: page.value,
			pageSize: props.pageSize ?? 20,
			...(props.query ?? {})
		})
		rows.value = items ?? []
		total.value = count ?? null
	} catch (e: any) {
		error.value = e?.message ?? 'Erreur de chargement'
		rows.value = []
		total.value = null
	} finally {
		loading.value = false
	}
}

watch(() => [props.model, props.pageSize, props.query, page.value], load, { immediate: true })
</script>

<template>
	<div class="w-full space-y-3">
		<div class="flex items-center justify-between">
			<h3 class="text-lg font-semibold">Liste: {{ model }}</h3>
			<div class="text-sm opacity-70" v-if="total !== null">{{ total }} éléments</div>
		</div>

		<div v-if="error" class="text-sm text-red-600">{{ error }}</div>

		<div class="overflow-x-auto border rounded-2xl">
			<table class="min-w-full text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th v-for="c in columns" :key="c.key" class="text-left px-4 py-2 font-medium">
							{{ c.label }}
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-if="loading">
						<td :colspan="columns.length" class="px-4 py-6 text-center">Chargement…</td>
					</tr>
					<tr v-else-if="rows.length === 0">
						<td :colspan="columns.length" class="px-4 py-6 text-center">Aucun résultat</td>
					</tr>
					<tr v-else v-for="row in rows" :key="row.id" class="border-t">
						<td v-for="c in columns" :key="c.key" class="px-4 py-2">
							{{ c.format ? c.format(row[c.key], row) : row[c.key] }}
						</td>
					</tr>
				</tbody>
			</table>
		</div>

		<div class="flex items-center gap-2">
			<button class="px-3 py-1 rounded-xl border" :disabled="page===1" @click="page--">Précédent</button>
			<span class="text-sm">Page {{ page }}</span>
			<button class="px-3 py-1 rounded-xl border" @click="page++">Suivant</button>
		</div>
	</div>
</template>
