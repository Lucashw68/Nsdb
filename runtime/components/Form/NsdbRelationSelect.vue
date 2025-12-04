<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useNsdbModel } from '~~/nsdb/composables/useNsdbModels'
import type { EntityRelation } from '@lucashw68/nsdb/types/entities'

type Primitive = string | number | null

const props = defineProps<{
	relation: EntityRelation
	value: Primitive | Record<string, any> // peut être un payload d'inline-create
	disabled?: boolean
	placeholder?: string
}>()

const emit = defineEmits<{
	(e: 'update:value', value: Primitive | Record<string, any>): void
}>()

const loading = ref(false)
const error = ref<string | null>(null)

const allowInlineCreate = computed(
	() => !!props.relation.allowInlineCreate
)

// Mode : sélection existante / création inline
const mode = ref<'select' | 'create'>('select')
const newLabel = ref('')

// DX handle sur le modèle référencé (ex: playlists, profiles…)
const relatedModel = useNsdbModel(props.relation.referencedTable, { store: false })

// items : Ref<any[]>
const rows = computed<any[]>(() => {
	const raw = relatedModel.items
	return Array.isArray(raw?.value) ? raw.value : (Array.isArray(raw) ? raw : [])
})

// valueField : clé utilisée comme valeur (id par défaut)
const valueField = computed(() => {
	if (props.relation.referencedColumns?.length) {
		return props.relation.referencedColumns[0]
	}
	return 'id'
})

// labelField : champ utilisé pour afficher l’option & créer inline
const labelField = computed(() => {
	if (props.relation.displayField) return props.relation.displayField
	return valueField.value
})

const options = computed(() => {
	return rows.value.map((row: any) => ({
		value: row?.[valueField.value] ?? null,
		label: String(row?.[labelField.value] ?? row?.[valueField.value] ?? 'Inconnu'),
	}))
})

async function load() {
	loading.value = true
	error.value = null

	try {
		await relatedModel.all({
			limit: 200,
			orderBy: { [valueField.value]: 'asc' },
		})
	} catch (e: any) {
		console.error('[NsdbRelationSelect] load error:', e)
		error.value = e?.message ?? 'Erreur de chargement des options'
	} finally {
		loading.value = false
	}
}

function onSelectChange(event: Event) {
	const target = event.target as HTMLSelectElement
	const raw = target.value
	const nextValue: Primitive = raw === '' ? null : raw
	emit('update:value', nextValue)
}

// Payload spécial pour l’inline-create
const inlineCreatePayload = computed<Record<string, any> | null>(() => {
	if (!allowInlineCreate.value) return null
	if (!props.relation.displayField) {
		console.warn(
			'[NsdbRelationSelect] inline create requires relation.displayField'
		)
		return null
	}
	const label = newLabel.value?.trim()
	if (!label) return null

	return {
		__nsdbInlineCreate: true,
		table: props.relation.referencedTable,
		displayField: props.relation.displayField,
		data: {
			[props.relation.displayField]: label,
		},
	}
})

function onCreateInput(event: Event) {
	const target = event.target as HTMLInputElement
	newLabel.value = target.value

	const payload = inlineCreatePayload.value
	if (!payload) {
		emit('update:value', null)
		return
	}

	emit('update:value', payload)
}

function switchToSelect() {
	mode.value = 'select'
	// si on repasse en select, on remet juste la valeur primitive
	if (typeof props.value === 'object' && props.value !== null) {
		emit('update:value', null)
	}
}

function switchToCreate() {
	if (!allowInlineCreate.value) return
	mode.value = 'create'
}

onMounted(load)

watch(
	() => props.relation.referencedTable,
	() => load()
)
</script>

<template>
	<div class="space-y-1">
		<!-- Toggle Select / Create inline -->
		<div
			v-if="allowInlineCreate"
			class="flex items-center justify-end gap-2 text-xs text-gray-500 mb-1"
		>
			<button
				type="button"
				class="px-2 py-1 rounded border text-gray-700 hover:bg-gray-50"
				:class="{ 'bg-gray-100 font-semibold': mode === 'select' }"
				@click="switchToSelect"
			>
				Sélectionner
			</button>
			<button
				type="button"
				class="px-2 py-1 rounded border text-gray-700 hover:bg-gray-50"
				:class="{ 'bg-gray-100 font-semibold': mode === 'create' }"
				@click="switchToCreate"
			>
				Créer
			</button>
		</div>

		<!-- MODE SELECT -->
		<select
			v-if="mode === 'select' || !allowInlineCreate"
			class="border text-black rounded px-3 py-2 w-full text-sm"
			:disabled="disabled || loading"
			:value="typeof value === 'object' && value !== null ? '' : (value ?? '')"
			@change="onSelectChange"
		>
			<option value="">
				{{ placeholder || (loading ? 'Chargement…' : 'Sélectionner…') }}
			</option>

			<option
				v-for="opt in options"
				:key="opt.value ?? 'null'"
				:value="opt.value ?? ''"
			>
				{{ opt.label }}
			</option>
		</select>

		<!-- MODE CREATE INLINE -->
		<div v-else class="space-y-1">
			<input
				type="text"
				class="border text-black rounded px-3 py-2 w-full text-sm"
				:disabled="disabled || loading"
				:placeholder="placeholder || 'Créer un nouvel élément…'"
				:value="newLabel"
				@input="onCreateInput"
			/>
			<p class="text-[10px] text-gray-500">
				Un nouvel élément sera créé dans « {{ relation.referencedTable }} » et lié
				automatiquement.
			</p>
		</div>

		<p
			v-if="error"
			class="text-xs text-red-500"
		>
			{{ error }}
		</p>
	</div>
</template>
