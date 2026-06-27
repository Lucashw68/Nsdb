import { computed, ref, watch } from 'vue'
import { useSupabaseUser } from '#imports'
import { useSupabaseApi } from './useSupabaseApi'

export type NsdbProfileDefaults<TProfile extends Record<string, any>> = (
	user: any
) => Partial<TProfile>

export interface UseNsdbProfileOptions<TProfile extends Record<string, any>> {
	table?: string
	select?: string
	userColumn?: string
	idColumn?: keyof TProfile | string
	createIfMissing?: boolean
	defaults?: NsdbProfileDefaults<TProfile>
	immediate?: boolean
}

export function useNsdbProfile<TProfile extends Record<string, any> = Record<string, any>>(
	options: UseNsdbProfileOptions<TProfile> = {}
) {
	const {
		table = 'profiles',
		select = '*',
		userColumn = 'user_id',
		idColumn = 'id',
		createIfMissing = false,
		defaults = (user: any) => ({ [userColumn]: user.id, email: user.email } as unknown as Partial<TProfile>),
		immediate = true,
	} = options

	const user = useSupabaseUser()
	const api = useSupabaseApi()
	const profile = ref<TProfile | null>(null)
	const loading = ref(false)
	const error = ref<unknown>(null)

	const profileId = computed(() => {
		const currentProfile = profile.value as Record<string, any> | null
		return currentProfile?.[idColumn as string] ?? null
	})

	async function createProfile() {
		if (!user.value?.id) return null

		const payload = defaults(user.value)
		const response = await api.create<TProfile>(table, payload)

		if (!response.success) {
			throw response.error
		}

		profile.value = response.data ?? null
		return profile.value
	}

	async function refresh() {
		if (!user.value?.id) {
			profile.value = null
			return null
		}

		loading.value = true
		error.value = null

		try {
			const response = await api.find<TProfile>(table, {
				select,
				where: {
					[userColumn]: user.value.id,
				},
				limit: 1,
				offset: 0,
			})

			if (!response.success) {
				throw response.error
			}

			profile.value = response.data[0] ?? null

			if (!profile.value && createIfMissing) {
				return await createProfile()
			}

			return profile.value
		} catch (profileError) {
			error.value = profileError
			throw profileError
		} finally {
			loading.value = false
		}
	}

	async function ensureProfile() {
		if (profile.value) return profile.value
		return await refresh()
	}

	if (immediate) {
		watch(
			() => user.value?.id ?? null,
			() => {
				refresh().catch(() => {})
			},
			{ immediate: true }
		)
	}

	return {
		user,
		profile,
		profileId,
		loading,
		error,
		refresh,
		ensureProfile,
	}
}
