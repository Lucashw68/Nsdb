// @lucashw68/nsdb/runtime/composables/useNsdbSchemas.ts
import { computed } from 'vue'
import type { EntityField, EntityRelation } from '@lucashw68/nsdb/types/entities'
import type { ModelQuery } from '@lucashw68/nsdb/types/model'

type Schema = Record<string, EntityField>

export function useNsdbSchema(
	schema: Schema | null | undefined,
	relations: EntityRelation[] = [],
) {
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
			.filter(([, field]) => !field.readonly && field.editable !== false && !field.serverOnly)
			.map(([key]) => key)
	)

	// ------------------------------------------------------------
	// Fabrique d'objet vide basé sur le schema
	// ------------------------------------------------------------

	function createDraftFromSchema(): Record<string, unknown> {
		const result: Record<string, any> = {}

		for (const [key, definition] of Object.entries(safeSchema)) {
			if (definition.readonly || definition.editable === false || definition.serverOnly) continue

			if ('default' in definition) {
				result[key] = definition.default
			} else if (definition.hasDefault) {
				// Keep the key renderable while omitting it from create payloads.
				result[key] = undefined
			} else if (definition.nullable) {
				result[key] = null
			} else if (definition.type === 'checkbox') {
				result[key] = false
			} else {
				result[key] = null
			}
		}

		return result
	}

	/** @deprecated Use `createDraftFromSchema()`. Scheduled for removal before 1.0. */
	const emptyFromSchema = createDraftFromSchema

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
		baseSelect?: string,
		include?: readonly string[],
	): string {
		if (!schema || typeof schema !== 'object') {
			console.warn('[buildSelectFromSchema] invalid schema, returning baseSelect only')
			return String(baseSelect ?? '*')
		}

		const selectedBase = baseSelect ?? Object.entries(schema)
			.filter(([, field]) => field.selectable !== false && !field.serverOnly)
			.map(([column]) => column)
			.join(', ')

		const relationParts: string[] = []
		if (include) {
			for (const alias of include) {
				const relation = relations.find(candidate => candidate.alias === alias)
				if (!relation) {
					throw new Error(`[nsdb] Unknown relation include "${alias}".`)
				}
				const resource = relation.embedResource ?? relation.referencedTable
				const needsConstraintHint = relation.direction !== 'through' && resource === relation.referencedTable
				const fkSuffix = needsConstraintHint && relation.foreignKeyName ? `!${relation.foreignKeyName}` : ''
				relationParts.push(`${alias}:${resource}${fkSuffix}(*)`)
			}
		}

		for (const [column, field] of include ? [] : Object.entries(schema)) {
			if (!field || typeof field !== 'object') continue
			if (!field.relation) continue

			const rel = field.relation

			// Pour l'instant, tous les belongsTo et hasOne sont inclus.
			// Les hasMany sont exclus pour éviter les charges trop lourdes.
			// À affiner, par exemple, filtrer certains hasOne.
			if (rel.kind !== 'belongsTo' && rel.kind !== 'hasOne') continue

			const alias = rel.alias ?? aliasFromColumn(column, rel)
			const resource = rel.embedResource ?? rel.referencedTable
			const needsConstraintHint = resource === rel.referencedTable
			const fkSuffix = needsConstraintHint && rel.foreignKeyName ? `!${rel.foreignKeyName}` : ''

			const part = `${alias}:${resource}${fkSuffix}(*)`
			relationParts.push(part)
		}

		if (!relationParts.length) {
			return String(selectedBase || '*')
		}

		return [String(selectedBase || '*'), ...relationParts].join(', ')
	}

	// ------------------------------------------------------------
	// bindModel : plugge un useSupabaseModel sur le schema
	// ------------------------------------------------------------

	function bindModel<TRow, TRelations extends Record<string, unknown> = Record<never, never>>(model: {
		fetch: (query?: ModelQuery<string, Extract<keyof TRow, string>>) => Promise<TRow[]>
		refresh: (query?: ModelQuery<string, Extract<keyof TRow, string>>) => Promise<TRow[]>
	}) {
		/**
		 * Récupère une liste d'éléments avec :
		 * - select auto (relations) basé sur le schema
		 * - support de where, orderBy, limit, offset via model.fetch(query)
		 */
		const fetch = async <TInclude extends keyof TRelations & string = never>(
			query: ModelQuery<TInclude, Extract<keyof TRow, string>> = {},
		): Promise<Array<TRow & Pick<TRelations, TInclude>>> => {
			const select = query.select ?? buildSelectFromSchema(safeSchema, undefined, query.include)
			const finalQuery = { ...query, select }

			const rows = await model.fetch(finalQuery)
			return Array.isArray(rows) ? (rows as Array<TRow & Pick<TRelations, TInclude>>) : []
		}

		const refresh = async <TInclude extends keyof TRelations & string = never>(
			query: ModelQuery<TInclude, Extract<keyof TRow, string>> = {},
		): Promise<Array<TRow & Pick<TRelations, TInclude>>> => {
			const select = query.select ?? buildSelectFromSchema(safeSchema, undefined, query.include)
			const rows = await model.refresh({ ...query, select })
			return Array.isArray(rows) ? (rows as Array<TRow & Pick<TRelations, TInclude>>) : []
		}

		return { fetch, refresh }
	}

	return {
		fields,
		editableKeys,
		buildSelectFromSchema,
		createDraftFromSchema,
		emptyFromSchema,
		bindModel,
	}
}
