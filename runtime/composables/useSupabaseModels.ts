// @lucashw68/nsdb/runtime/composables/useSupabaseModel.ts
import { useSupabaseApi } from './useSupabaseApi'
import type { Ref } from 'vue'
import { ref } from 'vue'

export interface StoreLike<T> {
  items: Ref<T[]>
  getById: (id: string) => T | null
  create: (payload: Partial<T>) => Promise<T | null>
  update: (id: string, payload: Partial<T>) => Promise<T | null>
  remove: (id: string) => void | Promise<void>
  fetchFromSupabase: () => Promise<T[]>
  subscribeToChanges?: () => void
}

type Options<T> =
  | boolean
  | { store?: boolean; storeCreator?: () => StoreLike<T> }

/**
 * Unified CRUD over a Supabase model.
 *
 * API mode (stateless): pass `false` or `{ store: false }`
 * Store mode (Pinia/offline): pass `{ store: true, storeCreator }`
 */
export function useSupabaseModel<TRow>(
  modelName: string,
  opts: Options<TRow> = false
) {
	const useStore = typeof opts === 'boolean' ? opts : !!opts.store
	const storeCreator =
		typeof opts === 'object' && opts.store ? opts.storeCreator : undefined

	// -----------------------------
	// Store-based model (offline/cache)
	// -----------------------------
	if (useStore) {
		if (!storeCreator) {
			throw new Error(
				`❌ useSupabaseModel("${modelName}", { store: true }) requires a storeCreator`
			)
		}
		const store = storeCreator()
		const noOp = () => {}
		return {
			...store,
			items: store.items as Ref<TRow[]>,
			getById: store.getById as (id: string) => TRow | null,
			create: store.create as (payload: Partial<TRow>) => Promise<TRow | null>,
			update: store.update as (
				id: string,
				payload: Partial<TRow>
			) => Promise<TRow | null>,
			remove: store.remove as (id: string) => void | Promise<void>,
			fetch: store.fetchFromSupabase,
			sync: store.subscribeToChanges ?? noOp,
		}
	}

	// -----------------------------
	// API-based model (stateless)
	// -----------------------------
	const api = useSupabaseApi()
	const items = ref<TRow[]>([])

	return {
		items,
		getById: async (id: string) =>
			(await api.show(modelName, id)).data as TRow,
		create: async (payload: Partial<TRow>) =>
			(await api.create(modelName, payload)).data as TRow,
		update: async (id: string, payload: Partial<TRow>) =>
			(await api.update(modelName, id, payload)).data as TRow,
		remove: async (id: string) => {
			await api.destroy(modelName, id)
		},
		fetch: async () => {
			const data = (await api.all(modelName)).data as TRow[]
			items.value = Array.isArray(data) ? data : []
			return items.value
		},
		sync: () => {},
	}
}
