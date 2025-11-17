<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useSupabaseModel } from '#imports'

type Column = {
	key: string
	label: string
	format?: (value: any, row: any) => string
}

const props = defineProps<{
	model: string
	columns?: Column[]
	pageSize?: number
}>()

const loading = ref(false)
const error = ref<string | null>(null)

// ✅ on renomme pour ne pas masquer props.model
const nsdbModel = useSupabaseModel<any>(props.model, { store: false })

const rows = computed(() => nsdbModel.items.value)

async function load() {
	loading.value = true
	error.value = null
	try {
		await nsdbModel.fetch()
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
</script>

<template>
	<div class="w-full space-y-3">
		<div class="flex items-center justify-between">
			<!-- ✅ on affiche bien la prop -->
			<h3 class="text-lg font-semibold">Liste: {{ props.model }}</h3>
			<div class="text-sm opacity-70" v-if="rows.length">{{ rows.length }} éléments</div>
		</div>

		<div v-if="error" class="text-sm text-red-600">{{ error }}</div>

		<div class="overflow-x-auto border rounded-2xl">
			<table class="min-w-full text-sm">
				<thead class="bg-gray-50">
					<tr>
						<th
							v-for="column in effectiveColumns"
							:key="column.key"
							class="text-left px-4 py-2 font-medium"
						>
							{{ column.label }}
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-if="loading">
						<td :colspan="effectiveColumns.length || 1" class="px-4 py-6 text-center">
							Chargement…
						</td>
					</tr>

					<tr v-else-if="rows.length === 0">
						<td :colspan="effectiveColumns.length || 1" class="px-4 py-6 text-center">
							Aucun résultat
						</td>
					</tr>

					<tr v-else v-for="row in rows" :key="row.id ?? JSON.stringify(row)" class="border-t">
						<td
							v-for="column in effectiveColumns"
							:key="column.key"
							class="px-4 py-2"
						>
							{{ column.format ? column.format(row[column.key], row) : row[column.key] }}
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>