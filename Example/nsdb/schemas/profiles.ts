import type { Tables } from '~~/types/database.types'
import type { EntityField, EntityRelation } from '@lucashw68/nsdb/types/entities'
import * as Enums from '~~/nsdb/enums'

// Convenience row type for this table (optional)
export type ProfilesRow = Tables<'profiles'>

/** ----- Schema (entities) for profiles ----- */
export const ProfilesSchema: Record<keyof ProfilesRow, EntityField> = {
	avatar: { label: 'avatar', type: 'text', required: false },
	bio: { label: 'bio', type: 'text', required: false },
	created_at: { label: 'created_at', type: 'text', required: false, readonly: true },
	first_name: { label: 'first_name', type: 'text', required: false },
	full_name: { label: 'full_name', type: 'text', required: false },
	id: { label: 'id', type: 'text', required: false, readonly: true },
	last_name: { label: 'last_name', type: 'text', required: false },
	onboard: { label: 'onboard', type: 'checkbox', required: false },
	public: { label: 'public', type: 'checkbox', required: false },
	soundcloud: { label: 'soundcloud', type: 'text', required: false },
	spotify: { label: 'spotify', type: 'text', required: false },
	username: { label: 'username', type: 'text', required: false },
	youtube: { label: 'youtube', type: 'text', required: false },
} as const

export const ProfilesRelations: EntityRelation[] = []
