import { createDbStore } from '@lucashw68/nsdb/createDbStore'
import type { Tables } from '../../types/database.types'
import { defineStore } from 'pinia'

type Playlists = Tables<'playlists'>

const baseStore = createDbStore<Playlists>('playlists', {
	key: 'id',
	orderBy: 'updated_at',
	defaultSort: 'desc',
})

export const usePlaylistsStore = defineStore('playlists', () => {
	const store = baseStore()
	return { ...store }
})
