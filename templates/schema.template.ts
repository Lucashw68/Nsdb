import type { Tables } from '~~/types/database.types'
import type { EntityField, EntityRelation } from '@lucashw68/nsdb/types/entities'
import * as Enums from '~~/nsdb/enums'

// Convenience row type for this table (optional)
export type __ROW__ = Tables<'__TABLE__'>

/** ----- Schema (entities) for __TABLE__ ----- */
export const __PASCAL__Schema = {
// __FIELDS__
} as const satisfies Partial<Record<keyof __ROW__, EntityField>>

export const __PASCAL__Relations: EntityRelation[] = __RELATIONS__
