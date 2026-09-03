import { createDbStore } from '@lucashw68/nsdb/createDbStore'
import type { Tables } from '~~/types/database.types'

type PlaylistsRow = Tables<'playlists'>

export const usePlaylistStore = createDbStore<PlaylistsRow>('playlists', {
	key: 'id',
	orderBy: 'id',
	defaultSort: 'desc',
	staleTimeMs: 5 * 60_000,
	persist: false,
})
