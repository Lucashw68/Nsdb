<script setup lang="ts">
import { ref, watch, computed, nextTick, useId } from 'vue'
import { useSupabaseUser } from '#imports'
import { useNsdbModel } from '#build/nsdb/registry'
import NsdbRelationSelect from './Form/NsdbRelationSelect.vue'
import type { EntityRelation } from '@lucashw68/nsdb/types/entities'

type NsdbFormMode = 'create' | 'edit'

type Label = {
	key: string
	label: string
}

type NsdbFormModel = {
	items?: unknown
	schema: Record<string, any>
	createDraft?: () => Record<string, any>
	getById?: (id: string | number) => Promise<Record<string, any> | null>
	create?: (payload: Record<string, any>) => Promise<any>
	update?: (id: string | number, payload: Record<string, any>) => Promise<any>
	relatedModels?: Record<string, NsdbFormModel>
}

const props = defineProps<{
	model: string
	id?: string | number | null
	initialValues?: Record<string, any>
	labels?: Label[]
	hideFields?: string[]
	store?: boolean
	validate?: (
		values: Readonly<Record<string, any>>,
		context: { mode: NsdbFormMode; model: string },
	) => Record<string, string | string[]> | null | undefined | Promise<Record<string, string | string[]> | null | undefined>
}>()

const emit = defineEmits<{
	(e: 'saved', payload: any): void
	(e: 'created', payload: any): void
	(e: 'updated', payload: any): void
	(e: 'error', error: any): void
}>()

// DX handle générique (playlists, songs, etc.)
// The registry returns a table-specific Insert/Update contract. The generic form
// intentionally erases that table parameter only at this UI boundary.
const nsdbModel = computed(() =>
	useNsdbModel(props.model, { store: props.store ?? false }) as unknown as NsdbFormModel
)
const nsdbSchema = computed<Record<string, any>>(() => nsdbModel.value.schema ?? {})
const supabaseUser = useSupabaseUser()

// ------------------------
// Modèles liés (belongsTo)
// ------------------------

const relatedModels = computed<Record<string, NsdbFormModel>>(() => {
	const models: Record<string, NsdbFormModel> = {}
	for (const def of Object.values(nsdbSchema.value)) {
		if (def?.type === 'relation' && def.relation && def.relation.kind === 'belongsTo') {
			const relation = def.relation as EntityRelation
			const table = relation.referencedTable
			if (!models[table]) {
				try {
					models[table] = useNsdbModel(table, { store: props.store ?? false }) as unknown as NsdbFormModel
				} catch (e) {
					console.warn('[NsdbForm] Impossible d’initialiser le modèle lié pour', table, e)
				}
			}
		}
	}
	return models
})

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
			continue
		}

		const [prefix = '', childKey = ''] = fullKey.split('.', 2)
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

		const resolvedRelationKey = relationFieldKey

		if (!perRelation[resolvedRelationKey]) {
			perRelation[resolvedRelationKey] = {}
		}
		perRelation[resolvedRelationKey][childKey] = value
	}

	return { root, perRelation }
}

const parsedInitialValues = computed(() =>
	splitInitialValuesByRelation(props.initialValues ?? {}, nsdbSchema.value)
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
const formElement = ref<HTMLFormElement | null>(null)
const formUid = useId().replace(/[^a-zA-Z0-9_-]/g, '')
const status = ref<'idle' | 'loading' | 'saving' | 'saved' | 'error'>('idle')
const baseline = ref('{}')
let loadSequence = 0

const dirty = computed(() => JSON.stringify(form.value) !== baseline.value)

const hiddenFieldsSet = computed(() => new Set([
	...(props.hideFields ?? []),
	...Object.entries(nsdbSchema.value)
		.filter(([, definition]) => definition?.hidden || definition?.serverOnly)
		.map(([key]) => key),
]))

function initForm() {
	const base = typeof nsdbModel.value.createDraft === 'function'
		? nsdbModel.value.createDraft()
		: {}

	form.value = {
		...base,
		...(rootInitialValues.value || {}),
	}
	baseline.value = JSON.stringify(form.value)
}

/**
 * Champs cachés + required => doivent être présents dans initialValues
 */
const missingRequiredHiddenFields = computed<string[]>(() => {
	if (!hiddenFieldsSet.value.size) return []

	return [...hiddenFieldsSet.value].filter((field: string) => {
		const def = nsdbSchema.value[field]
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
	const requestId = ++loadSequence
	// Never render values or errors belonging to the previous model/item.
	form.value = {}
	fieldErrors.value = {}
	error.value = null
	loading.value = false
	status.value = mode.value === 'edit' ? 'loading' : 'idle'
	if (mode.value === 'create') {
		initForm()
		return
	}

	if (props.id == null) {
		error.value = 'Aucun ID fourni pour le mode édition.'
		return
	}

	loading.value = true

	try {
		let existing: any = null

		if (typeof nsdbModel.value.getById === 'function') {
			existing = await nsdbModel.value.getById(props.id)
		}
		if (requestId !== loadSequence) return

		if (!existing) {
			error.value = 'Élément introuvable'
			form.value = {}
		} else {
			form.value = { ...existing }
			baseline.value = JSON.stringify(form.value)
		}
	} catch (e: any) {
		if (requestId !== loadSequence) return
		error.value = e?.message ?? 'Erreur de chargement'
		status.value = 'error'
		emit('error', e)
	} finally {
		if (requestId === loadSequence) {
			loading.value = false
			if (!error.value) status.value = 'idle'
		}
	}
}

// (Re)init quand id / initialValues / schema changent
watch(
	() => [props.model, props.id, props.initialValues, props.store],
	() => {
		load()
	},
	{ immediate: true, deep: true, flush: 'sync' }
)

watch(
	() => supabaseUser.value?.id ?? null,
	() => { void load() },
	{ flush: 'sync' },
)

function setField(field: string, value: any) {
	form.value = {
		...form.value,
		[field]: value,
	}
	if (fieldErrors.value[field]) {
		const nextErrors = { ...fieldErrors.value }
		delete nextErrors[field]
		fieldErrors.value = nextErrors
	}
}

function isFieldVisibleForMode(key: string, definition: any) {
	if (hiddenFieldsSet.value.has(key) || definition?.serverOnly) return false
	if (mode.value === 'create') {
		return definition?.insertable !== false && !definition?.readonly && definition?.editable !== false
	}
	// Existing readonly values stay visible in edit mode, but never enter payloads.
	return key in form.value || definition?.updatable !== false
}

const visibleFieldKeys = computed(() =>
	Object.keys(nsdbSchema.value).filter(key => isFieldVisibleForMode(key, nsdbSchema.value[key]))
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

	for (const [key, def] of Object.entries(nsdbSchema.value)) {
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

function normalizeFieldErrors(errors: Record<string, string | string[]> | null | undefined) {
	return Object.fromEntries(
		Object.entries(errors ?? {}).map(([key, messages]) => [key, Array.isArray(messages) ? messages : [messages]]),
	)
}

function emptyValueForField(key: string) {
	const definition = nsdbSchema.value[key]
	if (definition?.nullable) return null
	if (mode.value === 'create' && definition?.hasDefault) return undefined
	return ''
}

function setTextField(key: string, rawValue: string) {
	setField(key, rawValue === '' ? emptyValueForField(key) : rawValue)
}

function setNumberField(key: string, rawValue: string) {
	if (rawValue === '') {
		setField(key, emptyValueForField(key))
		return
	}
	setField(key, Number(rawValue))
}

function structuredControlValue(value: any) {
	if (value == null) return ''
	if (typeof value === 'string') return value
	return JSON.stringify(value, null, 2)
}

function serializeStructuredField(key: string, value: any) {
	if (value === undefined) return undefined
	if (value === null) return null
	if (typeof value !== 'string') return value
	if (value.trim() === '') return emptyValueForField(key)

	try {
		const parsed = JSON.parse(value)
		if (nsdbSchema.value[key]?.type === 'array' && !Array.isArray(parsed)) {
			throw new Error('Cette valeur doit être un tableau JSON valide.')
		}
		return parsed
	} catch (cause: any) {
		const message = cause?.message?.includes('tableau')
			? cause.message
			: 'Saisissez une valeur JSON valide.'
		throw Object.assign(new Error(message), { fieldErrors: { [key]: [message] } })
	}
}

function normalizeRelationValue(key: string, value: string | number | null) {
	if (value == null) return null
	const databaseType = String(nsdbSchema.value[key]?.databaseType ?? '').toLowerCase()
	if (typeof value === 'string' && /^(smallint|integer|bigint|numeric|decimal|real|double precision)/.test(databaseType)) {
		return Number(value)
	}
	return value
}

function applyValidationErrors(validationErrors: Record<string, string[]>) {
	fieldErrors.value = validationErrors
	error.value = 'Certains champs obligatoires sont manquants.'
}

async function resolveRelationsAndBuildPayload(): Promise<Record<string, any>> {
	const payload: Record<string, any> = {}
	const relationCreationPromises: Promise<void>[] = []

	for (const [key, value] of Object.entries(form.value)) {
		const def = nsdbSchema.value[key]

		// Database capabilities are mode-specific. Legacy schemas still use readonly/editable.
		if (def?.serverOnly || def?.readonly || def?.editable === false) continue
		if (mode.value === 'create' && def?.insertable === false) continue
		if (mode.value === 'edit' && (def?.updatable === false || def?.primaryKey)) continue
		if (value === undefined) continue

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
				payload[key] = normalizeRelationValue(key, value)
				continue
			}

			// Cas inline-create
			if (value && typeof value === 'object' && (value as any).__nsdbInlineCreate) {
				const inline = value as any
				const model = relatedModels.value[table] ?? nsdbModel.value.relatedModels?.[table] ?? null

				if (!model || typeof model.create !== 'function') {
					console.warn(
						'[NsdbForm] Aucun DX handle lié pour la table',
						table,
						'→ impossible de créer inline.'
					)
					continue
				}
				const createRelatedEntity = model.create

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
							const created = await createRelatedEntity(childData)
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
		payload[key] = def?.type === 'json' || def?.type === 'array'
			? serializeStructuredField(key, value)
			: value
	}

	if (relationCreationPromises.length) {
		await Promise.all(relationCreationPromises)
	}

	return payload
}

async function submitToModel(payload: Record<string, any>): Promise<any> {
	if (mode.value === 'create') {
		if (typeof nsdbModel.value.create !== 'function') {
			throw new Error('Le nsdb model ne définit pas de méthode create().')
		}
		const result = await nsdbModel.value.create(payload)
		emit('created', result)
		return result
	}

	// mode 'edit'
	if (props.id == null) {
		throw new Error('Impossible de mettre à jour : aucun id fourni.')
	}
	if (typeof nsdbModel.value.update !== 'function') {
		throw new Error('Le DX handle ne définit pas de méthode update().')
	}
	const result = await nsdbModel.value.update(props.id, payload)
	emit('updated', result)
	return result
}

function handleSubmitError(e: any) {
	error.value = e?.message ?? 'Erreur lors de l’enregistrement'
	status.value = 'error'

	if (e?.fieldErrors && typeof e.fieldErrors === 'object') {
		fieldErrors.value = e.fieldErrors
	}

	emit('error', e)
	void focusFirstInvalidField()
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
		status.value = 'error'
		await focusFirstInvalidField()
		return
	}
	if (props.validate) {
		const customErrors = normalizeFieldErrors(await props.validate(form.value, { mode: mode.value, model: props.model }))
		if (Object.keys(customErrors).length) {
			applyValidationErrors(customErrors)
			status.value = 'error'
			await focusFirstInvalidField()
			return
		}
	}

	saving.value = true
	status.value = 'saving'

	try {
		// 4. Construction du payload + résolution des créations liées
		const payload = await resolveRelationsAndBuildPayload()

		// 5. Soumission au DX handle (add / patch)
		const result = await submitToModel(payload)

		// 6. Événement global
		emit('saved', result)
		baseline.value = JSON.stringify(form.value)
		status.value = 'saved'
	} catch (e: any) {
		handleSubmitError(e)
	} finally {
		saving.value = false
	}
}

function fieldId(key: string) {
	return `nsdb-${formUid}-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}

function fieldErrorId(key: string) {
	return `${fieldId(key)}-error`
}

function numberStep(key: string) {
	const databaseType = String(nsdbSchema.value[key]?.databaseType ?? '').toLowerCase()
	return /^(smallint|integer|bigint)/.test(databaseType) ? '1' : 'any'
}

async function focusFirstInvalidField() {
	await nextTick()
	const firstInvalid = formElement.value?.querySelector<HTMLElement>('[aria-invalid="true"]')
	firstInvalid?.focus()
}
</script>

<template>
<form ref="formElement" class="space-y-4" :aria-busy="saving || loading" @submit.prevent="onSubmit">
		<!-- HEADER -->
		<slot
			name="header"
			:model="props.model"
			:mode="mode"
			:loading="loading"
			:status="status"
			:dirty="dirty"
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
			<div class="text-sm text-red-600" role="alert" aria-live="polite">
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
			:saving="saving"
			:status="status"
			:dirty="dirty"
			:visible-field-keys="visibleFieldKeys"
			:schema="nsdbSchema"
		>
			<!-- Fallback : rendu automatique des champs visibles -->
			<div
				v-for="key in visibleFieldKeys"
				:key="key"
				class="space-y-1"
			>
				<label :for="fieldId(key)" class="block text-sm font-medium capitalize">
					{{ labels?.find(l => l.key === key)?.label || nsdbSchema[key]?.label || key }}
				</label>

				<slot
					:name="`field-${key}`"
					:field="nsdbSchema[key]"
					:field-key="key"
					:value="form[key]"
					:update="(value: any) => setField(key, value)"
					:error="fieldErrors[key]?.[0] ?? null"
					:mode="mode"
					:disabled="loading || saving"
				>
				<input
					v-if="nsdbSchema[key]?.type === 'text'"
					:id="fieldId(key)"
					:name="key"
					type="text"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving"
					:readonly="nsdbSchema[key]?.readonly"
					:required="nsdbSchema[key]?.required"
					:aria-invalid="fieldErrors[key]?.length ? 'true' : undefined"
					:aria-describedby="fieldErrors[key]?.length ? fieldErrorId(key) : undefined"
					placeholder="Entrez une valeur"
					@input="setTextField(key, ($event.target as HTMLInputElement).value)"
				/>

				<input
					v-else-if="nsdbSchema[key]?.type === 'number'"
					:id="fieldId(key)"
					:name="key"
					type="number"
					:step="numberStep(key)"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving"
					:readonly="nsdbSchema[key]?.readonly"
					:required="nsdbSchema[key]?.required"
					:aria-invalid="fieldErrors[key]?.length ? 'true' : undefined"
					:aria-describedby="fieldErrors[key]?.length ? fieldErrorId(key) : undefined"
					placeholder="Entrez une valeur"
					@input="setNumberField(key, ($event.target as HTMLInputElement).value)"
				/>

				<textarea
					v-else-if="['textarea', 'json', 'array'].includes(nsdbSchema[key]?.type)"
					:id="fieldId(key)"
					:name="key"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="nsdbSchema[key]?.type === 'textarea' ? (form[key] ?? '') : structuredControlValue(form[key])"
					:disabled="loading || saving"
					:readonly="nsdbSchema[key]?.readonly"
					:required="nsdbSchema[key]?.required"
					:aria-invalid="fieldErrors[key]?.length ? 'true' : undefined"
					:aria-describedby="fieldErrors[key]?.length ? fieldErrorId(key) : undefined"
					placeholder="Entrez une valeur"
					@input="setTextField(key, ($event.target as HTMLTextAreaElement).value)"
				/>

				<input
					v-else-if="nsdbSchema[key]?.type === 'datetime' || nsdbSchema[key]?.type === 'date'"
					:id="fieldId(key)"
					:name="key"
					:type="nsdbSchema[key]?.type === 'date' ? 'date' : 'datetime-local'"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving"
					:readonly="nsdbSchema[key]?.readonly"
					:required="nsdbSchema[key]?.required"
					:aria-invalid="fieldErrors[key]?.length ? 'true' : undefined"
					:aria-describedby="fieldErrors[key]?.length ? fieldErrorId(key) : undefined"
					@input="setTextField(key, ($event.target as HTMLInputElement).value)"
				/>

				<input
					v-else-if="nsdbSchema[key]?.type === 'file'"
					:id="fieldId(key)"
					:name="key"
					type="file"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:disabled="loading || saving || nsdbSchema[key]?.readonly"
					:required="nsdbSchema[key]?.required"
					:aria-invalid="fieldErrors[key]?.length ? 'true' : undefined"
					:aria-describedby="fieldErrors[key]?.length ? fieldErrorId(key) : undefined"
					@change="setField(key, ($event.target as HTMLInputElement).files?.[0] ?? null)"
				/>

				<select
					v-else-if="nsdbSchema[key]?.type === 'select'"
					:id="fieldId(key)"
					:name="key"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving || nsdbSchema[key]?.readonly"
					:required="nsdbSchema[key]?.required"
					:aria-invalid="fieldErrors[key]?.length ? 'true' : undefined"
					:aria-describedby="fieldErrors[key]?.length ? fieldErrorId(key) : undefined"
					@change="setTextField(key, ($event.target as HTMLSelectElement).value)"
				>
					<option value="" :disabled="nsdbSchema[key]?.required && !nsdbSchema[key]?.nullable">Sélectionnez une option</option>
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
						:id="fieldId(key)"
						:name="key"
						:checked="!!form[key]"
						:disabled="loading || saving || nsdbSchema[key]?.readonly"
						:aria-invalid="fieldErrors[key]?.length ? 'true' : undefined"
						:aria-describedby="fieldErrors[key]?.length ? fieldErrorId(key) : undefined"
						@change="setField(key, ($event.target as HTMLInputElement).checked)"
					/>
				</div>

				<!-- RELATION : utilise NsdbRelationSelect basé sur le schema -->
				<NsdbRelationSelect
					v-else-if="nsdbSchema?.[key]?.type === 'relation' && nsdbSchema[key]?.relation"
					:input-id="fieldId(key)"
					:name="key"
					:relation="nsdbSchema[key].relation"
					:value="form[key] ?? null"
					:disabled="loading || saving || nsdbSchema[key]?.readonly"
					:required="nsdbSchema[key]?.required"
					:aria-invalid="fieldErrors[key]?.length ? 'true' : undefined"
					:aria-describedby="fieldErrors[key]?.length ? fieldErrorId(key) : undefined"
					:store="props.store"
					@update:value="setField(key, $event)"
				/>

				<input
					v-else
					:id="fieldId(key)"
					:name="key"
					type="text"
					class="border text-black rounded px-3 py-2 w-full text-sm"
					:value="form[key] ?? ''"
					:disabled="loading || saving"
					:readonly="nsdbSchema[key]?.readonly"
					:required="nsdbSchema[key]?.required"
					:aria-invalid="fieldErrors[key]?.length ? 'true' : undefined"
					:aria-describedby="fieldErrors[key]?.length ? fieldErrorId(key) : undefined"
					@input="setTextField(key, ($event.target as HTMLInputElement).value)"
				/>
				</slot>

				<p
					v-if="fieldErrors[key]?.length"
					:id="fieldErrorId(key)"
					class="text-xs text-red-500"
					role="alert"
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
			:status="status"
			:dirty="dirty"
			:can-submit="!saving && !loading && missingRequiredHiddenFields.length === 0"
		>
			<div class="flex justify-end gap-2">
				<button
					type="submit"
					class="px-4 py-2 rounded bg-indigo-600 text-white text-sm disabled:opacity-50"
					:disabled="saving || loading || missingRequiredHiddenFields.length > 0"
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
