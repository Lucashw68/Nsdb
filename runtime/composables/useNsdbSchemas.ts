// @lucashw68/nsdb/runtime/composables/useNsdbSchemas.ts
import { computed } from 'vue'
import type { EntityField, EntityRelation } from '@lucashw68/nsdb/types/entities'

type Schema = Record<string, EntityField>

export function useNsdbSchema(schema: Schema | null | undefined) {
	// Sécurise le schema pour éviter les erreurs si null / undefined
	const safeSchema: Schema = schema && typeof schema === 'object'
		? schema
		: ({} as Schema)

	// ------------------------------------------------------------
	// Champs & editableKeys
	// ------------------------------------------------------------

	const fields = Object.keys(safeSchema)

	const editableKeys = computed(() =>
		Object.entries(safeSchema)
			.filter(([, field]) => !field.readonly)
			.map(([key]) => key)
	)

	// ------------------------------------------------------------
	// Fabrique d'objet vide basé sur le schema
	// ------------------------------------------------------------

	function emptyFromSchema(): any {
		const result: Record<string, any> = {}

		for (const [key, definition] of Object.entries(safeSchema)) {
			if (definition.readonly) continue

			if ('default' in definition) {
				result[key] = definition.default
			} else if (definition.type === 'checkbox') {
				result[key] = false
			} else {
				result[key] = null
			}
		}

		return result as any
	}

	// ------------------------------------------------------------
	// Helpers pour les relations → select Supabase
	// ------------------------------------------------------------

	function aliasFromColumn(column: string, relation: EntityRelation) {
		if (typeof column === 'string' && column.endsWith('_id')) {
			const base = column.slice(0, -3)
			return base || relation.referencedTable
		}
		return relation.referencedTable
	}

	/**
	 * Construit une chaîne `select` pour Supabase à partir d'un schema.
	 * Exemple : "*, playlist:playlists(*), profile:profiles(*)"
	 *
	 * - Si aucun schema n'est fourni, on utilise celui passé au hook.
	 */

	function buildSelectFromSchema(
		schema: Schema | null | undefined = safeSchema,
		baseSelect: string = '*'
	): string {
		if (!schema || typeof schema !== 'object') {
			console.warn('[buildSelectFromSchema] invalid schema, returning baseSelect only')
			return String(baseSelect)
		}

		const relationParts: string[] = []

		for (const [column, field] of Object.entries(schema)) {
			if (!field || typeof field !== 'object') continue
			if (!field.relation) continue

			const rel = field.relation

			// Pour l'instant, tous les belongsTo et hasOne sont inclus.
			// Les hasMany sont exclus pour éviter les charges trop lourdes.
			// À affiner, par exemple, filtrer certains hasOne.
			if (rel.kind !== 'belongsTo' && rel.kind !== 'hasOne') continue

			const alias = aliasFromColumn(column, rel)

			const fkSuffix = rel.foreignKeyName ? `!${rel.foreignKeyName}` : ''

			const part = `${alias}:${rel.referencedTable}${fkSuffix}(*)`
			relationParts.push(part)
		}

		if (!relationParts.length) {
			return String(baseSelect)
		}

		return [String(baseSelect), ...relationParts].join(', ')
	}

	// ------------------------------------------------------------
	// bindModel : plugge un useSupabaseModel sur le schema
	// ------------------------------------------------------------

	function bindModel<TRow>(model: {
		fetch: (query?: any) => Promise<TRow[]>
	}) {
		/**
		 * Récupère une liste d'éléments avec :
		 * - select auto (relations) basé sur le schema
		 * - support de where, orderBy, limit, offset via model.fetch(query)
		 */
		const fetch = async (query: any = {}) => {
			const select = buildSelectFromSchema(safeSchema)
			const finalQuery = { ...query, select }

			const rows = await model.fetch(finalQuery)
			return Array.isArray(rows) ? (rows as TRow[]) : []
		}

		/**
		 * Variante avec where obligatoire.
		 */
		const find = async (query: any) => {
			if (!query?.where) {
				throw new Error('[nsdb] bindModel.find() requires a "where" clause')
			}

			const select = buildSelectFromSchema(safeSchema)
			const finalQuery = { ...query, select }

			const rows = await model.fetch(finalQuery)
			return Array.isArray(rows) ? (rows as TRow[]) : []
		}

		return { fetch, find }
	}

	return {
		fields,
		editableKeys,
		buildSelectFromSchema,
		emptyFromSchema,
		bindModel,
	}
}
