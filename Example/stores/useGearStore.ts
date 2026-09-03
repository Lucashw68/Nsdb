import { createDbStore } from '@lucashw68/nsdb/createDbStore'
import type { Tables } from '~~/types/database.types'

type GearsRow = Tables<'gears'>

export const useGearStore = createDbStore<GearsRow>('gears', {
	key: 'id',
	orderBy: 'id',
	defaultSort: 'desc',
	staleTimeMs: 5 * 60_000,
})
