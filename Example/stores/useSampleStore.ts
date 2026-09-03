import { createDbStore } from '@lucashw68/nsdb/createDbStore'
import type { Tables } from '~~/types/database.types'

type SamplesRow = Tables<'samples'>

export const useSampleStore = createDbStore<SamplesRow>('samples', {
	key: 'id',
	orderBy: 'id',
	defaultSort: 'desc',
	staleTimeMs: 5 * 60_000,
	persist: false,
})
