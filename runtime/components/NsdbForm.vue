<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useNsdbModel } from '~~/nsdb/composables/useNsdbModels' // ⬅️ util à créer (voir plus haut)

type NsdbFormMode = 'create' | 'edit'

type Label = {
	key: string
	label: string
}

const props = defineProps<{
	model: string
	id?: string | number | null
	initialValues?: Record<string, any>
	labels?: Label[]
	hideFields?: string[]
}>()

const emit = defineEmits<{
	(e: 'saved', payload: any): void
	(e: 'created', payload: any): void
	(e: 'updated', payload: any): void
	(e: 'error', error: any): void
}>()

// 🔥 DX handle générique (playlists, songs, etc.)
const nsdbModel = useNsdbModel(props.model, { store: false })
const nsdbSchema = nsdbModel.schema

const mode = computed<NsdbFormMode>(() => (props.id != null ? 'edit' : 'create'))

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const form = ref<Record<string, any>>({})

const hiddenFieldsSet = computed(() => new Set(props.hideFields ?? []))

function initForm() {
	// base depuis le DX handle (`new()` du modèle) si dispo
	const base = typeof nsdbModel.new === 'function' ? nsdbModel.new() : {}

	form.value = {
		...base,
		...(props.initialValues || {}),
	}
}

/**
 * Champs cachés + required => doivent être présents dans initialValues
 */
const missingRequiredHiddenFields = computed<string[]>(() => {
	if (!nsdbSchema || !props.hideFields?.length) return []

	return props.hideFields.filter((field: string) => {
		const def = nsdbSchema[field]
		if (!def || !def.required) return false

		// doit exister dans initialValues
		if (!props.initialValues) return true
		return !(field in props.initialValues)
	})
})

watch(
	missingRequiredHiddenFields,
	(missing: string[]) => {
		if (missing.length) {
			error.value = `Les champs requis cachés suivants doivent être présents dans initialValues : ${missing.join(
				', '
			)}`
		}
	},
	{ immediate: true }
)

/**
 * Chargement de l'entité existante en mode "edit"
 */
async function load() {
	if (mode.value === 'create') {
		initForm()
		return
	}

	if (props.id == null) {
		error.value = 'Aucun ID fourni pour le mode édition.'
		return
	}

	loading.value = true
	error.value = null

	try {
		let existing: any = null

		if (typeof nsdbModel.get === 'function') {
			existing = await nsdbModel.get(props.id)
		}

		if (!existing) {
			error.value = 'Élément introuvable'
			form.value = {}
		} else {
			form.value = { ...existing }
		}
	} catch (e: any) {
		error.value = e?.message ?? 'Erreur de chargement'
		emit('error', e)
	} finally {
		loading.value = false
	}
}

// (Re)init quand id / initialValues / schema changent
watch(
	() => [props.id, props.initialValues, nsdbSchema],
	() => {
		load()
	},
	{ immediate: true }
)

function setField(field: string, value: any) {
	form.value = {
		...form.value,
		[field]: value,
	}
}

// Clés visibles (on conserve les champs cachés *dans* form, mais on ne les rend pas)
const visibleFieldKeys = computed(() =>
	Object.keys(form.value).filter((key) => !hiddenFieldsSet.value.has(key))
)

function hasMissingHiddenRequiredFields(): boolean {
	if (missingRequiredHiddenFields.value.length) {
		error.value =
			error.value ||
			`Impossible d’enregistrer : champs requis cachés manquants (${missingRequiredHiddenFields.value.join(
				', ',
			)})`
		return true
	}
	return false
}

function resetErrors() {
	error.value = null
	fieldErrors.value = {}
}

function validateVisibleRequiredFields(): Record<string, string[]> {
	const validationErrors: Record<string, string[]> = {}

	for (const [key, def] of Object.entries(nsdbSchema)) {
		// on ignore les champs non required
		if (!def.required) continue

		// on ignore les champs cachés (déjà gérés par missingRequiredHiddenFields)
		if (hiddenFieldsSet.value.has(key)) continue

		const value = form.value[key]

		const isEmpty =
			value === null ||
			value === undefined ||
			(typeof value === 'string' && value.trim() === '')

		if (isEmpty) {
			if (!validationErrors[key]) validationErrors[key] = []
			validationErrors[key].push('Ce champ est obligatoire.')
		}
	}

	return validationErrors
}

function applyValidationErrors(validationErrors: Record<string, string[]>) {
	fieldErrors.value = validationErrors
	error.value = 'Certains champs obligatoires sont manquants.'
}

function buildPayload(): Record<string, any> {
	const payload: Record<string, any> = {}

	for (const [key, value] of Object.entries(form.value)) {
		const def = nsdbSchema[key]
		// on ignore les champs readOnly / primaryKey
		if (def?.readOnly || def?.primaryKey) continue
		payload[key] = value
	}

	return payload
}

async function submitToModel(payload: Record<string, any>): Promise<any> {
	if (mode.value === 'create') {
		if (typeof nsdbModel.add !== 'function') {
			throw new Error('Le nsdb model ne définit pas de méthode add().')
		}
		const result = await nsdbModel.add(payload)
		emit('created', result)
		return result
	}

	// mode 'edit'
	if (props.id == null) {
		throw new Error('Impossible de mettre à jour : aucun id fourni.')
	}
	if (typeof nsdbModel.patch !== 'function') {
		throw new Error('Le DX handle ne définit pas de méthode patch().')
	}
	const result = await nsdbModel.patch(props.id, payload)
	emit('updated', result)
	return result
}

function handleSubmitError(e: any) {
	error.value = e?.message ?? 'Erreur lors de l’enregistrement'

	if (e?.fieldErrors && typeof e.fieldErrors === 'object') {
		fieldErrors.value = e.fieldErrors
	}

	emit('error', e)
}

async function onSubmit() {
	if (saving.value) return

	// 1. Validation des champs requis cachés
	if (hasMissingHiddenRequiredFields()) {
		return
	}

	// 2. Reset des erreurs
	resetErrors()

	// 3. Validation des champs visibles requis
	const validationErrors = validateVisibleRequiredFields()
	if (Object.keys(validationErrors).length > 0) {
		applyValidationErrors(validationErrors)
		return
	}

	saving.value = true

	try {
		// 4. Construction du payload filtré
		const payload = buildPayload()

		// 5. Soumission au DX handle (add / patch)
		const result = await submitToModel(payload)

		// 6. Événement global
		emit('saved', result)
	} catch (e: any) {
		handleSubmitError(e)
	} finally {
		saving.value = false
	}
}
</script>

<template>
	<form class="space-y-4" @submit.prevent="onSubmit">
		<!-- HEADER -->
		<slot
			name="header"
			:model="props.model"
			:mode="mode"
			:loading="loading"
		>
			<h3 class="text-lg font-semibold capitalize">
				{{ mode === 'create' ? `Créer ${props.model}` : `Modifier ${props.model}` }}
			</h3>
		</slot>

		<!-- ERREUR GLOBALE -->
		<slot
			name="error"
			v-if="error"
			:error="error"
		>
			<div class="text-sm text-red-600">
				{{ error }}
			</div>
		</slot>

		<!-- CHAMPS -->
		<slot
			name="fields"
			:form="form"
			:set-field="setField"
			:errors="fieldErrors"
			:mode="mode"
			:loading="loading"
			:visible-field-keys="visibleFieldKeys"
			:schema="nsdbSchema"
		>
			<!-- Fallback : rendu automatique des champs visibles -->
			<div
				v-for="key in visibleFieldKeys"
				:key="key"
				class="space-y-1"
			>
				<label class="block text-sm font-medium capitalize">
					{{ labels?.find(l => l.key === key)?.label || key }}
				</label>

				<input
					v-if="nsdbSchema[key]?.type === 'string'"
					type="text"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving"
					placeholder="Entrez une valeur"
					@input="setField(key, ($event.target as HTMLInputElement).value)"
				/>

				<select
					v-else-if="nsdbSchema[key]?.type === 'enum'"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving"
					@change="setField(key, ($event.target as HTMLSelectElement).value)"
				>
					<option value="" disabled selected>Sélectionnez une option</option>
					<option
						v-for="enumValue in nsdbSchema[key]?.enum || []"
						:key="enumValue"
						:value="enumValue"
					>
						{{ enumValue }}
					</option>
				</select>

				<div v-else-if="nsdbSchema[key]?.type === 'boolean'" class="flex items-center gap-2">
				    <input
						type="checkbox"
						:id="`checkbox-${key}`"
						:name="key"
						:checked="form[key] ?? false" 
					/>
						<label :for="`checkbox-${key}`">
							{{ labels?.find(l => l.key === key)?.label || key }}
						</label>
				</div>

				<p
					v-if="fieldErrors[key]?.length"
					class="text-xs text-red-500"
				>
					{{ fieldErrors[key][0] }}
				</p>
			</div>

			<div v-if="visibleFieldKeys.length === 0" class="text-xs text-gray-500">
				Aucun champ à afficher. Fournis <code>initialValues</code> ou un slot <code>#fields</code>.
			</div>
		</slot>

		<!-- ACTIONS -->
		<slot
			name="actions"
			:mode="mode"
			:saving="saving"
			:can-submit="!saving && !loading && !missingRequiredHiddenFields.length"
		>
			<div class="flex justify-end gap-2">
				<button
					type="submit"
					class="px-4 py-2 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
					:disabled="saving || loading || missingRequiredHiddenFields.length"
				>
					<span v-if="saving">
						Enregistrement…
					</span>
					<span v-else>
						{{ mode === 'create' ? 'Créer' : 'Enregistrer' }}
					</span>
				</button>
			</div>
		</slot>
	</form>
</template>
