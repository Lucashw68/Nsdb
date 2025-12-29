// @lucashw68/nsdb/runtime/composables/useSupabaseModel.ts
import { useSupabaseApi, type OrderDirection, type WhereClause } from './useSupabaseApi'
import type { Ref } from 'vue'
import { ref } from 'vue'

export interface StoreLike<T> {
	items: Ref<T[]>
	getById: (id: string | number) => T | null
	create: (payload: Partial<T>) => Promise<T | null>
	update: (id: string | number, payload: Partial<T>) => Promise<T | null>
	remove: (id: string | number) => void | Promise<void>
	fetchFromSupabase: (query?: any) => Promise<T[]>
	subscribeToChanges?: () => void
}

type Options<T> =
	| boolean
	| { store?: boolean; storeCreator?: () => StoreLike<T> }

/**
 * Query "haut niveau" pour les modèles (wrap sur useSupabaseApi).
 */
export interface ModelQuery {
	select?: string
	where?: WhereClause
	/**
	 * Ex:
	 * - "created_at"
	 * - { created_at: "desc" }
	 * - { "book.title": "asc" }  // relation order (requires useSupabaseApi support)
	 */
	orderBy?: string | Record<string, OrderDirection>
	limit?: number
	offset?: number
}

/**
 * Résultat normalisé pour l'order.
 * - orderBy          : colonne (sans table) OU brut si pas de relation
 * - orderDirection   : 'asc' | 'desc'
 * - orderForeignTable: si order relationnel (ex: 'book' pour 'book.title')
 */
type NormalizedOrder = {
	orderBy: string
	orderDirection: OrderDirection
	orderForeignTable?: string
}

/**
 * Normalise un orderBy pour en extraire : colonne + direction (+ foreignTable optionnel).
 *
 * Supporte :
 * - "created_at"
 * - { created_at: "desc" }
 * - "book.title"
 * - { "book.title": "asc" }
 *
 * NOTE: le support réel de foreignTable nécessite `useSupabaseApi` (order(..., { foreignTable })).
 */
function normalizeOrder(rawOrderBy: ModelQuery['orderBy']): NormalizedOrder {
	let orderBy = 'id'
	let orderDirection: OrderDirection = 'asc'
	let orderForeignTable: string | undefined = undefined

	// 1) string form
	if (typeof rawOrderBy === 'string') {
		const parsed = parseOrderPath(rawOrderBy)
		orderBy = parsed.column
		orderForeignTable = parsed.foreignTable
		return { orderBy, orderDirection, orderForeignTable }
	}

	// 2) object form
	if (rawOrderBy && typeof rawOrderBy === 'object') {
		const [rawColumn, direction] = Object.entries(rawOrderBy)[0] as [
			string,
			OrderDirection | undefined
		]
		const parsed = parseOrderPath(rawColumn)

		orderBy = parsed.column
		orderForeignTable = parsed.foreignTable
		orderDirection = direction ?? 'asc'

		return { orderBy, orderDirection, orderForeignTable }
	}

	return { orderBy, orderDirection, orderForeignTable }
}

/**
 * Parse une clé d'orderBy potentiellement relationnelle.
 * - "created_at"  => { column: "created_at" }
 * - "book.title"  => { foreignTable: "book", column: "title" }
 *
 * Heuristique volontairement simple:
 * - 0 ou 1 "." : supporté
 * - >1 "." : on garde brut dans column (et foreignTable undefined), à améliorer plus tard si besoin.
 */
function parseOrderPath(path: string): { foreignTable?: string; column: string } {
	if (!path.includes('.')) {
		return { column: path }
	}

	const parts = path.split('.').filter(Boolean)
	if (parts.length === 2) {
		const [foreignTable, column] = parts
		return { foreignTable, column }
	}

	// cas complexe non supporté proprement pour l'instant
	return { column: path }
}

/**
 * Unified CRUD abstraction over a Supabase table.
 *
 * - Store mode (Pinia/offline)    : useSupabaseModel('table', { store: true, storeCreator })
 * - API mode (stateless, default) : useSupabaseModel('table')
 */
export function useSupabaseModel<TRow>(
	modelName: string,
	opts: Options<TRow> = false
) {
	const useStore = typeof opts === 'boolean' ? opts : !!opts.store
	const storeCreator =
		typeof opts === 'object' && opts.store ? opts.storeCreator : undefined

	// ############################################################
	// # STORE MODE (Pinia / offline)
	// ############################################################
	if (useStore) {
		if (!storeCreator) {
			throw new Error(
				`❌ useSupabaseModel("${modelName}", { store: true }) requires a storeCreator`
			)
		}

		const store = storeCreator()
		const noOp = () => {}

		return {
			items: store.items as Ref<TRow[]>,

			getById: async (id: string | number) =>
				(store.getById(id) as TRow | null) ?? null,

			create: store.create as (payload: Partial<TRow>) => Promise<TRow | null>,

			update: store.update as (
				id: string | number,
				payload: Partial<TRow>
			) => Promise<TRow | null>,

			remove: store.remove as (id: string | number) => void | Promise<void>,

			fetch: async (query?: ModelQuery) =>
				(await store.fetchFromSupabase(query)) as TRow[],

			sync: store.subscribeToChanges ?? noOp,
		}
	}

	// ############################################################
	// # API MODE (stateless)
	// ############################################################
	const api = useSupabaseApi()
	const items = ref<TRow[]>([])

	return {
		items,

		getById: async (id: string | number, select: string = '*') => {
			const response = await api.show<TRow>(modelName, id, select)
			return (response.data ?? null) as TRow | null
		},

		create: async (payload: Partial<TRow>) => {
			const response = await api.create<TRow>(modelName, payload)
			return (response.data ?? null) as TRow | null
		},

		update: async (id: string | number, payload: Partial<TRow>) => {
			const response = await api.update<TRow>(modelName, payload)
			return (response.data ?? null) as TRow | null
		},

		remove: async (id: string | number) => {
			await api.destroy(modelName, id)
		},

		fetch: async (query: ModelQuery = {}) => {
			const {
				select = '*',
				where,
				limit = 100,
				offset = 0,
			} = query

			const { orderBy, orderDirection, orderForeignTable } = normalizeOrder(query.orderBy)

			let data: TRow[] = []

			if (where && Object.keys(where).length > 0) {
				const response = await api.find<TRow>(modelName, {
					select,
					where,
					orderBy,
					orderDirection,
					orderForeignTable, // NEW
					limit,
					offset,
				} as any)

				data = (response.data ?? []) as TRow[]
			} else {
				const response = await api.all<TRow>(modelName, {
					select,
					orderBy,
					orderDirection,
					orderForeignTable, // NEW
					limit,
					offset,
				} as any)

				data = (response.data ?? []) as TRow[]
			}

			items.value = Array.isArray(data) ? data : []
			return items.value
		},

		sync: () => {},
	}
}
