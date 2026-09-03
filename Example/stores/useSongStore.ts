import { createDbStore } from '@lucashw68/nsdb/createDbStore'
import type { Tables } from '~~/types/database.types'

type SongsRow = Tables<'songs'>

export const useSongStore = createDbStore<SongsRow>('songs', {
	key: 'id',
	orderBy: 'id',
	defaultSort: 'desc',
	staleTimeMs: 5 * 60_000,
	persist: false,
})
