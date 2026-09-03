import { useSupabaseApi } from './useSupabaseApi'
import { useSupabaseClient, useSupabaseUser } from '#imports'
import type { ModelHandle, ModelQuery } from '@lucashw68/nsdb/types/model'
import type { OrderDirection } from '@lucashw68/nsdb/types/list'
import type { Ref } from 'vue'
import { computed, isRef, ref, watch } from 'vue'
import { isComplexCollectionQuery, sortCollection } from '../utils/dataFreshness'

type MutationPayload = Record<string, unknown> | Record<string, unknown>[]

export interface StoreLike<T, TInsert = Partial<T>, TUpdate = Partial<T>> {
	items: Ref<T[]> | T[]
	totalCount?: Ref<number | null> | number | null
	loading?: Ref<boolean> | boolean
	error?: Ref<unknown> | unknown
	stale?: Ref<boolean> | boolean
	getById: (id: string | number) => T | null
	create: (payload: TInsert) => Promise<T | null>
	update: (id: string | number, payload: TUpdate) => Promise<T | null>
	remove: (id: string | number) => void | Promise<void>
	fetchFromSupabase: (query?: any) => Promise<T[]>
	subscribe?: () => void
	unsubscribe?: () => void | Promise<void>
	refresh?: (query?: any) => Promise<T[]>
	invalidate?: () => void
}

type Options<T, TInsert, TUpdate> =
	| boolean
	| { store?: boolean; storeCreator?: () => StoreLike<T, TInsert, TUpdate>; primaryKey?: string }

export type { ModelHandle, ModelQuery } from '@lucashw68/nsdb/types/model'

/**
 * Résultat normalisé pour l'order.
 */
type NormalizedOrder = {
	orderBy: string
	orderDirection: OrderDirection
	orderForeignTable?: string
}

function normalizeStoreItems<T>(store: { items: Ref<T[]> | T[] }): Ref<T[]> {
	if (isRef(store.items)) return store.items

	return computed({
		get: () => store.items as T[],
		set: (value) => {
			;(store as any).items = value
		},
	})
}

function normalizeStoreTotalCount(store: { totalCount?: Ref<number | null> | number | null }): Ref<number | null> {
	if (isRef(store.totalCount)) return store.totalCount

	return computed({
		get: () => typeof store.totalCount === 'number' ? store.totalCount : null,
		set: (value) => {
			;(store as any).totalCount = value
		},
	})
}

function normalizeStoreRef<T>(store: Record<string, any>, key: string, fallback: T): Ref<T> {
	if (isRef(store[key])) return store[key] as Ref<T>
	return computed({
		get: () => (store[key] ?? fallback) as T,
		set: value => { store[key] = value },
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
	rawOrderBy: ModelQuery<string, string>['orderBy'],
	rawOrderDirection?: OrderDirection,
	rawOrderForeignTable?: string,
	defaultOrderBy: string = 'id',
): NormalizedOrder {
	let orderBy = defaultOrderBy
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
export function useSupabaseModel<
	TRow,
	TInsert = Partial<TRow>,
	TUpdate = Partial<TRow>,
>(
	modelName: string,
	opts: Options<TRow, TInsert, TUpdate> = false
): ModelHandle<TRow, TInsert, TUpdate> {
	const useStore = typeof opts === 'boolean' ? opts : !!opts.store
	const storeCreator =
		typeof opts === 'object' && opts.store ? opts.storeCreator : undefined
	const primaryKey = typeof opts === 'object' ? opts.primaryKey ?? 'id' : 'id'
	type RowQuery = ModelQuery<string, Extract<keyof TRow, string>>

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
		const loading = normalizeStoreRef<boolean>(store as any, 'loading', false)
		const error = normalizeStoreRef<unknown>(store as any, 'error', null)
		const stale = normalizeStoreRef<boolean>(store as any, 'stale', true)

		const getById = async (id: string | number) =>
			(store.getById(id) as TRow | null) ?? null
		const create = store.create as (payload: TInsert) => Promise<TRow | null>
		const update = store.update as (
			id: string | number,
			payload: TUpdate
		) => Promise<TRow | null>
		const remove = store.remove as (id: string | number) => Promise<void>
		const fetch = async (query?: RowQuery) =>
			(await store.fetchFromSupabase(query)) as TRow[]
		const refresh = async (query?: RowQuery) => store.refresh
			? await store.refresh(query) as TRow[]
			: await store.fetchFromSupabase(query) as TRow[]
		const invalidate = store.invalidate ?? noOp
		const subscribe = store.subscribe ?? noOp
		const unsubscribe = store.unsubscribe ?? noOp

		return {
			items: storeItems,
			totalCount,
			loading,
			error,
			stale,
			getById,
			create,
			update,
			remove,
			fetch,
			refresh,
			invalidate,
			subscribe,
			unsubscribe,
		}
	}

	// ############################################################
	// # API MODE (stateless)
	// ############################################################
	const api = useSupabaseApi()
	const supabase = useSupabaseClient()
	const supabaseUser = useSupabaseUser()
	const items = ref<TRow[]>([])
	const typedItems = items as unknown as Ref<TRow[]>
	const totalCount = ref<number | null>(null)
	const loading = ref(false)
	const error = ref<unknown>(null)
	const stale = ref(true)
	let fetchSequence = 0
	let collectionRevision = 0
	let currentQuery: RowQuery = {}
	let subscription: ReturnType<typeof supabase.channel> | null = null
	let subscriptionOwnerId: string | null = null
	const normalizedCurrentQuery = () => {
		const order = normalizeOrder(currentQuery.orderBy, currentQuery.orderDirection, currentQuery.orderForeignTable, primaryKey)
		return { ...currentQuery, ...order }
	}

	const itemKey = (item: TRow) => (item as Record<string, unknown>)[primaryKey]
	const addOrUpdate = (item: TRow) => {
		const id = itemKey(item)
		const index = typedItems.value.findIndex(candidate => itemKey(candidate) === id)
		if (index < 0) typedItems.value = [item, ...typedItems.value]
		else {
			const next = [...typedItems.value]
			next[index] = item
			typedItems.value = next
		}
	}
	const invalidate = () => {
		collectionRevision++
		stale.value = true
	}
	const mutationSucceeded = () => {
		invalidate()
		if (isComplexCollectionQuery(normalizedCurrentQuery())) totalCount.value = null
	}

	const getById = async (id: string | number, select: string = '*') => {
		const response = await api.getById<TRow>(modelName, id, { key: primaryKey, select })
		if (!response.success) throw response.error
		return (response.data ?? null) as TRow | null
	}

	const create = async (payload: TInsert) => {
		const response = await api.create<TRow>(modelName, payload as MutationPayload)
		if (!response.success) throw response.error
		const created = (response.data ?? null) as TRow | null
		if (created) {
			mutationSucceeded()
			const activeQuery = normalizedCurrentQuery()
			if (!isComplexCollectionQuery(activeQuery)) {
				addOrUpdate(created)
				typedItems.value = sortCollection(typedItems.value as Record<string, any>[], activeQuery).slice(0, activeQuery.limit ?? 100) as TRow[]
				if (totalCount.value != null) totalCount.value++
			}
		}
		return created
	}

	const update = async (id: string | number, payload: TUpdate) => {
		const response = await api.update<TRow>(modelName, id, payload as MutationPayload, { key: primaryKey })
		if (!response.success) throw response.error
		const updated = (Array.isArray(response.data) ? response.data[0] : response.data) as TRow | null
		if (updated) {
			mutationSucceeded()
			const activeQuery = normalizedCurrentQuery()
			if (!isComplexCollectionQuery(activeQuery)) {
				addOrUpdate(updated)
				typedItems.value = sortCollection(typedItems.value as Record<string, any>[], activeQuery) as TRow[]
			}
		}
		return updated ?? null
	}

	const remove = async (id: string | number) => {
		const response = await api.remove(modelName, id, { key: primaryKey })
		if (!response.success) throw response.error
		const existed = typedItems.value.some(item => itemKey(item) === id)
		mutationSucceeded()
		typedItems.value = typedItems.value.filter(item => itemKey(item) !== id)
		if (!isComplexCollectionQuery(normalizedCurrentQuery()) && existed && totalCount.value != null) totalCount.value--
	}

	const fetch = async (query: RowQuery = {}) => {
		const requestId = ++fetchSequence
		const startingRevision = collectionRevision
		currentQuery = query
		loading.value = true
		error.value = null
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
			query.orderForeignTable,
			primaryKey,
		)

		let data: TRow[] = []
		let count: number | null = null

		try {
			const response = await api.all<TRow>(modelName, {
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
			if (!response.success) throw response.error

			data = (response.data ?? []) as TRow[]
			count = response.count ?? null

		// Latest request wins: rapid search/filter changes must not let an older
		// response overwrite the state already produced by a newer query.
		if (requestId === fetchSequence && startingRevision === collectionRevision) {
			typedItems.value = Array.isArray(data) ? data : []
			totalCount.value = count ?? null
			stale.value = false
		}

		return (Array.isArray(data) ? data : []) as TRow[]
		} catch (fetchError) {
			error.value = fetchError
			stale.value = true
			throw fetchError
		} finally {
			if (requestId === fetchSequence) loading.value = false
		}
	}

	const refresh = (query: RowQuery = currentQuery) => fetch(query)

	const subscribe = () => {
		if (typeof window === 'undefined' || subscription) return
		subscriptionOwnerId = supabaseUser.value?.id ?? null
		subscription = supabase.channel(`public:${modelName}`)
			.on('postgres_changes', { event: '*', schema: 'public', table: modelName }, (payload: any) => {
				if (subscriptionOwnerId !== (supabaseUser.value?.id ?? null)) return
				invalidate()
				if (isComplexCollectionQuery(normalizedCurrentQuery())) return
				if (payload.eventType === 'DELETE') typedItems.value = typedItems.value.filter(item => itemKey(item) !== payload.old?.[primaryKey])
				else if (payload.new) {
					addOrUpdate(payload.new as TRow)
					typedItems.value = sortCollection(typedItems.value as Record<string, any>[], normalizedCurrentQuery()) as TRow[]
				}
			})
			.subscribe()
	}
	const unsubscribe = async () => {
		const active = subscription
		subscription = null
		subscriptionOwnerId = null
		if (!active) return
		if (typeof (supabase as any).removeChannel === 'function') await (supabase as any).removeChannel(active)
		else await active.unsubscribe()
	}
	watch(() => supabaseUser.value?.id ?? null, () => {
		void unsubscribe()
		typedItems.value = []
		totalCount.value = null
		invalidate()
	})

	return {
		items: typedItems,
		totalCount,
		loading,
		error,
		stale,
		getById,
		create,
		update,
		remove,
		fetch,
		refresh,
		invalidate,
		subscribe,
		unsubscribe,
	}
}
