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
	 * - "book.title"
	 * - { "book.title": "asc" }
	 */
	orderBy?: string | Record<string, OrderDirection>

	limit?: number
	offset?: number

	/**
	 * Recherche texte (implémentée par useSupabaseApi via `.or(... ilike ...)`)
	 */
	search?: string
	searchColumns?: string[]
}

/**
 * Résultat normalisé pour l'order.
 */
type NormalizedOrder = {
	orderBy: string
	orderDirection: OrderDirection
	orderForeignTable?: string
}

function parseOrderPath(path: string): { foreignTable?: string; column: string } {
	if (!path.includes('.')) return { column: path }

	const parts = path.split('.').filter(Boolean)
	if (parts.length === 2) {
		const [foreignTable, column] = parts
		return { foreignTable, column }
	}

	// cas non supporté proprement (ex: a.b.c)
	return { column: path }
}

function normalizeOrder(rawOrderBy: ModelQuery['orderBy']): NormalizedOrder {
	let orderBy = 'id'
	let orderDirection: OrderDirection = 'asc'
	let orderForeignTable: string | undefined

	if (typeof rawOrderBy === 'string') {
		const parsed = parseOrderPath(rawOrderBy)
		orderBy = parsed.column
		orderForeignTable = parsed.foreignTable
		return { orderBy, orderDirection, orderForeignTable }
	}

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
 * Unified CRUD abstraction over a Supabase table.
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

		// ⚠️ En mode store, on ne peut pas garantir le count (sauf si ton store le gère)
		const totalCount = ref<number | null>(null)

		return {
			items: store.items as Ref<TRow[]>,
			totalCount,

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
	const totalCount = ref<number | null>(null)

	return {
		items,
		totalCount,

		getById: async (id: string | number, select: string = '*') => {
			const response = await api.show<TRow>(modelName, id, select)
			return (response.data ?? null) as TRow | null
		},

		create: async (payload: Partial<TRow>) => {
			const response = await api.create<TRow>(modelName, payload)
			return (response.data ?? null) as TRow | null
		},

		// ✅ Important: api.update(resource, id, payload)
		update: async (id: string | number, payload: Partial<TRow>) => {
			const response = await api.update<TRow>(modelName, id, payload)
			// selon ton api.update, ça peut renvoyer T[] : on ne force pas ici
			return (response.data ?? null) as any
		},

		remove: async (id: string | number) => {
			await api.destroy(modelName, id)
		},

		/**
		 * fetch() met à jour:
		 * - items.value
		 * - totalCount.value (si useSupabaseApi renvoie count)
		 */
		fetch: async (query: ModelQuery = {}) => {
			const {
				select = '*',
				where,
				limit = 100,
				offset = 0,
				search,
				searchColumns,
			} = query

			const { orderBy, orderDirection, orderForeignTable } = normalizeOrder(query.orderBy)

			let data: TRow[] = []
			let count: number | null = null

			if (where && Object.keys(where).length > 0) {
				const response = await api.find<TRow>(modelName, {
					select,
					where,
					orderBy,
					orderDirection,
					orderForeignTable,
					limit,
					offset,
					search,
					searchColumns,
				})

				data = (response.data ?? []) as TRow[]
				count = response.count ?? null
			} else {
				const response = await api.all<TRow>(modelName, {
					select,
					orderBy,
					orderDirection,
					orderForeignTable,
					limit,
					offset,
					search,
					searchColumns,
				})

				data = (response.data ?? []) as TRow[]
				count = response.count ?? null
			}

			items.value = Array.isArray(data) ? data : []
			totalCount.value = typeof count === 'number' ? count : null

			return items.value
		},

		sync: () => {},
	}
}
