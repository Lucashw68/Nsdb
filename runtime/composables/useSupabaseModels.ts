import { useSupabaseApi } from './useSupabaseApi'
import type { OrderDirection, WhereClause } from '@lucashw68/nsdb/types/list'
import type { Ref } from 'vue'
import { computed, isRef, ref } from 'vue'

export interface StoreLike<T> {
	items: Ref<T[]> | T[]
	totalCount?: Ref<number | null> | number | null
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

type ModelHandle<T> = {
	items: Ref<T[]>
	totalCount: Ref<number | null>
	getById: (id: string | number, select?: string) => Promise<T | null>
	create: (payload: Partial<T>) => Promise<T | null>
	update: (id: string | number, payload: Partial<T>) => Promise<T | null>
	remove: (id: string | number) => void | Promise<void>
	fetch: (query?: ModelQuery) => Promise<T[]>
	sync: () => void
}

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
	orderDirection?: OrderDirection
	orderForeignTable?: string

	limit?: number
	offset?: number

	/**
	 * Recherche texte (implémentée par useSupabaseApi via `.or(... ilike ...)`)
	 */
	search?: string
	searchColumns?: string[]

	/**
	 * Options utilisées uniquement en mode store/cache.
	 * En mode API direct, elles sont ignorées.
	 */
	force?: boolean
	merge?: boolean
	staleTimeMs?: number
}

/**
 * Résultat normalisé pour l'order.
 */
type NormalizedOrder = {
	orderBy: string
	orderDirection: OrderDirection
	orderForeignTable?: string
}

function normalizeStoreItems<T>(store: StoreLike<T>): Ref<T[]> {
	if (isRef(store.items)) return store.items

	return computed({
		get: () => store.items as T[],
		set: (value) => {
			;(store as any).items = value
		},
	})
}

function normalizeStoreTotalCount<T>(store: StoreLike<T>): Ref<number | null> {
	if (isRef(store.totalCount)) return store.totalCount

	return computed({
		get: () => typeof store.totalCount === 'number' ? store.totalCount : null,
		set: (value) => {
			;(store as any).totalCount = value
		},
	})
}

function parseOrderPath(path: string): { foreignTable?: string; column: string } {
	if (!path.includes('.')) return { column: path }

	const parts = path.split('.').filter(Boolean)
	if (parts.length === 2) {
		const foreignTable = parts[0]
		const column = parts[1]
		if (!foreignTable || !column) return { column: path }
		return { foreignTable, column }
	}

	// cas non supporté proprement (ex: a.b.c)
	return { column: path }
}

function normalizeOrder(
	rawOrderBy: ModelQuery['orderBy'],
	rawOrderDirection?: OrderDirection,
	rawOrderForeignTable?: string
): NormalizedOrder {
	let orderBy = 'id'
	let orderDirection: OrderDirection = rawOrderDirection ?? 'asc'
	let orderForeignTable: string | undefined = rawOrderForeignTable

	if (typeof rawOrderBy === 'string') {
		const parsed = parseOrderPath(rawOrderBy)
		orderBy = parsed.column
		orderForeignTable = parsed.foreignTable ?? rawOrderForeignTable
		return { orderBy, orderDirection, orderForeignTable }
	}

	if (rawOrderBy && typeof rawOrderBy === 'object') {
		const [rawColumn, direction] = Object.entries(rawOrderBy)[0] as [
			string,
			OrderDirection | undefined
		]
		const parsed = parseOrderPath(rawColumn)

		orderBy = parsed.column
		orderForeignTable = parsed.foreignTable ?? rawOrderForeignTable
		orderDirection = direction ?? rawOrderDirection ?? 'asc'

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
): ModelHandle<TRow> {
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
		const storeItems = normalizeStoreItems(store)
		const totalCount = normalizeStoreTotalCount(store)

		const getById = async (id: string | number) =>
			(store.getById(id) as TRow | null) ?? null
		const create = store.create as (payload: Partial<TRow>) => Promise<TRow | null>
		const update = store.update as (
			id: string | number,
			payload: Partial<TRow>
		) => Promise<TRow | null>
		const remove = store.remove as (id: string | number) => void | Promise<void>
		const fetch = async (query?: ModelQuery) =>
			(await store.fetchFromSupabase(query)) as TRow[]

		return {
			items: storeItems,
			totalCount,
			getById,
			create,
			update,
			remove,
			fetch,
			sync: store.subscribeToChanges ?? noOp,
		}
	}

	// ############################################################
	// # API MODE (stateless)
	// ############################################################
	const api = useSupabaseApi()
	const items = ref<TRow[]>([])
	const typedItems = items as unknown as Ref<TRow[]>
	const totalCount = ref<number | null>(null)

	const getById = async (id: string | number, select: string = '*') => {
		const response = await api.show<TRow>(modelName, id, select)
		return (response.data ?? null) as TRow | null
	}

	const create = async (payload: Partial<TRow>) => {
		const response = await api.create<TRow>(modelName, payload)
		return (response.data ?? null) as TRow | null
	}

	const update = async (id: string | number, payload: Partial<TRow>) => {
		const response = await api.update<TRow>(modelName, id, payload)
		if (Array.isArray(response.data)) {
			return (response.data[0] ?? null) as TRow | null
		}

		return (response.data ?? null) as TRow | null
	}

	const remove = async (id: string | number) => {
		await api.destroy(modelName, id)
	}

	const fetch = async (query: ModelQuery = {}) => {
		const {
			select = '*',
			where,
			limit = 100,
			offset = 0,
			search,
			searchColumns,
		} = query

		const { orderBy, orderDirection, orderForeignTable } = normalizeOrder(
			query.orderBy,
			query.orderDirection,
			query.orderForeignTable
		)

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
		totalCount.value = count ?? null

		return items.value as TRow[]
	}

	return {
		items: typedItems,
		totalCount,
		getById,
		create,
		update,
		remove,
		fetch,
		sync: () => {},
	}
}
