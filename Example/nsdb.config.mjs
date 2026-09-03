export default {
	supabase: {
		schema: 'public',
		projectId: process.env.SUPABASE_PROJECT_ID,
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
		columns: {
			component_records: {
				user_id: { serverOnly: true },
				created_at: { hidden: true },
			},
		},
	},
}
