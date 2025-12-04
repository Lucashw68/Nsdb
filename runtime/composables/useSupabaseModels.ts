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
	orderBy?: string | Record<string, OrderDirection>
	limit?: number
	offset?: number
}

/**
 * Normalise un orderBy pour en extraire : colonne + direction.
 * - "created_at"          -> { orderBy: "created_at", orderDirection: "asc" }
 * - { created_at: "desc"} -> { orderBy: "created_at", orderDirection: "desc" }
 */
function normalizeOrder(
	rawOrderBy: ModelQuery['orderBy']
): { orderBy: string; orderDirection: OrderDirection } {
	let orderBy = 'id'
	let orderDirection: OrderDirection = 'asc'

	if (typeof rawOrderBy === 'string') {
		orderBy = rawOrderBy
	} else if (rawOrderBy && typeof rawOrderBy === 'object') {
		const [column, direction] = Object.entries(rawOrderBy)[0] as [
			string,
			OrderDirection | undefined
		]
		orderBy = column
		orderDirection = direction ?? 'asc'
	}

	return { orderBy, orderDirection }
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

			// On uniformise l'API sur async pour getById
			getById: async (id: string | number) =>
				(store.getById(id) as TRow | null) ?? null,

			create: store.create as (payload: Partial<TRow>) => Promise<TRow | null>,

			update: store.update as (
				id: string | number,
				payload: Partial<TRow>
			) => Promise<TRow | null>,

			remove: store.remove as (id: string | number) => void | Promise<void>,

			// On délègue entièrement la logique de query aux stores
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

		/**
		 * Récupère un enregistrement par son id.
		 */
		getById: async (id: string | number, select: string = '*') => {
			const response = await api.show<TRow>(modelName, id, select)
			return (response.data ?? null) as TRow | null
		},

		/**
		 * Crée un nouvel enregistrement.
		 */
		create: async (payload: Partial<TRow>) => {
			const response = await api.create<TRow>(modelName, payload)
			return (response.data ?? null) as TRow | null
		},

		/**
		 * Met à jour un enregistrement.
		 */
		update: async (id: string | number, payload: Partial<TRow>) => {
			const response = await api.update<TRow>(modelName, id, payload)
			return (response.data ?? null) as TRow | null
		},

		/**
		 * Supprime un enregistrement.
		 */
		remove: async (id: string | number) => {
			await api.destroy(modelName, id)
		},

		/**
		 * Fetch liste d'éléments depuis Supabase.
		 *
		 * - Si `query.where` est présent → utilise `api.find`
		 * - Sinon → utilise `api.all`
		 *
		 * Exemple :
		 *   fetch()
		 *   fetch({ select: '*, profile:profiles(*)' })
		 *   fetch({
		 *     where: { profile_id: { op: 'eq', value: profileId } },
		 *     orderBy: { created_at: 'desc' },
		 *     limit: 50,
		 *   })
		 */
		fetch: async (query: ModelQuery = {}) => {
			const {
				select = '*',
				where,
				limit = 100,
				offset = 0,
			} = query

			const { orderBy, orderDirection } = normalizeOrder(query.orderBy)

			let data: TRow[] = []

			// Avec filtre -> api.find
			if (where && Object.keys(where).length > 0) {
				const response = await api.find<TRow>(modelName, {
					select,
					where,
					orderBy,
					orderDirection,
					limit,
					offset,
				})

				data = (response.data ?? []) as TRow[]
			}
			// Sans filtre -> api.all
			else {
				const response = await api.all<TRow>(modelName, {
					select,
					orderBy,
					orderDirection,
					limit,
					offset,
				})

				data = (response.data ?? []) as TRow[]
			}

			items.value = Array.isArray(data) ? data : []
			return items.value
		},

		/**
		 * Pas de sync en mode API (placeholder).
		 */
		sync: () => {},
	}
}
