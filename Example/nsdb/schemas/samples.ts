import type { Tables } from '~~/types/database.types'
import type { EntityField, EntityRelation } from '@lucashw68/nsdb/types/entities'
import * as Enums from '~~/nsdb/enums'

// Convenience row type for this table (optional)
export type SamplesRow = Tables<'samples'>

/** ----- Schema (entities) for samples ----- */
export const SamplesSchema: Record<keyof SamplesRow, EntityField> = {
	bpm: { label: 'bpm', type: 'number', required: false },
	created_at: { label: 'created_at', type: 'text', required: false, readonly: true },
	id: { label: 'id', type: 'text', required: false, readonly: true },
	key: { label: 'key', type: 'text', required: false },
	name: { label: 'name', type: 'text', required: false },
	profile_id: { label: 'profile_id', type: 'relation', required: false, relation: { kind: 'belongsTo', referencedTable: 'profiles', localColumns: ['profile_id'], referencedColumns: ['id'], foreignKeyName: 'samples_profile_id_fkey' } },
	storage_path: { label: 'storage_path', type: 'text', required: false },
	type: { label: 'type', type: 'text', required: false },
} as const

export const SamplesRelations: EntityRelation[] = []
