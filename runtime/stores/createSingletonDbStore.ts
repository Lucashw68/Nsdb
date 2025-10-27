import { skipHydrate } from 'pinia'

export interface SingletonStoreOptions<T> {
    /** Fonction de chargement de la ressource depuis Supabase ou autre */
    fetch: () => Promise<{ success: boolean; data?: T; error?: any }>

    /** Fonction de mise à jour de la ressource dans la base */
    update?: (partialData: Partial<T>) => Promise<{ success: boolean; data?: T; error?: any }>

    /** Clé d'identification unique du store */
    id: string

    /** Activer la persistance locale */
    persist?: boolean
}

export function createSingletonStore<T>(options: SingletonStoreOptions<T>) {
    const {
        id,
        fetch,
        update = async () => ({ success: false, error: 'Update not implemented' }),
        persist = false
    } = options

    return defineStore(id, () => {
        const data = ref<T | null>(null)
        const loading = ref(false)
        const error = ref<any>(null)

        const fetchData = async () => {
            loading.value = true
            const result = await fetch()
            loading.value = false

            if (result.success && result.data) {
                data.value = result.data
                error.value = null
            } else {
                error.value = result.error
            }

            return result
        }

        const updateData = async (partialData: Partial<T>) => {
            const result = await update(partialData)

            if (result.success && result.data) {
                data.value = result.data
                error.value = null
            } else {
                error.value = result.error
            }

            return result
        }

        return {
            data: skipHydrate(data),
            loading: skipHydrate(loading),
            error: skipHydrate(error),
            fetch: fetchData,
            update: updateData
        }
    }, { persist })
}
