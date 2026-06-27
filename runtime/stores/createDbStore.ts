import { computed, shallowRef, ref, watch } from 'vue'
import { defineStore, useSupabaseClient, useSupabaseUser } from '#imports'
import { useSupabaseApi } from '../composables/useSupabaseApi'
import type { ListOptions } from '@lucashw68/nsdb/types/list'

export type DbStoreFetchOptions = ListOptions & {
	force?: boolean
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
	const shouldPersist = options.persist ?? true
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
		const cachedQueries = new Map<string, { rows: T[]; fetchedAt: number }>()

		let subscription: ReturnType<typeof supabase.channel> | null = null

		function reset() {
			items.value = []
			totalCount.value = null
			loading.value = false
			error.value = null
			lastFetchedAt.value = null
			cachedQueries.clear()
		}

		if (shouldScopeToUser) {
			watch(
				() => supabaseUser.value?.id ?? null,
				(newUserId, previousUserId) => {
					if (previousUserId !== undefined && newUserId !== previousUserId) {
						reset()
					}
				}
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
			return JSON.stringify({
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
			if (index !== -1) items.value[index] = item
			else items.value.unshift(item)
		}

		const removeLocal = (id: string | number) => {
			items.value = items.value.filter(item => getItemKey(item) !== id)
		}

		const getById = (id: string | number) => {
			return items.value.find(item => getItemKey(item) === id) || null
		}

		const fetchFromSupabase = async (query: DbStoreFetchOptions = {}) => {
			loading.value = true
			error.value = null

			const {
				force = false,
				merge = true,
				staleTimeMs = defaultStaleTimeMs,
				...queryOptions
			} = query
			const finalQuery: ListOptions = {
				...getDefaultQuery(),
				...queryOptions,
			}
			const querySignature = getQuerySignature(finalQuery)
			const cachedQuery = cachedQueries.get(querySignature)
			const now = Date.now()

			if (!force && cachedQuery && now - cachedQuery.fetchedAt < staleTimeMs) {
				loading.value = false
				return cachedQuery.rows
			}

			try {
				const response = finalQuery.where && Object.keys(finalQuery.where).length > 0
					? await api.find<T>(resource, finalQuery)
					: await api.all<T>(resource, finalQuery)

				if (!response.success) {
					error.value = response.error
					throw response.error
				}

				const rows = Array.isArray(response.data) ? response.data : []

				if (merge) mergeItems(rows)
				else replaceItems(rows)

				totalCount.value = response.count ?? null
				lastFetchedAt.value = now
				cachedQueries.set(querySignature, { rows, fetchedAt: now })

				return rows
			} catch (fetchError) {
				console.error(`[${resource}] fetch error`, fetchError)
				error.value = fetchError
				return []
			} finally {
				loading.value = false
			}
		}

		const create = async (payload: Partial<T>): Promise<T | null> => {
			const response = await api.create<T>(resource, payload)

			if (!response.success) {
				console.error(`[${resource}] create error`, response.error)
				throw response.error
			}

			const data = response.data as T
			addOrUpdate(data)
			return data
		}

		const update = async (id: string | number, payload: Partial<T>): Promise<T | null> => {
			const response = await api.update<T>(resource, id, payload)

			if (!response.success) {
				console.error(`[${resource}] update error`, response.error)
				throw response.error
			}

			const data = Array.isArray(response.data) ? response.data[0] : response.data
			if (data) addOrUpdate(data as T)
			return (data as T | undefined) ?? null
		}

		const destroy = async (id: string | number) => {
			const response = await api.destroy(resource, id)

			if (!response.success) {
				console.error(`[${resource}] delete error`, response.error)
				throw response.error
			}

			removeLocal(id)
		}

		const subscribeToChanges = () => {
			if (subscription) return // déjà abonné

			subscription = supabase
				.channel(`public:${resource}`)
				.on('postgres_changes', {
					event: '*',
					schema: 'public',
					table: resource
				}, (payload: any) => {
					const { eventType, new: newItem, old } = payload

					if (eventType === 'INSERT' || eventType === 'UPDATE') {
						addOrUpdate(newItem as T)
					} else if (eventType === 'DELETE') {
						removeLocal(old?.[key as string])
					}
				})
				.subscribe()

			console.info(`[${resource}] realtime subscription initialized`)
		}

		return {
			items,
			totalCount,
			cachedCount,
			loading,
			error,
			lastFetchedAt,
			fetchFromSupabase,
			addOrUpdate,
			removeLocal,
			reset,
			remove: destroy,
			destroy,
			getById,
			create,
			update,
			subscribeToChanges
		}
	}, { persist: shouldPersist } as any)
}
