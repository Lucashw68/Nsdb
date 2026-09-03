import { createDbStore } from '@lucashw68/nsdb/createDbStore'
import type { Tables } from '~~/types/database.types'

type ProfilesRow = Tables<'profiles'>

export const useProfileStore = createDbStore<ProfilesRow>('profiles', {
	key: 'id',
	orderBy: 'id',
	defaultSort: 'desc',
})
