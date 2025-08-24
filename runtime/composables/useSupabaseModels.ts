import { modelMap } from '@/types/models'
import type { ModelTypes } from '@/types/models'

// Type helper: infers the return type of useSupabaseModel for a given model name
type UseModelReturn<K extends keyof ModelTypes> = ReturnType<typeof useSupabaseModel<K>>

/**
 * Provides a unified interface to interact with a Supabase model,
 * either via a Pinia store (with offline/cache support),
 * or directly via Supabase API calls (stateless).
 *
 * @param modelName - The name of the Supabase table/model
 * @param useStore - Whether to use the associated Pinia store (default: false)
 * @returns An object exposing CRUD operations and list access
 */
export const useSupabaseModel = <K extends keyof ModelTypes>(modelName: K, useStore: boolean = false) => {
	// Get the associated store creator function from the model map
	const storeCreator = modelMap[modelName]

	// If store usage is requested but not found, throw an error
	if (useStore && !storeCreator) {
		throw new Error(`❌ Unknown model: ${modelName}`)
	}

	// ----------------------------------------
	// ⚡ Return a store-based model handler
	// ----------------------------------------
	if (useStore) {
		const store = storeCreator()

		return {
			...store, // Spread all existing store properties/methods

			// Explicitly typed helpers
			items: store.items as Ref<ModelTypes[K][]>,
			getById: store.getById as (id: string) => ModelTypes[K] | null,
			create: store.create as (payload: Partial<ModelTypes[K]>) => Promise<ModelTypes[K] | null>,
			update: store.update as (id: string, payload: Partial<ModelTypes[K]>) => Promise<ModelTypes[K] | null>,
			remove: store.remove as (id: string) => void,

			// Sync / fetch utilities
			fetch: store.fetchFromSupabase,
			sync: store.subscribeToChanges,
		}
	}

	// ----------------------------------------
	// 🧪 Return a stateless API-based handler
	// ----------------------------------------
	else {
		const api = useSupabaseApi()

		return {
			items: ref<ModelTypes[K][]>([]), // Local list (not auto-filled)

			// CRUD methods mapped to raw API
			getById: async (id: string) => (await api.show(modelName, id)).data as ModelTypes[K],
			create: async (payload: Partial<ModelTypes[K]>) => (await api.create(modelName, payload)).data as ModelTypes[K],
			update: async (id: string, payload: Partial<ModelTypes[K]>) => (await api.update(modelName, id, payload)).data as ModelTypes[K],
			remove: async (id: string) => { await api.destroy(modelName, id) },

			// Fetch full list from Supabase
			fetch: async () => (await api.all(modelName)).data as ModelTypes[K][]
		}
	}
}
