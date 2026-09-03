import type { Tables } from '~~/types/database.types'
import type { EntityField, EntityRelation } from '@lucashw68/nsdb/types/entities'
import * as Enums from '~~/nsdb/enums'

// Convenience row type for this table (optional)
export type SongsRow = Tables<'songs'>

/** ----- Schema (entities) for songs ----- */
export const SongsSchema: Record<keyof SongsRow, EntityField> = {
	artist_name: { label: 'artist_name', type: 'text', required: false },
	bucket_path: { label: 'bucket_path', type: 'text', required: false },
	clean_title: { label: 'clean_title', type: 'text', required: false },
	content_type: { label: 'content_type', type: 'text', required: false },
	created_at: { label: 'created_at', type: 'text', required: false, readonly: true },
	genres: { label: 'genres', type: 'text', required: false },
	id: { label: 'id', type: 'text', required: false, readonly: true },
	metadata_confidence: { label: 'metadata_confidence', type: 'number', required: false },
	metadata_status: { label: 'metadata_status', type: 'text', required: false },
	owner: { label: 'owner', type: 'text', required: true },
	playlist_id: { label: 'playlist_id', type: 'relation', required: true, relation: { kind: 'belongsTo', referencedTable: 'playlists', localColumns: ['playlist_id'], referencedColumns: ['id'], foreignKeyName: 'playlistItems_playlist_id_fkey' } },
	profile_id: { label: 'profile_id', type: 'relation', required: true, relation: { kind: 'belongsTo', referencedTable: 'profiles', localColumns: ['profile_id'], referencedColumns: ['id'], foreignKeyName: 'songs_profile_id_fkey' } },
	provider: { label: 'provider', type: 'select', required: true, options: Enums.PROVIDERSValues.map(v => ({ label: String(v), value: v })) },
	provider_id: { label: 'provider_id', type: 'text', required: false },
	resource_id: { label: 'resource_id', type: 'text', required: true },
	thumbnail: { label: 'thumbnail', type: 'text', required: true },
	title: { label: 'title', type: 'text', required: true },
} as const

export const SongsRelations: EntityRelation[] = []
