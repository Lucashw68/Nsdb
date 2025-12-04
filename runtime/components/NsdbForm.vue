<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useNsdbModel } from '~~/nsdb/composables/useNsdbModels' // ⬅️ util à créer (voir plus haut)
import NsdbRelationSelect from './Form/NsdbRelationSelect.vue'
import type { EntityRelation } from '@lucashw68/nsdb/types/entities'

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

// ------------------------
// Modèles liés (belongsTo)
// ------------------------

type NsdbAnyModel = ReturnType<typeof useNsdbModel<any>>

const relatedModels: Record<string, NsdbAnyModel> = {}

if (nsdbSchema && typeof nsdbSchema === 'object') {
	for (const def of Object.values(nsdbSchema as Record<string, any>)) {
		if (def?.type === 'relation' && def.relation && def.relation.kind === 'belongsTo') {
			const relation = def.relation as EntityRelation
			const table = relation.referencedTable
			if (!relatedModels[table]) {
				try {
					relatedModels[table] = useNsdbModel(table, { store: false }) as NsdbAnyModel
				} catch (e) {
					console.warn('[NsdbForm] Impossible d’initialiser le modèle lié pour', table, e)
				}
			}
		}
	}
}

function splitInitialValuesByRelation(
	initialValues: Record<string, any> | undefined,
	schema: Record<string, any> | undefined
) {
	const root: Record<string, any> = {}
	const perRelation: Record<string, Record<string, any>> = {}

	if (!initialValues || !schema) {
		return { root, perRelation }
	}

	for (const [fullKey, value] of Object.entries(initialValues)) {
		// pas de point → champ de l’entité principale
		if (!fullKey.includes('.')) {
			root[fullKey] = value
			continue // 👈 AVANT c'était `return` → bug
		}

		const [prefix, childKey] = fullKey.split('.', 2)
		if (!childKey) continue

		let relationFieldKey: string | null = null

		// 1) le prefix correspond directement à un champ relation
		if (schema[prefix]?.type === 'relation') {
			relationFieldKey = prefix
		} else {
			// 2) sinon, on regarde si le prefix correspond à la table référencée
			for (const [fieldKey, fieldDef] of Object.entries(schema)) {
				if (
					fieldDef?.type === 'relation' &&
					fieldDef.relation?.referencedTable &&
					fieldDef.relation.referencedTable.replace(/s$/i, '') === prefix.replace(/s$/i, '')
				) {
					relationFieldKey = fieldKey
					break
				}
			}
		}

		if (!relationFieldKey) {
			console.warn(
				'[NsdbForm] initialValues: impossible de résoudre la relation pour la clé',
				fullKey
			)
			continue
		}

		if (!perRelation[relationFieldKey]) {
			perRelation[relationFieldKey] = {}
		}
		perRelation[relationFieldKey][childKey] = value
	}

	return { root, perRelation }
}

const parsedInitialValues = computed(() =>
	splitInitialValuesByRelation(props.initialValues ?? {}, nsdbSchema as any)
)

const rootInitialValues = computed(
	() => parsedInitialValues.value?.root ?? {}
)

const relationInitialValues = computed(
	() => parsedInitialValues.value?.perRelation ?? {}
)

const mode = computed<NsdbFormMode>(() => (props.id != null ? 'edit' : 'create'))

const loading = ref(false)
const saving = ref(false)
const error = ref<string | null>(null)
const fieldErrors = ref<Record<string, string[]>>({})
const form = ref<Record<string, any>>({})

const hiddenFieldsSet = computed(() => new Set(props.hideFields ?? []))

function initForm() {
	const base = typeof nsdbModel.new === 'function' ? nsdbModel.new() : {}

	form.value = {
		...base,
		...(rootInitialValues.value || {}),
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

async function resolveRelationsAndBuildPayload(): Promise<Record<string, any>> {
	const payload: Record<string, any> = {}
	const relationCreationPromises: Promise<void>[] = []

	for (const [key, value] of Object.entries(form.value)) {
		const def = nsdbSchema?.[key]

		// ignore readonly
		if (def?.readonly || def?.primaryKey) continue

		// ------------------------
		// Champ relation
		// ------------------------
		if (def?.type === 'relation' && def.relation) {
			const relation = def.relation
			const table = relation.referencedTable

			// Cas simple : valeur primitive = FK existante
			if (
				value === null ||
				typeof value === 'string' ||
				typeof value === 'number'
			) {
				payload[key] = value
				continue
			}

			// Cas inline-create
			if (value && typeof value === 'object' && (value as any).__nsdbInlineCreate) {
				const inline = value as any
				const model = (nsdbModel.relatedModels?.[table] ?? null) || null

				if (!model || typeof model.create !== 'function') {
					console.warn(
						'[NsdbForm] Aucun DX handle lié pour la table',
						table,
						'→ impossible de créer inline.'
					)
					continue
				}

				relationCreationPromises.push(
					(async () => {
						// point de départ : data remontée par le composant relation
						const childData: Record<string, any> = {
							...(inline.data || {}),
						}

						// 1) defaults nested depuis initialValues : ex. "playlist.profile_id"
						const childDefaults = relationInitialValues.value[key]
						if (childDefaults) {
							for (const [childKey, defaultValue] of Object.entries(childDefaults)) {
								if (childData[childKey] == null) {
									childData[childKey] = defaultValue
								}
							}
						}

						// 2) création de l’entité liée
						const created = await model.create(childData)
						if (!created) {
							throw new Error(
								`[nsdb] Échec de la création liée pour ${table}`
							)
						}

						// 3) récupération de la PK référencée
						const pkColumn = relation.referencedColumns?.[0] ?? 'id'
						const createdId = (created as any)?.[pkColumn]

						if (!createdId) {
							console.warn(
								`[NsdbForm] Impossible de récupérer la PK (${pkColumn}) sur l’entité créée de ${table}.`
							)
						}

						payload[key] = createdId
					})()
				)

				continue
			}

			// Valeur non gérée → on la passe telle quelle
			payload[key] = value
			continue
		}

		// ------------------------
		// Champ "normal"
		// ------------------------
		payload[key] = value
	}

	if (relationCreationPromises.length) {
		await Promise.all(relationCreationPromises)
	}

	return payload
}

async function submitToModel(payload: Record<string, any>): Promise<any> {
	if (mode.value === 'create') {
		if (typeof nsdbModel.create !== 'function') {
			throw new Error('Le nsdb model ne définit pas de méthode create().')
		}
		const result = await nsdbModel.create(payload)
		emit('created', result)
		return result
	}

	// mode 'edit'
	if (props.id == null) {
		throw new Error('Impossible de mettre à jour : aucun id fourni.')
	}
	if (typeof nsdbModel.edit !== 'function') {
		throw new Error('Le DX handle ne définit pas de méthode edit().')
	}
	const result = await nsdbModel.edit(props.id, payload)
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
		// 4. Construction du payload + résolution des créations liées
		const payload = await resolveRelationsAndBuildPayload()

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
					v-if="nsdbSchema[key]?.type === 'text'"
					type="text"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving"
					placeholder="Entrez une valeur"
					@input="setField(key, ($event.target as HTMLInputElement).value)"
				/>

				<input
					v-if="nsdbSchema[key]?.type === 'number'"
					type="number"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving"
					placeholder="Entrez une valeur"
					@input="setField(key, Number(($event.target as HTMLInputElement).value))"
				/>

				<select
					v-else-if="nsdbSchema[key]?.type === 'select'"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving"
					@change="setField(key, ($event.target as HTMLSelectElement).value)"
				>
					<p>SELECT</p>
					<option value="" disabled>Sélectionnez une option</option>
					<option
						v-for="opt in nsdbSchema[key]?.options || []"
						:key="opt.value"
						:value="opt.value"
					>
						{{ opt.label }}
					</option>
				</select>

				<div
					v-else-if="nsdbSchema[key]?.type === 'checkbox'"
					class="flex items-center gap-2"
				>
					<input
						type="checkbox"
						:id="`checkbox-${key}`"
						:name="key"
						:checked="!!form[key]"
						:disabled="loading || saving"
						@change="setField(key, ($event.target as HTMLInputElement).checked)"
					/>
					<label :for="`checkbox-${key}`">
						{{ labels?.find(l => l.key === key)?.label || key }}
					</label>
				</div>

				<!-- RELATION : utilise NsdbRelationSelect basé sur le schema -->
				<NsdbRelationSelect
					v-else-if="nsdbSchema?.[key]?.type === 'relation' && nsdbSchema[key]?.relation"
					:relation="nsdbSchema[key].relation"
					:value="form[key] ?? null"
					:disabled="loading || saving || nsdbSchema[key]?.readonly"
					@update:value="setField(key, $event)"
				/>

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
