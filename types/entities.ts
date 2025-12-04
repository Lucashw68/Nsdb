export type FieldType =
	| 'text'
	| 'textarea'
	| 'select'
	| 'checkbox'
	| 'number'
	| 'datetime'
	| 'file'
	| 'relation'

export type EntityField = {
	label: string
	type: FieldType
	required?: boolean
	readonly?: boolean
	default?: any
	options?: Array<{ label: string; value: any }>
	relation?: EntityRelation
}

export type RelationKind = 'belongsTo' | 'hasOne' | 'hasMany'

export interface EntityRelation {
	kind: RelationKind
	/** Table référencée dans Supabase (ex: "playlists") */
	referencedTable: string
	/** Colonnes locales qui forment la FK (souvent ["playlist_id"]) */
	localColumns: string[]
	/** Colonnes référencées (souvent ["id"]) */
	referencedColumns: string[]
	/** Nom de la FK dans Supabase (facultatif, pour debug) */
	foreignKeyName?: string,

	/**
	 * Champ de la table référencée à utiliser comme label.
	 * Exemple: "title", "username", "full_name", etc.
	 * Si non fourni, on tombera sur 'id' (sans guess "intelligent").
	 */
	displayField?: string

	/**
	 * Est-ce qu'on autorise la création inline de l'entité liée
	 * dans NsdbForm ? (préparation pour la suite)
	 */
	allowInlineCreate?: boolean
}