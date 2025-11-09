// templates/schema.tpl.ts
import type { Tables } from '~/types/database.types'
import type { EntityField } from '@lucashw68/nsdb/types/entities'

// Convenience row type for this table (optional but handy)
export type __ROW__ = Tables<'__TABLE__'>

/** ----- Schema (entities) for __TABLE__ ----- */
export const __PASCAL__Schema: Record<keyof __ROW__, EntityField> = {
	// id: { type: 'uuid', pk: true, readonly: true },
	// name: { type: 'string', required: true },
} as const
