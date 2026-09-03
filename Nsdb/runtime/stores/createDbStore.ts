import { computed, shallowRef, ref, watch } from 'vue'
import { defineStore, useSupabaseClient, useSupabaseUser } from '#imports'
import { useSupabaseApi } from '../composables/useSupabaseApi'
import { isComplexCollectionQuery, sortCollection, stableQueryKey } from '../utils/dataFreshness'
import type { ListOptions } from '@lucashw68/nsdb/types/list'

export type DbStoreFetchOptions = ListOptions & {
	merge?: boolean
	staleTimeMs?: number
}

export function createDbStore<T extends Record<string, any>>(resource: string, options: {
	key?: keyof T
	orderBy?: keyof T
	defaultSort?: 'asc' | 'desc'
	staleTimeMs?: number
	persist?: boolean
	scopeToUser?: boolean
}) {
	const key = options.key || 'id'
	const orderBy = options.orderBy || key
	const sortDir = options.defaultSort || 'desc'
	const defaultStaleTimeMs = options.staleTimeMs ?? 30_000
	const shouldPersist = options.persist ?? false
	const shouldScopeToUser = options.scopeToUser ?? true

	return defineStore(`db_${resource}`, () => {
		const supabase = useSupabaseClient()
		const supabaseUser = useSupabaseUser()
		const api = useSupabaseApi()
		const items = shallowRef<T[]>([])
		const totalCount = ref<number | null>(null)
		const loading = ref(false)
		const error = ref<any>(null)
		const lastFetchedAt = ref<number | null>(null)
		const lastQueryKey = ref<string | null>(null)
		const scopeOwnerId = ref<string | null>(null)
		const hydrationReady = ref(!shouldPersist || !shouldScopeToUser)
		const stale = ref(true)
		const cachedQueries = new Map<string, { rows: T[]; count: number | null; fetchedAt: number }>()
		const inFlightQueries = new Map<string, Promise<T[]>>()
		const maxCachedQueries = 20
		let hydrationValidation: Promise<void> | null = null
		let currentQuery: ListOptions = getDefaultQuery()
		let collectionRevision = 0
		let fetchSequence = 0
		let subscription: ReturnType<typeof supabase.channel> | null = null
		let subscriptionOwnerId: string | null = null
		let realtimeRequested = false
		let realtimeDisconnected = false

		function resetData() {
			items.value = []
			totalCount.value = null
			loading.value = false
			error.value = null
			lastFetchedAt.value = null
			lastQueryKey.value = null
			stale.value = true
			cachedQueries.clear()
			inFlightQueries.clear()
			collectionRevision++
		}

		function reconcileUserScope(userId: string | null) {
			if (!shouldScopeToUser) return
			if (scopeOwnerId.value !== userId) {
				void unsubscribe(false)
				resetData()
			}
			scopeOwnerId.value = userId
			if (realtimeRequested && userId) queueMicrotask(() => subscribe())
		}

		function reset() {
			realtimeRequested = false
			void unsubscribe(false)
			resetData()
			if (shouldScopeToUser) scopeOwnerId.value = supabaseUser.value?.id ?? null
		}

		function quarantineHydratedState() {
			if (!shouldPersist || !shouldScopeToUser) {
				hydrationReady.value = true
				return Promise.resolve()
			}

			const hydrated = {
				items: [...items.value],
				totalCount: totalCount.value,
				lastFetchedAt: lastFetchedAt.value,
				lastQueryKey: lastQueryKey.value,
				ownerId: scopeOwnerId.value,
			}

			// Persisted rows must disappear synchronously, before Vue can render them.
			resetData()
			scopeOwnerId.value = null
			hydrationReady.value = false

			hydrationValidation = (async () => {
				try {
					const { data, error: sessionError } = await supabase.auth.getSession()
					const sessionUserId = sessionError ? null : data?.session?.user?.id ?? null
					const resolvedUserId = supabaseUser.value?.id ?? sessionUserId

					if (resolvedUserId && hydrated.ownerId === resolvedUserId) {
						items.value = hydrated.items
						totalCount.value = hydrated.totalCount
						lastFetchedAt.value = hydrated.lastFetchedAt
						lastQueryKey.value = hydrated.lastQueryKey
					}

					scopeOwnerId.value = resolvedUserId
			} finally {
				hydrationReady.value = true
				hydrationValidation = null
			}
		})()

			return hydrationValidation
		}

		async function waitForHydrationValidation() {
			if (hydrationValidation) await hydrationValidation
		}

		if (shouldScopeToUser) {
			watch(
				() => supabaseUser.value?.id ?? null,
				(newUserId) => reconcileUserScope(newUserId),
				{ immediate: true },
			)
		}

		function getItemKey(item: Partial<T> | Record<string, any>) {
			return item?.[key as string] as string | number | undefined
		}

		function getDefaultQuery(): ListOptions {
			return {
				orderBy: String(orderBy),
				orderDirection: sortDir,
				limit: 100,
				offset: 0,
			}
		}

		function getQuerySignature(query: ListOptions) {
			return stableQueryKey({
				select: query.select ?? '*',
				where: query.where ?? null,
				orderBy: query.orderBy ?? null,
				orderDirection: query.orderDirection ?? null,
				orderForeignTable: query.orderForeignTable ?? null,
				limit: query.limit ?? null,
				offset: query.offset ?? null,
				search: query.search ?? null,
				searchColumns: query.searchColumns ?? [],
			})
		}

		const cachedCount = computed(() => items.value.length)

		const mergeItems = (newItems: T[]) => {
			const map = new Map<string | number | undefined, T>(items.value.map(item => [getItemKey(item), item]))
			for (const newItem of newItems) {
				map.set(getItemKey(newItem), newItem)
			}
			items.value = Array.from(map.values()).filter(Boolean) as T[]
		}

		const replaceItems = (newItems: T[]) => {
			items.value = [...newItems]
		}

		const addOrUpdate = (item: T) => {
			const itemKey = getItemKey(item)
			const index = items.value.findIndex(candidate => getItemKey(candidate) === itemKey)
			if (index !== -1) {
				const nextItems = [...items.value]
				nextItems[index] = item
				items.value = nextItems
			}
			else items.value = [item, ...items.value]
		}

		const removeLocal = (id: string | number) => {
			items.value = items.value.filter(item => getItemKey(item) !== id)
		}

		function rememberQuery(signature: string, entry: { rows: T[]; count: number | null; fetchedAt: number }) {
			cachedQueries.delete(signature)
			cachedQueries.set(signature, entry)
			while (cachedQueries.size > maxCachedQueries) {
				const oldest = cachedQueries.keys().next().value
				if (oldest === undefined) break
				cachedQueries.delete(oldest)
			}
		}

		function invalidate() {
			collectionRevision++
			cachedQueries.clear()
			lastQueryKey.value = null
			stale.value = true
		}

		function markMutation() {
			invalidate()
			if (isComplexCollectionQuery(currentQuery)) totalCount.value = null
		}

		const getById = (id: string | number) => {
			return items.value.find(item => getItemKey(item) === id) || null
		}

		const fetchFromSupabaseInternal = async (query: DbStoreFetchOptions = {}, bypassCache = false) => {
			await waitForHydrationValidation()
			reconcileUserScope(supabaseUser.value?.id ?? null)
			const {
				merge = false,
				staleTimeMs = defaultStaleTimeMs,
				...queryOptions
			} = query
			const finalQuery: ListOptions = {
				...getDefaultQuery(),
				...queryOptions,
			}
			const querySignature = getQuerySignature(finalQuery)
			currentQuery = finalQuery
			let cachedQuery = cachedQueries.get(querySignature)
			const now = Date.now()
			if (!cachedQuery && lastQueryKey.value === querySignature && lastFetchedAt.value != null) {
				cachedQuery = { rows: [...items.value], count: totalCount.value, fetchedAt: lastFetchedAt.value }
			}

			if (!bypassCache && cachedQuery && now - cachedQuery.fetchedAt < staleTimeMs) {
				if (merge) mergeItems(cachedQuery.rows)
				else replaceItems(cachedQuery.rows)
				totalCount.value = cachedQuery.count
				lastFetchedAt.value = cachedQuery.fetchedAt
				lastQueryKey.value = querySignature
				stale.value = false
				error.value = null
				rememberQuery(querySignature, cachedQuery)
				return cachedQuery.rows
			}
			const inFlightKey = `${querySignature}:${merge ? 'merge' : 'replace'}`
			const pending = inFlightQueries.get(inFlightKey)
			if (!bypassCache && pending) return pending

			const requestId = ++fetchSequence
			const startingRevision = collectionRevision
			loading.value = true
			error.value = null

			const request = (async () => {
			try {
				const response = await api.all<T>(resource, finalQuery)

				if (!response.success) {
					error.value = response.error
					throw response.error
				}

				const rows = Array.isArray(response.data) ? response.data : []

				if (requestId === fetchSequence && startingRevision === collectionRevision) {
					if (merge) mergeItems(rows)
					else replaceItems(rows)
					totalCount.value = response.count ?? null
					lastFetchedAt.value = Date.now()
					lastQueryKey.value = querySignature
					stale.value = false
					rememberQuery(querySignature, { rows, count: response.count ?? null, fetchedAt: Date.now() })
				}

				return rows
			} catch (fetchError) {
				console.error(`[${resource}] fetch error`, fetchError)
				error.value = fetchError
				stale.value = true
				throw fetchError
			} finally {
				if (requestId === fetchSequence) loading.value = false
				inFlightQueries.delete(inFlightKey)
			}
			})()
			inFlightQueries.set(inFlightKey, request)
			return request
		}
		const fetchFromSupabase = (query: DbStoreFetchOptions = {}) => fetchFromSupabaseInternal(query)

		const refresh = (query: DbStoreFetchOptions = {}) => fetchFromSupabaseInternal({ ...currentQuery, ...query }, true)

		const create = async (payload: Partial<T>): Promise<T | null> => {
			await waitForHydrationValidation()
			reconcileUserScope(supabaseUser.value?.id ?? null)
			const response = await api.create<T>(resource, payload)

			if (!response.success) {
				console.error(`[${resource}] create error`, response.error)
				throw response.error
			}

			const data = response.data as T
			markMutation()
			if (!isComplexCollectionQuery(currentQuery)) {
				addOrUpdate(data)
				items.value = sortCollection(items.value, currentQuery).slice(0, currentQuery.limit ?? 100)
				if (totalCount.value != null) totalCount.value++
			}
			return data
		}

		const update = async (id: string | number, payload: Partial<T>): Promise<T | null> => {
			await waitForHydrationValidation()
			reconcileUserScope(supabaseUser.value?.id ?? null)
			const response = await api.update<T>(resource, id, payload, { key: String(key) })

			if (!response.success) {
				console.error(`[${resource}] update error`, response.error)
				throw response.error
			}

			const data = Array.isArray(response.data) ? response.data[0] : response.data
			if (data) {
				markMutation()
				if (!isComplexCollectionQuery(currentQuery)) {
					addOrUpdate(data as T)
					items.value = sortCollection(items.value, currentQuery)
				}
			}
			return (data as T | undefined) ?? null
		}

		const remove = async (id: string | number) => {
			await waitForHydrationValidation()
			reconcileUserScope(supabaseUser.value?.id ?? null)
			const response = await api.remove(resource, id, { key: String(key) })

			if (!response.success) {
				console.error(`[${resource}] delete error`, response.error)
				throw response.error
			}

			const existed = !!getById(id)
			markMutation()
			removeLocal(id)
			if (!isComplexCollectionQuery(currentQuery) && existed && totalCount.value != null) totalCount.value--
		}

		const subscribe = () => {
			realtimeRequested = true
			if (typeof window === 'undefined' || subscription) return
			subscriptionOwnerId = supabaseUser.value?.id ?? null

			subscription = supabase
				.channel(`public:${resource}`)
				.on('postgres_changes', {
					event: '*',
					schema: 'public',
					table: resource
				}, (payload: any) => {
					if (shouldScopeToUser && subscriptionOwnerId !== (supabaseUser.value?.id ?? null)) return
					const { eventType, new: newItem, old } = payload
					invalidate()
					if (isComplexCollectionQuery(currentQuery)) return
					if (eventType === 'INSERT' || eventType === 'UPDATE') {
						addOrUpdate(newItem as T)
						items.value = sortCollection(items.value, currentQuery)
					} else if (eventType === 'DELETE') {
						removeLocal(old?.[key as string])
					}
				})
				.subscribe((status: string, statusError?: unknown) => {
					if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
						realtimeDisconnected = true
						stale.value = true
						if (statusError) error.value = statusError
					}
					else if (status === 'SUBSCRIBED' && realtimeDisconnected) {
						realtimeDisconnected = false
						invalidate()
						void refresh().catch(() => {})
					}
				})

			console.info(`[${resource}] realtime subscription initialized`)
		}

		async function unsubscribe(clearIntent = true) {
			if (clearIntent) realtimeRequested = false
			const active = subscription
			subscription = null
			subscriptionOwnerId = null
			realtimeDisconnected = false
			if (!active) return
			if (typeof (supabase as any).removeChannel === 'function') await (supabase as any).removeChannel(active)
			else await active.unsubscribe()
		}

		return {
			items,
			totalCount,
			cachedCount,
			loading,
			error,
			stale,
			lastFetchedAt,
			lastQueryKey,
			scopeOwnerId,
			hydrationReady,
			fetchFromSupabase,
			refresh,
			invalidate,
			addOrUpdate,
			removeLocal,
			reset,
			remove,
			getById,
			create,
			update,
			subscribe,
			unsubscribe,
			reconcileUserScope,
			quarantineHydratedState,
		}
	}, {
		persist: shouldPersist
			? {
				pick: ['items', 'totalCount', 'lastFetchedAt', 'lastQueryKey', 'scopeOwnerId'],
				afterHydrate: ({ store }: { store: { quarantineHydratedState?: () => Promise<void> } }) => {
					void store.quarantineHydratedState?.()
				},
			}
			: false,
	} as any)
}
