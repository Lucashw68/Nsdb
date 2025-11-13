<script setup lang="ts">
/**
 * Props simples :
 * - model: nom de table (clé nsdb/models)
 * - initial: valeurs initiales (edition ou création)
 * - schema: objet schema optionnel (si absent, on tente `nsdb/schemas/<table>` dynamiquement)
 * - submitLabel: texte du bouton
 */
const props = defineProps<{
	model: string
	initial?: Record<string, any> | null
	schema?: any
	submitLabel?: string
}>()

const emit = defineEmits<{
	(e: 'submitted', payload: any): void
	(e: 'error', err: any): void
}>()

const { useModel } = useSupabaseModels()
const model = useModel(props.model)

const form = reactive<Record<string, any>>({ ...(props.initial ?? {}) })
const loading = ref(false)
const error = ref<string | null>(null)
const fields = ref<Array<{ name: string; type: string; required: boolean; readonly: boolean; enumValues?: string[] }>>([])

/**
 * Charge le schema :
 * 1) props.schema si fourni
 * 2) import dynamique: nsdb/schemas/<table> (généré par generate-schemas)
 * 3) fallback: clés de `initial`
 */
async function resolveSchema() {
	if (props.schema) return props.schema
	try {
		// Vite/Nuxt : alias vers le build client. Ajuste si besoin.
		const mod = await import(`~/nsdb/schemas/${props.model}.ts`)
		return mod?.[`${toPascal(props.model)}Schema`] ?? null
	} catch {
		return null
	}
}

// simple util
function toPascal(s: string) {
	return String(s)
		.replace(/[_\-./\s]+/g, ' ')
		.trim()
		.replace(/(^|\s)([a-zA-Z])/g, (_, __, c) => c.toUpperCase())
		.replace(/\s+/g, '')
}

async function buildFields() {
	const sch = await resolveSchema()
	if (!sch?.fields) {
		// fallback basique : champs depuis initial
		fields.value = Object.keys(form).map(k => ({
			name: k, type: 'string', required: false, readonly: false
		}))
		return
	}

	// sch.fields est généré par generate-schemas : { col: { type, required, readonly, enum?, relation? } }
	fields.value = Object.entries(sch.fields).map(([name, meta]: any) => ({
		name,
		type: meta.type,
		required: !!meta.required,
		readonly: !!meta.readonly,
		enumValues: Array.isArray(meta.enum) ? meta.enum : Array.isArray(meta.enum?.values) ? meta.enum.values : meta.enum ?? undefined
	}))
	// populate défauts si initial manquant
	for (const f of fields.value) {
		if (!(f.name in form)) form[f.name] = null
	}
}

onMounted(buildFields)

async function onSubmit() {
	loading.value = true
	error.value = null
	try {
		const payload = { ...form }
		const hasId = payload.id != null
		const res = hasId ? await model.update(payload.id, payload) : await model.create(payload)
		emit('submitted', res)
	} catch (e: any) {
		error.value = e?.message ?? 'Erreur'
		emit('error', e)
	} finally {
		loading.value = false
	}
}
</script>

<template>
	<form class="space-y-4" @submit.prevent="onSubmit">
		<div v-if="error" class="text-sm text-red-600">{{ error }}</div>

		<div v-for="f in fields" :key="f.name" class="grid gap-1">
			<label class="text-sm font-medium">{{ f.name }}</label>

			<!-- readonly -->
			<input
				v-if="f.readonly"
				class="px-3 py-2 border rounded-xl bg-gray-50"
				:disabled="true"
				:value="form[f.name]"
				type="text"
			/>

			<!-- enum -->
			<select
				v-else-if="f.enumValues && f.enumValues.length"
				v-model="form[f.name]"
				class="px-3 py-2 border rounded-xl"
				:required="f.required"
			>
				<option :value="null">--</option>
				<option v-for="v in f.enumValues" :key="v" :value="v">{{ v }}</option>
			</select>

			<!-- types simples -->
			<input
				v-else
				v-model="form[f.name]"
				class="px-3 py-2 border rounded-xl"
				:type="f.type === 'timestamp' ? 'datetime-local'
					: f.type === 'number' ? 'number'
					: f.type === 'boolean' ? 'checkbox'
					: 'text'"
				:required="f.required"
			/>
			<small class="opacity-60" v-if="f.required">* requis</small>
		</div>

		<button class="px-4 py-2 rounded-2xl border" :disabled="loading">
			{{ submitLabel ?? 'Enregistrer' }}
		</button>
	</form>
</template>
