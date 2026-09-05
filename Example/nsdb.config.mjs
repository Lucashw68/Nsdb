export default {
	supabase: {
		schema: 'public',
		linked: false,
	},
	paths: {
		types: 'types/database.types.ts',
		enums: 'nsdb/enums.ts',
		schemas: 'nsdb/schemas',
		models: 'nsdb/models',
		composables: 'nsdb/composables',
		stores: 'stores',
	},
	imports: {
		databaseTypes: '~~/types/database.types',
	},
	tables: {
		include: [
			'authors',
			'categories',
			'component_records',
			'messages',
			'playlists',
			'posts',
			'profiles',
			'tags',
			'tracks',
		],
		columns: {
			component_records: {
				user_id: { serverOnly: true },
				created_at: { hidden: true },
			},
			playlists: {
				user_id: { serverOnly: true },
				created_at: { hidden: true },
				updated_at: { hidden: true },
			},
			profiles: {
				user_id: { serverOnly: true },
				created_at: { hidden: true },
			},
		},
	},
}
