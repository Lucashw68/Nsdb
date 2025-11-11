import type { Tables } from '~/types/database.types'
import type { EntityField } from '@lucashw68/nsdb/types/entities'
import * as Enums from '~/nsdb/enums'

// Convenience row type for this table (optional)
export type __ROW__ = Tables<'__TABLE__'>

/** ----- Schema (entities) for __TABLE__ ----- */
export const __PASCAL__Schema: Record<keyof __ROW__, EntityField> = {
// __FIELDS__
} as const
