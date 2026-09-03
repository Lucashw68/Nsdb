<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useSupabaseUser } from '#imports'
import { useNsdbModel } from '#build/nsdb/registry'
import type { EntityRelation } from '@lucashw68/nsdb/types/entities'

type Primitive = string | number | null

const props = defineProps<{
	relation: EntityRelation
	value: Primitive | Record<string, any> // peut être un payload d'inline-create
	disabled?: boolean
	placeholder?: string
	inputId?: string
	name?: string
	required?: boolean
	ariaInvalid?: boolean | 'true' | 'false' | 'grammar' | 'spelling'
	ariaDescribedby?: string
	store?: boolean
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
const relatedModel = computed(() =>
	useNsdbModel(props.relation.referencedTable, { store: props.store ?? false }) as unknown as {
		items: { value?: any[] } | any[]
		fetch: (query?: Record<string, any>) => Promise<any[]>
	}
)
const supabaseUser = useSupabaseUser()
let loadSequence = 0

function isItemsRef(value: { value?: any[] } | any[]): value is { value?: any[] } {
	return !Array.isArray(value) && typeof value === 'object' && value !== null
}

// items : Ref<any[]>
const rows = computed<any[]>(() => {
	const raw = relatedModel.value.items
	if (Array.isArray(raw)) return raw
	if (isItemsRef(raw) && Array.isArray(raw.value)) return raw.value
	return []
})

// valueField : clé utilisée comme valeur (id par défaut)
const valueField = computed<string>(() => {
	if (props.relation.referencedColumns?.length) {
		return props.relation.referencedColumns[0] ?? 'id'
	}
	return 'id'
})

// labelField : champ utilisé pour afficher l’option & créer inline
const labelField = computed<string>(() => {
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
	const requestId = ++loadSequence
	loading.value = true
	error.value = null

	try {
		await relatedModel.value.fetch({
			limit: 200,
			orderBy: valueField.value,
			orderDirection: 'asc',
		})
	} catch (e: any) {
		if (requestId !== loadSequence) return
		console.error('[NsdbRelationSelect] load error:', e)
		error.value = e?.message ?? 'Erreur de chargement des options'
	} finally {
		if (requestId === loadSequence) loading.value = false
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
	() => {
		mode.value = 'select'
		newLabel.value = ''
		void load()
	}
)

watch(
	() => supabaseUser.value?.id ?? null,
	() => {
		const raw = relatedModel.value.items
		if (Array.isArray(raw)) raw.splice(0)
		else if (isItemsRef(raw)) raw.value = []
		void load()
	},
	{ flush: 'sync' },
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
			:id="inputId"
			:name="name"
			:disabled="disabled || loading"
			:required="required"
			:aria-invalid="ariaInvalid"
			:aria-describedby="ariaDescribedby"
			:value="typeof value === 'object' && value !== null ? '' : (value ?? '')"
			@change="onSelectChange"
		>
			<option value="" :disabled="required">
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
				:id="inputId"
				:name="name"
				class="border text-black rounded px-3 py-2 w-full text-sm"
				:disabled="disabled || loading"
				:required="required"
				:aria-invalid="ariaInvalid"
				:aria-describedby="ariaDescribedby"
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
			role="alert"
		>
			{{ error }}
		</p>
	</div>
</template>
