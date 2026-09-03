import type { Tables } from '~~/types/database.types'
import type { EntityField, EntityRelation } from '@lucashw68/nsdb/types/entities'
import * as Enums from '~~/nsdb/enums'

// Convenience row type for this table (optional)
export type GearsRow = Tables<'gears'>

/** ----- Schema (entities) for gears ----- */
export const GearsSchema: Record<keyof GearsRow, EntityField> = {
	color: { label: 'color', type: 'text', required: false },
	created_at: { label: 'created_at', type: 'text', required: false, readonly: true },
	device_id: { label: 'device_id', type: 'text', required: false },
	id: { label: 'id', type: 'text', required: false, readonly: true },
	image: { label: 'image', type: 'text', required: false },
	manufacturer: { label: 'manufacturer', type: 'text', required: true },
	name: { label: 'name', type: 'text', required: true },
	profile_id: { label: 'profile_id', type: 'relation', required: true, relation: { kind: 'belongsTo', referencedTable: 'profiles', localColumns: ['profile_id'], referencedColumns: ['id'], foreignKeyName: 'gears_profile_id_fkey' } },
	updated_at: { label: 'updated_at', type: 'text', required: false, readonly: true },
} as const

export const GearsRelations: EntityRelation[] = []
