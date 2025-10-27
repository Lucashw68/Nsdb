import { skipHydrate, defineStore } from 'pinia'

export function createDbStore<T extends Record<string, any>>(resource: string, options: {
	key?: keyof T
	orderBy?: keyof T
	defaultSort?: 'asc' | 'desc'
}) {
	const key = options.key || 'id'
	const orderBy = options.orderBy || 'updated_at'
	const sortDir = options.defaultSort || 'desc'

	return defineStore(`db_${resource}`, () => {
		const supabase = useSupabaseClient()
		const items = ref<T[]>([])
		const loading = ref(false)

		let subscription: ReturnType<typeof supabase.channel> | null = null

		const fetchFromSupabase = async () => {
			loading.value = true
			const lastUpdated = items.value.reduce((acc, item) => {
				const ts = new Date(item.updated_at || 0).getTime()
				return ts > acc ? ts : acc
			}, 0)

			let query = supabase
				.from(resource)
				.select('*')
				.order(orderBy as string, { ascending: sortDir === 'asc' })

			if (lastUpdated > 0) {
				query = query.gte('updated_at', new Date(lastUpdated).toISOString())
			}

			const { data, error } = await query
			if (error) {
				console.error(`[${resource}] fetch error`, error)
			} else if (data) {
				mergeItems(data)
			}

			loading.value = false
		}

		const mergeItems = (newItems: T[]) => {
			const map = new Map(items.value.map(item => [item[key], item]))
			for (const newItem of newItems) {
				map.set(newItem[key], newItem)
			}
			items.value = Array.from(map.values())
		}

		const addOrUpdate = (item: T) => {
			const index = items.value.findIndex(i => i[key] === item[key])
			if (index !== -1) items.value[index] = item
			else items.value.unshift(item)
		}

		const remove = (id: string | number) => {
			items.value = items.value.filter(i => i[key] !== id)
		}

		const getById = (id: string | number) => {
			return items.value.find(i => i[key] === id) || null
		}

		const create = async (payload: Partial<T>): Promise<T | null> => {
			const { data, error } = await supabase
				.from(resource)
				.insert(payload)
				.select()
				.single()

			if (error) {
				console.error(`[${resource}] create error`, error)
				throw error
			}
			addOrUpdate(data)
			return data
		}

		const update = async (id: string | number, payload: Partial<T>): Promise<T | null> => {
			const { data, error } = await supabase
				.from(resource)
				.update(payload)
				.eq(key as string, id)
				.select()
				.single()

			if (error) {
				console.error(`[${resource}] update error`, error)
				throw error
			}
			addOrUpdate(data)
			return data
		}

		const destroy = async (id: string | number) => {
			const { error } = await supabase
				.from(resource)
				.delete()
				.eq(key as string, id)

			if (error) {
				console.error(`[${resource}] delete error`, error)
				throw error
			}
			remove(id)
		}

		const subscribeToChanges = () => {
			if (subscription) return // déjà abonné

			subscription = supabase
				.channel(`public:${resource}`)
				.on('postgres_changes', {
					event: '*',
					schema: 'public',
					table: resource
				}, (payload) => {
					const { eventType, new: newItem, old } = payload

					if (eventType === 'INSERT' || eventType === 'UPDATE') {
						addOrUpdate(newItem)
					} else if (eventType === 'DELETE') {
						remove(old[key])
					}
				})
				.subscribe()

			console.info(`[${resource}] realtime subscription initialized`)
		}

		return {
			items: skipHydrate(items),
			loading: skipHydrate(loading),
			fetchFromSupabase,
			addOrUpdate,
			remove,
			getById,
			create,
			update,
			destroy,
			subscribeToChanges
		}
	}, { persist: true })
}
