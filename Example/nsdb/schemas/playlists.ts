import type { Tables } from '~~/types/database.types'
import type { EntityField, EntityRelation } from '@lucashw68/nsdb/types/entities'
import * as Enums from '~~/nsdb/enums'

// Convenience row type for this table (optional)
export type PlaylistsRow = Tables<'playlists'>

/** ----- Schema (entities) for playlists ----- */
export const PlaylistsSchema: Record<keyof PlaylistsRow, EntityField> = {
	created_at: { label: 'created_at', type: 'text', required: false, readonly: true },
	id: { label: 'id', type: 'text', required: false, readonly: true },
	item_count: { label: 'item_count', type: 'number', required: false },
	profile_id: { label: 'profile_id', type: 'relation', required: false, relation: { kind: 'belongsTo', referencedTable: 'profiles', localColumns: ['profile_id'], referencedColumns: ['id'], foreignKeyName: 'playlists_profile_id_fkey' } },
	provider: { label: 'provider', type: 'select', required: false, options: Enums.PROVIDERSValues.map(v => ({ label: String(v), value: v })) },
	provider_id: { label: 'provider_id', type: 'text', required: false },
	thumbnail: { label: 'thumbnail', type: 'text', required: false },
	title: { label: 'title', type: 'text', required: true },
	updated_at: { label: 'updated_at', type: 'text', required: false, readonly: true },
} as const

export const PlaylistsRelations: EntityRelation[] = []
